export type InternationalDestination = {
  value: string;
  ar: string;
  en: string;
  aliases: readonly string[];
};

export const INTERNATIONAL_DESTINATIONS: readonly InternationalDestination[] = [
  {
    value: "SA",
    ar: "المملكة العربية السعودية",
    en: "Saudi Arabia",
    aliases: ["SA", "KSA", "Saudi", "Saudi Arabia", "السعودية", "المملكة العربية السعودية"],
  },
  {
    value: "KW",
    ar: "الكويت",
    en: "Kuwait",
    aliases: ["KW", "KWT", "Kuwait", "الكويت"],
  },
  {
    value: "BH",
    ar: "البحرين",
    en: "Bahrain",
    aliases: ["BH", "BHR", "Bahrain", "البحرين"],
  },
  {
    value: "OM",
    ar: "سلطنة عُمان",
    en: "Oman",
    aliases: ["OM", "OMN", "Oman", "عمان", "عُمان", "سلطنة عمان", "سلطنة عُمان"],
  },
  {
    value: "QA",
    ar: "قطر",
    en: "Qatar",
    aliases: ["QA", "QAT", "Qatar", "قطر"],
  },
  {
    value: "AE",
    ar: "الإمارات العربية المتحدة",
    en: "United Arab Emirates",
    aliases: ["AE", "ARE", "UAE", "Emirates", "United Arab Emirates", "الإمارات", "الإمارات العربية المتحدة"],
  },
  {
    value: "US",
    ar: "الولايات المتحدة الأمريكية",
    en: "United States",
    aliases: ["US", "USA", "United States", "United States of America", "الولايات المتحدة", "الولايات المتحدة الأمريكية"],
  },
  {
    value: "GB",
    ar: "المملكة المتحدة",
    en: "United Kingdom",
    aliases: ["GB", "GBR", "UK", "United Kingdom", "Britain", "المملكة المتحدة"],
  },
  {
    value: "EU",
    ar: "دول الاتحاد الأوروبي",
    en: "European Union",
    aliases: ["EU", "Europe", "European Union", "أوروبا", "الاتحاد الأوروبي", "دول الاتحاد الأوروبي"],
  },
  {
    value: "CA",
    ar: "كندا",
    en: "Canada",
    aliases: ["CA", "CAN", "Canada", "كندا"],
  },
  {
    value: "AU",
    ar: "أستراليا",
    en: "Australia",
    aliases: ["AU", "AUS", "Australia", "أستراليا"],
  },
  {
    value: "WORLD",
    ar: "باقي دول العالم",
    en: "Rest of the world",
    aliases: ["WORLD", "Worldwide", "Rest of world", "Rest of the world", "Global", "باقي دول العالم", "العالم"],
  },
] as const;

const clean = (value: unknown) => String(value ?? "").trim();
const aliasKey = (value: unknown) =>
  clean(value)
    .toLocaleLowerCase("en")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

const DESTINATION_BY_ALIAS = new Map<string, InternationalDestination>();
for (const destination of INTERNATIONAL_DESTINATIONS) {
  for (const alias of [destination.value, destination.ar, destination.en, ...destination.aliases]) {
    DESTINATION_BY_ALIAS.set(aliasKey(alias), destination);
  }
}

export function internationalDestination(value: unknown) {
  return DESTINATION_BY_ALIAS.get(aliasKey(value)) || null;
}

export function isKnownInternationalDestination(value: unknown) {
  return Boolean(internationalDestination(value));
}

export function normalizeInternationalDestination(value: unknown, fallback = "") {
  const raw = clean(value);
  const destination = internationalDestination(raw);
  if (destination) return destination.value;
  return raw ? raw.toUpperCase() : fallback;
}

export function internationalDestinationLabel(value: unknown, isArabic: boolean) {
  const raw = clean(value);
  const destination = internationalDestination(raw);
  if (!destination) return raw || "—";
  return isArabic ? destination.ar : destination.en;
}
