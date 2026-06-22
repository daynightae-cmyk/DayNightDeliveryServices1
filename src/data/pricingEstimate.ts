/**
 * Official pricing data for DAY NIGHT DELIVERY SERVICES
 * All estimates are clearly marked as non-final.
 * For official prices use src/lib/pricing.ts constants.
 */
export const cities = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
  "Al Ain",
  "Mussafah",
  "Khalifa City",
  "Mohammed Bin Zayed City"
];

/**
 * Returns an official price (not a range) based on city classification.
 * Local main cities: 30 AED
 * Extended areas (Al Ain, western region): 50 AED
 * Note: Old ranges (50-85, 70-120) have been removed — they were incorrect.
 */
export function getOfficialLocalPrice(city: string): number {
  const extendedAreaKeywords = ["al ain", "العين", "western", "غربية", "liwa", "ليوا", "ghayathi", "غياثي"];
  const normalized = city.toLowerCase();
  const isExtended = extendedAreaKeywords.some(k => normalized.includes(k));
  return isExtended ? 50 : 30;
}

