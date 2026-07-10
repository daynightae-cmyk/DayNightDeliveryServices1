# Admin Production Foundation SQL (Phase 8B)

This PR adds `supabase/migrations/20260711010000_admin_production_foundation.sql`. It creates the DB-backed admin production foundation for finance, COD, print jobs, daily closing, import history, audit logging, helper RPCs, and RLS.

## What it creates

- Tables: `admin_expenses`, `admin_adjustments`, `cod_collections`, `merchant_statement_entries`, `driver_statement_entries`, `import_batches`, `import_batch_rows`, `print_jobs`, `admin_daily_closings`, `admin_audit_events`.
- View: `finance_summary`.
- RPCs: `get_finance_summary`, `admin_create_expense`, `admin_create_adjustment`, `admin_create_print_job`, `admin_mark_print_job_printed`, `admin_save_daily_closing`, `admin_create_audit_event`.
- Helpers: `set_updated_at`, `current_profile_role`, `is_admin_or_support`.
- RLS: admin/support-only select, insert, and update policies; audit has no update/delete policy.

## Apply in Supabase SQL Editor

1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Paste and run `supabase/migrations/20260711010000_admin_production_foundation.sql`.
4. Run `docs/supabase/VERIFY_ADMIN_PRODUCTION_FOUNDATION.sql`.
5. Re-open `/admin`, then re-run Database Health and Production Readiness.

Do not treat this PR as proof that production Supabase has been updated. The migration must be applied manually in Supabase.

## Expected Database Health result

Required tables, `finance_summary`, and admin RPCs should appear green for an authenticated `admin` or `support` profile. Empty operational tables such as `print_jobs`, `admin_audit_events`, or `admin_daily_closings` can be acceptable for a new production install.

Arabic warning copy used by the app: `غير موجود — يحتاج تطبيق migration`.

## Expected Production Readiness result

Finance becomes ready only when `get_finance_summary()` is available and used. Fallback/derived operation remains safe, but it is a blocker for global readiness until migration verification succeeds.

## RLS role requirements

`public.profiles.id` must match `auth.uid()`, and `public.profiles.role` must be `admin` or `support` for admin operations. Anonymous users receive no admin policies.

## Rollback warning

Do not drop production tables to roll back. Preserve production data, disable new UI paths if needed, and restore from backups only through a controlled database plan.
