import { supabase } from "../supabase";
import {
  COMPANY_CONTACT,
  getFeedbackUrl,
  getMerchantOrderUrl,
  getMerchantPortalUrl,
  getTrackingUrl,
} from "../config/companyContact";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_VARIABLES,
  getDefaultMessageTemplate,
  type MessageLocale,
  type MessageTemplateKey,
} from "../config/messageTemplates";
import {
  buildWhatsAppUrl,
  compactMessage,
  formatAed,
  interpolateTemplate,
  sanitizeWhatsAppPhone,
  validateTemplateVariables,
} from "./whatsappMessageCore.mjs";

export type MessageContext = {
  messageType: MessageTemplateKey | string;
  orderId?: string;
  trackingNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  merchantId?: string;
  merchantName?: string;
  merchantPhone?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  amountDue?: number;
  paymentMethod?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  trackingUrl?: string;
  feedbackUrl?: string;
  merchantPortalUrl?: string;
  merchantOrderUrl?: string;
  statementUrl?: string;
  supportUrl?: string;
  orderStatus?: string;
  complaintNumber?: string;
  pickupTime?: string;
  deliveryTime?: string;
  failureReason?: string;
  settlementPeriod?: string;
  orderCount?: number;
  grossCollected?: number;
  fees?: number;
  netDue?: number;
  locale?: MessageLocale;
  metadata?: Record<string, unknown>;
};

export type OutboundMessageStatus = "generated" | "opened" | "copied" | "failed";

export type PreparedWhatsAppMessage = {
  templateKey: MessageTemplateKey;
  locale: MessageLocale;
  phone: string;
  message: string;
  url: string;
  logId?: string;
  usedDatabaseTemplate: boolean;
};

const SUPPORT_TEMPLATE_KEYS = new Set<MessageTemplateKey>([
  "tracking_support",
  "cod_service",
  "merchant_registration",
  "complaint_support",
  "generic_support",
]);

const MERCHANT_TEMPLATE_KEYS = new Set<MessageTemplateKey>([
  "merchant_welcome",
  "merchant_orders_today",
  "merchant_order_received",
  "merchant_driver_assigned",
  "merchant_shipment_collected",
  "merchant_delivered",
  "merchant_delivery_failed",
  "merchant_settlement",
]);

function normalizeLocale(locale?: string | null): MessageLocale {
  return String(locale || "ar").toLowerCase().startsWith("en") ? "en" : "ar";
}

