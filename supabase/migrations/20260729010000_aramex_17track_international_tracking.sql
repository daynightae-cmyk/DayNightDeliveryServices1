-- DAY NIGHT DELIVERY SERVICES
-- Secure Aramex-only international tracking through 17TRACK API v2.4.
-- Production Supabase project: ngdwybpgacauorygoedi

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.international_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default '17track',
  carrier_name text not null default 'Aramex',
  carrier_code integer not null default 100006,
  tracking_number text not null,
  public_tracking_number text,
  provider_status text,
  provider_sub_status text,
  normalized_status text not null default 'information_received',
  status_rank integer not null default 10,
  latest_description text,
  latest_location text,
  latest_city text,
  latest_country text,
  latest_coordinates jsonb,
  origin_country text,
  origin_city text,
  origin_coordinates jsonb,
  destination_country text,
  destination_city text,
  destination_coordinates jsonb,
  estimated_delivery_at timestamptz,
  pieces integer,
  weight_kg numeric(12,3),
  registered_at timestamptz,
  last_webhook_at timestamptz,
  last_synced_at timestamptz,
  latest_update_at timestamptz,
  delivered_at timestamptz,
  tracking_stopped_at timestamptz,
  registration_response jsonb,
  latest_payload jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint international_shipments_tracking_format
    check (tracking_number ~ '^[A-Za-z0-9-]{5,50}$'),
  constraint international_shipments_aramex_only
    check (lower(carrier_name) = 'aramex' and carrier_code = 100006),
  constraint international_shipments_provider_unique
    unique (provider, carrier_code, tracking_number)
);

create index if not exists international_shipments_order_idx
  on public.international_shipments(order_id);
create index if not exists international_shipments_tracking_idx
  on public.international_shipments(tracking_number);
create index if not exists international_shipments_public_tracking_idx
  on public.international_shipments(public_tracking_number);
create index if not exists international_shipments_status_idx
  on public.international_shipments(normalized_status, latest_update_at desc);
create index if not exists international_shipments_webhook_idx
  on public.international_shipments(last_webhook_at desc nulls last);

create table if not exists public.international_tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.international_shipments(id) on delete cascade,
  provider_event_id text,
  event_hash text not null,
  provider_status text,
  provider_sub_status text,
  normalized_status text not null,
  status_rank integer not null default 0,
  description text,
  description_ar text,
  location text,
  city text,
  state text,
  country text,
  postal_code text,
  longitude numeric,
  latitude numeric,
  event_time timestamptz not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  constraint international_tracking_events_hash_unique
    unique (shipment_id, event_hash)
);

create index if not exists international_tracking_events_shipment_time_idx
  on public.international_tracking_events(shipment_id, event_time desc);
create index if not exists international_tracking_events_status_idx
  on public.international_tracking_events(normalized_status, event_time desc);

create table if not exists public.track17_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  tracking_number text,
  carrier_code integer,
  signature_preview text,
  signature_valid boolean not null default false,
  processing_status text not null default 'received',
  http_result integer,
  payload jsonb,
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists track17_webhook_logs_received_idx
  on public.track17_webhook_logs(received_at desc);
create index if not exists track17_webhook_logs_tracking_idx
  on public.track17_webhook_logs(tracking_number, received_at desc);

create table if not exists public.track17_api_logs (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  shipment_id uuid references public.international_shipments(id) on delete set null,
  tracking_number text,
  provider_response_code integer,
  accepted integer not null default 0,
  rejected integer not null default 0,
  error_code text,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists track17_api_logs_created_idx
  on public.track17_api_logs(created_at desc);
create index if not exists track17_api_logs_tracking_idx
  on public.track17_api_logs(tracking_number, created_at desc);

create table if not exists public.track17_quota_cache (
  id boolean primary key default true check (id),
  quota_total integer,
  quota_used integer,
  quota_remain integer,
  today_used integer,
  max_track_daily integer,
  payload jsonb,
  checked_at timestamptz not null default now()
);

alter table public.international_shipments enable row level security;
alter table public.international_tracking_events enable row level security;
alter table public.track17_webhook_logs enable row level security;
alter table public.track17_api_logs enable row level security;
alter table public.track17_quota_cache enable row level security;

create or replace function public.daynight_is_admin_or_support()
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.role::text) in ('admin', 'support', 'owner', 'super_admin')
  );
