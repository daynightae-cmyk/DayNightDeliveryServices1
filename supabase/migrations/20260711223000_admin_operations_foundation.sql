-- DAY NIGHT Admin Operations Foundation
-- Scope: Operations section only: New Order, New Merchant, Merchants.
-- Safe/idempotent: no destructive drops, no seed/fake data, no secrets.

create extension if not exists pgcrypto;

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
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select p.role::text from public.profiles p where p.id = auth.uid() limit 1;
$$;

create or replace function public.is_admin_or_support()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce(public.current_profile_role() in ('admin','support'), false);
$$;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  merchant_code text,
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
  settlement_cycle text not null default 'weekly',
  commission_type text not null default 'fixed_delivery_fee',
  default_payment_method text not null default 'sender_pays',
  notes text,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_number text,
  invoice_number text,
  coupon_number text,
  merchant_id uuid,
  merchant_name text,
  merchant_code text,
  order_count integer not null default 1,
  shipping_scope text not null default 'local',
  destination_country text,
  source_channel text,
  source_domain text,
  sender_name text not null default 'DAY NIGHT Merchant',
  sender_phone text not null default '971568757331',
  sender_city text not null default 'Abu Dhabi',
  sender_address text not null default 'Abu Dhabi',
  receiver_name text not null,
  receiver_phone text not null,
  receiver_city text not null,
  receiver_address text not null,
  package_type text not null default 'Shipment',
  package_description text,
  weight numeric(10,2) not null default 1,
  pieces integer not null default 1,
  service_type text not null default 'standard',
  payment_method text not null default 'sender_pays',
  cod_amount numeric(12,2) not null default 0,
  delivery_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  base_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  currency text not null default 'AED',
  notes text,
  status text not null default 'pending',
  status_history jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchants add column if not exists merchant_code text;
alter table public.merchants add column if not exists owner_name text;
alter table public.merchants add column if not exists alt_phone text;
alter table public.merchants add column if not exists email text;
alter table public.merchants add column if not exists emirate text;
alter table public.merchants add column if not exists city text;
alter table public.merchants add column if not exists address text;
alter table public.merchants add column if not exists pickup_address text;
alter table public.merchants add column if not exists license_number text;
alter table public.merchants add column if not exists trn text;
alter table public.merchants add column if not exists tax_number text;
alter table public.merchants add column if not exists logo_url text;
alter table public.merchants add column if not exists bank_name text;
alter table public.merchants add column if not exists iban text;
alter table public.merchants add column if not exists settlement_cycle text default 'weekly';
alter table public.merchants add column if not exists commission_type text default 'fixed_delivery_fee';
alter table public.merchants add column if not exists default_payment_method text default 'sender_pays';
alter table public.merchants add column if not exists notes text;
alter table public.merchants add column if not exists status text default 'active';
alter table public.merchants add column if not exists created_by uuid references auth.users(id);
alter table public.merchants add column if not exists created_at timestamptz default now();
alter table public.merchants add column if not exists updated_at timestamptz default now();

alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists coupon_number text;
alter table public.orders add column if not exists merchant_id uuid;
alter table public.orders add column if not exists merchant_name text;
alter table public.orders add column if not exists merchant_code text;
alter table public.orders add column if not exists order_count integer default 1;
alter table public.orders add column if not exists shipping_scope text default 'local';
alter table public.orders add column if not exists destination_country text;
alter table public.orders add column if not exists source_channel text;
alter table public.orders add column if not exists source_domain text;
alter table public.orders add column if not exists sender_name text;
alter table public.orders add column if not exists sender_phone text;
alter table public.orders add column if not exists sender_city text;
alter table public.orders add column if not exists sender_address text;
alter table public.orders add column if not exists receiver_name text;
alter table public.orders add column if not exists receiver_phone text;
alter table public.orders add column if not exists receiver_city text;
alter table public.orders add column if not exists receiver_address text;
alter table public.orders add column if not exists package_type text;
alter table public.orders add column if not exists package_description text;
alter table public.orders add column if not exists weight numeric(10,2) default 1;
alter table public.orders add column if not exists pieces integer default 1;
alter table public.orders add column if not exists service_type text default 'standard';
alter table public.orders add column if not exists payment_method text default 'sender_pays';
alter table public.orders add column if not exists cod_amount numeric(12,2) default 0;
alter table public.orders add column if not exists delivery_price numeric(12,2) default 0;
alter table public.orders add column if not exists subtotal numeric(12,2) default 0;
alter table public.orders add column if not exists base_price numeric(12,2) default 0;
alter table public.orders add column if not exists total numeric(12,2) default 0;
alter table public.orders add column if not exists total_price numeric(12,2) default 0;
alter table public.orders add column if not exists amount numeric(12,2) default 0;
alter table public.orders add column if not exists price numeric(12,2) default 0;
alter table public.orders add column if not exists currency text default 'AED';
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists status text default 'pending';
alter table public.orders add column if not exists status_history jsonb default '[]'::jsonb;
alter table public.orders add column if not exists created_by uuid references auth.users(id);
alter table public.orders add column if not exists created_at timestamptz default now();
alter table public.orders add column if not exists updated_at timestamptz default now();

