-- =========================================================
-- DAY NIGHT — FINAL DRIVER OPERATIONS PRODUCTION SUITE
-- Existing project safe / additive / no fake data / no auth.users writes
-- =========================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Existing public profile compatibility
-- The production profiles table has no `name` column and historically required
-- a unique non-null phone. Email-auth drivers may legitimately have no phone yet.
-- -----------------------------------------------------------------------------

do $dn$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    alter table public.profiles alter column phone drop not null;
  end if;
end
$dn$;

-- -----------------------------------------------------------------------------
-- 2) Driver domain tables and columns
-- -----------------------------------------------------------------------------

create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  status text not null default 'active',
  shift_status text not null default 'offline',
  vehicle_type text,
  vehicle_plate text,
  vehicle_color text,
  emirate text,
  license_number text,
  emergency_contact text,
  last_status_note text,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles add column if not exists id uuid default gen_random_uuid();
alter table public.driver_profiles add column if not exists user_id uuid;
alter table public.driver_profiles add column if not exists full_name text;
alter table public.driver_profiles add column if not exists phone text;
alter table public.driver_profiles add column if not exists email text;
alter table public.driver_profiles add column if not exists status text not null default 'active';
alter table public.driver_profiles add column if not exists shift_status text not null default 'offline';
alter table public.driver_profiles add column if not exists vehicle_type text;
alter table public.driver_profiles add column if not exists vehicle_plate text;
alter table public.driver_profiles add column if not exists vehicle_color text;
alter table public.driver_profiles add column if not exists emirate text;
alter table public.driver_profiles add column if not exists license_number text;
alter table public.driver_profiles add column if not exists emergency_contact text;
alter table public.driver_profiles add column if not exists last_status_note text;
alter table public.driver_profiles add column if not exists joined_at timestamptz not null default now();
alter table public.driver_profiles add column if not exists created_at timestamptz not null default now();
alter table public.driver_profiles add column if not exists updated_at timestamptz not null default now();
update public.driver_profiles set id = gen_random_uuid() where id is null;
create unique index if not exists driver_profiles_id_uidx on public.driver_profiles(id);
create index if not exists driver_profiles_user_id_idx on public.driver_profiles(user_id);
create index if not exists driver_profiles_status_idx on public.driver_profiles(status, shift_status);

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  lat double precision,
  lng double precision,
  accuracy double precision,
  heading double precision,
  speed double precision,
  altitude double precision,
  is_online boolean not null default false,
  battery_level numeric(5,2),
  network_state text,
  current_order_id uuid,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_locations add column if not exists id uuid default gen_random_uuid();
alter table public.driver_locations add column if not exists driver_id uuid;
alter table public.driver_locations add column if not exists lat double precision;
alter table public.driver_locations add column if not exists lng double precision;
alter table public.driver_locations add column if not exists accuracy double precision;
alter table public.driver_locations add column if not exists heading double precision;
alter table public.driver_locations add column if not exists speed double precision;
alter table public.driver_locations add column if not exists altitude double precision;
alter table public.driver_locations add column if not exists is_online boolean not null default false;
alter table public.driver_locations add column if not exists battery_level numeric(5,2);
alter table public.driver_locations add column if not exists network_state text;
alter table public.driver_locations add column if not exists current_order_id uuid;
alter table public.driver_locations add column if not exists last_seen_at timestamptz not null default now();
alter table public.driver_locations add column if not exists created_at timestamptz not null default now();
alter table public.driver_locations add column if not exists updated_at timestamptz not null default now();
update public.driver_locations set id = gen_random_uuid() where id is null;

-- Keep one current-location row per driver before creating the upsert constraint.
with ranked as (
  select ctid,
         row_number() over (
           partition by driver_id
           order by coalesce(updated_at, last_seen_at, created_at, now()) desc, ctid desc
         ) as rn
  from public.driver_locations
  where driver_id is not null
)
delete from public.driver_locations target
using ranked
where target.ctid = ranked.ctid and ranked.rn > 1;

create unique index if not exists driver_locations_id_uidx on public.driver_locations(id);
create unique index if not exists driver_locations_driver_id_uidx on public.driver_locations(driver_id);
create index if not exists driver_locations_last_seen_idx on public.driver_locations(last_seen_at desc);

create table if not exists public.driver_location_history (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  order_id uuid,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  altitude double precision,
  recorded_at timestamptz not null default now()
);

