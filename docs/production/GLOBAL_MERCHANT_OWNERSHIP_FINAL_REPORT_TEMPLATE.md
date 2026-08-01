# Global Merchant Ownership Restoration — Final Evidence

> This document must be completed from the trusted production dry-run artifact. Do not replace unknown values with estimates.

## Release identity

- Commit SHA:
- Pull request:
- Production deployment URL:
- Migration: `20260802023000_global_order_merchant_ownership_restoration.sql`
- Production audit ID:
- Runtime report artifact:

## Root causes

1.
2.
3.

## Inventory

| Metric | Before | After |
|---|---:|---:|
| Total orders |  |  |
| Active merchants |  |  |
| Merchants linked to portal users |  |  |
| Originally correct orders |  |  |
| Automatically repaired orders |  |  |
| Manual review orders |  |  |
| Missing merchant ID |  |  |
| Orders linked to old/duplicate merchant rows |  |  |

## Classification counts

| Classification | Count |
|---|---:|
| ALREADY_CORRECT |  |
| AUTO_REPAIR_SAFE |  |
| MANUAL_REVIEW |  |
| SECURITY_CONFLICT |  |
| MISSING_MERCHANT |  |
| MISSING_PORTAL_LINK |  |

## Merchant matrix

| merchant_id | merchant_code | database_count | admin_count | portal_count | result |
|---|---|---:|---:|---:|---|
|  |  |  |  |  |  |

## Financial integrity

| Metric | Before | After | Variance |
|---|---:|---:|---:|
| Orders |  |  |  |
| Goods value |  |  |  |
| Delivery fees |  |  |  |
| Discounts |  |  |  |
| Customer totals |  |  |  |
| Merchant dues |  |  |  |
| COD |  |  |  |
| Status counts |  |  |  |

## Acceptance coupon 010505

- Matching order count:
- Order UUID:
- Canonical merchant UUID:
- Merchant code:
- Exact UUID portal visibility:
- Result:

## Tests

| Test | Result | Evidence |
|---|---|---|
| TypeScript |  |  |
| Production gate |  |  |
| Production build |  |  |
| Migration applied |  |  |
| Dry-run complete |  |  |
| RLS: Merchant A cannot read Merchant B |  |  |
| Multiple merchant accounts |  |  |
| Admin all-pages pagination |  |  |
| Merchant portal all-pages pagination |  |  |
| New manual order |  |  |
| Coupon-photo order |  |  |
| Repeated-order action |  |  |
| Merchant-created order |  |  |
| Import order |  |  |
| COD ownership |  |  |
| Merchant statement ownership |  |  |
| Financial variance zero |  |  |
| Browser/PWA current build |  |  |

## Explicit confirmations

- [ ] No order was deleted.
- [ ] No merchant was deleted.
- [ ] No coupon number changed.
- [ ] No tracking number changed.
- [ ] No order status changed.
- [ ] No customer/receiver data changed.
- [ ] No financial amount changed.
- [ ] Every deterministic order is visible to its exact canonical merchant UUID.
- [ ] Every ambiguous order remains visible to administrators in manual review and was not reassigned automatically.
