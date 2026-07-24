-- DAY NIGHT — Prepare existing driver rows for unified employee import.
-- Prevents a nullable legacy driver status from violating the employee status constraint.

begin;

do $$
begin
  if to_regclass('public.driver_profiles') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'driver_profiles'
         and column_name = 'status'
     ) then
    update public.driver_profiles
    set status = 'active'
    where status is null;
  end if;
end;
$$;

commit;
