-- ============================================================
-- DAY NIGHT DELIVERY SERVICES - FINAL POSTER PRICING FIX
-- ============================================================
-- This corrects the Supabase database to match final poster pricing:
-- Local Main: 30 AED + VAT 5% = 31.50 AED
-- Local Extended: 50 AED + VAT 5% = 52.50 AED
-- Express Surcharge: 15 AED
-- GCC: 95 AED first kg, 45 AED additional kg
-- Worldwide: 190 AED first kg, 90 AED additional kg
-- VAT Rate: 5%
--
-- Run in Supabase SQL Editor with owner/admin role.
-- DO NOT use service_role in frontend.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

-- ============================================================
-- PRICING MASTER TABLE
-- ============================================================

create table if not exists public.daynight_pricing_master (
  id bigserial primary key,
  pricing_key text not null unique,
  service_scope text not null,
  label_en text not null,
  label_ar text not null,
  first_kg numeric(12,2),
  additional_kg numeric(12,2),
  base_price numeric(12,2),
  vat_rate numeric(6,4) not null default 0.05,
  currency text not null default 'AED',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Clear and populate with correct poster pricing
truncate public.daynight_pricing_master restart identity cascade;

insert into public.daynight_pricing_master
  (pricing_key, service_scope, label_en, label_ar, first_kg, additional_kg, base_price, vat_rate, currency, active)
values
  ('domestic_main', 'domestic', 'Main UAE cities', 'المدن الرئيسية داخل الإمارات', null, null, 30, 0.05, 'AED', true),
  ('domestic_extended', 'domestic', 'Extended UAE areas', 'المناطق الممتدة داخل الإمارات', null, null, 50, 0.05, 'AED', true),
  ('express_surcharge', 'domestic', 'Express surcharge', 'رسوم الخدمة السريعة', null, null, 15, 0.05, 'AED', true),
  ('gcc', 'international', 'GCC shipping', 'الشحن إلى دول الخليج', 95, 45, null, 0.05, 'AED', true),
  ('world', 'international', 'Worldwide shipping', 'الشحن الدولي العالمي', 190, 90, null, 0.05, 'AED', true);

-- ============================================================
-- CORE TABLES
-- ============================================================

create table if not exists public.cities (
  id bigserial primary key,
  name text not null unique,
  name_ar text,
  active boolean not null default true
);

create table if not exists public.zones (
  id bigserial primary key,
  name text not null unique,
  zone_type text not null default 'main',
  active boolean not null default true
);

create table if not exists public.pricing_rules (
  id bigserial primary key,
  pricing_key text not null references public.daynight_pricing_master(pricing_key),
  rule_name text,
  base_price numeric(12,2),
  vat_rate numeric(6,4) not null default 0.05,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.international_rates (
  id bigserial primary key,
  country_code text not null unique,
  country_name_en text not null,
  country_name_ar text not null,
  region text not null,
  first_kg numeric(12,2) not null,
  additional_kg numeric(12,2) not null,
  estimated_days text not null default '5-10 days',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_ar text not null,
  description_en text not null,
  description_ar text not null,
  starting_price numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  channel_type text not null unique,
  label_en text not null,
  label_ar text not null,
  value text not null,
  href text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CORE PRICING RPC FUNCTIONS
-- ============================================================

-- Helper: Get price setting value
create or replace function public.dn_price_setting(p_key text)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(base_price, first_kg, 0)
  from public.daynight_pricing_master
  where pricing_key = p_key and active = true
  limit 1;
$$;

-- Helper: Check if city/area is extended
create or replace function public.dn_is_extended_area_text(p_city text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_city, '')) ~
    '(العين|al ain|western|الغربية|الظفرة|dhafra|liwa|ليوا|sila|السلع|ghayathi|غياثي|ruwais|الرويس|madinat zayed|مدينة زايد|habshan|حبشان|hameem|حميم)';
$$;

-- Main RPC: Calculate domestic delivery price
create or replace function public.calculate_delivery_price(
  p_from_city text,
  p_to_city text,
  p_weight_kg numeric default 1
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_is_extended boolean;
  v_subtotal numeric(12,2);
  v_vat numeric(12,2);
  v_total numeric(12,2);
  v_vat_rate numeric(6,4) := 0.05;
begin
  v_is_extended := public.dn_is_extended_area_text(p_from_city) or public.dn_is_extended_area_text(p_to_city);
  v_subtotal := case
    when v_is_extended then public.dn_price_setting('domestic_extended')
    else public.dn_price_setting('domestic_main')
  end;
  v_vat := round(v_subtotal * v_vat_rate, 2);
  v_total := round(v_subtotal + v_vat, 2);

  return jsonb_build_object(
    'subtotal', v_subtotal,
    'base_price', v_subtotal,
    'vat', v_vat,
    'vat_amount', v_vat,
    'tax_amount', v_vat,
    'total', v_total,
    'total_price', v_total,
    'amount', v_total,
    'price', v_total,
    'delivery_price', v_total,
    'currency', 'AED',
    'vat_rate', v_vat_rate,
    'pricing_category', case when v_is_extended then 'domestic_extended' else 'domestic_main' end,
    'billable_weight', greatest(1, ceil(coalesce(p_weight_kg, 1)))
  );
end;
$$;

-- Overload: Single parameter version
create or replace function public.calculate_delivery_price(
  p_city_name text,
  p_weight_kg numeric default 1
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select public.calculate_delivery_price(null::text, p_city_name, p_weight_kg);
$$;

-- Main RPC: Calculate international delivery price
create or replace function public.calculate_international_price(
  p_destination text,
  p_weight_kg numeric default 1
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_destination text := lower(coalesce(p_destination, ''));
  v_billable numeric := greatest(1, ceil(coalesce(p_weight_kg, 1)));
  v_is_gcc boolean;
  v_first numeric(12,2);
  v_additional numeric(12,2);
  v_subtotal numeric(12,2);
  v_vat numeric(12,2);
  v_total numeric(12,2);
  v_vat_rate numeric(6,4) := 0.05;
begin
  v_is_gcc := v_destination in ('sa', 'ksa', 'qa', 'kw', 'om', 'bh', 'gcc')
    or v_destination like '%saudi%'
    or v_destination like '%qatar%'
    or v_destination like '%kuwait%'
    or v_destination like '%oman%'
    or v_destination like '%bahrain%'
    or v_destination like '%السعودية%'
    or v_destination like '%قطر%'
    or v_destination like '%الكويت%'
    or v_destination like '%عمان%'
    or v_destination like '%البحرين%';

  if v_is_gcc then
    select first_kg, additional_kg into v_first, v_additional
    from public.daynight_pricing_master
    where pricing_key = 'gcc' and active = true;
  else
    select first_kg, additional_kg into v_first, v_additional
    from public.daynight_pricing_master
    where pricing_key = 'world' and active = true;
  end if;

  v_subtotal := v_first + ((v_billable - 1) * v_additional);
  v_vat := round(v_subtotal * v_vat_rate, 2);
  v_total := round(v_subtotal + v_vat, 2);

  return jsonb_build_object(
    'subtotal', v_subtotal,
    'base_price', v_subtotal,
    'vat', v_vat,
    'vat_amount', v_vat,
    'tax_amount', v_vat,
    'total', v_total,
    'total_price', v_total,
    'amount', v_total,
    'price', v_total,
    'delivery_price', v_total,
    'currency', 'AED',
    'vat_rate', v_vat_rate,
    'first_kg', v_first,
    'additional_kg', v_additional,
    'pricing_category', case when v_is_gcc then 'gcc' else 'world' end,
    'billable_weight', v_billable
  );
end;
$$;

-- ============================================================
-- PERMISSIONS
-- ============================================================

grant select on public.daynight_pricing_master to anon, authenticated;
grant select on public.cities to anon, authenticated;
grant select on public.zones to anon, authenticated;
grant select on public.pricing_rules to anon, authenticated;
grant select on public.admin_settings to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.contact_channels to anon, authenticated;
grant select on public.international_rates to anon, authenticated;

grant execute on function public.dn_price_setting(text) to anon, authenticated;
grant execute on function public.dn_is_extended_area_text(text) to anon, authenticated;
grant execute on function public.calculate_delivery_price(text, text, numeric) to anon, authenticated;
grant execute on function public.calculate_delivery_price(text, numeric) to anon, authenticated;
grant execute on function public.calculate_international_price(text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION TESTS (Safe, read-only)
-- ============================================================

select
  'PRICING_MASTER' as check_type,
  count(*)::text as total,
  'Should be 5' as expected
from public.daynight_pricing_master
where active = true

union all

select
  'DOMESTIC_MAIN_TEST' as check_type,
  (public.calculate_delivery_price('Abu Dhabi', null::numeric)->>'total')::text as total,
  '31.5' as expected

union all

select
  'DOMESTIC_EXTENDED_TEST' as check_type,
  (public.calculate_delivery_price('Al Ain', null::numeric)->>'total')::text as total,
  '52.5' as expected

union all

select
  'INTERNATIONAL_SA_3KG_TEST' as check_type,
  (public.calculate_international_price('SA', 3)->>'total')::text as total,
  '194.25' as expected

union all

select
  'INTERNATIONAL_US_2KG_TEST' as check_type,
  (public.calculate_international_price('US', 2)->>'total')::text as total,
  '294' as expected;
