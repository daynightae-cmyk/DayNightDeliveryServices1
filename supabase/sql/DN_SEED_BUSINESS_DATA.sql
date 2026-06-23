-- DAY NIGHT DELIVERY SERVICES
-- Business seed data pack. Run after DN_MASTER_PRODUCTION_FIX.sql.

grant usage on schema public to anon, authenticated;

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

alter table if exists public.international_rates
  add column if not exists updated_at timestamptz not null default now();

-- Legacy compatibility: older projects may have admin_settings with key/value only.
alter table if exists public.admin_settings
  add column if not exists setting_key text;

alter table if exists public.admin_settings
  add column if not exists setting_value jsonb;

alter table if exists public.admin_settings
  add column if not exists updated_at timestamptz not null default now();

update public.admin_settings
set setting_key = coalesce(setting_key, key)
where setting_key is null
  and key is not null;

update public.admin_settings
set setting_value = coalesce(setting_value, to_jsonb(value))
where setting_value is null
  and value is not null;

create unique index if not exists admin_settings_setting_key_unique_idx
  on public.admin_settings (setting_key)
  where setting_key is not null;

-- Legacy compatibility: older contact_channels may miss newer columns.
alter table if exists public.contact_channels
  add column if not exists channel_type text;

alter table if exists public.contact_channels
  add column if not exists label_en text;

alter table if exists public.contact_channels
  add column if not exists label_ar text;

alter table if exists public.contact_channels
  add column if not exists value text;

alter table if exists public.contact_channels
  add column if not exists href text;

alter table if exists public.contact_channels
  add column if not exists active boolean not null default true;

alter table if exists public.contact_channels
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists contact_channels_channel_type_unique_idx
  on public.contact_channels (channel_type)
  where channel_type is not null;

insert into public.zones (name, zone_type, active) values
  ('Abu Dhabi Main', 'main', true),
  ('Dubai Main', 'main', true),
  ('Northern Emirates', 'main', true),
  ('Extended Areas', 'extended', true),
  ('International', 'international', true)
on conflict (name) do update set zone_type = excluded.zone_type, active = excluded.active;

insert into public.cities (name, name_ar, active) values
  ('Abu Dhabi', 'أبوظبي', true),
  ('Dubai', 'دبي', true),
  ('Sharjah', 'الشارقة', true),
  ('Ajman', 'عجمان', true),
  ('Umm Al Quwain', 'أم القيوين', true),
  ('Ras Al Khaimah', 'رأس الخيمة', true),
  ('Fujairah', 'الفجيرة', true),
  ('Al Ain', 'العين', true),
  ('Al Dhafra / Western Region', 'الظفرة / المنطقة الغربية', true),
  ('Mussafah', 'مصفح', true),
  ('Khalifa City', 'مدينة خليفة', true),
  ('Mohammed Bin Zayed City', 'مدينة محمد بن زايد', true),
  ('Baniyas', 'بني ياس', true),
  ('Reem Island', 'جزيرة الريم', true),
  ('Yas Island', 'جزيرة ياس', true),
  ('Saadiyat', 'السعديات', true),
  ('Business Bay', 'الخليج التجاري', true),
  ('Deira', 'ديرة', true),
  ('Bur Dubai', 'بر دبي', true),
  ('Jebel Ali', 'جبل علي', true),
  ('Dubai Marina', 'دبي مارينا', true),
  ('JVC', 'قرية جميرا الدائرية', true),
  ('Al Barsha', 'البرشاء', true)
on conflict (name) do update set name_ar = excluded.name_ar, active = excluded.active;

