# Admin Production Readiness

DAY NIGHT DELIVERY SERVICES UAE treats `/admin` as production-ready only when operational sections are backed by Supabase tables, views, or RPCs and failures are visible instead of hidden.

## Ready

Ready means the admin route is protected, required database objects exist, finance uses the `get_finance_summary` RPC, daily closing saves to `admin_daily_closings`, print jobs use `print_jobs`, audit events are stored, and high-volume order screens use pagination.

## DB-backed

DB-backed means an operation writes to or reads from the intended Supabase production object, such as `admin_expenses`, `admin_adjustments`, `cod_collections`, `print_jobs`, `admin_daily_closings`, `admin_audit_events`, and statement/import tables.

## Derived or fallback

Derived/fallback means the UI can keep working from loaded orders or local state when an object is missing. This is safer than fake success, but it is not a final financial, closing, print, or audit source.

## Required Supabase migrations

Apply migrations for: `orders`, `merchants`, `profiles`, `finance_summary`, `get_finance_summary`, `admin_daily_closings`, `print_jobs`, `admin_expenses`, `admin_adjustments`, `cod_collections`, `merchant_statement_entries`, `driver_statement_entries`, `import_batches`, `import_batch_rows`, and `admin_audit_events`.

## Required RLS verification

Manually verify Supabase RLS policies for admin users. Frontend checks can detect missing objects and permission symptoms, but they cannot prove the complete policy design.

## Tests before production

Run typecheck, build, conflict-marker scan, admin smoke tests, finance workflow tests, daily closing save tests, print-job creation tests, and route checks for `/auth`, `/admin`, `/tracking`, `/customer`, and `/driver`.

## Admin smoke checklist after deployment

Login, open Database Health, open Production Readiness, verify finance source, save daily closing, create a print job, add expense, add adjustment, ask Khalifa, test audio, and verify public/customer/driver routes.

## What prevents global readiness

Global readiness is blocked by missing migrations, finance derived from orders, local-only daily closing, missing `print_jobs`, missing audit events, unverified RLS, and heavy screens that still load large datasets without pagination.

## Phase 8B — Supabase production foundation

Apply `supabase/migrations/20260711010000_admin_production_foundation.sql` in Supabase SQL Editor before marking admin operations global-ready. Then run `docs/supabase/VERIFY_ADMIN_PRODUCTION_FOUNDATION.sql`, re-run Database Health, and re-run Production Readiness.

Expected remaining warnings: operational tables can be empty on a fresh install, but missing tables/RPCs or incorrect RLS permissions remain blockers. Fallback mode is honest temporary operation only: `تشغيل مؤقت — لم يتم تأكيد قاعدة البيانات بعد.` / `Temporary operation — database has not been confirmed yet.`
