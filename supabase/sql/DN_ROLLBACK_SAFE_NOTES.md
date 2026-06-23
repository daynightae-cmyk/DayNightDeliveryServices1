# DN Rollback Safe Notes

This note describes what must not be deleted during production rollback planning.

## Never Delete Production Business Data

- auth users and auth identities
- profiles
- orders
- wallets
- storage buckets and storage objects

## Rollback Safety Rules

- Never drop schemas in production.
- Never run destructive `delete` statements without a scoped `where` clause and approved backup.
- Never truncate user-facing tables in production.
- Prefer reversible migration steps.
- Snapshot current schema and row counts before applying rollback SQL.

## Recommended Rollback Strategy

1. Stop new schema changes and confirm current failing migration.
2. Run only targeted rollback statements for the affected migration objects.
3. Re-run `DN_MASTER_PRODUCTION_FIX.sql`, then `DN_SEED_BUSINESS_DATA.sql`, then `DN_VERIFY_PRODUCTION.sql`.
4. Confirm verification queries pass before restoring application traffic.
