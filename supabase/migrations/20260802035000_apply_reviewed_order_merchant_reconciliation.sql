-- Apply only the exact Dry Run reviewed in production.  The migration is
-- resumable across the three allowed statuses, and every call remains guarded
-- by the snapshot, row locks, audit logs, and financial before/after checks in
-- the reconciliation functions.
begin;

set local statement_timeout = '10min';
set local lock_timeout = '60s';
select set_config('request.jwt.claim.role', 'service_role', true);

do $migration$
declare
  v_run_id constant uuid := '37348f9e-60d8-4f6b-8cdf-b9181464f2b7';
  v_status text;
  v_order_result jsonb;
  v_finance_result jsonb;
  v_health jsonb;
  v_repair_audit_count integer;
begin
  select status into v_status
  from public.order_merchant_audit_runs
  where id = v_run_id;

  if v_status is null or v_status not in (
    'DRY_RUN_REVIEWED',
    'APPLIED_SAFE_ONLY',
    'FINANCE_RECONCILED_SAFE_ONLY'
  ) then
    raise exception 'exact_reviewed_run_status_rejected_%', coalesce(v_status, 'MISSING');
  end if;

  if v_status = 'DRY_RUN_REVIEWED' then
    v_order_result := public.admin_apply_order_merchant_safe_backfill(v_run_id, true);
    if coalesce((v_order_result ->> 'ok')::boolean, false) is not true
       or v_order_result ->> 'status' <> 'APPLIED_SAFE_ONLY'
       or coalesce((v_order_result ->> 'orders_updated')::integer, -1) <> 3
       or v_order_result -> 'financial_before' is distinct from v_order_result -> 'financial_after' then
      raise exception 'safe_order_repair_contract_failed: %', v_order_result;
    end if;
    v_status := 'APPLIED_SAFE_ONLY';
  end if;

  select count(*)::integer into v_repair_audit_count
  from public.order_merchant_repair_audit
  where run_id = v_run_id;
  if v_repair_audit_count <> 3 then
    raise exception 'safe_order_repair_audit_count_%_expected_3', v_repair_audit_count;
  end if;

  if v_status = 'APPLIED_SAFE_ONLY' then
    v_finance_result := public.admin_apply_safe_missing_financial_dependencies(v_run_id, true);
    if coalesce((v_finance_result ->> 'ok')::boolean, false) is not true
       or v_finance_result ->> 'status' <> 'FINANCE_RECONCILED_SAFE_ONLY'
       or coalesce((v_finance_result ->> 'orders_modified')::integer, -1) <> 0
       or coalesce((v_finance_result ->> 'settlements_inserted')::integer, -1) <> 0
       or coalesce((v_finance_result ->> 'merchant_account_entries_inserted')::integer, -1) <> 0
       or coalesce((v_finance_result ->> 'company_account_entries_inserted')::integer, -1) <> 0
       or coalesce((v_finance_result ->> 'cod_rows_inserted')::integer, -1) <> 21
       or coalesce((v_finance_result ->> 'merchant_statement_rows_inserted')::integer, -1) <> 43
       or coalesce((v_finance_result ->> 'driver_statement_rows_inserted')::integer, -1) <> 1
       or v_finance_result -> 'order_financial_before'
          is distinct from v_finance_result -> 'order_financial_after' then
      raise exception 'safe_finance_repair_contract_failed: %', v_finance_result;
    end if;
  end if;

  select status into v_status
  from public.order_merchant_audit_runs
  where id = v_run_id;
  if v_status <> 'FINANCE_RECONCILED_SAFE_ONLY' then
    raise exception 'reviewed_reconciliation_final_status_%', v_status;
  end if;

  v_health := public.admin_finance_reconciliation_health();
  if coalesce((v_health ->> 'ok')::boolean, false) is not true
     or coalesce((v_health -> 'variance' ->> 'merchant_due')::numeric, 1) <> 0
     or coalesce((v_health -> 'variance' ->> 'customer_total')::numeric, 1) <> 0
     or coalesce((v_health -> 'variance' ->> 'company_revenue')::numeric, 1) <> 0
     or coalesce((v_health -> 'variance' ->> 'collected_amount')::numeric, 1) <> 0
     or coalesce((v_health ->> 'missing_cod_rows')::integer, -1) <> 0
     or coalesce((v_health ->> 'missing_settlement_rows')::integer, -1) <> 0
     or coalesce((v_health ->> 'missing_merchant_statement_rows')::integer, -1) <> 0
     or coalesce((v_health ->> 'missing_driver_statement_rows')::integer, -1) <> 0 then
    raise exception 'post_reconciliation_financial_health_failed: %', v_health;
  end if;

  raise notice 'Reviewed order/merchant reconciliation completed: run %, audit rows %, finance health OK',
    v_run_id, v_repair_audit_count;
end;
$migration$;

commit;
