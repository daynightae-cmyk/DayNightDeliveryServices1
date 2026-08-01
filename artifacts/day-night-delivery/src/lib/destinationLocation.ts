export type DestinationLocale = "ar" | "en";

type LocationEntry = {
  ar: string;
  en: string;
  aliases: readonly string[];
  emirate?: string;
};

const clean = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");

export function normalizeLocationIdentity(value: unknown) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "")
    .trim();
}

const LOCATIONS: readonly LocationEntry[] = [
  { ar: "أبوظبي", en: "Abu Dhabi", aliases: ["abu dhabi", "abu-dhabi", "abudhabi", "أبو ظبي", "ابوظبي"] },
  { ar: "دبي", en: "Dubai", aliases: ["dubai", "دبي"] },
  { ar: "الشارقة", en: "Sharjah", aliases: ["sharjah", "الشارقة", "شارقة"] },
  { ar: "عجمان", en: "Ajman", aliases: ["ajman", "عجمان"] },
  { ar: "أم القيوين", en: "Umm Al Quwain", aliases: ["umm al quwain", "umm-al-quwain", "uaq", "ام القيوين", "أم القيوين"] },
  { ar: "رأس الخيمة", en: "Ras Al Khaimah", aliases: ["ras al khaimah", "ras-al-khaimah", "rak", "راس الخيمة", "رأس الخيمة"] },
  { ar: "الفجيرة", en: "Fujairah", aliases: ["fujairah", "الفجيرة", "فجيرة"] },

  { ar: "العين", en: "Al Ain", emirate: "Abu Dhabi", aliases: ["al ain", "al-ain", "العين"] },
  { ar: "الشامخة", en: "Al Shamkha", emirate: "Abu Dhabi", aliases: ["al shamkha", "al-shamkha", "shamkha", "الشامخة", "الشمخة"] },
  { ar: "مصفح", en: "Mussafah", emirate: "Abu Dhabi", aliases: ["mussafah", "musaffah", "mussafah industrial", "مصفح"] },
  { ar: "مدينة خليفة", en: "Khalifa City", emirate: "Abu Dhabi", aliases: ["khalifa city", "مدينة خليفة"] },
  { ar: "مدينة محمد بن زايد", en: "Mohammed Bin Zayed City", emirate: "Abu Dhabi", aliases: ["mohammed bin zayed city", "mohammad bin zayed city", "mohamed bin zayed city", "mbz", "مدينة محمد بن زايد"] },
  { ar: "بني ياس", en: "Bani Yas", emirate: "Abu Dhabi", aliases: ["bani yas", "بني ياس"] },
  { ar: "الشهامة", en: "Al Shahama", emirate: "Abu Dhabi", aliases: ["al shahama", "shahama", "الشهامة"] },
  { ar: "الخالدية", en: "Al Khalidiyah", emirate: "Abu Dhabi", aliases: ["al khalidiyah", "al khalidiya", "khalidiyah", "الخالدية"] },
  { ar: "الزاهية", en: "Al Zahiyah", emirate: "Abu Dhabi", aliases: ["al zahiyah", "zahiyah", "الزاهية"] },
  { ar: "جزيرة الريم", en: "Al Reem Island", emirate: "Abu Dhabi", aliases: ["al reem island", "reem island", "جزيرة الريم"] },
  { ar: "جزيرة ياس", en: "Yas Island", emirate: "Abu Dhabi", aliases: ["yas island", "جزيرة ياس"] },
  { ar: "الظفرة", en: "Al Dhafra", emirate: "Abu Dhabi", aliases: ["al dhafra", "western region", "الظفرة", "المنطقة الغربية"] },

  { ar: "البرشاء", en: "Al Barsha", emirate: "Dubai", aliases: ["al barsha", "al-barsha", "barsha", "البرشاء"] },
  { ar: "ديرة", en: "Deira", emirate: "Dubai", aliases: ["deira", "ديرة"] },
  { ar: "رأس الخور", en: "Ras Al Khor", emirate: "Dubai", aliases: ["ras al khor", "ras-al-khor", "رأس الخور", "راس الخور"] },
  { ar: "مردف", en: "Mirdif", emirate: "Dubai", aliases: ["mirdif", "مردف"] },
  { ar: "القصيص", en: "Al Qusais", emirate: "Dubai", aliases: ["al qusais", "qusais", "القصيص"] },
  { ar: "القوز", en: "Al Quoz", emirate: "Dubai", aliases: ["al quoz", "quoz", "القوز"] },
  { ar: "جميرا", en: "Jumeirah", emirate: "Dubai", aliases: ["jumeirah", "جميرا"] },
  { ar: "جبل علي", en: "Jebel Ali", emirate: "Dubai", aliases: ["jebel ali", "jabal ali", "جبل علي"] },

  { ar: "النهدة", en: "Al Nahda", emirate: "Sharjah", aliases: ["al nahda", "al-nahda", "nahda", "النهدة"] },
  { ar: "النود", en: "Al Nud", emirate: "Sharjah", aliases: ["al nud", "nud", "النود"] },
  { ar: "خورفكان", en: "Khor Fakkan", emirate: "Sharjah", aliases: ["khor fakkan", "khorfakkan", "خورفكان"] },

  { ar: "الظيت", en: "Al Dhait", emirate: "Ras Al Khaimah", aliases: ["al dhait", "al-dhait", "dhait", "الظيت"] },
];

