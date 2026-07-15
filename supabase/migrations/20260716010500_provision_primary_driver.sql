-- DAY NIGHT — Provision the existing Auth account after complete schema reconciliation.
-- Required legacy order:
-- 1) 20260716010250_driver_enum_compatibility.sql
-- 2) 20260716010350_driver_id_defaults.sql
-- 3) 20260716010400_driver_schema_reconciliation.sql
-- 4) this idempotent provisioning migration
--
-- This file never writes auth.users, auth.identities or passwords.

do $dn$
begin
  if to_regprocedure('public.driver_full_health(text)') is null then
    raise exception 'driver_schema_reconciliation_required: run 20260716010400_driver_schema_reconciliation.sql first';
  end if;

  if not exists (
    select 1 from auth.users
    where lower(email)=lower('driver@daynightae.com')
  ) then
    raise exception 'Auth user driver@daynightae.com was not found in Authentication';
  end if;

  perform public.admin_provision_existing_driver(
    'driver@daynightae.com',
    'DAY NIGHT Driver',
    null,
    'Toyota Rush',
    'DAY-NIGHT-01',
    'Abu Dhabi'
  );
end
$dn$;

select public.driver_full_health('driver@daynightae.com');

select
  au.email,
  p.id as profile_id,
  p.role::text as profile_role,
  p.full_name,
  p.is_active,
  dp.id as driver_profile_id,
  dp.user_id as driver_user_id,
  (dp.id=au.id and coalesce(dp.user_id,dp.id)=au.id) as identity_consistent,
  dp.status::text as driver_status,
  dp.shift_status::text as shift_status,
  dp.vehicle_type,
  dp.vehicle_plate,
  dp.vehicle_color,
  dp.emirate
from auth.users au
join public.profiles p on p.id=au.id
join public.driver_profiles dp on dp.id=au.id or dp.user_id=au.id
where lower(au.email)=lower('driver@daynightae.com')
order by case when dp.id=au.id then 0 else 1 end
limit 1;
