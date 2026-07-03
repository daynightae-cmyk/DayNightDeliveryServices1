-- DAY NIGHT DELIVERY SERVICES
-- Merchants / contracted traders + admin coupon order creation.
-- Apply in Supabase SQL Editor. Safe to re-run.
-- This file now includes admin RPC fallbacks for RLS-safe merchant/order creation.

begin;

create extension if not exists pgcrypto;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  merchant_code text unique not null,
  trade_name text not null,
  owner_name text,
  phone text not null,
  alt_phone text,
  email text,
  emirate text,
  city text,
  address text,
  pickup_address text,
  license_number text,
  trn text,
  tax_number text,
  logo_url text,
  bank_name text,
  iban text,
  settlement_cycle text default 'weekly',
  commission_type text default 'fixed_delivery_fee',
  default_payment_method text default 'sender_pays',
  notes text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders
  add column if not exists invoice_number text,
  add column if not exists coupon_number text,
  add column if not exists merchant_id uuid,
  add column if not exists merchant_name text,
  add column if not exists merchant_code text,
  add column if not exists order_count integer default 1,
  add column if not exists shipping_scope text default 'local',
  add column if not exists destination_country text,
  add column if not exists source_channel text default 'website',
  add column if not exists package_description text,
  add column if not exists source_domain text default 'daynightae.com',
  add column if not exists subtotal numeric,
  add column if not exists base_price numeric,
  add column if not exists total numeric,
  add column if not exists total_price numeric,
  add column if not exists amount numeric,
  add column if not exists price numeric,
  add column if not exists currency text default 'AED',
  add column if not exists status_history jsonb default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_order_count_positive') then
    alter table public.orders
      add constraint orders_order_count_positive
      check (order_count is null or order_count >= 1)
      not valid;
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_merchant_id_fkey') then
    alter table public.orders
      add constraint orders_merchant_id_fkey
      foreign key (merchant_id)
      references public.merchants(id)
      on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists merchants_trade_name_idx on public.merchants using gin (to_tsvector('simple', coalesce(trade_name, '') || ' ' || coalesce(owner_name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(merchant_code, '')));
create index if not exists merchants_phone_idx on public.merchants (phone);
create index if not exists merchants_status_idx on public.merchants (status);
create index if not exists orders_invoice_number_idx on public.orders (invoice_number);
create index if not exists orders_coupon_number_idx on public.orders (coupon_number);
create index if not exists orders_merchant_id_idx on public.orders (merchant_id);
create index if not exists orders_merchant_name_idx on public.orders (merchant_name);
create index if not exists orders_source_channel_idx on public.orders (source_channel);
create index if not exists orders_sender_phone_digits_idx on public.orders ((regexp_replace(coalesce(sender_phone, ''), '\D', '', 'g')));
create index if not exists orders_receiver_phone_digits_idx on public.orders ((regexp_replace(coalesce(receiver_phone, ''), '\D', '', 'g')));

create or replace function public.daynight_admin_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.role::text) in ('admin', 'support')
  )
  or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) in ('admin', 'support');
$$;

alter table public.merchants enable row level security;

-- Merchants policies for admin/support users.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchants' and policyname='merchants_admin_select') then
    create policy merchants_admin_select on public.merchants
      for select to authenticated
      using (public.daynight_admin_allowed());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchants' and policyname='merchants_admin_insert') then
    create policy merchants_admin_insert on public.merchants
      for insert to authenticated
      with check (public.daynight_admin_allowed());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchants' and policyname='merchants_admin_update') then
    create policy merchants_admin_update on public.merchants
      for update to authenticated
      using (public.daynight_admin_allowed())
      with check (public.daynight_admin_allowed());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchants' and policyname='merchants_admin_delete') then
    create policy merchants_admin_delete on public.merchants
      for delete to authenticated
      using (public.daynight_admin_allowed());
  end if;
end $$;

