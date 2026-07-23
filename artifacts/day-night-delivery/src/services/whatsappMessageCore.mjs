const PHONE_PATTERN = /^\d{8,15}$/;
const MESSAGE_PRESENTATION_STORAGE_KEY = "dn_message_presentation_v2";
const COMPANY_WEBSITE = "https://www.daynightae.com";
const COMPANY_PHONE = "+971 56 875 7331";
const COMPANY_EMAIL = "Admin@daynightae.com";

const WINDOWS_1252_REVERSE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

export const DEFAULT_MESSAGE_PRESENTATION_SETTINGS = Object.freeze({
  linkLabels: true,
  includeBrandSignature: true,
  includeSlogan: true,
  includeWebsite: false,
  includeSupportPhone: false,
  includeEmail: false,
  includeTrackingLink: true,
  includeFeedbackLink: true,
  includeMerchantPortalLink: true,
  spacing: "comfortable",
  customFooter: "",
});

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

function normalizePresentationSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_MESSAGE_PRESENTATION_SETTINGS,
    ...source,
    linkLabels: source.linkLabels !== false,
    includeBrandSignature: source.includeBrandSignature !== false,
    includeSlogan: source.includeSlogan !== false,
    includeWebsite: source.includeWebsite === true,
    includeSupportPhone: source.includeSupportPhone === true,
    includeEmail: source.includeEmail === true,
    includeTrackingLink: source.includeTrackingLink !== false,
    includeFeedbackLink: source.includeFeedbackLink !== false,
    includeMerchantPortalLink: source.includeMerchantPortalLink !== false,
    spacing: source.spacing === "compact" ? "compact" : "comfortable",
    customFooter: String(source.customFooter || "").trim(),
    customNote: String(source.customNote || "").trim(),
    customClosing: String(source.customClosing || "").trim(),
  };
}

export function readMessagePresentationSettings() {
  if (typeof window === "undefined" || !window.localStorage) {
    return normalizePresentationSettings(DEFAULT_MESSAGE_PRESENTATION_SETTINGS);
  }
  try {
    const raw = window.localStorage.getItem(MESSAGE_PRESENTATION_STORAGE_KEY);
    return normalizePresentationSettings(raw ? JSON.parse(raw) : DEFAULT_MESSAGE_PRESENTATION_SETTINGS);
  } catch {
    return normalizePresentationSettings(DEFAULT_MESSAGE_PRESENTATION_SETTINGS);
  }
}

export function saveMessagePresentationSettings(value) {
  const normalized = normalizePresentationSettings(value);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(MESSAGE_PRESENTATION_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("dn-message-presentation-change", { detail: normalized }));
  }
  return normalized;
}

export function resetMessagePresentationSettings() {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(MESSAGE_PRESENTATION_STORAGE_KEY);
  }
  return saveMessagePresentationSettings(DEFAULT_MESSAGE_PRESENTATION_SETTINGS);
}

function messageLocale(text) {
  return /[\u0600-\u06ff]/.test(text) ? "ar" : "en";
}

function urlKind(url) {
  const value = String(url || "").toLowerCase();
  if (/\/(tracking)(?:\/|\?|$)/.test(value)) return "tracking";
  if (/\/(feedback|rate)(?:\/|\?|$)/.test(value)) return "feedback";
  if (/\/merchant(?:\/|\?|$)/.test(value)) return "merchant";
  if (/\/admin(?:\/|\?|$)/.test(value)) return "admin";
  if (/wa\.me|whatsapp\.com/.test(value)) return "whatsapp";
  if (/daynightae\.com/.test(value)) return "website";
  return "link";
}

function labelForLink(kind, locale) {
  const labels = {
    ar: {
      tracking: "🔎 رابط تتبع الشحنة:",
      feedback: "⭐ رابط تقييم الخدمة وتسجيل الملاحظات:",
      merchant: "🏪 رابط دخول لوحة التاجر:",
      admin: "🛡️ رابط لوحة الإدارة:",
      whatsapp: "💬 رابط التواصل عبر واتساب:",
      website: "🌐 الموقع الرسمي لشركة داي نايت:",
      link: "🔗 الرابط:",
    },
    en: {
      tracking: "🔎 Shipment tracking link:",
      feedback: "⭐ Service rating and feedback link:",
      merchant: "🏪 Merchant portal link:",
      admin: "🛡️ Administration portal link:",
      whatsapp: "💬 WhatsApp contact link:",
      website: "🌐 DAY NIGHT official website:",
      link: "🔗 Link:",
    },
  };
  return labels[locale][kind] || labels[locale].link;
}

function isDecorationOnly(value) {
  return !String(value || "").replace(/[\s🔎⭐🏪🛡️💬🌐🔗➡️👉📦🚚•:：-]/gu, "");
}

function isLinkLabel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return /(?:رابط|الموقع الرسمي|تتبع الشحنة|تقييم الخدمة|لوحة التاجر|link|tracking|feedback|merchant portal|official website|whatsapp)/i.test(text) || text.endsWith(":");
}

