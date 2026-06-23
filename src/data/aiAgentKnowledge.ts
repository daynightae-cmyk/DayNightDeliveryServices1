import companyMeta from "./companyMeta";

export const aiAgentKnowledge = {
  companyFacts: {
    nameEn: companyMeta.legalNameEn,
    nameAr: companyMeta.legalNameAr,
    domain: companyMeta.domain,
    address: companyMeta.addressEn,
    supportHours: "24/7"
  },
  contacts: {
    email: companyMeta.email,
    phone: companyMeta.phone,
    whatsapp: companyMeta.whatsappUrl
  },
  prices: {
    domesticMain: "30 AED final price",
    domesticExtended: "50 AED final price",
    express: "15 AED express surcharge",
    gcc: "95 AED first kg + 45 AED each additional kg",
    worldwide: "190 AED first kg + 90 AED each additional kg"
  },
  uaeCoverage: [
    "Abu Dhabi",
    "Dubai",
    "Sharjah",
    "Ajman",
    "Umm Al Quwain",
    "Ras Al Khaimah",
    "Fujairah",
    "Al Ain",
    "Mussafah"
  ],
  internationalDestinations: [
    "Saudi Arabia",
    "Qatar",
    "Kuwait",
    "Oman",
    "Bahrain",
    "United States",
    "Canada",
    "United Kingdom",
    "Europe",
    "Worldwide"
  ],
  faqs: [
    { q: "How to request delivery?", a: "Open Request Delivery page, complete sender and receiver details, and submit." },
    { q: "How to track shipment?", a: "Open Tracking page and enter your tracking code." },
    { q: "Do you support COD?", a: "Yes, COD is supported with confirmed amount on order creation." },
    { q: "Do you support returns?", a: "Yes, returns management is available for stores and corporate clients." }
  ],
  policies: {
    codRules: "COD amount must be valid and positive.",
    prohibitedItems: "Restricted or prohibited items are subject to destination regulations and may be rejected.",
    escalation: "For urgent support, escalate to WhatsApp support immediately."
  },
  emergencyFallbackMessage: "For urgent delivery issues, contact WhatsApp support: https://wa.me/971568757331"
};

export type AIAgentKnowledge = typeof aiAgentKnowledge;