const aliasIndex = new Map<string, LocationEntry>();
for (const entry of LOCATIONS) {
  for (const alias of [entry.ar, entry.en, ...entry.aliases]) {
    aliasIndex.set(normalizeLocationIdentity(alias), entry);
  }
}

function entryFor(value: unknown) {
  return aliasIndex.get(normalizeLocationIdentity(value));
}

export function localizeDestinationPart(value: unknown, locale: DestinationLocale) {
  const raw = clean(value);
  if (!raw) return "";
  const entry = entryFor(raw);
  return entry ? entry[locale] : raw;
}

export function inferDestinationEmirate(value: unknown, locale: DestinationLocale) {
  const entry = entryFor(value);
  if (!entry?.emirate) return "";
  return localizeDestinationPart(entry.emirate, locale);
}

export function areEquivalentLocations(left: unknown, right: unknown) {
  const leftRaw = clean(left);
  const rightRaw = clean(right);
  if (!leftRaw || !rightRaw) return false;
  const leftEntry = entryFor(leftRaw);
  const rightEntry = entryFor(rightRaw);
  if (leftEntry && rightEntry) return leftEntry === rightEntry;
  return normalizeLocationIdentity(leftRaw) === normalizeLocationIdentity(rightRaw);
}

export function extractDestinationAreaFromAddress(
  address: unknown,
  emirate: unknown,
  city: unknown,
) {
  const rawAddress = clean(address);
  if (!rawAddress) return "";

  const parts = rawAddress
    .split(/\s+(?:—|–|-|→|←)\s+|[,،|\n]+/)
    .map(clean)
    .filter(Boolean);
  if (!parts.length) return "";

  const candidates = parts.filter(
    (part) => !areEquivalentLocations(part, emirate) && !areEquivalentLocations(part, city),
  );
  const knownArea = candidates.find((part) => Boolean(inferDestinationEmirate(part, "en")));
  if (knownArea) return knownArea;

  const terminal = parts[parts.length - 1];
  const structuredAddress =
    parts.length > 1 &&
    (areEquivalentLocations(terminal, emirate) || areEquivalentLocations(terminal, city));
  return structuredAddress ? candidates[0] || "" : "";
}

export function formatDestinationLocation(
  emirate: unknown,
  area: unknown,
  locale: DestinationLocale,
) {
  const localizedEmirate = localizeDestinationPart(emirate, locale);
  const localizedArea = localizeDestinationPart(area, locale);

  if (!localizedEmirate) return localizedArea || "—";
  if (!localizedArea || areEquivalentLocations(localizedEmirate, localizedArea)) return localizedEmirate;
  return `${localizedEmirate} — ${localizedArea}`;
}
