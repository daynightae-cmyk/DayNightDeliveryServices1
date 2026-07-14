# DAY NIGHT — Coupon Photo Intake QA

## Purpose

This checklist verifies the production coupon workflow without treating OCR, QR, or barcode output as final truth.

The workflow is intentionally layered:

1. Capture or upload an image.
2. Try browser QR/barcode detection.
3. Try native text detection when available.
4. Lazy-load OCR for Arabic and English text.
5. Prefill recognized fields.
6. Require manual review.
7. Create the real order through Supabase.
8. Store admin images privately and write an intake audit record when the migration is applied.

## Required Supabase files

Apply in order:

1. `supabase/migrations/20260714103000_coupon_photo_intake.sql`
2. `supabase/migrations/20260714104000_coupon_photo_intake_health_rpc.sql`

Then run:

- `docs/supabase/VERIFY_COUPON_PHOTO_INTAKE.sql`

## Admin QA — `/admin`

1. Sign in with an active admin/support profile.
2. Open **Operations → New Order**.
3. Confirm two visible tabs:
   - **إدخال الكوبون بالتصوير / Coupon Photo Intake**
   - **إدخال يدوي / Manual Entry**
4. Capture a coupon with the phone rear camera.
5. Upload JPG, PNG, and WEBP examples.
6. Confirm the image preview is visible.
7. Confirm the result identifies its source: QR/barcode, OCR, or manual text.
8. Confirm extraction confidence is shown.
9. Confirm missing fields are listed.
10. Confirm extracted fields prefill the order form.
11. Edit an incorrectly recognized name, phone, address, COD value, or city.
12. Confirm order creation is blocked until manual review is checked.
13. Test an image containing a delivery fee different from the system price.
14. Confirm the UI warns about the mismatch and keeps the system-calculated price.
15. Create the order.
16. Confirm a real tracking reference returns from Supabase.
17. Confirm the order appears in the real orders list.
18. Confirm the coupon intake audit row is stored.
19. Confirm an admin image path exists only when the private bucket upload succeeds.
20. Confirm the image is not publicly accessible.

## Public QA — `/request`

1. Open the public request page in Arabic.
2. Confirm the optional coupon capture/upload panel appears.
3. Upload or capture a coupon.
4. Confirm receiver/package/COD fields are prefilled when recognized.
5. Correct any wrong values.
6. Confirm the manual review checkbox is mandatory when a coupon was used.
7. Complete sender details and security verification.
8. Submit.
9. Confirm a real tracking number is returned.
10. Confirm `/tracking` can find the returned number.
11. Confirm public coupon metadata is audited only after order creation.
12. Confirm anonymous users cannot list audit rows or read coupon images.

## Browser fallback QA

Test at least:

- Chrome desktop.
- Chrome Android.
- Safari iPhone.
- Edge desktop.

Expected behavior:

- When `BarcodeDetector` is unavailable, the workflow continues to OCR/manual review.
- When OCR cannot load or cannot read the image, the user sees a clear manual fallback.
- Camera denial does not crash the page.
- Image files over 12 MB are rejected cleanly.
- No raw OCR exception or Supabase schema error appears to the user.

## Security QA

- No service role key is present in frontend code.
- `coupon-images` remains private.
- Only admin/support users can upload/read/delete admin coupon images.
- Anonymous users may call only the metadata-only public RPC.
- Public audit records do not contain full addresses or image bytes.
- OCR raw text is capped before database storage.
- Manual review is required before order creation.
- No fake success is shown if Supabase order creation fails.

## Responsive QA

Verify at widths:

- 1440 px desktop.
- 1024 px laptop.
- 768 px tablet.
- 430 px phone.
- 390 px phone.

Confirm:

- No horizontal scrolling.
- Camera/upload controls remain touch-friendly.
- Preview does not overflow.
- Confidence and warning chips wrap cleanly.
- Form fields remain readable in RTL and LTR.

## Known operational dependency

OCR uses a browser-loaded Tesseract runtime when native text detection is unavailable. Its availability and accuracy depend on network access, browser support, image clarity, and coupon layout. Manual review is therefore mandatory and is the final authority before order creation.