alter table public.driver_location_history add column if not exists id uuid default gen_random_uuid();
alter table public.driver_location_history add column if not exists driver_id uuid;
alter table public.driver_location_history add column if not exists order_id uuid;
alter table public.driver_location_history add column if not exists lat double precision;
alter table public.driver_location_history add column if not exists lng double precision;
alter table public.driver_location_history add column if not exists accuracy double precision;
alter table public.driver_location_history add column if not exists heading double precision;
alter table public.driver_location_history add column if not exists speed double precision;
alter table public.driver_location_history add column if not exists altitude double precision;
alter table public.driver_location_history add column if not exists recorded_at timestamptz not null default now();
update public.driver_location_history set id = gen_random_uuid() where id is null;
create unique index if not exists driver_location_history_id_uidx on public.driver_location_history(id);
create index if not exists driver_location_history_driver_time_idx on public.driver_location_history(driver_id, recorded_at desc);
create index if not exists driver_location_history_order_time_idx on public.driver_location_history(order_id, recorded_at desc);

create table if not exists public.driver_events (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  event_type text not null,
  order_id uuid,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists driver_events_driver_time_idx on public.driver_events(driver_id, created_at desc);
create index if not exists driver_events_order_time_idx on public.driver_events(order_id, created_at desc);

alter table public.orders add column if not exists driver_id uuid;
alter table public.orders add column if not exists assigned_driver_id uuid;
alter table public.orders add column if not exists driver_name text;
alter table public.orders add column if not exists driver_phone text;
create index if not exists orders_driver_id_idx on public.orders(driver_id);
create index if not exists orders_assigned_driver_id_idx on public.orders(assigned_driver_id);
create index if not exists orders_driver_status_idx on public.orders(assigned_driver_id, status);

alter table public.order_status_history add column if not exists driver_id uuid;
alter table public.order_status_history add column if not exists changed_by uuid;
alter table public.order_status_history add column if not exists note text;
alter table public.order_status_history add column if not exists created_at timestamptz not null default now();
create index if not exists order_status_history_driver_idx on public.order_status_history(driver_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 3) Helpers
-- -----------------------------------------------------------------------------

create or replace function public.driver_safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $dn$
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;
  return p_value::uuid;
exception when others then
  return null;
end
$dn$;

create or replace function public.driver_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $dn$
  select coalesce(exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text in ('admin','support')
  ), false)
$dn$;

create or replace function public.driver_try_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $dn$
begin
  if p_user_id is null or to_regclass('public.notifications') is null then return; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='title')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='message') then
    execute 'insert into public.notifications(user_id,title,message,type,created_at) values ($1,$2,$3,$4,now())'
      using p_user_id, p_title, p_message, p_type;
  end if;
exception when others then
  raise notice 'Notification skipped: %', sqlerrm;
end
$dn$;

create or replace function public.driver_audit(
  p_driver_id uuid,
  p_event_type text,
  p_order_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $dn$
begin
  insert into public.driver_events(driver_id,event_type,order_id,payload,actor_id,created_at)
  values (p_driver_id,p_event_type,p_order_id,coalesce(p_payload,'{}'::jsonb),auth.uid(),now());

  if to_regclass('public.admin_audit_events') is not null then
    insert into public.admin_audit_events(entity_type,entity_id,action,metadata,actor_id,created_at)
    values ('driver',p_driver_id::text,p_event_type,coalesce(p_payload,'{}'::jsonb),auth.uid(),now());
  end if;
exception when others then
  raise notice 'Driver audit skipped: %', sqlerrm;
end
$dn$;

-- -----------------------------------------------------------------------------
-- 4) Driver RPCs
-- -----------------------------------------------------------------------------

create or replace function public.driver_get_session_profile()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $dn$
declare
  v_profile public.profiles%rowtype;
  v_driver public.driver_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles where id = auth.uid() limit 1;
  if not found then raise exception 'driver_setup_required: public profile missing'; end if;
  if v_profile.role::text <> 'driver' then raise exception 'not_driver'; end if;

  select * into v_driver
  from public.driver_profiles
  where user_id = auth.uid()
  order by created_at desc nulls last
  limit 1;
  if not found then raise exception 'driver_setup_required: operational driver profile missing'; end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'role', v_profile.role::text,
      'full_name', v_profile.full_name,
      'phone', v_profile.phone,
      'is_active', v_profile.is_active
    ),
    'driver', to_jsonb(v_driver)
  );