create index if not exists merchants_merchant_code_idx on public.merchants(merchant_code);
create index if not exists merchants_phone_idx on public.merchants(phone);
create index if not exists merchants_status_idx on public.merchants(status);
create index if not exists merchants_city_idx on public.merchants(city);
create index if not exists merchants_created_at_idx on public.merchants(created_at);

create index if not exists orders_tracking_number_idx on public.orders(tracking_number);
create index if not exists orders_invoice_number_idx on public.orders(invoice_number);
create index if not exists orders_coupon_number_idx on public.orders(coupon_number);
create index if not exists orders_merchant_id_idx on public.orders(merchant_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at);
create index if not exists orders_receiver_phone_idx on public.orders(receiver_phone);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists merchants_set_updated_at on public.merchants;
create trigger merchants_set_updated_at before update on public.merchants for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

alter table public.merchants enable row level security;
alter table public.orders enable row level security;

drop policy if exists merchants_admin_support_select on public.merchants;
create policy merchants_admin_support_select on public.merchants for select to authenticated using (public.is_admin_or_support());
drop policy if exists merchants_admin_support_insert on public.merchants;
create policy merchants_admin_support_insert on public.merchants for insert to authenticated with check (public.is_admin_or_support());
drop policy if exists merchants_admin_support_update on public.merchants;
create policy merchants_admin_support_update on public.merchants for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support());

drop policy if exists orders_admin_support_select on public.orders;
create policy orders_admin_support_select on public.orders for select to authenticated using (public.is_admin_or_support());
drop policy if exists orders_admin_support_insert on public.orders;
create policy orders_admin_support_insert on public.orders for insert to authenticated with check (public.is_admin_or_support());
drop policy if exists orders_admin_support_update on public.orders;
create policy orders_admin_support_update on public.orders for update to authenticated using (public.is_admin_or_support()) with check (public.is_admin_or_support());

create or replace function public.admin_create_merchant(p_merchant jsonb)
returns public.merchants
language plpgsql
security definer
set search_path = public, auth
as $$
declare r public.merchants;
begin
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  insert into public.merchants(
    merchant_code, trade_name, owner_name, phone, alt_phone, email, emirate, city,
    address, pickup_address, license_number, trn, tax_number, logo_url, bank_name,
    iban, settlement_cycle, commission_type, default_payment_method, notes, status,
    created_by, created_at, updated_at
  ) values (
    coalesce(nullif(p_merchant->>'merchant_code',''), 'DN-MER-' || upper(substr(gen_random_uuid()::text, 1, 8))),
    nullif(p_merchant->>'trade_name',''),
    nullif(p_merchant->>'owner_name',''),
    nullif(p_merchant->>'phone',''),
    nullif(p_merchant->>'alt_phone',''),
    nullif(p_merchant->>'email',''),
    coalesce(nullif(p_merchant->>'emirate',''), 'Abu Dhabi'),
    coalesce(nullif(p_merchant->>'city',''), nullif(p_merchant->>'emirate',''), 'Abu Dhabi'),
    nullif(p_merchant->>'address',''),
    coalesce(nullif(p_merchant->>'pickup_address',''), nullif(p_merchant->>'address','')),
    nullif(p_merchant->>'license_number',''),
    nullif(p_merchant->>'trn',''),
    nullif(p_merchant->>'tax_number',''),
    nullif(p_merchant->>'logo_url',''),
    nullif(p_merchant->>'bank_name',''),
    nullif(p_merchant->>'iban',''),
    coalesce(nullif(p_merchant->>'settlement_cycle',''), 'weekly'),
    coalesce(nullif(p_merchant->>'commission_type',''), 'fixed_delivery_fee'),
    coalesce(nullif(p_merchant->>'default_payment_method',''), 'sender_pays'),
    nullif(p_merchant->>'notes',''),
    coalesce(nullif(p_merchant->>'status',''), 'active'),
    auth.uid(),
    coalesce((p_merchant->>'created_at')::timestamptz, now()),
    coalesce((p_merchant->>'updated_at')::timestamptz, now())
  ) returning * into r;

  return r;
end;
$$;

create or replace function public.admin_update_merchant(p_merchant_id uuid, p_patch jsonb)
returns public.merchants
language plpgsql
security definer
set search_path = public, auth
as $$
declare r public.merchants;
begin
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  update public.merchants
  set
    trade_name = coalesce(nullif(p_patch->>'trade_name',''), trade_name),
    owner_name = coalesce(nullif(p_patch->>'owner_name',''), owner_name),
    phone = coalesce(nullif(p_patch->>'phone',''), phone),
    alt_phone = coalesce(nullif(p_patch->>'alt_phone',''), alt_phone),
    email = coalesce(nullif(p_patch->>'email',''), email),
    emirate = coalesce(nullif(p_patch->>'emirate',''), emirate),
    city = coalesce(nullif(p_patch->>'city',''), city),
    address = coalesce(nullif(p_patch->>'address',''), address),
    pickup_address = coalesce(nullif(p_patch->>'pickup_address',''), pickup_address),
    default_payment_method = coalesce(nullif(p_patch->>'default_payment_method',''), default_payment_method),
    settlement_cycle = coalesce(nullif(p_patch->>'settlement_cycle',''), settlement_cycle),
    notes = coalesce(nullif(p_patch->>'notes',''), notes),
    status = coalesce(nullif(p_patch->>'status',''), status),
    updated_at = now()
  where id = p_merchant_id
  returning * into r;

  return r;
