-- DAY NIGHT DELIVERY SERVICES
-- Dynamic, auditable WhatsApp morning broadcasts for registered merchants.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.merchants
  add column if not exists whatsapp_broadcast_enabled boolean not null default true,
  add column if not exists whatsapp_broadcast_language text not null default 'ar';

update public.merchants
set whatsapp_broadcast_language = 'ar'
where lower(coalesce(whatsapp_broadcast_language, '')) not in ('ar', 'en');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchants_whatsapp_broadcast_language_valid'
      and conrelid = 'public.merchants'::regclass
  ) then
    alter table public.merchants
      add constraint merchants_whatsapp_broadcast_language_valid
      check (whatsapp_broadcast_language in ('ar', 'en')) not valid;
  end if;
end;
$$;

alter table public.merchants
  validate constraint merchants_whatsapp_broadcast_language_valid;

create table if not exists public.merchant_broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_date date not null default current_date,
  template_key text not null default 'merchant_orders_today',
  provider_template_name text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status text not null default 'preparing'
    check (status in ('preparing', 'sending', 'completed', 'partial', 'failed')),
  requested_count integer not null default 0 check (requested_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  force_resend boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.merchant_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.merchant_broadcast_campaigns(id) on delete cascade,
  merchant_id uuid references public.merchants(id) on delete set null,
  merchant_name text not null,
  recipient_phone text not null,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  provider_error_code text,
  provider_error_message text,
  provider_response jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(campaign_id, merchant_id)
);

create index if not exists merchant_broadcast_campaigns_date_idx
  on public.merchant_broadcast_campaigns(campaign_date desc, created_at desc);
create index if not exists merchant_broadcast_recipients_merchant_idx
  on public.merchant_broadcast_recipients(merchant_id, updated_at desc);
create index if not exists merchant_broadcast_recipients_status_idx
  on public.merchant_broadcast_recipients(campaign_id, status);
create index if not exists merchants_whatsapp_broadcast_audience_idx
  on public.merchants(whatsapp_broadcast_enabled, status, created_at desc);

alter table public.merchant_broadcast_campaigns enable row level security;
alter table public.merchant_broadcast_recipients enable row level security;

create or replace function public.dn_merchant_broadcast_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support', 'owner', 'super_admin')
  );
$$;

revoke all on function public.dn_merchant_broadcast_admin() from public, anon;
grant execute on function public.dn_merchant_broadcast_admin() to authenticated;

drop policy if exists merchant_broadcast_campaigns_admin_read
  on public.merchant_broadcast_campaigns;
create policy merchant_broadcast_campaigns_admin_read
  on public.merchant_broadcast_campaigns
  for select
  to authenticated
  using (public.dn_merchant_broadcast_admin());

drop policy if exists merchant_broadcast_recipients_admin_read
  on public.merchant_broadcast_recipients;
create policy merchant_broadcast_recipients_admin_read
  on public.merchant_broadcast_recipients
  for select
  to authenticated
  using (public.dn_merchant_broadcast_admin());

revoke all on public.merchant_broadcast_campaigns from anon;
revoke all on public.merchant_broadcast_recipients from anon;
grant select on public.merchant_broadcast_campaigns to authenticated;
grant select on public.merchant_broadcast_recipients to authenticated;

