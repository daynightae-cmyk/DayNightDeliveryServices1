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
  const formatted = new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(amount);
  return isArabic ? `${formatted} درهم` : `${formatted} AED`;
}

export function adminCurrencyLabel(isArabic: boolean) {
  return isArabic ? "درهم إماراتي" : "UAE dirham (AED)";
}