insert into public.pricing_rules (pricing_key, rule_name, base_price, vat_rate, active) values
  ('domestic_main', 'main 30 AED', 30, 0.05, true),
  ('domestic_extended', 'extended 50 AED', 50, 0.05, true),
  ('express_surcharge', 'express 15 AED', 15, 0.05, true)
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
  ('company_name', '"DAY NIGHT DELIVERY SERVICES"'::jsonb),
  ('company_name_ar', '"داي نايت لخدمات التوصيل والشحن"'::jsonb),
  ('domain', '"https://daynightae.com"'::jsonb),
  ('email', '"Admin@daynightae.com"'::jsonb),
  ('phone', '"+971 56 875 7331"'::jsonb),
  ('whatsapp', '"https://wa.me/971568757331"'::jsonb),
  ('address', '"UAE ABUDHABI MUSSAFAH 40"'::jsonb),
  ('vat_rate', '0.05'::jsonb),
  ('currency', '"AED"'::jsonb),
  ('business_hours', '"24/7"'::jsonb),
  ('support_message', '"Your Comfort.. Our Priority"'::jsonb),
  ('tracking_enabled', 'true'::jsonb),
  ('cod_enabled', 'true'::jsonb),
  ('returns_enabled', 'true'::jsonb),
  ('signature_required', 'true'::jsonb),
  ('proof_of_delivery_enabled', 'true'::jsonb)
on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_at = now();

insert into public.services
  (slug, title_en, title_ar, description_en, description_ar, starting_price, active)
values
  ('same-day-delivery', 'Same Day Delivery', 'توصيل في نفس اليوم', 'Same-day pickup and delivery for urgent parcels and documents across supported UAE areas.', 'استلام وتسليم في نفس اليوم للطرود والمستندات العاجلة داخل مناطق الإمارات المدعومة.', 30, true),
  ('next-day-delivery', 'Next Day Delivery', 'توصيل اليوم التالي', 'Cost-effective next-day delivery for recurring business and personal shipments.', 'خدمة توصيل اقتصادية وموثوقة للطلبات المتكررة للأفراد والمتاجر.', 30, true),
  ('express-delivery', 'Express Delivery', 'توصيل سريع', 'Priority delivery with a fixed express surcharge before VAT.', 'توصيل بأولوية مع رسوم خدمة سريعة ثابتة قبل الضريبة.', 45, true),
  ('scheduled-delivery', 'Scheduled Delivery', 'توصيل مجدول', 'Schedule pickup and delivery windows for customers and business routes.', 'جدولة مواعيد الاستلام والتسليم للعملاء ومسارات الشركات.', 30, true),
  ('documents-delivery', 'Documents Delivery', 'توصيل مستندات', 'Secure delivery for contracts, official documents, invoices, and legal papers.', 'توصيل آمن للعقود والمستندات الرسمية والفواتير والأوراق القانونية.', 30, true),
  ('parcels-delivery', 'Parcels Delivery', 'توصيل طرود', 'Delivery for parcels, gifts, retail items, and daily packages.', 'توصيل الطرود والهدايا ومنتجات المتاجر والباقات اليومية.', 30, true),
  ('e-commerce-delivery', 'E-Commerce Delivery', 'توصيل المتاجر الإلكترونية', 'Delivery operations for online shops with COD, returns, and daily pickups.', 'عمليات توصيل للمتاجر الإلكترونية مع التحصيل عند الاستلام والمرتجعات والاستلام اليومي.', 30, true),
  ('cod-collection', 'COD Collection', 'التحصيل عند الاستلام', 'Cash-on-delivery collection support for merchants and retail sellers.', 'دعم التحصيل عند الاستلام للتجار والمتاجر.', 30, true),
  ('returns-management', 'Returns Management', 'إدارة المرتجعات', 'Return pickup and reverse logistics for e-commerce and corporate accounts.', 'استلام المرتجعات وإدارة اللوجستيات العكسية للمتاجر والشركات.', 30, true),
  ('corporate-delivery-solutions', 'Corporate Delivery Solutions', 'حلول توصيل الشركات', 'Recurring delivery services for companies, institutions, and government teams.', 'خدمات توصيل متكررة للشركات والمؤسسات والجهات الحكومية.', null, true),
  ('international-shipping', 'International Shipping', 'الشحن الدولي', 'International shipping to GCC, Europe, USA, Canada, and worldwide destinations.', 'شحن دولي إلى الخليج وأوروبا وأمريكا وكندا والوجهات العالمية.', 95, true),
  ('gcc-shipping', 'GCC Shipping', 'الشحن إلى الخليج', 'Shipping to Saudi Arabia, Oman, Qatar, Kuwait, and Bahrain.', 'الشحن إلى السعودية وعمان وقطر والكويت والبحرين.', 95, true),
  ('europe-shipping', 'Europe Shipping', 'الشحن إلى أوروبا', 'Shipping to the United Kingdom, Germany, France, Italy, Spain, and Netherlands.', 'الشحن إلى المملكة المتحدة وألمانيا وفرنسا وإيطاليا وإسبانيا وهولندا.', 190, true),
  ('usa-shipping', 'USA Shipping', 'الشحن إلى أمريكا', 'Shipping to the United States with clear kilogram-based pricing.', 'الشحن إلى الولايات المتحدة بتسعير واضح حسب الوزن.', 190, true),
  ('canada-shipping', 'Canada Shipping', 'الشحن إلى كندا', 'Shipping to Canada with worldwide pricing rules.', 'الشحن إلى كندا وفق قواعد التسعير العالمي.', 190, true),
  ('worldwide-shipping', 'Worldwide Shipping', 'الشحن العالمي', 'Worldwide shipping fallback for destinations outside GCC, Europe, USA, and Canada.', 'شحن عالمي للوجهات خارج الخليج وأوروبا وأمريكا وكندا.', 190, true),
  ('live-tracking', 'Live Tracking', 'التتبع المباشر', 'Tracking code lookup with status history and delivery route display.', 'البحث برقم التتبع مع عرض سجل الحالة ومسار التوصيل.', null, true),
  ('proof-of-delivery', 'Proof of Delivery', 'إثبات التسليم', 'Proof of delivery support for completed orders and corporate operations.', 'دعم إثبات التسليم للطلبات المكتملة وعمليات الشركات.', null, true),
  ('signature-capture', 'Signature Capture', 'توقيع المستلم', 'Canvas-based signature capture ready for storage integration.', 'التقاط توقيع عبر اللوحة جاهز للربط مع التخزين.', null, true),
  ('24-7-support', '24/7 Support', 'دعم على مدار الساعة', 'WhatsApp, phone, and email support for delivery, tracking, and corporate requests.', 'دعم عبر واتساب والهاتف والبريد للتوصيل والتتبع وطلبات الشركات.', null, true)
