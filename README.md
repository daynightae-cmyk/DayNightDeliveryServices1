# DAY NIGHT DELIVERY SERVICES

![Production Gate](https://github.com/daynightae-cmyk/DayNightDeliveryServices1/actions/workflows/production-gate.yml/badge.svg)

**DAY NIGHT DELIVERY SERVICES** is the production web platform for UAE delivery, international shipping, tracking, customer accounts, admin operations, QR services, policies, and branded support.

**Website:** https://www.daynightae.com  
**Email:** Admin@daynightae.com  
**Phone:** +971 56 875 7331  
**Slogan:** Fast • Reliable • Every Time  
**Credit:** Creating by Eng Sadek Elgazar

## Application path

```bash
artifacts/day-night-delivery
```

## Production routes

| Route | Purpose |
| --- | --- |
| `/` | Public homepage |
| `/pricing` | Pricing calculators |
| `/request` | Create delivery request |
| `/tracking` | Track shipment |
| `/customer` | Customer account portal |
| `/update-password` | Customer password recovery |
| `/auth` | Admin login |
| `/admin` | Protected admin panel |
| `/policy` | Service policy and customer rights |
| `/privacy` | Privacy policy |
| `/qr` | QR services |
| `/gallery` | Visual gallery |

## Main capabilities

- React + Vite production website.
- Supabase authentication and order data.
- Customer login with email, Google, and Microsoft providers.
- Linked customer orders inside `/customer`.
- Protected admin panel with role checking.
- UAE and international pricing calculators.
- Order creation, tracking, admin status updates, and timeline history.
- Arabic/English interface support.
- Arabic/English admin exports: filtered CSV, COD CSV, daily PDF, order PDF, order TXT.
- Cloudflare Turnstile-ready forms through public site key configuration.
- Vercel production deployment.
- GitHub Actions production validation.

## Pricing rules

| Service | Rule |
| --- | --- |
| UAE main areas | 30 AED base |
| UAE extended areas | 50 AED base |
| Express surcharge | 15 AED |
| Additional piece | 5 AED |
| GCC shipping | 95 AED first kg + 45 AED additional kg |
| Worldwide shipping | 190 AED first kg + 90 AED additional kg |

## Local validation

From the repository root:

```bash
corepack enable
corepack prepare pnpm@10.34.4 --activate
pnpm install
pnpm run web:validate
```

Run local development:

```bash
pnpm --dir artifacts/day-night-delivery run dev
```

Individual checks:

```bash
pnpm run web:typecheck
pnpm run web:gate
pnpm run web:build
```

## Deployment

The Vercel build output is:

```bash
artifacts/day-night-delivery/dist/public
```

The GitHub Actions workflow is:

```bash
.github/workflows/production-gate.yml
```

The workflow runs type checking, production hardening gate, and production build on every push or pull request targeting `main`.

## Required public environment values

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_TURNSTILE_SITE_KEY
```

Private provider values are configured only in Supabase, Google Cloud, Microsoft Entra, Cloudflare, and Vercel dashboards.

## Supabase notes

Expected production project:

```bash
https://ngdwybpgacauorygoedi.supabase.co
```

Core app dependencies:

- `orders`
- `profiles`
- `order_status_history`
- `create_public_order`
- `track_order`
- `admin_update_order_status`
- `calculate_delivery_price`
- `calculate_international_price`

Customer order linking expects `orders.customer_id`.

## Brand colors

| Token | Color |
| --- | --- |
| Deep Navy | `#071A33` |
| Navy | `#0A1C3A` |
| Royal Blue | `#0057B8` |
| Bright Blue | `#007BFF` |
| Sky Blue | `#18A8E8` |
| Luxury Gold | `#D4AF37` |
| Warm Gold | `#F5B700` |
| White | `#FFFFFF` |

Official logo:

```text
https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png
```

---

**DAY NIGHT DELIVERY SERVICES**  
**Creating by Eng Sadek Elgazar**