-- Orders admin policies, added safely without disturbing existing customer/driver policies.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_admin_select_all') then
    create policy orders_admin_select_all on public.orders
      for select to authenticated
      using (public.daynight_admin_allowed());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_admin_insert_all') then
    create policy orders_admin_insert_all on public.orders
      for insert to authenticated
      with check (public.daynight_admin_allowed());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_admin_update_all') then
    create policy orders_admin_update_all on public.orders
      for update to authenticated
      using (public.daynight_admin_allowed())
      with check (public.daynight_admin_allowed());
  end if;
end $$;

create or replace function public.daynight_generate_merchant_code(p_trade_name text default 'SHOP')
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_code text;
  v_exists boolean;
begin
  v_prefix := upper(left(regexp_replace(coalesce(p_trade_name, 'SHOP'), '[^A-Za-z0-9]', '', 'g'), 4));
  if v_prefix = '' then v_prefix := 'SHOP'; end if;

  loop
    v_code := 'DN-MER-' || v_prefix || '-' || upper(right(md5(random()::text || clock_timestamp()::text), 5));
    select exists(select 1 from public.merchants where merchant_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  return v_code;
end;
$$;

create or replace function public.daynight_merchants_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.merchant_code is null or btrim(new.merchant_code) = '' then
    new.merchant_code := public.daynight_generate_merchant_code(new.trade_name);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_daynight_merchants_updated_at on public.merchants;
create trigger trg_daynight_merchants_updated_at
before insert or update on public.merchants
for each row execute function public.daynight_merchants_touch_updated_at();

create or replace function public.daynight_jsonb_text(p_payload jsonb, p_key text, p_default text default '')
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(btrim(coalesce(p_payload ->> p_key, '')), ''), p_default);
$$;

create or replace function public.daynight_jsonb_numeric(p_payload jsonb, p_key text, p_default numeric default 0)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_payload ->> p_key, '')), '');
begin
  if v_raw is null then return p_default; end if;
  return v_raw::numeric;
exception when others then
  return p_default;
end;
$$;

create or replace function public.daynight_jsonb_int(p_payload jsonb, p_key text, p_default integer default 1)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_payload ->> p_key, '')), '');
begin
  if v_raw is null then return p_default; end if;
  return greatest(1, ceil(v_raw::numeric)::integer);
exception when others then
  return greatest(1, p_default);
end;
$$;

