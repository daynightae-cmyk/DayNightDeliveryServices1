# Global Merchant Ownership Restoration Changelog

## Implemented on the dedicated branch

- Added a non-destructive, two-phase global ownership migration.
- Added complete order classification and immutable snapshots.
- Added explicit `AUTO_REPAIR_SAFE` apply RPC guarded by a reviewed audit ID and confirmation token.
- Added global before/after financial and status invariants.
- Added dependent merchant UUID synchronization without changing values.
- Added exact UUID portal pagination and search.
- Added future-write trigger and a `NOT VALID` restrictive foreign key.
- Removed admin legacy direct order insert fallback.
- Required canonical merchant resolution and post-save UUID verification.
- Removed merchant portal order ownership fallback by merchant name/code/phone.
- Prevented failed admin loads from rendering false zero statistics.
- Added static regression gate, trusted runtime dry-run audit, runbook and final evidence template.

## Deliberately not executed from the pull request

- No production migration was applied.
- No production order was reassigned.
- No production service-role credential was exposed to PR code.
- No backfill apply RPC was called.
- No PR was merged automatically.

Production restoration remains gated by a trusted manual migration deployment, full dry-run review, resolution of every ambiguous row, explicit apply approval, and authenticated multi-merchant/RLS evidence.
