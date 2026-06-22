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

  if (!weight || weight <= 1) {
    return { min: 0, max: 0, needsCustomQuote: false };
  }

  if (weight > 1 && weight <= 5) {
    return { min: 5, max: 10, needsCustomQuote: false };
  }

  if (weight > 5 && weight <= 10) {
    return { min: 15, max: 25, needsCustomQuote: false };
  }

  if (weight > 10 && weight <= 20) {
    return { min: 30, max: 50, needsCustomQuote: false };
  }

  return { min: 0, max: 0, needsCustomQuote: true };
}

export function getQuickEstimate(from: string, to: string) {
  if (!from || !to) return null;

  if (from === to) {
    return { min: 30, max: 35 };
  }

  const abuDhabiArea = [
    "Abu Dhabi",
    "Mussafah",
    "Khalifa City",
    "Mohammed Bin Zayed City",
    "Al Ain"
  ];

  const northernEmirates = [
    "Sharjah",
    "Ajman",
    "Umm Al Quwain",
    "Ras Al Khaimah",
    "Fujairah"
  ];

  if (abuDhabiArea.includes(from) && abuDhabiArea.includes(to)) {
    return { min: 30, max: 50 };
  }

  if (
    (from === "Abu Dhabi" && to === "Dubai") ||
    (from === "Dubai" && to === "Abu Dhabi")
  ) {
    return { min: 50, max: 85 };
  }

  if (
    (abuDhabiArea.includes(from) && northernEmirates.includes(to)) ||
    (northernEmirates.includes(from) && abuDhabiArea.includes(to))
  ) {
    return { min: 70, max: 120 };
  }

  return { min: 45, max: 70 };
}
