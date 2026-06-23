import companyMeta from "./companyMeta";

export const aiAgentKnowledge = {
  companyFacts: {
    nameEn: companyMeta.legalNameEn,
    nameAr: companyMeta.legalNameAr,
    domain: companyMeta.displayWebsite,
    website: companyMeta.website,
    address: companyMeta.addressEn,
    addressAr: companyMeta.addressAr,
    supportHours: "24/7"
  },
  contacts: {
    email: companyMeta.email,
    phone: companyMeta.phone,
    whatsapp: companyMeta.whatsappUrl,
    website: companyMeta.website,
    maps: companyMeta.mapUrl
  },
  prices: {
    domesticMain: "Main UAE areas: 30 AED final price",
    domesticMainAr: "المناطق الرئيسية داخل الإمارات: 30 درهم نهائي",
    domesticExtended: "Extended UAE areas: 50 AED final price",
    domesticExtendedAr: "المناطق الممتدة داخل الإمارات: 50 درهم نهائي",
    alAin: "Al Ain: extended area — 50 AED final price",
    westernRegion: "Western Region / Al Dhafra: extended — 50 AED final price",
    alRuwais: "Al Ruwais: 30 AED final price",
    express: "Express delivery surcharge: +15 AED",
    gcc: "GCC: 95 AED first kg + 45 AED each additional kg",
    gccExamples: "GCC 1kg=95 | 2kg=140 | 3kg=185 AED",
    worldwide: "Worldwide: 190 AED first kg + 90 AED each additional kg",
    worldwideExamples: "Worldwide 1kg=190 | 2kg=280 | 3kg=370 AED",
    finalNotice: "Customer-facing prices are shown as final delivery prices."
  },
  uaeCoverage: [
    "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain",
    "Ras Al Khaimah", "Fujairah", "Al Ain", "Mussafah", "Khorfakkan", "Al Dhafra"
  ],
  internationalDestinations: [
    "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain",
    "United States", "Canada", "United Kingdom", "Europe", "Australia", "Worldwide"
  ],
  policies: {
    codRules: "COD is supported for e-commerce and store orders. COD amount must be confirmed at booking.",
    prohibitedItems: "Prohibited or restricted items follow UAE and destination country regulations. Dangerous goods may be rejected.",
    escalation: "For urgent support contact WhatsApp immediately.",
    deliveryTime: "Local same-day and next-day delivery depends on pickup time and route. International timing varies by destination.",
    refund: "Cancellation before pickup may qualify for refund review. Contact support with tracking number.",
    invoice: "Invoice PDF is available after order confirmation from tracking or the admin portal."
  },
  emergencyFallbackMessage: `For urgent delivery issues: ${companyMeta.whatsappUrl}`
};