$$;

revoke all on function public.daynight_is_admin_or_support() from public, anon;
grant execute on function public.daynight_is_admin_or_support() to authenticated;

create or replace function public.daynight_can_read_international_order(p_order_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null and (
    public.daynight_is_admin_or_support()
    or exists (
      select 1
      from public.orders o
      where o.id = p_order_id
        and auth.uid()::text in (
          coalesce(to_jsonb(o) ->> 'merchant_id', ''),
          coalesce(to_jsonb(o) ->> 'merchant_user_id', ''),
          coalesce(to_jsonb(o) ->> 'customer_id', ''),
          coalesce(to_jsonb(o) ->> 'created_by', ''),
          coalesce(to_jsonb(o) ->> 'user_id', '')
        )
    )
  );
$$;

revoke all on function public.daynight_can_read_international_order(uuid) from public, anon;
grant execute on function public.daynight_can_read_international_order(uuid) to authenticated;

drop policy if exists international_shipments_authorized_select on public.international_shipments;
create policy international_shipments_authorized_select
  on public.international_shipments
  for select
  to authenticated
  using (public.daynight_can_read_international_order(order_id));

drop policy if exists international_shipments_admin_manage on public.international_shipments;
create policy international_shipments_admin_manage
  on public.international_shipments
  for all
  to authenticated
  using (public.daynight_is_admin_or_support())
  with check (public.daynight_is_admin_or_support());

drop policy if exists international_tracking_events_authorized_select on public.international_tracking_events;
create policy international_tracking_events_authorized_select
  on public.international_tracking_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.international_shipments s
      where s.id = shipment_id
        and public.daynight_can_read_international_order(s.order_id)
    )
  );

drop policy if exists international_tracking_events_admin_manage on public.international_tracking_events;
create policy international_tracking_events_admin_manage
  on public.international_tracking_events
  for all
  to authenticated
  using (public.daynight_is_admin_or_support())
  with check (public.daynight_is_admin_or_support());

drop policy if exists track17_webhook_logs_admin_select on public.track17_webhook_logs;
create policy track17_webhook_logs_admin_select
  on public.track17_webhook_logs
  for select
  to authenticated
  using (public.daynight_is_admin_or_support());

drop policy if exists track17_api_logs_admin_select on public.track17_api_logs;
create policy track17_api_logs_admin_select
  on public.track17_api_logs
  for select
  to authenticated
  using (public.daynight_is_admin_or_support());

drop policy if exists track17_quota_cache_admin_select on public.track17_quota_cache;
create policy track17_quota_cache_admin_select
  on public.track17_quota_cache
  for select
  to authenticated
  using (public.daynight_is_admin_or_support());

create or replace function public.daynight_touch_international_shipment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists international_shipments_touch_updated_at on public.international_shipments;
create trigger international_shipments_touch_updated_at
before update on public.international_shipments
for each row execute function public.daynight_touch_international_shipment();

