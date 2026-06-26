# DAY NIGHT Production Runbook

This runbook is the operational checklist for the DAY NIGHT DELIVERY SERVICES production web platform.

## Production URLs

| Area | URL |
| --- | --- |
| Website | `https://daynightae.com` |
| Customer portal | `/customer` |
| Password recovery | `/update-password` |
| Admin login | `/auth` |
| Admin panel | `/admin` |
| Request delivery | `/request` |
| Tracking | `/tracking` |

## Local validation command

Run from repository root:

```bash
pnpm run web:validate
```

This command runs:

```bash
pnpm run web:typecheck
pnpm run web:gate
pnpm run web:build
```

## Manual production test

After every meaningful production change:

1. Open `/customer` in an incognito browser.
2. Sign in with Google or Microsoft.
3. Confirm the customer account hub appears.
4. Open `/request` while still signed in.
5. Create a delivery request.
6. Return to `/customer` and refresh linked orders.
7. Confirm the new order appears.
8. Open the tracking link from the customer order card.
9. Open `/auth` and sign in as admin.
10. Open `/admin` and verify the order appears.
11. Export filtered CSV.
12. Export COD CSV.
13. Export daily PDF.
14. Open order details and export PDF/TXT.
15. Switch language and repeat export validation.

## Supabase Auth configuration

Required provider areas:

| Provider | Dashboard area |
| --- | --- |
| Email | Authentication > Providers > Email |
| Google | Authentication > Providers > Google |
| Microsoft/Azure | Authentication > Providers > Azure |
| Turnstile | Authentication > Bot and Abuse Protection |
| Redirect URLs | Authentication > URL Configuration |

Recommended redirect URLs:

```text
https://daynightae.com/customer
https://daynightae.com/update-password
https://daynightae.com/auth
https://www.daynightae.com/customer
https://www.daynightae.com/update-password
https://www.daynightae.com/auth
```

## Vercel environment values

The frontend expects these public values:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_TURNSTILE_SITE_KEY
```

Provider client secrets and service-role credentials must remain in vendor dashboards only.

## Customer order linking

The frontend sends `customer_id` with new orders when the user is signed in. The customer portal reads orders with:

```sql
where customer_id = auth.uid()
```

Run the SQL helper file when the database schema needs to be aligned:

```bash
supabase/sql/DN_CUSTOMER_ORDER_LINKING.sql
```

## Admin exports

Expected behavior:

| Export | Arabic mode | English mode |
| --- | --- | --- |
| Filtered CSV | Arabic columns | English columns |
| COD CSV | Arabic columns | English columns |
| Daily PDF | Arabic labels | English labels |
| Order PDF/TXT | Arabic content | English content |

## Production failure triage

| Symptom | First check |
| --- | --- |
| Customer login fails | Supabase Auth provider and redirect URLs |
| Google/Microsoft returns provider error | OAuth client redirect/callback configuration |
| Turnstile challenge fails | Public site key in Vercel and secret in Supabase |
| Order does not appear in customer portal | `orders.customer_id` and create order RPC payload |
| Admin cannot login | `profiles.role = admin` for the authenticated user |
| Build fails locally on Windows | Reinstall with pnpm after Git Bash is available in PATH |
| Vercel deployment fails | Vercel build logs, package lock state, and production gate |

## Current production target

The platform is considered production-ready when:

- GitHub Production Gate passes.
- Vercel deployment is green.
- Customer order creation and customer order list work.
- Admin exports work in Arabic and English.
- No service-role or private provider value exists in frontend code.

---

Creating by Eng Sadek Elgazar
