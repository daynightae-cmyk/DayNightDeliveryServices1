-- PostgREST sessions keep the existing JWT/admin authorization contract.  A
-- reviewed migration runs over a direct database connection, so permit only the
-- two privileged Supabase database session users to execute the two guarded
-- backfill functions without relying on forged portal JWT claims.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_old text := $old$
  if auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
$old$;
  v_new text := $new$
  if session_user not in ('postgres', 'supabase_admin')
     and auth.role() <> 'service_role'
     and (auth.uid() is null or not public.is_admin_or_support()) then
$new$;
begin
  foreach v_signature in array array[
    'public.admin_apply_order_merchant_safe_backfill(uuid,boolean)'::regprocedure,
    'public.admin_apply_safe_missing_financial_dependencies(uuid,boolean)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;
    if strpos(v_definition, v_new) > 0 then
      continue;
    end if;
    if strpos(v_definition, v_old) = 0 then
      raise exception 'privileged_db_reconciliation_executor_contract_not_found_%', v_signature;
    end if;
    execute replace(v_definition, v_old, v_new);
  end loop;
end;
$migration$;
