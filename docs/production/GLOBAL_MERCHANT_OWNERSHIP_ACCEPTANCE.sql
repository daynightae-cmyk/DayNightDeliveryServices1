-- DAY NIGHT DELIVERY SERVICES
-- Run only after both ownership migrations are applied from a trusted admin session.
-- These queries create audit snapshots only. They never apply ownership or finance repairs.

-- 1) Complete order, merchant-account, dependent ownership and finance inventory.
select public.admin_run_global_merchant_system_dry_run(
  'Production acceptance inventory for global merchant ownership'
) as dry_run;

-- Copy the audit_id returned above into the next query.
-- 2) Full affected-row report and expected merchant count matrix.
-- select public.admin_global_merchant_ownership_report('<AUDIT_ID>'::uuid);

-- 3) Complete merchant/account-link inventory.
select public.admin_merchant_identity_inventory();

-- 4) Every active merchant must have expected database/admin/portal counts.
select public.admin_merchant_ownership_visibility_matrix();

-- 5) Required acceptance order and expected merchant code.
select public.admin_order_merchant_acceptance('010505', '1999');

-- 6) Finance must be authoritative with zero variance before final acceptance.
select public.admin_finance_reconciliation_health();

-- No apply call belongs in this file.
-- Reviewed ownership apply is documented only in the protected runbook:
-- admin_apply_global_merchant_ownership_repair(audit_id, 'APPLY_AUTO_REPAIR_SAFE')
-- Separate reviewed finance reconciliation is also documented only in the runbook:
-- admin_apply_global_merchant_finance_reconciliation(
--   audit_id,
--   'RECONCILE_MISSING_FINANCE_ROWS_FROM_REVIEWED_ORDER_SNAPSHOTS'
-- )
