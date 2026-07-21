# DAY NIGHT Delivery Runtime E2E

This pack verifies the production data chain without demo rows or fabricated GPS:

`Merchant → Admin → Assigned Driver → Live Location → Delivery → COD → Settlement → Customer History → Email`

## Included production changes

- Secure Leaflet tracking of the assigned driver's actual `driver_locations` row.
- Precise location is returned to authorized users only while the order is `out_for_delivery`.
- No interpolated or synthetic driver position is displayed.
- Authenticated customer dashboard separates active requests from final order history.
- Final history includes the terminal status and persisted `delivered_at` timestamp.
- Delivery confirmation API validates the Supabase session before sending a summary.
- Durable `delivery_confirmation_outbox` records automatic confirmations at order creation.
- Admin runtime snapshot exposes one auditable view of order, merchant, driver, GPS, status history, COD, settlement, and email outbox.

## Required deployment order

1. Deploy the repository preview and verify the normal Production Gate.
2. Apply this migration to the approved production Supabase project:

   `supabase/migrations/20260721190000_runtime_delivery_verification_and_email.sql`

3. Reload the PostgREST schema or wait for the migration's `notify pgrst` operation.
4. Configure the Vercel server environment variables below.
5. Add the protected GitHub Actions secrets below.
6. Run **Runtime Delivery E2E** manually from GitHub Actions.

The live E2E must not be run before the migration is applied. It intentionally fails when a required RPC, trigger, COD row, settlement row, permission, or email configuration is missing.

## Vercel server environment variables

These values must be configured for Production and Preview as appropriate. Never expose them through `VITE_` variables except the existing public Supabase URL and anon key.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Approved DAY NIGHT Supabase URL |
| `SUPABASE_ANON_KEY` | Public anon key used when validating user access tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only order/outbox access |
| `RESEND_API_KEY` | Server-only email provider key |
| `DELIVERY_EMAIL_FROM` | Verified sender, such as `DAY NIGHT DELIVERY SERVICES <notifications@daynightae.com>` |
| `DELIVERY_EMAIL_WEBHOOK_SECRET` | Protects optional Supabase database webhook calls |
| `CRON_SECRET` | Protects scheduled outbox processing |

The API route is:

`POST /api/delivery-confirmation`

Authenticated client requests send a Supabase Bearer token and `{ "orderId": "..." }`.

## GitHub Actions protected secrets

Create the `production-runtime-tests` environment and add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RUNTIME_MERCHANT_EMAIL`
- `RUNTIME_MERCHANT_PASSWORD`
- `RUNTIME_ADMIN_EMAIL`
- `RUNTIME_ADMIN_PASSWORD`
- `RUNTIME_DRIVER_EMAIL`
- `RUNTIME_DRIVER_PASSWORD`
- `RUNTIME_CUSTOMER_EMAIL` — optional; defaults to the merchant test email

Use dedicated test identities with the same real roles and RLS rules as production identities. Do not put passwords in commits, workflow YAML, issues, or chat messages.

## Live test matrix

| Test | Required assertion |
|---|---|
| Merchant creates an order | A real `orders` row is created and `merchant_id` equals the authenticated merchant |
| Admin visibility | The admin reads the same order and merchant identity |
| Driver assignment | `admin_dispatch_order` stores the real driver ID |
| Driver isolation | The assigned driver's query returns the test order |
| Mission start | Driver transitions to `accepted` |
| Pickup | Driver transitions to `picked_up` |
| Out for delivery | Driver transitions to `out_for_delivery` |
| Live Leaflet position | `driver_report_location` persists GPS and `tracking_live_driver_location` returns it |
| Merchant synchronization | `merchant_portal_orders` returns the same live status |
| Delivery | Driver transitions to `delivered` and `delivered_at` is persisted |
| Timeline | Status-history rows exist for the lifecycle |
| COD | A real `cod_collections` row exists for the same order |
| Settlement | A real `merchant_statement_entries` row exists for the same order |
| Pickup request | Merchant pickup RPC creates and reloads the request |
| Branch/document persistence | Records reload through `merchant_portal_business_center` |
| Customer history | Delivered order appears with terminal status and final date |
| Automatic email | Outbox row exists; optional deployed API call returns a provider message ID |

## Running locally

From the repository root, set the protected values in the current shell and run:

```bash
pnpm --dir artifacts/day-night-delivery run runtime:gate
pnpm --dir artifacts/day-night-delivery run runtime:e2e
```

The test deletes the temporary order, branch, pickup request, and document by default. To preserve them for inspection:

```bash
RUNTIME_E2E_KEEP_DATA=true pnpm --dir artifacts/day-night-delivery run runtime:e2e
```

To test actual provider delivery, also set:

`RUNTIME_CONFIRMATION_API_URL=https://daynightae.com/api/delivery-confirmation`

## Safety and truthfulness

- The static gate verifies integration only; it does not claim a live database pass.
- The live E2E creates real records and must use dedicated test identities.
- A missing COD or settlement record is a failure, not a derived or invented success.
- Live tracking never generates estimated driver coordinates.
- Service-role and email-provider secrets remain server-side.
- The migration and Vercel variables must be deployed before automatic emails can be considered operational.
