-- DAY NIGHT DELIVERY SERVICES
-- Storage combines permissive policies with OR semantics, but PostgreSQL may
-- evaluate public.is_driver() while an anonymous complaint attachment is being
-- authorized. The helper is SECURITY DEFINER and returns false when auth.uid()
-- is null, so allowing anon to execute it does not grant driver access.

begin;

revoke all on function public.is_driver() from public;
grant execute on function public.is_driver() to authenticated, service_role, anon;

notify pgrst, 'reload schema';

commit;
