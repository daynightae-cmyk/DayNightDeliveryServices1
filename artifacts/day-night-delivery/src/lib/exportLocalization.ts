import type { Order } from "../types";
import { internationalDestinationLabel, isKnownInternationalDestination } from "../data/internationalDestinations";
import { areEquivalentLocations, extractDestinationAreaFromAddress, formatDestinationLocation, inferDestinationEmirate } from "./destinationLocation";

export type ExportDocumentLanguage = "ar" | "en";
type FlexibleOrder = Order & Record<string, unknown>;
const EMPTY = "—";

const ARABIC_PHRASES = [
  ["mohammed bin zayed city", "مدينة محمد بن زايد"], ["mohammad bin zayed city", "مدينة محمد بن زايد"],
  ["khalifa city", "مدينة خليفة"], ["international city", "المدينة العالمية"],
  ["dubai silicon oasis", "واحة دبي للسيليكون"], ["dubai investment park", "مجمع دبي للاستثمار"],
  ["dubai marina", "دبي مارينا"], ["downtown dubai", "وسط مدينة دبي"], ["business bay", "الخليج التجاري"],
  ["ras al khor", "رأس الخور"], ["ras al khaimah", "رأس الخيمة"], ["umm al quwain", "أم القيوين"],
  ["khor fakkan", "خورفكان"], ["abu dhabi", "أبوظبي"], ["al ain", "العين"],
  ["al dhafra", "الظفرة"], ["western region", "المنطقة الغربية"],
  ["united arab emirates", "الإمارات العربية المتحدة"], ["saudi arabia", "المملكة العربية السعودية"],
  ["united kingdom", "المملكة المتحدة"], ["united states", "الولايات المتحدة"],
  ["al khalidiyah", "الخالدية"], ["al khalidiya", "الخالدية"], ["al zahiyah", "الزاهية"],
  ["tourist club area", "منطقة النادي السياحي"], ["al nahda", "النهدة"], ["al nud", "النود"],
  ["al reem island", "جزيرة الريم"], ["al maryah island", "جزيرة المارية"], ["yas island", "جزيرة ياس"],
  ["saadiyat island", "جزيرة السعديات"], ["al raha", "الراحة"], ["bani yas", "بني ياس"],
  ["mussafah", "مصفح"], ["musaffah", "مصفح"], ["al shamkha", "الشمخة"], ["al shahama", "الشهامة"],
  ["al bateen", "البطين"], ["al mushrif", "المشرف"], ["al muroor", "المرور"], ["al manhal", "المنهل"],
  ["al rawdah", "الروضة"], ["al barsha", "البرشاء"], ["palm jumeirah", "نخلة جميرا"],
  ["jumeirah", "جميرا"], ["bur dubai", "بر دبي"], ["deira", "ديرة"], ["al qusais", "القصيص"],
  ["al quoz", "القوز"], ["al warqa", "الورقاء"], ["al khawaneej", "الخوانيج"], ["al mizhar", "المزهر"],
  ["mirdif", "مردف"], ["al twar", "الطوار"], ["al rashidiya", "الراشدية"], ["al garhoud", "القرهود"],
  ["al rigga", "الرقة"], ["hor al anz", "هور العنز"], ["al mamzar", "الممزر"], ["al karama", "الكرامة"],
  ["al satwa", "السطوة"], ["al sufouh", "الصفوح"], ["jebel ali", "جبل علي"],
  ["discovery gardens", "ديسكفري جاردنز"], ["sharjah", "الشارقة"], ["ajman", "عجمان"],
  ["fujairah", "الفجيرة"], ["dubai", "دبي"], ["riyadh", "الرياض"], ["jeddah", "جدة"],
  ["dammam", "الدمام"], ["doha", "الدوحة"], ["qatar", "قطر"], ["kuwait", "الكويت"],
  ["muscat", "مسقط"], ["oman", "عُمان"], ["bahrain", "البحرين"], ["cairo", "القاهرة"],
  ["egypt", "مصر"], ["amman", "عمّان"], ["jordan", "الأردن"], ["canada", "كندا"],
  ["australia", "أستراليا"], ["europe", "أوروبا"], ["uae", "الإمارات"], ["ksa", "السعودية"],
  ["usa", "الولايات المتحدة"], ["uk", "المملكة المتحدة"], ["jvc", "جي في سي"],
  ["jlt", "أبراج بحيرات جميرا"], ["difc", "مركز دبي المالي العالمي"], ["mbz", "مدينة محمد بن زايد"],
] as const;

