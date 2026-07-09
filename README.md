<div align="center">

<img src="https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png" alt="DAY NIGHT DELIVERY SERVICES" width="150" />

# DAY NIGHT DELIVERY SERVICES

### Luxury Operations & Logistics Management Platform — UAE

**Fast • Reliable • Every Time**  
**Your Comfort.. Our Priority**

منصة تشغيل وإدارة متقدمة لخدمات التوصيل والشحن داخل دولة الإمارات وخارجها، مصممة لإدارة التجار، الطلبات، التتبع، التحصيل، الفواتير، التقارير، ولوحة الإدارة الذكية.

</div>

<div align="center">

![Production Gate](https://github.com/daynightae-cmyk/DayNightDeliveryServices1/actions/workflows/production-gate.yml/badge.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-Premium_UI-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## Overview

**DAY NIGHT DELIVERY SERVICES** is a production-ready React and Supabase platform for luxury logistics operations in the UAE. It supports domestic delivery, international shipping, customer tracking, merchant operations, admin command workflows, COD collection, PDF exports, QR tools, and branded customer support.

| Item | Details |
|---|---|
| Company | DAY NIGHT DELIVERY SERVICES |
| Arabic Name | داي نايت لخدمات التوصيل والشحن |
| Website | `https://www.daynightae.com` |
| Email | `Admin@daynightae.com` |
| Phone | `+971 56 875 7331` |
| Slogan | Fast • Reliable • Every Time |
| Region | United Arab Emirates |
| Project Path | `artifacts/day-night-delivery` |
| Owner / Credit | Eng. Sadek Elgazar |

---

## Product Scope

The platform is built as a complete operations hub for delivery and shipping workflows:

- Customer website and service pages
- Shipment request workflow
- Live tracking page
- QR hub and tracking QR support
- Merchant management
- Order creation and operational review
- Admin command center
- Specialized admin workspaces
- Finance and COD summaries
- PDF invoices and reports
- Arabic / English UI direction
- Responsive mobile, tablet, and desktop layouts

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Language | TypeScript |
| Styling | Tailwind CSS + Custom Premium CSS |
| Backend | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| Maps | Leaflet / React Leaflet |
| PDF | Custom Admin PDF Export |
| Hosting | Vercel |
| Package Manager | pnpm |

---

## Application Structure

```txt
DayNightDeliveryServices1/
├── artifacts/
│   └── day-night-delivery/
│       ├── src/
│       │   ├── components/
│       │   │   ├── AdminPanelLuxury.tsx
│       │   │   ├── AdminMerchantIntelligence.tsx
│       │   │   └── admin/
│       │   │       ├── AdminSectionRegistry.ts
│       │   │       ├── AdminSectionWorkspace.tsx
│       │   │       ├── AdminOrdersWorkspace.tsx
│       │   │       ├── AdminFinanceWorkspace.tsx
│       │   │       ├── AdminSettingsWorkspace.tsx
│       │   │       ├── AdminReportsWorkspace.tsx
│       │   │       ├── AdminSupportWorkspace.tsx
│       │   │       ├── AdminLiveOperationsMap.tsx
│       │   │       ├── KhalifaGuidanceFeed.tsx
│       │   │       ├── AdminPdfExportButton.tsx
│       │   │       └── AdminPdfPreviewModal.tsx
│       │   ├── data/
│       │   │   ├── adminTranslations.ts
│       │   │   ├── adminCommandExpansion.ts
│       │   │   └── companyMeta.ts
│       │   ├── lib/
│       │   │   ├── adminData.ts
│       │   │   ├── adminPdfExport.ts
│       │   │   ├── mapUtils.ts
│       │   │   └── AppContext.tsx
│       │   ├── styles/
│       │   │   ├── dn-admin-sections.css
│       │   │   ├── dn-admin-pdf.css
│       │   │   ├── dn-admin-real-map-hotfix.css
│       │   │   └── dn-khalifa-final.css
│       │   └── supabase.ts
│       ├── public/
│       ├── package.json
│       └── vercel.json
├── supabase/
│   └── migrations/
├── vercel.json
└── README.md
```

---

## Production Routes

| Route | Purpose |
|---|---|
| `/` | Main website landing page |
| `/auth` | Admin/customer authentication entry |
| `/admin` | Luxury admin operations hub |
| `/tracking` | Shipment tracking page |
| `/request-delivery` | Delivery request workflow |
| `/pricing` | Pricing information |
| `/services` | Services overview |
| `/contact` | Contact and support |
| `/gallery` | Brand/media gallery |

---

## Admin Command Center

The admin system is designed as a high-end logistics control room. It includes:

- Live operations dashboard
- Specialized section registry
- Section-specific KPIs, filters, inputs, and actions
- Merchant management
- Order workflows
- Finance summaries
- COD tracking context
- PDF export context
- Section-aware Khalifa assistant
- Responsive glass-premium layout

### Admin Sections

| Group | Sections |
|---|---|
| Command | Dashboard |
| Operations | Add Order, Add Merchant, Merchants |
| Orders | All Orders, Cancelled, Under Review, Postponed, Returned |
| Dispatch | Pickup Orders, Abu Dhabi Orders, External Orders, Out of Scope |
| Finance | Finance Dashboard, Driver Statements, Merchant Statements, Income, COD, Expenses, Accounts, Adjustments, Audit Log |
| Tools | Import Shipments, Print Invoices, Reports |
| System | Settings, Technical Support |

---

## Live Operations Map

The admin map supports operational tracking and dispatch visibility:

- Standard map mode
- Satellite mode
- Terrain mode
- Pickup and destination markers
- Vehicle marker
- UAE region focus
- Route polyline
- Distance and duration summary
- Saved map preferences
- Safe tile fallback behavior

| Mode | Provider |
|---|---|
| Standard | OpenStreetMap |
| Satellite | Esri World Imagery |
| Terrain | OpenTopoMap |

---

## Khalifa Smart Assistant

**Khalifa** is the operations assistant inside the admin hub. It is designed to be section-aware and data-driven.

Capabilities:

- One rotating insight at a time
- Section-specific operational guidance
- COD and finance summaries
- Driver assignment warnings
- Return and review alerts
- Break-even overview
- Local derived answers from loaded admin data
- No exposure of Supabase secrets or environment keys

---

## PDF Export System

Admin exports support:

- DAY NIGHT branding
- Arabic RTL output
- English LTR output
- Section title
- Active filters
- Totals
- Visible rows
- Generated date/time
- Clean printable layout

PDF-capable sections include operations, orders, finance, statements, reports, invoices, and support summaries.

---

## Supabase Backend

Supabase is the source of truth for the production backend.

Core areas:

- Authentication
- User profiles
- Merchants
- Orders
- Tracking history
- Driver profiles and live locations
- Wallets and transactions
- Notifications
- Admin settings
- Audit logs
- Pricing rules
- Storage buckets
- Realtime-ready tables

Expected operational tables include:

```txt
profiles
orders
order_status_history
merchants
driver_profiles
driver_locations
wallets
wallet_transactions
notifications
admin_settings
audit_log
zones
cities
pricing_rules
international_rates
```

---

## Pricing Logic

### UAE Domestic

| Type | Base | VAT 5% | Total |
|---|---:|---:|---:|
| Main UAE Cities | 30 AED | 1.50 AED | 31.50 AED |
| Extended Areas | 50 AED | 2.50 AED | 52.50 AED |

### GCC

| Rule | Price |
|---|---:|
| First KG | 95 AED |
| Additional KG | 45 AED |

### Worldwide

| Rule | Price |
|---|---:|
| First KG | 190 AED |
| Additional KG | 90 AED |

---

## Environment Variables

Create the app environment file:

```txt
artifacts/day-night-delivery/.env
```

Example:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never commit real secrets.

---

## Local Development

### Install

```bash
corepack enable
pnpm install
```

### Run App

```bash
pnpm --dir artifacts/day-night-delivery run dev
```

### Type Check

```bash
pnpm --dir artifacts/day-night-delivery run typecheck
```

### Build

```bash
pnpm --dir artifacts/day-night-delivery run build
```

### Scan For Conflict Markers

```bash
grep -R "<<<<<<<\|=======\|>>>>>>>" artifacts/day-night-delivery/src || true
```

Expected result: no conflict markers.

---

## Deployment

The project is configured for Vercel.

```txt
GitHub main branch → Vercel build → Preview/Production deployment
```

Important deployment files:

```txt
vercel.json
artifacts/day-night-delivery/vercel.json
```

---

## Validation Checklist

Before merging any PR:

```bash
corepack enable
pnpm install
pnpm --dir artifacts/day-night-delivery run typecheck
pnpm --dir artifacts/day-night-delivery run build
grep -R "<<<<<<<\|=======\|>>>>>>>" artifacts/day-night-delivery/src || true
```

Manual checks:

- `/auth` works
- `/admin` works
- `/tracking` works
- Admin menu loads
- Settings is not an orders table
- Live map renders without repeated fallback logos
- Satellite and Terrain are not blocked by CSP
- Khalifa is visible and section-aware
- PDF export opens correctly
- Tables do not overflow on mobile

---

## Recent Milestone

### PR #47 — Specialized Admin Section Workspaces

Completed:

- Typed admin section registry
- Specialized admin workspaces
- Section-specific KPIs
- Section-specific filters
- Section-specific actions
- PDF export context
- Khalifa context per section
- Safe fallback logic
- Responsive section CSS
- Passing typecheck
- Passing production build
- Clean conflict-marker scan

---

## Roadmap — Real Operations Layer

Next phase focuses on deep operational data and accounting workflows:

### Finance & Accounting

- Real driver statements
- Real merchant statements
- Expenses CRUD
- Adjustments workflow
- COD reconciliation
- Account ledger

### Audit & Security

- Admin audit events
- Entity action tracking
- Approval and void history
- Safe diagnostics

### Import & Print

- CSV shipment import
- Import preview and validation
- Print job queue
- Invoice packs
- Shipping labels
- Pickup manifests

### Advanced Khalifa

- Unreconciled COD insights
- Pending expense approval alerts
- Import row error insights
- Print queue alerts
- Merchant balance warnings
- Driver COD warnings

---

## Development Principles

- Real data first
- No fake success messages
- No raw Supabase errors in the UI
- Safe fallbacks only
- Arabic and English support
- Mobile responsive admin screens
- Clean Git history
- Build before merge
- Never expose secrets
- Keep `/auth`, `/admin`, and `/tracking` stable

---

## Ownership

<div align="center">

**DAY NIGHT DELIVERY SERVICES**  
UAE Logistics & Delivery Operations Platform

**Built and managed for premium delivery, shipping, merchant operations, and smart logistics management.**

</div>

---

## License

Private business project.  
All rights reserved to **DAY NIGHT DELIVERY SERVICES**.

<div align="center">

### DAY NIGHT DELIVERY SERVICES

**Fast • Reliable • Every Time**

</div>
