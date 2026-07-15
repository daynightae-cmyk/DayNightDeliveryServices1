-- DAY NIGHT — Provision the existing Auth account without touching auth.users/passwords.
-- Legacy order:
-- 1) 20260716010250_driver_enum_compatibility.sql
-- 2) 20260716010350_driver_id_defaults.sql
-- 3) this provisioning migration

create extension if not exists pgcrypto;

do $dn$
declare
  v_status_type oid;
begin
  select att.atttypid
    into v_status_type
  from pg_attribute att
  join pg_class cls on cls.oid = att.attrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  where ns.nspname = 'public'
    and cls.relname = 'driver_profiles'
    and att.attname = 'status'
    and att.attnum > 0
    and not att.attisdropped
  limit 1;

  if v_status_type is not null
     and exists (select 1 from pg_type where oid = v_status_type and typtype = 'e')
     and not exists (select 1 from pg_enum where enumtypid = v_status_type and enumlabel = 'active') then
    raise exception 'driver_enum_compatibility_required: run 20260716010250_driver_enum_compatibility.sql first, commit it, then run this file again';
  end if;

  -- Defensive compatibility: old driver tables can have NOT NULL UUID ids with no defaults.
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_profiles' and column_name='id'
  ) then
    alter table public.driver_profiles alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_locations' and column_name='id'
  ) then
    alter table public.driver_locations alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_location_history' and column_name='id'
  ) then
    alter table public.driver_location_history alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='driver_events' and column_name='id'
  ) then
    alter table public.driver_events alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from auth.users where lower(email) = lower('driver@daynightae.com')
  ) then
    perform public.admin_provision_existing_driver(
      'driver@daynightae.com',
      'DAY NIGHT Driver',
      null,
      'Toyota Rush',
      null,
      'Abu Dhabi'
    );
  else
    raise exception 'Auth user driver@daynightae.com was not found. Create it in Authentication first.';
  end if;
end
$dn$;

select public.driver_module_health();

select
  au.email,
  p.role::text as profile_role,
  p.full_name,
  p.is_active,
  dp.id as driver_profile_id,
  dp.status::text as driver_status,
  dp.shift_status::text as shift_status,
  dp.vehicle_type,
  dp.vehicle_plate,
  dp.emirate
from auth.users au
join public.profiles p on p.id=au.id
join public.driver_profiles dp on dp.user_id=au.id
where lower(au.email)=lower('driver@daynightae.com');