end
$dn$;

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
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;

  select * into v_driver from public.driver_profiles
  where user_id = auth.uid() and status = 'active'
  order by created_at desc nulls last limit 1;
  if not found then raise exception 'driver_setup_required'; end if;

  insert into public.driver_locations(
    driver_id,lat,lng,accuracy,heading,speed,altitude,is_online,battery_level,network_state,current_order_id,last_seen_at,created_at,updated_at
  ) values (
    v_driver.id,p_lat,p_lng,p_accuracy,p_heading,p_speed,p_altitude,true,p_battery_level,p_network_state,v_order_id,now(),now(),now()
  )
  on conflict (driver_id) do update set
    lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,heading=excluded.heading,
    speed=excluded.speed,altitude=excluded.altitude,is_online=true,battery_level=excluded.battery_level,
    network_state=excluded.network_state,current_order_id=excluded.current_order_id,last_seen_at=now(),updated_at=now();

  insert into public.driver_location_history(driver_id,order_id,lat,lng,accuracy,heading,speed,altitude,recorded_at)
  values (v_driver.id,v_order_id,p_lat,p_lng,p_accuracy,p_heading,p_speed,p_altitude,now());

  update public.driver_profiles
  set shift_status = case when v_order_id is null then 'available' else 'busy' end,
      updated_at = now()
  where id = v_driver.id;

  perform public.driver_audit(v_driver.id,'location_reported',v_order_id,jsonb_build_object('accuracy',p_accuracy,'speed',p_speed,'network',p_network_state));
  return jsonb_build_object('ok',true,'driver_id',v_driver.id,'recorded_at',now());
end
$dn$;