function normalizeName(value: unknown, fallback: string) {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function isPrepaid(paymentMethod?: string | null) {
  const normalized = String(paymentMethod || "").toLowerCase().replace(/[\s-]+/g, "_");
  return ["paid", "prepaid", "card", "online", "wallet", "bank_transfer", "sender_pays"].includes(normalized);
}

function paymentMethodLabel(value: string | undefined, locale: MessageLocale) {
  const normalized = String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, [string, string]> = {
    cod: ["الدفع عند الاستلام COD", "Cash on delivery (COD)"],
    cash: ["نقدًا", "Cash"],
    card: ["بطاقة", "Card"],
    prepaid: ["مدفوعة مسبقًا", "Prepaid"],
    paid: ["مدفوعة", "Paid"],
    sender_pays: ["مدفوعة من المرسل", "Paid by sender"],
    receiver_pays: ["الدفع بواسطة المستلم", "Paid by receiver"],
    wallet: ["المحفظة", "Wallet"],
    bank_transfer: ["تحويل بنكي", "Bank transfer"],
  };
  return labels[normalized]?.[locale === "ar" ? 0 : 1] || String(value || (locale === "ar" ? "غير محددة" : "Not specified"));
}

function amountAndPaymentLines(context: MessageContext, locale: MessageLocale) {
  const amount = Number(context.amountDue || 0);
  if (Number.isFinite(amount) && amount > 0) {
    const formatted = formatAed(amount, locale === "ar" ? "ar-AE" : "en-AE");
    return {
      amount_due: formatted,
      amount_due_line: locale === "ar"
        ? `💰 المبلغ المطلوب: ${formatted} درهم إماراتي`
        : `💰 Amount due: ${formatted} AED`,
      payment_line: locale === "ar"
        ? `💳 طريقة الدفع: ${paymentMethodLabel(context.paymentMethod, locale)}`
        : `💳 Payment method: ${paymentMethodLabel(context.paymentMethod, locale)}`,
    };
  }

  return {
    amount_due: "",
    amount_due_line: "",
    payment_line: isPrepaid(context.paymentMethod)
      ? locale === "ar"
        ? "✅ حالة الدفع: مدفوعة مسبقًا"
        : "✅ Payment status: prepaid"
      : "",
  };
}

function variablesForContext(context: MessageContext, locale: MessageLocale) {
  const amountLines = amountAndPaymentLines(context, locale);
  const trackingNumber = String(context.trackingNumber || "").trim();
  return {
    customer_name: normalizeName(context.customerName, locale === "ar" ? "عميلنا الكريم" : "valued customer"),
    customer_city: String(context.customerCity || "—"),
    merchant_name: normalizeName(context.merchantName, locale === "ar" ? "شريكنا الكريم" : "valued partner"),
    driver_name: normalizeName(context.driverName, locale === "ar" ? "مندوب داي نايت" : "DAY NIGHT driver"),
    tracking_number: trackingNumber,
    ...amountLines,
    payment_method: paymentMethodLabel(context.paymentMethod, locale),
    tracking_url: context.trackingUrl || getTrackingUrl(trackingNumber),
    feedback_url: context.feedbackUrl || "",
    merchant_portal_url: context.merchantPortalUrl || getMerchantPortalUrl(),
    merchant_order_url: context.merchantOrderUrl || getMerchantOrderUrl(context.orderId),
    statement_url: context.statementUrl || context.merchantOrderUrl || getMerchantPortalUrl(),
    order_status: String(context.orderStatus || (locale === "ar" ? "قيد التنفيذ" : "In progress")),
    complaint_number: String(context.complaintNumber || ""),
    support_phone: COMPANY_CONTACT.phoneDisplay,
    company_name_ar: COMPANY_CONTACT.nameAr,
    company_name_en: COMPANY_CONTACT.nameEn,
    company_email: COMPANY_CONTACT.email,
    company_website: context.supportUrl || COMPANY_CONTACT.website,
    pickup_time: String(context.pickupTime || "—"),
    delivery_time: String(context.deliveryTime || "—"),
    failure_reason: String(context.failureReason || (locale === "ar" ? "لم يتم تحديد السبب" : "Reason not specified")),
    settlement_period: String(context.settlementPeriod || "—"),
    order_count: Number(context.orderCount || 0),
    gross_collected: formatAed(context.grossCollected || 0, locale === "ar" ? "ar-AE" : "en-AE"),
    fees: formatAed(context.fees || 0, locale === "ar" ? "ar-AE" : "en-AE"),
    net_due: formatAed(context.netDue || 0, locale === "ar" ? "ar-AE" : "en-AE"),
  };
}

function templateKey(value: string): MessageTemplateKey {
  if (value in DEFAULT_MESSAGE_TEMPLATES) return value as MessageTemplateKey;
  throw new Error(`unknown_message_template:${value}`);
}

function recipientPhone(key: MessageTemplateKey, context: MessageContext) {
  if (SUPPORT_TEMPLATE_KEYS.has(key)) return COMPANY_CONTACT.whatsappNumber;
  if (MERCHANT_TEMPLATE_KEYS.has(key)) return context.merchantPhone;
  if (key === "admin_order_contact") return context.customerPhone;
  return context.customerPhone || context.merchantPhone || context.driverPhone;
}

async function activeTemplateBody(key: MessageTemplateKey, locale: MessageLocale) {
  if (!supabase) return { body: getDefaultMessageTemplate(key, locale), database: false };
  try {
    const { data, error } = await supabase
      .from("message_templates")
      .select("body,is_active")
      .eq("template_key", key)
      .eq("language", locale)
      .maybeSingle();
    if (error || !data?.is_active || !String(data.body || "").trim()) {
      return { body: getDefaultMessageTemplate(key, locale), database: false };
    }
    const unknown = validateTemplateVariables(String(data.body), MESSAGE_TEMPLATE_VARIABLES);
    if (unknown.length) {
      console.warn(`Message template ${key}/${locale} contains unknown variables:`, unknown);
      return { body: getDefaultMessageTemplate(key, locale), database: false };
    }
    return { body: String(data.body), database: true };
  } catch {
    return { body: getDefaultMessageTemplate(key, locale), database: false };
  }
}

async function logOutboundMessage(
  context: MessageContext,
  key: MessageTemplateKey,
  locale: MessageLocale,
  phone: string,
  message: string,
  url: string,
  status: OutboundMessageStatus,
) {
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase.rpc("log_outbound_message", {
      p_template_key: key,
      p_channel: "whatsapp",
      p_recipient_type: SUPPORT_TEMPLATE_KEYS.has(key) ? "support" : MERCHANT_TEMPLATE_KEYS.has(key) ? "merchant" : "customer",
      p_recipient_id: MERCHANT_TEMPLATE_KEYS.has(key) ? context.merchantId || null : null,
      p_recipient_phone: phone,
      p_order_id: context.orderId || null,
      p_merchant_id: context.merchantId || null,
      p_driver_id: context.driverId || null,
      p_generated_message: message,
      p_generated_url: url,
      p_status: status,
      p_metadata: { locale, ...(context.metadata || {}) },
    });
    if (error) return undefined;
    const row = Array.isArray(data) ? data[0] : data;
    return typeof row === "string" ? row : row?.id || row?.log_id || undefined;
  } catch {
    return undefined;
  }
}

