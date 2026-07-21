# DAY NIGHT Merchant Portal — Callback Contracts

All reusable Merchant components receive data and operations through typed props. Required operations have no silent no-op defaults.

## Core

- `onNavigate(section, payload)` — typed section/payload navigation.
- `onRefreshData()` — reloads profile, orders, business center, and timeline data.
- `onLogout()` — terminates the existing Supabase session.

## Order and pricing

- `onCalculatePrice(draft): MerchantPricingResult`
  - Returns confirmed/unavailable state, source, component amounts, total, currency, and typed error.
- `onCreateOrder(draft): MerchantCreateOrderResult`
  - Returns authoritative order ID, tracking, invoice, amount, and created time.
- `onOpenOrder(orderId)` and `onTrackOrder(order)` — set selected order before navigation.
- `onCancelOrder`, `onRequestReturn`, `onRequestReschedule`
  - Return `MerchantOrderTransitionResult`; no optimistic production success is asserted before RPC completion.

## Coupon/files

- `onUploadCouponImage(file): MerchantFileUploadResult`
- `onExtractCoupon(url): MerchantCouponExtractionResult`
- `onUploadLogo(file): MerchantFileUploadResult`
- `onUploadDocument(file, metadata): MerchantFileUploadResult`

Upload success requires a returned storage path/URL. Extraction is optional and human review remains mandatory.

## Pickup/import

- `onRequestPickup(input): MerchantPickupRequestResult`
- `onCreateImportPreview(input): MerchantImportPreviewResult`
- `onCommitImport(batchId): MerchantImportCommitResult`
- `onDownloadImportErrors(batchId): MerchantDownloadResult`

## Finance/export

- `onDownloadInvoice(invoiceId): MerchantDownloadResult`
- `onDownloadStatement(statementId, format): MerchantDownloadResult`
- `onPrintLabels(orderIds): MerchantPrintResult`

## Profile/business

- `onUpdateProfile(input): MerchantProfileUpdateResult`
- `onUpdateBankDetails(input): MerchantProfileUpdateResult`
- `onSaveBranch(input)`
- `onSaveAddressBookEntry(input)`
- `onSaveTeamMember(input)`

## Support/search/notifications

- `onSubmitSupportRequest(input): MerchantSupportResult`
- `onGlobalSearch(query): MerchantGlobalSearchResult`
- `onMarkNotificationRead(notificationId)`

## Error semantics

Every result can include `MerchantOperationError`:

- `code`
- localized-safe `message`
- optional `retryable`

Raw database errors and secrets are not displayed directly.
