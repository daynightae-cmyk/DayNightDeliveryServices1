-- DAY NIGHT DELIVERY SERVICES
-- Smart WhatsApp messaging, customer feedback, complaints, attachments, RLS and realtime.

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.dn_ce_try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if value is null or btrim(value) = '' then return null; end if;
  if value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return value::uuid;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.dn_ce_is_admin_or_support()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) in ('admin', 'support')
  );
$$;

create or replace function public.dn_ce_driver_for_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.orders o
    join public.driver_profiles d
      on d.id = coalesce(
        public.dn_ce_try_uuid(to_jsonb(o)->>'assigned_driver_id'),
        public.dn_ce_try_uuid(to_jsonb(o)->>'driver_id')
      )
    where o.id = p_order_id
      and d.user_id = auth.uid()
  );
$$;

create or replace function public.dn_ce_merchant_for_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.orders o
    join public.merchants m on m.id = o.merchant_id
    where o.id = p_order_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.dn_ce_customer_for_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and coalesce(to_jsonb(o)->>'customer_id', '') = auth.uid()::text
  );
$$;

create or replace function public.dn_ce_request_ip_hash()
returns text
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      coalesce(
        nullif((coalesce(current_setting('request.headers', true), '{}')::jsonb)->>'x-forwarded-for', ''),
        nullif((coalesce(current_setting('request.headers', true), '{}')::jsonb)->>'cf-connecting-ip', ''),
        'unknown'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create table if not exists public.customer_experience_settings (
  id boolean primary key default true check (id),
  support_whatsapp text not null default '971568757331',
  tracking_base_url text not null default 'https://www.daynightae.com/tracking',
  website_url text not null default 'https://www.daynightae.com',
  feedback_expiry_days integer not null default 30 check (feedback_expiry_days between 1 and 365),
  feedback_enabled boolean not null default true,
  complaint_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.customer_experience_settings(id)
values (true)
on conflict (id) do nothing;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  audience text not null check (audience in ('customer','merchant','driver','support','admin')),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  language text not null check (language in ('ar','en')),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique(template_key, language, channel)
);

create table if not exists public.outbound_message_logs (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  channel text not null default 'whatsapp',
  recipient_type text not null,
  recipient_id uuid,
  recipient_phone text not null,
  order_id uuid references public.orders(id) on delete set null,
  merchant_id uuid references public.merchants(id) on delete set null,
  driver_id uuid references public.driver_profiles(id) on delete set null,
  generated_message text not null,
  generated_url text not null,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  opened_at timestamptz,
  status text not null default 'generated' check (status in ('generated','opened','copied','failed')),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.feedback_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  tracking_number text not null,
  customer_id uuid,
  merchant_id uuid references public.merchants(id) on delete set null,
  driver_id uuid references public.driver_profiles(id) on delete set null,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  driver_rating smallint not null check (driver_rating between 1 and 5),
  company_rating smallint not null check (company_rating between 1 and 5),
  punctuality_rating smallint check (punctuality_rating between 1 and 5),
  communication_rating smallint check (communication_rating between 1 and 5),
  professionalism_rating smallint check (professionalism_rating between 1 and 5),
  package_care_rating smallint check (package_care_rating between 1 and 5),
  tracking_experience_rating smallint check (tracking_experience_rating between 1 and 5),
  selected_tags text[] not null default '{}',
  comment text,
  allow_public_display boolean not null default false,
  request_contact boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'feedback_token',
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  unique(order_id)
);

create sequence if not exists public.dn_complaint_number_seq start 1;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  tracking_number text not null,
  complainant_type text not null check (complainant_type in ('customer','merchant')),
  complainant_id uuid,
  customer_id uuid,
  merchant_id uuid references public.merchants(id) on delete set null,
  driver_id uuid references public.driver_profiles(id) on delete set null,
  category text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  description text not null,
  status text not null default 'new' check (status in ('new','under_review','waiting_customer','waiting_driver','waiting_merchant','escalated','resolved','closed','rejected')),
  assigned_to uuid references auth.users(id) on delete set null,
  request_contact boolean not null default false,
  preferred_contact_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 8388608),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.order_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid references public.driver_profiles(id) on delete set null,
  attempt_type text not null,
  result text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists outbound_message_logs_order_idx on public.outbound_message_logs(order_id, generated_at desc);
create index if not exists outbound_message_logs_status_idx on public.outbound_message_logs(status, generated_at desc);
create index if not exists feedback_tokens_lookup_idx on public.feedback_tokens(token_hash) where is_active;
create index if not exists order_feedback_driver_idx on public.order_feedback(driver_id, submitted_at desc);
create index if not exists order_feedback_merchant_idx on public.order_feedback(merchant_id, submitted_at desc);
create index if not exists complaints_priority_idx on public.complaints(severity desc, status, created_at desc);
create index if not exists complaints_order_idx on public.complaints(order_id, created_at desc);
create index if not exists complaint_events_complaint_idx on public.complaint_events(complaint_id, created_at);
create index if not exists contact_attempts_order_idx on public.order_contact_attempts(order_id, created_at desc);

create or replace function public.dn_ce_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dn_ce_touch_settings on public.customer_experience_settings;
create trigger dn_ce_touch_settings before update on public.customer_experience_settings
for each row execute function public.dn_ce_touch_updated_at();

drop trigger if exists dn_ce_touch_templates on public.message_templates;
create trigger dn_ce_touch_templates before update on public.message_templates
for each row execute function public.dn_ce_touch_updated_at();

drop trigger if exists dn_ce_touch_feedback on public.order_feedback;
create trigger dn_ce_touch_feedback before update on public.order_feedback
for each row execute function public.dn_ce_touch_updated_at();

drop trigger if exists dn_ce_touch_complaints on public.complaints;
create trigger dn_ce_touch_complaints before update on public.complaints
for each row execute function public.dn_ce_touch_updated_at();

