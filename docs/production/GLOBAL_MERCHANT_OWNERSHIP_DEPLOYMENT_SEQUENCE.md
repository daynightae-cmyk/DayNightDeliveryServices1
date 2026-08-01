# Production Deployment Sequence

1. Review and merge only with all required code checks green.
2. Confirm the target is the active DAY NIGHT production Supabase project.
3. Apply only `20260802023000_global_order_merchant_ownership_restoration.sql` from a trusted operator session.
4. Do **not** run the apply RPC.
5. Dispatch `Global Merchant Ownership Production Audit` from trusted `main`.
6. Download and review the full JSON artifact.
7. Resolve every `MANUAL_REVIEW`, `SECURITY_CONFLICT`, `MISSING_MERCHANT`, and `MISSING_PORTAL_LINK` row without editing financial/order facts.
8. Run another trusted dry run until the run status is `completed` and the complete merchant matrix is `PASS`.
9. Obtain explicit human approval for the exact audit ID.
10. Call `admin_apply_global_merchant_ownership_repair(audit_id, 'APPLY_AUTO_REPAIR_SAFE')` once from a trusted admin/service session.
11. Run a fresh dry run and the production audit workflow again.
12. Test Admin All Orders, merchant-specific admin view, merchant portal, PWA, web, multiple merchant accounts and RLS isolation.
13. Complete the final report with actual counts, zero financial variance and coupon `010505` evidence.

Never run destructive migration-history repair, `db reset --linked`, `db push --include-all`, `TRUNCATE`, or an automatic PR-time production mutation.
