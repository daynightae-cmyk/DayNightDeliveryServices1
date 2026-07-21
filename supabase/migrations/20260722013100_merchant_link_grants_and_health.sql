-- DAY NIGHT DELIVERY SERVICES
-- Follow-up grants and read-only health RPC for merchant linkage.

begin;

revoke all on table public.merchant_user_links from anon;
grant select on table public.merchant_user_links to authenticated;

create or replace function public.merchant_core_health()
returns jsonb
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select jsonb_build_object(
    'ok',
      auth.uid() is not null
      and public.merchant_session_id() is not null
      and to_regprocedure('public.merchant_create_order(jsonb)') is not null
      and to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null,
    'authenticated', auth.uid() is not null,
    'merchant_id', public.merchant_session_id(),
    'merchant_profile_linked', public.merchant_session_id() is not null,
    'merchant_create_order_ready', to_regprocedure('public.merchant_create_order(jsonb)') is not null,
    'admin_dispatch_runtime_ready', to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null,
    'merchant_orders_ready', to_regprocedure('public.merchant_portal_orders(integer)') is not null,
    'driver_runtime_ready', to_regprocedure('public.driver_update_order_status(jsonb)') is not null
  );
$$;

revoke all on function public.merchant_core_health() from public, anon;
grant execute on function public.merchant_core_health() to authenticated;

notify pgrst, 'reload schema';
commit;
