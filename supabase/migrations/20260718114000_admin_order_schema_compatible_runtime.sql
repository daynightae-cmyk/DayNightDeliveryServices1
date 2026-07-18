-- DAY NIGHT DELIVERY SERVICES
-- Runtime hotfix for authenticated admin order creation.
--
-- Why this exists:
-- The production orders table has evolved across multiple migrations. A static INSERT
-- that names every historical/new column can compile as a PL/pgSQL function but fail
-- only when the function is invoked. This migration replaces that static INSERT with
-- a schema-aware insert that writes only columns that actually exist and are insertable.
-- Merchant linkage remains authoritative and atomic.

begin;

create extension if not exists pgcrypto;

-- Keep the merchant linkage columns available on every supported schema.
alter table public.orders add column if not exists merchant_id uuid;
alter table public.orders add column if not exists merchant_name text;
alter table public.orders add column if not exists merchant_code text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists coupon_number text;
alter table public.orders add column if not exists status_history jsonb default '[]'::jsonb;
alter table public.orders add column if not exists created_by uuid references auth.users(id);
alter table public.orders add column if not exists updated_at timestamptz default now();

create index if not exists idx_orders_merchant_id on public.orders(merchant_id);
create index if not exists idx_orders_merchant_code on public.orders(merchant_code);

