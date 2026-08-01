-- DAY NIGHT DELIVERY SERVICES
-- Run only after the migration is applied from a trusted production session.
-- These queries do not apply the backfill.

-- 1) Create a fresh complete inventory snapshot.
select public.admin_run_global_merchant_ownership_dry_run(
  'Production acceptance inventory for global merchant ownership'
) as dry_run;

-- Copy the audit_id returned above into the next query.
-- 2) Full affected-row report and merchant count matrix.
-- select public.admin_global_merchant_ownership_report('<AUDIT_ID>'::uuid);

-- 3) All active merchants must have matching database/admin/portal expected counts.
select public.admin_merchant_ownership_visibility_matrix();

-- 4) Required acceptance coupon.
select public.admin_order_merchant_acceptance('010505');

-- 5) No apply call belongs in this file.
-- The reviewed apply call is intentionally documented only in the protected runbook:
-- admin_apply_global_merchant_ownership_repair(audit_id, 'APPLY_AUTO_REPAIR_SAFE')
