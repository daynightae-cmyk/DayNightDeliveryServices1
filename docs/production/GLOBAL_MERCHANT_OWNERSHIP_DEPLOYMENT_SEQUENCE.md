# Production Deployment Sequence

1. Review and merge only with all required code checks green.
2. Confirm the target project ref is exactly `ngdwybpgacauorygoedi`.
3. From a trusted operator context, apply only:
   - `20260802023000_global_order_merchant_ownership_restoration.sql`
   - `20260802024000_global_order_merchant_ownership_followup.sql`
4. Do **not** run either apply RPC during schema deployment.
5. Configure protected real-account evidence inputs, including at least two distinct merchants in `RUNTIME_MERCHANT_ACCOUNTS_JSON`.
6. Dispatch `Global Merchant Ownership Production Audit` from trusted `main`.
7. Download and review both JSON artifacts: complete system dry run and authenticated multi-merchant isolation.
8. Resolve every `MANUAL_REVIEW`, `SECURITY_CONFLICT`, `MISSING_MERCHANT`, and `MISSING_PORTAL_LINK` row without editing order/customer/financial facts.
9. Run another trusted audit until ownership status is `completed`, the merchant matrix is `PASS`, coupon `010505` resolves to merchant code `1999`, and multi-account isolation passes.
10. Obtain explicit human approval for the exact audit ID.
11. Call `admin_apply_global_merchant_ownership_repair(audit_id, 'APPLY_AUTO_REPAIR_SAFE')` once from a trusted real admin session.
12. Re-run the complete dry run and verify ownership and dependent UUIDs.
13. Inspect `admin_finance_reconciliation_health()`. If variance is already non-zero, stop and investigate; do not reconcile around it.
14. If only authoritative rows are missing and pre-existing variance is zero, obtain separate approval and call `admin_apply_global_merchant_finance_reconciliation(audit_id, 'RECONCILE_MISSING_FINANCE_ROWS_FROM_REVIEWED_ORDER_SNAPSHOTS')`.
15. Re-run finance health and require `authoritative = true`, `writes_allowed = true`, and `variance_zero = true`.
16. Test Admin All Orders, merchant-specific admin view, merchant portal, PWA, browser, multiple merchant accounts and RLS isolation.
17. Complete the final report with actual counts, zero financial variance, coupon `010505`/merchant `1999` evidence, commit SHA, PR and production URL.

Never run destructive migration-history repair, `db reset --linked`, `db push --include-all`, `TRUNCATE`, `CASCADE`, RLS disablement, or automatic PR-time production mutation.
