import { COMPANY_CONTACT, getTrackingUrl } from "../config/companyContact";
import { getDefaultMessageTemplate } from "../config/messageTemplates";
import { buildWhatsAppUrl, interpolateTemplate } from "../services/whatsappMessageCore.mjs";

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