create or replace function public.daynight_mask_tracking_number(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when length(coalesce(p_value, '')) <= 7 then coalesce(p_value, '')
    else left(p_value, 4) || repeat('•', greatest(length(p_value) - 7, 1)) || right(p_value, 3)
  end;
$$;

create or replace function public.daynight_public_international_tracking(p_reference text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_reference text := upper(btrim(coalesce(p_reference, '')));
  v_shipment public.international_shipments%rowtype;
  v_order jsonb;
  v_events jsonb;
  v_public_number text;
begin
  if length(v_reference) < 5 or length(v_reference) > 80 then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select s, to_jsonb(o)
    into v_shipment, v_order
  from public.international_shipments s
  join public.orders o on o.id = s.order_id
  where upper(s.tracking_number) = v_reference
     or upper(coalesce(s.public_tracking_number, '')) = v_reference
     or upper(coalesce(to_jsonb(o) ->> 'tracking_code', '')) = v_reference
     or upper(coalesce(to_jsonb(o) ->> 'tracking_number', '')) = v_reference
     or upper(coalesce(to_jsonb(o) ->> 'invoice_number', '')) = v_reference
     or upper(coalesce(to_jsonb(o) ->> 'coupon_number', '')) = v_reference
     or upper(o.id::text) = v_reference
  order by s.created_at desc
  limit 1;

  if v_shipment.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'status', e.normalized_status,
      'provider_status', e.provider_status,
      'provider_sub_status', e.provider_sub_status,
      'description', e.description,
      'description_ar', e.description_ar,
      'location', e.location,
      'city', e.city,
      'state', e.state,
      'country', e.country,
      'postal_code', e.postal_code,
      'longitude', e.longitude,
      'latitude', e.latitude,
      'event_time', e.event_time
    ) order by e.event_time desc
  ), '[]'::jsonb)
  into v_events
  from public.international_tracking_events e
  where e.shipment_id = v_shipment.id;

  v_public_number := coalesce(
    nullif(v_shipment.public_tracking_number, ''),
    nullif(v_order ->> 'tracking_code', ''),
    nullif(v_order ->> 'tracking_number', ''),
    nullif(v_order ->> 'invoice_number', ''),
    v_shipment.id::text
  );

  return jsonb_build_object(
    'ok', true,
    'shipment', jsonb_build_object(
      'id', v_shipment.id,
      'public_tracking_number', v_public_number,
      'carrier_name', 'Aramex',
      'carrier_code', v_shipment.carrier_code,
      'carrier_tracking_number', public.daynight_mask_tracking_number(v_shipment.tracking_number),
      'carrier_tracking_number_full', v_shipment.tracking_number,
      'provider', v_shipment.provider,
      'provider_status', v_shipment.provider_status,
      'provider_sub_status', v_shipment.provider_sub_status,
      'normalized_status', v_shipment.normalized_status,
      'latest_description', v_shipment.latest_description,
      'latest_location', v_shipment.latest_location,
      'latest_city', v_shipment.latest_city,
      'latest_country', v_shipment.latest_country,
      'latest_coordinates', v_shipment.latest_coordinates,
      'origin', jsonb_build_object(
        'country', v_shipment.origin_country,
        'city', v_shipment.origin_city,
        'coordinates', v_shipment.origin_coordinates
      ),
      'destination', jsonb_build_object(
        'country', v_shipment.destination_country,
        'city', v_shipment.destination_city,
        'coordinates', v_shipment.destination_coordinates
      ),
      'estimated_delivery_at', v_shipment.estimated_delivery_at,
      'pieces', coalesce(v_shipment.pieces, nullif(v_order ->> 'pieces', '')::integer),
      'weight_kg', coalesce(v_shipment.weight_kg, nullif(v_order ->> 'weight', '')::numeric),
      'registered_at', v_shipment.registered_at,
      'latest_update_at', v_shipment.latest_update_at,
      'delivered_at', v_shipment.delivered_at,
      'tracking_stopped_at', v_shipment.tracking_stopped_at,
      'events', v_events
    )
  );
exception
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'not_found');
end;
$$;

revoke all on function public.daynight_public_international_tracking(text) from public;
grant execute on function public.daynight_public_international_tracking(text) to anon, authenticated;

comment on table public.international_shipments is
  'DAY NIGHT Aramex shipments registered with 17TRACK v2.4. Secrets never belong in this table.';
comment on function public.daynight_public_international_tracking(text) is
  'Returns a deliberately limited, public-safe international tracking payload.';

-- Realtime is used by authenticated operational screens. Public clients refresh
-- through the safe Edge Function and never select these tables directly.
do $$
begin
  alter publication supabase_realtime add table public.international_shipments;
exception when duplicate_object or undefined_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.international_tracking_events;
exception when duplicate_object or undefined_object then
  null;
end $$;

commit;
