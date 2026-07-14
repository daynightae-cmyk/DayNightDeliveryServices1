# DAY NIGHT — Full Gap Audit After Phase 9

## Scope reviewed

- Admin operations and order creation.
- Coupon image, camera, QR/barcode, OCR, and manual review.
- Public delivery request.
- Tracking.
- Merchants and order linking.
- Status updates and driver assignment.
- COD, finance, statements, audit, and daily closing.
- PDF/print and imports.
- Database health and production readiness.
- Khalifa guidance and admin notifications.
- Map and responsive behavior.
- Supabase migrations, RLS, storage, and RPC usage.

## Phase 9 delivered

### Admin coupon photo intake

Status: **Implemented in code; migration required in production Supabase.**

- Visible tab: **إدخال الكوبون بالتصوير / Coupon Photo Intake**.
- Rear-camera capture on mobile.
- Image upload and preview.
- Browser QR/barcode attempt.
- Native text detector attempt where available.
- Lazy OCR fallback for Arabic and English.
- Manual text fallback.
- Confidence score and missing-field warnings.
- Extracted field prefilling.
- Mandatory manual review confirmation.
- Price mismatch warning against the system price.
- Real order creation through the existing `admin_create_coupon_order` RPC/direct DB-safe fallback.
- Private image upload and coupon intake audit when the new migration is applied.

### Public request coupon intake

Status: **Implemented as an optional prefill workflow.**

- Optional capture/upload panel on `/request`.
- Extracted receiver, location, package, coupon, and COD data can prefill the request.
- Manual correction and confirmation are required.
- Final request uses the existing `create_public_order` flow.
- Public audit is metadata-only after successful order creation.
- Anonymous users cannot upload or read private coupon images.

### Tracking

Status: **Existing production path preserved.**

- The returned Supabase tracking reference remains the source of truth.
- `/tracking` continues to use `track_order` with safe direct reference fallback.
- Coupon numbers are attached to order payloads when recognized.

### Storage and audit

Status: **Migration added; must be applied.**

Added:

- `coupon_intake_sessions` table.
- Private `coupon-images` bucket.
- Admin/support RLS policies.
- Admin audit RPC.
- Public metadata-only audit RPC.
- Read-only health RPC.
- Verification SQL.

## Operational area audit

| Area | Current status | Remaining action |
| --- | --- | --- |
| Admin new order | Real DB-backed | Apply operations and coupon migrations; run QA |
| Coupon photo intake | Implemented | Apply migration; verify several real coupon layouts |
| QR/barcode | Browser-supported path implemented | Maintain manual fallback for unsupported browsers |
| OCR | Lazy Arabic/English OCR implemented | Accuracy depends on image/network; server OCR remains optional future work |
| Add merchant | Real DB-backed | Continue validating merchant RLS and direct linking |
| Merchant linking | Uses `merchant_id` when selected | Require merchant selection where business policy demands it |
| Order status updates | Existing RPC work present in repository | Resolve/close stale competing PRs and apply status migrations deliberately |
| Driver assignment | Existing admin flow retained | Run end-to-end assignment/reassignment QA |
| COD | DB-first with derived fallback | Apply finance migrations and remove derived status only after real rows exist |
| Finance | Production suite exists | Apply all finance migrations and test approvals/reconciliation |
| PDF/print | Existing exports retained | Test Arabic fonts/layout on real invoices and mobile browsers |
| Import/export | CSV preview exists | XLSX import and server-confirmed batch order commit remain future work |
| Audit log | DB-backed when migration is applied | Confirm every privileged mutation writes an event |
| Database health | Existing center retained | Add coupon health object to central health registry in a later focused patch if desired |
| Production readiness | Existing center retained | Re-run after all migrations and real operational tests |
| Khalifa | Coupon guidance added | Continue adding section-specific deterministic guidance only |
| Audio/notifications | Existing system retained | No new audio dependency required for coupon intake |
| Map | Existing Leaflet controls retained | Test selected-order route and mobile control dock |
| Mobile | Coupon component is responsive | Verify real camera permission flows on Android/iPhone |

## Public website audit

| Route/area | Status | Notes |
| --- | --- | --- |
| `/request` | Coupon intake integrated | Final order remains Supabase-backed |
| `/tracking` | Existing RPC flow retained | Verify recognized coupon reference does not expose private data |
| Pricing | Existing engine retained | Coupon-read price never overrides system price automatically |
| Contact | No Phase 9 change | Verify official company data remains current |
| QR hub | No Phase 9 change | QR links must remain real and testable |
| Smart Chat | No Phase 9 change | No external AI dependency added |
| SEO | No Phase 9 change | Review separately with production crawl |
| Mobile | Coupon camera-first layout added | Real-device QA required |

## Backend and data audit

### Ready in repository

- Supabase public client uses public environment variables only.
- Admin order creation prefers `admin_create_coupon_order`.
- Public creation prefers `create_public_order`.
- Tracking prefers `track_order`.
- Coupon intake migration is idempotent and non-destructive.
- Private image storage policies are scoped to admin/support.
- Public audit does not accept image paths.

### Must be applied or verified in production

1. `20260714103000_coupon_photo_intake.sql`.
2. `20260714104000_coupon_photo_intake_health_rpc.sql`.
3. `VERIFY_COUPON_PHOTO_INTAKE.sql`.
4. Admin/support role exists and is active in `profiles`.
5. `admin_create_coupon_order` and `create_public_order` are installed and working.
6. Storage bucket remains private.
7. Vercel production has the approved `VITE_SUPABASE_URL` and public anon key.

## Data honesty rules preserved

- OCR and QR output is preliminary.
- Unknown values stay empty rather than being invented.
- Manual review is mandatory.
- The system-calculated price remains authoritative.
- No order success is displayed without a returned Supabase reference.
- Private coupon images are never publicly listed.
- Raw Supabase errors are not displayed in the UI.

## Remaining blockers before calling the complete system global-ready

1. Apply every required Supabase migration in the production project and preserve an execution log.
2. Run end-to-end QA with real admin/support, merchant, customer, and driver accounts.
3. Add automated browser tests for camera fallback, image upload, manual review, public submit, and tracking.
4. Validate OCR against a representative set of real coupon layouts, lighting conditions, Arabic fonts, and barcodes.
5. Decide whether public coupon images should ever be uploaded; Phase 9 intentionally keeps public audit metadata-only for privacy.
6. Add a signed, expiring admin-only image viewer if operations needs to reopen archived coupon images from the UI.
7. Finish XLSX import and a server-transactional batch commit/rollback workflow.
8. Resolve or close stale open PRs that overlap main to prevent future conflicts.
9. Verify all finance/status/order migrations are applied before removing any derived/fallback warnings.
10. Complete production smoke tests at desktop, tablet, Android, and iPhone widths.

## Acceptance position

Phase 9 makes coupon-by-photo a real reviewed intake path in the repository. It does **not** claim OCR is infallible, that migrations were automatically applied, or that public users can access private coupon images. Production acceptance requires the migration, Vercel green status, real-device QA, and successful creation/tracking of real Supabase orders.
