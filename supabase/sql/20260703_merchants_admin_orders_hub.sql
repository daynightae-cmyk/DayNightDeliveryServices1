-- DAY NIGHT DELIVERY SERVICES
-- Merchants / contracted traders + admin coupon order creation.
-- Apply once in Supabase SQL Editor. Safe to re-run.

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
  add column if not exists coupon_number text,
  add column if not exists merchant_id uuid,
  add column if not exists merchant_name text,
  add column if not exists merchant_code text,
  add column if not exists order_count integer default 1,
  add column if not exists shipping_scope text default 'local',
  add column if not exists destination_country text,
  add column if not exists source_channel text default 'website';

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
create index if not exists orders_coupon_number_idx on public.orders (coupon_number);
create index if not exists orders_merchant_id_idx on public.orders (merchant_id);
create index if not exists orders_merchant_name_idx on public.orders (merchant_name);
create index if not exists orders_source_channel_idx on public.orders (source_channel);

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
      and p.role in ('admin', 'support')
  );
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

commit;
