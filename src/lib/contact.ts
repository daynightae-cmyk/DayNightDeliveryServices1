/**
 * Contact and support information for DAY NIGHT Delivery Services
 */
export const CONTACT_INFO = {
  phone: "+971568757331",
  phoneFormatted: "+971 56 875 7331",
  email: "Admin@daynightae.com",
  addressAr: "Ù…ØµÙØ­ 40ØŒ Ù…Ø¬Ù…Ø¹ Ø¯Ø§ÙŠ Ù†Ø§ÙŠØª Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØŒ Ø£Ø¨ÙˆØ¸Ø¨ÙŠØŒ Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø§Ù„Ù…ØªØ­Ø¯Ø©",
  addressEn: "Musaffah 40, Day Night Logistics Center, Abu Dhabi, United Arab Emirates",
  whatsappUrl: "https://wa.me/971568757331",
  workingHoursAr: "24 Ø³Ø§Ø¹Ø© / 7 Ø£ÙŠØ§Ù… ÙÙŠ Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ Ù„Ø®Ø¯Ù…ØªÙƒ Ø¯Ø§Ø¦Ù…Ø§Ù‹",
  workingHoursEn: "24/7 continuous operations and continuous courier deployment"
};

export function getWhatsAppLink(message: string): string {
  return `${CONTACT_INFO.whatsappUrl}?text=${encodeURIComponent(message)}`;
}

