-- DAY NIGHT DELIVERY SERVICES
-- Master production hardening pack for Supabase.
-- Run in Supabase SQL Editor with an owner/admin database role.
-- DO NOT USE service_role IN FRONTEND.

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated;

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

insert into public.daynight_pricing_master
  (pricing_key, service_scope, label_en, label_ar, first_kg, additional_kg, base_price, vat_rate, currency, active)
values
  ('domestic_main', 'domestic', 'Main UAE cities', 'المدن الرئيسية داخل الإمارات', null, null, 30, 0.05, 'AED', true),
  ('domestic_extended', 'domestic', 'Extended UAE areas', 'المناطق الممتدة داخل الإمارات', null, null, 50, 0.05, 'AED', true),
  ('express_surcharge', 'domestic', 'Express surcharge', 'رسوم الخدمة السريعة', null, null, 15, 0.05, 'AED', true),
  ('gcc', 'international', 'GCC shipping', 'الشحن إلى دول الخليج', 95, 45, null, 0.05, 'AED', true),
  ('world', 'international', 'Worldwide shipping', 'الشحن الدولي العالمي', 190, 90, null, 0.05, 'AED', true)
on conflict (pricing_key) do update set
  service_scope = excluded.service_scope,
  label_en = excluded.label_en,
  label_ar = excluded.label_ar,
  first_kg = excluded.first_kg,
  additional_kg = excluded.additional_kg,
  base_price = excluded.base_price,
  vat_rate = excluded.vat_rate,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = now();

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

insert into public.cities (name, name_ar) values
  ('Abu Dhabi', 'أبوظبي'),
  ('Dubai', 'دبي'),
  ('Sharjah', 'الشارقة'),
  ('Ajman', 'عجمان'),
  ('Umm Al Quwain', 'أم القيوين'),
  ('Ras Al Khaimah', 'رأس الخيمة'),
  ('Fujairah', 'الفجيرة'),
  ('Al Ain', 'العين'),
  ('Western Region', 'المنطقة الغربية'),
  ('Mussafah 40', 'مصفح 40')
on conflict (name) do update set name_ar = excluded.name_ar, active = true;

insert into public.zones (name, zone_type) values
  ('Main UAE Cities', 'main'),
  ('Al Ain and Western Region', 'extended')
on conflict (name) do update set zone_type = excluded.zone_type, active = true;

insert into public.pricing_rules (pricing_key) values
  ('domestic_main'),
  ('domestic_extended'),
  ('express_surcharge'),
  ('gcc'),
  ('world')
on conflict do nothing;

insert into public.international_rates
  (country_code, country_name_en, country_name_ar, region, first_kg, additional_kg, estimated_days, active)
