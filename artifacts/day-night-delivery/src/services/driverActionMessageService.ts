import {
  prepareWhatsAppMessage,
  revisePreparedWhatsAppMessage,
  type MessageContext,
  type PreparedWhatsAppMessage,
} from "./whatsappMessageService";
import {
  buildCustomerPaymentUrl,
  getDayNightBank,
  paymentModeLabel,
  type DayNightBankId,
} from "../config/bankTransfer";

export type DriverMessageActionKey =
  | "driver_on_the_way"
  | "driver_request_location"
  | "driver_arrived"
  | "driver_unreachable"
  | "driver_delivered_feedback";

export type DriverPaymentMode = "cash" | "online";

export type DeterministicDriverMessageContext = MessageContext & {
  messageType: DriverMessageActionKey;
  paymentMode: DriverPaymentMode;
  preferredBank: DayNightBankId;
};

const clean = (value: unknown, fallback = "") => String(value ?? "").trim() || fallback;

function formatAmount(amount: number | undefined, isArabic: boolean) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Intl.NumberFormat(isArabic ? "ar-AE" : "en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function commonLines(context: DeterministicDriverMessageContext, isArabic: boolean) {
  const reference = clean(context.trackingNumber, "—");
  const amount = formatAmount(context.amountDue, isArabic);
  const paymentLabel = paymentModeLabel(context.paymentMode, isArabic);
  const bank = getDayNightBank(context.preferredBank);
  const paymentUrl = buildCustomerPaymentUrl({
    orderReference: reference,
    amount: context.amountDue,
    bank: bank.id,
    mode: context.paymentMode,
    locale: isArabic ? "ar" : "en",
  });

  const customerChoiceBlock = isArabic
    ? `\n💳 اختر طريقة الدفع — كاش أو أونلاين:\n${paymentUrl}`
    : `\n💳 Choose cash or online payment:\n${paymentUrl}`;

  const paymentInstruction = context.paymentMode === "online"
    ? isArabic
      ? `\n🏦 الاختيار الحالي: تحويل أونلاين عبر ${bank.shortName}. افتح الرابط، انسخ الآيبان، واكتب رقم الشحنة ${reference} في مرجع التحويل ثم أرسل الإيصال.`
      : `\n🏦 Current choice: online transfer through ${bank.shortName}. Open the link, copy the IBAN, use shipment ${reference} as the reference, then send the receipt.`
    : isArabic
      ? "\n💵 الاختيار الحالي: كاش عند الاستلام. ويمكنك التحويل أونلاين من نفس الرابط إذا رغبت."
      : "\n💵 Current choice: cash on delivery. You can switch to online payment from the same link.";

  return {
    reference,
    amountLine: amount
      ? isArabic
        ? `💰 مبلغ الشحنة المسجل: ${amount} درهم إماراتي`
        : `💰 Recorded shipment amount: ${amount} AED`
      : "",
    paymentLine: isArabic ? `💳 طريقة الدفع الحالية: ${paymentLabel}` : `💳 Current payment method: ${paymentLabel}`,
    paymentOptionsBlock: `${customerChoiceBlock}${paymentInstruction}`,
  };
}

function buildArabicMessage(context: DeterministicDriverMessageContext) {
  const customer = clean(context.customerName, "عميلنا الكريم");
  const driver = clean(context.driverName, "مندوب داي نايت");
  const trackingUrl = clean(context.trackingUrl);
  const feedbackUrl = clean(context.feedbackUrl);
  const lines = commonLines(context, true);

  switch (context.messageType) {
    case "driver_on_the_way":
      return `السلام عليكم أ/ ${customer} 👋\n\nمع حضرتك ${driver}، مندوب شركة داي نايت لخدمات التوصيل والشحن.\n\n🚚 أنا الآن في الطريق إليكم لتسليم الشحنة.\n📦 رقم الشحنة: ${lines.reference}\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n📍 يرجى إرسال موقعكم الحالي والتأكد من وجود شخص متاح للاستلام.\n\n🔎 متابعة الشحنة:\n${trackingUrl}\n\nشكرًا لاختياركم داي نايت.\nسريع • آمن • موثوق`;

    case "driver_request_location":
      return `السلام عليكم أ/ ${customer} 📍\n\nمع حضرتك ${driver} من داي نايت.\nأحتاج موقعكم الحالي للوصول بدقة إلى الشحنة رقم: ${lines.reference}\n\nافتح واتساب ثم اضغط المشبك ← الموقع ← إرسال موقعك الحالي.\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n🔎 رابط التتبع:\n${trackingUrl}\n\nشكرًا لتعاونكم.`;

    case "driver_arrived":
      return `السلام عليكم أ/ ${customer} 🚚📍\n\nوصلت الآن إلى موقع التسليم الخاص بالشحنة رقم: ${lines.reference}\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\nيرجى التوجه لاستلام الشحنة أو الاتصال بي عند الحاجة.\n\n🔎 متابعة الطلب:\n${trackingUrl}\n\nداي نايت لخدمات التوصيل والشحن`;

    case "driver_unreachable":
      return `السلام عليكم أ/ ${customer} ⚠️\n\nحاول ${driver} التواصل معكم بخصوص الشحنة رقم: ${lines.reference}، ولكن تعذر الوصول إليكم أو تأكيد موقع التسليم.\n\nيرجى الرد على هذه الرسالة وإرسال الموقع الصحيح أو تحديد موعد مناسب.\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n🔎 متابعة الشحنة:\n${trackingUrl}\n\n📞 خدمة العملاء: +971 56 875 7331\nداي نايت لخدمات التوصيل والشحن`;

    case "driver_delivered_feedback":
      return `تم تسليم شحنتكم بنجاح ✅📦\n\nأ/ ${customer}، نشكركم لاختيار داي نايت لخدمات التوصيل والشحن.\n📦 رقم الشحنة: ${lines.reference}\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n⭐ رأيكم مهم لنا. قيّموا تجربة التوصيل والمندوب من هنا:\n${feedbackUrl}\n\n🔎 يمكنكم مراجعة حالة الشحنة:\n${trackingUrl}\n\nشكرًا لثقتكم بنا 💙\nDAY NIGHT DELIVERY SERVICES`;
  }
}

