begin;

create or replace function public.dn_ensure_order_status_history_v3()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_note text := 'تحديث حالة الطلب من لوحة الإدارة';
  v_created_at timestamptz := clock_timestamp();
  v_last_history jsonb;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if jsonb_typeof(to_jsonb(new) -> 'status_history') = 'array'
     and jsonb_array_length(to_jsonb(new) -> 'status_history') > 0 then
    v_last_history := (to_jsonb(new) -> 'status_history')
      -> (jsonb_array_length(to_jsonb(new) -> 'status_history') - 1);
    v_note := coalesce(nullif(btrim(v_last_history ->> 'note'), ''), v_note);
    v_created_at := coalesce(
      nullif(v_last_history ->> 'created_at', '')::timestamptz,
      nullif(v_last_history ->> 'timestamp', '')::timestamptz,
      v_created_at
    );
    v_actor := coalesce(
      public.dn_admin_safe_uuid_v3(v_last_history ->> 'changed_by_user_id'),
      v_actor
    );
  end if;

  if v_actor is not null
     and not exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor := null;
  end if;

  if exists (
    select 1
    from public.order_status_history h
    where h.order_id = new.id
      and h.status = new.status
      and h.created_at between v_created_at - interval '2 seconds'
                           and v_created_at + interval '2 seconds'
  ) then
    return new;
  end if;

  begin
    insert into public.order_status_history(
      order_id,
      status,
      note,
      changed_by,
      created_at,
      driver_id
    ) values (
      new.id,
      new.status,
      v_note,
      v_actor,
      v_created_at,
      coalesce(new.driver_id, new.assigned_driver_id)
    );
  exception when others then
    -- The order row remains authoritative. The canonical RPC audit and embedded
    -- status_history still retain evidence if a future schema extension conflicts.
    null;
  end;

  return new;
end;
$$;

revoke all on function public.dn_ensure_order_status_history_v3() from public;
grant execute on function public.dn_ensure_order_status_history_v3() to authenticated, service_role;

drop trigger if exists trg_dn_ensure_order_status_history_v3 on public.orders;
create trigger trg_dn_ensure_order_status_history_v3
after update of status on public.orders
for each row
execute function public.dn_ensure_order_status_history_v3();

commit;
