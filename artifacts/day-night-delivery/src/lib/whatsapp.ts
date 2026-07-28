import { COMPANY_CONTACT, getTrackingUrl } from "../config/companyContact";
import { getDefaultMessageTemplate } from "../config/messageTemplates";
import { buildWhatsAppUrl, interpolateTemplate } from "../services/whatsappMessageCore.mjs";
import { buildInternationalTrackingUrl } from "./internationalTrackingLinks";

function supportLink(message: string) {
  return buildWhatsAppUrl(COMPANY_CONTACT.whatsappNumber, message);
}

export function whatsappOrderConfirmation(trackingCode: string) {
  const reference = String(trackingCode || "").trim();
  return supportLink(interpolateTemplate(getDefaultMessageTemplate("tracking_support", "en"), {
    tracking_number: reference,
    tracking_url: getTrackingUrl(reference),
  }));
}

export function whatsappStatusUpdate(trackingCode: string, status: string) {
  const reference = String(trackingCode || "").trim();
  return supportLink(interpolateTemplate(getDefaultMessageTemplate("tracking_support", "en"), {
    tracking_number: reference || status || "support",
    tracking_url: getTrackingUrl(reference),
  }));
}

export function whatsappDeliveryReminder(trackingCode: string) {
  const reference = String(trackingCode || "").trim();
  return supportLink(interpolateTemplate(getDefaultMessageTemplate("tracking_support", "en"), {
    tracking_number: reference,
    tracking_url: getTrackingUrl(reference),
  }));
}

export function whatsappRatingRequest(trackingCode: string) {
  const reference = String(trackingCode || "").trim();
  return supportLink(`Hello DAY NIGHT DELIVERY SERVICES, I need a secure feedback link for shipment ${reference}.\n\nTracking: ${getTrackingUrl(reference)}`);
}

export function normalizeWhatsAppPhone(phone?: string | null) {
  if (!phone) return "";
  return String(phone).replace(/[^\d]/g, "").replace(/^00/, "");
}

export function buildInternationalTrackingWhatsappMessage(params: {
  recipientName?: string | null;
  trackingNumber: string;
  role: "customer" | "merchant";
}) {
  const recipientName = String(params.recipientName || "").trim();
  const trackingNumber = String(params.trackingNumber || "").trim();
  const trackingUrl = buildInternationalTrackingUrl(trackingNumber);
  const greetingName = recipientName ? ` ${recipientName}` : "";
  const roleLine = params.role === "merchant"
    ? "نحيطكم علمًا بأنه تم تسجيل الشحنة الدولية وربطها بطلبكم بنجاح."
    : "يسعدنا إبلاغكم بأنه تم تسجيل شحنتكم الدولية، ويمكنكم متابعة رحلتها مباشرة.";

  return `السلام عليكم${greetingName} 🌹

معكم DAY NIGHT DELIVERY SERVICES
داي نايت لخدمات التوصيل والشحن

${roleLine} ✈️📦

رقم التتبع الدولي:
${trackingNumber}

رابط المتابعة المباشرة:
${trackingUrl}

نحن دائمًا في خدمتكم، ونتمنى أن تصل شحنتكم بكل سلام 🤍`;
}

export function buildWhatsAppLink(phone: string, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