create or replace function public.daynight_jsonb_uuid(p_payload jsonb, p_key text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_payload ->> p_key, '')), '');
begin
  if v_raw is null then return null; end if;
  return v_raw::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.admin_create_merchant(p_merchant jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := coalesce(p_merchant, '{}'::jsonb);
  v_row public.merchants%rowtype;
begin
  if not public.daynight_admin_allowed() then
    raise exception 'not_authorized';
  end if;

  insert into public.merchants (
    merchant_code, trade_name, owner_name, phone, alt_phone, email, emirate, city,
    address, pickup_address, license_number, trn, tax_number, logo_url, bank_name,
    iban, settlement_cycle, commission_type, default_payment_method, notes, status
  ) values (
    nullif(public.daynight_jsonb_text(v_payload, 'merchant_code', ''), ''),
    public.daynight_jsonb_text(v_payload, 'trade_name', 'DAY NIGHT Merchant'),
    public.daynight_jsonb_text(v_payload, 'owner_name', ''),
    public.daynight_jsonb_text(v_payload, 'phone', ''),
    public.daynight_jsonb_text(v_payload, 'alt_phone', ''),
    lower(public.daynight_jsonb_text(v_payload, 'email', '')),
    public.daynight_jsonb_text(v_payload, 'emirate', 'Abu Dhabi'),
    public.daynight_jsonb_text(v_payload, 'city', 'Abu Dhabi'),
    public.daynight_jsonb_text(v_payload, 'address', ''),
    public.daynight_jsonb_text(v_payload, 'pickup_address', public.daynight_jsonb_text(v_payload, 'address', '')),
    public.daynight_jsonb_text(v_payload, 'license_number', ''),
    public.daynight_jsonb_text(v_payload, 'trn', public.daynight_jsonb_text(v_payload, 'tax_number', '')),
    public.daynight_jsonb_text(v_payload, 'tax_number', public.daynight_jsonb_text(v_payload, 'trn', '')),
    public.daynight_jsonb_text(v_payload, 'logo_url', ''),
    public.daynight_jsonb_text(v_payload, 'bank_name', ''),
    public.daynight_jsonb_text(v_payload, 'iban', ''),
    public.daynight_jsonb_text(v_payload, 'settlement_cycle', 'weekly'),
    public.daynight_jsonb_text(v_payload, 'commission_type', 'fixed_delivery_fee'),
    public.daynight_jsonb_text(v_payload, 'default_payment_method', 'sender_pays'),
    public.daynight_jsonb_text(v_payload, 'notes', ''),
    public.daynight_jsonb_text(v_payload, 'status', 'active')
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_create_coupon_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb := coalesce(p_order, '{}'::jsonb);
  v_row public.orders%rowtype;
  v_created_at timestamptz := now();
  v_payment_method text := public.daynight_jsonb_text(v_payload, 'payment_method', 'sender_pays');
  v_status text := public.daynight_jsonb_text(v_payload, 'status', 'pending');
  v_price numeric := public.daynight_jsonb_numeric(v_payload, 'delivery_price', public.daynight_jsonb_numeric(v_payload, 'total_price', 0));
  v_status_history jsonb := '[]'::jsonb;
begin
  if not public.daynight_admin_allowed() then
    raise exception 'not_authorized';
  end if;

  begin
    v_created_at := coalesce(nullif(v_payload ->> 'created_at', '')::timestamptz, now());
  exception when others then
    v_created_at := now();
  end;

  if jsonb_typeof(v_payload -> 'status_history') = 'array' then
    v_status_history := v_payload -> 'status_history';
  else
    v_status_history := jsonb_build_array(jsonb_build_object('status', v_status, 'date', v_created_at, 'note', 'Created from DAY NIGHT admin merchant operations hub'));
  end if;

  insert into public.orders (
    invoice_number, coupon_number, merchant_id, merchant_name, merchant_code, order_count,
    shipping_scope, destination_country, source_channel, sender_name, sender_phone,
    sender_city, sender_address, receiver_name, receiver_phone, receiver_city,
    receiver_address, package_type, package_description, weight, pieces, service_type,
    payment_method, cod_amount, delivery_price, subtotal, base_price, total,
    total_price, amount, price, currency, notes, status, created_at, updated_at,
    status_history
  ) values (
    public.daynight_jsonb_text(v_payload, 'invoice_number', ''),
    public.daynight_jsonb_text(v_payload, 'coupon_number', ''),
    public.daynight_jsonb_uuid(v_payload, 'merchant_id'),
    public.daynight_jsonb_text(v_payload, 'merchant_name', public.daynight_jsonb_text(v_payload, 'sender_name', 'DAY NIGHT Merchant')),
    public.daynight_jsonb_text(v_payload, 'merchant_code', ''),
    public.daynight_jsonb_int(v_payload, 'order_count', 1),
    public.daynight_jsonb_text(v_payload, 'shipping_scope', 'local'),
    nullif(public.daynight_jsonb_text(v_payload, 'destination_country', ''), ''),
    public.daynight_jsonb_text(v_payload, 'source_channel', 'admin_panel'),
    public.daynight_jsonb_text(v_payload, 'sender_name', public.daynight_jsonb_text(v_payload, 'merchant_name', 'DAY NIGHT Merchant')),
    public.daynight_jsonb_text(v_payload, 'sender_phone', '+971 56 875 7331'),
    public.daynight_jsonb_text(v_payload, 'sender_city', 'Abu Dhabi'),
    public.daynight_jsonb_text(v_payload, 'sender_address', 'UAE'),
    public.daynight_jsonb_text(v_payload, 'receiver_name', ''),
    public.daynight_jsonb_text(v_payload, 'receiver_phone', ''),
    public.daynight_jsonb_text(v_payload, 'receiver_city', public.daynight_jsonb_text(v_payload, 'destination_country', '')),
    public.daynight_jsonb_text(v_payload, 'receiver_address', ''),
    public.daynight_jsonb_text(v_payload, 'package_type', public.daynight_jsonb_text(v_payload, 'package_description', 'Admin shipment')),
    public.daynight_jsonb_text(v_payload, 'package_description', public.daynight_jsonb_text(v_payload, 'package_type', 'Admin shipment')),
    public.daynight_jsonb_numeric(v_payload, 'weight', 1),
    public.daynight_jsonb_int(v_payload, 'pieces', public.daynight_jsonb_int(v_payload, 'order_count', 1)),
    public.daynight_jsonb_text(v_payload, 'service_type', 'standard'),
    v_payment_method,
    case when v_payment_method = 'cod' then public.daynight_jsonb_numeric(v_payload, 'cod_amount', 0) else null end,
    v_price,
    public.daynight_jsonb_numeric(v_payload, 'subtotal', v_price),
    public.daynight_jsonb_numeric(v_payload, 'base_price', v_price),
    public.daynight_jsonb_numeric(v_payload, 'total', v_price),
    public.daynight_jsonb_numeric(v_payload, 'total_price', v_price),
    public.daynight_jsonb_numeric(v_payload, 'amount', v_price),
    public.daynight_jsonb_numeric(v_payload, 'price', v_price),
    public.daynight_jsonb_text(v_payload, 'currency', 'AED'),
    public.daynight_jsonb_text(v_payload, 'notes', 'N/A'),
    v_status,
    v_created_at,
    now(),
    v_status_history
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.track_order(p_tracking_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := btrim(coalesce(p_tracking_code, ''));
  v_order jsonb;
begin
  if v_ref = '' then
    return null;
  end if;

  select to_jsonb(o)
  into v_order
  from public.orders o
  where lower(coalesce(o.tracking_code, '')) = lower(v_ref)
     or lower(coalesce(o.tracking_number, '')) = lower(v_ref)
     or lower(coalesce(o.invoice_number, '')) = lower(v_ref)
     or lower(coalesce(o.coupon_number, '')) = lower(v_ref)
     or o.id::text = v_ref
  order by coalesce(o.updated_at, o.created_at) desc nulls last
  limit 1;

  return v_order;
end;
$$;

create or replace function public.track_orders_by_phone(p_phone text, p_limit integer default 10)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
begin
  if length(v_phone) < 7 then
    return;
  end if;

  return query
  select to_jsonb(o)
  from public.orders o
  where regexp_replace(coalesce(o.sender_phone, ''), '\D', '', 'g') like '%' || v_phone || '%'
     or regexp_replace(coalesce(o.receiver_phone, ''), '\D', '', 'g') like '%' || v_phone || '%'
     or regexp_replace(coalesce(to_jsonb(o)->>'customer_phone', ''), '\D', '', 'g') like '%' || v_phone || '%'
  order by coalesce(o.updated_at, o.created_at) desc nulls last
  limit v_limit;
end;
$$;

create or replace function public.daynight_admin_hub_health()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'merchants_table', to_regclass('public.merchants') is not null,
    'admin_allowed_for_current_user', public.daynight_admin_allowed(),
    'admin_create_merchant_rpc', to_regprocedure('public.admin_create_merchant(jsonb)') is not null,
    'admin_create_coupon_order_rpc', to_regprocedure('public.admin_create_coupon_order(jsonb)') is not null,
    'track_order_rpc', to_regprocedure('public.track_order(text)') is not null,
    'track_orders_by_phone_rpc', to_regprocedure('public.track_orders_by_phone(text,integer)') is not null,
    'orders_required_columns', (
      select jsonb_agg(column_name order by column_name)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name in ('invoice_number','coupon_number','merchant_id','merchant_name','merchant_code','order_count','shipping_scope','destination_country','source_channel')
    )
  );
$$;

revoke all on function public.admin_create_merchant(jsonb) from public;
revoke all on function public.admin_create_coupon_order(jsonb) from public;
revoke all on function public.daynight_admin_hub_health() from public;
revoke all on function public.track_order(text) from public;
revoke all on function public.track_orders_by_phone(text, integer) from public;

grant execute on function public.admin_create_merchant(jsonb) to authenticated;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;
grant execute on function public.daynight_admin_hub_health() to authenticated;
grant execute on function public.track_order(text) to anon, authenticated;
grant execute on function public.track_orders_by_phone(text, integer) to anon, authenticated;

commit;
