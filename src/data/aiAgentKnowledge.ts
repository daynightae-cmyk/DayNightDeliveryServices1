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
    domesticMain: "Main UAE cities: 30 AED + 5% VAT = 31.50 AED total",
    domesticMainAr: "المدن الرئيسية: 30 درهم + ضريبة 5% = 31.50 درهم",
    domesticExtended: "Extended UAE areas: 50 AED + 5% VAT = 52.50 AED total",
    domesticExtendedAr: "المناطق الممتدة: 50 درهم + ضريبة 5% = 52.50 درهم",
    alAin: "Al Ain: extended area — 50 AED + VAT = 52.50 AED",
    westernRegion: "Western Region / Al Dhafra: extended — 50 AED + VAT = 52.50 AED",
    alRuwais: "Al Ruwais (main area): 30 AED + VAT = 31.50 AED",
    express: "Express surcharge: +15 AED",
    gcc: "GCC: 95 AED first kg + 45 AED each additional kg + 5% VAT",
    gccExamples: "GCC 1kg=99.75 | 2kg=147.00 | 3kg=194.25 AED",
    worldwide: "Worldwide: 190 AED first kg + 90 AED each additional kg + 5% VAT",
    worldwideExamples: "Worldwide 1kg=199.50 | 2kg=294.00 | 3kg=388.50 AED",
    vat: "All prices subject to 5% UAE VAT unless stated as final inclusive total."
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
    deliveryTime: "Local same-day and next-day depending on pickup time and route. International varies by destination.",
    refund: "Cancellation before pickup may qualify for refund review. Contact support with tracking number.",
    invoice: "Invoice PDF available after order confirmation from tracking or admin portal."
  },
  emergencyFallbackMessage: `For urgent delivery issues: ${companyMeta.whatsappUrl}`
};