const ARABIC_TERMS = [
  ["industrial area", "المنطقة الصناعية"], ["next to", "بجوار"], ["opposite", "مقابل"],
  ["delivery address", "عنوان التسليم"], ["pickup address", "عنوان الاستلام"],
  ["street", "شارع"], ["road", "طريق"], ["avenue", "جادة"], ["building", "مبنى"],
  ["tower", "برج"], ["villa", "فيلا"], ["apartment", "شقة"], ["flat", "شقة"],
  ["floor", "الطابق"], ["office", "مكتب"], ["shop", "محل"], ["warehouse", "مستودع"],
  ["block", "بلوك"], ["sector", "قطاع"], ["zone", "منطقة"], ["district", "حي"],
  ["area", "منطقة"], ["city", "مدينة"], ["near", "بالقرب من"], ["behind", "خلف"],
  ["mall", "مول"], ["hotel", "فندق"], ["school", "مدرسة"], ["hospital", "مستشفى"],
  ["mosque", "مسجد"], ["airport", "مطار"], ["port", "ميناء"],
] as const;

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار", review: "قيد المراجعة", under_review: "قيد المراجعة", confirmed: "تم التأكيد",
  assigned: "تم تعيين مندوب", accepted: "قيد التنفيذ", heading_to_pickup: "متجه للاستلام",
  arrived_at_pickup: "وصل لنقطة الاستلام", picked_up: "تم الاستلام", in_transit: "في الطريق",
  out_for_delivery: "خرج للتسليم", arrived_at_customer: "وصل إلى العميل", delivered: "تم التسليم",
  postponed: "مؤجل", returned: "راجع", cancelled: "ملغي", canceled: "ملغي", failed: "فشل",
  delivery_failed: "تعذر التسليم",
};
const PAYMENT_AR: Record<string, string> = {
  sender_pays: "المرسل يدفع", receiver_pays: "المستلم يدفع", customer_pays: "العميل يدفع",
  deduct_from_merchant: "خصم من التاجر", merchant_pays: "التاجر يدفع", cod: "الدفع عند الاستلام",
  cash: "نقدي", card: "بطاقة", wallet: "محفظة", bank_transfer: "تحويل بنكي",
};
const SERVICE_AR: Record<string, string> = {
  standard: "توصيل عادي", express: "توصيل سريع", same_day: "توصيل في نفس اليوم",
  next_day: "توصيل في اليوم التالي", international: "شحن دولي",
};
const PACKAGE_AR: Record<string, string> = {
  parcel: "طرد", shipment: "شحنة", document: "مستندات", documents: "مستندات", box: "صندوق",
  food: "مواد غذائية", fragile: "قابل للكسر",
};

