export const CURRENCY = "AED";

export const domesticPricing = {
  main: {
    id: "uae-main",
    labelEn: "UAE Main Areas",
    labelAr: "المناطق الرئيسية داخل الإمارات",
    base: 30,
    total: 30
  },
  extended: {
    id: "uae-extended",
    labelEn: "UAE Extended Areas",
    labelAr: "المناطق الممتدة داخل الإمارات",
    base: 50,
    total: 50
  },
  expressSurcharge: {
    id: "express-surcharge",
    labelEn: "Express surcharge",
    labelAr: "رسوم الخدمة السريعة",
    amount: 15
  }
};

export const internationalPricing = {
  gcc: {
    id: "gcc",
    labelEn: "GCC Shipping",
    labelAr: "الشحن إلى دول الخليج",
    firstKg: 95,
    additionalKg: 45
  },
  worldwide: {
    id: "worldwide",
    labelEn: "Worldwide Shipping",
    labelAr: "الشحن العالمي",
    firstKg: 190,
    additionalKg: 90
  }
};

export type InternationalDestination = {
  countryCode: string;
  countryNameEn: string;
  countryNameAr: string;
  region: "GCC" | "Europe" | "North America" | "Worldwide";
  firstKg: number;
  additionalKg: number;
  estimatedDays: string;
  active: true;
};

export const internationalDestinations: InternationalDestination[] = [
  { countryCode: "SA", countryNameEn: "Saudi Arabia", countryNameAr: "المملكة العربية السعودية", region: "GCC", firstKg: 95, additionalKg: 45, estimatedDays: "2-5 days", active: true },
  { countryCode: "OM", countryNameEn: "Oman", countryNameAr: "سلطنة عمان", region: "GCC", firstKg: 95, additionalKg: 45, estimatedDays: "2-5 days", active: true },
  { countryCode: "QA", countryNameEn: "Qatar", countryNameAr: "قطر", region: "GCC", firstKg: 95, additionalKg: 45, estimatedDays: "2-5 days", active: true },
  { countryCode: "KW", countryNameEn: "Kuwait", countryNameAr: "الكويت", region: "GCC", firstKg: 95, additionalKg: 45, estimatedDays: "2-5 days", active: true },
  { countryCode: "BH", countryNameEn: "Bahrain", countryNameAr: "البحرين", region: "GCC", firstKg: 95, additionalKg: 45, estimatedDays: "2-5 days", active: true },
  { countryCode: "GB", countryNameEn: "United Kingdom", countryNameAr: "المملكة المتحدة", region: "Europe", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "DE", countryNameEn: "Germany", countryNameAr: "ألمانيا", region: "Europe", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "FR", countryNameEn: "France", countryNameAr: "فرنسا", region: "Europe", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "IT", countryNameEn: "Italy", countryNameAr: "إيطاليا", region: "Europe", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "ES", countryNameEn: "Spain", countryNameAr: "إسبانيا", region: "Europe", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "NL", countryNameEn: "Netherlands", countryNameAr: "هولندا", region: "Europe", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "US", countryNameEn: "United States", countryNameAr: "الولايات المتحدة الأمريكية", region: "North America", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "CA", countryNameEn: "Canada", countryNameAr: "كندا", region: "North America", firstKg: 190, additionalKg: 90, estimatedDays: "5-10 days", active: true },
  { countryCode: "WORLD", countryNameEn: "Worldwide", countryNameAr: "وجهات عالمية", region: "Worldwide", firstKg: 190, additionalKg: 90, estimatedDays: "7-14 days", active: true }
];
