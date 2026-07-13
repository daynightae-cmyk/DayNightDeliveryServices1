export type PhoneValidationMode = "uae" | "international" | "any";

function cleanPhone(value: unknown) {
  return String(value ?? "").trim();
}

export function phoneDigits(value: unknown) {
  return cleanPhone(value).replace(/\D/g, "");
}

export function normalizePhoneForStorage(value: unknown) {
  return cleanPhone(value).replace(/\s+/g, " ");
}

export function isLikelyUaePhone(value: unknown) {
  const raw = cleanPhone(value);
  const digits = phoneDigits(raw);
  if (!digits) return false;

  // UAE mobile/landline written locally: 0501234567, 0551234567, 021234567, 041234567.
  if (/^0[2-9]\d{7,8}$/.test(digits)) return true;

  // UAE mobile without leading zero, useful for admin operators typing quickly: 501234567.
  if (/^5\d{8}$/.test(digits)) return true;

  // UAE international formats: +971501234567, 00971501234567, 971501234567.
  if (/^971[2-9]\d{7,8}$/.test(digits)) return true;

  return false;
}

export function isLikelyInternationalPhone(value: unknown) {
  const raw = cleanPhone(value);
  const digits = phoneDigits(raw);
  if (!digits) return false;

  // International E.164 practical range is up to 15 digits. Keep the lower bound permissive
  // because some countries have shorter fixed-line numbers.
  if ((raw.startsWith("+") || raw.startsWith("00")) && /^\d{8,15}$/.test(digits)) return true;

  // Accept common operator entry without + when it is clearly not a tiny/invalid value.
  return /^\d{7,15}$/.test(digits);
}

export function isValidOperationalPhone(value: unknown, mode: PhoneValidationMode = "any") {
  const raw = cleanPhone(value);
  if (!raw) return false;

  if (mode === "uae") return isLikelyUaePhone(raw);
  if (mode === "international") return isLikelyInternationalPhone(raw);
  return isLikelyUaePhone(raw) || isLikelyInternationalPhone(raw);
}

export function phoneHelpText(isArabic: boolean) {
  return isArabic
    ? "اكتب الرقم كما يقوله العميل: 0501234567 أو 0551234567 أو +971501234567. للأرقام الدولية استخدم كود الدولة."
    : "Enter the number as provided: 0501234567, 0551234567, or +971501234567. For international numbers, use the country code.";
}