create or replace function public.admin_create_coupon_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_merchant public.merchants%rowtype;
  v_merchant_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_created_at timestamptz := coalesce(
    public.admin_safe_timestamptz(p_order ->> 'created_at'),
    now()
  );
  v_tracking text := coalesce(
    nullif(btrim(p_order ->> 'tracking_number'), ''),
    nullif(btrim(p_order ->> 'tracking_code'), ''),
    nullif(btrim(p_order ->> 'invoice_number'), ''),
    'DN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
  v_payload jsonb;
  v_columns text;
  v_values text;
  v_saved_merchant_id text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  if v_merchant_id is null then
    raise exception 'merchant_required';
  end if;

  select *
  into v_merchant
  from public.merchants
  where id = v_merchant_id
    and lower(coalesce(status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  limit 1;

  if v_merchant.id is null then
    raise exception 'merchant_not_found_or_inactive';
  end if;

  -- Merge the submitted form with authoritative merchant identity. Aliases are
  -- included for legacy and current order schemas; unknown JSON keys are ignored by
  -- the schema-aware insert below.
  v_payload := jsonb_strip_nulls(
    coalesce(p_order, '{}'::jsonb)
    || jsonb_build_object(
      'tracking_number', v_tracking,
      'tracking_code', v_tracking,
      'invoice_number', coalesce(nullif(btrim(p_order ->> 'invoice_number'), ''), v_tracking),
      'merchant_id', v_merchant.id::text,
      'merchant_name', v_merchant.trade_name,
      'merchant_code', v_merchant.merchant_code,
      'sender_name', v_merchant.trade_name,
      'sender_phone', coalesce(nullif(v_merchant.phone, ''), nullif(p_order ->> 'sender_phone', ''), '971568757331'),
      'sender_city', coalesce(nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
      'pickup_city', coalesce(nullif(p_order ->> 'pickup_city', ''), nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
      'sender_address', coalesce(nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
      'pickup_address', coalesce(nullif(p_order ->> 'pickup_address', ''), nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
      'receiver_name', nullif(p_order ->> 'receiver_name', ''),
      'recipient_name', coalesce(nullif(p_order ->> 'recipient_name', ''), nullif(p_order ->> 'receiver_name', '')),
      'receiver_phone', nullif(p_order ->> 'receiver_phone', ''),
      'recipient_phone', coalesce(nullif(p_order ->> 'recipient_phone', ''), nullif(p_order ->> 'receiver_phone', '')),
      'receiver_city', coalesce(nullif(p_order ->> 'receiver_city', ''), nullif(p_order ->> 'delivery_city', ''), 'Dubai'),
      'delivery_city', coalesce(nullif(p_order ->> 'delivery_city', ''), nullif(p_order ->> 'receiver_city', ''), 'Dubai'),
      'receiver_address', coalesce(nullif(p_order ->> 'receiver_address', ''), nullif(p_order ->> 'delivery_address', '')),
      'delivery_address', coalesce(nullif(p_order ->> 'delivery_address', ''), nullif(p_order ->> 'receiver_address', '')),
      'package_description', coalesce(nullif(p_order ->> 'package_description', ''), nullif(p_order ->> 'package_type', ''), 'Shipment'),
      'package_type', coalesce(nullif(p_order ->> 'package_type', ''), nullif(p_order ->> 'package_description', ''), 'Shipment'),
      'package_weight_kg', coalesce(p_order -> 'package_weight_kg', p_order -> 'weight', '1'::jsonb),
      'weight', coalesce(p_order -> 'weight', p_order -> 'package_weight_kg', '1'::jsonb),
      'pieces', coalesce(p_order -> 'pieces', p_order -> 'order_count', '1'::jsonb),
      'order_count', coalesce(p_order -> 'order_count', p_order -> 'pieces', '1'::jsonb),
      'shipment_type', coalesce(nullif(p_order ->> 'shipment_type', ''), nullif(p_order ->> 'shipping_scope', ''), 'local'),
      'shipping_scope', coalesce(nullif(p_order ->> 'shipping_scope', ''), nullif(p_order ->> 'shipment_type', ''), 'local'),
      'service_type', coalesce(nullif(p_order ->> 'service_type', ''), case when coalesce(p_order ->> 'shipping_scope', 'local') = 'international' then 'international' else 'standard' end),
      'payment_method', coalesce(nullif(p_order ->> 'payment_method', ''), nullif(v_merchant.default_payment_method, ''), 'merchant_pays'),
      'status', 'pending',
      'status_history', jsonb_build_array(jsonb_build_object(
        'status', 'pending',
        'date', v_created_at,
        'created_at', v_created_at,
        'note', 'Created from authenticated admin for merchant ' || v_merchant.trade_name
      )),
      'created_by', auth.uid()::text,
      'created_at', v_created_at,
      'updated_at', now()
    )
  );

  -- Build an INSERT from the live table definition. This prevents runtime failures
  -- caused by columns that exist in one migration generation but not another.
  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
    string_agg(
      format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name),
      ', ' order by c.ordinal_position
    )
  into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_columns, '') is null or nullif(v_values, '') is null then
    raise exception 'orders_schema_has_no_insertable_payload_columns';
  end if;

  execute format(
    'insert into public.orders (%s) select %s returning *',
    v_columns,
    v_values
  )
  using v_payload
  into r;

  v_saved_merchant_id := to_jsonb(r) ->> 'merchant_id';
  if v_saved_merchant_id is distinct from v_merchant.id::text then
    raise exception 'merchant_link_verification_failed';
  end if;

  return r;
exception
  when others then
    raise exception using
      message = 'admin_create_coupon_order_failed: ' || sqlerrm,
      detail = 'SQLSTATE=' || sqlstate,
      hint = 'Confirm the authenticated profile role is admin/support and the selected merchant is active.';
end;
$$;

-- Safe parser used by the runtime function. It is created separately so malformed
-- timestamps never abort function initialization.
create or replace function public.admin_safe_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::timestamptz;
exception when others then
  return null;
end;
$$;

-- Recreate the order function after the helper exists in case the PostgreSQL validator
-- resolves function references eagerly on this project version.
create or replace function public.admin_create_coupon_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  r public.orders;
  v_merchant public.merchants%rowtype;
  v_merchant_id uuid := public.admin_safe_uuid(p_order ->> 'merchant_id');
  v_created_at timestamptz := coalesce(public.admin_safe_timestamptz(p_order ->> 'created_at'), now());
  v_tracking text := coalesce(
    nullif(btrim(p_order ->> 'tracking_number'), ''),
    nullif(btrim(p_order ->> 'tracking_code'), ''),
    nullif(btrim(p_order ->> 'invoice_number'), ''),
    'DN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
  v_payload jsonb;
  v_columns text;
  v_values text;
  v_saved_merchant_id text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin_or_support() then raise exception 'not_authorized'; end if;
  if v_merchant_id is null then raise exception 'merchant_required'; end if;

  select * into v_merchant
  from public.merchants
  where id = v_merchant_id
    and lower(coalesce(status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
  limit 1;

  if v_merchant.id is null then raise exception 'merchant_not_found_or_inactive'; end if;

  v_payload := jsonb_strip_nulls(
    coalesce(p_order, '{}'::jsonb)
    || jsonb_build_object(
      'tracking_number', v_tracking,
      'tracking_code', v_tracking,
      'invoice_number', coalesce(nullif(btrim(p_order ->> 'invoice_number'), ''), v_tracking),
      'merchant_id', v_merchant.id::text,
      'merchant_name', v_merchant.trade_name,
      'merchant_code', v_merchant.merchant_code,
      'sender_name', v_merchant.trade_name,
      'sender_phone', coalesce(nullif(v_merchant.phone, ''), nullif(p_order ->> 'sender_phone', ''), '971568757331'),
      'sender_city', coalesce(nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
      'pickup_city', coalesce(nullif(p_order ->> 'pickup_city', ''), nullif(p_order ->> 'sender_city', ''), nullif(v_merchant.emirate, ''), 'Abu Dhabi'),
      'sender_address', coalesce(nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
      'pickup_address', coalesce(nullif(p_order ->> 'pickup_address', ''), nullif(p_order ->> 'sender_address', ''), nullif(v_merchant.pickup_address, ''), nullif(v_merchant.address, ''), 'Abu Dhabi'),
      'receiver_name', nullif(p_order ->> 'receiver_name', ''),
      'recipient_name', coalesce(nullif(p_order ->> 'recipient_name', ''), nullif(p_order ->> 'receiver_name', '')),
      'receiver_phone', nullif(p_order ->> 'receiver_phone', ''),
      'recipient_phone', coalesce(nullif(p_order ->> 'recipient_phone', ''), nullif(p_order ->> 'receiver_phone', '')),
      'receiver_city', coalesce(nullif(p_order ->> 'receiver_city', ''), nullif(p_order ->> 'delivery_city', ''), 'Dubai'),
      'delivery_city', coalesce(nullif(p_order ->> 'delivery_city', ''), nullif(p_order ->> 'receiver_city', ''), 'Dubai'),
      'receiver_address', coalesce(nullif(p_order ->> 'receiver_address', ''), nullif(p_order ->> 'delivery_address', '')),
      'delivery_address', coalesce(nullif(p_order ->> 'delivery_address', ''), nullif(p_order ->> 'receiver_address', '')),
      'package_description', coalesce(nullif(p_order ->> 'package_description', ''), nullif(p_order ->> 'package_type', ''), 'Shipment'),
      'package_type', coalesce(nullif(p_order ->> 'package_type', ''), nullif(p_order ->> 'package_description', ''), 'Shipment'),
      'package_weight_kg', coalesce(p_order -> 'package_weight_kg', p_order -> 'weight', '1'::jsonb),
      'weight', coalesce(p_order -> 'weight', p_order -> 'package_weight_kg', '1'::jsonb),
      'pieces', coalesce(p_order -> 'pieces', p_order -> 'order_count', '1'::jsonb),
      'order_count', coalesce(p_order -> 'order_count', p_order -> 'pieces', '1'::jsonb),
      'shipment_type', coalesce(nullif(p_order ->> 'shipment_type', ''), nullif(p_order ->> 'shipping_scope', ''), 'local'),
      'shipping_scope', coalesce(nullif(p_order ->> 'shipping_scope', ''), nullif(p_order ->> 'shipment_type', ''), 'local'),
      'service_type', coalesce(nullif(p_order ->> 'service_type', ''), case when coalesce(p_order ->> 'shipping_scope', 'local') = 'international' then 'international' else 'standard' end),
      'payment_method', coalesce(nullif(p_order ->> 'payment_method', ''), nullif(v_merchant.default_payment_method, ''), 'merchant_pays'),
      'status', 'pending',
      'status_history', jsonb_build_array(jsonb_build_object(
        'status', 'pending',
        'date', v_created_at,
        'created_at', v_created_at,
        'note', 'Created from authenticated admin for merchant ' || v_merchant.trade_name
      )),
      'created_by', auth.uid()::text,
      'created_at', v_created_at,
      'updated_at', now()
    )
  );

  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
    string_agg(format('(jsonb_populate_record(null::public.orders, $1)).%I', c.column_name), ', ' order by c.ordinal_position)
  into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and v_payload ? c.column_name
    and coalesce(c.is_generated, 'NEVER') = 'NEVER'
    and coalesce(c.identity_generation, '') <> 'ALWAYS';

  if nullif(v_columns, '') is null then raise exception 'orders_schema_has_no_insertable_payload_columns'; end if;

  execute format('insert into public.orders (%s) select %s returning *', v_columns, v_values)
    using v_payload into r;

  v_saved_merchant_id := to_jsonb(r) ->> 'merchant_id';
  if v_saved_merchant_id is distinct from v_merchant.id::text then
    raise exception 'merchant_link_verification_failed';
  end if;

  return r;
exception when others then
  raise exception using
    message = 'admin_create_coupon_order_failed: ' || sqlerrm,
    detail = 'SQLSTATE=' || sqlstate,
    hint = 'Confirm the authenticated profile role is admin/support and the selected merchant is active.';
end;
$$;

revoke all on function public.admin_safe_timestamptz(text) from public, anon;
revoke all on function public.admin_create_coupon_order(jsonb) from public, anon;
grant execute on function public.admin_safe_timestamptz(text) to authenticated;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;

create or replace function public.admin_order_creation_runtime_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'merchant_id'
      ),
    'authenticated_user_id', auth.uid(),
    'profile_role', public.current_profile_role(),
    'is_admin_or_support', public.is_admin_or_support(),
    'active_merchant_count', (
      select count(*) from public.merchants
      where lower(coalesce(status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    ),
    'orders_columns', (
      select jsonb_agg(column_name order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'orders'
    ),
    'rpc', to_regprocedure('public.admin_create_coupon_order(jsonb)')::text
  );
$$;

revoke all on function public.admin_order_creation_runtime_health() from public, anon;
grant execute on function public.admin_order_creation_runtime_health() to authenticated;

notify pgrst, 'reload schema';

commit;