on conflict (slug) do update set
  title_en = excluded.title_en,
  title_ar = excluded.title_ar,
  description_en = excluded.description_en,
  description_ar = excluded.description_ar,
  starting_price = excluded.starting_price,
  active = excluded.active;

insert into public.contact_channels
  (channel_type, label_en, label_ar, value, href, active)
values
  ('whatsapp', 'WhatsApp', 'واتساب', '+971 56 875 7331', 'https://wa.me/971568757331', true),
  ('phone', 'Phone', 'الهاتف', '+971 56 875 7331', 'tel:+971568757331', true),
  ('email', 'Email', 'البريد الإلكتروني', 'Admin@daynightae.com', 'mailto:Admin@daynightae.com', true),
  ('website', 'Website', 'الموقع الإلكتروني', 'https://daynightae.com', 'https://daynightae.com', true),
  ('address', 'Address', 'العنوان', 'UAE ABUDHABI MUSSAFAH 40', 'https://maps.app.goo.gl/PCTjMCQpZuR3ns2J7', true)
on conflict (channel_type) do update set
  label_en = excluded.label_en,
  label_ar = excluded.label_ar,
  value = excluded.value,
  href = excluded.href,
  active = excluded.active;

alter table public.services enable row level security;
alter table public.contact_channels enable row level security;

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists contact_channels_public_read on public.contact_channels;
create policy contact_channels_public_read on public.contact_channels
  for select
  to anon, authenticated
  using (active = true);

grant select on public.services to anon, authenticated;
grant select on public.contact_channels to anon, authenticated;
grant select on public.cities to anon, authenticated;
grant select on public.zones to anon, authenticated;
grant select on public.pricing_rules to anon, authenticated;
grant select on public.international_rates to anon, authenticated;
grant select on public.admin_settings to anon, authenticated;

notify pgrst, 'reload schema';

select 'zones' as check_name, count(*) as total from public.zones
union all
select 'cities', count(*) from public.cities
union all
select 'services', count(*) from public.services
union all
select 'international_rates', count(*) from public.international_rates
union all
select 'contact_channels', count(*) from public.contact_channels;
