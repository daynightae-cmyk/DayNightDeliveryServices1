# Admin Operations Migration Checklist

This checklist verifies that the production Supabase project is ready for the admin finance, closing, print, import, and audit features. Never include Supabase secrets in tickets, screenshots, or SQL comments.

## Required migrations

Apply these SQL migrations in order:

1. `20260710072000_finance_summary_view_rpc.sql`
2. `20260710120000_admin_daily_closing.sql`

## How to verify in Supabase SQL Editor

1. Open the Supabase Dashboard for the production project.
2. Open **SQL Editor**.
3. Run `docs/supabase/VERIFY_ADMIN_OPERATIONS.sql`.
4. Open `/admin` and navigate to **النظام / Database Health**.
5. Press **Re-run checks** and export/copy the report if support needs it.

## Health colors

- **Green**: object exists and the current admin client can use it.
- **Yellow**: object exists but currently has no data; this can be acceptable after a fresh migration.
- **Red**: object is missing or a migration is required.
- **Blue**: permission/RLS or verification issue; review policies and user role.

## Schema cache warnings

If Supabase returns a schema cache warning after a migration, the SQL may be applied but PostgREST has not refreshed metadata yet. Re-run the SQL object checks first, then refresh the Supabase schema cache.

## Refreshing Supabase schema cache

- In the Supabase Dashboard, reload the API/schema area or pause briefly and retry.
- If available in the project, trigger the documented PostgREST schema reload mechanism.
- Re-run Database Health Center after refresh.

## Fallback-derived vs DB-backed

- **Fallback-derived** means the app calculates finance/closing values from loaded `orders` and available rows because specialized finance objects are unavailable.
- **DB-backed** means the app reads/writes the intended Supabase table, view, or RPC such as `finance_summary`, `get_finance_summary()`, `admin_daily_closings`, or `print_jobs`.

## What to test in `/admin`

- Dashboard opens without raw Supabase errors.
- Settings still opens and saves local admin preferences.
- Technical Support still opens.
- Database Health opens and handles missing objects cleanly.
- Finance Dashboard opens and indicates derived fallback if DB objects are not available.
- Daily closing panel works without claiming DB success when `admin_daily_closings` is missing.
- Print queue tools do not claim persistence when `print_jobs` is unavailable.
- PDF export from Database Health includes summary counts and missing objects.
