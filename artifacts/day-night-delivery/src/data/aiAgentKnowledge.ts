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
    domesticMain: "Main UAE city routes: 25 AED per local order.",
    domesticMainAr: "المناطق الرئيسية داخل الإمارات: 25 درهم للطلب المحلي الواحد.",
    domesticExtended: "Special UAE routes such as Al Ain and Western Region: 50 AED per local order.",
    domesticExtendedAr: "المسارات الخاصة داخل الإمارات مثل العين والمنطقة الغربية: 50 درهم للطلب المحلي الواحد.",
    alAin: "Al Ain: special UAE route — 50 AED per local order.",
    westernRegion: "Western Region / Al Dhafra / Ruwais: special UAE route — 50 AED per local order.",
    express: "Express surcharge: +15 AED on top of base price.",
    gcc: "GCC shipping: 95 AED for first kg, +45 AED per additional kg.",
    gccExamples: "GCC examples: 1kg=95 AED | 2kg=140 AED | 3kg=185 AED | 5kg=275 AED",
    worldwide: "Worldwide shipping: 190 AED for first kg, +90 AED per additional kg.",
    worldwideExamples: "Worldwide examples: 1kg=190 AED | 2kg=280 AED | 3kg=370 AED | 5kg=550 AED",
    cod: "COD amount is separate from the delivery fee. It is the amount collected from the customer on delivery and returned to the sender.",
    vat: "Displayed prices are final totals. Legal tax details are handled internally."
  },
  uaeCoverage: {
    mainAreas: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Khorfakkan", "Mussafah"],
    extendedAreas: ["Al Ain", "Western Region", "Al Dhafra", "Ruwais", "Liwa", "Ghayathi", "Sila"],
    mainAreasAr: ["أبوظبي", "دبي", "الشارقة", "عجمان", "أم القيوين", "رأس الخيمة", "الفجيرة", "خورفكان", "مصفح"],
    extendedAreasAr: ["العين", "المنطقة الغربية", "الظفرة", "الرويس", "ليوا", "غياثي", "السيلة"]
  },
  internationalDestinations: [
    "Saudi Arabia (GCC)", "Qatar (GCC)", "Kuwait (GCC)", "Oman (GCC)", "Bahrain (GCC)",
    "United States", "Canada", "United Kingdom", "Germany", "France", "Netherlands",
    "Australia", "India", "Pakistan", "Philippines", "Bangladesh", "Sri Lanka",
    "China", "Japan", "Korea", "Turkey", "Egypt", "Lebanon", "Jordan", "Worldwide"
  ],
  services: {
    uaeDelivery: "UAE domestic delivery: door-to-door, same day or next day, full UAE coverage.",
    internationalShipping: "International shipping to GCC, worldwide via partner networks.",
    ecommerce: "E-commerce solutions: daily pickups, COD, returns handling, proof of delivery, store integrations.",
    corporate: "Corporate contracts: monthly/annual rates, dedicated account manager, bulk delivery, reports.",
    express: "Express delivery: +15 AED surcharge for priority processing.",
    cod: "COD (Cash on Delivery): collect payment from customer on delivery. Supported for UAE and e-commerce orders.",
    documents: "Document delivery: secure courier for legal, government, and corporate files.",
    pharmacy: "Pharmacy/medical orders handled with priority. Contact WhatsApp for special instructions."
  },
  tracking: {
    howTo: "Visit /tracking, enter your DN-YYYY-XXXXX tracking code, and view real-time status.",
    howToAr: "زر صفحة /tracking، أدخل رمز التتبع DN-YYYY-XXXXX، واطلع على الحالة الفورية.",
    noNumber: "If you don't have a tracking number, contact WhatsApp with your sender name and booking date.",
    statuses: ["Pending", "Confirmed", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Failed Attempt"]
  },
  ordering: {
    howTo: "Visit /request, fill sender details (Step 1), receiver details (Step 2), package info and payment (Step 3), then submit.",
    howToAr: "زر /request، أدخل بيانات المرسل (الخطوة 1)، بيانات المستلم (الخطوة 2)، معلومات الطرد والدفع (الخطوة 3)، ثم أرسل.",
    trackingNumber: "Tracking number is generated immediately after successful order submission.",
    largeOrders: "Large, unusually heavy, or bulk corporate dispatches require operational confirmation before pickup.",
    codNote: "COD amount is separate from the delivery fee. Enter the amount to collect from the customer."
  },
  policies: {
    codRules: "COD is supported for e-commerce and store orders. COD amount must be confirmed at booking. COD is not added to shipping fees.",
    prohibitedItems: "Prohibited items: dangerous goods, narcotics, weapons, live animals, perishables without agreement, flammable materials. Follow UAE and destination country regulations.",
    packaging: "Sender is responsible for proper packaging. Damaged packaging may result in delivery refusal.",
    deliveryAttempts: "Two delivery attempts are made. If unreachable, order is returned after holding period.",
    escalation: "For urgent support contact WhatsApp immediately at " + companyMeta.phone,
    deliveryTime: "UAE: same-day or next-day (varies by area and pickup time). GCC: 2–5 business days. International: 5–15 business days.",
    refund: "Cancellation before pickup may qualify for refund review. Contact support with tracking number.",
    invoice: "Invoice PDF available after order confirmation from tracking page or admin portal.",
    customQuote: "Heavy shipments, multi-stop work, or bulk corporate orders require a custom quote via WhatsApp."
  },
  businessInfo: {
    registrationUAE: "Registered and operating in the UAE.",
    coverage: "Full UAE coverage: all 7 Emirates including extended areas.",
    operationHours: "24/7 operations. Customer service available around the clock.",
    languages: "Bilingual service: Arabic and English.",
    paymentMethods: ["Prepaid", "COD (Cash on Delivery)", "Corporate billing", "Bank transfer for contracts"]
  },
  emergencyFallbackMessage: `يمكنني تحويلك إلى واتساب الدعم للحصول على تأكيد مباشر: ${companyMeta.whatsappUrl}`
};

