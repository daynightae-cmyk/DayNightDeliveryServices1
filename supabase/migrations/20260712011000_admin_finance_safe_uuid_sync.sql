-- DAY NIGHT Admin Finance safe UUID sync hardening.
-- Prevents finance synchronization from failing when legacy order rows store driver codes/names instead of UUIDs.

create or replace function public.admin_safe_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;

  if value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return value::uuid;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.admin_sync_order_operation_rows()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare synced_cod integer := 0; synced_merchants integer := 0; synced_drivers integer := 0;
begin
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;

  insert into public.cod_collections(order_id, tracking_number, merchant_id, driver_id, cod_amount, collected_amount, collection_date, status, notes, created_by)
  select
    o.id,
    coalesce(o.tracking_number, o.invoice_number, o.coupon_number),
    o.merchant_id,
    public.admin_safe_uuid(coalesce((o::jsonb->>'driver_id'), (o::jsonb->>'assigned_driver_id'))),
    coalesce(o.cod_amount,0),
    case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then coalesce(o.cod_amount,0) else 0 end,
    coalesce(o.created_at::date, current_date),
    case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then 'collected' else 'pending' end,
    'Synced from production orders',
    auth.uid()
  from public.orders o
  where coalesce(o.cod_amount,0) > 0
  on conflict (order_id) where order_id is not null do update set
    tracking_number = excluded.tracking_number,
    merchant_id = excluded.merchant_id,
    driver_id = excluded.driver_id,
    cod_amount = excluded.cod_amount,
    collected_amount = greatest(public.cod_collections.collected_amount, excluded.collected_amount),
    updated_at = now();
  get diagnostics synced_cod = row_count;

  insert into public.merchant_statement_entries(merchant_id, order_id, tracking_number, entry_date, entry_type, debit, credit, balance, status, notes, created_by)
  select
    o.merchant_id,
    o.id,
    coalesce(o.tracking_number, o.invoice_number, o.coupon_number),
    coalesce(o.created_at::date, current_date),
    'delivery_fee',
    coalesce(o.delivery_price, o.base_price, o.price, 0),
    coalesce(o.cod_amount,0),
    coalesce(o.cod_amount,0) - coalesce(o.delivery_price, o.base_price, o.price, 0),
    'posted',
    'Synced from production orders',
    auth.uid()
  from public.orders o
  where o.merchant_id is not null
  on conflict (order_id, entry_type) where order_id is not null do update set
    debit = excluded.debit,
    credit = excluded.credit,
    balance = excluded.balance,
    updated_at = now();
  get diagnostics synced_merchants = row_count;

  insert into public.driver_statement_entries(driver_id, order_id, tracking_number, entry_date, entry_type, debit, credit, balance, status, notes, created_by)
  select
    public.admin_safe_uuid(coalesce((o::jsonb->>'driver_id'), (o::jsonb->>'assigned_driver_id'))),
    o.id,
    coalesce(o.tracking_number, o.invoice_number, o.coupon_number),
    coalesce(o.created_at::date, current_date),
    'driver_delivery',
    case when coalesce(o.cod_amount,0) > 0 then coalesce(o.cod_amount,0) else 0 end,
    case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then least(coalesce(o.delivery_price, o.base_price, o.price, 0), 10) else 0 end,
    case when lower(coalesce(o.status::text,'')) in ('delivered','completed') then least(coalesce(o.delivery_price, o.base_price, o.price, 0), 10) - coalesce(o.cod_amount,0) else -coalesce(o.cod_amount,0) end,
    'posted',
    'Synced from production orders',
    auth.uid()
  from public.orders o
  where public.admin_safe_uuid(coalesce((o::jsonb->>'driver_id'), (o::jsonb->>'assigned_driver_id'))) is not null
  on conflict (order_id, entry_type) where order_id is not null do update set
    debit = excluded.debit,
    credit = excluded.credit,
    balance = excluded.balance,
    updated_at = now();
  get diagnostics synced_drivers = row_count;

  insert into public.admin_audit_events(entity_type, action, metadata, actor_id)
  values ('finance_sync', 'admin_sync_order_operation_rows', jsonb_build_object('cod', synced_cod, 'merchant_entries', synced_merchants, 'driver_entries', synced_drivers), auth.uid());

  return jsonb_build_object('ok', true, 'cod', synced_cod, 'merchant_entries', synced_merchants, 'driver_entries', synced_drivers);
end;
$$;

grant execute on function public.admin_safe_uuid(text) to authenticated;
grant execute on function public.admin_sync_order_operation_rows() to authenticated;
