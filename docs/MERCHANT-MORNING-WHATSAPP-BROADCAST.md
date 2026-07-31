# Merchant Morning WhatsApp Broadcast

## Purpose

The Admin Message Center contains a live **Today's orders message** workspace for registered merchants.

- Every active merchant with a valid stored phone number is included automatically.
- Newly added merchants appear through the realtime `merchants` subscription and are selected by default.
- Each message is addressed to the merchant by business/owner name.
- Disabled, blocked, archived, suspended, inactive, rejected, or closed merchants are excluded.
- An administrator may opt an individual merchant out with `whatsapp_broadcast_enabled = false`.
- The server prevents duplicate successful sends to the same merchant on the same UAE calendar date unless **Force resend** is explicitly selected.
- Campaign and recipient outcomes are stored for audit and operational review.

## Two operating modes

### 1. Official automatic sending

The green send button calls the protected Supabase Edge Function:

```text
merchant-morning-broadcast
```

The function validates the authenticated admin/support role, loads merchants from the production database, sends one approved WhatsApp Business template message per merchant, and stores the provider message ID or failure reason.

This is the only mode that can complete sending without asking the operator to press **Send** in each WhatsApp chat.

### 2. Sequential WhatsApp Web fallback

When the official provider is not configured, the admin can open prepared merchant chats one at a time. WhatsApp Web/mobile opens with the personalized text already filled in. The operator must press **Send** in the WhatsApp interface.

Opening is intentionally sequential so browser pop-up protection does not block dozens of tabs and so the operator can verify each conversation.

## Required Supabase Edge Function secrets

Configure these only in Supabase Edge Function Secrets. Never place them in Vite variables or frontend source.

```text
WHATSAPP_CLOUD_ACCESS_TOKEN=<permanent-or-system-user-access-token>
WHATSAPP_PHONE_NUMBER_ID=<Meta WhatsApp phone-number ID>
WHATSAPP_GRAPH_VERSION=<supported Graph API version, for example v23.0>
WHATSAPP_MERCHANT_MORNING_TEMPLATE=day_night_merchant_orders_today
WHATSAPP_MERCHANT_MORNING_LANGUAGE_AR=ar
WHATSAPP_MERCHANT_MORNING_LANGUAGE_EN=en_US
```

The first three values are mandatory. The last three have safe defaults but should match the approved template exactly.

## Meta template to create and approve

Create a WhatsApp **Utility** template named:

```text
day_night_merchant_orders_today
```

The Edge Function supplies exactly one body variable: the merchant name.

### Arabic body

```text
السلام عليكم ورحمة الله وبركاته يا {{1}} 👋

صباح الخير من فريق داي نايت لخدمات التوصيل والشحن 💙

نحن جاهزون اليوم لاستلام وتوصيل طلباتكم بكل سرعة واهتمام. هل لديكم طلبيات جاهزة للاستلام اليوم؟ 📦🚚

يمكنكم تسجيل الطلبات مباشرة من خلال لوحة التاجر:
https://www.daynightae.com/merchant

أو الرد على هذه الرسالة بكلمة «نعم»، وسيتواصل معكم فريق العمليات فورًا لترتيب الاستلام.

عند إرسال الطلب يرجى توضيح اسم العميل، رقم الهاتف، عنوان التوصيل، المبلغ المطلوب تحصيله، وأي ملاحظات خاصة.

نتمنى لكم يومًا موفقًا ومبيعات مباركة.
داي نايت لخدمات التوصيل والشحن
سريع • آمن • موثوق
```

### English body

```text
Good morning {{1}} 👋

DAY NIGHT DELIVERY SERVICES is ready to collect and deliver your orders today with speed and care. Do you have shipments ready for pickup? 📦🚚

Create orders in the merchant portal:
https://www.daynightae.com/merchant

Or reply “Yes” and our operations team will contact you to arrange pickup. Please include the customer name, phone, delivery address, collection amount, and any special notes.

Wishing you a successful day.
DAY NIGHT DELIVERY SERVICES
Fast • Reliable • Every Time
```

The text and variable count in Meta must match the Edge Function payload. If Meta approves only Arabic, keep the UI language on Arabic until the English variant is approved.

## Deployment

1. Apply migration:

```text
supabase/migrations/20260731162000_merchant_morning_whatsapp_broadcast.sql
```

2. Deploy the function:

```bash
supabase functions deploy merchant-morning-broadcast --project-ref ngdwybpgacauorygoedi --no-verify-jwt
```

3. Configure the secrets listed above.
4. Open Admin → Message Center.
5. Confirm the status chip reads **Official sending connected**.
6. Select a small internal test merchant and send once.
7. Verify:
   - WhatsApp delivery in the intended conversation;
   - provider message ID in `merchant_broadcast_recipients`;
   - campaign totals in `merchant_broadcast_campaigns`;
   - a second normal send on the same date is skipped;
   - Force resend works only after explicit confirmation.

## Database objects

```text
merchants.whatsapp_broadcast_enabled
merchants.whatsapp_broadcast_language
merchant_broadcast_campaigns
merchant_broadcast_recipients
merchant_morning_broadcast_health()
```

## Security boundaries

- Meta access tokens and phone-number IDs are server-only.
- The Edge Function performs its own authenticated admin/support role check.
- The browser never calls Meta Graph API directly.
- Only authenticated administrators can read campaign and recipient audit rows.
- Provider failures are returned and stored; the UI does not display false success.
- Automatic sending does not run on page load or on a schedule. It requires an explicit button press and confirmation.
