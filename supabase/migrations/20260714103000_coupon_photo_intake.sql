-- =========================================================
-- DAY NIGHT — Coupon Photo Intake Foundation
-- Safe, idempotent, non-destructive migration.
-- Adds private coupon image storage, intake audit records,
-- admin RPCs, and metadata-only public audit RPC.
-- =========================================================

create extension if not exists pgcrypto;

create or replace function public.dn_coupon_uuid_or_null(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if nullif(trim(coalesce(value, '')), '') is null then
    return null;
  end if;
  return trim(value)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin_or_support()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('admin', 'support')
      and coalesce(p.is_active, true) = true
  );
$$;

create table if not exists public.coupon_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  tracking_number text,
  coupon_number text,
  merchant_id uuid,
  image_path text,
  source_channel text not null default 'admin',
  intake_source text not null default 'upload',
  extraction_source text not null default 'manual',
  extraction_confidence integer not null default 0 check (extraction_confidence between 0 and 100),
  extracted_fields jsonb not null default '{}'::jsonb,
  raw_text_preview text,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'order_created', 'failed')),
  created_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coupon_intake_sessions
  add column if not exists order_id text,
  add column if not exists tracking_number text,
  add column if not exists coupon_number text,
  add column if not exists merchant_id uuid,
  add column if not exists image_path text,
  add column if not exists source_channel text not null default 'admin',
  add column if not exists intake_source text not null default 'upload',
  add column if not exists extraction_source text not null default 'manual',
  add column if not exists extraction_confidence integer not null default 0,
  add column if not exists extracted_fields jsonb not null default '{}'::jsonb,
  add column if not exists raw_text_preview text,
  add column if not exists status text not null default 'draft',
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists coupon_intake_sessions_tracking_idx on public.coupon_intake_sessions (tracking_number);
create index if not exists coupon_intake_sessions_coupon_idx on public.coupon_intake_sessions (coupon_number);
create index if not exists coupon_intake_sessions_merchant_idx on public.coupon_intake_sessions (merchant_id);
create index if not exists coupon_intake_sessions_status_idx on public.coupon_intake_sessions (status);
create index if not exists coupon_intake_sessions_created_idx on public.coupon_intake_sessions (created_at desc);

alter table public.coupon_intake_sessions enable row level security;

update public.coupon_intake_sessions
set extraction_confidence = greatest(0, least(100, coalesce(extraction_confidence, 0)))
where extraction_confidence is null or extraction_confidence < 0 or extraction_confidence > 100;

drop trigger if exists coupon_intake_sessions_set_updated_at on public.coupon_intake_sessions;
create trigger coupon_intake_sessions_set_updated_at
before update on public.coupon_intake_sessions
for each row execute function public.set_updated_at();

drop policy if exists coupon_intake_admin_support_select on public.coupon_intake_sessions;
create policy coupon_intake_admin_support_select
on public.coupon_intake_sessions
for select
to authenticated
using (public.is_admin_or_support());

drop policy if exists coupon_intake_admin_support_insert on public.coupon_intake_sessions;
create policy coupon_intake_admin_support_insert
on public.coupon_intake_sessions
for insert
to authenticated
with check (public.is_admin_or_support());

drop policy if exists coupon_intake_admin_support_update on public.coupon_intake_sessions;
create policy coupon_intake_admin_support_update
on public.coupon_intake_sessions
for update
to authenticated
using (public.is_admin_or_support())
with check (public.is_admin_or_support());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coupon-images',
  'coupon-images',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists coupon_images_admin_support_read on storage.objects;
create policy coupon_images_admin_support_read
on storage.objects
for select
to authenticated
using (bucket_id = 'coupon-images' and public.is_admin_or_support());

drop policy if exists coupon_images_admin_support_insert on storage.objects;
create policy coupon_images_admin_support_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'coupon-images'
  and public.is_admin_or_support()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists coupon_images_admin_support_update on storage.objects;
create policy coupon_images_admin_support_update
on storage.objects
for update
to authenticated
using (bucket_id = 'coupon-images' and public.is_admin_or_support())
with check (bucket_id = 'coupon-images' and public.is_admin_or_support());

drop policy if exists coupon_images_admin_support_delete on storage.objects;
create policy coupon_images_admin_support_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'coupon-images' and public.is_admin_or_support());