export const chatKnowledgeEntries = [
  { keys: ["price", "pricing", "سعر", "أسعار", "تكلفة", "31.50", "52.50"], en: aiAgentKnowledge.prices.domesticMain + "\n" + aiAgentKnowledge.prices.domesticExtended + "\n" + aiAgentKnowledge.prices.vat, ar: aiAgentKnowledge.prices.domesticMainAr + "\n" + aiAgentKnowledge.prices.domesticExtendedAr + "\n" + aiAgentKnowledge.prices.vat },
  { keys: ["al ain", "العين", "عين"], en: aiAgentKnowledge.prices.alAin, ar: "العين: منطقة ممتدة — 50 درهم + ضريبة = 52.50 درهم" },
  { keys: ["western", "dhafra", "الظفرة", "غرب"], en: aiAgentKnowledge.prices.westernRegion, ar: "المنطقة الغربية / الظفرة: 50 درهم + ضريبة = 52.50 درهم" },
  { keys: ["ruwais", "الرويس"], en: aiAgentKnowledge.prices.alRuwais, ar: "الرويس (منطقة رئيسية): 30 درهم + ضريبة = 31.50 درهم" },
  { keys: ["gcc", "gulf", "خليج", "سعود", "قطر", "kuwait", "oman", "bahrain"], en: aiAgentKnowledge.prices.gcc + "\n" + aiAgentKnowledge.prices.gccExamples, ar: "الخليج: 95 درهم أول كilo + 45 درهم لكل كilo إضافي + ضريبة 5%\nأمثلة: 1كilo=99.75 | 2كilo=147.00 | 3كilo=194.25 درهم" },
  { keys: ["world", "international", "global", "دولي", "عالمي", "أوروب", "أمريك"], en: aiAgentKnowledge.prices.worldwide + "\n" + aiAgentKnowledge.prices.worldwideExamples, ar: "عالمي: 190 درهم أول كilo + 90 درهم إضافي + ضريبة 5%\nأمثلة: 1كilo=199.50 | 2كilo=294.00 | 3كilo=388.50 درهم" },
  { keys: ["vat", "tax", "ضريبة"], en: aiAgentKnowledge.prices.vat, ar: "جميع الأسعار تشمل أو تُحسب مع ضريبة القيمة المضافة 5% حسب نوع الخدمة." },
  { keys: ["track", "tracking", "تتبع", "رقم"], en: "Open the Tracking page, enter your DN tracking code, and view live status timeline.", ar: "افتح صفحة تتبع شحنة، أدخل رقم التتبع DN، واطلع على الحالة والتسلسل الزمني." },
  { keys: ["request", "book", "order", "طلب", "احجز", "توصيل"], en: "Use Request Delivery: select cities, confirm price via calculator, fill details, submit for real tracking number.", ar: "استخدم صفحة اطلب توصيل: اختر المدن، أكد السعر، أدخل البيانات، واحصل على رقم تتبع حقيقي." },
  { keys: ["whatsapp", "واتساب", "wa.me"], en: `WhatsApp: ${companyMeta.whatsappUrl}\nPhone: ${companyMeta.phone}`, ar: `واتساب: ${companyMeta.whatsappUrl}\nهاتف: ${companyMeta.phone}` },
  { keys: ["contact", "phone", "email", "تواصل", "هاتف", "بريد"], en: `Phone: ${companyMeta.phone}\nEmail: ${companyMeta.email}\nWebsite: ${companyMeta.displayWebsite}`, ar: `هاتف: ${companyMeta.phone}\nبريد: ${companyMeta.email}\nموقع: ${companyMeta.displayWebsite}` },
  { keys: ["corporate", "contract", "company", "شركة", "عقد", "مؤسس"], en: "Corporate contracts: monthly/yearly rates, dedicated support, reports. Visit Corporate page or WhatsApp for quote.", ar: "عقود الشركات: أسعار شهرية/سنوية، دعم مخصص، تقارير. زر صفحة الشركات أو واتساب لعرض سعر." },
  { keys: ["ecommerce", "store", "merchant", "متجر", "تجارة"], en: "E-commerce solutions: daily pickups, COD, returns, proof of delivery. See Store Solutions page.", ar: "حلول المتاجر: استلام يومي، COD، مرتجعات، إثبات تسليم. راجع صفحة حلول المتاجر." },
  { keys: ["cod", "cash on delivery", "تحصيل"], en: aiAgentKnowledge.policies.codRules, ar: "COD متاح للمتاجر. يجب تأكيد مبلغ التحصيل عند إنشاء الطلب." },
  { keys: ["document", "legal", "مستند", "وثيقة"], en: "Secure document delivery for legal, government, and corporate files with proof of delivery.", ar: "توصيل آمن للمستندات القانونية والحكومية والشركات مع إثبات تسليم." },
  { keys: ["pharmacy", "medical", "صيدل", "دواء", "طبي"], en: "Sensitive/pharmacy orders handled with priority and care. Contact WhatsApp for special instructions.", ar: "الطلبات الطبية والصيدلانية تُعامل بأولوية وعناية. تواصل عبر واتساب للتعليمات الخاصة." },
  { keys: ["prohibited", "restricted", "ممنوع"], en: aiAgentKnowledge.policies.prohibitedItems, ar: aiAgentKnowledge.policies.prohibitedItems },
  { keys: ["time", "delivery time", "متى", "وقت"], en: aiAgentKnowledge.policies.deliveryTime, ar: "التوصيل المحلي في نفس اليوم أو اليوم التالي حسب وقت الاستلام والمسار." },
  { keys: ["payment", "pay", "دفع"], en: "Payment: prepaid, COD, or corporate billing for contract clients.", ar: "الدفع: مسبق، COD، أو فوترة شهرية للعملاء المتعاقدين." },
  { keys: ["invoice", "فاتورة", "pdf"], en: aiAgentKnowledge.policies.invoice, ar: "فاتورة PDF متاحة بعد تأكيد الطلب من التتبع أو لوحة الإدارة." },
  { keys: ["driver", "سائق", "كابتن"], en: "Driver portal at /driver — enter your driver code to manage assigned orders.", ar: "بوابة السائق على /driver — أدخل رمز السائق لإدارة الطلبات المعينة." },
  { keys: ["location", "address", "map", "عنوان", "موقع", "مقر"], en: `${companyMeta.addressEn}\nMaps: ${companyMeta.mapUrl}`, ar: `${companyMeta.addressAr}\nخرائط: ${companyMeta.mapUrl}` },
  { keys: ["website", "site", "موقع"], en: companyMeta.website, ar: companyMeta.website },
  { keys: ["social", "facebook", "instagram", "tiktok", "فيس", "انست"], en: `Facebook: ${companyMeta.socials.facebook}\nInstagram: ${companyMeta.socials.instagram}\nTikTok: ${companyMeta.socials.tiktok}`, ar: `فيسبوك وإنستغرام وتiktok — روابطها في تذييل الموقع وصفحة QR.` },
  { keys: ["calculate", "calculator", "حاسبة", "احسب"], en: "Use Pricing page calculators for local and international estimates with official rates.", ar: "استخدم حاسبات صفحة الأسعار للتقدير المحلي والدولي بالأسعار الرسمية." },
  { keys: ["lost", "delay", "late", "متأخر", "ضائع", "فقد"], en: "For lost or delayed shipments contact WhatsApp with tracking number immediately.", ar: "للشحنات المتأخرة أو المفقودة تواصل فوراً عبر واتساب مع رقم التتبع." },
  { keys: ["refund", "cancel", "إلغاء", "استرداد"], en: aiAgentKnowledge.policies.refund, ar: "الإلغاء قبل الاستلام قد يُراجع للاسترداد. تواصل مع الدعم برقم التتبع." },
  { keys: ["complaint", "شكوى"], en: "Submit complaints via Contact page or WhatsApp. We respond within business priority queue.", ar: "قدّم الشكاوى عبر صفحة التواصل أو واتساب. نرد حسب أولوية الدعم." },
  { keys: ["qr", "barcode", "باركود"], en: "Quick links and QR codes at /qr page.", ar: "الروابط السريعة ورمز QR في صفحة /qr." },
  { keys: ["gallery", "معرض", "صور"], en: "Visual gallery at /gallery — fleet, delivery scenes, branding.", ar: "المعرض البصري على /gallery — الأسطول ومشاهد التوصيل والهوية." },
  { keys: ["express", "سريع", "urgent", "عاجل"], en: aiAgentKnowledge.prices.express, ar: "خدمة سريعة: +15 درهم إضافية على التعرفة." },
  { keys: ["hello", "hi", "مرحب", "السلام"], en: `Welcome to ${companyMeta.name}. How can I help with delivery or shipping?`, ar: `مرحباً بك في ${companyMeta.legalNameAr}. كيف يمكنني مساعدتك في التوصيل أو الشحن؟` }
];

export type AIAgentKnowledge = typeof aiAgentKnowledge;
