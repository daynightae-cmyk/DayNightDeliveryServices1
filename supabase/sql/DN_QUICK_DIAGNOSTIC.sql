-- ============================================================
-- QUICK DIAGNOSTIC - Check pricing data state
-- ============================================================

-- Check if daynight_pricing_master table exists and has data
select 'daynight_pricing_master rows:' as check;
select count(*) as total_rows from public.daynight_pricing_master;

-- Show all pricing data
select pricing_key, service_scope, base_price, first_kg, additional_kg, active 
from public.daynight_pricing_master 
order by id;

-- Test the helper function
select 'Test dn_price_setting:' as check;
select public.dn_price_setting('domestic_main') as domestic_main_price;
select public.dn_price_setting('domestic_extended') as domestic_extended_price;
select public.dn_price_setting('gcc') as gcc_first_kg;

-- If results are NULL or 0, we need to fix the data
-- Run the following INSERT to ensure correct data is present:

-- Ensure pricing data is present with explicit numeric values:
insert into public.daynight_pricing_master (pricing_key, service_scope, label_en, label_ar, base_price, first_kg, additional_kg, vat_rate, currency, active)
values
  ('domestic_main', 'domestic', 'Main UAE cities', 'المدن الرئيسية داخل الإمارات', 30.00, null, null, 0.05, 'AED', true),
  ('domestic_extended', 'domestic', 'Extended UAE areas', 'المناطق الممتدة داخل الإمارات', 50.00, null, null, 0.05, 'AED', true),
  ('express_surcharge', 'domestic', 'Express surcharge', 'رسوم الخدمة السريعة', 15.00, null, null, 0.05, 'AED', true),
  ('gcc', 'international', 'GCC shipping', 'الشحن إلى دول الخليج', null, 95.00, 45.00, 0.05, 'AED', true),
  ('world', 'international', 'Worldwide shipping', 'الشحن الدولي العالمي', null, 190.00, 90.00, 0.05, 'AED', true)
on conflict (pricing_key) do update set 
  service_scope = excluded.service_scope,
  label_en = excluded.label_en,
  label_ar = excluded.label_ar,
  base_price = excluded.base_price,
  first_kg = excluded.first_kg,
  additional_kg = excluded.additional_kg,
  vat_rate = excluded.vat_rate,
  currency = excluded.currency,
  active = excluded.active;

-- Verify after insert
select 'After insert/upsert - verification:' as status;
select pricing_key, base_price, first_kg, additional_kg from public.daynight_pricing_master order by id;

-- Re-test helper function
select 'After fix - Test dn_price_setting:' as check;
select public.dn_price_setting('domestic_main') as domestic_main_price;

-- Reload schema
notify pgrst, 'reload schema';

select 'DIAGNOSTIC COMPLETE' as done;
