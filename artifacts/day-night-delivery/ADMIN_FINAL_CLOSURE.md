# DAY NIGHT Admin — Final Closure Record

This document records the production architecture and closure criteria for the `/admin` portal.

## Scope

- 31 exact Admin section identifiers are preserved.
- Authentication remains under `ProtectedAdminRoute` and the existing Supabase session.
- No alternate router, authentication client, database client, or demo data source is introduced.
- The Command Center shell is presentation/navigation; `AdminPanelLuxury` and its production children remain the operational source.

## Section matrix

| Section | Production component | Primary source / operation |
|---|---|---|
| Dashboard | `AdminPanelLuxury` dashboard | orders, merchants, finance summary, Leaflet map, notifications, daily closing |
| Live Drivers | `DriverTrackingPanel` | driver profiles, locations, history, events, orders, realtime channels |
| New Order | `AdminNewOrderComplete` | production pricing, financial order creation, coupon photo review and intake audit |
| New Merchant | `AdminNewMerchant` | merchant RPC/table persistence with validation |
| Merchants | `AdminMerchantIntelligence` | merchants and related order navigation |
| All Orders | `AdminSectionWorkspaceComplete` | orders, edit/delete/assign/status mutations, PDF |
| Cancelled | shared order workspace | status-filtered orders |
| Under Review | shared order workspace | status-filtered orders |
| Postponed | shared order workspace | status-filtered orders |
| Returned | shared order workspace | status-filtered orders |
| Pickup | shared order workspace | operational section matching |
| Abu Dhabi | shared order workspace | regional order matching |
| International | shared order workspace | international order matching |
| Other Emirates | shared order workspace | UAE out-of-primary-region matching |
| Finance Dashboard | `AdminFinanceOperationsCenter` | finance RPC/view/ledger sources |
| Driver Statements | finance/operations layer | `driver_statement_entries` |
| Merchant Statements | finance/operations layer | `merchant_statement_entries` |
| Income | finance center | operational ledger and summary |
| COD | finance center | `cod_collections` and ledger |
| Expenses | finance center | expense RPC/table and status actions |
| Accounts | finance center | account entries and snapshots |
| Adjustments | finance center | adjustment RPC/table and status actions |
| Audit Log | operations layer | `admin_audit_events` |
| Import | operations layer | `import_batches`, `import_batch_rows`, validation and commit |
| Print | operations layer/PDF | `print_jobs`, browser print, PDF preview/export |
| Reports | operations layer | combined production tables and PDF/CSV/DOC output |
| Settings | `AdminControlSettings` | safe local Admin preferences, unified app theme, maps, notifications and audio |
| Support | `AdminSystemSupportCenter` | audit-backed notes with explicit local-pending fallback and retry |
| Database Health | `AdminDatabaseHealthCenter` | real tables/views/RPC checks and finance hardening health |
| Production Readiness | `AdminProductionReadinessCenter` | database, finance and release readiness report |
| Logout | existing Supabase sign-out flow | authenticated session termination |

## Final static gate

`pnpm --dir artifacts/day-night-delivery run admin:closure`

The gate verifies:

- all 31 section IDs and rendering routes;
- real order, merchant, driver, map, finance, import, print, support, health and readiness contracts;
- required migrations and authoritative database objects;
- absence of demo maps, random GPS, `alert()` business operations and explicit no-op buttons.

The gate is included in `production:gate`, so a future regression blocks production validation.

## Runtime truth policy

A successful build proves code integration, not the existence or permission state of every remote database object. The signed-in operator must use **Database Health** and **Production Readiness** to confirm the current Supabase environment. Missing migrations, RLS restrictions, empty tables and unavailable RPCs are shown separately and must never be represented as successful live services.

## Handoff rule

Admin is considered closed for feature work when:

1. TypeScript, production gates and build pass.
2. Vercel Preview and Production deployments are green.
3. Database Health reports no blocking missing/permission objects for required operations.
4. Production Readiness reports no critical blocker.
5. A signed-in operator completes one controlled smoke test for create order, create merchant, driver assignment, status delivery/posting, import preview, print/PDF, support note and daily closing.

Further work should then move to the Driver Portal unless a verified Admin regression is reported.
