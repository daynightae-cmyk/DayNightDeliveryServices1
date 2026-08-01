# Pull Request Checklist — Global Merchant Ownership Restoration

## Code and migration

- [ ] New migration is idempotent and contains no automatic historical backfill.
- [ ] No `TRUNCATE`, `CASCADE`, RLS disablement, global reset, or coupon-protection weakening.
- [ ] Dry run inventories every order.
- [ ] Ambiguous/missing-link rows block apply.
- [ ] Apply requires exact audit ID and confirmation token.
- [ ] Apply aborts when data changes after snapshot.
- [ ] Financial/status/customer invariants roll back on variance.
- [ ] Every changed order receives repair and admin audit records.
- [ ] Future writes require a canonical portal-linked merchant UUID.

## Frontend

- [ ] Admin order creation uses `resolveOrderMerchant`.
- [ ] No legacy direct `orders.insert` fallback remains in admin creation.
- [ ] Returned order is re-read and merchant UUID verified.
- [ ] Admin search includes coupon/tracking/phone/customer/merchant.
- [ ] Admin load errors do not render false zero.
- [ ] Merchant portal uses paginated exact-UUID RPC only.
- [ ] Merchant portal load failure preserves last successful data and shows error.

## Validation

- [ ] `global-merchant-ownership-gate.mjs` passes.
- [ ] TypeScript passes.
- [ ] Production gate passes.
- [ ] Production build passes.
- [ ] Codex/reviewer concerns resolved.
- [ ] No red required checks.

## Production after merge

- [ ] Migration manually applied to the active production project.
- [ ] Trusted production dry-run workflow executed from `main`.
- [ ] Full artifact reviewed.
- [ ] Every unresolved row handled and a new clean dry run created.
- [ ] Explicit apply approved separately.
- [ ] Multiple real merchant accounts and RLS tested.
- [ ] Financial variance is zero.
- [ ] Final report template completed with actual evidence.