-- Seed editable templates. Frontend defaults remain a safe fallback if templates are disabled or unavailable.
insert into public.message_templates(template_key,audience,channel,language,title,body)
values
('driver_on_the_way','customer','whatsapp','ar','Ø£Ù†Ø§ ÙÙŠ Ø§Ù„Ø·Ø±ÙŠÙ‚',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… Ø£/ {customer_name} ðŸ‘‹

Ù…Ø¹ Ø­Ø¶Ø±ØªÙƒ {driver_name}ØŒ Ù…Ù†Ø¯ÙˆØ¨ Ø´Ø±ÙƒØ© Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù†.

ðŸšš Ø£Ù†Ø§ Ø§Ù„Ø¢Ù† ÙÙŠ Ø§Ù„Ø·Ø±ÙŠÙ‚ Ø¥Ù„ÙŠÙƒÙ… Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø´Ø­Ù†Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©:

ðŸ“¦ Ø±Ù‚Ù… Ø§Ù„Ø´Ø­Ù†Ø©: {tracking_number}
{amount_due_line}
{payment_line}

ðŸ“ ÙŠØ±Ø¬Ù‰ Ø¥Ø±Ø³Ø§Ù„ Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø­Ø§Ù„ÙŠ Ù…Ù† Ø®Ù„Ø§Ù„ Ø®Ø§ØµÙŠØ© Ù…Ø´Ø§Ø±ÙƒØ© Ø§Ù„Ù…ÙˆÙ‚Ø¹ ÙÙŠ ÙˆØ§ØªØ³Ø§Ø¨ØŒ Ù…Ø¹ Ø§Ù„ØªØ£ÙƒØ¯ Ù…Ù† ÙˆØ¬ÙˆØ¯ Ø´Ø®Øµ Ù…ØªØ§Ø­ Ù„Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø´Ø­Ù†Ø©.

ðŸ”Ž Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ø´Ø­Ù†Ø©:
{tracking_url}

â­ Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆØ§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª:
{feedback_url}

Ø´ÙƒØ±Ù‹Ø§ Ù„Ø§Ø®ØªÙŠØ§Ø±ÙƒÙ… Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª.
Ø³Ø±ÙŠØ¹ â€¢ Ø¢Ù…Ù† â€¢ Ù…ÙˆØ«ÙˆÙ‚$body$),
('driver_on_the_way','customer','whatsapp','en','Driver on the way',$body$Hello {customer_name} ðŸ‘‹

This is {driver_name}, your DAY NIGHT DELIVERY SERVICES driver.

ðŸšš I am on the way with shipment {tracking_number}.
{amount_due_line}
{payment_line}

Please share your current WhatsApp location.

Tracking: {tracking_url}
Feedback: {feedback_url}

Fast â€¢ Reliable â€¢ Every Time$body$),
('driver_request_location','customer','whatsapp','ar','Ø·Ù„Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…ÙˆÙ‚Ø¹',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… Ø£/ {customer_name} ðŸ‘‹

Ù…Ø¹ Ø­Ø¶Ø±ØªÙƒ {driver_name}ØŒ Ù…Ù†Ø¯ÙˆØ¨ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª.

ðŸ“¦ Ø§Ù„Ø´Ø­Ù†Ø©: {tracking_number}

ÙŠØ±Ø¬Ù‰ Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ Ø¹Ù„Ø§Ù…Ø© Ø§Ù„Ù…Ø´Ø¨Ùƒ ÙÙŠ ÙˆØ§ØªØ³Ø§Ø¨ Ø«Ù… Ø§Ø®ØªÙŠØ§Ø±: Ø§Ù„Ù…ÙˆÙ‚Ø¹ â† Ø¥Ø±Ø³Ø§Ù„ Ù…ÙˆÙ‚Ø¹Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ.

ðŸ”Ž {tracking_url}

Ø´ÙƒØ±Ù‹Ø§ Ù„ØªØ¹Ø§ÙˆÙ†ÙƒÙ….$body$),
('driver_request_location','customer','whatsapp','en','Request location',$body$Hello {customer_name}. This is {driver_name}, your DAY NIGHT driver.

Shipment: {tracking_number}
Please use WhatsApp attachment â†’ Location â†’ Send current location.

Tracking: {tracking_url}$body$),
('driver_arrived','customer','whatsapp','ar','ÙˆØµÙ„Øª Ø¥Ù„Ù‰ Ø§Ù„Ù…ÙˆÙ‚Ø¹',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… Ø£/ {customer_name}

ÙˆØµÙ„ Ù…Ù†Ø¯ÙˆØ¨ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø¥Ù„Ù‰ Ù…ÙˆÙ‚Ø¹ Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø¢Ù† ðŸššðŸ“

ðŸ“¦ Ø±Ù‚Ù… Ø§Ù„Ø´Ø­Ù†Ø©: {tracking_number}
{amount_due_line}

ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªÙˆØ¬Ù‡ Ù„Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø´Ø­Ù†Ø© Ø£Ùˆ Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨.

ðŸ”Ž {tracking_url}$body$),
('driver_arrived','customer','whatsapp','en','Driver arrived',$body$Hello {customer_name}. Your DAY NIGHT driver has arrived ðŸššðŸ“

Tracking: {tracking_number}
{amount_due_line}

Please proceed to receive the shipment.
{tracking_url}$body$),
('driver_unreachable','customer','whatsapp','ar','ØªØ¹Ø°Ø± Ø§Ù„ØªÙˆØ§ØµÙ„',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… Ø£/ {customer_name}

Ø­Ø§ÙˆÙ„ Ù…Ù†Ø¯ÙˆØ¨ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„ÙŠÙƒÙ… Ø¨Ø®ØµÙˆØµ Ø§Ù„Ø´Ø­Ù†Ø© {tracking_number}ØŒ ÙˆÙ„ÙƒÙ† ØªØ¹Ø°Ø± Ø§Ù„ØªÙˆØ§ØµÙ„ Ø£Ùˆ ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…ÙˆÙ‚Ø¹.

ÙŠØ±Ø¬Ù‰ Ø§Ù„Ø±Ø¯ ÙˆØ¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„ØµØ­ÙŠØ­.

ðŸ”Ž {tracking_url}
ðŸ“ž {support_phone}$body$),
('driver_unreachable','customer','whatsapp','en','Unable to contact customer',$body$Hello {customer_name}. We could not reach you regarding shipment {tracking_number}.
Please reply with the correct location.

Tracking: {tracking_url}
Support: {support_phone}$body$),
('driver_delivered_feedback','customer','whatsapp','ar','ØªÙ… Ø§Ù„ØªØ³Ù„ÙŠÙ… â€“ Ø·Ù„Ø¨ ØªÙ‚ÙŠÙŠÙ…',$body$ØªÙ… ØªØ³Ù„ÙŠÙ… Ø´Ø­Ù†ØªÙƒÙ… Ø¨Ù†Ø¬Ø§Ø­ âœ…ðŸ“¦

ðŸ“¦ Ø±Ù‚Ù… Ø§Ù„Ø´Ø­Ù†Ø©: {tracking_number}

â­ Ù‚ÙŠÙ‘Ù…ÙˆØ§ ØªØ¬Ø±Ø¨Ø© Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ù…Ù†Ø¯ÙˆØ¨ Ù…Ù† Ù‡Ù†Ø§:
{feedback_url}

ÙŠÙ…ÙƒÙ† ØªÙ‚Ø¯ÙŠÙ… Ø´ÙƒÙˆÙ‰ Ø£Ùˆ Ù…Ù„Ø§Ø­Ø¸Ø© Ù…Ù† Ù†ÙØ³ Ø§Ù„ØµÙØ­Ø©.

Ø´ÙƒØ±Ù‹Ø§ Ù„Ø«Ù‚ØªÙƒÙ… Ø¨Ù†Ø§ ðŸ’™
DAY NIGHT DELIVERY SERVICES
Fast â€¢ Reliable â€¢ Every Time$body$),
('driver_delivered_feedback','customer','whatsapp','en','Delivered â€“ request feedback',$body$Your shipment was delivered successfully âœ…ðŸ“¦
Tracking: {tracking_number}

Rate the service and driver:
{feedback_url}

You can also submit a complaint from the same page.
DAY NIGHT DELIVERY SERVICES$body$),
('merchant_welcome','merchant','whatsapp','ar','ØªØ±Ø­ÙŠØ¨ Ø§Ù„ØªØ§Ø¬Ø±',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… ÙˆØ±Ø­Ù…Ø© Ø§Ù„Ù„Ù‡ ÙˆØ¨Ø±ÙƒØ§ØªÙ‡ ðŸ‘‹

ÙŠØ³Ø¹Ø¯Ù†Ø§ Ø§Ù„ØªØ±Ø­ÙŠØ¨ Ø¨ÙƒÙ… Ø¶Ù…Ù† Ø´Ø±ÙƒØ§Ø¡ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ§Ù„Ø´Ø­Ù†.

ðŸšš ØªÙˆØµÙŠÙ„ Ø¯Ø§Ø®Ù„ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª
âœ… COD
âœ… ØªØªØ¨Ø¹ ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª
âœ… Ø¯Ø¹Ù… Ù…Ø³ØªÙ…Ø±
âœ… Ø­Ù„ÙˆÙ„ Ø§Ù„ØªØ¬Ø§Ø±Ø© Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© ÙˆØ§Ù„Ø´Ø­Ù† Ø§Ù„Ù…Ø­Ù„ÙŠ ÙˆØ§Ù„Ø¯ÙˆÙ„ÙŠ

ðŸŒ {company_website}
ðŸ“¦ {tracking_url}
ðŸª {merchant_portal_url}
ðŸ“ž {support_phone}
âœ‰ï¸ {company_email}
â­ {feedback_url}

Ù†Ø´ÙƒØ± Ø«Ù‚ØªÙƒÙ… ÙˆÙ†Ø³Ø¹Ø¯ Ø¨ØªØ¹Ø§ÙˆÙ† Ù†Ø§Ø¬Ø­ ÙˆÙ…Ø³ØªÙ…Ø±.$body$),
('merchant_welcome','merchant','whatsapp','en','Merchant welcome',$body$Welcome {merchant_name} to DAY NIGHT DELIVERY SERVICES.

Website: {company_website}
Tracking: {tracking_url}
Merchant portal: {merchant_portal_url}
Support: {support_phone}
Email: {company_email}
Feedback: {feedback_url}

Fast â€¢ Reliable â€¢ Every Time$body$),
('merchant_orders_today','merchant','whatsapp','ar','Ø§Ù„Ø§Ø³ØªÙØ³Ø§Ø± Ø¹Ù† Ø·Ù„Ø¨Ø§Øª Ø§Ù„ÙŠÙˆÙ…',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… ÙˆØ±Ø­Ù…Ø© Ø§Ù„Ù„Ù‡ ÙˆØ¨Ø±ÙƒØ§ØªÙ‡ ðŸ‘‹

Ù‡Ù„ ØªÙˆØ¬Ø¯ Ù„Ø¯ÙŠÙƒÙ… Ø·Ù„Ø¨Ø§Øª Ø¬Ø§Ù‡Ø²Ø© Ù„Ù„Ø§Ø³ØªÙ„Ø§Ù… ÙˆØ§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„ÙŠÙˆÙ…ØŸ ðŸ“¦ðŸšš

ðŸª Ù„ÙˆØ­Ø© Ø§Ù„ØªØ§Ø¬Ø±:
{merchant_portal_url}

ÙŠÙ…ÙƒÙ†ÙƒÙ… Ø£ÙŠØ¶Ù‹Ø§ Ø¥Ø±Ø³Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ø¹Ù…ÙŠÙ„ ÙˆØ±Ù‚Ù…Ù‡ ÙˆØ¹Ù†ÙˆØ§Ù†Ù‡ ÙˆØ§Ù„Ù…Ø¨Ù„Øº ÙˆØ§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨.

ðŸ“ž {support_phone}$body$),
('merchant_orders_today','merchant','whatsapp','en','Today orders inquiry',$body$Hello. Do you have orders ready for pickup and delivery today? ðŸ“¦ðŸšš

Merchant portal: {merchant_portal_url}
Support: {support_phone}$body$),
('merchant_order_received','merchant','whatsapp','ar','ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø·Ù„Ø¨ Ø¬Ø¯ÙŠØ¯',$body$ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø·Ù„Ø¨ Ø¬Ø¯ÙŠØ¯ âœ…
ðŸ“¦ {tracking_number}
ðŸ‘¤ {customer_name}
ðŸ“ {customer_city}
{amount_due_line}
ðŸ“‹ {order_status}

ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨: {merchant_order_url}
Ø§Ù„ØªØªØ¨Ø¹: {tracking_url}$body$),
('merchant_order_received','merchant','whatsapp','en','New order received',$body$New order registered âœ…
Tracking: {tracking_number}
Customer: {customer_name}
City: {customer_city}
{amount_due_line}
Status: {order_status}

Order: {merchant_order_url}
Tracking: {tracking_url}$body$),
('merchant_driver_assigned','merchant','whatsapp','ar','ØªÙ… ØªØ¹ÙŠÙŠÙ† Ù…Ù†Ø¯ÙˆØ¨',$body$ØªÙ… ØªØ¹ÙŠÙŠÙ† Ù…Ù†Ø¯ÙˆØ¨ Ù„Ù„Ø´Ø­Ù†Ø© ðŸšš
ðŸ“¦ {tracking_number}
ðŸ‘¤ {driver_name}
ðŸ“‹ {order_status}
ðŸ”Ž {tracking_url}$body$),
('merchant_driver_assigned','merchant','whatsapp','en','Driver assigned',$body$A driver was assigned ðŸšš
Tracking: {tracking_number}
Driver: {driver_name}
Status: {order_status}
{tracking_url}$body$),
('merchant_shipment_collected','merchant','whatsapp','ar','ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø´Ø­Ù†Ø©',$body$ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø´Ø­Ù†Ø© Ù…Ù†ÙƒÙ… Ø¨Ù†Ø¬Ø§Ø­ âœ…ðŸ“¦
ðŸ“¦ {tracking_number}
ðŸ‘¤ {driver_name}
ðŸ•’ {pickup_time}

Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©: Ø§Ù„ØªÙˆØ¬Ù‡ Ø¥Ù„Ù‰ Ø§Ù„Ø¹Ù…ÙŠÙ„.
{tracking_url}$body$),
('merchant_shipment_collected','merchant','whatsapp','en','Shipment collected',$body$Shipment collected successfully âœ…ðŸ“¦
Tracking: {tracking_number}
Driver: {driver_name}
Pickup time: {pickup_time}
Next: customer delivery.
{tracking_url}$body$),
('merchant_delivered','merchant','whatsapp','ar','ØªÙ… ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø´Ø­Ù†Ø©',$body$ØªÙ… ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø´Ø­Ù†Ø© Ø¨Ù†Ø¬Ø§Ø­ âœ…ðŸ“¦
ðŸ“¦ {tracking_number}
{amount_due_line}
ðŸ•’ {delivery_time}
ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨: {merchant_order_url}
Ø§Ù„ØªÙ‚ÙŠÙŠÙ…: {feedback_url}$body$),
('merchant_delivered','merchant','whatsapp','en','Shipment delivered',$body$Shipment delivered successfully âœ…ðŸ“¦
Tracking: {tracking_number}
{amount_due_line}
Delivery time: {delivery_time}
Order: {merchant_order_url}
Feedback: {feedback_url}$body$),
('merchant_delivery_failed','merchant','whatsapp','ar','ØªØ¹Ø°Ø± Ø§Ù„ØªØ³Ù„ÙŠÙ…',$body$ØªØ¹Ø°Ø± ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø´Ø­Ù†Ø© âš ï¸
ðŸ“¦ {tracking_number}
ðŸ‘¤ {driver_name}
ðŸ•’ {delivery_time}
ðŸ“‹ {failure_reason}
ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨: {merchant_order_url}$body$),
('merchant_delivery_failed','merchant','whatsapp','en','Delivery failed',$body$Delivery failed âš ï¸
Tracking: {tracking_number}
Driver: {driver_name}
Time: {delivery_time}
Reason: {failure_reason}
Order: {merchant_order_url}$body$),
('merchant_settlement','merchant','whatsapp','ar','Ø¥Ø´Ø¹Ø§Ø± Ø§Ù„ØªØ³ÙˆÙŠØ© Ø§Ù„Ù…Ø§Ù„ÙŠØ©',$body$Ø¥Ø´Ø¹Ø§Ø± ØªØ³ÙˆÙŠØ© Ù…Ø§Ù„ÙŠØ© ðŸ’³
ðŸª {merchant_name}
ðŸ“… {settlement_period}
ðŸ“¦ {order_count}
ðŸ’° {gross_collected} Ø¯Ø±Ù‡Ù…
ðŸ§¾ {fees} Ø¯Ø±Ù‡Ù…
âœ… {net_due} Ø¯Ø±Ù‡Ù…

{statement_url}$body$),
('merchant_settlement','merchant','whatsapp','en','Settlement notice',$body$Financial settlement ðŸ’³
Merchant: {merchant_name}
Period: {settlement_period}
Orders: {order_count}
Gross: {gross_collected} AED
Fees: {fees} AED
Net: {net_due} AED
{statement_url}$body$),
('tracking_support','support','whatsapp','ar','Ù…Ø³Ø§Ø¹Ø¯Ø© Ø§Ù„ØªØªØ¨Ø¹',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ø£Ø­ØªØ§Ø¬ Ù…Ø³Ø§Ø¹Ø¯Ø© Ø¨Ø®ØµÙˆØµ ØªØªØ¨Ø¹ Ø§Ù„Ø´Ø­Ù†Ø© Ø±Ù‚Ù…:
{tracking_number}

Ø±Ø§Ø¨Ø· Ø§Ù„ØªØªØ¨Ø¹:
{tracking_url}$body$),
('tracking_support','support','whatsapp','en','Tracking support',$body$Hello, I need help tracking shipment {tracking_number}.
{tracking_url}$body$),
('cod_service','support','whatsapp','ar','Ø§Ø³ØªÙØ³Ø§Ø± COD',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ø£Ø±ØºØ¨ ÙÙŠ Ù…Ø¹Ø±ÙØ© ØªÙØ§ØµÙŠÙ„ Ø®Ø¯Ù…Ø© Ø§Ù„Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… COD Ø§Ù„Ù…Ù‚Ø¯Ù…Ø© Ù…Ù† Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª.$body$),
('cod_service','support','whatsapp','en','COD inquiry',$body$Hello, I would like information about DAY NIGHT cash on delivery service.$body$),
('merchant_registration','support','whatsapp','ar','ØªØ³Ø¬ÙŠÙ„ ØªØ§Ø¬Ø±',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ø£Ø±ØºØ¨ ÙÙŠ Ø§Ù„ØªØ³Ø¬ÙŠÙ„ ÙƒØªØ§Ø¬Ø± Ø¬Ø¯ÙŠØ¯ Ù…Ø¹ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª.

Ø§Ø³Ù… Ø§Ù„Ù†Ø´Ø§Ø·:
Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©:
Ø¹Ø¯Ø¯ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…ØªÙˆÙ‚Ø¹:$body$),
('merchant_registration','support','whatsapp','en','Merchant registration',$body$Hello, I would like to register as a DAY NIGHT merchant.

Business name:
City:
Expected orders:$body$),
('complaint_support','support','whatsapp','ar','Ù…ØªØ§Ø¨Ø¹Ø© Ø´ÙƒÙˆÙ‰',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ù„Ø¯ÙŠ Ø§Ø³ØªÙØ³Ø§Ø± Ø¨Ø®ØµÙˆØµ Ø§Ù„Ø´ÙƒÙˆÙ‰ Ø±Ù‚Ù…:
{complaint_number}$body$),
('complaint_support','support','whatsapp','en','Complaint support',$body$Hello, I have a question about complaint {complaint_number}.$body$),
('admin_order_contact','customer','whatsapp','ar','ØªÙˆØ§ØµÙ„ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ù†ØªÙˆØ§ØµÙ„ Ù…Ø¹ÙƒÙ… Ù…Ù† Ø¥Ø¯Ø§Ø±Ø© Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø¨Ø®ØµÙˆØµ Ø§Ù„Ø´Ø­Ù†Ø© Ø±Ù‚Ù…:
{tracking_number}

Ø§Ù„Ø­Ø§Ù„Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©:
{order_status}

{tracking_url}$body$),
('admin_order_contact','customer','whatsapp','en','Admin order contact',$body$Hello, DAY NIGHT management is contacting you regarding shipment {tracking_number}.
Status: {order_status}
{tracking_url}$body$),
('generic_support','support','whatsapp','ar','ØªÙˆØ§ØµÙ„ Ø¹Ø§Ù…',$body$Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…ØŒ Ø£Ø­ØªØ§Ø¬ Ù…Ø³Ø§Ø¹Ø¯Ø© Ù…Ù† ÙØ±ÙŠÙ‚ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø¨Ø®ØµÙˆØµ Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©:
{company_website}$body$),
('generic_support','support','whatsapp','en','General support',$body$Hello, I need help from DAY NIGHT regarding this page:
{company_website}$body$)
on conflict (template_key, language, channel) do nothing;

