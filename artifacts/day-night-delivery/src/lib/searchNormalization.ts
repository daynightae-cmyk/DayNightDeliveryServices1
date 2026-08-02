const localizedDigits: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

/**
 * Normalizes human-entered Arabic/English search text without changing the
 * underlying data. Punctuation becomes token separators so phone, coupon and
 * tracking references match whether users include spaces, dashes or +971.
 */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[٠-٩۰-۹]/g, (digit) => localizedDigits[digit] || digit)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchTokens(query: unknown): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

/** Every query token must occur somewhere in the combined searchable fields. */
export function matchesSearchQuery(values: readonly unknown[], query: unknown): boolean {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const haystack = normalizeSearchText(values.filter((value) => value != null).join(" "));
  return tokens.every((token) => haystack.includes(token));
}
