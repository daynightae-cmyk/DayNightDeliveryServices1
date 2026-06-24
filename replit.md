# Day Night Delivery Services

A full-featured delivery and logistics web app for DAY NIGHT DELIVERY SERVICES (UAE). Supports domestic UAE delivery, international shipping, e-commerce solutions, corporate accounts, shipment tracking, pricing calculators, admin panel, driver portal, and customer dashboard. Bilingual (English/Arabic) with light/dark theme.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies per workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase (for live order tracking/admin). App falls back to local pricing engine if not set.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + react-router-dom v7
- Maps: Leaflet + react-leaflet (tracking map)
- Backend: Supabase (external) with local fallback pricing engine
- API: Express 5 (scaffold, not yet used by frontend)
- DB: PostgreSQL + Drizzle ORM (scaffold)
- Validation: Zod, drizzle-zod
- Build: esbuild (API), Vite (frontend)

## Where things live

- `artifacts/day-night-delivery/src/App.tsx` — main app shell, routing (react-router-dom BrowserRouter)
- `artifacts/day-night-delivery/src/components/` — all page components
- `artifacts/day-night-delivery/src/data/` — translations, company meta, pricing rules, services data
- `artifacts/day-night-delivery/src/lib/` — AppContext (theme/language), pricing engine, Supabase wrappers
- `artifacts/day-night-delivery/src/supabase.ts` — Supabase client + RPC wrappers with local fallbacks
- `artifacts/day-night-delivery/src/index.css` — brand tokens (navy/gold palette), dark/light themes
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — Drizzle DB schema

## Architecture decisions

- App is frontend-heavy; Supabase handles order storage/tracking/admin RPCs. If Supabase env vars are absent, pricing and order creation fall back to local logic so the app still works.
- React Router v7 BrowserRouter is used (not wouter) to match original app routing; previewPath is "/" so BrowserRouter base is compatible.
- Bilingual RTL/LTR support: `html dir` is set to RTL by default in index.html; the app toggled dynamically via CSS.
- Theme (dark/light) managed by AppContext using localStorage + system preference detection.

## Product

- Home with hero/stats/services overview
- UAE domestic delivery information + suburb coverage
- International shipping calculator + advanced options
- E-commerce solutions page
- Corporate solutions page
- Pricing page with weight-based calculator
- Shipment tracking with map (Leaflet)
- Request delivery form (submits to Supabase or falls back locally)
- Admin panel (protected route, requires Supabase auth)
- Driver portal
- Customer dashboard
- Gallery, FAQ, Contact, Policy pages
- Floating WhatsApp widget + Smart Chat

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `VITE_SUPABASE_URL` must equal `https://ngdwybpgacauorygoedi.supabase.co` exactly (hardcoded check in supabase.ts) or Supabase client is skipped.
- Do not run `pnpm dev` at workspace root — use `restart_workflow` instead.
- Service worker registered at `/sw.js` — exists in `public/sw.js`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
