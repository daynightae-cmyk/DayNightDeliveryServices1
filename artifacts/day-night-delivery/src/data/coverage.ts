export type CoverageArea = {
  id: string;
  nameEn: string;
  nameAr: string;
  emirate: string;
  zoneType: "main" | "extended";
  active: true;
};

export const coverageAreas: CoverageArea[] = [
  { id: "abu-dhabi", nameEn: "Abu Dhabi", nameAr: "أبوظبي", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "dubai", nameEn: "Dubai", nameAr: "دبي", emirate: "Dubai", zoneType: "main", active: true },
  { id: "sharjah", nameEn: "Sharjah", nameAr: "الشارقة", emirate: "Sharjah", zoneType: "main", active: true },
  { id: "ajman", nameEn: "Ajman", nameAr: "عجمان", emirate: "Ajman", zoneType: "main", active: true },
  { id: "umm-al-quwain", nameEn: "Umm Al Quwain", nameAr: "أم القيوين", emirate: "Umm Al Quwain", zoneType: "main", active: true },
  { id: "ras-al-khaimah", nameEn: "Ras Al Khaimah", nameAr: "رأس الخيمة", emirate: "Ras Al Khaimah", zoneType: "main", active: true },
  { id: "fujairah", nameEn: "Fujairah", nameAr: "الفجيرة", emirate: "Fujairah", zoneType: "main", active: true },
  { id: "al-ain", nameEn: "Al Ain", nameAr: "العين", emirate: "Al Ain", zoneType: "main", active: true },
  { id: "al-ruwais", nameEn: "Al Ruwais", nameAr: "الرويس", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "al-dhannah", nameEn: "Al Dhannah", nameAr: "الظنة", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "al-dhafra", nameEn: "Al Dhafra / Western Region", nameAr: "الظفرة / المنطقة الغربية", emirate: "Abu Dhabi", zoneType: "extended", active: true },
  { id: "liwa", nameEn: "Liwa", nameAr: "ليوا", emirate: "Abu Dhabi", zoneType: "extended", active: true },
  { id: "ghayathi", nameEn: "Ghayathi", nameAr: "غياثي", emirate: "Abu Dhabi", zoneType: "extended", active: true },
  { id: "sila", nameEn: "Sila", nameAr: "السلع", emirate: "Abu Dhabi", zoneType: "extended", active: true },
  { id: "madinat-zayed", nameEn: "Madinat Zayed", nameAr: "مدينة زايد - الظفرة", emirate: "Abu Dhabi", zoneType: "extended", active: true },
  { id: "al-mirfa", nameEn: "Al Mirfa", nameAr: "المرفأ", emirate: "Abu Dhabi", zoneType: "extended", active: true },
  { id: "mussafah", nameEn: "Mussafah", nameAr: "مصفح", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "khalifa-city", nameEn: "Khalifa City", nameAr: "مدينة خليفة", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "mbz-city", nameEn: "Mohammed Bin Zayed City", nameAr: "مدينة محمد بن زايد", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "baniyas", nameEn: "Baniyas", nameAr: "بني ياس", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "reem-island", nameEn: "Reem Island", nameAr: "جزيرة الريم", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "yas-island", nameEn: "Yas Island", nameAr: "جزيرة ياس", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "saadiyat", nameEn: "Saadiyat", nameAr: "السعديات", emirate: "Abu Dhabi", zoneType: "main", active: true },
  { id: "business-bay", nameEn: "Business Bay", nameAr: "الخليج التجاري", emirate: "Dubai", zoneType: "main", active: true },
  { id: "deira", nameEn: "Deira", nameAr: "ديرة", emirate: "Dubai", zoneType: "main", active: true },
  { id: "bur-dubai", nameEn: "Bur Dubai", nameAr: "بر دبي", emirate: "Dubai", zoneType: "main", active: true },
  { id: "jebel-ali", nameEn: "Jebel Ali", nameAr: "جبل علي", emirate: "Dubai", zoneType: "main", active: true },
  { id: "dubai-marina", nameEn: "Dubai Marina", nameAr: "دبي مارينا", emirate: "Dubai", zoneType: "main", active: true },
  { id: "jvc", nameEn: "JVC", nameAr: "قرية جميرا الدائرية", emirate: "Dubai", zoneType: "main", active: true },
  { id: "al-barsha", nameEn: "Al Barsha", nameAr: "البرشاء", emirate: "Dubai", zoneType: "main", active: true },
];

function normalizeCoverageName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[\s_]+/g, " ");
}

export function findCoverageArea(value: string | null | undefined) {
  const normalized = normalizeCoverageName(value);
  return coverageAreas.find((area) => {
    return normalizeCoverageName(area.nameEn) === normalized
      || normalizeCoverageName(area.nameAr) === normalized
      || normalizeCoverageName(area.id) === normalized.replace(/ /g, "-");
  });
}

/**
 * Official DAY NIGHT local pricing boundary:
 * - Al Ain and every Al Ain district are normal 25 AED coverage.
 * - Al Ruwais / Al Dhannah are normal 25 AED coverage.
 * - Only remote Al Dhafra / Western Region routes are 50 AED.
 */
export function isExtendedCoverage(value: string | null | undefined) {
  const normalized = normalizeCoverageName(value);
  if (!normalized) return false;

  if (/(^|\b)(al ain|al-ain)(\b|$)|العين/.test(normalized)) return false;
  if (/(^|\b)(al ruwais|ruwais|al dhannah|dhannah)(\b|$)|الرويس|الظنة/.test(normalized)) return false;

  const area = findCoverageArea(value);
  if (area) return area.zoneType === "extended";

  return /(western region|al dhafra|dhafra|liwa|ghayathi|sila|al mirfa|mirfa|madinat zayed|bada mutawa|baynouna|habshan|hamim|asab|shuweihat|barakah|dalma|المنطقة الغربية|الغربية|الظفرة|ليوا|غياثي|السلع|المرفأ|بدع مطوع|بينونة|حبشان|حَمِيم|عصب|شويهات|براكة|دلما)/.test(normalized);
}