create or replace function public.dn_ce_tracking_reference(p_order public.orders)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    to_jsonb(p_order)->>'tracking_number',
    to_jsonb(p_order)->>'tracking_code',
    to_jsonb(p_order)->>'invoice_number',
    to_jsonb(p_order)->>'coupon_number',
    p_order.id::text
  );
$$;

create or replace function public.dn_ce_mask_phone(value text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(value,''), '\D', '', 'g')) < 7 then '***'
    else left(regexp_replace(value, '\D', '', 'g'), 3) || '****' || right(regexp_replace(value, '\D', '', 'g'), 3)
  end;
$$;

create or replace function public.dn_ce_audit(p_entity_type text, p_action text, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if to_regclass('public.admin_audit_events') is not null then
    insert into public.admin_audit_events(entity_type, action, metadata, actor_id)
    values (p_entity_type, p_action, coalesce(p_metadata, '{}'::jsonb), auth.uid());
  end if;
exception when others then
  raise notice 'Customer experience audit skipped: %', sqlerrm;
end;
$$;

create or replace function public.dn_ce_notify_admins(
  p_title text,
  p_message text,
  p_type text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user record;
begin
  for v_user in
    select p.id
    from public.profiles p
    where lower(coalesce(p.role::text,'')) in ('admin','support')
  loop
    if to_regprocedure('public.portal_insert_notification(uuid,text,text,text,jsonb)') is not null then
      perform public.portal_insert_notification(v_user.id, p_title, p_message, p_type, p_metadata);
    else
      insert into public.notifications(user_id,title,message,type,metadata)
      values (v_user.id,p_title,p_message,p_type,p_metadata);
    end if;
  end loop;
exception when others then
  raise notice 'Admin notification skipped: %', sqlerrm;
end;
$$;

create or replace function public.create_feedback_token_for_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_token text;
  v_days integer := 30;
  v_enabled boolean := true;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  if not (
    public.dn_ce_is_admin_or_support()
    or public.dn_ce_driver_for_order(p_order_id)
    or public.dn_ce_merchant_for_order(p_order_id)
    or public.dn_ce_customer_for_order(p_order_id)
  ) then raise exception 'not_authorized'; end if;

  select feedback_expiry_days, feedback_enabled into v_days, v_enabled
  from public.customer_experience_settings where id = true;
  if not coalesce(v_enabled, true) then raise exception 'feedback_disabled'; end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.feedback_tokens(order_id, token_hash, expires_at)
  values (p_order_id, extensions.digest(v_token, 'sha256'), now() + make_interval(days => coalesce(v_days,30)));

  perform public.dn_ce_audit('feedback_token','create',jsonb_build_object('order_id',p_order_id));
  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'url', 'https://www.daynightae.com/feedback/' || v_token,
    'expires_at', now() + make_interval(days => coalesce(v_days,30))
  );
end;
$$;

create or replace function public.get_feedback_context(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_token public.feedback_tokens%rowtype;
  v_merchant public.merchants%rowtype;
  v_driver public.driver_profiles%rowtype;
  v_driver_id uuid;
  v_status text;
  v_existing boolean;
begin
  select * into v_token
  from public.feedback_tokens
  where token_hash = extensions.digest(coalesce(p_token,''), 'sha256')
    and is_active = true
    and expires_at > now()
  order by created_at desc
  limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;

  select * into v_order from public.orders where id = v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;
  v_status := lower(coalesce(to_jsonb(v_order)->>'status',''));
  if v_status not in ('delivered','completed') then raise exception 'feedback_only_after_delivery'; end if;

  if v_order.merchant_id is not null then select * into v_merchant from public.merchants where id = v_order.merchant_id; end if;
  v_driver_id := coalesce(
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'),
    public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id')
  );
  if v_driver_id is not null then select * into v_driver from public.driver_profiles where id = v_driver_id; end if;
  select exists(select 1 from public.order_feedback f where f.order_id = v_order.id) into v_existing;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'tracking_number', public.dn_ce_tracking_reference(v_order),
    'delivered_at', coalesce(to_jsonb(v_order)->>'delivered_at', to_jsonb(v_order)->>'updated_at'),
    'service_type', to_jsonb(v_order)->>'service_type',
    'driver_id', v_driver_id,
    'driver_name', coalesce(to_jsonb(v_order)->>'driver_name', to_jsonb(v_driver)->>'full_name', to_jsonb(v_driver)->>'name', 'Ù…Ù†Ø¯ÙˆØ¨ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª'),
    'merchant_id', v_order.merchant_id,
    'merchant_name', coalesce(to_jsonb(v_merchant)->>'trade_name',''),
    'customer_name', coalesce(to_jsonb(v_order)->>'receiver_name',to_jsonb(v_order)->>'customer_name','Ø¹Ù…ÙŠÙ„ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª'),
    'masked_phone', public.dn_ce_mask_phone(coalesce(to_jsonb(v_order)->>'receiver_phone',to_jsonb(v_order)->>'customer_phone','')),
    'locale', coalesce(to_jsonb(v_order)->>'preferred_language','ar'),
    'already_submitted', v_existing,
    'expires_at', v_token.expires_at
  );
end;
$$;

create or replace function public.submit_order_feedback(
  p_token text,
  p_overall_rating integer,
  p_driver_rating integer,
  p_company_rating integer,
  p_punctuality_rating integer,
  p_communication_rating integer,
  p_professionalism_rating integer,
  p_package_care_rating integer,
  p_tracking_experience_rating integer,
  p_selected_tags text[],
  p_comment text,
  p_allow_public_display boolean,
  p_request_contact boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_token public.feedback_tokens%rowtype;
  v_order public.orders%rowtype;
  v_feedback_id uuid;
  v_driver_id uuid;
  v_tracking text;
  v_status text;
  v_comment text := nullif(btrim(coalesce(p_comment,'')), '');
begin
  if p_overall_rating not between 1 and 5 or p_driver_rating not between 1 and 5 or p_company_rating not between 1 and 5 then
    raise exception 'rating_out_of_range';
  end if;
  if length(coalesce(v_comment,'')) > 2000 then raise exception 'comment_too_long'; end if;

  select * into v_token
  from public.feedback_tokens
  where token_hash = extensions.digest(coalesce(p_token,''),'sha256') and is_active and expires_at > now()
  order by created_at desc limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;

  select * into v_order from public.orders where id = v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;
  v_status := lower(coalesce(to_jsonb(v_order)->>'status',''));
  if v_status not in ('delivered','completed') then raise exception 'feedback_only_after_delivery'; end if;
  v_tracking := public.dn_ce_tracking_reference(v_order);
  v_driver_id := coalesce(public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'), public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id'));

  insert into public.order_feedback(
    order_id,tracking_number,customer_id,merchant_id,driver_id,
    overall_rating,driver_rating,company_rating,punctuality_rating,communication_rating,
    professionalism_rating,package_care_rating,tracking_experience_rating,selected_tags,
    comment,allow_public_display,request_contact,source,ip_hash,metadata
  ) values (
    v_order.id,v_tracking,public.dn_ce_try_uuid(to_jsonb(v_order)->>'customer_id'),v_order.merchant_id,v_driver_id,
    p_overall_rating,p_driver_rating,p_company_rating,p_punctuality_rating,p_communication_rating,
    p_professionalism_rating,p_package_care_rating,p_tracking_experience_rating,coalesce(p_selected_tags,'{}'),
    v_comment,coalesce(p_allow_public_display,false),coalesce(p_request_contact,false),'feedback_token',public.dn_ce_request_ip_hash(),
    jsonb_build_object('token_id',v_token.id,'user_agent',(coalesce(current_setting('request.headers',true),'{}')::jsonb)->>'user-agent')
  )
  on conflict (order_id) do update set
    overall_rating=excluded.overall_rating,
    driver_rating=excluded.driver_rating,
    company_rating=excluded.company_rating,
    punctuality_rating=excluded.punctuality_rating,
    communication_rating=excluded.communication_rating,
    professionalism_rating=excluded.professionalism_rating,
    package_care_rating=excluded.package_care_rating,
    tracking_experience_rating=excluded.tracking_experience_rating,
    selected_tags=excluded.selected_tags,
    comment=excluded.comment,
    allow_public_display=excluded.allow_public_display,
    request_contact=excluded.request_contact,
    updated_at=now(),
    ip_hash=excluded.ip_hash,
    metadata=public.order_feedback.metadata || excluded.metadata
  returning id into v_feedback_id;

  update public.feedback_tokens set used_at = coalesce(used_at,now()) where id = v_token.id;
  perform public.dn_ce_notify_admins(
    'ØªÙ‚ÙŠÙŠÙ… Ø¬Ø¯ÙŠØ¯ Ù„Ù„Ø´Ø­Ù†Ø© ' || v_tracking,
    'ÙˆØµÙ„ ØªÙ‚ÙŠÙŠÙ… Ø¬Ø¯ÙŠØ¯ Ø¨Ø¯Ø±Ø¬Ø© ' || p_overall_rating || ' Ù†Ø¬ÙˆÙ… Ù„Ù„Ø´Ø­Ù†Ø© ' || v_tracking || '.',
    'customer_feedback',
    jsonb_build_object('feedback_id',v_feedback_id,'order_id',v_order.id,'tracking_number',v_tracking,'rating',p_overall_rating,'route','/admin/customer-experience?tab=ratings')
  );
  perform public.dn_ce_audit('order_feedback','submit',jsonb_build_object('feedback_id',v_feedback_id,'order_id',v_order.id,'rating',p_overall_rating));
  return jsonb_build_object('ok',true,'feedback_id',v_feedback_id,'tracking_number',v_tracking);
end;
$$;

create or replace function public.submit_public_complaint(
  p_token text,
  p_category text,
  p_severity text,
  p_description text,
  p_preferred_contact_time text,
  p_request_contact boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_token public.feedback_tokens%rowtype;
  v_order public.orders%rowtype;
  v_id uuid;
  v_number text;
  v_upload_nonce text;
  v_driver_id uuid;
  v_tracking text;
  v_ip_hash text := public.dn_ce_request_ip_hash();
  v_description text := btrim(coalesce(p_description,''));
  v_category text := lower(btrim(coalesce(p_category,'')));
  v_severity text := lower(btrim(coalesce(p_severity,'medium')));
begin
  if v_category not in ('driver','delivery_delay','bad_behavior','incorrect_cod','damaged_shipment','lost_shipment','wrong_recipient','location_noncompliance','tracking_issue','merchant_issue','customer_service','other') then
    raise exception 'invalid_complaint_category';
  end if;
  if v_severity not in ('low','medium','high','critical') then raise exception 'invalid_complaint_severity'; end if;
  if length(v_description) < 10 then raise exception 'complaint_description_too_short'; end if;
  if length(v_description) > 4000 then raise exception 'complaint_description_too_long'; end if;

  select * into v_token from public.feedback_tokens
  where token_hash=extensions.digest(coalesce(p_token,''),'sha256') and is_active and expires_at>now()
  order by created_at desc limit 1;
  if not found then raise exception 'feedback_token_invalid_or_expired'; end if;
  select * into v_order from public.orders where id=v_token.order_id;
  if not found then raise exception 'order_not_found'; end if;

  if exists(
    select 1 from public.complaints c
    where c.order_id=v_order.id and c.ip_hash=v_ip_hash and c.category=v_category and c.created_at>now()-interval '60 seconds'
  ) then raise exception 'duplicate_complaint_rate_limited'; end if;

  v_tracking := public.dn_ce_tracking_reference(v_order);
  v_driver_id := coalesce(public.dn_ce_try_uuid(to_jsonb(v_order)->>'assigned_driver_id'), public.dn_ce_try_uuid(to_jsonb(v_order)->>'driver_id'));
  v_number := 'DN-CMP-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.dn_complaint_number_seq')::text,5,'0');
  v_upload_nonce := encode(gen_random_bytes(16),'hex');

  insert into public.complaints(
    complaint_number,order_id,tracking_number,complainant_type,complainant_id,customer_id,merchant_id,driver_id,
    category,severity,description,status,request_contact,preferred_contact_time,ip_hash,metadata
  ) values (
    v_number,v_order.id,v_tracking,'customer',public.dn_ce_try_uuid(to_jsonb(v_order)->>'customer_id'),public.dn_ce_try_uuid(to_jsonb(v_order)->>'customer_id'),
    v_order.merchant_id,v_driver_id,v_category,v_severity,v_description,'new',coalesce(p_request_contact,false),nullif(btrim(coalesce(p_preferred_contact_time,'')),''),v_ip_hash,
    jsonb_build_object('token_id',v_token.id,'upload_nonce',v_upload_nonce)
  ) returning id into v_id;

  insert into public.complaint_events(complaint_id,event_type,new_status,note,metadata)
  values(v_id,'created','new','Public complaint submitted',jsonb_build_object('severity',v_severity,'category',v_category));

  perform public.dn_ce_notify_admins(
    case when v_severity='critical' then 'Ø´ÙƒÙˆÙ‰ Ø­Ø±Ø¬Ø© Ø¬Ø¯ÙŠØ¯Ø©' else 'Ø´ÙƒÙˆÙ‰ Ø¬Ø¯ÙŠØ¯Ø©' end,
    case when v_severity='critical'
      then 'Ø´ÙƒÙˆÙ‰ Ø­Ø±Ø¬Ø© Ø¬Ø¯ÙŠØ¯Ø© Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ø´Ø­Ù†Ø© ' || v_tracking || ' ÙˆØªØ­ØªØ§Ø¬ Ø¥Ù„Ù‰ Ù…Ø±Ø§Ø¬Ø¹Ø© ÙÙˆØ±ÙŠØ©.'
      else 'ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø´ÙƒÙˆÙ‰ ' || v_number || ' Ù„Ù„Ø´Ø­Ù†Ø© ' || v_tracking || '.' end,
    case when v_severity='critical' then 'critical_complaint' else 'complaint' end,
    jsonb_build_object('complaint_id',v_id,'complaint_number',v_number,'order_id',v_order.id,'tracking_number',v_tracking,'severity',v_severity,'route','/admin/customer-experience?tab=complaints&complaint='||v_id)
  );
  perform public.dn_ce_audit('complaint','create',jsonb_build_object('complaint_id',v_id,'number',v_number,'severity',v_severity));

  return jsonb_build_object('ok',true,'id',v_id,'complaint_number',v_number,'upload_nonce',v_upload_nonce);
