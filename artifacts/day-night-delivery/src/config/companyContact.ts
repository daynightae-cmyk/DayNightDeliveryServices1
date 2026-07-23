export const COMPANY_CONTACT = Object.freeze({
  nameAr: "داي نايت لخدمات التوصيل والشحن",
  nameEn: "DAY NIGHT DELIVERY SERVICES",
  website: "https://www.daynightae.com",
  trackingBaseUrl: "https://www.daynightae.com/tracking",
  merchantPortalUrl: "https://www.daynightae.com/merchant",
  supportUrl: "https://www.daynightae.com/contact",
  adminCustomerExperienceUrl: "https://www.daynightae.com/admin/customer-experience",
  phoneDisplay: "+971 56 875 7331",
  whatsappNumber: "971568757331",
  email: "Admin@daynightae.com",
  sloganEn: "Fast • Reliable • Every Time",
  sloganAr: "سريع • آمن • موثوق",
} as const);

function cleanReference(value?: string | null) {
  return String(value || "").trim();
}

export function getTrackingUrl(trackingNumber?: string | null) {
  const reference = cleanReference(trackingNumber);
  if (!reference) return COMPANY_CONTACT.trackingBaseUrl;
  return `${COMPANY_CONTACT.trackingBaseUrl}?number=${encodeURIComponent(reference)}`;
}

export function getFeedbackUrl(secureToken?: string | null) {
  const token = cleanReference(secureToken);
  return token ? `${COMPANY_CONTACT.website}/feedback/${encodeURIComponent(token)}` : "";
}

export function getMerchantPortalUrl() {
  return COMPANY_CONTACT.merchantPortalUrl;
}

export function getMerchantOrderUrl(orderId?: string | null) {
  const id = cleanReference(orderId);
  return id
    ? `${COMPANY_CONTACT.merchantPortalUrl}?section=orders&order=${encodeURIComponent(id)}`
    : COMPANY_CONTACT.merchantPortalUrl;
}

export function getAdminComplaintUrl(complaintId?: string | null) {
  const id = cleanReference(complaintId);
  return id
    ? `${COMPANY_CONTACT.adminCustomerExperienceUrl}?tab=complaints&complaint=${encodeURIComponent(id)}`
    : `${COMPANY_CONTACT.adminCustomerExperienceUrl}?tab=complaints`;
}

export default COMPANY_CONTACT;