-- Keep the existing central merchant_orders_today key, but make the production
-- database template personalized and operationally clearer.
insert into public.message_templates (
  template_key,
  audience,
  channel,
  language,
  title,
  body,
  is_active,
  updated_at
) values
(
  'merchant_orders_today',
  'merchant',
  'whatsapp',
  'ar',
  'رسالة طلبيات اليوم للتاجر',
  'السلام عليكم ورحمة الله وبركاته يا {merchant_name} 👋

صباح الخير من فريق داي نايت لخدمات التوصيل والشحن 💙

نحن جاهزون اليوم لاستلام وتوصيل طلباتكم بكل سرعة واهتمام. هل لديكم طلبيات جاهزة للاستلام اليوم؟ 📦🚚

يمكنكم تسجيل الطلبات مباشرة من خلال لوحة التاجر:
🏪 {merchant_portal_url}

أو الرد على هذه الرسالة بكلمة «نعم»، وسيتواصل معكم فريق العمليات فورًا لترتيب الاستلام.

عند إرسال الطلب يرجى توضيح:
• اسم العميل
• رقم الهاتف
• عنوان التوصيل
• المبلغ المطلوب تحصيله
• أي ملاحظات خاصة بالطلب

📞 الدعم: {support_phone}

نتمنى لكم يومًا موفقًا ومبيعات مباركة.
داي نايت لخدمات التوصيل والشحن
سريع • آمن • موثوق',
  true,
  now()
),
(
  'merchant_orders_today',
  'merchant',
  'whatsapp',
  'en',
  'Today''s orders merchant message',
  'Good morning {merchant_name} 👋

DAY NIGHT DELIVERY SERVICES is ready to collect and deliver your orders today with speed and care. Do you have shipments ready for pickup? 📦🚚

Create orders directly in the merchant portal:
🏪 {merchant_portal_url}

Or reply “Yes” and our operations team will contact you to arrange pickup.

Please include:
• Customer name
• Phone number
• Delivery address
• Collection amount
• Any special notes

📞 Support: {support_phone}

Wishing you a successful day.
DAY NIGHT DELIVERY SERVICES
Fast • Reliable • Every Time',
  true,
  now()
)
on conflict (template_key, language, channel)
do update set
  audience = excluded.audience,
  title = excluded.title,
  body = excluded.body,
  is_active = true,
  updated_at = now();

create or replace function public.merchant_morning_broadcast_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_all bigint := 0;
  v_eligible bigint := 0;
  v_missing_phone bigint := 0;
  v_sent_today bigint := 0;
begin
  if not public.dn_merchant_broadcast_admin() then
    raise exception 'not_authorized';
  end if;

  select
    count(*),
    count(*) filter (
      where coalesce(m.whatsapp_broadcast_enabled, true)
        and lower(coalesce(m.status, 'active')) not in
          ('deleted', 'archived', 'blocked', 'suspended', 'inactive', 'rejected', 'closed')
        and nullif(regexp_replace(coalesce(m.phone, ''), '[^0-9]+', '', 'g'), '') is not null
    ),
    count(*) filter (
      where coalesce(m.whatsapp_broadcast_enabled, true)
        and lower(coalesce(m.status, 'active')) not in
          ('deleted', 'archived', 'blocked', 'suspended', 'inactive', 'rejected', 'closed')
        and nullif(regexp_replace(coalesce(m.phone, ''), '[^0-9]+', '', 'g'), '') is null
    )
  into v_all, v_eligible, v_missing_phone
  from public.merchants m;

  select count(*)
  into v_sent_today
  from public.merchant_broadcast_recipients r
  join public.merchant_broadcast_campaigns c on c.id = r.campaign_id
  where c.campaign_date = current_date
    and c.template_key = 'merchant_orders_today'
    and r.status = 'sent';

  return jsonb_build_object(
    'ok', true,
    'tables_ready',
      to_regclass('public.merchant_broadcast_campaigns') is not null
      and to_regclass('public.merchant_broadcast_recipients') is not null,
    'merchant_columns_ready',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'merchants'
          and column_name = 'whatsapp_broadcast_enabled'
      ),
    'all_merchants', v_all,
    'eligible_merchants', v_eligible,
    'missing_phone', v_missing_phone,
    'sent_today', v_sent_today,
    'template_ready', exists (
      select 1 from public.message_templates
      where template_key = 'merchant_orders_today'
        and channel = 'whatsapp'
        and is_active
    ),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.merchant_morning_broadcast_health() from public, anon;
grant execute on function public.merchant_morning_broadcast_health() to authenticated;

notify pgrst, 'reload schema';

commit;
