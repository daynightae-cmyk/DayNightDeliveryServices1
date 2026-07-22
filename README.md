<div align="center">

<img src="https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png" alt="DAY NIGHT DELIVERY SERVICES" width="150" />

# DAY NIGHT DELIVERY SERVICES  
### Luxury Operations & Logistics Management Platform — UAE

**Fast • Reliable • Every Time**  
**Your Comfort.. Our Priority**

منصة إدارية وتشغيلية متقدمة لإدارة خدمات التوصيل، الشحن، التجار، الطلبات، التحصيل، التتبع، التقارير، والفواتير داخل دولة الإمارات وخارجها.

</div>

---

<div align="center">

![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-Premium_UI-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge)

</div>

---

## 📌 Project Overview

**DAY NIGHT DELIVERY SERVICES** is a premium logistics operations platform designed for delivery and shipping workflows in the UAE.

The system includes:

- Merchant management
- Order creation and tracking
- Live operations command center
- Admin dashboard
- Driver and merchant workflows
- COD collection logic
- Finance summaries
- PDF exports
- Shipment tracking map
- Arabic / English interface
- Responsive glass-premium design
- Supabase backend integration
- Vercel production deployment

---

## 🌍 Brand Identity

| Item | Value |
|---|---|
| Company | DAY NIGHT DELIVERY SERVICES |
| Arabic | داي نايت لخدمات التوصيل والشحن |
| Region | United Arab Emirates |
| Website | `https://daynightae.com` |
| Core Message | Fast • Reliable • Every Time |
| Arabic Message | سريع • آمن • موثوق |
| Visual Direction | Luxury logistics, glassmorphism, navy, blue, gold |
| Main Colors | Navy Blue, Royal Blue, Sky Blue, Luxury Gold, White |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Language | TypeScript |
| Styling | Tailwind CSS + Custom CSS |
| Backend | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| Maps | Leaflet / React Leaflet |
| PDF | Custom Admin PDF Export |
| Deployment | Vercel |
| Package Manager | pnpm |

---

## 📁 Project Structure

