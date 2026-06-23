-- DAY NIGHT DELIVERY SERVICES
-- Production verification pack (safe read/RPC checks).
-- No destructive writes. Do not include secrets.

-- 1) Core table read checks
select 'cities' as check_name, count(*) as total from public.cities
union all
select 'zones', count(*) from public.zones
union all
select 'pricing_rules', count(*) from public.pricing_rules
union all
select 'international_rates', count(*) from public.international_rates
union all
select 'services', count(*) from public.services
union all
select 'contact_channels', count(*) from public.contact_channels
union all
select 'admin_settings', count(*) from public.admin_settings;

-- 2) Pricing verification checks
select public.calculate_delivery_price(null, null, 1) as domestic_main_expected_31_50;
select public.calculate_delivery_price(null, 'Al Ain', 1) as domestic_extended_expected_52_50;
select public.calculate_international_price('SA', 3) as saudi_3kg_expected_194_25;
select public.calculate_international_price('US', 2) as usa_2kg_expected_294_00;

-- 3) RPC availability checks (no data mutation)
select has_function_privilege('anon', 'public.track_order(text)', 'EXECUTE') as anon_can_track_order;
select has_function_privilege('anon', 'public.create_public_order(jsonb)', 'EXECUTE') as anon_can_create_public_order;
select has_function_privilege('authenticated', 'public.admin_update_order_status(text,text,text)', 'EXECUTE') as auth_can_admin_update_order_status;

-- 4) Price master data sanity
select pricing_key, base_price, first_kg, additional_kg, vat_rate, currency, active
from public.daynight_pricing_master
order by pricing_key;
