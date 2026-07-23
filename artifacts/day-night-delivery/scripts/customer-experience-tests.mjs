import assert from "node:assert/strict";
import {
  buildWhatsAppUrl,
  compactMessage,
  extractTemplateVariables,
  formatAed,
  interpolateTemplate,
  isLikelyMojibake,
  repairLikelyMojibake,
  sanitizeWhatsAppPhone,
  validateTemplateVariables,
} from "../src/services/whatsappMessageCore.mjs";

const arabicTemplate = `السلام عليكم أ/ {customer_name} 👋

📦 رقم الشحنة: {tracking_number}
{amount_due_line}
{payment_line}

🔎 {tracking_url}`;

const fullMessage = interpolateTemplate(arabicTemplate, {
  customer_name: "أحمد",
  tracking_number: "DN-2026-12345",
  amount_due_line: "💰 المبلغ المطلوب: 150.00 درهم إماراتي",
  payment_line: "💳 طريقة الدفع: الدفع عند الاستلام COD",
  tracking_url: "https://www.daynightae.com/tracking?number=DN-2026-12345",
});
assert.match(fullMessage, /أحمد/);
assert.match(fullMessage, /DN-2026-12345/);
assert.match(fullMessage, /150\.00/);
assert.match(fullMessage, /tracking\?number=/);
assert.ok(!fullMessage.includes("{"), "all variables must be resolved");

const prepaidMessage = interpolateTemplate(arabicTemplate, {
  customer_name: "عميلنا الكريم",
  tracking_number: "DN-2026-54321",
  amount_due_line: "",
  payment_line: "✅ حالة الدفع: مدفوعة مسبقًا",
  tracking_url: "https://www.daynightae.com/tracking?number=DN-2026-54321",
});
assert.ok(!prepaidMessage.includes("المبلغ المطلوب"));
assert.match(prepaidMessage, /مدفوعة مسبقًا/);
assert.ok(!/\n{3,}/.test(prepaidMessage), "optional lines should not leave large gaps");

const corruptedArabic = "Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ… ðŸ‘‹";
assert.equal(isLikelyMojibake(corruptedArabic), true);
assert.equal(isLikelyMojibake("السلام عليكم 👋"), false);
assert.equal(isLikelyMojibake("Fast Reliable Every Time"), false);
assert.equal(repairLikelyMojibake(corruptedArabic), "السلام عليكم 👋");
assert.equal(
  interpolateTemplate("Ø±Ù‚Ù… Ø§Ù„Ø´Ø­Ù†Ø©: {tracking_number}", { tracking_number: "DN-2026-77777" }),
  "رقم الشحنة: DN-2026-77777",
);

assert.equal(sanitizeWhatsAppPhone("+971 56 875 7331"), "971568757331");
assert.equal(sanitizeWhatsAppPhone("056-875-7331"), "971568757331");
assert.equal(sanitizeWhatsAppPhone("00971 56 875 7331"), "971568757331");
assert.equal(sanitizeWhatsAppPhone("123"), "");
assert.equal(formatAed(30, "en-AE"), "30.00");
assert.equal(formatAed("invalid"), "");

const url = buildWhatsAppUrl("+971568757331", fullMessage);
assert.match(url, /^https:\/\/wa\.me\/971568757331\?text=/);
assert.match(decodeURIComponent(url.split("?text=")[1]), /السلام عليكم/);

const repairedUrl = buildWhatsAppUrl("+971568757331", corruptedArabic);
assert.match(decodeURIComponent(repairedUrl.split("?text=")[1]), /السلام عليكم/);
assert.doesNotMatch(decodeURIComponent(repairedUrl.split("?text=")[1]), /Ø|Ù|ðŸ/);

assert.throws(() => buildWhatsAppUrl("123", "hello"), /invalid_whatsapp_phone/);
assert.throws(() => buildWhatsAppUrl("+971568757331", "   "), /empty_whatsapp_message/);

assert.deepEqual(extractTemplateVariables("{customer_name} {tracking_number} {customer_name}"), ["customer_name", "tracking_number"]);
assert.deepEqual(validateTemplateVariables("{customer_name} {unknown_value}", ["customer_name"]), ["unknown_value"]);
assert.equal(compactMessage("A  \n\n\nB"), "A\n\nB");

console.log("DAY NIGHT customer experience message-core tests: PASS");