end;
$$;

create or replace function public.register_complaint_attachment(
  p_complaint_id uuid,
  p_upload_nonce text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'unsupported_attachment_type'; end if;
  if p_file_size <= 0 or p_file_size > 8388608 then raise exception 'attachment_too_large'; end if;
  if not exists(
    select 1 from public.complaints c
    where c.id=p_complaint_id
      and c.metadata->>'upload_nonce'=p_upload_nonce
      and c.created_at>now()-interval '30 minutes'
      and p_storage_path like c.id::text || '/' || p_upload_nonce || '/%'
  ) then raise exception 'attachment_upload_not_authorized'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='complaint-attachments' and o.name=p_storage_path) then
    raise exception 'attachment_object_missing';
  end if;

  insert into public.complaint_attachments(complaint_id,storage_path,file_name,mime_type,file_size)
  values(p_complaint_id,p_storage_path,left(coalesce(p_file_name,'attachment'),255),p_mime_type,p_file_size)
  returning id into v_id;
  insert into public.complaint_events(complaint_id,event_type,note,metadata)
  values(p_complaint_id,'attachment_added','Evidence uploaded',jsonb_build_object('attachment_id',v_id,'mime_type',p_mime_type));
  return jsonb_build_object('ok',true,'id',v_id);
end;
$$;

