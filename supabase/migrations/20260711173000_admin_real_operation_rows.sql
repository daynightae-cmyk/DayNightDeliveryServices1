-- Admin production real-data pass.
-- Converts order-backed operational branches into real database rows instead of UI-only derived rows.
-- Idempotent, safe, no destructive changes, no secrets.

create extension if not exists pgcrypto;

create or replace function public.dn_safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;

  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.dn_safe_numeric(value text, fallback numeric default 0)
returns numeric
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return fallback;
  end if;

  return value::numeric;
exception when others then
  return fallback;
end;
$$;

create unique index if not exists cod_collections_order_id_unique
  on public.cod_collections(order_id)
  where order_id is not null;

create unique index if not exists cod_collections_tracking_unique_when_no_order
  on public.cod_collections(tracking_number)
  where tracking_number is not null and order_id is null;

create unique index if not exists merchant_statement_entries_order_type_unique
  on public.merchant_statement_entries(order_id, entry_type)
  where order_id is not null;

create unique index if not exists driver_statement_entries_order_type_unique
  on public.driver_statement_entries(order_id, entry_type)
  where order_id is not null;

create or replace function public.admin_sync_order_operation_rows()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_cod_inserted integer := 0;
  v_merchant_cod_inserted integer := 0;
  v_merchant_fee_inserted integer := 0;
  v_driver_fee_inserted integer := 0;
  v_now timestamptz := now();