```txt
DayNightDeliveryServices1/
│
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
│       │   │
│       │   ├── data/
│       │   │   ├── adminTranslations.ts
│       │   │   ├── adminCommandExpansion.ts
│       │   │   └── companyMeta.ts
│       │   │
│       │   ├── lib/
│       │   │   ├── adminData.ts
│       │   │   ├── adminPdfExport.ts
│       │   │   ├── mapUtils.ts
│       │   │   └── AppContext.tsx
│       │   │
│       │   ├── styles/
│       │   │   ├── dn-admin-sections.css
│       │   │   ├── dn-admin-pdf.css
│       │   │   ├── dn-admin-real-map-hotfix.css
│       │   │   └── dn-khalifa-final.css
│       │   │
│       │   └── supabase.ts
│       │
│       ├── public/
│       ├── package.json
│       └── vercel.json
│
├── supabase/
│   └── migrations/
│
├── vercel.json
└── README.md
````

---

## ✨ Core Features

### 🚚 Logistics Operations

* Add and manage delivery orders
* Track domestic and external shipments
* Assign and review orders
* Manage cancelled, returned, postponed, and under-review orders
* Track pickup workflows
* Regional views for Abu Dhabi and other UAE areas
* External shipping support for GCC / worldwide routes

---

### 🏢 Merchant Management

* Add new merchants
* Merchant profile intelligence
* Merchant search and filters
* Merchant order activity
* Merchant COD and delivery summary
* Merchant statement-ready structure

---

### 🧭 Live Operations Map

The admin dashboard includes a live operations map with:

* Standard map mode
* Satellite mode
* Terrain mode
* UAE regional focus
* Order selector
* Emirate selector
* Route visualization
* Pickup / delivery points
* Vehicle marker
* Distance and duration summary
* Saved map preferences

---

### 🧠 Khalifa Smart Assistant

**Khalifa** is the admin-side operational assistant.

It provides:

* One live insight at a time
* Rotating operational guidance
* Section-aware suggestions
* COD insights
* Driver assignment warnings
* Break-even and finance summary
* Return and pending order alerts
* Local derived answers from loaded admin data
* Safe behavior without exposing secrets

---

### 📊 Specialized Admin Sections

Every menu item has a specialized workspace with:

* Section-specific KPIs
* Filters
* Inputs
* Actions
* Export context
* Khalifa context
* Safe fallback data
* Responsive layout

Current admin sections include:

| Group      | Sections                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Command    | Dashboard                                                                                                          |
| Operations | Add Order, Add Merchant, Merchants                                                                                 |
| Orders     | All Orders, Cancelled, Under Review, Postponed, Returned                                                           |
| Dispatch   | Pickup Orders, Abu Dhabi Orders, External Orders, Out of Scope                                                     |
| Finance    | Finance Dashboard, Driver Statements, Merchant Statements, Income, COD, Expenses, Accounts, Adjustments, Audit Log |
| Tools      | Import Shipments, Print Invoices, Reports                                                                          |
| System     | Settings, Technical Support                                                                                        |

---

## 🧾 PDF Export

The platform supports admin PDF export for operational sections.

PDF exports include:

* DAY NIGHT branding
* Arabic RTL support
* English LTR support
* Current section title
* Current filters
* Totals
* Visible rows
* Generated date/time
* Clean printable layout

---

## 🌐 Arabic / English Support

The platform supports bilingual interface behavior:

* Arabic RTL
* English LTR
* Bilingual menu titles
* Bilingual section descriptions
* Bilingual admin workspace labels
* Bilingual export payloads

---

## 🎨 UI / UX Direction

The admin panel follows a premium logistics command-center visual language:

* Luxury navy / gold / blue palette
* Glassmorphism surfaces
* Soft glow effects
* Responsive grid layouts
* Professional admin cards
* Mobile-friendly navigation
* Scroll-safe tables
* Modern operational dashboard style

---

## 🧩 Supabase Backend

Supabase is used as the main backend layer.

Core areas:

* Auth
* Profiles
* Orders
* Merchants
* Tracking
* Finance summaries
* Notifications
* Storage
* Realtime-ready operations
* Row Level Security

Expected main operational tables include:

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

## 💰 Pricing Logic

The platform supports UAE domestic and international pricing logic.

### UAE Domestic

| Type            | Final public price |
| --------------- | -----------------: |
| Main UAE Cities |             25 AED |
| Extended Areas  |             50 AED |

### GCC

| Rule          |  Price |
| ------------- | -----: |
| First KG      | 95 AED |
| Additional KG | 45 AED |

### Worldwide

| Rule          |   Price |
| ------------- | ------: |
| First KG      | 190 AED |
| Additional KG |  90 AED |

---

## 🛠️ Local Development

### Requirements

* Node.js
* pnpm
* Git
* Supabase project
* Vercel account for deployment

---

### Install

```bash
corepack enable
pnpm install
```

---

### Run Development Server

```bash
pnpm --dir artifacts/day-night-delivery run dev
```

---

### Type Check

```bash
pnpm --dir artifacts/day-night-delivery run typecheck
```

---

### Build

```bash
pnpm --dir artifacts/day-night-delivery run build
```

---

### Conflict Marker Scan

```bash
grep -R "<<<<<<<\|=======\|>>>>>>>" artifacts/day-night-delivery/src || true
```

Expected result:

```txt
No conflict markers
```

---

## 🔐 Environment Variables

Create:

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

## 🚀 Deployment

The project is configured for Vercel.

Main deployment flow:

```txt
GitHub main branch → Vercel build → Production deployment
```

Important deployment files:

```txt
vercel.json
artifacts/day-night-delivery/vercel.json
```

---

## 🗺️ Map Tile Providers

The admin map supports:

| Mode      | Provider           |
| --------- | ------------------ |
| Standard  | OpenStreetMap      |
| Satellite | Esri World Imagery |
| Terrain   | OpenTopoMap        |

Vercel CSP must allow map tile providers.

---

## 🧪 Validation Checklist

Before merging any PR:

```bash
corepack enable
pnpm install
pnpm --dir artifacts/day-night-delivery run typecheck
pnpm --dir artifacts/day-night-delivery run build
grep -R "<<<<<<<\|=======\|>>>>>>>" artifacts/day-night-delivery/src || true
```

Manual checks:

* `/auth` works
* `/admin` works
* `/tracking` works
* Admin menu loads
* Settings is not an orders table
* Map does not show repeated fallback logos
* Satellite / Terrain are not blocked
* Khalifa is visible and section-aware
* PDF export opens correctly
* Tables do not overflow on mobile

---

## ✅ Recent Milestones

### PR #47 — Specialized Admin Section Workspaces

Completed:

* Typed admin section registry
* Specialized section workspaces
* Section-specific KPIs
* Section-specific filters
* Section-specific actions
* PDF export context
* Khalifa context per section
* Safe fallback logic
* Responsive section CSS
* Typecheck passed
* Build passed
* No conflict markers

---

## 🔜 Phase 2 Roadmap — Real Operations Layer

Next operational phase:

### Finance & Accounting

* Real driver statements
* Real merchant statements
* Expenses CRUD
* Adjustments workflow
* COD reconciliation
* Accounts ledger

### Audit & Security

* Admin audit events
* Entity action tracking
* Approval / void history
* Safe admin diagnostics

### Import & Print

* CSV shipment import
* Import preview and validation
* Print job queue
* Invoice packs
* Shipping labels
* Pickup manifests

### Advanced Khalifa

* Pending expense approval alerts
* Unreconciled COD insights
* Import error insights
* Print queue alerts
* Merchant balance warnings
* Driver COD warnings

---

## 🧠 Development Principles

This project follows these rules:

* Real data first
* No fake success messages
* No raw Supabase errors in the UI
* Safe fallbacks only
* Arabic and English support
* Mobile responsive admin screens
* Clean Git history
* Build before merge
* Never expose secrets
* Keep `/auth`, `/admin`, and `/tracking` stable

---

## 👤 Owner

<div align="center">

**DAY NIGHT DELIVERY SERVICES**
UAE Logistics & Delivery Operations Platform

**Managed by:** أبو خليفة
**Built for:** Premium delivery, shipping, merchant operations, and smart logistics management.

</div>

---

## 📄 License

Private business project.
All rights reserved to DAY NIGHT DELIVERY SERVICES.

---

<div align="center">

### DAY NIGHT DELIVERY SERVICES

**Fast • Reliable • Every Time**

</div>
