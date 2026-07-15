-- DAY NIGHT driver live tracking module: safe additive migration.
create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  name text,
  phone text,
  status text not null default 'active',
  vehicle_type text,
  vehicle_plate text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.driver_profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  current_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_location_history (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  order_id uuid,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now()
);

alter table public.orders add column if not exists driver_id uuid references public.driver_profiles(id);
alter table public.orders add column if not exists assigned_driver_id uuid references public.driver_profiles(id);
alter table public.orders add column if not exists driver_name text;
alter table public.orders add column if not exists driver_phone text;
alter table public.order_status_history add column if not exists driver_id uuid references public.driver_profiles(id);

create index if not exists idx_driver_profiles_user_id on public.driver_profiles(user_id);
create index if not exists idx_driver_locations_driver_id on public.driver_locations(driver_id);
create index if not exists idx_driver_locations_last_seen_at on public.driver_locations(last_seen_at desc);
create index if not exists idx_driver_location_history_driver_recorded on public.driver_location_history(driver_id, recorded_at desc);
create index if not exists idx_orders_driver_id on public.orders(driver_id);
create index if not exists idx_orders_assigned_driver_id on public.orders(assigned_driver_id);
create index if not exists idx_orders_status_driver on public.orders(status, assigned_driver_id);

alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_location_history enable row level security;

drop policy if exists "drivers read own driver profile" on public.driver_profiles;
create policy "drivers read own driver profile" on public.driver_profiles for select using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admins manage driver profiles" on public.driver_profiles;
create policy "admins manage driver profiles" on public.driver_profiles for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "drivers upsert own current location" on public.driver_locations;
create policy "drivers upsert own current location" on public.driver_locations for all using (exists (select 1 from public.driver_profiles dp where dp.id = driver_locations.driver_id and dp.user_id = auth.uid())) with check (exists (select 1 from public.driver_profiles dp where dp.id = driver_locations.driver_id and dp.user_id = auth.uid()));

drop policy if exists "admins read all driver locations" on public.driver_locations;
create policy "admins read all driver locations" on public.driver_locations for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "drivers insert own trail" on public.driver_location_history;
create policy "drivers insert own trail" on public.driver_location_history for insert with check (exists (select 1 from public.driver_profiles dp where dp.id = driver_location_history.driver_id and dp.user_id = auth.uid()));

drop policy if exists "drivers read own trail" on public.driver_location_history;
create policy "drivers read own trail" on public.driver_location_history for select using (exists (select 1 from public.driver_profiles dp where dp.id = driver_location_history.driver_id and dp.user_id = auth.uid()) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Driver order policies are additive and rely on existing table RLS being enabled by prior migrations.
drop policy if exists "drivers read assigned orders" on public.orders;
create policy "drivers read assigned orders" on public.orders for select using (exists (select 1 from public.driver_profiles dp where dp.user_id = auth.uid() and (dp.id = orders.driver_id or dp.id = orders.assigned_driver_id)) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "drivers update assigned order status" on public.orders;
create policy "drivers update assigned order status" on public.orders for update using (exists (select 1 from public.driver_profiles dp where dp.user_id = auth.uid() and (dp.id = orders.driver_id or dp.id = orders.assigned_driver_id))) with check (exists (select 1 from public.driver_profiles dp where dp.user_id = auth.uid() and (dp.id = orders.driver_id or dp.id = orders.assigned_driver_id)));
