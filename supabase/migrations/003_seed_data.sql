-- DAY NIGHT DELIVERY SERVICES
-- Migration 003: Seed data for zones, cities, and pricing
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Insert UAE Zones
insert into public.zones (code, name_en, name_ar, zone_type) values
  ('UAE_MAIN', 'Main UAE Cities', 'المدن الرئيسية', 'main'),
  ('UAE_EXTENDED', 'Extended UAE Areas', 'المناطق الممتدة', 'extended'),
  ('GCC', 'GCC Countries', 'دول الخليج', 'gcc'),
  ('WORLDWIDE', 'Worldwide', 'عالمي', 'worldwide')
on conflict (code) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  zone_type = excluded.zone_type,
  is_active = true;

-- Insert UAE Cities
insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Abu Dhabi', 'أبوظبي', 'Abu Dhabi', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Dubai', 'دبي', 'Dubai', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Sharjah', 'الشارقة', 'Sharjah', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Ajman', 'عجمان', 'Ajman', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Umm Al Quwain', 'أم القيوين', 'Umm Al Quwain', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Ras Al Khaimah', 'رأس الخيمة', 'Ras Al Khaimah', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Fujairah', 'الفجيرة', 'Fujairah', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Al Ain', 'العين', 'Abu Dhabi', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Western Region', 'المنطقة الغربية', 'Abu Dhabi', 'AE', 'extended'
from public.zones z where z.code = 'UAE_EXTENDED'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

insert into public.cities (zone_id, name_en, name_ar, emirate, country, area_type)
select z.id, 'Mussafah', 'مصفح', 'Abu Dhabi', 'AE', 'main'
from public.zones z where z.code = 'UAE_MAIN'
on conflict (name_en) do update set name_ar = excluded.name_ar, is_active = true;

-- Insert International Rates
insert into public.international_rates (destination_code, destination_name, first_kg_price, additional_kg_price) values
  ('SA', 'Saudi Arabia', 95, 45),
  ('KW', 'Kuwait', 95, 45),
  ('QA', 'Qatar', 95, 45),
  ('BH', 'Bahrain', 95, 45),
  ('OM', 'Oman', 95, 45),
  ('US', 'United States', 190, 90),
  ('GB', 'United Kingdom', 190, 90),
  ('DE', 'Germany', 190, 90),
  ('FR', 'France', 190, 90),
  ('IT', 'Italy', 190, 90),
  ('ES', 'Spain', 190, 90),
  ('CN', 'China', 190, 90),
  ('IN', 'India', 190, 90),
  ('PK', 'Pakistan', 190, 90),
  ('PH', 'Philippines', 190, 90),
  ('EG', 'Egypt', 190, 90),
  ('JO', 'Jordan', 190, 90),
  ('LB', 'Lebanon', 190, 90)
on conflict (destination_code) do update set
  first_kg_price = excluded.first_kg_price,
  additional_kg_price = excluded.additional_kg_price,
  is_active = true;

-- Insert Pricing Rules
insert into public.pricing_rules (service_type, origin_zone_type, destination_zone_type, flat_price) values
  ('domestic', 'main', 'main', 30),
  ('domestic', 'main', 'extended', 50),
  ('domestic', 'extended', 'main', 50),
  ('domestic', 'extended', 'extended', 50),
  ('gcc', 'uae', 'gcc', null),
  ('worldwide', 'uae', 'worldwide', null)
on conflict (service_type, origin_zone_type, destination_zone_type) do update set
  flat_price = excluded.flat_price,
  is_active = true;
