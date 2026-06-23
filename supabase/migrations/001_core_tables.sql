-- DAY NIGHT DELIVERY SERVICES
-- Migration 001: Core tables for production
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Enable required extensions
create extension if not exists pgcrypto;

-- Grant schema usage
grant usage on schema public to anon, authenticated;

-- 1. profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'driver', 'admin', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. zones table
create table if not exists public.zones (
  id bigserial primary key,
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  zone_type text not null check (zone_type in ('main', 'extended', 'gcc', 'worldwide')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. cities table
create table if not exists public.cities (
  id bigserial primary key,
  zone_id bigint references public.zones(id),
  name_en text not null,
  name_ar text not null,
  emirate text,
  country text not null default 'AE',
  area_type text default 'main',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. pricing_rules table
create table if not exists public.pricing_rules (
  id bigserial primary key,
  service_type text not null,
  origin_zone_type text,
  destination_zone_type text,
  first_kg_price numeric(12,2),
  additional_kg_price numeric(12,2),
  flat_price numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. international_rates table
create table if not exists public.international_rates (
  id bigserial primary key,
  destination_code text not null unique,
  destination_name text not null,
  first_kg_price numeric(12,2) not null,
  additional_kg_price numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  customer_id uuid references public.profiles(id),
  sender_name text not null,
  sender_phone text not null,
  pickup_city_id bigint references public.cities(id),
  pickup_address text not null,
  receiver_name text not null,
  receiver_phone text not null,
  delivery_city_id bigint references public.cities(id),
  delivery_address text not null,
  package_type text,
  weight_kg numeric(8,2) not null,
  service_type text not null,
  payment_method text not null default 'cod',
  cod_amount numeric(12,2),
  calculated_price numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled')),
  assigned_driver_id uuid references public.profiles(id),
  estimated_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. order_status_history table
create table if not exists public.order_status_history (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  location_text text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 8. driver_profiles table
create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  vehicle_type text,
  vehicle_plate text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 9. driver_locations table
create table if not exists public.driver_locations (
  id bigserial primary key,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  lat numeric(10,8) not null,
  lng numeric(11,8) not null,
  heading numeric(5,2),
  speed numeric(5,2),
  updated_at timestamptz not null default now()
);

-- 10. invoices table
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  invoice_number text not null unique,
  amount numeric(12,2) not null,
  pdf_url text,
  created_at timestamptz not null default now()
);

-- 11. notifications table
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 12. error_logs table
create table if not exists public.error_logs (
  id bigserial primary key,
  source text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 13. performance_logs table
create table if not exists public.performance_logs (
  id bigserial primary key,
  route text not null,
  metric text not null,
  value numeric,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.zones enable row level security;
alter table public.cities enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.international_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.error_logs enable row level security;
alter table public.performance_logs enable row level security;

-- RLS Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for zones (read-only for all)
create policy "Everyone can view active zones"
  on public.zones for select
  using (is_active = true);

-- RLS Policies for cities (read-only for all)
create policy "Everyone can view active cities"
  on public.cities for select
  using (is_active = true);

-- RLS Policies for pricing_rules (read-only for all)
create policy "Everyone can view active pricing rules"
  on public.pricing_rules for select
  using (is_active = true);

-- RLS Policies for international_rates (read-only for all)
create policy "Everyone can view active international rates"
  on public.international_rates for select
  using (is_active = true);

-- RLS Policies for orders
create policy "Customers can view own orders"
  on public.orders for select
  using (
    auth.uid() = customer_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'support', 'driver')
    )
  );

create policy "Public can create orders via RPC only"
  on public.orders for insert
  with check (false);

create policy "Drivers can update assigned orders"
  on public.orders for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'driver'
    )
    and assigned_driver_id = auth.uid()
  );

create policy "Admin/Support can update all orders"
  on public.orders for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'support')
    )
  );

-- RLS Policies for order_status_history
create policy "Customers can view own order history"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders
      where id = order_status_history.order_id and customer_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'support', 'driver')
    )
  );

create policy "Admin/Support/Driver can insert status history"
  on public.order_status_history for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'support', 'driver')
    )
  );

-- RLS Policies for driver_profiles
create policy "Drivers can view own profile"
  on public.driver_profiles for select
  using (user_id = auth.uid());

create policy "Admins can view all driver profiles"
  on public.driver_profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for driver_locations
create policy "Drivers can update own location"
  on public.driver_locations for insert
  with check (
    exists (
      select 1 from public.driver_profiles
      where driver_profiles.id = driver_locations.driver_id
      and driver_profiles.user_id = auth.uid()
    )
  );

create policy "Anyone can view driver locations for assigned orders"
  on public.driver_locations for select
  using (true);

-- RLS Policies for invoices
create policy "Customers can view own invoices"
  on public.invoices for select
  using (
    exists (
      select 1 from public.orders
      where id = invoices.order_id and customer_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'support')
    )
  );

-- RLS Policies for notifications
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "System can insert notifications"
  on public.notifications for insert
  with check (false);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- RLS Policies for error_logs (admin only)
create policy "Admins can view error logs"
  on public.error_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "System can insert error logs"
  on public.error_logs for insert
  with check (false);

-- RLS Policies for performance_logs (admin only)
create policy "Admins can view performance logs"
  on public.performance_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "System can insert performance logs"
  on public.performance_logs for insert
  with check (false);

-- Create indexes for performance
create index if not exists idx_orders_tracking_code on public.orders(tracking_code);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);
create index if not exists idx_driver_locations_driver_id on public.driver_locations(driver_id);
create index if not exists idx_invoices_order_id on public.invoices(order_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
