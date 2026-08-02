-- The production inventory is intentionally exhaustive and snapshots every
-- order plus its dependent accounting ownership.  Keep the normal API timeout
-- everywhere else, but give this admin-only, read-before-write diagnostic RPC
-- enough time to finish atomically instead of returning a partial report.
alter function public.admin_run_order_merchant_dry_run()
  set statement_timeout = '120s';