export async function markOutboundMessageStatus(logId: string | undefined, status: OutboundMessageStatus) {
  if (!supabase || !logId) return;
  try {
    await supabase.rpc("mark_outbound_message_status", {
      p_log_id: logId,
      p_status: status,
    });
  } catch {
    // Opening WhatsApp must not be blocked when logging is temporarily unavailable.
  }
}

export async function prepareWhatsAppMessage(context: MessageContext): Promise<PreparedWhatsAppMessage> {
  const key = templateKey(context.messageType);
  const locale = normalizeLocale(context.locale);
  const phone = sanitizeWhatsAppPhone(recipientPhone(key, context));
  if (!phone) throw new Error("invalid_whatsapp_phone");

  const { body, database } = await activeTemplateBody(key, locale);
  const message = compactMessage(interpolateTemplate(body, variablesForContext(context, locale)));
  if (!message) throw new Error("empty_whatsapp_message");
  if (/\{[a-zA-Z0-9_]+\}/.test(message)) throw new Error("unresolved_message_variables");

  const url = buildWhatsAppUrl(phone, message);
  const logId = await logOutboundMessage(context, key, locale, phone, message, url, "generated");
  return { templateKey: key, locale, phone, message, url, logId, usedDatabaseTemplate: database };
}

export async function openPreparedWhatsApp(prepared: PreparedWhatsAppMessage) {
  await markOutboundMessageStatus(prepared.logId, "opened");
  window.open(prepared.url, "_blank", "noopener,noreferrer");
}

export async function copyPreparedWhatsApp(prepared: PreparedWhatsAppMessage) {
  await navigator.clipboard.writeText(prepared.message);
  await markOutboundMessageStatus(prepared.logId, "copied");
}

export async function createFeedbackLinkForOrder(orderId: string) {
  if (!supabase || !orderId) throw new Error("feedback_service_unavailable");
  const { data, error } = await supabase.rpc("create_feedback_token_for_order", {
    p_order_id: orderId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const url = String(row?.url || row?.feedback_url || "");
  const token = String(row?.token || "");
  const resolved = url || getFeedbackUrl(token);
  if (!resolved) throw new Error("feedback_link_not_created");
  return resolved;
}

export async function recordDriverContactAttempt(input: {
  orderId: string;
  driverId?: string;
  attemptType: string;
  result: string;
  note?: string;
}) {
  if (!supabase) return;
  const { error } = await supabase.rpc("record_driver_contact_attempt", {
    p_order_id: input.orderId,
    p_attempt_type: input.attemptType,
    p_result: input.result,
    p_note: input.note || null,
  });
  if (error) throw error;
}

export function contextualSupportContext(pathname: string, search: string, locale: MessageLocale): MessageContext {
  const params = new URLSearchParams(search || "");
  const trackingNumber = params.get("number") || params.get("code") || "";
  const complaintNumber = params.get("complaint") || "";
  const path = pathname.toLowerCase();

  if (path.includes("tracking")) return { messageType: "tracking_support", trackingNumber, locale };
  if (path.includes("complaint")) return { messageType: "complaint_support", complaintNumber, locale };
  if (path.includes("merchant") && (path.includes("register") || path.includes("signup"))) {
    return { messageType: "merchant_registration", locale };
  }
  if (path.includes("cod") || path.includes("cash-on-delivery")) return { messageType: "cod_service", locale };
  return { messageType: "generic_support", locale, supportUrl: `${COMPANY_CONTACT.website}${pathname}` };
}

export function buildSynchronousContextualWhatsAppUrl(pathname: string, search: string, locale: MessageLocale) {
  const context = contextualSupportContext(pathname, search, locale);
  const key = templateKey(context.messageType);
  const message = interpolateTemplate(getDefaultMessageTemplate(key, locale), variablesForContext(context, locale));
  return buildWhatsAppUrl(COMPANY_CONTACT.whatsappNumber, message);
}
