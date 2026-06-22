/**
 * Contact and support information for DAY NIGHT Delivery Services
 */
export const CONTACT_INFO = {
  phone: "+971568757331",
  phoneFormatted: "+971 56 875 7331",
  email: "Admin@daynight.ae",
  addressAr: "مصفح 40، مجمع داي نايت اللوجستي، أبوظبي، الإمارات العربية المتحدة",
  addressEn: "Musaffah 40, Day Night Logistics Center, Abu Dhabi, United Arab Emirates",
  whatsappUrl: "https://wa.me/971568757331",
  workingHoursAr: "24 ساعة / 7 أيام في الأسبوع لخدمتك دائماً",
  workingHoursEn: "24/7 continuous operations and continuous courier deployment"
};

export function getWhatsAppLink(message: string): string {
  return `${CONTACT_INFO.whatsappUrl}?text=${encodeURIComponent(message)}`;
}