function shouldIncludeLink(kind, settings) {
  if (kind === "tracking") return settings.includeTrackingLink;
  if (kind === "feedback") return settings.includeFeedbackLink;
  if (kind === "merchant") return settings.includeMerchantPortalLink;
  return true;
}

function removePreviousLabel(output) {
  while (output.length && !String(output[output.length - 1] || "").trim()) output.pop();
  if (output.length && isLinkLabel(output[output.length - 1])) output.pop();
}

function formatNamedLinks(message, settings, locale) {
  const output = [];
  const urlPattern = /https?:\/\/[^\s]+/i;

  for (const originalLine of compactMessage(message).split("\n")) {
    const match = originalLine.match(urlPattern);
    if (!match) {
      output.push(originalLine);
      continue;
    }

    const rawUrl = match[0];
    const url = rawUrl.replace(/[),.;،]+$/u, "");
    const kind = urlKind(url);
    const before = originalLine.slice(0, match.index).trim();
    const after = originalLine.slice((match.index || 0) + rawUrl.length).trim();

    if (!shouldIncludeLink(kind, settings)) {
      removePreviousLabel(output);
      if (after) output.push(after);
      continue;
    }

    const previous = output.length ? output[output.length - 1] : "";
    if (before && !isDecorationOnly(before)) {
      output.push(before.endsWith(":") ? before : `${before}:`);
    } else if (settings.linkLabels && !isLinkLabel(previous)) {
      output.push(labelForLink(kind, locale));
    }

    output.push(url);
    if (after) output.push(after);
  }

  return compactMessage(output.join("\n"));
}

function hasExactWebsiteLine(message) {
  return message.split("\n").some((line) => /^https:\/\/(?:www\.)?daynightae\.com\/?$/i.test(line.trim()));
}

function appendProfessionalDetails(message, settings, locale) {
  const blocks = [];
  const normalizedPhone = COMPANY_PHONE.replace(/\D/g, "");
  const messagePhone = message.replace(/\D/g, "");

  if (settings.customNote) {
    blocks.push(locale === "ar" ? `📝 ملاحظة خاصة:\n${settings.customNote}` : `📝 Special note:\n${settings.customNote}`);
  }
  if (settings.customClosing) blocks.push(settings.customClosing);

  if (settings.includeWebsite && !hasExactWebsiteLine(message)) {
    blocks.push(`${labelForLink("website", locale)}\n${COMPANY_WEBSITE}`);
  }
  if (settings.includeSupportPhone && !messagePhone.includes(normalizedPhone)) {
    blocks.push(locale === "ar" ? `📞 خدمة العملاء وواتساب:\n${COMPANY_PHONE}` : `📞 Customer service and WhatsApp:\n${COMPANY_PHONE}`);
  }
  if (settings.includeEmail && !message.toLowerCase().includes(COMPANY_EMAIL.toLowerCase())) {
    blocks.push(locale === "ar" ? `✉️ البريد الإلكتروني:\n${COMPANY_EMAIL}` : `✉️ Email:\n${COMPANY_EMAIL}`);
  }

  const hasBrand = /day night delivery services|داي نايت لخدمات التوصيل والشحن/i.test(message);
  if (settings.includeBrandSignature && !hasBrand) {
    blocks.push(locale === "ar" ? "داي نايت لخدمات التوصيل والشحن\nDAY NIGHT DELIVERY SERVICES" : "DAY NIGHT DELIVERY SERVICES\nداي نايت لخدمات التوصيل والشحن");
  }
  if (settings.includeSlogan && !/سريع\s*[•·]\s*آمن|fast\s*[•·]\s*reliable/i.test(message)) {
    blocks.push(locale === "ar" ? "سريع • آمن • موثوق" : "Fast • Reliable • Every Time");
  }
  if (settings.customFooter) blocks.push(settings.customFooter);

  return blocks.length ? `${message}\n\n${blocks.join("\n\n")}` : message;
}

export function formatProfessionalMessage(message, overrides = {}) {
  const base = readMessagePresentationSettings();
  const settings = normalizePresentationSettings({ ...base, ...(overrides || {}) });
  const repaired = compactMessage(repairLikelyMojibake(message));
  const locale = messageLocale(repaired);
  const withLinks = formatNamedLinks(repaired, settings, locale);
  const completed = appendProfessionalDetails(withLinks, settings, locale);
  if (settings.spacing === "compact") return completed.replace(/\n{2,}/g, "\n").trim();
  return compactMessage(completed);
}

export function buildWhatsAppUrl(phone, message) {
  const sanitizedPhone = sanitizeWhatsAppPhone(phone);
  const cleanMessage = compactMessage(repairLikelyMojibake(message));
  if (!sanitizedPhone) throw new Error("invalid_whatsapp_phone");
  if (!cleanMessage) throw new Error("empty_whatsapp_message");
  return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(cleanMessage)}`;
}
