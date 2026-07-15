-- =========================================================
-- DAY NIGHT — DRIVER COORDINATE SCHEMA COMPATIBILITY
-- Production-safe reconciliation for legacy latitude/longitude columns
-- and the current lat/lng driver module. No fake coordinates are inserted.
-- =========================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Ensure both coordinate naming models exist on current and history tables.
-- -----------------------------------------------------------------------------

alter table public.driver_locations add column if not exists lat double precision;
alter table public.driver_locations add column if not exists lng double precision;
alter table public.driver_locations add column if not exists latitude double precision;
alter table public.driver_locations add column if not exists longitude double precision;
alter table public.driver_locations add column if not exists accuracy double precision;
alter table public.driver_locations add column if not exists heading double precision;
alter table public.driver_locations add column if not exists speed double precision;
alter table public.driver_locations add column if not exists altitude double precision;
alter table public.driver_locations add column if not exists is_online boolean not null default false;
alter table public.driver_locations add column if not exists battery_level numeric;
alter table public.driver_locations add column if not exists network_state text;
alter table public.driver_locations add column if not exists current_order_id uuid;
alter table public.driver_locations add column if not exists last_seen_at timestamptz not null default now();
alter table public.driver_locations add column if not exists created_at timestamptz not null default now();
alter table public.driver_locations add column if not exists updated_at timestamptz not null default now();

alter table public.driver_location_history add column if not exists lat double precision;
alter table public.driver_location_history add column if not exists lng double precision;
alter table public.driver_location_history add column if not exists latitude double precision;
alter table public.driver_location_history add column if not exists longitude double precision;
alter table public.driver_location_history add column if not exists accuracy double precision;
alter table public.driver_location_history add column if not exists heading double precision;
alter table public.driver_location_history add column if not exists speed double precision;
alter table public.driver_location_history add column if not exists altitude double precision;
alter table public.driver_location_history add column if not exists order_id uuid;
alter table public.driver_location_history add column if not exists recorded_at timestamptz not null default now();

-- Backfill aliases from whichever model already contains the real coordinates.
update public.driver_locations
set lat = coalesce(lat, latitude),
    lng = coalesce(lng, longitude),
    latitude = coalesce(latitude, lat),
    longitude = coalesce(longitude, lng)
where lat is null or lng is null or latitude is null or longitude is null;

update public.driver_location_history
set lat = coalesce(lat, latitude),
    lng = coalesce(lng, longitude),
    latitude = coalesce(latitude, lat),
    longitude = coalesce(longitude, lng)
where lat is null or lng is null or latitude is null or longitude is null;

-- -----------------------------------------------------------------------------
-- 2) Keep both naming models synchronized before constraints are evaluated.
-- -----------------------------------------------------------------------------

create or replace function public.driver_sync_coordinate_aliases()
returns trigger
language plpgsql
set search_path = public
as $dn$
begin
  if new.lat is null then new.lat := new.latitude; end if;
  if new.lng is null then new.lng := new.longitude; end if;
  if new.latitude is null then new.latitude := new.lat; end if;
  if new.longitude is null then new.longitude := new.lng; end if;

  -- If one pair changed explicitly, mirror it to the other pair.
  if tg_op = 'UPDATE' then
    if new.lat is distinct from old.lat then new.latitude := new.lat; end if;
    if new.lng is distinct from old.lng then new.longitude := new.lng; end if;
    if new.latitude is distinct from old.latitude then new.lat := new.latitude; end if;
    if new.longitude is distinct from old.longitude then new.lng := new.longitude; end if;
  end if;

  return new;
end
$dn$;

drop trigger if exists driver_locations_sync_coordinate_aliases on public.driver_locations;
create trigger driver_locations_sync_coordinate_aliases
before insert or update of lat,lng,latitude,longitude
on public.driver_locations
for each row execute function public.driver_sync_coordinate_aliases();

drop trigger if exists driver_location_history_sync_coordinate_aliases on public.driver_location_history;
create trigger driver_location_history_sync_coordinate_aliases
before insert or update of lat,lng,latitude,longitude
on public.driver_location_history
for each row execute function public.driver_sync_coordinate_aliases();

-- -----------------------------------------------------------------------------
-- 3) Recreate the canonical GPS RPC so it writes both column models explicitly.
-- -----------------------------------------------------------------------------

