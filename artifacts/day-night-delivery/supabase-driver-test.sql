-- DAY NIGHT — Driver Live Tracking Test SQL
-- Run this AFTER applying migrations and creating a real Supabase Auth user for the driver.
-- Replace the values in the params CTE only.

with params as (
  select
    'PUT_DRIVER_AUTH_USER_ID_HERE'::uuid as driver_user_id,
    'DAY NIGHT Test Driver'::text as driver_name,
    '+971568757331'::text as driver_phone
), upsert_profile as (
  insert into public.profiles (id, role, full_name, phone, is_active, created_at, updated_at)
  select driver_user_id, 'driver', driver_name, driver_phone, true, now(), now()
  from params
  on conflict (id) do update set
    role = 'driver',
    full_name = excluded.full_name,
    phone = excluded.phone,
    is_active = true,
    updated_at = now()
  returning id
), upsert_driver as (
  insert into public.driver_profiles (user_id, full_name, name, phone, status, vehicle_type, vehicle_plate, created_at, updated_at)
  select driver_user_id, driver_name, driver_name, driver_phone, 'active', 'Toyota Rush', 'TEST-DN', now(), now()
  from params
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    name = excluded.name,
    phone = excluded.phone,
    status = 'active',
    vehicle_type = excluded.vehicle_type,
    vehicle_plate = excluded.vehicle_plate,
    updated_at = now()
  returning id as driver_profile_id, user_id
), upsert_location as (
  insert into public.driver_locations (driver_id, lat, lng, accuracy, heading, speed, is_online, last_seen_at, created_at, updated_at)
  select driver_profile_id, 24.4539, 54.3773, 15, 0, 0, true, now(), now(), now()
  from upsert_driver
  on conflict (driver_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy = excluded.accuracy,
    heading = excluded.heading,
    speed = excluded.speed,
    is_online = true,
    last_seen_at = now(),
    updated_at = now()
  returning *
), insert_trail as (
  insert into public.driver_location_history (driver_id, lat, lng, accuracy, heading, speed, recorded_at)
  select driver_profile_id, 24.4539, 54.3773, 15, 0, 0, now()
  from upsert_driver
  returning id
)
select
  d.driver_profile_id,
  d.user_id,
  l.lat,
  l.lng,
  l.is_online,
  l.last_seen_at,
  'OK: driver profile + live location created. Now open Admin > المندوبون المباشرون.' as result
from upsert_driver d
join upsert_location l on l.driver_id = d.driver_profile_id;

-- Verification after the app writes real GPS:
-- select * from public.driver_live_tracking_health order by last_seen_at desc nulls last;
