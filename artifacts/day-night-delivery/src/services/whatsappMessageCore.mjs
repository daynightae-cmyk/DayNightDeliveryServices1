const PHONE_PATTERN = /^\d{8,15}$/;

export function sanitizeWhatsAppPhone(value, defaultCountryCode = "971") {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `${defaultCountryCode}${digits.slice(1)}`;
  if (!PHONE_PATTERN.test(digits)) return "";
  return digits;
}

export function formatAed(value, locale = "ar-AE") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function extractTemplateVariables(template) {
  const variables = new Set();
  const pattern = /\{([a-zA-Z0-9_]+)\}/g;
  let match;
  while ((match = pattern.exec(String(template || ""))) !== null) variables.add(match[1]);
  return [...variables];
}

export function validateTemplateVariables(template, allowedVariables) {
  const allowed = new Set(allowedVariables || []);
  return extractTemplateVariables(template).filter((variable) => !allowed.has(variable));
}

export function compactMessage(message) {
  return String(message || "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function interpolateTemplate(template, variables) {
  const rendered = String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = variables?.[key];
    return value === null || value === undefined ? "" : String(value);
  });
  return compactMessage(rendered);
}

export function buildWhatsAppUrl(phone, message) {
  const sanitizedPhone = sanitizeWhatsAppPhone(phone);
  const cleanMessage = compactMessage(message);
  if (!sanitizedPhone) throw new Error("invalid_whatsapp_phone");
  if (!cleanMessage) throw new Error("empty_whatsapp_message");
  return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(cleanMessage)}`;
}
