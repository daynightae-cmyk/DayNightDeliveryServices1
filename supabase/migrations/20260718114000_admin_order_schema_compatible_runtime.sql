-- DAY NIGHT DELIVERY SERVICES
-- Production runtime hotfix: authenticated admin -> selected merchant -> real order.
--
-- The orders table has evolved through several schema generations. The previous RPC
-- used one static INSERT statement naming every possible column. PL/pgSQL can create
-- such a function successfully and still fail only when the function is executed if
-- a named column or enum value differs in production.
--
-- This migration uses the live orders-table definition and inserts only columns that
-- actually exist. It also normalizes the admin UI value `merchant_pays` to the database
-- value `sender_pays`, while preserving the authoritative merchant link atomically.

begin;

create extension if not exists pgcrypto;

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

create or replace function public.admin_safe_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
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
  v_payment_method text := lower(coalesce(
    nullif(btrim(p_order ->> 'payment_method'), ''),
    'sender_pays'
  ));
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

  if v_payment_method = 'merchant_pays' then
    v_payment_method := 'sender_pays';
  end if;

  if v_payment_method not in ('sender_pays', 'receiver_pays', 'cod') then
    v_payment_method := 'sender_pays';
  end if;

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
      'sender_phone', coalesce(
        nullif(v_merchant.phone, ''),
        nullif(p_order ->> 'sender_phone', ''),
        '971568757331'
      ),
      'sender_city', coalesce(
        nullif(p_order ->> 'sender_city', ''),
        nullif(v_merchant.emirate, ''),
        'Abu Dhabi'
      ),
      'sender_address', coalesce(
        nullif(p_order ->> 'sender_address', ''),
        nullif(v_merchant.pickup_address, ''),
        nullif(v_merchant.address, ''),
        'Abu Dhabi'
      ),
      'receiver_name', nullif(p_order ->> 'receiver_name', ''),
      'receiver_phone', nullif(p_order ->> 'receiver_phone', ''),
      'receiver_city', coalesce(nullif(p_order ->> 'receiver_city', ''), 'Dubai'),
      'receiver_address', nullif(p_order ->> 'receiver_address', ''),
      'package_type', coalesce(
        nullif(p_order ->> 'package_type', ''),
        nullif(p_order ->> 'package_description', ''),
        'Shipment'
      ),
      'package_description', coalesce(
        nullif(p_order ->> 'package_description', ''),
        nullif(p_order ->> 'package_type', ''),
        'Shipment'
      ),
      'weight', coalesce(p_order -> 'weight', '1'::jsonb),
      'pieces', coalesce(p_order -> 'pieces', p_order -> 'order_count', '1'::jsonb),
      'order_count', coalesce(p_order -> 'order_count', p_order -> 'pieces', '1'::jsonb),
      'shipping_scope', coalesce(nullif(p_order ->> 'shipping_scope', ''), 'local'),
      'destination_country', nullif(p_order ->> 'destination_country', ''),
      'service_type', coalesce(nullif(p_order ->> 'service_type', ''), 'standard'),
      'payment_method', v_payment_method,
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
      hint = 'Confirm the signed-in profile role is admin/support and the selected merchant is active.';
end;
$$;

revoke all on function public.admin_safe_uuid(text) from public, anon;
revoke all on function public.admin_safe_timestamptz(text) from public, anon;
revoke all on function public.admin_create_coupon_order(jsonb) from public, anon;

grant execute on function public.admin_safe_uuid(text) to authenticated;
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
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'orders'
          and column_name = 'merchant_id'
      ),
    'authenticated_user_id', auth.uid(),
    'profile_role', public.current_profile_role(),
    'is_admin_or_support', public.is_admin_or_support(),
    'active_merchant_count', (
      select count(*)
      from public.merchants
      where lower(coalesce(status, 'active')) not in ('deleted', 'archived', 'blocked', 'suspended')
    ),
    'rpc', to_regprocedure('public.admin_create_coupon_order(jsonb)')::text,
    'orders_columns', (
      select jsonb_agg(column_name order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
    )
  );
$$;

revoke all on function public.admin_order_creation_runtime_health() from public, anon;
grant execute on function public.admin_order_creation_runtime_health() to authenticated;

notify pgrst, 'reload schema';

commit;
