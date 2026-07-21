# DAY NIGHT Merchant Portal — File Manifest

## Production route/controller

- `src/App.tsx` — `/merchant` loads the new command center.
- `src/components/merchant/MerchantPortalCommandCenter.tsx` — production auth/data/controller boundary.

## Production reusable Merchant UI

- `src/portal-designs/merchant/merchantViewModels.ts`
- `src/portal-designs/merchant/merchantCallbacks.ts`
- `src/portal-designs/merchant/merchantFormatters.ts`
- `src/portal-designs/merchant/merchantStatusMapping.ts`
- `src/portal-designs/merchant/merchantSections.ts`
- `src/portal-designs/merchant/MerchantPortalShell.tsx`
- `src/portal-designs/merchant/MerchantDesktopSidebar.tsx`
- `src/portal-designs/merchant/MerchantBottomNavigation.tsx`
- `src/portal-designs/merchant/MerchantHeader.tsx`
- `src/portal-designs/merchant/MerchantMobileMoreSheet.tsx`
- `src/portal-designs/merchant/MerchantCommandPalette.tsx`
- `src/portal-designs/merchant/MerchantUi.tsx`
- `src/portal-designs/merchant/MerchantDashboardView.tsx`
- `src/portal-designs/merchant/MerchantOrdersView.tsx`
- `src/portal-designs/merchant/MerchantOrderDetailsView.tsx`
- `src/portal-designs/merchant/MerchantCreateOrderView.tsx`
- `src/portal-designs/merchant/MerchantCouponPhotoIntake.tsx`
- `src/portal-designs/merchant/MerchantWorkspaces.tsx`
- `src/portal-designs/merchant/MerchantBusinessWorkspace.tsx`
- `src/portal-designs/merchant/MerchantSectionRenderer.tsx`
- `src/portal-designs/merchant/index.ts`
- `src/styles/dn-merchant-command-center.css`

## Database/runtime

- `supabase/migrations/20260721120000_merchant_business_center.sql`
- `supabase/migrations/20260721123000_merchant_business_center_runtime.sql`

## Validation/documentation

- `scripts/merchant-final-closure-gate.mjs`
- `MERCHANT_PORTAL_INTEGRATION.md`
- `MERCHANT_PORTAL_FILE_MANIFEST.md`
- `MERCHANT_PORTAL_CALLBACK_CONTRACTS.md`
- `MERCHANT_PORTAL_AUDIT_REPORT.md`

## Intentionally not used

The old generated Merchant preview/scaffold files, demo credentials, demo auth, placeholder views, fake maps, and corrupted integration ZIP are not part of production integration.

The legacy `src/components/merchant/MerchantPortal.tsx` remains in the repository as rollback/reference code but is no longer loaded by `/merchant`.
