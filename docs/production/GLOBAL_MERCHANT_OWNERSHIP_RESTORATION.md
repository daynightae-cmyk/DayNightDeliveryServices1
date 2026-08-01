# Global Order → Merchant Ownership Restoration

## Scope

This runbook restores and proves exact merchant ownership for every existing and future order without deleting orders or merchants and without changing coupon numbers, tracking numbers, status, customer data or financial values.

The authoritative rule is:

```text
orders.merchant_id = merchants.id
merchant session → merchant_user_links active row, then safe merchants.user_id fallback
```

Names, codes, email and phone are evidence for dry-run classification only. They never grant portal access.

## Production project

Use only the active production Supabase project selected by the DAY NIGHT production environment. Never use a paused/retired project and never run `supabase db reset --linked`, `db push --include-all`, destructive migration-history repair, `TRUNCATE`, or RLS disablement.

## Phase 0 — Preconditions

1. Merge only after TypeScript, production gate, build and merchant-ownership gate pass.
2. Apply `supabase/migrations/20260802023000_global_order_merchant_ownership_restoration.sql` manually from a trusted production operator context.
3. Do not expose the service-role key to pull-request code.
4. Do not call the apply RPC during migration deployment.

The migration creates audit/report functions and future-write protection. It does not rewrite historical orders automatically.

## Phase 1 — Dry run

From a trusted admin/service session:

```sql
select public.admin_run_global_merchant_ownership_dry_run(
  'Global merchant ownership production inventory'
);
```

Record the returned `audit_id`, then fetch the complete report:

```sql
select public.admin_global_merchant_ownership_report('<AUDIT_ID>'::uuid);
select public.admin_merchant_ownership_visibility_matrix();
select public.admin_order_merchant_acceptance('010505');
```

The dry run classifies every order as one of:

- `ALREADY_CORRECT`
- `AUTO_REPAIR_SAFE`
- `MANUAL_REVIEW`
- `SECURITY_CONFLICT`
- `MISSING_MERCHANT`
- `MISSING_PORTAL_LINK`

No historical order is modified by these calls.

## Phase 2 — Mandatory review

Do not proceed while any row is unresolved. The run status is `blocked` when any row is `MANUAL_REVIEW`, `SECURITY_CONFLICT`, `MISSING_MERCHANT`, or `MISSING_PORTAL_LINK`.

For every unresolved merchant entity, verify:

1. active `merchant_user_links` relationship;
2. safe `merchants.user_id` fallback only when it does not conflict;
3. unique documented merchant code;
4. verified email/phone;
5. manual owner approval when identity is not mathematically unique.

Run a new dry run after correcting merchant/account linkage. Do not edit order financial fields.

## Phase 3 — Explicit transactional apply

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
- rolls back the complete call on any variance.

## Phase 4 — Evidence

Run the trusted manual workflow from `main`:

```text
Global Merchant Ownership Production Audit
```

The workflow performs a new dry run only and uploads:

```text
global-merchant-ownership-runtime-report.json
```

It never invokes the apply RPC.

## Required merchant matrix

Every active merchant must have:

```text
merchant_id | merchant_code | database_count | admin_count | portal_count | result
```

`result` must be `PASS`. Actual authenticated portal tests for multiple merchants remain mandatory in addition to the expected exact-UUID matrix.

## Required acceptance checks

- Coupon `010505` resolves to exactly one order and one canonical portal-linked merchant UUID.
- Admin All Orders loads every page and never converts errors into zero.
- Merchant portal loads every exact-UUID page and never falls back to merchant name/code/phone ownership.
- A newly created order is returned by the creation RPC, re-read from `orders`, and verified against the resolved merchant UUID.
- Merchant A cannot read Merchant B orders.
- COD, statements, settlements, account entries and invoices retain their amounts.
- Global financial variance is exactly zero.
- No order or merchant row is deleted.

## Roll-forward policy

This repair is idempotent. If the dry-run evidence becomes stale, do not attempt a broad rollback. Create a new dry run, resolve conflicts, and apply only the new reviewed `AUTO_REPAIR_SAFE` set.
