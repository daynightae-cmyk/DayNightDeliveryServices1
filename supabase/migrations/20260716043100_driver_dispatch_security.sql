-- =========================================================
-- DAY NIGHT — DISPATCH RPC SECURITY FINALIZATION
-- Restricts operational driver candidate data to authenticated admins.
-- =========================================================

create or replace function public.admin_dispatch_candidates_secure(p_order_id text default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $dn$
begin
  if not public.driver_is_admin() then
    raise exception 'not_authorized';
  end if;

  return public.admin_dispatch_candidates(p_order_id);
end
$dn$;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default. Remove that
-- implicit access and expose only the checked wrapper to signed-in users.
revoke execute on function public.admin_dispatch_candidates(text) from public;
revoke execute on function public.admin_dispatch_candidates(text) from anon;
revoke execute on function public.admin_dispatch_candidates(text) from authenticated;

revoke execute on function public.admin_dispatch_candidates_secure(text) from public;
revoke execute on function public.admin_dispatch_candidates_secure(text) from anon;
grant execute on function public.admin_dispatch_candidates_secure(text) to authenticated;

revoke execute on function public.admin_dispatch_order_runtime(jsonb) from public;
revoke execute on function public.admin_dispatch_order_runtime(jsonb) from anon;
grant execute on function public.admin_dispatch_order_runtime(jsonb) to authenticated;

revoke execute on function public.admin_dispatch_runtime_health() from public;
revoke execute on function public.admin_dispatch_runtime_health() from anon;
grant execute on function public.admin_dispatch_runtime_health() to authenticated;

create or replace function public.admin_dispatch_runtime_health()
returns jsonb
language sql
security definer
stable
set search_path = public
as $dn$
  select jsonb_build_object(
    'ok',
      to_regclass('public.driver_assignment_history') is not null
      and to_regprocedure('public.admin_dispatch_order(text,uuid,text,text,boolean)') is not null
      and to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null
      and to_regprocedure('public.admin_dispatch_candidates_secure(text)') is not null
      and has_function_privilege('authenticated', 'public.admin_dispatch_order_runtime(jsonb)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.admin_dispatch_candidates_secure(text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.admin_dispatch_candidates(text)', 'EXECUTE')
      and (
        select count(*) = 4
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'orders'
          and column_name in (
            'driver_assigned_at',
            'driver_assigned_by',
            'driver_assignment_note',
            'driver_assignment_version'
          )
      ),
    'assignment_history_table', to_regclass('public.driver_assignment_history') is not null,
    'transaction_rpc', to_regprocedure('public.admin_dispatch_order(text,uuid,text,text,boolean)') is not null,
    'runtime_rpc', to_regprocedure('public.admin_dispatch_order_runtime(jsonb)') is not null,
    'candidates_rpc', to_regprocedure('public.admin_dispatch_candidates_secure(text)') is not null,
    'runtime_execute_grant', has_function_privilege('authenticated', 'public.admin_dispatch_order_runtime(jsonb)', 'EXECUTE'),
    'candidates_execute_grant', has_function_privilege('authenticated', 'public.admin_dispatch_candidates_secure(text)', 'EXECUTE'),
    'anonymous_candidates_blocked', not has_function_privilege('anon', 'public.admin_dispatch_candidates(text)', 'EXECUTE'),
    'history_select_grant', has_table_privilege('authenticated', 'public.driver_assignment_history', 'SELECT'),
    'orders_assignment_metadata', (
      select count(*) = 4
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name in (
          'driver_assigned_at',
          'driver_assigned_by',
          'driver_assignment_note',
          'driver_assignment_version'
        )
    )
  );
$dn$;

select pg_notify('pgrst', 'reload schema');
select public.admin_dispatch_runtime_health();
