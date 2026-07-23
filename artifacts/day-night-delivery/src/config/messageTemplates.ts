export type MessageLocale = "ar" | "en";

export type MessageTemplateKey =
  | "driver_on_the_way"
  | "driver_request_location"
  | "driver_arrived"
  | "driver_unreachable"
  | "driver_delivered_feedback"
  | "merchant_welcome"
  | "merchant_orders_today"
  | "merchant_order_received"
  | "merchant_driver_assigned"
  | "merchant_shipment_collected"
  | "merchant_delivered"
  | "merchant_delivery_failed"
  | "merchant_settlement"
  | "tracking_support"
  | "cod_service"
  | "merchant_registration"
  | "complaint_support"
  | "admin_order_contact"
  | "generic_support";

export type DefaultMessageTemplate = {
  key: MessageTemplateKey;
  audience: "customer" | "merchant" | "driver" | "support" | "admin";
  titleAr: string;
  titleEn: string;
  ar: string;
  en: string;
};

export const MESSAGE_TEMPLATE_VARIABLES = [
  "customer_name",
  "customer_city",
  "merchant_name",
  "driver_name",
  "tracking_number",
  "amount_due",
  "amount_due_line",
  "payment_method",
  "payment_line",
  "tracking_url",
  "feedback_url",
  "merchant_portal_url",
  "merchant_order_url",
  "statement_url",
  "order_status",
  "complaint_number",
  "support_phone",
  "company_name_ar",
  "company_name_en",
  "company_email",
  "company_website",
  "pickup_time",
  "delivery_time",
  "failure_reason",
  "settlement_period",
  "order_count",
  "gross_collected",
  "fees",
  "net_due",
] as const;

