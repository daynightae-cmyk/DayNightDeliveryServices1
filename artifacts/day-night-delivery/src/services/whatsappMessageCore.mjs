const PHONE_PATTERN = /^\d{8,15}$/;

const WINDOWS_1252_REVERSE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

export function isLikelyMojibake(value) {
  const text = String(value || "");
  if (!text) return false;
  return /(?:[ØÙ].){2,}|ðŸ|â(?:€|œ|­|†|„|˜|™)|ï¸/u.test(text);
}

export function repairLikelyMojibake(value) {
  const text = String(value || "");
  if (!isLikelyMojibake(text) || typeof TextDecoder === "undefined") return text;

  const bytes = [];
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const mapped = WINDOWS_1252_REVERSE.get(codePoint);
    if (mapped === undefined) return text;
    bytes.push(mapped);
  }

  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    if (!repaired || isLikelyMojibake(repaired)) return text;
    return repaired;
  } catch {
    return text;
  }
}

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
  const safeTemplate = repairLikelyMojibake(template);
  const rendered = safeTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = variables?.[key];
    return value === null || value === undefined ? "" : String(value);
  });
  return compactMessage(rendered);
}

export function buildWhatsAppUrl(phone, message) {
  const sanitizedPhone = sanitizeWhatsAppPhone(phone);
  const cleanMessage = compactMessage(repairLikelyMojibake(message));
  if (!sanitizedPhone) throw new Error("invalid_whatsapp_phone");
  if (!cleanMessage) throw new Error("empty_whatsapp_message");
  return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(cleanMessage)}`;
}
