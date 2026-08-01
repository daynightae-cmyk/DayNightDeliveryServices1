# Global Merchant Ownership Restoration Changelog

## Implemented on the dedicated branch

- Added non-destructive ownership and finance migrations with no automatic historical backfill.
- Added complete order classification, canonical merchant/account inventory, immutable snapshots and repair logs.
- Added explicit `AUTO_REPAIR_SAFE` ownership apply guarded by a reviewed audit ID and confirmation token.
- Added a separate explicitly approved authoritative finance reconciliation stage.
- Added global before/after order, customer, financial and status invariants.
- Added dependent merchant UUID synchronization without changing values.
- Added exact UUID merchant-portal pagination and search.
- Added future-write canonical trigger and a `NOT VALID` restrictive foreign key.
- Centralized merchant resolution in `merchantOrderOwnership.ts`.
- Removed admin complete-order legacy direct insert fallback.
- Removed admin flexible-order public/direct/post-hoc ownership fallbacks.
- Hardened financial order creation and updates with mandatory data validation and persisted UUID verification.
- Required canonical merchant resolution and post-save database re-read for every registered admin order path.
- Removed merchant portal order ownership fallback by merchant name, code or phone.
- Prevented failed admin loads from rendering false empty/zero statistics.
- Added complete admin pagination beyond the first 100/1000 records.
- Added static ownership and all-order-path regression gates.
- Added trusted real-admin runtime dry run and authenticated multi-merchant isolation evidence.
- Added an isolated trusted schema deployment workflow pinned to production project `ngdwybpgacauorygoedi`.
- Removed production secret execution from pull-request-triggered runtime evidence.
- Added runbook, acceptance query pack, deployment sequence and final evidence template.

## Deliberately not executed from the pull request

- No production migration was applied.
- No production order was reassigned.
- No production finance reconciliation was executed.
- No production service-role credential was exposed to PR code.
- No ownership or finance apply RPC was called.
- No PR was merged automatically.

Production restoration remains gated by trusted schema deployment from `main`, full dry-run review, resolution of every ambiguous/conflicting/missing-link row, separate explicit ownership and finance approvals, authenticated multi-merchant/RLS evidence, coupon `010505` → merchant code `1999`, and zero financial variance.