export const chatKnowledgeEntries = [
  /* ─── Greetings ─── */
  {
    keys: ["hello", "hi", "hey", "مرحب", "السلام", "أهلا", "سلام", "مساء", "صباح"],
    en: `Welcome to ${companyMeta.name}! 👋\nHow can I help you today? You can ask about prices, tracking, requesting delivery, coverage, or corporate contracts.`,
    ar: `مرحباً بك في ${companyMeta.legalNameAr}! 👋\nكيف يمكنني مساعدتك؟ يمكنك السؤال عن الأسعار، تتبع الشحنة، طلب توصيل، التغطية، أو عقود الشركات.`
  },

  /* ─── Local pricing ─── */
  {
    keys: ["price", "pricing", "cost", "سعر", "أسعار", "تكلفة", "كم", "how much", "كلفة", "رسوم", "تعرفة", "fee", "charge", "rate"],
    en: "UAE main routes (Abu Dhabi, Dubai, Sharjah, etc.): 25 AED per local order.\nSpecial UAE routes (Al Ain, Western Region): 50 AED per local order.\nExpress service: +15 AED when selected.\nCOD: separate from delivery fee.\n\nSee full calculator at /pricing",
    ar: "المسارات الرئيسية داخل الإمارات (أبوظبي، دبي، الشارقة...): 25 درهم للطلب المحلي الواحد.\nالمسارات الخاصة (العين، المنطقة الغربية): 50 درهم للطلب المحلي الواحد.\nالخدمة السريعة: +15 درهم عند اختيارها.\nمبلغ COD: منفصل تماماً عن رسوم التوصيل.\n\nاحسب سعرك على /pricing"
  },

  /* ─── Local order quantity ─── */
  {
    keys: ["piece", "pieces", "قطع", "قطعة", "extra piece", "additional piece", "7 pieces", "multiple"],
    en: "For UAE local delivery, one booking is treated as one local order. The public local calculator does not use an order-quantity field. For bulk collections, multi-stop work, or unusual handling, contact WhatsApp for an operations quote.",
    ar: "في التوصيل المحلي داخل الإمارات، كل حجز يُعامل كطلب محلي واحد. الحاسبة المحلية لا تستخدم حقل عدد الطلبيات. للشحنات الكبيرة أو الأعمال متعددة التوقفات أو أي معالجة خاصة، تواصل عبر واتساب للحصول على عرض تشغيلي."
  },

  /* ─── Express ─── */
  {
    keys: ["express", "urgent", "fast", "quick", "priority", "سريع", "عاجل", "أولوية", "خدمة سريعة"],
    en: "Express delivery: +15 AED surcharge on top of base price.\nMain express: 25 + 15 = 40 AED.\nExtended express: 50 + 15 = 65 AED.",
    ar: "التوصيل السريع: +15 درهم إضافة على السعر الأساسي.\nسريع مناطق رئيسية: 25 + 15 = 40 درهم.\nسريع مناطق ممتدة: 50 + 15 = 65 درهم."
  },

  /* ─── Al Ain ─── */
  {
    keys: ["al ain", "العين", "عين", "al-ain"],
    en: aiAgentKnowledge.prices.alAin,
    ar: "العين: مسار خاص داخل الإمارات — 50 درهم للطلب المحلي الواحد."
  },

  /* ─── Western Region ─── */
  {
    keys: ["western", "dhafra", "الظفرة", "غرب", "رويس", "ruwais", "liwa", "ليوا", "ghayathi", "غياثي", "sila", "السيلة", "western region", "المنطقة الغربية"],
    en: aiAgentKnowledge.prices.westernRegion,
    ar: "المنطقة الغربية / الظفرة / الرويس / ليوا: مسار خاص داخل الإمارات — 50 درهم للطلب المحلي الواحد."
  },

  /* ─── COD ─── */
  {
    keys: ["cod", "cash on delivery", "تحصيل", "دفع عند الاستلام", "cash", "collection"],
    en: "COD (Cash on Delivery): the amount collected from the customer at delivery.\nCOD is NOT added to the delivery fee — it is separate.\nThe collected amount is returned to the sender (merchant/store).\nCOD is supported for UAE domestic deliveries.",
    ar: "COD (الدفع عند الاستلام): المبلغ المحصّل من العميل عند التسليم.\nمبلغ COD لا يُضاف إلى رسوم التوصيل — إنه منفصل تماماً.\nالمبلغ المحصّل يُعاد للمرسل (التاجر/المتجر).\nCOD متاح للتوصيل المحلي في الإمارات."
  },

  /* ─── GCC ─── */
  {
    keys: ["gcc", "gulf", "خليج", "سعودي", "قطر", "kuwait", "oman", "bahrain", "saudi", "ksa", "kw", "om", "bh", "qa"],
    en: aiAgentKnowledge.prices.gcc + "\n" + aiAgentKnowledge.prices.gccExamples,
    ar: "الشحن الخليجي: 95 درهم لأول كيلو + 45 درهم لكل كيلو إضافي.\nأمثلة: 1كيلو=95 | 2كيلو=140 | 3كيلو=185 | 5كيلو=275 درهم"
  },

  /* ─── Worldwide ─── */
  {
    keys: ["world", "international", "global", "دولي", "عالمي", "أوروب", "أمريك", "uk", "usa", "canada", "australia", "india", "europe", "كندا", "بريطانيا", "أستراليا", "الهند"],
    en: aiAgentKnowledge.prices.worldwide + "\n" + aiAgentKnowledge.prices.worldwideExamples,
    ar: "الشحن العالمي: 190 درهم لأول كيلو + 90 درهم لكل كيلو إضافي.\nأمثلة: 1كيلو=190 | 2كيلو=280 | 3كيلو=370 | 5كيلو=550 درهم"
  },

  /* ─── Coverage areas ─── */
  {
    keys: ["coverage", "area", "where", "deliver to", "location", "emirate", "تغطية", "مناطق", "أين", "الإمارة"],
    en: "UAE Coverage:\n• Main areas: Abu Dhabi, Dubai, Sharjah, Ajman, UAQ, Ras Al Khaimah, Fujairah, Khorfakkan, Mussafah\n• Extended areas: Al Ain, Western Region, Al Dhafra, Ruwais, Liwa\n\nInternational: GCC + Worldwide.",
    ar: "التغطية في الإمارات:\n• المناطق الرئيسية: أبوظبي، دبي، الشارقة، عجمان، أم القيوين، رأس الخيمة، الفجيرة، خورفكان، مصفح\n• المناطق الممتدة: العين، المنطقة الغربية، الظفرة، الرويس، ليوا\n\nدولياً: دول الخليج + العالم."
  },

  /* ─── Tracking ─── */
  {
    keys: ["track", "tracking", "تتبع", "رقم تتبع", "shipment status", "where is", "dn-", "status", "حالة الشحنة"],
    en: "To track your shipment:\n1. Go to /tracking\n2. Enter your DN-YYYY-XXXXX tracking code\n3. View real-time status and history\n\nNo tracking number? Contact WhatsApp with your name and booking date.",
    ar: "لتتبع شحنتك:\n1. اذهب إلى /tracking\n2. أدخل رمز التتبع DN-YYYY-XXXXX\n3. اطلع على الحالة الفورية والتاريخ\n\nبدون رقم تتبع؟ تواصل عبر واتساب باسمك وتاريخ الحجز."
  },

  /* ─── Request delivery ─── */
  {
    keys: ["request", "book", "order", "send", "طلب", "احجز", "أطلب", "إرسال", "توصيل", "أرسل", "ابعث"],
    en: "To request delivery:\n1. Go to /request\n2. Step 1: Enter sender details (name, phone, city, address)\n3. Step 2: Enter receiver details\n4. Step 3: Package details, service type, and payment\n5. Submit → get tracking number immediately\n\nLarge or special-handling shipments require operational confirmation.",
    ar: "لطلب توصيل:\n1. اذهب إلى /request\n2. الخطوة 1: بيانات المرسل (اسم، هاتف، مدينة، عنوان)\n3. الخطوة 2: بيانات المستلم\n4. الخطوة 3: بيانات الطرد ونوع الخدمة والدفع\n5. إرسال ← تحصل على رقم التتبع فوراً\n\nالشحنات الكبيرة أو التي تحتاج معالجة خاصة تتطلب تأكيداً تشغيلياً."
  },

  /* ─── WhatsApp ─── */
  {
    keys: ["whatsapp", "واتساب", "wa.me", "contact", "call", "تواصل", "هاتف اتصل"],
    en: `WhatsApp: ${companyMeta.whatsappUrl}\nPhone: ${companyMeta.phone}\nEmail: ${companyMeta.email}\n24/7 support available.`,
    ar: `واتساب: ${companyMeta.whatsappUrl}\nهاتف: ${companyMeta.phone}\nبريد: ${companyMeta.email}\nالدعم متاح على مدار الساعة.`
  },

  /* ─── Corporate ─── */
  {
    keys: ["corporate", "contract", "company", "business", "bulk", "شركة", "عقد", "مؤسسة", "مؤسس", "جملة", "كميات"],
    en: "Corporate solutions: monthly/annual contracts, dedicated account manager, bulk delivery rates, daily pickups, COD, detailed reports, and corporate billing.\nContact via WhatsApp or visit /corporate for a quote.",
    ar: "حلول الشركات: عقود شهرية/سنوية، مدير حساب مخصص، أسعار خاصة للكميات، استلام يومي، COD، تقارير مفصلة، وفوترة شهرية للشركات.\nتواصل عبر واتساب أو زر /corporate للحصول على عرض."
  },

  /* ─── E-commerce ─── */
  {
    keys: ["ecommerce", "store", "merchant", "shop", "متجر", "تجارة", "إلكترون", "تاجر", "بائع"],
    en: "E-commerce solutions:\n• Daily pickups from your store\n• COD collection and return to merchant\n• Returns handling\n• Proof of delivery\n• Bulk delivery rates\n• Store integrations\nVisit /ecommerce for details.",
    ar: "حلول المتاجر الإلكترونية:\n• استلام يومي من متجرك\n• تحصيل COD وإعادته للتاجر\n• إدارة المرتجعات\n• إثبات التسليم\n• أسعار خاصة للكميات\n• تكامل مع المتاجر\nزر /ecommerce للتفاصيل."
  },

  /* ─── Delivery time ─── */
  {
    keys: ["time", "when", "how long", "delivery time", "متى", "وقت", "كم يأخذ", "مدة"],
    en: aiAgentKnowledge.policies.deliveryTime,
    ar: "الإمارات: في نفس اليوم أو اليوم التالي (حسب وقت الاستلام والمنطقة).\nدول الخليج: 2–5 أيام عمل.\nدولي: 5–15 يوم عمل.\nللطلبات الكبيرة قد يحتاج تأكيداً تشغيلياً."
  },

  /* ─── Documents ─── */
  {
    keys: ["document", "legal", "passport", "government", "مستند", "وثيقة", "جواز", "حكومي", "أوراق"],
    en: "Secure document delivery for legal, government, and corporate files. Proof of delivery provided. Contact WhatsApp for special handling.",
    ar: "توصيل آمن للمستندات القانونية والحكومية والشركات. إثبات التسليم مُرفق. تواصل عبر واتساب للتعليمات الخاصة."
  },

  /* ─── Pharmacy / Medical ─── */
  {
    keys: ["pharmacy", "medical", "medicine", "صيدل", "دواء", "طبي", "أدوية"],
    en: "Pharmacy and medical orders handled with priority and care. Contact WhatsApp for special instructions and temperature-sensitive items.",
    ar: "الطلبات الطبية والصيدلانية تُعامل بأولوية وعناية. تواصل عبر واتساب للتعليمات الخاصة والبنود الحساسة للحرارة."
  },

  /* ─── Prohibited ─── */
  {
    keys: ["prohibited", "restricted", "dangerous", "banned", "ممنوع", "مقيّد", "خطر"],
    en: aiAgentKnowledge.policies.prohibitedItems,
    ar: "الأصناف المحظورة: المواد الخطرة، المخدرات، الأسلحة، الحيوانات الحية، المواد القابلة للاشتعال، والأصناف غير المتوافقة مع لوائح الإمارات أو بلد الوجهة."
  },

  /* ─── Invoice / PDF ─── */
  {
    keys: ["invoice", "receipt", "pdf", "فاتورة", "إيصال", "وصل"],
    en: "Invoice/PDF available after order confirmation. Access from the tracking page using your tracking number, or via the admin portal.",
    ar: "الفاتورة PDF متاحة بعد تأكيد الطلب. ادخل من صفحة التتبع برقم التتبع، أو من لوحة الإدارة."
  },

  /* ─── Refund / Cancel ─── */
  {
    keys: ["refund", "cancel", "cancellation", "إلغاء", "استرداد", "ألغي"],
    en: aiAgentKnowledge.policies.refund,
    ar: "الإلغاء قبل استلام الشحنة قد يكون مؤهلاً للاسترداد. تواصل مع الدعم برقم التتبع للمراجعة."
  },

  /* ─── Lost / Delayed ─── */
  {
    keys: ["lost", "delay", "late", "missing", "damaged", "متأخر", "ضائع", "فقد", "تأخير", "تالف"],
    en: "For lost, delayed, or damaged shipments: contact WhatsApp immediately with your tracking number (DN-...). We investigate and respond promptly.",
    ar: "للشحنات المتأخرة أو المفقودة أو التالفة: تواصل فوراً عبر واتساب مع رقم التتبع (DN-...). نحقق ونرد بسرعة."
  },

  /* ─── Payment ─── */
  {
    keys: ["payment", "pay", "how to pay", "دفع", "طرق الدفع", "سداد"],
    en: "Payment methods:\n• Prepaid (sender pays before pickup)\n• COD (receiver pays on delivery, collected by driver)\n• Corporate billing (monthly invoice for contract clients)",
    ar: "طرق الدفع:\n• مسبق (المرسل يدفع قبل الاستلام)\n• COD (المستلم يدفع عند التسليم، يحصّله السائق)\n• فوترة شهرية (للعملاء المتعاقدين)"
  },

  /* ─── Driver portal ─── */
  {
    keys: ["driver", "captain", "سائق", "كابتن", "driver portal"],
    en: "Driver portal at /driver — enter your driver code to view and manage assigned deliveries.",
    ar: "بوابة السائق على /driver — أدخل رمز السائق لعرض وإدارة التوصيلات المعينة."
  },

  /* ─── Pricing page ─── */
  {
    keys: ["calculate", "calculator", "estimate", "حاسبة", "احسب", "تقدير", "كلكيوليتور"],
    en: "Use the pricing calculators at /pricing:\n• UAE Delivery Calculator: choose pickup and delivery areas → instant local order price\n• International Calculator: enter destination and weight → instant price",
    ar: "استخدم حاسبات الأسعار على /pricing:\n• حاسبة التوصيل المحلي: اختر منطقة الاستلام والتسليم ← سعر فوري للطلب المحلي\n• الحاسبة الدولية: أدخل الوجهة والوزن ← سعر فوري"
  },

  /* ─── Social / QR ─── */
  {
    keys: ["qr", "barcode", "social", "facebook", "instagram", "tiktok", "باركود", "فيس", "انست", "تيك"],
    en: `Quick links and QR codes: /qr\nSocial media links are in the website footer.`,
    ar: `الروابط السريعة ورمز QR: /qr\nروابط التواصل الاجتماعي في تذييل الموقع.`
  },

  /* ─── Gallery ─── */
  {
    keys: ["gallery", "photos", "pictures", "fleet", "معرض", "صور", "أسطول"],
    en: "Visual gallery at /gallery — fleet vehicles, delivery scenes, branding, and team.",
    ar: "المعرض البصري على /gallery — أسطول السيارات ومشاهد التوصيل والهوية والفريق."
  },

  /* ─── Website ─── */
  {
    keys: ["website", "site", "موقع", "رابط"],
    en: `Official website: ${companyMeta.website}`,
    ar: `الموقع الرسمي: ${companyMeta.website}`
  },

  /* ─── FAQ / Policy ─── */
  {
    keys: ["faq", "question", "policy", "terms", "privacy", "الأسئلة", "سياسة", "شروط"],
    en: "Frequently Asked Questions: /faq\nService Policy: /policy\nPrivacy: /privacy\nTerms: /terms",
    ar: "الأسئلة الشائعة: /faq\nسياسة الخدمة: /policy\nالخصوصية: /privacy\nالشروط: /terms"
  },

  /* ─── Packaging ─── */
  {
    keys: ["packaging", "pack", "wrap", "box", "تغليف", "كرتون", "صندوق"],
    en: "Sender is responsible for proper packaging. Use sturdy boxes and secure wrapping. Damaged packaging may result in delivery refusal or liability issues.",
    ar: "المرسل مسؤول عن التغليف السليم. استخدم كراتين متينة ولف محكم. التغليف التالف قد يؤدي إلى رفض الاستلام."
  },

  /* ─── Contact details direct ─── */
  {
    keys: ["phone number", "email", "address", "رقم", "بريد إلكتروني", "عنوان"],
    en: `Phone: ${companyMeta.phone}\nEmail: ${companyMeta.email}\nWebsite: ${companyMeta.displayWebsite}\nAddress: ${companyMeta.addressEn}`,
    ar: `هاتف: ${companyMeta.phone}\nبريد: ${companyMeta.email}\nموقع: ${companyMeta.displayWebsite}\nعنوان: ${companyMeta.addressAr}`
  },

  /* ─── 24/7 support ─── */
  {
    keys: ["24/7", "support", "help", "مساعدة", "دعم", "خدمة العملاء", "customer service"],
    en: "Day Night Delivery Services provides 24/7 customer support.\nContact via WhatsApp, phone, or email anytime.",
    ar: "داي نايت لخدمات التوصيل تقدم دعماً على مدار الساعة.\nتواصل عبر واتساب أو الهاتف أو البريد في أي وقت."
  }
];

export type AIAgentKnowledge = typeof aiAgentKnowledge;