export const chatKnowledgeEntries = [
  { keys: ["price", "pricing", "سعر", "أسعار", "تكلفة", "30", "50"], en: `${aiAgentKnowledge.prices.domesticMain}\n${aiAgentKnowledge.prices.domesticExtended}\n${aiAgentKnowledge.prices.finalNotice}`, ar: `${aiAgentKnowledge.prices.domesticMainAr}\n${aiAgentKnowledge.prices.domesticExtendedAr}\nالأسعار الظاهرة للعميل نهائية.` },
  { keys: ["al ain", "العين", "عين"], en: aiAgentKnowledge.prices.alAin, ar: "العين: منطقة ممتدة — 50 درهم نهائي" },
  { keys: ["western", "dhafra", "الظفرة", "غرب"], en: aiAgentKnowledge.prices.westernRegion, ar: "المنطقة الغربية / الظفرة: 50 درهم نهائي" },
  { keys: ["ruwais", "الرويس"], en: aiAgentKnowledge.prices.alRuwais, ar: "الرويس: 30 درهم نهائي" },
  { keys: ["gcc", "gulf", "خليج", "سعود", "قطر", "kuwait", "oman", "bahrain"], en: `${aiAgentKnowledge.prices.gcc}\n${aiAgentKnowledge.prices.gccExamples}`, ar: "الخليج: 95 درهم أول كيلو + 45 درهم لكل كيلو إضافي\nأمثلة: 1 كيلو=95 | 2 كيلو=140 | 3 كيلو=185 درهم" },
  { keys: ["world", "international", "global", "دولي", "عالمي", "أوروب", "أمريك"], en: `${aiAgentKnowledge.prices.worldwide}\n${aiAgentKnowledge.prices.worldwideExamples}`, ar: "عالمي: 190 درهم أول كيلو + 90 درهم لكل كيلو إضافي\nأمثلة: 1 كيلو=190 | 2 كيلو=280 | 3 كيلو=370 درهم" },
  { keys: ["track", "tracking", "تتبع", "رقم"], en: "Open the Tracking page, enter your DN tracking code, and view the live status timeline.", ar: "افتح صفحة تتبع شحنة، أدخل رقم التتبع DN، واطلع على الحالة والتسلسل الزمني." },
  { keys: ["request", "book", "order", "طلب", "احجز", "توصيل"], en: "Use Request Delivery: select cities, confirm the final price, fill details, and submit for a real tracking number.", ar: "استخدم صفحة اطلب توصيل: اختر المدن، أكد السعر النهائي، أدخل البيانات، واحصل على رقم تتبع حقيقي." },
  { keys: ["whatsapp", "واتساب", "wa.me"], en: `WhatsApp: ${companyMeta.whatsappUrl}\nPhone: ${companyMeta.phone}`, ar: `واتساب: ${companyMeta.whatsappUrl}\nهاتف: ${companyMeta.phone}` },
  { keys: ["contact", "phone", "email", "تواصل", "هاتف", "بريد"], en: `Phone: ${companyMeta.phone}\nEmail: ${companyMeta.email}\nWebsite: ${companyMeta.displayWebsite}`, ar: `هاتف: ${companyMeta.phone}\nبريد: ${companyMeta.email}\nموقع: ${companyMeta.displayWebsite}` },
  { keys: ["corporate", "contract", "company", "شركة", "عقد", "مؤسس"], en: "Corporate contracts: monthly or yearly rates, dedicated support, and reports. Visit Corporate page or WhatsApp for a quote.", ar: "عقود الشركات: أسعار شهرية أو سنوية، دعم مخصص، وتقارير. زر صفحة الشركات أو واتساب لعرض سعر." },
  { keys: ["ecommerce", "store", "merchant", "متجر", "تجارة"], en: "E-commerce solutions: daily pickups, COD, returns, and proof of delivery. See Store Solutions page.", ar: "حلول المتاجر: استلام يومي، COD، مرتجعات، وإثبات تسليم. راجع صفحة حلول المتاجر." },
  { keys: ["cod", "cash on delivery", "تحصيل"], en: aiAgentKnowledge.policies.codRules, ar: "COD متاح للمتاجر. يجب تأكيد مبلغ التحصيل عند إنشاء الطلب." },
  { keys: ["document", "legal", "مستند", "وثيقة"], en: "Secure document delivery for legal, government, and corporate files with proof of delivery.", ar: "توصيل آمن للمستندات القانونية والحكومية والشركات مع إثبات تسليم." },
  { keys: ["pharmacy", "medical", "صيدل", "دواء", "طبي"], en: "Sensitive and pharmacy orders are handled with priority and care. Contact WhatsApp for special instructions.", ar: "الطلبات الطبية والصيدلانية تعامل بأولوية وعناية. تواصل عبر واتساب للتعليمات الخاصة." },
  { keys: ["prohibited", "restricted", "ممنوع"], en: aiAgentKnowledge.policies.prohibitedItems, ar: aiAgentKnowledge.policies.prohibitedItems },
  { keys: ["time", "delivery time", "متى", "وقت"], en: aiAgentKnowledge.policies.deliveryTime, ar: "التوصيل المحلي في نفس اليوم أو اليوم التالي حسب وقت الاستلام والمسار." },
  { keys: ["payment", "pay", "دفع"], en: "Payment: prepaid, COD, or corporate billing for contract clients.", ar: "الدفع: مسبق، COD، أو فوترة شهرية للعملاء المتعاقدين." },
  { keys: ["invoice", "فاتورة", "pdf"], en: aiAgentKnowledge.policies.invoice, ar: "فاتورة PDF متاحة بعد تأكيد الطلب من التتبع أو لوحة الإدارة." },
  { keys: ["location", "address", "map", "عنوان", "موقع", "مقر"], en: `${companyMeta.addressEn}\nMaps: ${companyMeta.mapUrl}`, ar: `${companyMeta.addressAr}\nخرائط: ${companyMeta.mapUrl}` },
  { keys: ["website", "site", "موقع"], en: companyMeta.website, ar: companyMeta.website },
  { keys: ["social", "facebook", "instagram", "tiktok", "فيس", "انست"], en: `Facebook: ${companyMeta.socials.facebook}\nInstagram: ${companyMeta.socials.instagram}\nTikTok: ${companyMeta.socials.tiktok}`, ar: `فيسبوك وإنستغرام وتيك توك — روابطها في تذييل الموقع وصفحة QR.` },
  { keys: ["calculate", "calculator", "حاسبة", "احسب"], en: "Use Pricing page calculators for local and international estimates with official rates.", ar: "استخدم حاسبات صفحة الأسعار للتقدير المحلي والدولي بالأسعار الرسمية." },
  { keys: ["lost", "delay", "late", "متأخر", "ضائع", "فقد"], en: "For lost or delayed shipments contact WhatsApp with the tracking number immediately.", ar: "للشحنات المتأخرة أو المفقودة تواصل فوراً عبر واتساب مع رقم التتبع." },
  { keys: ["refund", "cancel", "إلغاء", "استرداد"], en: aiAgentKnowledge.policies.refund, ar: "الإلغاء قبل الاستلام قد يراجع للاسترداد. تواصل مع الدعم برقم التتبع." },
  { keys: ["complaint", "شكوى"], en: "Submit complaints via Contact page or WhatsApp. We respond by support priority.", ar: "قدم الشكاوى عبر صفحة التواصل أو واتساب. نرد حسب أولوية الدعم." },
  { keys: ["qr", "barcode", "باركود"], en: "Quick links and QR codes are available on the /qr page.", ar: "الروابط السريعة ورمز QR في صفحة /qr." },
  { keys: ["gallery", "معرض", "صور"], en: "Visual gallery is available at /gallery with fleet, delivery scenes, and branding.", ar: "المعرض البصري على /gallery ويعرض الأسطول ومشاهد التوصيل والهوية." },
  { keys: ["express", "سريع", "urgent", "عاجل"], en: aiAgentKnowledge.prices.express, ar: "خدمة سريعة: +15 درهم على السعر الأساسي." },
  { keys: ["hello", "hi", "مرحب", "السلام"], en: `Welcome to ${companyMeta.name}. How can I help with delivery or shipping?`, ar: `مرحباً بك في ${companyMeta.legalNameAr}. كيف يمكنني مساعدتك في التوصيل أو الشحن؟` }
];

export type AIAgentKnowledge = typeof aiAgentKnowledge;
