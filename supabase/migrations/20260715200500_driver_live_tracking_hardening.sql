-- DAY NIGHT — Driver live tracking production hardening
-- Safe additive follow-up for the merged driver module.
-- This file is designed for an existing production Supabase project.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Ensure tables exist for new projects, then ensure columns for existing ones.
-- -----------------------------------------------------------------------------

create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text,
  name text,
  phone text,
  status text not null default 'active',
  vehicle_type text,
  vehicle_plate text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.driver_profiles add column if not exists full_name text;
alter table public.driver_profiles add column if not exists name text;
alter table public.driver_profiles add column if not exists phone text;
alter table public.driver_profiles add column if not exists status text not null default 'active';
alter table public.driver_profiles add column if not exists vehicle_type text;
alter table public.driver_profiles add column if not exists vehicle_plate text;
alter table public.driver_profiles add column if not exists created_at timestamptz not null default now();
alter table public.driver_profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.driver_profiles(id) on delete cascade,
  lat double precision,
  lng double precision,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  current_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_locations add column if not exists driver_id uuid references public.driver_profiles(id) on delete cascade;
alter table public.driver_locations add column if not exists lat double precision;
alter table public.driver_locations add column if not exists lng double precision;
alter table public.driver_locations add column if not exists accuracy double precision;
alter table public.driver_locations add column if not exists heading double precision;
alter table public.driver_locations add column if not exists speed double precision;
alter table public.driver_locations add column if not exists is_online boolean not null default false;
alter table public.driver_locations add column if not exists last_seen_at timestamptz not null default now();
alter table public.driver_locations add column if not exists current_order_id uuid;
alter table public.driver_locations add column if not exists created_at timestamptz not null default now();
alter table public.driver_locations add column if not exists updated_at timestamptz not null default now();

create table if not exists public.driver_location_history (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.driver_profiles(id) on delete cascade,
  order_id uuid,
  lat double precision,
  lng double precision,
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now()
);

alter table public.driver_location_history add column if not exists driver_id uuid references public.driver_profiles(id) on delete cascade;
alter table public.driver_location_history add column if not exists order_id uuid;
alter table public.driver_location_history add column if not exists lat double precision;
alter table public.driver_location_history add column if not exists lng double precision;
alter table public.driver_location_history add column if not exists accuracy double precision;
alter table public.driver_location_history add column if not exists heading double precision;
alter table public.driver_location_history add column if not exists speed double precision;
alter table public.driver_location_history add column if not exists recorded_at timestamptz not null default now();

alter table public.orders add column if not exists driver_id uuid references public.driver_profiles(id);
alter table public.orders add column if not exists assigned_driver_id uuid references public.driver_profiles(id);
alter table public.orders add column if not exists driver_name text;
alter table public.orders add column if not exists driver_phone text;

alter table public.order_status_history add column if not exists driver_id uuid references public.driver_profiles(id);
alter table public.order_status_history add column if not exists changed_by uuid references auth.users(id);
alter table public.order_status_history add column if not exists note text;
alter table public.order_status_history add column if not exists created_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- 2) Ensure the upsert target used by the frontend exists.
-- -----------------------------------------------------------------------------

-- Keep one current-location row per driver before enforcing uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by driver_id
      order by coalesce(updated_at, last_seen_at, created_at, now()) desc, id desc
    ) as rn
  from public.driver_locations
  where driver_id is not null
)
delete from public.driver_locations dl
using ranked r
where dl.id = r.id
  and r.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.driver_locations'::regclass
      and conname = 'driver_locations_driver_id_key'
  ) then
    alter table public.driver_locations
      add constraint driver_locations_driver_id_key unique (driver_id);
  end if;
end $$;

-- driver_profiles.user_id should be unique when possible. If old duplicates exist,
-- this leaves the table untouched and prints a warning instead of deleting profiles.
do $$
begin
  if exists (
    select user_id
    from public.driver_profiles
    where user_id is not null
    group by user_id
    having count(*) > 1
  ) then
    raise notice 'Duplicate driver_profiles.user_id rows exist. Resolve duplicates before adding a unique constraint.';
  elsif not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.driver_profiles'::regclass
      and conname = 'driver_profiles_user_id_key'
  ) then
    alter table public.driver_profiles
      add constraint driver_profiles_user_id_key unique (user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) Indexes for map, dashboard and assigned order queries.
-- -----------------------------------------------------------------------------

create index if not exists idx_driver_profiles_user_id on public.driver_profiles(user_id);
create index if not exists idx_driver_profiles_status on public.driver_profiles(status);
create index if not exists idx_driver_locations_driver_id on public.driver_locations(driver_id);
create index if not exists idx_driver_locations_last_seen_at on public.driver_locations(last_seen_at desc);
create index if not exists idx_driver_location_history_driver_recorded on public.driver_location_history(driver_id, recorded_at desc);
create index if not exists idx_driver_location_history_order_recorded on public.driver_location_history(order_id, recorded_at desc);
create index if not exists idx_orders_driver_id on public.orders(driver_id);
create index if not exists idx_orders_assigned_driver_id on public.orders(assigned_driver_id);
create index if not exists idx_orders_status_assigned_driver on public.orders(status, assigned_driver_id);
create index if not exists idx_order_status_history_driver_id on public.order_status_history(driver_id);
create index if not exists idx_order_status_history_changed_by on public.order_status_history(changed_by);

