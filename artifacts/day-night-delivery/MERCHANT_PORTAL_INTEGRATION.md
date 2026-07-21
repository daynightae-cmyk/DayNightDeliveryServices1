# DAY NIGHT Merchant Portal — Production Integration

## Scope

The `/merchant` production route now loads `MerchantPortalCommandCenter`. The existing Supabase project, authenticated session, RLS policies, pricing client, order table, realtime channels, tracking map, exports, and company context remain authoritative.

This implementation does **not** create a second authentication client, database, router, or demo runtime.

## Existing production integrations preserved

- Supabase password sign-in, Google OAuth, email magic link, and phone OTP.
- `merchant_get_session_profile` and `merchant_claim_approved_account`.
- `merchant_portal_orders` with strict merchant ownership.
- Existing `calculateDeliveryPrice` client and server-side pricing confirmation.
- Existing `TrackingMap` as the internal DAY NIGHT map surface.
- Existing PDF/CSV export helpers.
- Existing App Context language and theme state.
- Realtime subscriptions for orders, merchants, merchant notifications, pickup requests, and support tickets.

## New production controller

`src/components/merchant/MerchantPortalCommandCenter.tsx`

Responsibilities:

- Owns authenticated Merchant session and production data loading.
- Maps database rows to strict Merchant view models.
- Exposes typed callbacks to presentational components.
- Loads the internal map through `mapSlot`.
- Separates live, derived, and unavailable financial data.
- Refreshes authoritative data after successful mutations.
- Never imports demo fixtures.

## Section coverage

All 33 Merchant sections are handled exhaustively:

- Dashboard, new order, orders, order details, tracking, pickup requests.
- Returns, cancelled, postponed, under review, bulk import.
- COD, settlements, statements, invoices, wallet, transactions.
- Analytics, reports.
- Branches, pickup addresses, address book, profile, branding, business details, bank details, documents, team.
- Notifications, support, integrations, settings, security.

## Order creation

The seven-step wizard validates pickup, recipient, package, service/payment, pricing, review, and created result.

Client pricing is displayed for review, while `merchant_create_order(jsonb)` recalculates pricing on the server and inserts only into the authenticated merchant scope. Tracking and invoice references are returned by the authoritative RPC.

## Coupon intake

- Camera/file selection through a real file input.
- Object URL preview and cleanup.
- Rotation, replacement, removal, upload retry.
- Browser `BarcodeDetector` support when available.
- Optional server extraction callback.
- Mandatory manual review before values enter the order wizard.
- Images are stored under the authenticated merchant folder in `merchant-coupon-images`.

## Bulk import

- CSV parsing in the controller.
- Branch selection and explicit column mapping.
- Server preview through `merchant_create_import_preview`.
- Row-level validation results.
- Explicit commit through `merchant_commit_import`.
- No order is claimed as imported until the commit RPC returns.

## Tracking

`MerchantTrackingWorkspace` receives the existing production `TrackingMap` through `mapSlot`. No CSS map, random coordinates, fake movement, or default external-map redirect is used.

## Finance

- COD collections are read from `cod_collections` under merchant RLS.
- Statement entries are read from `merchant_statement_entries`.
- Settlement summaries are explicitly marked derived until a dedicated settlement table becomes authoritative.
- Wallet renders unavailable when no authoritative merchant-wallet source exists.
- Invoice and statement exports use existing PDF/CSV helpers.

## Business center migrations

- `20260721120000_merchant_business_center.sql`
- `20260721123000_merchant_business_center_runtime.sql`

They add merchant-owned branches, pickups, address book, documents, team, support, action requests, notifications, storage policies, order creation, bulk import, and scoped CRUD RPCs.

## Runtime truth

A successful TypeScript/build/static gate proves code integration. It does not prove that migrations are applied to a particular remote Supabase environment or that every live row exists. An authenticated merchant smoke test is still required after deployment.