function buildEnglishMessage(context: DeterministicDriverMessageContext) {
  const customer = clean(context.customerName, "valued customer");
  const driver = clean(context.driverName, "DAY NIGHT driver");
  const trackingUrl = clean(context.trackingUrl);
  const feedbackUrl = clean(context.feedbackUrl);
  const lines = commonLines(context, false);

  switch (context.messageType) {
    case "driver_on_the_way":
      return `Hello ${customer} 👋\n\nThis is ${driver} from DAY NIGHT DELIVERY SERVICES.\n\n🚚 I am now on the way to deliver your shipment.\n📦 Shipment: ${lines.reference}\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n📍 Please share your current location and make sure someone is available to receive the shipment.\n\n🔎 Track shipment:\n${trackingUrl}\n\nThank you for choosing DAY NIGHT.\nFast • Reliable • Every Time`;

    case "driver_request_location":
      return `Hello ${customer} 📍\n\nThis is ${driver} from DAY NIGHT.\nPlease send your current WhatsApp location so I can accurately reach shipment ${lines.reference}.\n\nTap attachment ← Location ← Send current location.\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n🔎 Tracking:\n${trackingUrl}\n\nThank you for your cooperation.`;

    case "driver_arrived":
      return `Hello ${customer} 🚚📍\n\nI have arrived at the delivery location for shipment ${lines.reference}.\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\nPlease proceed to receive the shipment or call me if needed.\n\n🔎 Track order:\n${trackingUrl}\n\nDAY NIGHT DELIVERY SERVICES`;

    case "driver_unreachable":
      return `Hello ${customer} ⚠️\n\n${driver} tried to contact you regarding shipment ${lines.reference}, but could not reach you or confirm the delivery location.\n\nPlease reply with the correct location or a suitable delivery time.\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n🔎 Tracking:\n${trackingUrl}\n\nCustomer support: +971 56 875 7331\nDAY NIGHT DELIVERY SERVICES`;

    case "driver_delivered_feedback":
      return `Your shipment was delivered successfully ✅📦\n\nThank you, ${customer}, for choosing DAY NIGHT DELIVERY SERVICES.\n📦 Shipment: ${lines.reference}\n${lines.amountLine}\n${lines.paymentLine}${lines.paymentOptionsBlock}\n\n⭐ Rate the delivery experience and driver:\n${feedbackUrl}\n\n🔎 Review shipment status:\n${trackingUrl}\n\nThank you for your trust 💙\nDAY NIGHT DELIVERY SERVICES`;
  }
}

export async function prepareDeterministicDriverWhatsApp(
  context: DeterministicDriverMessageContext,
): Promise<PreparedWhatsAppMessage> {
  const prepared = await prepareWhatsAppMessage(context);
  const isArabic = context.locale !== "en";
  const message = isArabic ? buildArabicMessage(context) : buildEnglishMessage(context);
  const customNote = clean(context.presentation?.customNote);
  const finalMessage = customNote
    ? `${message}\n\n${isArabic ? "📝 ملاحظة المندوب:" : "📝 Driver note:"}\n${customNote}`
    : message;
  return revisePreparedWhatsAppMessage(prepared, finalMessage, {
    customNote: "",
    customClosing: "",
    customFooter: "",
    spacing: "comfortable",
  });
}