-- -----------------------------------------------------------------------------
-- 4) RLS policies. Use p.role::text to support enum/text role columns.
-- -----------------------------------------------------------------------------

alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_location_history enable row level security;

-- Driver profiles

drop policy if exists "drivers read own driver profile" on public.driver_profiles;
create policy "drivers read own driver profile"
on public.driver_profiles
for select
using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin')
);

drop policy if exists "admins manage driver profiles" on public.driver_profiles;
create policy "admins manage driver profiles"
on public.driver_profiles
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin'));

-- Current live locations

drop policy if exists "drivers upsert own current location" on public.driver_locations;
create policy "drivers upsert own current location"
on public.driver_locations
for all
using (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.id = driver_locations.driver_id
      and dp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.id = driver_locations.driver_id
      and dp.user_id = auth.uid()
  )
);

drop policy if exists "admins read all driver locations" on public.driver_locations;
create policy "admins read all driver locations"
on public.driver_locations
for select
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin'));

-- Trail history

drop policy if exists "drivers insert own trail" on public.driver_location_history;
create policy "drivers insert own trail"
on public.driver_location_history
for insert
with check (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.id = driver_location_history.driver_id
      and dp.user_id = auth.uid()
  )
);

drop policy if exists "drivers read own trail" on public.driver_location_history;
create policy "drivers read own trail"
on public.driver_location_history
for select
using (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.id = driver_location_history.driver_id
      and dp.user_id = auth.uid()
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin')
);

-- Assigned orders

drop policy if exists "drivers read assigned orders" on public.orders;
create policy "drivers read assigned orders"
on public.orders
for select
using (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.user_id = auth.uid()
      and (dp.id = orders.driver_id or dp.id = orders.assigned_driver_id)
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin')
);

drop policy if exists "drivers update assigned order status" on public.orders;
create policy "drivers update assigned order status"
on public.orders
for update
using (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.user_id = auth.uid()
      and (dp.id = orders.driver_id or dp.id = orders.assigned_driver_id)
  )
)
with check (
  exists (
    select 1
    from public.driver_profiles dp
    where dp.user_id = auth.uid()
      and (dp.id = orders.driver_id or dp.id = orders.assigned_driver_id)
  )
);

-- Status history: add driver/admin policies only when table exists.
alter table public.order_status_history enable row level security;

drop policy if exists "drivers insert assigned order history" on public.order_status_history;
create policy "drivers insert assigned order history"
on public.order_status_history
for insert
with check (
  exists (
    select 1
    from public.driver_profiles dp
    join public.orders o on o.id = order_status_history.order_id
    where dp.user_id = auth.uid()
      and order_status_history.driver_id = dp.id
      and (o.driver_id = dp.id or o.assigned_driver_id = dp.id)
  )
);

drop policy if exists "drivers read assigned order history" on public.order_status_history;
create policy "drivers read assigned order history"
on public.order_status_history
for select
using (
  exists (
    select 1
    from public.driver_profiles dp
    join public.orders o on o.id = order_status_history.order_id
    where dp.user_id = auth.uid()
      and (o.driver_id = dp.id or o.assigned_driver_id = dp.id)
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin')
);

drop policy if exists "admins manage order status history" on public.order_status_history;
create policy "admins manage order status history"
on public.order_status_history
for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'admin'));

-- Notifications: do not require the app to depend on them, but allow owner/admin access.
do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'alter table public.notifications enable row level security';

    execute 'drop policy if exists "drivers read own notifications" on public.notifications';
    execute 'create policy "drivers read own notifications" on public.notifications for select using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = ''admin''))';

    execute 'drop policy if exists "admins manage notifications" on public.notifications';
    execute 'create policy "admins manage notifications" on public.notifications for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = ''admin'')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = ''admin''))';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5) Verification helper. Run after creating a real driver profile.
-- -----------------------------------------------------------------------------

create or replace view public.driver_live_tracking_health as
select
  dp.id as driver_id,
  dp.user_id,
  dp.full_name,
  dp.phone,
  dp.status,
  dl.lat,
  dl.lng,
  dl.is_online,
  dl.last_seen_at,
  dl.current_order_id,
  count(o.id) filter (where o.status in ('assigned','accepted','picked_up','in_transit','review','confirmed','postponed')) as active_orders
from public.driver_profiles dp
left join public.driver_locations dl on dl.driver_id = dp.id
left join public.orders o on o.driver_id = dp.id or o.assigned_driver_id = dp.id
group by dp.id, dp.user_id, dp.full_name, dp.phone, dp.status, dl.lat, dl.lng, dl.is_online, dl.last_seen_at, dl.current_order_id;

grant select on public.driver_live_tracking_health to authenticated;
