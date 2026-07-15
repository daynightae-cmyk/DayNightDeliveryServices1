-- DAY NIGHT — Provision the existing Auth account without touching auth.users/passwords.
-- Run 20260716010250_driver_enum_compatibility.sql first on legacy databases.

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
    raise exception 'driver_enum_compatibility_required: run 20260716010250_driver_enum_compatibility.sql first, then run this file again';
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