export const DEFAULT_MESSAGE_TEMPLATES: Record<MessageTemplateKey, DefaultMessageTemplate> = {
  driver_on_the_way: {
    key: "driver_on_the_way",
    audience: "customer",
    titleAr: "أنا في الطريق",
    titleEn: "Driver on the way",
    ar: `السلام عليكم أ/ {customer_name} 👋

مع حضرتك {driver_name}، مندوب شركة داي نايت لخدمات التوصيل والشحن.

🚚 أنا الآن في الطريق إليكم لتسليم الشحنة التالية:

📦 رقم الشحنة: {tracking_number}
{amount_due_line}
{payment_line}

📍 يرجى إرسال موقع الاستلام الحالي من خلال خاصية مشاركة الموقع في واتساب، مع التأكد من وجود شخص متاح لاستلام الشحنة.

يمكنكم متابعة حالة الشحنة مباشرة من هنا:
🔎 {tracking_url}

ولتقييم الخدمة أو إرسال ملاحظة بعد استلام الطلب:
⭐ {feedback_url}

شكرًا لاختياركم داي نايت.
سريع • آمن • موثوق`,
    en: `Hello {customer_name} 👋

This is {driver_name}, your DAY NIGHT DELIVERY SERVICES driver.

🚚 I am on the way to deliver your shipment:

📦 Tracking number: {tracking_number}
{amount_due_line}
{payment_line}

📍 Please share your current WhatsApp location and make sure someone is available to receive the shipment.

Track the shipment:
🔎 {tracking_url}

Rate the service or send a note after delivery:
⭐ {feedback_url}

Thank you for choosing DAY NIGHT.
Fast • Reliable • Every Time`,
  },
  driver_request_location: {
    key: "driver_request_location",
    audience: "customer",
    titleAr: "طلب إرسال الموقع",
    titleEn: "Request location",
    ar: `السلام عليكم أ/ {customer_name} 👋

مع حضرتك {driver_name}، مندوب داي نايت.

أنا في طريق التوصيل الخاص بالشحنة:

📦 {tracking_number}

يرجى إرسال موقعكم الحالي عن طريق الضغط على علامة المشبك في واتساب، ثم اختيار:

📍 الموقع ← إرسال موقعك الحالي

ذلك يساعدنا على الوصول إليكم بسرعة ودقة أكبر.

تتبع الشحنة:
🔎 {tracking_url}

شكرًا لتعاونكم.
داي نايت لخدمات التوصيل والشحن`,
    en: `Hello {customer_name} 👋

This is {driver_name}, your DAY NIGHT driver.

I am delivering shipment:
📦 {tracking_number}

Please tap the attachment icon in WhatsApp, choose Location, then send your current location.

This helps us reach you faster and more accurately.

Track the shipment:
🔎 {tracking_url}

Thank you for your cooperation.
DAY NIGHT DELIVERY SERVICES`,
  },
  driver_arrived: {
    key: "driver_arrived",
    audience: "customer",
    titleAr: "وصلت إلى الموقع",
    titleEn: "Driver arrived",
    ar: `السلام عليكم أ/ {customer_name}

وصل مندوب داي نايت إلى موقع التسليم الآن 🚚📍

📦 رقم الشحنة: {tracking_number}
{amount_due_line}

يرجى التكرم بالتوجه لاستلام الشحنة أو التواصل مع المندوب.

متابعة الطلب:
🔎 {tracking_url}

شكرًا لاختياركم داي نايت لخدمات التوصيل والشحن.`,
    en: `Hello {customer_name},

Your DAY NIGHT driver has arrived at the delivery location 🚚📍

📦 Tracking number: {tracking_number}
{amount_due_line}

Please proceed to receive the shipment or contact the driver.

Track the order:
🔎 {tracking_url}

Thank you for choosing DAY NIGHT DELIVERY SERVICES.`,
  },
  driver_unreachable: {
    key: "driver_unreachable",
    audience: "customer",
    titleAr: "تعذر التواصل",
    titleEn: "Unable to contact customer",
    ar: `السلام عليكم أ/ {customer_name}

حاول مندوب داي نايت الوصول إليكم بخصوص الشحنة:

📦 {tracking_number}

ولكن تعذر التواصل أو تحديد موقع التسليم.

يرجى الرد على هذه الرسالة وإرسال الموقع الصحيح، أو التواصل معنا لتحديد موعد مناسب للتسليم.

🔎 تتبع الشحنة:
{tracking_url}

📞 خدمة العملاء:
{support_phone}

داي نايت لخدمات التوصيل والشحن`,
    en: `Hello {customer_name},

Your DAY NIGHT driver tried to contact you regarding shipment:
📦 {tracking_number}

We could not reach you or confirm the delivery location.

Please reply with the correct location or contact us to arrange a suitable delivery time.

Track the shipment:
{tracking_url}

Customer support:
{support_phone}

DAY NIGHT DELIVERY SERVICES`,
  },
  driver_delivered_feedback: {
    key: "driver_delivered_feedback",
    audience: "customer",
    titleAr: "تم التسليم – طلب تقييم",
    titleEn: "Delivered – request feedback",
    ar: `تم تسليم شحنتكم بنجاح ✅📦

شكرًا لاختياركم داي نايت لخدمات التوصيل والشحن.

📦 رقم الشحنة: {tracking_number}

رأيكم مهم جدًا لنا ويساعدنا على تحسين مستوى الخدمة.

⭐ يمكنكم تقييم تجربة التوصيل والمندوب من خلال الرابط التالي:
{feedback_url}

لن يستغرق التقييم أكثر من دقيقة واحدة.

في حال وجود أي ملاحظة أو شكوى، يمكنكم تسجيلها من نفس الصفحة، وسيتم إرسالها مباشرة إلى إدارة الشركة.

شكرًا لثقتكم بنا 💙
DAY NIGHT DELIVERY SERVICES
Fast • Reliable • Every Time`,
    en: `Your shipment was delivered successfully ✅📦

Thank you for choosing DAY NIGHT DELIVERY SERVICES.

📦 Tracking number: {tracking_number}

Your opinion helps us improve the service.

⭐ Rate the delivery experience and the driver:
{feedback_url}

It takes less than one minute. You can also submit a note or complaint from the same page and it will reach management directly.

Thank you for your trust 💙
DAY NIGHT DELIVERY SERVICES
Fast • Reliable • Every Time`,
  },
  merchant_welcome: {
    key: "merchant_welcome",
    audience: "merchant",
    titleAr: "ترحيب التاجر",
    titleEn: "Merchant welcome",
    ar: `السلام عليكم ورحمة الله وبركاته 👋

يسعدنا الترحيب بكم ضمن شركاء:

⭐ داي نايت لخدمات التوصيل والشحن
DAY NIGHT DELIVERY SERVICES

نتطلع إلى تقديم تجربة توصيل احترافية وسريعة تساعدكم على خدمة عملائكم وتنمية أعمالكم.

🚚 خدماتنا تشمل:

✅ توصيل الطلبات داخل جميع إمارات دولة الإمارات
✅ خدمات الدفع عند الاستلام COD
✅ متابعة الطلبات والشحنات مباشرة
✅ إدارة حالة كل طلب
✅ تحديثات فورية لحالة التوصيل
✅ دعم مستمر للتجار والعملاء
✅ حلول توصيل للمتاجر والتجارة الإلكترونية
✅ شحن محلي ودولي

🌐 الموقع الرسمي:
{company_website}

📦 تتبع الشحنات:
{tracking_url}

🏪 دخول التاجر:
{merchant_portal_url}

📞 التواصل وخدمة العملاء:
{support_phone}

✉️ البريد الإلكتروني:
{company_email}

⭐ تقييم الخدمة أو إرسال ملاحظة:
{feedback_url}

نشكر ثقتكم بشركة داي نايت، ونسعد ببدء تعاون ناجح ومستمر معكم.

داي نايت لخدمات التوصيل والشحن
سريع • آمن • موثوق`,
    en: `Hello and welcome 👋

We are pleased to welcome {merchant_name} as a DAY NIGHT DELIVERY SERVICES partner.

Our services include UAE-wide delivery, COD, live tracking, order status management, merchant and customer support, e-commerce delivery solutions, and local and international shipping.

Website:
{company_website}

Tracking:
{tracking_url}

Merchant portal:
{merchant_portal_url}

Support:
{support_phone}

Email:
{company_email}

Feedback:
{feedback_url}

Thank you for your trust. We look forward to a successful partnership.
DAY NIGHT DELIVERY SERVICES
Fast • Reliable • Every Time`,
  },
  merchant_orders_today: {
    key: "merchant_orders_today",
    audience: "merchant",
    titleAr: "الاستفسار عن طلبات اليوم",
    titleEn: "Today's orders inquiry",
    ar: `السلام عليكم ورحمة الله وبركاته 👋

معكم فريق داي نايت لخدمات التوصيل والشحن.

هل توجد لديكم طلبات جاهزة للاستلام والتوصيل اليوم؟ 📦🚚

يمكنكم تسجيل الطلبات مباشرة من خلال لوحة التاجر:

🏪 {merchant_portal_url}

أو إرسال تفاصيل الطلبات لنا عبر واتساب، مع توضيح:

• اسم العميل
• رقم الهاتف
• عنوان التوصيل
• المبلغ المطلوب تحصيله
• أي ملاحظات خاصة بالطلب

📞 الدعم:
{support_phone}

نسعد بخدمتكم ونتمنى لكم يومًا موفقًا.
داي نايت لخدمات التوصيل والشحن`,
    en: `Hello 👋

This is the DAY NIGHT DELIVERY SERVICES team.

Do you have orders ready for pickup and delivery today? 📦🚚

You can create them directly in the merchant portal:
{merchant_portal_url}

Or send us the customer name, phone, delivery address, amount to collect, and any special notes.

Support:
{support_phone}

We are ready to serve you.`,
  },
  merchant_order_received: {
    key: "merchant_order_received",
    audience: "merchant",
    titleAr: "تم استلام طلب جديد",
    titleEn: "New order received",
    ar: `تم تسجيل طلب جديد من {merchant_name} ✅

📦 رقم الشحنة: {tracking_number}
👤 العميل: {customer_name}
📍 المدينة: {customer_city}
{amount_due_line}
📋 الحالة: {order_status}

تفاصيل الطلب داخل لوحة التاجر:
{merchant_order_url}

رابط التتبع:
{tracking_url}

داي نايت لخدمات التوصيل والشحن`,
    en: `A new order from {merchant_name} was registered ✅

📦 Tracking: {tracking_number}
👤 Customer: {customer_name}
📍 City: {customer_city}
{amount_due_line}
📋 Status: {order_status}

Merchant order details:
{merchant_order_url}

Tracking:
{tracking_url}`, 
  },
  merchant_driver_assigned: {
    key: "merchant_driver_assigned",
    audience: "merchant",
    titleAr: "تم تعيين مندوب",
    titleEn: "Driver assigned",
    ar: `تم تعيين مندوب للشحنة 🚚

📦 رقم الشحنة: {tracking_number}
👤 المندوب: {driver_name}
📋 الحالة: {order_status}

متابعة الشحنة:
{tracking_url}

داي نايت لخدمات التوصيل والشحن`,
    en: `A driver has been assigned 🚚

📦 Tracking: {tracking_number}
👤 Driver: {driver_name}
📋 Status: {order_status}

Track the shipment:
{tracking_url}`,
  },
  merchant_shipment_collected: {
    key: "merchant_shipment_collected",
    audience: "merchant",
    titleAr: "تم استلام الشحنة من التاجر",
    titleEn: "Shipment collected",
    ar: `تم استلام الشحنة منكم بنجاح ✅📦

📦 رقم الشحنة: {tracking_number}
👤 المندوب: {driver_name}
🕒 وقت الاستلام: {pickup_time}

المرحلة التالية: التوجه إلى العميل للتسليم.

متابعة الشحنة:
{tracking_url}`,
    en: `The shipment was collected successfully ✅📦

📦 Tracking: {tracking_number}
👤 Driver: {driver_name}
🕒 Pickup time: {pickup_time}

Next step: delivery to the customer.

Tracking:
{tracking_url}`,
  },
  merchant_delivered: {
    key: "merchant_delivered",
    audience: "merchant",
    titleAr: "تم تسليم الشحنة",
    titleEn: "Shipment delivered",
    ar: `تم تسليم الشحنة بنجاح ✅📦

📦 رقم الشحنة: {tracking_number}
{amount_due_line}
🕒 وقت التسليم: {delivery_time}

تفاصيل الطلب:
{merchant_order_url}

تقييم الخدمة:
{feedback_url}`,
    en: `The shipment was delivered successfully ✅📦

📦 Tracking: {tracking_number}
{amount_due_line}
🕒 Delivery time: {delivery_time}

Order details:
{merchant_order_url}

Feedback:
{feedback_url}`,
  },
  merchant_delivery_failed: {
    key: "merchant_delivery_failed",
    audience: "merchant",
    titleAr: "تعذر التسليم",
    titleEn: "Delivery failed",
    ar: `تعذر تسليم الشحنة ⚠️

📦 رقم الشحنة: {tracking_number}
👤 المندوب: {driver_name}
🕒 وقت المحاولة: {delivery_time}
📋 السبب: {failure_reason}

يرجى مراجعة بيانات العميل أو التواصل معنا لتحديد الإجراء المطلوب.

تفاصيل الطلب:
{merchant_order_url}`,
    en: `Delivery could not be completed ⚠️

📦 Tracking: {tracking_number}
👤 Driver: {driver_name}
🕒 Attempt time: {delivery_time}
📋 Reason: {failure_reason}

Please review the customer details or contact us to confirm the next action.

Order details:
{merchant_order_url}`,
  },
  merchant_settlement: {
    key: "merchant_settlement",
    audience: "merchant",
    titleAr: "إشعار التسوية المالية",
    titleEn: "Settlement notice",
    ar: `إشعار تسوية مالية 💳

🏪 التاجر: {merchant_name}
📅 الفترة: {settlement_period}
📦 عدد الطلبات: {order_count}
💰 إجمالي المبالغ المحصلة: {gross_collected} درهم
🧾 الرسوم: {fees} درهم
✅ صافي المستحق: {net_due} درهم

كشف الحساب أو الفاتورة:
{statement_url}

داي نايت لخدمات التوصيل والشحن`,
    en: `Financial settlement notice 💳

🏪 Merchant: {merchant_name}
📅 Period: {settlement_period}
📦 Orders: {order_count}
💰 Gross collected: {gross_collected} AED
🧾 Fees: {fees} AED
✅ Net due: {net_due} AED

Statement or invoice:
{statement_url}`,
  },
  tracking_support: {
    key: "tracking_support",
    audience: "support",
    titleAr: "مساعدة التتبع",
    titleEn: "Tracking support",
    ar: `السلام عليكم، أحتاج مساعدة بخصوص تتبع الشحنة رقم:
{tracking_number}

رابط التتبع:
{tracking_url}`,
    en: `Hello, I need help tracking shipment:
{tracking_number}

Tracking link:
{tracking_url}`,
  },
  cod_service: {
    key: "cod_service",
    audience: "support",
    titleAr: "استفسار خدمة COD",
    titleEn: "COD service inquiry",
    ar: `السلام عليكم، أرغب في معرفة تفاصيل خدمة الدفع عند الاستلام COD المقدمة من داي نايت لخدمات التوصيل والشحن.`,
    en: `Hello, I would like information about the COD service provided by DAY NIGHT DELIVERY SERVICES.`,
  },
  merchant_registration: {
    key: "merchant_registration",
    audience: "support",
    titleAr: "تسجيل تاجر جديد",
    titleEn: "New merchant registration",
    ar: `السلام عليكم، أرغب في التسجيل كتاجر جديد مع داي نايت لخدمات التوصيل والشحن.

اسم النشاط:
المدينة:
عدد الطلبات المتوقع:`,
    en: `Hello, I would like to register as a new merchant with DAY NIGHT DELIVERY SERVICES.

Business name:
City:
Expected number of orders:`,
  },
  complaint_support: {
    key: "complaint_support",
    audience: "support",
    titleAr: "متابعة شكوى",
    titleEn: "Complaint follow-up",
    ar: `السلام عليكم، لدي استفسار بخصوص الشكوى رقم:
{complaint_number}`, 
    en: `Hello, I have a question about complaint number:
{complaint_number}`,
  },
  admin_order_contact: {
    key: "admin_order_contact",
    audience: "customer",
    titleAr: "تواصل الإدارة بخصوص طلب",
    titleEn: "Admin order contact",
    ar: `السلام عليكم، نتواصل معكم من إدارة داي نايت بخصوص الشحنة رقم:
{tracking_number}

حالة الشحنة الحالية:
{order_status}

رابط التتبع:
{tracking_url}`,
    en: `Hello, DAY NIGHT management is contacting you regarding shipment:
{tracking_number}

Current status:
{order_status}

Tracking link:
{tracking_url}`,
  },
  generic_support: {
    key: "generic_support",
    audience: "support",
    titleAr: "تواصل عام",
    titleEn: "General support",
    ar: `السلام عليكم، أحتاج مساعدة من فريق داي نايت لخدمات التوصيل والشحن بخصوص الصفحة الحالية:
{company_website}`, 
    en: `Hello, I need help from DAY NIGHT DELIVERY SERVICES regarding the current page:
{company_website}`,
  },
};

export function getDefaultMessageTemplate(key: MessageTemplateKey, locale: MessageLocale) {
  const template = DEFAULT_MESSAGE_TEMPLATES[key];
  return locale === "ar" ? template.ar : template.en;
}
