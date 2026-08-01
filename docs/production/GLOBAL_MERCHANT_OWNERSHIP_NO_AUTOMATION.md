# No Automatic Backfill

The migration deployment is schema/function creation only. Historical order reassignment is a distinct reviewed RPC call requiring the exact dry-run audit ID and the literal confirmation token `APPLY_AUTO_REPAIR_SAFE`.