create or replace function public.admin_create_coupon_intake_session(p_payload jsonb)
returns public.coupon_intake_sessions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created public.coupon_intake_sessions;
begin
  if not public.is_admin_or_support() then
    raise exception 'admin_or_support_required';
  end if;

  insert into public.coupon_intake_sessions (
    order_id,
    tracking_number,
    coupon_number,
    merchant_id,
    image_path,
    source_channel,
    intake_source,
    extraction_source,
    extraction_confidence,
    extracted_fields,
    raw_text_preview,
    status,
    created_by,
    reviewed_by,
    reviewed_at
  ) values (
    nullif(trim(p_payload->>'order_id'), ''),
    nullif(trim(p_payload->>'tracking_number'), ''),
    nullif(trim(p_payload->>'coupon_number'), ''),
    public.dn_coupon_uuid_or_null(p_payload->>'merchant_id'),
    nullif(trim(p_payload->>'image_path'), ''),
    coalesce(nullif(trim(p_payload->>'source_channel'), ''), 'admin'),
    coalesce(nullif(trim(p_payload->>'intake_source'), ''), 'upload'),
    coalesce(nullif(trim(p_payload->>'extraction_source'), ''), 'manual'),
    greatest(0, least(100, coalesce((p_payload->>'extraction_confidence')::integer, 0))),
    coalesce(p_payload->'extracted_fields', '{}'::jsonb),
    nullif(left(coalesce(p_payload->>'raw_text_preview', ''), 2000), ''),
    case when p_payload->>'status' in ('draft', 'reviewed', 'order_created', 'failed') then p_payload->>'status' else 'reviewed' end,
    auth.uid(),
    auth.uid(),
    coalesce((p_payload->>'reviewed_at')::timestamptz, now())
  )
  returning * into created;

  return created;
end;
$$;

create or replace function public.admin_link_coupon_intake_order(
  p_session_id uuid,
  p_order_reference text
)
returns public.coupon_intake_sessions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated public.coupon_intake_sessions;
begin
  if not public.is_admin_or_support() then
    raise exception 'admin_or_support_required';
  end if;

  update public.coupon_intake_sessions
  set tracking_number = nullif(trim(p_order_reference), ''),
      order_id = coalesce(order_id, nullif(trim(p_order_reference), '')),
      status = 'order_created',
      reviewed_by = auth.uid(),
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  where id = p_session_id
  returning * into updated;

  return updated;
end;
$$;

create or replace function public.public_create_coupon_intake_session(p_payload jsonb)
returns public.coupon_intake_sessions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created public.coupon_intake_sessions;
  safe_fields jsonb;
begin
  if nullif(trim(p_payload->>'tracking_number'), '') is null then
    raise exception 'tracking_number_required';
  end if;

  safe_fields := jsonb_strip_nulls(jsonb_build_object(
    'coupon_number', nullif(trim(p_payload->'extracted_fields'->>'coupon_number'), ''),
    'receiver_name', nullif(left(trim(p_payload->'extracted_fields'->>'receiver_name'), 120), ''),
    'receiver_phone', nullif(left(trim(p_payload->'extracted_fields'->>'receiver_phone'), 40), ''),
    'delivery_city', nullif(left(trim(p_payload->'extracted_fields'->>'delivery_city'), 80), ''),
    'package_type', nullif(left(trim(p_payload->'extracted_fields'->>'package_type'), 160), ''),
    'cod_amount', nullif(left(trim(p_payload->'extracted_fields'->>'cod_amount'), 40), '')
  ));

  insert into public.coupon_intake_sessions (
    tracking_number,
    coupon_number,
    image_path,
    source_channel,
    intake_source,
    extraction_source,
    extraction_confidence,
    extracted_fields,
    raw_text_preview,
    status,
    created_by,
    reviewed_at
  ) values (
    left(trim(p_payload->>'tracking_number'), 120),
    nullif(left(trim(p_payload->>'coupon_number'), 120), ''),
    null,
    'public_request',
    coalesce(nullif(left(trim(p_payload->>'intake_source'), 30), ''), 'upload'),
    coalesce(nullif(left(trim(p_payload->>'extraction_source'), 30), ''), 'manual'),
    greatest(0, least(100, coalesce((p_payload->>'extraction_confidence')::integer, 0))),
    safe_fields,
    nullif(left(coalesce(p_payload->>'raw_text_preview', ''), 1200), ''),
    'order_created',
    auth.uid(),
    now()
  )
  returning * into created;

  return created;
end;
$$;

revoke all on function public.admin_create_coupon_intake_session(jsonb) from public;
revoke all on function public.admin_link_coupon_intake_order(uuid, text) from public;
revoke all on function public.public_create_coupon_intake_session(jsonb) from public;

grant execute on function public.admin_create_coupon_intake_session(jsonb) to authenticated;
grant execute on function public.admin_link_coupon_intake_order(uuid, text) to authenticated;
grant execute on function public.public_create_coupon_intake_session(jsonb) to anon, authenticated;

comment on table public.coupon_intake_sessions is 'Audit trail for coupon image, QR/barcode, OCR, and manual review intake sessions.';
comment on function public.public_create_coupon_intake_session(jsonb) is 'Metadata-only public coupon audit. Anonymous users cannot upload or read coupon images.';
