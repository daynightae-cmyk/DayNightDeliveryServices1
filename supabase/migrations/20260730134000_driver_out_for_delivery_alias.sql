-- DAY NIGHT DELIVERY SERVICES
-- Preserve compatibility with legacy clients that send out_for_delivery while
-- storing only the canonical production status in_transit.

begin;

create or replace function public.driver_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order public.orders%rowtype;
  v_status text := lower(replace(btrim(coalesce(p_status,'')),' ','_'));
  v_order_status_type text;
  v_order_status_is_enum boolean := false;
  v_history_status_type text;
  v_history_status_is_enum boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_status in ('accepted','approved') then v_status := 'confirmed'; end if;
  if v_status in ('out_for_delivery','out-for-delivery') then v_status := 'in_transit'; end if;
  if v_status='failed' then v_status := 'cancelled'; end if;
  if v_status='confirmed' then return public.driver_start_mission(p_order_id,p_note); end if;
  if v_status not in ('confirmed','picked_up','in_transit','delivered','cancelled','returned','postponed') then
    raise exception 'unsupported_driver_status: %',p_status;
  end if;
  if v_status in ('delivered','cancelled','returned') and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'status_note_required';
  end if;

  select * into v_driver
  from public.driver_profiles
  where (id=auth.uid() or user_id=auth.uid()) and status::text='active'
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required_or_inactive'; end if;

  select * into v_order
  from public.orders
  where (id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id)
    and (driver_id=v_driver.id or assigned_driver_id=v_driver.id)
  limit 1;
  if not found then raise exception 'order_not_assigned_to_driver'; end if;

  select format('%I.%I', ns.nspname, typ.typname), typ.typtype='e'
    into v_order_status_type, v_order_status_is_enum
  from pg_attribute att
  join pg_class cls on cls.oid=att.attrelid
  join pg_namespace relns on relns.oid=cls.relnamespace
  join pg_type typ on typ.oid=att.atttypid
  join pg_namespace ns on ns.oid=typ.typnamespace
  where relns.nspname='public' and cls.relname='orders' and att.attname='status'
    and att.attnum>0 and not att.attisdropped;

  if v_order_status_is_enum then
    execute format(
      'update public.orders set status=$1::%s,driver_id=$2,assigned_driver_id=$2,driver_name=coalesce($3,driver_name),driver_phone=coalesce($4,driver_phone),updated_at=now() where id=$5 returning *',
      v_order_status_type
    ) into v_order using v_status,v_driver.id,v_driver.full_name,v_driver.phone,v_order.id;
  else
    update public.orders set
      status=v_status,
      driver_id=v_driver.id,
      assigned_driver_id=v_driver.id,
      driver_name=coalesce(v_driver.full_name,driver_name),
      driver_phone=coalesce(v_driver.phone,driver_phone),
      updated_at=now()
    where id=v_order.id returning * into v_order;
  end if;

  if to_regclass('public.order_status_history') is not null then
    select format('%I.%I', ns.nspname, typ.typname), typ.typtype='e'
      into v_history_status_type, v_history_status_is_enum
    from pg_attribute att
    join pg_class cls on cls.oid=att.attrelid
    join pg_namespace relns on relns.oid=cls.relnamespace
    join pg_type typ on typ.oid=att.atttypid
    join pg_namespace ns on ns.oid=typ.typnamespace
    where relns.nspname='public' and cls.relname='order_status_history' and att.attname='status'
      and att.attnum>0 and not att.attisdropped;

    if v_history_status_is_enum then
      execute format(
        'insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at) values ($1,$2::%s,$3,$4,$5,now())',
        v_history_status_type
      ) using v_order.id,v_status,coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),v_driver.id,auth.uid();
    else
      insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
      values (v_order.id,v_status,coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),v_driver.id,auth.uid(),now());
    end if;
  end if;

  if v_status in ('delivered','cancelled','returned') then
    update public.driver_locations set current_order_id=null,updated_at=now()
    where driver_id=v_driver.id and current_order_id=v_order.id;
    update public.driver_profiles set shift_status='available',updated_at=now() where id=v_driver.id;
  else
    update public.driver_locations set current_order_id=v_order.id,updated_at=now() where driver_id=v_driver.id;
    update public.driver_profiles set shift_status='busy',updated_at=now() where id=v_driver.id;
  end if;

  perform public.driver_audit(
    v_driver.id,
    'order_status_updated',
    v_order.id,
    jsonb_build_object('status',v_status,'requested_status',p_status,'note',p_note,'source','driver_portal')
  );
  return jsonb_build_object('ok',true,'order_id',v_order.id,'status',v_status,'requested_status',p_status);
end
$dn$;

revoke all on function public.driver_update_order_status(text,text,text) from public, anon;
grant execute on function public.driver_update_order_status(text,text,text) to authenticated;

notify pgrst, 'reload schema';

commit;
