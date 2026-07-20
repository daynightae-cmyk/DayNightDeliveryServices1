# DAY NIGHT portal recovery scope

This document records the final recovery target after accidental historical deployment/branch interactions.

- `main` is the only production source of truth.
- `/merchant` and `/driver` must render as isolated applications, without the public website header/footer/chat shell.
- Merchant and driver panels must support Arabic/English, RTL/LTR, and working light/dark/system themes.
- Merchant and driver notification buttons must read real rows from `public.notifications`, subscribe through Realtime, and mark notifications read.
- Merchant account ownership remains strict: one auth user -> one merchant row -> orders by `orders.merchant_id` only.
- No mock operational orders, fake financial records, or placeholder action handlers.
- The official merchant record is `DN-MERCHANT-OFFICIAL` with `merchant@daynightae.com`.
- Credentials must never be committed to the public repository.