end;
$$;

create or replace function public.admin_create_coupon_order(p_order jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare r public.orders;
begin
  if not public.is_admin_or_support() then
    raise exception 'not_authorized';
  end if;

  insert into public.orders(
    tracking_number, invoice_number, coupon_number, merchant_id, merchant_name, merchant_code,
    order_count, shipping_scope, destination_country, source_channel, source_domain,
    sender_name, sender_phone, sender_city, sender_address, receiver_name, receiver_phone,
    receiver_city, receiver_address, package_type, package_description, weight, pieces,
    service_type, payment_method, cod_amount, delivery_price, subtotal, base_price, total,
    total_price, amount, price, currency, notes, status, status_history, created_by,
    created_at, updated_at
  ) values (
    nullif(p_order->>'tracking_number',''),
    nullif(p_order->>'invoice_number',''),
    nullif(p_order->>'coupon_number',''),
    public.admin_safe_uuid(p_order->>'merchant_id'),
    coalesce(nullif(p_order->>'merchant_name',''), 'DAY NIGHT Merchant'),
    nullif(p_order->>'merchant_code',''),
    coalesce((p_order->>'order_count')::int, 1),
    coalesce(nullif(p_order->>'shipping_scope',''), 'local'),
    nullif(p_order->>'destination_country',''),
    coalesce(nullif(p_order->>'source_channel',''), 'admin_operations'),
    coalesce(nullif(p_order->>'source_domain',''), 'daynightae.com'),
    coalesce(nullif(p_order->>'sender_name',''), 'DAY NIGHT Merchant'),
    coalesce(nullif(p_order->>'sender_phone',''), '971568757331'),
    coalesce(nullif(p_order->>'sender_city',''), 'Abu Dhabi'),
    coalesce(nullif(p_order->>'sender_address',''), 'Abu Dhabi'),
    nullif(p_order->>'receiver_name',''),
    nullif(p_order->>'receiver_phone',''),
    coalesce(nullif(p_order->>'receiver_city',''), 'Dubai'),
    nullif(p_order->>'receiver_address',''),
    coalesce(nullif(p_order->>'package_type',''), 'Shipment'),
    nullif(p_order->>'package_description',''),
    coalesce((p_order->>'weight')::numeric, 1),
    coalesce((p_order->>'pieces')::int, 1),
    coalesce(nullif(p_order->>'service_type',''), 'standard'),
    coalesce(nullif(p_order->>'payment_method',''), 'sender_pays'),
    coalesce((p_order->>'cod_amount')::numeric, 0),
    coalesce((p_order->>'delivery_price')::numeric, 0),
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'base_price')::numeric, 0),
    coalesce((p_order->>'total')::numeric, 0),
    coalesce((p_order->>'total_price')::numeric, 0),
    coalesce((p_order->>'amount')::numeric, 0),
    coalesce((p_order->>'price')::numeric, 0),
    coalesce(nullif(p_order->>'currency',''), 'AED'),
    nullif(p_order->>'notes',''),
    coalesce(nullif(p_order->>'status',''), 'pending'),
    coalesce(p_order->'status_history', '[]'::jsonb),
    auth.uid(),
    coalesce((p_order->>'created_at')::timestamptz, now()),
    coalesce((p_order->>'updated_at')::timestamptz, now())
  ) returning * into r;

  return r;
end;
$$;

create or replace view public.admin_operations_summary as
select
  (select count(*) from public.merchants)::integer as merchants_total,
  (select count(*) from public.merchants where coalesce(status,'active') = 'active')::integer as merchants_active,
  (select count(*) from public.orders)::integer as orders_total,
  (select count(*) from public.orders where coalesce(status,'pending') in ('pending','confirmed','assigned','in_transit','out_for_delivery'))::integer as orders_active,
  (select coalesce(sum(coalesce(delivery_price, price, amount, 0)),0)::numeric(12,2) from public.orders) as delivery_income,
  (select coalesce(sum(coalesce(cod_amount,0)),0)::numeric(12,2) from public.orders) as cod_total;

grant select, insert, update on public.merchants to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select on public.admin_operations_summary to authenticated;
grant execute on function public.admin_create_merchant(jsonb) to authenticated;
grant execute on function public.admin_update_merchant(uuid,jsonb) to authenticated;
grant execute on function public.admin_create_coupon_order(jsonb) to authenticated;
grant execute on function public.admin_safe_uuid(text) to authenticated;
