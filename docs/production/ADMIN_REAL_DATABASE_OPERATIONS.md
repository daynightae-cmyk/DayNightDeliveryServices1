# Admin Real Database Operations Pass

Route: `/admin`

## Purpose

This pass removes UI-only operational rows from finance/operations branches. Sections must display either:

1. rows saved in Supabase production tables, or
2. a clear database-unavailable / no-saved-rows state.

No section should present fake, placeholder, or UI-derived rows as if they are production data.

## New migration

`supabase/migrations/20260711173000_admin_real_operation_rows.sql`

Adds:

- `dn_safe_uuid(text)`
- `dn_safe_numeric(text, numeric)`
- `dn_safe_date(text, date)`
- `admin_sync_order_operation_rows()`

The sync function reads real rows from `orders` and creates real operational rows in:

- `cod_collections`
- `merchant_statement_entries`
- `driver_statement_entries`
- `admin_audit_events`

It is idempotent through `not exists` checks and supporting indexes. It does not delete, truncate, or overwrite business data.

## Updated frontend helpers

`artifacts/day-night-delivery/src/lib/adminProductionData.ts`

Provides DB-only helpers:

- `syncAdminProductionRows()`
- `fetchProductionRows(sectionId, filters)`
- `fetchProductionFinanceSummary()`
- `fetchProductionCodRows()`
- `fetchProductionStatementSummary(kind, filters)`

These helpers do not synthesize fake rows. If Supabase, migrations, or RLS are unavailable, they return an unavailable state and message.

## Updated UI branches

`AdminOperationsLayer.tsx`

- Expenses: reads/writes `admin_expenses`.
- Adjustments: reads/writes `admin_adjustments`.
- COD: reads `cod_collections` after production sync.
- Merchant statements: reads `merchant_statement_entries` after production sync.
- Driver statements: reads `driver_statement_entries` after production sync.
- Print: reads `print_jobs`; it can create saved print jobs from real orders.
- Import: saves preview rows into `import_batches` and `import_batch_rows`.
- Audit: reads `admin_audit_events`.
- Reports: joins only real rows from production admin tables.

`AdminFinanceOperationsCenter.tsx`

- Uses the DB-backed production helper layer.
- Does not show derived finance numbers as production.
- Shows clear warnings when DB/RLS/migration is unavailable.
- Reconciles COD by updating a saved `cod_collections` row.

## Manual verification

After merge and deploy:

1. Apply the migration in Supabase SQL Editor if it was not applied automatically.
2. Open `/admin`.
3. Go to `فحص قاعدة البيانات` and verify:
   - `cod_collections`
   - `merchant_statement_entries`
   - `driver_statement_entries`
   - `admin_audit_events`
   - `admin_sync_order_operation_rows`
4. Go to `التحصيل COD` and click `مزامنة الإنتاج`.
5. Confirm rows have real IDs from Supabase, not `derived-*` IDs.
6. Go to `كشوفات التجار` and `كشوفات المناديب`.
7. Confirm rows are loaded from DB tables or an unavailable/no-saved-rows message is shown.
8. Go to `لوحة المالية` and confirm no text says derived fallback is production.

## Production rule

If a table/RPC is not available, the UI must say it is unavailable. It must not silently replace the table with fake rows.
