export function adminNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAdminMoney(
  value: unknown,
  isArabic: boolean,
  options: { absolute?: boolean; minimumFractionDigits?: number } = {},
) {
  const amount = options.absolute ? Math.abs(adminNumber(value)) : adminNumber(value);
  const digits = options.minimumFractionDigits ?? 2;
  const formatted = new Intl.NumberFormat(isArabic ? "ar-AE-u-nu-latn" : "en-AE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(amount);
  return isArabic ? `${formatted} درهم` : `${formatted} AED`;
}

export function adminCurrencyLabel(isArabic: boolean) {
  return isArabic ? "الدرهم الإماراتي" : "UAE dirham (AED)";
}

/**
 * Prevents raw or machine-transliterated currency codes from leaking into the
 * Arabic administration interface. Database values remain canonical AED; only
 * the operator-facing text is localized.
 */
export function normalizeAdminCurrencyText(value: unknown, isArabic: boolean) {
  const text = String(value ?? "");
  if (!isArabic || !text) return text;

  return text
    .replace(
      /\bA\.?\s*E\.?\s*D\.?\s*([0-9٠-٩][0-9٠-٩.,٬٫]*)/gi,
      "$1 درهم",
    )
    .replace(
      /([0-9٠-٩][0-9٠-٩.,٬٫]*)\s*\bA\.?\s*E\.?\s*D\.?\b/gi,
      "$1 درهم",
    )
    .replace(/\bA\.?\s*E\.?\s*D\.?\b/gi, "درهم")
    .replace(/(^|[\s([{؛،:])(?:ايد|إيد|أيد)(?=$|[\s)\]}؛،:,.])/g, "$1درهم")
    .replace(/(^|[\s([{؛،:])د\.?\s*إ\.?(?=$|[\s)\]}؛،:,.])/g, "$1درهم");
}
