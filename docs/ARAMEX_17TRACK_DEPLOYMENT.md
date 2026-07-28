# DAY NIGHT — Aramex Tracking via 17TRACK v2.4

This integration tracks **Aramex only** through 17TRACK and stores all customer-facing results in the DAY NIGHT production Supabase project.

## Production target

- Supabase project ref: `ngdwybpgacauorygoedi`
- Supabase URL: `https://ngdwybpgacauorygoedi.supabase.co`
- Secret name: `TRACK17_API_KEY`
- 17TRACK API version: `v2.4`
- Official Aramex carrier code: `100006`
- Package webhook URL: `https://ngdwybpgacauorygoedi.supabase.co/functions/v1/track17-webhook`

The secret value must remain in Supabase Edge Function Secrets. It must never be copied to GitHub, React, Vite variables, browser requests, logs, or documentation.

## Database and functions

Apply the migration and deploy the functions from the repository root:

```bash
supabase login
supabase link --project-ref ngdwybpgacauorygoedi
supabase db push
supabase functions deploy register-track17-shipment --project-ref ngdwybpgacauorygoedi
supabase functions deploy sync-track17-shipment --project-ref ngdwybpgacauorygoedi
supabase functions deploy track17-admin --project-ref ngdwybpgacauorygoedi
supabase functions deploy track17-webhook --project-ref ngdwybpgacauorygoedi --no-verify-jwt
supabase functions deploy public-international-tracking --project-ref ngdwybpgacauorygoedi --no-verify-jwt
```

Confirm the secret exists without printing its value:

```bash
supabase secrets list --project-ref ngdwybpgacauorygoedi
```

Expected custom secret name:

```text
TRACK17_API_KEY
```

## 17TRACK dashboard

After `track17-webhook` is deployed:

1. Open **Settings → Package Webhook**.
2. Enter:

   ```text
   https://ngdwybpgacauorygoedi.supabase.co/functions/v1/track17-webhook
   ```

3. Select **V2.4**.
4. Enable all package statuses:
   - Not found
   - Info received
   - In transit
   - Expired
   - Pick up
   - Out for delivery
   - Undelivered
   - Delivered
   - Alert
5. Keep **Air Cargo Webhook** empty.
6. Save.
7. Test both:
   - Tracking updated
   - Tracking stopped

Both tests must receive HTTP `200`. The administration center will then show the callback and its verified signature state.

## Verification

From `artifacts/day-night-delivery`:

```bash
pnpm international-tracking:gate
pnpm typecheck
pnpm build
```

Optional Deno unit tests:

```bash
deno test supabase/functions/_shared/track17-status.test.ts

deno test supabase/functions/_shared/track17-signature.test.ts
```

## Web routes

- Customer international tracking: `/international-tracking`
- Existing unified tracking page: `/tracking`
- International service page: `/international-shipping`
- Admin portal: floating **International Tracking** command center on `/admin`
- Merchant portal: read-only **Aramex Tracking** viewer on `/merchant`

The customer page reads only the public-safe Supabase function. It does not call 17TRACK directly and does not expose customer names, phones, email addresses, full addresses, raw provider payloads, service-role credentials, or API tokens.

## Runtime model

1. An authorized admin registers an Aramex AWB once.
2. 17TRACK receives carrier code `100006`.
3. The initial carrier data is synchronized once.
4. Further carrier changes arrive through the signed webhook.
5. Supabase stores normalized shipment status and deduplicated events.
6. Public and merchant screens read the stored data.
7. Manual provider synchronization is restricted to administrators and protected by a cooldown.

No continuous provider polling is used, which protects the limited tracking quota.
