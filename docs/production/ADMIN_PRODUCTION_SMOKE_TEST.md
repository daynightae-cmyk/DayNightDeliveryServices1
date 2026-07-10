# Admin Production Smoke Test

Use this checklist after deployment without exposing secrets.

1. Login to `/auth` with an authorized admin account.
2. Open `/admin` and confirm `ProtectedAdminRoute` allows only admins.
3. Open Database Health and run the check.
4. Open Production Readiness and run the check.
5. Open Finance Dashboard and confirm whether finance is RPC, view, or derived.
6. Open Daily Closing.
7. Save Daily Closing and confirm no fake DB success is shown.
8. Open Print Invoices.
9. Create a print job and verify `print_jobs` status is visible.
10. Add Expense and verify it is saved or a clean warning is shown.
11. Add Adjustment and verify it is saved or a clean warning is shown.
12. Ask Khalifa: "هل التطبيق جاهز للإنتاج؟" and verify it references Production Readiness.
13. Enable audio and test sound.
14. Verify `/tracking` still works.
15. Verify `/customer` still works.
16. Verify `/driver` still works.
17. Confirm no raw Supabase errors, stack traces, secrets, raw JSON blobs, or conflict markers appear in the UI.
