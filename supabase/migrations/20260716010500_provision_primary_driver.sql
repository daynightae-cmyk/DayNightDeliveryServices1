-- DAY NIGHT — Provision the existing Auth account without touching auth.users/passwords.
do $dn$
begin
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
