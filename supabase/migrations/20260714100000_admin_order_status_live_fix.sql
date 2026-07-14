create or replace function public.admin_normalize_order_status(p_status text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_status, '')));
begin
  v := replace(replace(replace(v, '-', '_'), ' ', '_'), 'ـ', '');

  if v = '' then return 'pending'; end if;
  if v in ('pending','new','order_pending','waiting','قيد_الانتظار','جديد','طلب_جديد') then return 'pending'; end if;
  if v in ('review','under_review','needs_review','manual_review','manual_approval','hold','قيد_المراجعة','مراجعة','تحت_المراجعة') then return 'review'; end if;
  if v in ('confirmed','accepted','approved','تم_التأكيد','تم_التاكيد','مؤكد','معتمد') then return 'confirmed'; end if;
  if v in ('assigned','driver_assigned','assign','معين','تم_تعيين_مندوب','تعيين_مندوب') then return 'assigned'; end if;
  if v in ('picked_up','pickup','collecting','collected','collect','قيد_الإحضار','قيد_الاحضار','تم_الإحضار','تم_الاحضار','إحضار','احضار') then return 'picked_up'; end if;
  if v in ('in_transit','out_for_delivery','on_route','on_the_way','transit','في_الطريق','جاري_التوصيل','بالطريق') then return 'in_transit'; end if;
  if v in ('delivered','completed','complete','order_delivered','تم_التسليم','مسلم','تسليم') then return 'delivered'; end if;
  if v in ('postponed','postpone','scheduled','deferred','later','مؤجلة','مؤجل','تأجيل','تاجيل') then return 'postponed'; end if;
  if v in ('returned','return','return_to_merchant','راجعة','راجع','مرتجع','مرتجعة','إرجاع','ارجاع','استرجاع') then return 'returned'; end if;
  if v in ('cancelled','canceled','cancel','failed','order_cancelled','ملغية','ملغي','مكنسل','كنسل','إلغاء','الغاء','مرفوض','رفض') then return 'cancelled'; end if;

  raise exception 'Unsupported order status: %', p_status using errcode = '22023';
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_ref text,
  p_status text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := public.admin_normalize_order_status(p_status);
  v_order public.orders%rowtype;
  v_order_id uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_uid uuid := auth.uid();
  v_role text;
  v_has_profiles boolean := to_regclass('public.profiles') is not null;
  v_has_updated_at boolean;
  v_cols text[];
  v_vals text[];
  v_sql text;
begin
  if p_order_ref is null or trim(p_order_ref) = '' then
    raise exception 'Order reference is required' using errcode = '22023';
  end if;

  if v_uid is not null and v_has_profiles then
    select lower(coalesce(role, '')) into v_role from public.profiles where id = v_uid limit 1;
    if coalesce(v_role, '') not in ('admin', 'support') then
      raise exception 'Admin/support permission is required to update order status' using errcode = '42501';
    end if;
  end if;

  select o.id into v_order_id
    from public.orders o
   where o.id::text = p_order_ref
      or o.tracking_number = p_order_ref
      or o.invoice_number = p_order_ref
      or o.coupon_number = p_order_ref
   order by o.created_at desc nulls last
   limit 1;

  if v_order_id is null then
    raise exception 'Order not found: %', p_order_ref using errcode = 'P0002';
  end if;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'orders' and column_name = 'updated_at'
  ) into v_has_updated_at;

  if v_has_updated_at then
    update public.orders set status = v_status, updated_at = now() where id = v_order_id returning * into v_order;
  else
    update public.orders set status = v_status where id = v_order_id returning * into v_order;
  end if;

  if to_regclass('public.order_status_history') is not null then
    v_cols := array[]::text[];
    v_vals := array[]::text[];

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_status_history' and column_name='order_id') then
      v_cols := array_append(v_cols, 'order_id'); v_vals := array_append(v_vals, '$1');
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_status_history' and column_name='status') then
      v_cols := array_append(v_cols, 'status'); v_vals := array_append(v_vals, '$2');
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_status_history' and column_name='note') then
      v_cols := array_append(v_cols, 'note'); v_vals := array_append(v_vals, '$3');
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_status_history' and column_name='created_at') then
      v_cols := array_append(v_cols, 'created_at'); v_vals := array_append(v_vals, 'now()');
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='order_status_history' and column_name='changed_by') then
      v_cols := array_append(v_cols, 'changed_by'); v_vals := array_append(v_vals, '$4');
    end if;

    if array_length(v_cols, 1) is not null then
      v_sql := format('insert into public.order_status_history(%s) values (%s)', array_to_string(v_cols, ','), array_to_string(v_vals, ','));
      execute v_sql using v_order.id, v_status, coalesce(v_note, 'Admin status update'), v_uid;
    end if;
  end if;

  begin
    if to_regclass('public.admin_audit_events') is not null then
      if exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_audit_events' and column_name='event_type') then
        insert into public.admin_audit_events(event_type, entity_type, entity_id, payload, created_at)
        values ('order_status_updated', 'order', v_order.id::text, jsonb_build_object('status', v_status, 'note', v_note, 'order_ref', p_order_ref), now());
      end if;
    elsif to_regclass('public.audit_log') is not null then
      insert into public.audit_log(action, entity_type, entity_id, payload, created_at)
      values ('order_status_updated', 'order', v_order.id::text, jsonb_build_object('status', v_status, 'note', v_note, 'order_ref', p_order_ref), now());
    end if;
  exception when others then
    raise notice 'admin_update_order_status audit skipped: %', sqlerrm;
  end;

  return v_order;
end;
$$;

grant execute on function public.admin_normalize_order_status(text) to authenticated;
grant execute on function public.admin_update_order_status(text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Verification queries for Supabase SQL Editor:
-- select public.admin_normalize_order_status('قيد المراجعة');
-- select proname from pg_proc where proname in ('admin_update_order_status','admin_normalize_order_status');
