# PR Summary

## Problem

Historical and new orders require one authoritative merchant UUID across admin, merchant portal, COD and statements. Existing fallbacks could hide errors, truncate portal results, or allow a selected duplicate merchant row to produce an order invisible to the intended portal account.

## Solution

- canonical exact-UUID resolution for admin creation;
- no legacy direct order insert fallback;
- exact-UUID paginated merchant portal reads;
- no false-zero admin statistics;
- safe global dry-run inventory and classification;
- explicit transactional repair only for reviewed safe rows;
- dependent ownership synchronization and immutable audit;
- zero-variance financial/status/customer protections;
- trusted manual production evidence workflow.

## Safety

No production migration or backfill is executed by the PR. No order or merchant is deleted. Coupon, tracking, status, customer data and amounts are protected.