begin
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  -- Real COD collection rows from real orders.
  insert into public.cod_collections (
    order_id,
    tracking_number,
    merchant_id,
    driver_id,
    cod_amount,
    collected_amount,
    reconciled_amount,
    collection_date,
    status,
    payment_method,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    public.dn_safe_uuid(o.row_data->>'id'),
    nullif(coalesce(o.row_data->>'tracking_number', o.row_data->>'invoice_number', o.row_data->>'coupon_number'), ''),
    public.dn_safe_uuid(o.row_data->>'merchant_id'),
    coalesce(public.dn_safe_uuid(o.row_data->>'driver_id'), public.dn_safe_uuid(o.row_data->>'assigned_driver_id')),
    public.dn_safe_numeric(o.row_data->>'cod_amount', 0),
    0,
    0,
    current_date,
    'pending',
    coalesce(nullif(o.row_data->>'payment_method', ''), 'cash'),
    'Created from real order by admin_sync_order_operation_rows',
    auth.uid(),
    v_now,
    v_now
  from (
    select to_jsonb(orders.*) as row_data
    from public.orders
  ) o
  where public.dn_safe_numeric(o.row_data->>'cod_amount', 0) > 0
    and not exists (
      select 1
      from public.cod_collections c
      where (public.dn_safe_uuid(o.row_data->>'id') is not null and c.order_id = public.dn_safe_uuid(o.row_data->>'id'))
         or (public.dn_safe_uuid(o.row_data->>'id') is null and c.tracking_number = nullif(coalesce(o.row_data->>'tracking_number', o.row_data->>'invoice_number', o.row_data->>'coupon_number'), ''))
    );
  get diagnostics v_cod_inserted = row_count;

  -- Merchant COD credit entries from real COD orders.
  insert into public.merchant_statement_entries (
    merchant_id,
    order_id,
    tracking_number,
    entry_date,
    entry_type,
    debit,
    credit,
    balance,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    public.dn_safe_uuid(o.row_data->>'merchant_id'),
    public.dn_safe_uuid(o.row_data->>'id'),
    nullif(coalesce(o.row_data->>'tracking_number', o.row_data->>'invoice_number', o.row_data->>'coupon_number'), ''),
    coalesce(nullif(o.row_data->>'created_at', '')::date, current_date),
    'order_cod_credit',
    0,
    public.dn_safe_numeric(o.row_data->>'cod_amount', 0),
    public.dn_safe_numeric(o.row_data->>'cod_amount', 0),
    'posted',
    'Real COD credit from orders table',
    auth.uid(),
    v_now,
    v_now
  from (
    select to_jsonb(orders.*) as row_data
    from public.orders
  ) o
  where public.dn_safe_numeric(o.row_data->>'cod_amount', 0) > 0
    and public.dn_safe_uuid(o.row_data->>'id') is not null
    and not exists (
      select 1
      from public.merchant_statement_entries m
      where m.order_id = public.dn_safe_uuid(o.row_data->>'id')
        and m.entry_type = 'order_cod_credit'
    );
  get diagnostics v_merchant_cod_inserted = row_count;

  -- Merchant delivery fee debit entries from real orders.
  insert into public.merchant_statement_entries (
    merchant_id,
    order_id,
    tracking_number,
    entry_date,
    entry_type,
    debit,
    credit,
    balance,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    public.dn_safe_uuid(o.row_data->>'merchant_id'),
    public.dn_safe_uuid(o.row_data->>'id'),
    nullif(coalesce(o.row_data->>'tracking_number', o.row_data->>'invoice_number', o.row_data->>'coupon_number'), ''),
    coalesce(nullif(o.row_data->>'created_at', '')::date, current_date),
    'delivery_fee_debit',
    greatest(
      public.dn_safe_numeric(o.row_data->>'delivery_price', 0),
      public.dn_safe_numeric(o.row_data->>'price', 0),
      public.dn_safe_numeric(o.row_data->>'base_price', 0),
      public.dn_safe_numeric(o.row_data->>'service_fee', 0)
    ),
    0,
    -greatest(
      public.dn_safe_numeric(o.row_data->>'delivery_price', 0),
      public.dn_safe_numeric(o.row_data->>'price', 0),
      public.dn_safe_numeric(o.row_data->>'base_price', 0),
      public.dn_safe_numeric(o.row_data->>'service_fee', 0)
    ),
    'posted',
    'Real delivery fee debit from orders table',
    auth.uid(),
    v_now,
    v_now
  from (
    select to_jsonb(orders.*) as row_data
    from public.orders
  ) o
  where greatest(
      public.dn_safe_numeric(o.row_data->>'delivery_price', 0),
      public.dn_safe_numeric(o.row_data->>'price', 0),
      public.dn_safe_numeric(o.row_data->>'base_price', 0),
      public.dn_safe_numeric(o.row_data->>'service_fee', 0)
    ) > 0
    and public.dn_safe_uuid(o.row_data->>'id') is not null
    and not exists (
      select 1
      from public.merchant_statement_entries m
      where m.order_id = public.dn_safe_uuid(o.row_data->>'id')
        and m.entry_type = 'delivery_fee_debit'
    );
  get diagnostics v_merchant_fee_inserted = row_count;

  -- Driver delivery earning entries from real assigned orders.
  insert into public.driver_statement_entries (
    driver_id,
    order_id,
    tracking_number,
    entry_date,
    entry_type,
    debit,
    credit,
    balance,
    status,
    notes,
    created_by,
    created_at,
    updated_at
  )
  select
    coalesce(public.dn_safe_uuid(o.row_data->>'driver_id'), public.dn_safe_uuid(o.row_data->>'assigned_driver_id')),
    public.dn_safe_uuid(o.row_data->>'id'),
    nullif(coalesce(o.row_data->>'tracking_number', o.row_data->>'invoice_number', o.row_data->>'coupon_number'), ''),
    coalesce(nullif(o.row_data->>'created_at', '')::date, current_date),
    'delivery_earning_credit',
    0,
    greatest(
      public.dn_safe_numeric(o.row_data->>'driver_earning', 0),
      public.dn_safe_numeric(o.row_data->>'delivery_price', 0),
      public.dn_safe_numeric(o.row_data->>'price', 0),
      public.dn_safe_numeric(o.row_data->>'service_fee', 0)
    ),
    greatest(
      public.dn_safe_numeric(o.row_data->>'driver_earning', 0),
      public.dn_safe_numeric(o.row_data->>'delivery_price', 0),
      public.dn_safe_numeric(o.row_data->>'price', 0),
      public.dn_safe_numeric(o.row_data->>'service_fee', 0)
    ),
    'posted',
    'Real driver earning from orders table',
    auth.uid(),
    v_now,
    v_now
  from (
    select to_jsonb(orders.*) as row_data
    from public.orders
  ) o
  where coalesce(public.dn_safe_uuid(o.row_data->>'driver_id'), public.dn_safe_uuid(o.row_data->>'assigned_driver_id')) is not null
    and public.dn_safe_uuid(o.row_data->>'id') is not null
    and greatest(
      public.dn_safe_numeric(o.row_data->>'driver_earning', 0),
      public.dn_safe_numeric(o.row_data->>'delivery_price', 0),
      public.dn_safe_numeric(o.row_data->>'price', 0),
      public.dn_safe_numeric(o.row_data->>'service_fee', 0)
    ) > 0
    and not exists (
      select 1
      from public.driver_statement_entries d
      where d.order_id = public.dn_safe_uuid(o.row_data->>'id')
        and d.entry_type = 'delivery_earning_credit'
    );
  get diagnostics v_driver_fee_inserted = row_count;

  insert into public.admin_audit_events(entity_type, action, after_data, actor_id, created_at)
  values (
    'admin_operation_rows',
    'sync_from_orders',
    jsonb_build_object(
      'cod_inserted', v_cod_inserted,
      'merchant_cod_inserted', v_merchant_cod_inserted,
      'merchant_fee_inserted', v_merchant_fee_inserted,
      'driver_fee_inserted', v_driver_fee_inserted
    ),
    auth.uid(),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'cod_inserted', v_cod_inserted,
    'merchant_cod_inserted', v_merchant_cod_inserted,
    'merchant_fee_inserted', v_merchant_fee_inserted,
    'driver_fee_inserted', v_driver_fee_inserted,
    'synced_at', v_now
  );
end;
$$;

grant execute on function public.admin_sync_order_operation_rows() to authenticated;