values
  ('BH', 'Bahrain', 'البحرين', 'GCC', 95, 45, '2-5 days', true),
  ('OM', 'Oman', 'سلطنة عمان', 'GCC', 95, 45, '2-5 days', true),
  ('KW', 'Kuwait', 'الكويت', 'GCC', 95, 45, '2-5 days', true),
  ('QA', 'Qatar', 'قطر', 'GCC', 95, 45, '2-5 days', true),
  ('SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'GCC', 95, 45, '2-5 days', true),
  ('GB', 'United Kingdom', 'المملكة المتحدة', 'Europe', 190, 90, '5-10 days', true),
  ('FR', 'France', 'فرنسا', 'Europe', 190, 90, '5-10 days', true),
  ('DE', 'Germany', 'ألمانيا', 'Europe', 190, 90, '5-10 days', true),
  ('IT', 'Italy', 'إيطاليا', 'Europe', 190, 90, '5-10 days', true),
  ('ES', 'Spain', 'إسبانيا', 'Europe', 190, 90, '5-10 days', true),
  ('NL', 'Netherlands', 'هولندا', 'Europe', 190, 90, '5-10 days', true),
  ('US', 'United States', 'الولايات المتحدة الأمريكية', 'North America', 190, 90, '5-10 days', true),
  ('CA', 'Canada', 'كندا', 'North America', 190, 90, '5-10 days', true),
  ('WORLD', 'Worldwide', 'وجهات عالمية', 'Worldwide', 190, 90, '7-14 days', true)
on conflict (country_code) do update set
  country_name_en = excluded.country_name_en,
  country_name_ar = excluded.country_name_ar,
  region = excluded.region,
  first_kg = excluded.first_kg,
  additional_kg = excluded.additional_kg,
  estimated_days = excluded.estimated_days,
  active = excluded.active,
  updated_at = now();

insert into public.admin_settings (setting_key, setting_value) values
  ('company_profile', jsonb_build_object(
    'company', 'DAY NIGHT DELIVERY SERVICES',
    'company_ar', 'داي نايت لخدمات التوصيل والشحن',
    'domain', 'https://daynightae.com',
    'email', 'Admin@daynightae.com',
    'phone', '+971 56 875 7331',
    'address', 'UAE ABUDHABI MUSSAFAH 40'
  ))
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  updated_at = now();

create table if not exists public.orders (
  id text primary key,
  sender_name text not null,
  sender_phone text not null,
  sender_city text not null,
  sender_address text not null,
  receiver_name text not null,
  receiver_phone text not null,
  receiver_city text not null,
  receiver_address text not null,
  package_type text not null,
  weight numeric not null default 1,
  pieces integer not null default 1,
  service_type text not null default 'standard',
  payment_method text not null default 'sender_pays',
  cod_amount numeric,
  notes text not null,
  status text not null default 'Pending',
  status_history jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  base_price numeric not null default 0,
  vat_amount numeric not null default 0,
  vat numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  total_price numeric not null default 0,
  amount numeric not null default 0,
  price numeric not null default 0,
  delivery_price numeric not null default 0,
  currency text not null default 'AED',
  public_order_payload jsonb not null default '{}'::jsonb,
  tracking_code text unique,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  r record;
  v text;
  values_to_add text[];
  enum_name text;
begin
  for r in
    select c.column_name, n.nspname, t.typname
    from information_schema.columns c
    join pg_type t on t.typname = c.udt_name
    join pg_namespace n on n.oid = t.typnamespace
    where c.table_schema = 'public'
      and c.table_name = 'orders'
      and c.column_name in ('payment_method', 'status')
      and t.typtype = 'e'
  loop
    if r.column_name = 'payment_method' then
      values_to_add := array['sender_pays', 'receiver_pays', 'cod'];
    else
      values_to_add := array[
        'Pending',
        'Accepted',
        'Driver Assigned',
        'Picked Up',
        'In Transit',
        'Out for Delivery',
        'Out For Delivery',
        'Delivered',
        'Cancelled',
        'Failed',
        'Confirmed',
        'Assigned'
      ];
    end if;

    enum_name := format('%I.%I', r.nspname, r.typname);
    foreach v in array values_to_add loop
      execute format('alter type %s add value if not exists %L', enum_name, v);
    end loop;
  end loop;
end $$;

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

create or replace function public.dn_city_search_text(p_city text)
returns text
language sql
immutable
as $$
  select lower(coalesce(p_city, ''));
$$;

create or replace function public.dn_is_extended_area_text(p_city text)
returns boolean
language sql
immutable
as $$
  select public.dn_city_search_text(p_city) ~
    '(العين|al ain|western|الغربية|الظفرة|dhafra|liwa|ليوا|sila|السلع|ghayathi|غياثي|ruwais|الرويس|madinat zayed|مدينة زايد|habshan|حبشان|hameem|حميم)';
$$;

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

create or replace function public.create_public_order(p_order_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := coalesce(p_order_data, '{}'::jsonb);
  v_required text[] := array[
    'sender_name',
    'sender_phone',
    'sender_city',
    'sender_address',
    'receiver_name',
    'receiver_phone',
    'receiver_city',
    'receiver_address',
    'package_type',
    'weight',
    'pieces',
    'service_type',
    'delivery_price',
    'payment_method',
    'notes',
    'status',
    'status_history'
  ];
  v_key text;
  v_tracking_code text := 'DN-' || to_char(now(), 'YYYY') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
  v_payment_method text := lower(coalesce(nullif(v_payload->>'payment_method', ''), 'sender_pays'));
  v_status text := coalesce(nullif(v_payload->>'status', ''), 'Pending');
  v_service_type text := lower(coalesce(nullif(v_payload->>'service_type', ''), 'standard'));
  v_price jsonb;
  v_subtotal numeric(12,2);
  v_vat numeric(12,2);
  v_total numeric(12,2);
  v_inserted jsonb;
  c record;
  v_default jsonb;
begin
  foreach v_key in array v_required loop
    if not (v_payload ? v_key) or nullif(trim(coalesce(v_payload->>v_key, '')), '') is null then
      raise exception 'Missing required order field: %', v_key;
    end if;
  end loop;

  if v_payment_method not in ('sender_pays', 'receiver_pays', 'cod') then
    raise exception 'Invalid payment_method: %', v_payment_method;
  end if;

  -- Enforce canonical enum-compatible values before insert.
  -- This preserves compatibility with projects where orders.payment_method/orders.status are enum columns.
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'payment_method'
      and t.typtype = 'e'
  ) then
    execute 'select ($1)::public.payment_method::text'
      into v_payment_method
      using v_payment_method;
  end if;

  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_status'
      and t.typtype = 'e'
  ) then
    execute 'select ($1)::public.order_status::text'
      into v_status
      using v_status;
  end if;

  v_price := public.calculate_delivery_price(v_payload->>'sender_city', v_payload->>'receiver_city', (v_payload->>'weight')::numeric);
  v_subtotal := coalesce(nullif(v_payload->>'subtotal', '')::numeric, (v_price->>'subtotal')::numeric);

  if v_service_type = 'express' and nullif(v_payload->>'subtotal', '') is null then
    v_subtotal := v_subtotal + public.dn_price_setting('express_surcharge');
  end if;

  v_total := coalesce(nullif(v_payload->>'delivery_price', '')::numeric, round(v_subtotal * 1.05, 2));
  v_vat := coalesce(nullif(v_payload->>'vat_amount', '')::numeric, round(v_total - round(v_total / 1.05, 2), 2));
  v_subtotal := coalesce(nullif(v_payload->>'subtotal', '')::numeric, round(v_total - v_vat, 2));

  v_payload := v_payload || jsonb_build_object(
    'tracking_code', v_tracking_code,
    'tracking_number', v_tracking_code,
    'order_number', v_tracking_code,
    'status', v_status,
    'payment_method', v_payment_method,
    'service_type', v_service_type,
    'subtotal', v_subtotal,
    'base_price', v_subtotal,
    'vat_amount', v_vat,
    'vat', v_vat,
    'tax_amount', v_vat,
    'total', v_total,
    'total_price', v_total,
    'amount', v_total,
    'price', v_total,
    'delivery_price', v_total,
    'currency', 'AED',
    'public_order_payload', v_payload,
    'created_at', coalesce(nullif(v_payload->>'created_at', ''), now()::text),
    'updated_at', now()::text
  );

  for c in
    select column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
  loop
    if c.column_name in ('tracking_code', 'tracking_number', 'order_number') then
      v_payload := jsonb_set(v_payload, array[c.column_name], to_jsonb(v_tracking_code), true);
    elsif c.column_name = 'id' and not (v_payload ? 'id') then
      if c.data_type = 'uuid' then
        v_payload := jsonb_set(v_payload, '{id}', to_jsonb(gen_random_uuid()::text), true);
      elsif c.column_default is null then
        v_payload := jsonb_set(v_payload, '{id}', to_jsonb(v_tracking_code), true);
      end if;
    elsif not (v_payload ? c.column_name) and c.is_nullable = 'NO' and c.column_default is null then
      v_default := case
        when c.column_name like '%name%' then to_jsonb('provided_by_public_order'::text)
        when c.column_name like '%phone%' then to_jsonb('provided_by_public_order'::text)
        when c.column_name like '%address%' then to_jsonb('provided_by_public_order'::text)
        when c.column_name like '%city%' then to_jsonb('provided_by_public_order'::text)
        when c.column_name like '%currency%' then to_jsonb('AED'::text)
        when c.column_name like '%status%' then to_jsonb(v_status)
        when c.column_name like '%payment%' then to_jsonb(v_payment_method)
        when c.data_type in ('integer', 'bigint', 'smallint') then to_jsonb(0)
        when c.data_type in ('numeric', 'real', 'double precision') then to_jsonb(0)
        when c.data_type = 'boolean' then to_jsonb(false)
        when c.data_type like 'timestamp%' then to_jsonb(now()::text)
        when c.data_type = 'date' then to_jsonb(current_date::text)
        when c.data_type = 'jsonb' then '{}'::jsonb
        when c.data_type = 'json' then '{}'::jsonb
        when c.data_type = 'ARRAY' then '[]'::jsonb
        else to_jsonb('provided_by_public_order'::text)
      end;
      v_payload := jsonb_set(v_payload, array[c.column_name], v_default, true);
    end if;
  end loop;

  execute
    'insert into public.orders select (jsonb_populate_record(null::public.orders, $1)).* returning to_jsonb(orders.*)'
    into v_inserted
    using v_payload;

  return v_inserted || jsonb_build_object(
    'tracking_code', coalesce(v_inserted->>'tracking_code', v_inserted->>'tracking_number', v_inserted->>'id', v_tracking_code),
    'tracking_number', coalesce(v_inserted->>'tracking_number', v_inserted->>'tracking_code', v_inserted->>'id', v_tracking_code)
  );
end;
$$;

create or replace function public.dn_current_user_is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    return false;
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id
  limit 1;

  return lower(coalesce(v_role, '')) = 'admin';
exception
  when others then
    return false;
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed_statuses text[] := array[
    'Pending',
    'Accepted',
    'Driver Assigned',
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Out For Delivery',
    'Delivered',
    'Cancelled',
    'Failed',
    'Confirmed',
    'Assigned'
  ];
  v_history_item jsonb;
  v_result jsonb;
begin
  if not public.dn_current_user_is_admin() then
    raise exception 'Admin privileges required';
  end if;

  if p_status is null or not (p_status = any(v_allowed_statuses)) then
    raise exception 'Invalid order status: %', p_status;
  end if;

  v_history_item := jsonb_build_object(
    'status', p_status,
    'date', now()::text,
    'note', coalesce(nullif(p_note, ''), 'Status updated by admin')
  );

  update public.orders
  set status = p_status,
      status_history = coalesce(status_history, '[]'::jsonb) || jsonb_build_array(v_history_item),
      updated_at = now()
  where id::text = p_order_id
     or tracking_code = p_order_id
     or tracking_number = p_order_id
  returning to_jsonb(public.orders.*) into v_result;

  return v_result;
end;
$$;

create or replace function public.track_order(p_tracking_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_where text := '';
  v_result jsonb;
  c record;
begin
  if nullif(trim(coalesce(p_tracking_code, '')), '') is null then
    return null;
  end if;

  for c in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name in ('id', 'tracking_code', 'tracking_number', 'order_number')
  loop
    v_where := v_where ||
      case when v_where = '' then '' else ' or ' end ||
      format('%I::text = $1', c.column_name);
  end loop;

  if v_where = '' then
    return null;
  end if;

  execute format('select to_jsonb(o) from public.orders o where %s limit 1', v_where)
    into v_result
    using p_tracking_code;

  return v_result;
end;
$$;

grant select on public.daynight_pricing_master to anon, authenticated;
grant select on public.cities to anon, authenticated;
grant select on public.zones to anon, authenticated;
grant select on public.pricing_rules to anon, authenticated;
grant select on public.international_rates to anon, authenticated;
grant select on public.admin_settings to anon, authenticated;

grant execute on function public.dn_price_setting(text) to anon, authenticated;
grant execute on function public.dn_city_search_text(text) to anon, authenticated;
grant execute on function public.dn_is_extended_area_text(text) to anon, authenticated;
grant execute on function public.calculate_delivery_price(text, text, numeric) to anon, authenticated;
grant execute on function public.calculate_delivery_price(text, numeric) to anon, authenticated;
grant execute on function public.calculate_international_price(text, numeric) to anon, authenticated;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
grant execute on function public.track_order(text) to anon, authenticated;
grant execute on function public.dn_current_user_is_admin() to authenticated;
grant execute on function public.admin_update_order_status(text, text, text) to authenticated;

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  loop
    execute format('grant execute on function %I.%I(%s) to anon, authenticated', r.nspname, r.proname, r.args);
  end loop;
end $$;

notify pgrst, 'reload schema';