create or replace function public.log_outbound_message(
  p_template_key text,
  p_channel text,
  p_recipient_type text,
  p_recipient_id uuid,
  p_recipient_phone text,
  p_order_id uuid,
  p_merchant_id uuid,
  p_driver_id uuid,
  p_generated_message text,
  p_generated_url text,
  p_status text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_id uuid;
  v_phone text := regexp_replace(coalesce(p_recipient_phone,''),'\D','','g');
  v_message text := btrim(coalesce(p_generated_message,''));
  v_status text := lower(coalesce(p_status,'generated'));
  v_ip text := public.dn_ce_request_ip_hash();
begin
  if length(v_phone) not between 8 and 15 then raise exception 'invalid_whatsapp_phone'; end if;
  if v_message='' then raise exception 'empty_whatsapp_message'; end if;
  if length(v_message)>8000 then raise exception 'message_too_long'; end if;
  if position('text=' in coalesce(p_generated_url,''))=0 then raise exception 'whatsapp_url_without_text'; end if;
  if v_status not in ('generated','opened','copied','failed') then raise exception 'invalid_message_status'; end if;
  if (
    select count(*) from public.outbound_message_logs l
    where l.generated_at>now()-interval '10 minutes'
      and coalesce(l.metadata->>'ip_hash','')=v_ip
  ) >= 60 then raise exception 'message_generation_rate_limited'; end if;

  insert into public.outbound_message_logs(
    template_key,channel,recipient_type,recipient_id,recipient_phone,order_id,merchant_id,driver_id,
    generated_message,generated_url,generated_by,status,metadata
  ) values (
    btrim(p_template_key),coalesce(nullif(btrim(p_channel),''),'whatsapp'),btrim(p_recipient_type),p_recipient_id,v_phone,p_order_id,p_merchant_id,p_driver_id,
    v_message,p_generated_url,auth.uid(),v_status,coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('ip_hash',v_ip)
  ) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'status',v_status);