const clean = (value: unknown) => String(value ?? "").trim();
const normalizeKey = (value: unknown) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function replacePhrase(source: string, latin: string, arabic: string) {
  const pattern = escapeRegExp(latin).replace(/\\ /g, "\\s+");
  return source.replace(new RegExp(`\\b${pattern}\\b`, "gi"), arabic);
}
function transliterateLatinWord(word: string) {
  const known: Record<string, string> = { st: "شارع", rd: "طريق", bldg: "مبنى", apt: "شقة", po: "صندوق بريد" };
  const normalized = word.toLowerCase();
  if (known[normalized]) return known[normalized];
  const groups: ReadonlyArray<[string, string]> = [
    ["tch", "تش"], ["sch", "ش"], ["sh", "ش"], ["ch", "تش"], ["kh", "خ"], ["gh", "غ"],
    ["th", "ث"], ["dh", "ذ"], ["ph", "ف"], ["oo", "و"], ["ee", "ي"], ["ou", "او"],
    ["ow", "او"], ["ai", "اي"], ["ay", "اي"],
  ];
  const letters: Record<string, string> = {
    a: "ا", b: "ب", c: "ك", d: "د", e: "ي", f: "ف", g: "ج", h: "ه", i: "ي", j: "ج",
    k: "ك", l: "ل", m: "م", n: "ن", o: "و", p: "ب", q: "ق", r: "ر", s: "س", t: "ت",
    u: "و", v: "ف", w: "و", x: "كس", y: "ي", z: "ز",
  };
  let index = 0;
  let result = "";
  while (index < normalized.length) {
    const group = groups.find(([latin]) => normalized.startsWith(latin, index));
    if (group) { result += group[1]; index += group[0].length; continue; }
    result += letters[normalized[index]] || normalized[index];
    index += 1;
  }
  return result.replace(/ا{2,}/g, "ا").replace(/ي{2,}/g, "ي");
}

export function localizeExportText(value: unknown, language: ExportDocumentLanguage) {
  let text = clean(value);
  if (!text) return EMPTY;
  if (isKnownInternationalDestination(text)) {
    return internationalDestinationLabel(text, language === "ar");
  }
  if (language !== "ar" || !/[A-Za-z]/.test(text)) return text;
  [...ARABIC_PHRASES].sort((a, b) => b[0].length - a[0].length).forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  [...ARABIC_TERMS].sort((a, b) => b[0].length - a[0].length).forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  text = text.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g, transliterateLatinWord);
  return text.replace(/\s*,\s*/g, "، ").replace(/\s*:\s*/g, ": ").replace(/\s+-\s+/g, " - ").replace(/\s{2,}/g, " ").trim() || EMPTY;
}

export function isLikelyLocationText(value: unknown) {
  const text = clean(value).toLowerCase();
  if (!text || !/[a-z]/i.test(text)) return false;
  if ([...ARABIC_PHRASES, ...ARABIC_TERMS].some(([latin]) => text.includes(latin))) return true;
  return /(?:\b(?:address|location|route|pickup|drop[ -]?off|delivery|destination|city|area|emirate|district|street|road|building|tower|villa|apartment|flat|floor|office|shop|warehouse|block|sector|zone|landmark|near|opposite|behind|mall|hotel|school|hospital|mosque|airport|port)\b)/i.test(text);
}
function explicitText(record: FlexibleOrder, keys: string[]) {
  for (const key of keys) { const value = clean(record[key]); if (value) return value; }
  return "";
}
function localizedPart(record: FlexibleOrder, language: ExportDocumentLanguage, arabicKeys: string[], fallbackKeys: string[]) {
  if (language === "ar") { const explicitArabic = explicitText(record, arabicKeys); if (explicitArabic) return explicitArabic; }
  return localizeExportText(explicitText(record, fallbackKeys), language);
}
export function localizedOrderCity(order: Order, language: ExportDocumentLanguage, side: "sender" | "receiver" = "receiver") {
  const record = order as FlexibleOrder;
  const cityArabicKeys = side === "receiver"
    ? ["receiver_city_ar", "delivery_city_ar"]
    : ["sender_city_ar", "pickup_city_ar"];
  const cityFallbackKeys = side === "receiver"
    ? ["receiver_city", "delivery_city"]
    : ["sender_city", "pickup_city"];
  const broaderArabicKeys = side === "receiver"
    ? ["receiver_emirate_ar", "delivery_emirate_ar", "destination_country_ar"]
    : ["sender_emirate_ar", "pickup_emirate_ar"];
  const broaderFallbackKeys = side === "receiver"
    ? ["receiver_emirate", "delivery_emirate", "destination_country"]
    : ["sender_emirate", "pickup_emirate"];

  if (language === "ar") {
    const explicitArabicCity = explicitText(record, cityArabicKeys);
    if (explicitArabicCity) return explicitArabicCity;
  }
  const city = explicitText(record, cityFallbackKeys);
  if (city) return localizeExportText(city, language);
  if (language === "ar") {
    const explicitArabicBroaderLocation = explicitText(record, broaderArabicKeys);
    if (explicitArabicBroaderLocation) return explicitArabicBroaderLocation;
  }
  return localizeExportText(explicitText(record, broaderFallbackKeys), language);
}
function combineAddressParts(parts: string[]) {
  const combined: string[] = [];
  for (const rawPart of parts) {
    const part = clean(rawPart);
    if (!part || part === EMPTY) continue;
    const normalized = part.replace(/\s+/g, " ").trim();
    if (combined.some((existing) => existing === normalized || existing.includes(normalized) || normalized.includes(existing))) continue;
    combined.push(normalized);
  }
  return combined.join("، ") || EMPTY;
}

