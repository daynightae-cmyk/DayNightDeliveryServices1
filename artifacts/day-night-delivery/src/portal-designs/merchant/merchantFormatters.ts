export function merchantClean(value: unknown): string {
  return String(value ?? "").trim();
}

export function merchantNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function merchantMoney(value: number | null | undefined, currency = "AED", locale = "en-AE"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function merchantDate(value: string | null | undefined, isArabic: boolean, withTime = true): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

export function merchantPhoneHref(phone?: string): string {
  return `tel:${merchantClean(phone).replace(/[^+\d]/g, "")}`;
}

export function merchantWhatsappHref(phone?: string): string {
  const digits = merchantClean(phone).replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export function merchantPercent(value: number | null | undefined, locale = "en-AE"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
}

export function maskIban(value?: string): string {
  const normalized = merchantClean(value).replace(/\s+/g, "");
  if (!normalized) return "—";
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)} •••• •••• ${normalized.slice(-4)}`;
}