end;
$$;

create or replace function public.mark_outbound_message_status(p_log_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_status text := lower(coalesce(p_status,''));
  v_count integer;
begin
  if v_status not in ('generated','opened','copied','failed') then raise exception 'invalid_message_status'; end if;
  update public.outbound_message_logs
  set status=v_status,
      opened_at=case when v_status='opened' then coalesce(opened_at,now()) else opened_at end,
      metadata=metadata||jsonb_build_object('last_status_at',now())
  where id=p_log_id
    and (generated_by=auth.uid() or generated_by is null or public.dn_ce_is_admin_or_support());
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',v_count=1,'updated',v_count);
end;
$$;

create or replace function public.record_driver_contact_attempt(
  p_order_id uuid,
  p_attempt_type text,
  p_result text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_driver_id uuid;
  v_id uuid;
begin
  if not (public.dn_ce_is_admin_or_support() or public.dn_ce_driver_for_order(p_order_id)) then raise exception 'not_authorized'; end if;
  select coalesce(public.dn_ce_try_uuid(to_jsonb(o)->>'assigned_driver_id'),public.dn_ce_try_uuid(to_jsonb(o)->>'driver_id'))
  into v_driver_id from public.orders o where o.id=p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  insert into public.order_contact_attempts(order_id,driver_id,attempt_type,result,note,created_by)
  values(p_order_id,v_driver_id,left(btrim(coalesce(p_attempt_type,'contact')),80),left(btrim(coalesce(p_result,'unknown')),80),nullif(left(btrim(coalesce(p_note,'')),1000),''),auth.uid())
  returning id into v_id;
  perform public.dn_ce_audit('order_contact_attempt','create',jsonb_build_object('id',v_id,'order_id',p_order_id,'type',p_attempt_type,'result',p_result));
  return jsonb_build_object('ok',true,'id',v_id);
end;
$$;

create or replace function public.admin_update_complaint(
  p_complaint_id uuid,
  p_status text,
  p_severity text,
  p_assigned_to uuid,
  p_resolution text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_old public.complaints%rowtype;
  v_new public.complaints%rowtype;
  v_status text := nullif(lower(btrim(coalesce(p_status,''))), '');
  v_severity text := nullif(lower(btrim(coalesce(p_severity,''))), '');
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  select * into v_old from public.complaints where id=p_complaint_id for update;
  if not found then raise exception 'complaint_not_found'; end if;
  if v_status is not null and v_status not in ('new','under_review','waiting_customer','waiting_driver','waiting_merchant','escalated','resolved','closed','rejected') then raise exception 'invalid_complaint_status'; end if;
  if v_severity is not null and v_severity not in ('low','medium','high','critical') then raise exception 'invalid_complaint_severity'; end if;

  update public.complaints set
    status=coalesce(v_status,status),
    severity=coalesce(v_severity,severity),
    assigned_to=case when p_assigned_to is not null then p_assigned_to else assigned_to end,
    resolution=case when p_resolution is not null then nullif(btrim(p_resolution),'') else resolution end,
    resolved_at=case when coalesce(v_status,status) in ('resolved','closed') then coalesce(resolved_at,now()) else null end
  where id=p_complaint_id
  returning * into v_new;

  insert into public.complaint_events(complaint_id,event_type,old_status,new_status,note,created_by,metadata)
  values(
    p_complaint_id,
    case when v_old.status is distinct from v_new.status then 'status_changed' else 'admin_updated' end,
    v_old.status,v_new.status,nullif(btrim(coalesce(p_note,'')),''),auth.uid(),
    jsonb_build_object('old_severity',v_old.severity,'new_severity',v_new.severity,'assigned_to',v_new.assigned_to)
  );
  perform public.dn_ce_audit('complaint','update',jsonb_build_object('complaint_id',p_complaint_id,'old_status',v_old.status,'new_status',v_new.status));
  return to_jsonb(v_new)||jsonb_build_object('ok',true);
end;
$$;

create or replace function public.admin_update_message_template(
  p_template_id uuid,
  p_body text,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_unknown text[];
  v_allowed text[] := array[
    'customer_name','customer_city','merchant_name','driver_name','tracking_number','amount_due','amount_due_line','payment_method','payment_line','tracking_url','feedback_url','merchant_portal_url','merchant_order_url','statement_url','order_status','complaint_number','support_phone','company_name_ar','company_name_en','company_email','company_website','pickup_time','delivery_time','failure_reason','settlement_period','order_count','gross_collected','fees','net_due'
  ];
  v_row public.message_templates%rowtype;
begin
  if not public.dn_ce_is_admin_or_support() then raise exception 'not_authorized'; end if;
  if length(btrim(coalesce(p_body,'')))<2 then raise exception 'template_body_empty'; end if;
  select array_agg(distinct match[1]) filter (where not match[1]=any(v_allowed))
  into v_unknown
  from regexp_matches(p_body,'\{([a-zA-Z0-9_]+)\}','g') as match;
  if coalesce(array_length(v_unknown,1),0)>0 then raise exception 'unknown_template_variables:%',array_to_string(v_unknown,','); end if;

  update public.message_templates
  set body=p_body,is_active=coalesce(p_is_active,is_active),updated_at=now()
  where id=p_template_id
  returning * into v_row;
  if not found then raise exception 'template_not_found'; end if;
  perform public.dn_ce_audit('message_template','update',jsonb_build_object('template_id',p_template_id,'template_key',v_row.template_key,'language',v_row.language));
  return to_jsonb(v_row)||jsonb_build_object('ok',true);
end;
$$;

-- RLS
alter table public.customer_experience_settings enable row level security;
alter table public.message_templates enable row level security;
alter table public.outbound_message_logs enable row level security;
alter table public.feedback_tokens enable row level security;
alter table public.order_feedback enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_attachments enable row level security;
alter table public.complaint_events enable row level security;
alter table public.order_contact_attempts enable row level security;

drop policy if exists ce_settings_admin on public.customer_experience_settings;
create policy ce_settings_admin on public.customer_experience_settings for all to authenticated
using (public.dn_ce_is_admin_or_support()) with check (public.dn_ce_is_admin_or_support());

drop policy if exists ce_templates_read_active on public.message_templates;
create policy ce_templates_read_active on public.message_templates for select to authenticated
using (is_active or public.dn_ce_is_admin_or_support());
drop policy if exists ce_templates_admin_write on public.message_templates;
create policy ce_templates_admin_write on public.message_templates for all to authenticated
using (public.dn_ce_is_admin_or_support()) with check (public.dn_ce_is_admin_or_support());

drop policy if exists ce_message_logs_admin_read on public.outbound_message_logs;
create policy ce_message_logs_admin_read on public.outbound_message_logs for select to authenticated
using (public.dn_ce_is_admin_or_support() or generated_by=auth.uid());

drop policy if exists ce_feedback_admin_read on public.order_feedback;
create policy ce_feedback_admin_read on public.order_feedback for select to authenticated
using (
  public.dn_ce_is_admin_or_support()
  or public.dn_ce_driver_for_order(order_id)
  or public.dn_ce_merchant_for_order(order_id)
  or customer_id=auth.uid()
);

drop policy if exists ce_complaints_admin_read on public.complaints;
create policy ce_complaints_admin_read on public.complaints for select to authenticated
using (public.dn_ce_is_admin_or_support());
drop policy if exists ce_complaints_admin_update on public.complaints;
create policy ce_complaints_admin_update on public.complaints for update to authenticated
using (public.dn_ce_is_admin_or_support()) with check (public.dn_ce_is_admin_or_support());

drop policy if exists ce_complaint_attachments_admin_read on public.complaint_attachments;
create policy ce_complaint_attachments_admin_read on public.complaint_attachments for select to authenticated
using (public.dn_ce_is_admin_or_support());

drop policy if exists ce_complaint_events_admin_read on public.complaint_events;
create policy ce_complaint_events_admin_read on public.complaint_events for select to authenticated
using (public.dn_ce_is_admin_or_support());

drop policy if exists ce_contact_attempts_read on public.order_contact_attempts;
create policy ce_contact_attempts_read on public.order_contact_attempts for select to authenticated
using (public.dn_ce_is_admin_or_support() or public.dn_ce_driver_for_order(order_id));

-- Private evidence bucket. Public submitters receive a 30-minute nonce through the complaint RPC.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('complaint-attachments','complaint-attachments',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ce_complaint_storage_insert on storage.objects;
create policy ce_complaint_storage_insert on storage.objects for insert to anon, authenticated
with check (
  bucket_id='complaint-attachments'
  and exists(
    select 1 from public.complaints c
    where c.id::text=(storage.foldername(name))[1]
      and c.metadata->>'upload_nonce'=(storage.foldername(name))[2]
      and c.created_at>now()-interval '30 minutes'
  )
);

drop policy if exists ce_complaint_storage_admin_select on storage.objects;
create policy ce_complaint_storage_admin_select on storage.objects for select to authenticated
using (bucket_id='complaint-attachments' and public.dn_ce_is_admin_or_support());

drop policy if exists ce_complaint_storage_admin_delete on storage.objects;
create policy ce_complaint_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id='complaint-attachments' and public.dn_ce_is_admin_or_support());

revoke all on function public.create_feedback_token_for_order(uuid) from public, anon;
revoke all on function public.get_feedback_context(text) from public;
revoke all on function public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean) from public;
revoke all on function public.submit_public_complaint(text,text,text,text,text,boolean) from public;
revoke all on function public.register_complaint_attachment(uuid,text,text,text,text,bigint) from public;
revoke all on function public.log_outbound_message(text,text,text,uuid,text,uuid,uuid,uuid,text,text,text,jsonb) from public;
revoke all on function public.mark_outbound_message_status(uuid,text) from public;
revoke all on function public.record_driver_contact_attempt(uuid,text,text,text) from public, anon;
revoke all on function public.admin_update_complaint(uuid,text,text,uuid,text,text) from public, anon;
revoke all on function public.admin_update_message_template(uuid,text,boolean) from public, anon;

grant execute on function public.create_feedback_token_for_order(uuid) to authenticated;
grant execute on function public.get_feedback_context(text) to anon, authenticated;
grant execute on function public.submit_order_feedback(text,integer,integer,integer,integer,integer,integer,integer,integer,text[],text,boolean,boolean) to anon, authenticated;
grant execute on function public.submit_public_complaint(text,text,text,text,text,boolean) to anon, authenticated;
grant execute on function public.register_complaint_attachment(uuid,text,text,text,text,bigint) to anon, authenticated;
grant execute on function public.log_outbound_message(text,text,text,uuid,text,uuid,uuid,uuid,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.mark_outbound_message_status(uuid,text) to anon, authenticated;
grant execute on function public.record_driver_contact_attempt(uuid,text,text,text) to authenticated;
grant execute on function public.admin_update_complaint(uuid,text,text,uuid,text,text) to authenticated;
grant execute on function public.admin_update_message_template(uuid,text,boolean) to authenticated;

-- Realtime administration feeds.
do $$
begin
  begin alter publication supabase_realtime add table public.order_feedback; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.complaints; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.outbound_message_logs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.complaint_events; exception when duplicate_object then null; end;
end;
$$;

commit;