create or replace function public.driver_set_presence(
  p_online boolean,
  p_shift_status text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_shift text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_driver from public.driver_profiles where user_id=auth.uid() order by created_at desc nulls last limit 1;
  if not found then raise exception 'driver_setup_required'; end if;

  v_shift := case
    when not coalesce(p_online,false) then 'offline'
    when p_shift_status in ('available','busy','paused') then p_shift_status
    else 'available'
  end;

  update public.driver_profiles
  set shift_status=v_shift,last_status_note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now()
  where id=v_driver.id;

  update public.driver_locations
  set is_online=coalesce(p_online,false),last_seen_at=now(),updated_at=now()
  where driver_id=v_driver.id;

  perform public.driver_audit(v_driver.id,'presence_changed',null,jsonb_build_object('online',p_online,'shift_status',v_shift,'note',p_note));
  return jsonb_build_object('ok',true,'driver_id',v_driver.id,'shift_status',v_shift);
end
$dn$;

create or replace function public.driver_update_order_status(
  p_order_id text,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order public.orders%rowtype;
  v_status text := lower(replace(btrim(coalesce(p_status,'')),' ','_'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_status = 'failed' then v_status := 'cancelled'; end if;
  if v_status not in ('accepted','confirmed','picked_up','in_transit','delivered','cancelled','returned','postponed') then
    raise exception 'unsupported_driver_status: %', p_status;
  end if;
  if v_status in ('delivered','cancelled','returned') and nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'status_note_required';
  end if;

  select * into v_driver from public.driver_profiles
  where user_id=auth.uid() and status='active'
  order by created_at desc nulls last limit 1;
  if not found then raise exception 'driver_setup_required'; end if;

  select * into v_order from public.orders
  where (id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id)
    and (driver_id=v_driver.id or assigned_driver_id=v_driver.id)
  limit 1;
  if not found then raise exception 'order_not_assigned_to_driver'; end if;

  update public.orders set status=v_status,driver_id=v_driver.id,assigned_driver_id=v_driver.id,
    driver_name=coalesce(v_driver.full_name,driver_name),driver_phone=coalesce(v_driver.phone,driver_phone),updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
  values (v_order.id,v_status,coalesce(nullif(btrim(coalesce(p_note,'')),''),'Driver status update'),v_driver.id,auth.uid(),now());

  if v_status in ('delivered','cancelled','returned') then
    update public.driver_locations set current_order_id=null,updated_at=now() where driver_id=v_driver.id and current_order_id=v_order.id;
    update public.driver_profiles set shift_status='available',updated_at=now() where id=v_driver.id;
  else
    update public.driver_locations set current_order_id=v_order.id,updated_at=now() where driver_id=v_driver.id;
    update public.driver_profiles set shift_status='busy',updated_at=now() where id=v_driver.id;
  end if;

  perform public.driver_audit(v_driver.id,'order_status_updated',v_order.id,jsonb_build_object('status',v_status,'note',p_note));
  return jsonb_build_object('ok',true,'order_id',v_order.id,'status',v_status);
end
$dn$;

-- -----------------------------------------------------------------------------
-- 5) Admin RPCs
-- -----------------------------------------------------------------------------

create or replace function public.admin_assign_driver(
  p_order_id text,
  p_driver_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
  v_order public.orders%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  select * into v_driver from public.driver_profiles where id=p_driver_id and status='active' limit 1;
  if not found then raise exception 'active_driver_not_found'; end if;

  select * into v_order from public.orders
  where id::text=p_order_id or tracking_number=p_order_id or invoice_number=p_order_id or coupon_number=p_order_id
  limit 1;
  if not found then raise exception 'order_not_found'; end if;

  update public.orders
  set driver_id=v_driver.id,assigned_driver_id=v_driver.id,driver_name=v_driver.full_name,driver_phone=v_driver.phone,status='assigned',updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into public.order_status_history(order_id,status,note,driver_id,changed_by,created_at)
  values (v_order.id,'assigned',coalesce(nullif(btrim(coalesce(p_note,'')),''),'Admin assigned driver'),v_driver.id,auth.uid(),now());

  update public.driver_profiles set shift_status=case when shift_status='offline' then 'offline' else 'busy' end,updated_at=now() where id=v_driver.id;
  perform public.driver_try_notification(v_driver.user_id,'New assigned order',coalesce(v_order.tracking_number,v_order.id::text),'driver_assignment');
  perform public.driver_audit(v_driver.id,'order_assigned',v_order.id,jsonb_build_object('note',p_note));
  return jsonb_build_object('ok',true,'order_id',v_order.id,'driver_id',v_driver.id);
end
$dn$;

create or replace function public.admin_update_driver_profile(
  p_driver_id uuid,
  p_full_name text,
  p_phone text default null,
  p_status text default 'active',
  p_shift_status text default null,
  p_vehicle_type text default null,
  p_vehicle_plate text default null,
  p_vehicle_color text default null,
  p_emirate text default null,
  p_license_number text default null,
  p_emergency_contact text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if nullif(btrim(coalesce(p_full_name,'')),'') is null then raise exception 'driver_name_required'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'invalid_driver_status'; end if;

  update public.driver_profiles set
    full_name=btrim(p_full_name),phone=nullif(btrim(coalesce(p_phone,'')),''),status=p_status,
    shift_status=case when p_status<>'active' then 'offline' when p_shift_status in ('offline','available','busy','paused') then p_shift_status else shift_status end,
    vehicle_type=nullif(btrim(coalesce(p_vehicle_type,'')),''),vehicle_plate=nullif(btrim(coalesce(p_vehicle_plate,'')),''),
    vehicle_color=nullif(btrim(coalesce(p_vehicle_color,'')),''),emirate=nullif(btrim(coalesce(p_emirate,'')),''),
    license_number=nullif(btrim(coalesce(p_license_number,'')),''),emergency_contact=nullif(btrim(coalesce(p_emergency_contact,'')),''),
    last_status_note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now()
  where id=p_driver_id returning * into v_driver;
  if not found then raise exception 'driver_not_found'; end if;

  update public.profiles set full_name=v_driver.full_name,phone=v_driver.phone,is_active=(v_driver.status='active'),updated_at=now()
  where id=v_driver.user_id;
  if v_driver.status<>'active' then update public.driver_locations set is_online=false,updated_at=now() where driver_id=v_driver.id; end if;

  perform public.driver_audit(v_driver.id,'profile_updated',null,jsonb_build_object('status',v_driver.status,'shift_status',v_driver.shift_status));
  return to_jsonb(v_driver);
end
$dn$;

create or replace function public.admin_set_driver_status(
  p_driver_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_driver public.driver_profiles%rowtype;
begin
  if not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'invalid_driver_status'; end if;
  update public.driver_profiles
  set status=p_status,shift_status=case when p_status='active' then shift_status else 'offline' end,
      last_status_note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now()
  where id=p_driver_id returning * into v_driver;
  if not found then raise exception 'driver_not_found'; end if;
  update public.profiles set is_active=(p_status='active'),updated_at=now() where id=v_driver.user_id;
  if p_status<>'active' then update public.driver_locations set is_online=false,updated_at=now() where driver_id=p_driver_id; end if;
  perform public.driver_audit(p_driver_id,'account_status_changed',null,jsonb_build_object('status',p_status,'note',p_note));
  return jsonb_build_object('ok',true,'driver_id',p_driver_id,'status',p_status);
end
$dn$;

-- Provision an already-created Supabase Auth user. It never writes auth.users or auth.identities.
create or replace function public.admin_provision_existing_driver(
  p_email text,
  p_full_name text,
  p_phone text default null,
  p_vehicle_type text default 'Toyota Rush',
  p_vehicle_plate text default null,
  p_emirate text default 'Abu Dhabi'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare
  v_user_id uuid;
  v_driver public.driver_profiles%rowtype;
begin
  -- auth.uid() is null in SQL Editor. Authenticated callers must be admin/support.
  if auth.uid() is not null and not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  select id into v_user_id from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if not found then raise exception 'auth_user_not_found: create % in Authentication first', p_email; end if;

  insert into public.profiles(id,role,full_name,phone,is_active,created_at,updated_at)
  values (v_user_id,'driver',btrim(p_full_name),nullif(btrim(coalesce(p_phone,'')),''),true,now(),now())
  on conflict (id) do update set role='driver',full_name=excluded.full_name,phone=excluded.phone,is_active=true,updated_at=now();

  select * into v_driver from public.driver_profiles where user_id=v_user_id order by created_at desc nulls last limit 1;
  if found then
    update public.driver_profiles set full_name=btrim(p_full_name),email=lower(btrim(p_email)),phone=nullif(btrim(coalesce(p_phone,'')),''),
      status='active',vehicle_type=coalesce(nullif(btrim(coalesce(p_vehicle_type,'')),''),'Toyota Rush'),
      vehicle_plate=nullif(btrim(coalesce(p_vehicle_plate,'')),''),emirate=nullif(btrim(coalesce(p_emirate,'')),''),updated_at=now()
    where id=v_driver.id returning * into v_driver;
  else
    insert into public.driver_profiles(user_id,full_name,email,phone,status,shift_status,vehicle_type,vehicle_plate,vehicle_color,emirate,joined_at,created_at,updated_at)
    values (v_user_id,btrim(p_full_name),lower(btrim(p_email)),nullif(btrim(coalesce(p_phone,'')),''),'active','offline',
      coalesce(nullif(btrim(coalesce(p_vehicle_type,'')),''),'Toyota Rush'),nullif(btrim(coalesce(p_vehicle_plate,'')),''),'White',
      nullif(btrim(coalesce(p_emirate,'')),''),now(),now(),now())
    returning * into v_driver;
  end if;

  perform public.driver_audit(v_driver.id,'driver_provisioned',null,jsonb_build_object('email',p_email));
  return jsonb_build_object('ok',true,'auth_user_id',v_user_id,'driver_profile_id',v_driver.id,'email',p_email);
end
$dn$;

create or replace function public.driver_cleanup_location_history(p_keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $dn$
declare v_count integer;
begin
  if auth.uid() is not null and not public.driver_is_admin() then raise exception 'not_authorized'; end if;
  delete from public.driver_location_history where recorded_at < now() - make_interval(days => greatest(p_keep_days,7));
  get diagnostics v_count = row_count;
  return v_count;
end
$dn$;

-- -----------------------------------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------------------------------

alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_location_history enable row level security;
alter table public.driver_events enable row level security;

drop policy if exists "drivers read own driver profile" on public.driver_profiles;
create policy "drivers read own driver profile" on public.driver_profiles for select to authenticated
using (user_id=auth.uid() or public.driver_is_admin());

drop policy if exists "admins manage driver profiles" on public.driver_profiles;
create policy "admins manage driver profiles" on public.driver_profiles for all to authenticated
using (public.driver_is_admin()) with check (public.driver_is_admin());

drop policy if exists "drivers upsert own current location" on public.driver_locations;
drop policy if exists "admins read all driver locations" on public.driver_locations;
create policy "drivers read own current location" on public.driver_locations for select to authenticated
using (exists(select 1 from public.driver_profiles dp where dp.id=driver_locations.driver_id and dp.user_id=auth.uid()) or public.driver_is_admin());
create policy "admins manage driver locations" on public.driver_locations for all to authenticated
using (public.driver_is_admin()) with check (public.driver_is_admin());

drop policy if exists "drivers insert own trail" on public.driver_location_history;
drop policy if exists "drivers read own trail" on public.driver_location_history;
create policy "drivers read own trail" on public.driver_location_history for select to authenticated
using (exists(select 1 from public.driver_profiles dp where dp.id=driver_location_history.driver_id and dp.user_id=auth.uid()) or public.driver_is_admin());
create policy "admins manage driver trail" on public.driver_location_history for all to authenticated
using (public.driver_is_admin()) with check (public.driver_is_admin());

create policy "drivers read own events" on public.driver_events for select to authenticated
using (exists(select 1 from public.driver_profiles dp where dp.id=driver_events.driver_id and dp.user_id=auth.uid()) or public.driver_is_admin());
create policy "admins manage driver events" on public.driver_events for all to authenticated
using (public.driver_is_admin()) with check (public.driver_is_admin());

drop policy if exists "drivers read assigned orders" on public.orders;
create policy "drivers read assigned orders" on public.orders for select to authenticated
using (exists(select 1 from public.driver_profiles dp where dp.user_id=auth.uid() and (dp.id=orders.driver_id or dp.id=orders.assigned_driver_id)) or public.driver_is_admin());

-- Remove broad direct driver updates. Driver status changes go through the validated RPC.
drop policy if exists "drivers update assigned order status" on public.orders;

alter table public.order_status_history enable row level security;
drop policy if exists "drivers insert assigned order history" on public.order_status_history;
drop policy if exists "drivers read assigned order history" on public.order_status_history;
create policy "drivers read assigned order history" on public.order_status_history for select to authenticated
using (exists(select 1 from public.driver_profiles dp join public.orders o on o.id=order_status_history.order_id where dp.user_id=auth.uid() and (o.driver_id=dp.id or o.assigned_driver_id=dp.id)) or public.driver_is_admin());

-- -----------------------------------------------------------------------------
-- 7) Grants and Realtime
-- -----------------------------------------------------------------------------

grant select on public.driver_profiles,public.driver_locations,public.driver_location_history,public.driver_events to authenticated;
grant execute on function public.driver_get_session_profile() to authenticated;
grant execute on function public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text) to authenticated;
grant execute on function public.driver_set_presence(boolean,text,text) to authenticated;
grant execute on function public.driver_update_order_status(text,text,text) to authenticated;
grant execute on function public.admin_assign_driver(text,uuid,text) to authenticated;
grant execute on function public.admin_update_driver_profile(uuid,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_set_driver_status(uuid,text,text) to authenticated;
grant execute on function public.admin_provision_existing_driver(text,text,text,text,text,text) to authenticated;
grant execute on function public.driver_cleanup_location_history(integer) to authenticated;

do $dn$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='driver_profiles') then alter publication supabase_realtime add table public.driver_profiles; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='driver_locations') then alter publication supabase_realtime add table public.driver_locations; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='driver_location_history') then alter publication supabase_realtime add table public.driver_location_history; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='driver_events') then alter publication supabase_realtime add table public.driver_events; end if;
  end if;
exception when others then
  raise notice 'Realtime publication update skipped: %',sqlerrm;
end
$dn$;

-- Final database-side verification helper.
create or replace function public.driver_module_health()
returns jsonb
language sql
security definer
stable
set search_path = public
as $dn$
  select jsonb_build_object(
    'driver_profiles', (select count(*) from public.driver_profiles),
    'online_locations', (select count(*) from public.driver_locations where is_online=true and last_seen_at>now()-interval '10 minutes'),
    'history_points', (select count(*) from public.driver_location_history),
    'assigned_orders', (select count(*) from public.orders where assigned_driver_id is not null or driver_id is not null),
    'session_rpc', to_regprocedure('public.driver_get_session_profile()') is not null,
    'location_rpc', to_regprocedure('public.driver_report_location(double precision,double precision,double precision,double precision,double precision,double precision,text,numeric,text)') is not null,
    'status_rpc', to_regprocedure('public.driver_update_order_status(text,text,text)') is not null,
    'assign_rpc', to_regprocedure('public.admin_assign_driver(text,uuid,text)') is not null
  )
$dn$;

grant execute on function public.driver_module_health() to authenticated;
