/**
 * Contact and support information for DAY NIGHT DELIVERY SERVICES.
 */
export const CONTACT_INFO = {
  companyName: "DAY NIGHT DELIVERY SERVICES",
  companyNameAr: "داي نايت لخدمات التوصيل والشحن",
  phone: "+971 56 875 7331",
  phoneFormatted: "+971 56 875 7331",
  email: "Admin@daynight.ae",
  domain: "https://daynightae.com",
  addressAr: "الإمارات العربية المتحدة - أبوظبي - مصفح 40",
  addressEn: "UAE ABUDHABI MUSSAFAH 40",
  whatsappUrl: "https://wa.me/971568757331",
  workingHoursAr: "خدمة على مدار الساعة 24/7",
  workingHoursEn: "24/7 continuous operations and continuous courier deployment"
};

export function getWhatsAppLink(message: string): string {
  return `${CONTACT_INFO.whatsappUrl}?text=${encodeURIComponent(message)}`;
}
