# Global Order → Merchant Ownership Restoration

## Scope

This runbook restores and proves exact merchant ownership for every existing and future order without deleting orders or merchants and without changing coupon numbers, tracking numbers, status, customer data or financial values.

The authoritative rule is:

```text
orders.merchant_id = merchants.id
merchant session → active merchant_user_links row, then safe non-conflicting merchants.user_id fallback
```

Names, codes, email and phone are dry-run evidence only. They never grant portal access.

## Production project

Use only the active project:

```text
ngdwybpgacauorygoedi
```

Never use a paused/retired project. Never run `supabase db reset --linked`, `db push --include-all`, destructive migration-history repair, `TRUNCATE`, `CASCADE`, or RLS disablement.

## Phase 0 — Preconditions

1. Merge only after TypeScript, production gate, build and merchant-ownership gate pass.
2. Obtain independent review. If Codex review is unavailable, record that limitation and use a human database/security reviewer.
3. Apply only these two migrations from a trusted production operator context:
   - `20260802023000_global_order_merchant_ownership_restoration.sql`
   - `20260802024000_global_order_merchant_ownership_followup.sql`
4. Do not expose service-role credentials to pull-request code.
5. Do not call either apply RPC during migration deployment.

The migrations create audit/report functions, exact portal pagination and future-write protections. They do not rewrite historical orders automatically.

## Phase 1 — Complete system dry run

Authenticate with the real protected admin account and run:

```sql
select public.admin_run_global_merchant_system_dry_run(
  'Global merchant ownership production inventory'
);
```

Record the returned `audit_id`, then fetch:

```sql
select public.admin_global_merchant_ownership_report('<AUDIT_ID>'::uuid);
select public.admin_merchant_identity_inventory();
select public.admin_merchant_ownership_visibility_matrix();
select public.admin_order_merchant_acceptance('010505', '1999');
select public.admin_finance_reconciliation_health();
```

The dry run classifies every order as one of:

- `ALREADY_CORRECT`
- `AUTO_REPAIR_SAFE`
- `MANUAL_REVIEW`
- `SECURITY_CONFLICT`
- `MISSING_MERCHANT`
- `MISSING_PORTAL_LINK`

No historical order or financial row is changed by these calls. The only writes are immutable diagnostic snapshots.

## Phase 2 — Mandatory review

Do not proceed while any row is unresolved. The run is `blocked` when any row is `MANUAL_REVIEW`, `SECURITY_CONFLICT`, `MISSING_MERCHANT`, or `MISSING_PORTAL_LINK`.

For every unresolved entity, verify:

1. active `merchant_user_links` relationship;
2. safe `merchants.user_id` fallback only when it does not conflict;
3. unique documented merchant code;
4. verified email/phone;
5. manual owner approval when identity is not mathematically unique.

Run a new complete system dry run after correcting merchant/account linkage. Do not edit order financial facts to make a report pass.

## Phase 3 — Explicit transactional ownership apply

Only after a reviewed dry run returns `status = completed`:

```sql
select public.admin_apply_global_merchant_ownership_repair(
  '<AUDIT_ID>'::uuid,
  'APPLY_AUTO_REPAIR_SAFE'
);
```

The RPC:

- locks the reviewed run and order rows;
- aborts if production data changed after the snapshot;
- updates only `merchant_id`, canonical `merchant_code`, canonical `merchant_name`, and `updated_at`;
- synchronizes merchant UUID ownership in supported dependent tables without changing amounts;
- writes immutable repair/audit records;
- compares global order count, status counts, COD, goods value, delivery fees, discounts, customer totals and merchant dues before/after;
- rolls back the complete call on any protected-field or financial variance.

## Phase 4 — Separate explicit finance reconciliation

Ownership apply does not invent missing accounting rows. After ownership is applied and reviewed, inspect:

```sql
select public.admin_finance_reconciliation_health();
```

If required finance tables are present, pre-existing value variance is zero, and only missing authoritative rows remain, obtain separate human approval and call:

```sql
select public.admin_apply_global_merchant_finance_reconciliation(
  '<AUDIT_ID>'::uuid,
  'RECONCILE_MISSING_FINANCE_ROWS_FROM_REVIEWED_ORDER_SNAPSHOTS'
);
```

This RPC uses the existing idempotent authoritative finance reconciler, requires ownership to have been applied first, verifies health after reconciliation, confirms order financial totals did not change, and records before/after evidence. It rolls back on any variance or incomplete result.

## Phase 5 — Trusted production evidence

Run from trusted `main`:

```text
Global Merchant Ownership Production Audit
```

Required protected inputs:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RUNTIME_ADMIN_EMAIL`
- `RUNTIME_ADMIN_PASSWORD`
- `RUNTIME_MERCHANT_ACCOUNTS_JSON` containing at least two distinct merchant accounts

The workflow authenticates as the real admin and real merchants. It never uses service-role to bypass portal RLS and never calls either apply RPC. It uploads:

```text
global-merchant-ownership-runtime-report.json
global-merchant-ownership-multi-account-report.json
```

## Required merchant matrix

Every active merchant must have:

```text
merchant_id | merchant_code | database_count | admin_count | portal_count | result
```

`result` must be `PASS`. The multi-account artifact must additionally prove that each portal returns only its exact merchant UUID, pagination totals match unique rows, and no order appears in two merchant accounts.

## Required acceptance checks

- Coupon `010505` resolves to exactly one order, legal merchant code `1999`, one canonical portal-linked UUID, and zero dependent ownership mismatch.
- Admin All Orders loads every page and never converts errors into zero.
- Merchant portal loads every exact-UUID page and never falls back to merchant name/code/phone ownership.
- A newly created order is returned by the creation RPC, re-read from `orders`, and verified against the resolved merchant UUID.
- Merchant A cannot read Merchant B orders.
- COD, statements, settlements, account entries and invoices retain amounts.
- Finance health is authoritative and variance is exactly zero.
- No order or merchant row is deleted.

## Roll-forward policy

The framework is idempotent. If evidence becomes stale, do not perform a broad rollback. Create a new dry run, resolve conflicts, and apply only the new reviewed `AUTO_REPAIR_SAFE` set. Finance reconciliation remains a separate reviewed step.