create or replace function public.driver_report_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_heading double precision default null,
  p_speed double precision default null,
  p_altitude double precision default null,
  p_current_order_id text default null,
  p_battery_level numeric default null,
  p_network_state text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order_id uuid := public.driver_safe_uuid(p_current_order_id);
  v_recorded_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;

  select * into v_driver
  from public.driver_profiles
  where (id=auth.uid() or user_id=auth.uid()) and status::text='active'
  order by case when id=auth.uid() then 0 else 1 end, created_at desc nulls last
  limit 1;

  if not found then raise exception 'driver_setup_required_or_inactive'; end if;

  insert into public.driver_locations(
    driver_id,
    lat,lng,latitude,longitude,
    accuracy,heading,speed,altitude,
    is_online,battery_level,network_state,current_order_id,
    last_seen_at,created_at,updated_at
  ) values (
    v_driver.id,
    p_lat,p_lng,p_lat,p_lng,
    p_accuracy,p_heading,p_speed,p_altitude,
    true,p_battery_level,p_network_state,v_order_id,
    v_recorded_at,v_recorded_at,v_recorded_at
  )
  on conflict (driver_id) do update set
    lat=excluded.lat,
    lng=excluded.lng,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    accuracy=excluded.accuracy,
    heading=excluded.heading,
    speed=excluded.speed,
    altitude=excluded.altitude,
    is_online=true,
    battery_level=excluded.battery_level,
    network_state=excluded.network_state,
    current_order_id=excluded.current_order_id,
    last_seen_at=v_recorded_at,
    updated_at=v_recorded_at;

  insert into public.driver_location_history(
    driver_id,order_id,
    lat,lng,latitude,longitude,
    accuracy,heading,speed,altitude,recorded_at
  ) values (
    v_driver.id,v_order_id,
    p_lat,p_lng,p_lat,p_lng,
    p_accuracy,p_heading,p_speed,p_altitude,v_recorded_at
  );

  update public.driver_profiles
  set shift_status=case when v_order_id is null then 'available' else 'busy' end,
      updated_at=v_recorded_at
  where id=v_driver.id;

  return jsonb_build_object(
    'ok',true,
    'driver_id',v_driver.id,
    'lat',p_lat,
    'lng',p_lng,
    'accuracy',p_accuracy,
    'recorded_at',v_recorded_at
  );
end
$dn$;

grant execute on function public.driver_report_location(
  double precision,double precision,double precision,double precision,
  double precision,double precision,text,numeric,text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Indexes and a deterministic compatibility health report.
-- -----------------------------------------------------------------------------

create unique index if not exists driver_locations_driver_id_uidx
  on public.driver_locations(driver_id);
create index if not exists driver_locations_last_seen_idx
  on public.driver_locations(last_seen_at desc);
create index if not exists driver_location_history_driver_recorded_idx
  on public.driver_location_history(driver_id,recorded_at desc);

create or replace function public.driver_coordinate_compatibility_health(
  p_email text default 'driver@daynightae.com'
)
returns jsonb
language sql
security definer
stable
set search_path = public, auth
as $dn$
  with target as (
    select au.id
    from auth.users au
    where lower(au.email)=lower(p_email)
    limit 1
  ), driver as (
    select dp.id
    from public.driver_profiles dp,target t
    where dp.id=t.id or dp.user_id=t.id
    limit 1
  ), latest as (
    select dl.*
    from public.driver_locations dl,driver d
    where dl.driver_id=d.id
    order by dl.last_seen_at desc nulls last
    limit 1
  )
  select jsonb_build_object(
    'ok',
      exists(select 1 from target)
      and exists(select 1 from driver)
      and exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='driver_locations' and column_name='lat'
      )
      and exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='driver_locations' and column_name='latitude'
      )
      and exists(
        select 1 from pg_trigger
        where tgrelid='public.driver_locations'::regclass
          and tgname='driver_locations_sync_coordinate_aliases'
          and not tgisinternal
      )
      and to_regprocedure('public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text)') is not null,
    'auth_user',exists(select 1 from target),
    'driver_profile',exists(select 1 from driver),
    'lat_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='driver_locations' and column_name='lat'),
    'lng_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='driver_locations' and column_name='lng'),
    'latitude_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='driver_locations' and column_name='latitude'),
    'longitude_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='driver_locations' and column_name='longitude'),
    'sync_trigger',exists(select 1 from pg_trigger where tgrelid='public.driver_locations'::regclass and tgname='driver_locations_sync_coordinate_aliases' and not tgisinternal),
    'location_rpc',to_regprocedure('public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text)') is not null,
    'latest_real_location',case when exists(select 1 from latest) then jsonb_build_object(
      'lat',(select lat from latest),
      'lng',(select lng from latest),
      'latitude',(select latitude from latest),
      'longitude',(select longitude from latest),
      'accuracy',(select accuracy from latest),
      'last_seen_at',(select last_seen_at from latest)
    ) else null end
  )
$dn$;

grant execute on function public.driver_coordinate_compatibility_health(text) to authenticated;

select public.driver_coordinate_compatibility_health('driver@daynightae.com');
