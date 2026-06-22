/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const VAT_RATE = 0.05;
export const LOCAL_MAIN_CITY_PRICE = 30;
export const LOCAL_EXTENDED_AREA_PRICE = 50;
export const GCC_FIRST_KG_PRICE = 95;
export const GCC_ADDITIONAL_KG_PRICE = 45;
export const WORLDWIDE_FIRST_KG_PRICE = 190;
export const WORLDWIDE_ADDITIONAL_KG_PRICE = 90;

export interface PricingResult {
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  pricingCategory: string;
  billableWeight: number;
  notes: string;
}

// Check if area is an extended/remote area
export function isExtendedArea(cityArOrEn: string): boolean {
  const normalized = cityArOrEn.toLowerCase().trim();
  const remoteKeywords = [
    "العين", "ختم", "زينة", "سد", "قافرة", "مزيد", "قوع", "هير", "بوكرية", "سماح", "سويحان", "سمع العام", "رماة", "ناهل",
    "al ain", "khatim", "zeina", "sadd", "qafra", "mezyad", "quaa", "heyer", "samah", "sweihan", "nahil",
    "السلع", "الشويهات", "الظنة", "المرفأ", "بدع زايد", "بدع مطاوعة", "بينونة", "حبشان", "حميم", "عصب", "غياثي", "ليوا",
    "sila", "shweihat", "dhannah", "mirfa", "madaid", "madinat zayed", "liwa", "ghayathi", "habshan", "hameem", "asab",
    "الغربية"
  ];

  // Exception: Al Ruwais is main UAE price (30) as per request (section 11.3)
  if (normalized.includes("الرويس") || normalized.includes("ruwais")) {
    return false;
  }

  return remoteKeywords.some(keyword => normalized.includes(keyword));
}

export function calculateLocalPrice(cityArOrEn: string, weightKg: number): PricingResult {
  const billableWeight = Math.max(1, Math.ceil(weightKg));
  const isRemote = isExtendedArea(cityArOrEn);
  const basePrice = isRemote ? LOCAL_EXTENDED_AREA_PRICE : LOCAL_MAIN_CITY_PRICE;
  
  const subtotal = basePrice;
  const vat = parseFloat((subtotal * VAT_RATE).toFixed(2));
  const total = parseFloat((subtotal + vat).toFixed(2));

  return {
    subtotal,
    vat,
    total,
    currency: "AED",
    pricingCategory: isRemote ? "Extended UAE Area (مناطق ممتدة)" : "Main UAE City (مدن رئيسية)",
    billableWeight,
    notes: isRemote 
      ? "توصيل للمناطق الممتدة والبعيدة في العين والمنطقة الغربية"
      : "توصيل للمدن ومراكز الإمارات الرئيسية"
  };
}

export function calculateInternationalPrice(destination: string, weightKg: number): PricingResult {
  const billableWeight = Math.max(1, Math.ceil(weightKg));
  const gccCountries = [
    "saudi arabia", "qatar", "kuwait", "oman", "bahrain", "gcc",
    "المملكة العربية السعودية", "السعودية", "قطر", "الكويت", "سلطنة عمان", "عمان", "البحرين"
  ];
  
  const normalized = destination.toLowerCase().trim();
  const isGcc = gccCountries.some(country => normalized.includes(country));

  const firstKgPrice = isGcc ? GCC_FIRST_KG_PRICE : WORLDWIDE_FIRST_KG_PRICE;
  const extraKgPrice = isGcc ? GCC_ADDITIONAL_KG_PRICE : WORLDWIDE_ADDITIONAL_KG_PRICE;

  const subtotal = firstKgPrice + ((billableWeight - 1) * extraKgPrice);
  const vat = parseFloat((subtotal * VAT_RATE).toFixed(2));
  const total = parseFloat((subtotal + vat).toFixed(2));

  return {
    subtotal,
    vat,
    total,
    currency: "AED",
    pricingCategory: isGcc ? "GCC Shipping (شحن لدول الخليج)" : "Worldwide Global (شحن دولي عالمي)",
    billableWeight,
    notes: isGcc
      ? `أول كجم: ${GCC_FIRST_KG_PRICE} درهم، كل كجم إضافي: ${GCC_ADDITIONAL_KG_PRICE} درهم`
      : `أول كجم: ${WORLDWIDE_FIRST_KG_PRICE} درهم، كل كجم إضافي: ${WORLDWIDE_ADDITIONAL_KG_PRICE} درهم`
  };
}
