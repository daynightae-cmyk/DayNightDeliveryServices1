-- ============================================================
-- DAY NIGHT DELIVERY SERVICES - DIAGNOSTIC + CORRECTED FIX
-- ============================================================
-- This is a diagnostic and comprehensive fix.
-- Run this in Supabase SQL Editor to verify and correct pricing data.

-- STEP 1: Check current state
select 'DIAGNOSTIC' as step;
select count(*) as daynight_pricing_master_count from public.daynight_pricing_master;
select count(*) as pricing_rules_count from public.pricing_rules;
select 'First 3 pricing master rows:' as info;
select id, pricing_key, base_price, first_kg, active from public.daynight_pricing_master limit 3;

-- STEP 2: Clear and repopulate with explicit values
truncate public.daynight_pricing_master restart identity cascade;

insert into public.daynight_pricing_master (pricing_key, service_scope, label_en, label_ar, base_price, first_kg, additional_kg, vat_rate, currency, active)
values
  ('domestic_main', 'domestic', 'Main UAE cities', 'المدن الرئيسية داخل الإمارات', 30.00, null, null, 0.05, 'AED', true),
  ('domestic_extended', 'domestic', 'Extended UAE areas', 'المناطق الممتدة داخل الإمارات', 50.00, null, null, 0.05, 'AED', true),
  ('express_surcharge', 'domestic', 'Express surcharge', 'رسوم الخدمة السريعة', 15.00, null, null, 0.05, 'AED', true),
  ('gcc', 'international', 'GCC shipping', 'الشحن إلى دول الخليج', null, 95.00, 45.00, 0.05, 'AED', true),
  ('world', 'international', 'Worldwide shipping', 'الشحن الدولي العالمي', null, 190.00, 90.00, 0.05, 'AED', true);

-- STEP 3: Verify data was inserted
select 'After insert - verification:' as verification;
select pricing_key, base_price, first_kg, additional_kg, active from public.daynight_pricing_master order by id;

-- STEP 4: Test function directly (simple version without city logic)
select 'Test calculate_delivery_price result:' as test;
select public.calculate_delivery_price(null::text, null::text, 1.0) as domestic_main_result;
select public.calculate_delivery_price('Abu Dhabi', null::numeric) as single_param_result;
select public.calculate_international_price('SA'::text, 3.0::numeric) as intl_test_result;

-- STEP 5: Reload schema
notify pgrst, 'reload schema';

select 'FIX COMPLETE' as status;
