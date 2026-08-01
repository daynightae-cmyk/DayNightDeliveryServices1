# Security Boundaries

- Pull-request workflows must not receive production Supabase service-role credentials.
- The production dry-run workflow is manual, restricted to trusted `main`, and writes only audit snapshots.
- The runtime audit script never calls the repair apply RPC.
- The migration never performs an automatic historical backfill.
- The repair apply RPC is a separate explicit human action and is blocked by unresolved rows, stale snapshots, changed orders, or any financial/status/customer variance.
- Merchant portal ownership remains exact UUID under RLS; names, codes, phones and emails are not authorization predicates.
- No production success statement is valid without the uploaded runtime artifact and authenticated multi-merchant tests.
