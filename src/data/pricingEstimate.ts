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

export function getWeightSurcharge(weightKg: number | string | null) {
  const weight = Number(weightKg);

  return { min: 0, max: 0, needsCustomQuote: Number.isFinite(weight) && weight > 50 };
}

export function getQuickEstimate(from: string, to: string) {
  if (!from || !to) return null;

  const extendedAreas = ["Al Ain", "Western Region"];
  const isExtended = extendedAreas.includes(from) || extendedAreas.includes(to);
  const price = isExtended ? 50 : 30;

  return { min: price, max: price };
}