export function localizedOrderAddress(order: Order, language: ExportDocumentLanguage, side: "sender" | "receiver" = "receiver") {
  const record = order as FlexibleOrder;
  const addressComponents: Array<[string[], string[]]> = side === "receiver"
    ? [
        [["receiver_address_ar", "delivery_address_ar"], ["receiver_address", "delivery_address"]],
        [["receiver_area_ar", "delivery_area_ar"], ["receiver_area", "delivery_area"]],
        [["receiver_street_ar", "delivery_street_ar"], ["receiver_street", "delivery_street"]],
        [["receiver_building_ar", "delivery_building_ar"], ["receiver_building", "delivery_building"]],
        [["receiver_villa_ar", "delivery_villa_ar"], ["receiver_villa", "delivery_villa"]],
        [["receiver_apartment_ar", "delivery_apartment_ar"], ["receiver_apartment", "delivery_apartment"]],
        [["receiver_floor_ar", "delivery_floor_ar"], ["receiver_floor", "delivery_floor"]],
        [["receiver_landmark_ar", "delivery_landmark_ar"], ["receiver_landmark", "delivery_landmark"]],
      ]
    : [
        [["sender_address_ar", "pickup_address_ar"], ["sender_address", "pickup_address"]],
        [["sender_area_ar", "pickup_area_ar"], ["sender_area", "pickup_area"]],
        [["sender_street_ar", "pickup_street_ar"], ["sender_street", "pickup_street"]],
        [["sender_building_ar", "pickup_building_ar"], ["sender_building", "pickup_building"]],
        [["sender_villa_ar", "pickup_villa_ar"], ["sender_villa", "pickup_villa"]],
        [["sender_apartment_ar", "pickup_apartment_ar"], ["sender_apartment", "pickup_apartment"]],
        [["sender_floor_ar", "pickup_floor_ar"], ["sender_floor", "pickup_floor"]],
        [["sender_landmark_ar", "pickup_landmark_ar"], ["sender_landmark", "pickup_landmark"]],
      ];
  const parts = addressComponents.map(([arabicKeys, fallbackKeys]) => {
    if (language === "ar") {
      const explicitArabic = explicitText(record, arabicKeys);
      if (explicitArabic) return explicitArabic;
    }
    return localizeExportText(explicitText(record, fallbackKeys), language);
  });
  return combineAddressParts(parts);
}
function optionalLocalizedPart(
  record: FlexibleOrder,
  language: ExportDocumentLanguage,
  arabicKeys: string[],
  fallbackKeys: string[],
) {
  const value = localizedPart(record, language, arabicKeys, fallbackKeys);
  return value === EMPTY ? "" : value;
}

export function localizedOrderDestinationEmirate(order: Order, language: ExportDocumentLanguage) {
  const record = order as FlexibleOrder;
  const explicitEmirate = optionalLocalizedPart(
    record,
    language,
    ["receiver_emirate_ar", "delivery_emirate_ar"],
    ["receiver_emirate", "delivery_emirate"],
  );
  if (explicitEmirate) return explicitEmirate;

  const explicitArea = optionalLocalizedPart(
    record,
    language,
    ["receiver_area_ar", "delivery_area_ar"],
    ["receiver_area", "delivery_area"],
  );
  const city = optionalLocalizedPart(
    record,
    language,
    ["receiver_city_ar", "delivery_city_ar"],
    ["receiver_city", "delivery_city"],
  );
  return inferDestinationEmirate(explicitArea || city, language) || city;
}

export function localizedOrderDestinationArea(order: Order, language: ExportDocumentLanguage) {
  const record = order as FlexibleOrder;
  const explicitArea = optionalLocalizedPart(
    record,
    language,
    ["receiver_area_ar", "delivery_area_ar"],
    ["receiver_area", "delivery_area"],
  );
  if (explicitArea) return explicitArea;

  const city = optionalLocalizedPart(
    record,
    language,
    ["receiver_city_ar", "delivery_city_ar"],
    ["receiver_city", "delivery_city"],
  );
  const emirate = localizedOrderDestinationEmirate(order, language);
  const address = optionalLocalizedPart(
    record,
    language,
    ["receiver_address_ar", "delivery_address_ar"],
    ["receiver_address", "delivery_address"],
  );
  const addressArea = extractDestinationAreaFromAddress(address, emirate, city);
  if (addressArea) return language === "ar" ? localizeExportText(addressArea, language) : addressArea;
  return city && !areEquivalentLocations(city, emirate) ? city : "";
}

export function localizedOrderDestination(order: Order, language: ExportDocumentLanguage) {
  const emirate = localizedOrderDestinationEmirate(order, language);
  const area = localizedOrderDestinationArea(order, language);
  const localizedEmirate = language === "ar" && emirate ? localizeExportText(emirate, language) : emirate;
  const localizedArea = language === "ar" && area ? localizeExportText(area, language) : area;
  return formatDestinationLocation(localizedEmirate, localizedArea, language);
}

export function localizedOrderDestinationTooltip(order: Order, language: ExportDocumentLanguage) {
  const destination = localizedOrderDestination(order, language);
  const address = localizedOrderAddress(order, language, "receiver");
  if (address === EMPTY || address === destination) return destination;
  return combineAddressParts([destination, address]);
}

export function localizedOrderRoute(order: Order, language: ExportDocumentLanguage) {
  return localizedOrderDestination(order, language);
}
export function localizedOrderStatus(value: unknown, language: ExportDocumentLanguage) {
  if (language !== "ar") return clean(value) || EMPTY;
  const key = normalizeKey(value); return STATUS_AR[key] || localizeExportText(clean(value).replace(/_/g, " "), language);
}
export function localizedPaymentMethod(value: unknown, language: ExportDocumentLanguage) {
  if (language !== "ar") return clean(value) || EMPTY;
  const key = normalizeKey(value); return PAYMENT_AR[key] || localizeExportText(clean(value).replace(/_/g, " "), language);
}
export function localizedServiceType(value: unknown, language: ExportDocumentLanguage) {
  if (language !== "ar") return clean(value) || EMPTY;
  const key = normalizeKey(value); return SERVICE_AR[key] || localizeExportText(clean(value).replace(/_/g, " "), language);
}
export function localizedPackageType(value: unknown, language: ExportDocumentLanguage) {
  if (language !== "ar") return clean(value) || EMPTY;
  const key = normalizeKey(value); return PACKAGE_AR[key] || localizeExportText(clean(value).replace(/_/g, " "), language);
}
export function localizeExportField(key: string, label: string, value: unknown, language: ExportDocumentLanguage) {
  if (language !== "ar") return value;
  const marker = `${key} ${label}`.toLowerCase();
  if (/(address|destination|route|city|area|emirate|location|عنوان|وجهة|مسار|مدينة|منطقة|إمارة)/i.test(marker)) return localizeExportText(value, language);
  if (/(status|حالة)/i.test(marker)) return localizedOrderStatus(value, language);
  if (/(payment|payer|دفع|الدافع)/i.test(marker)) return localizedPaymentMethod(value, language);
  if (/(service|خدمة)/i.test(marker)) return localizedServiceType(value, language);
  if (/(package|shipment|شحنة|طرد)/i.test(marker)) return localizedPackageType(value, language);
  return value;
}
