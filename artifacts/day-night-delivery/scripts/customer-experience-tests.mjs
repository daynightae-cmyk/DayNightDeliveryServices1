import assert from "node:assert/strict";
import {
  buildWhatsAppUrl,
  compactMessage,
  extractTemplateVariables,
  formatAed,
  interpolateTemplate,
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

assert.equal(sanitizeWhatsAppPhone("+971 56 875 7331"), "971568757331");
assert.equal(sanitizeWhatsAppPhone("056-875-7331"), "971568757331");
assert.equal(sanitizeWhatsAppPhone("00971 56 875 7331"), "971568757331");
assert.equal(sanitizeWhatsAppPhone("123"), "");
assert.equal(formatAed(30, "en-AE"), "30.00");
assert.equal(formatAed("invalid"), "");

const url = buildWhatsAppUrl("+971568757331", fullMessage);
assert.match(url, /^https:\/\/wa\.me\/971568757331\?text=/);
assert.match(decodeURIComponent(url.split("?text=")[1]), /السلام عليكم/);
assert.throws(() => buildWhatsAppUrl("123", "hello"), /invalid_whatsapp_phone/);
assert.throws(() => buildWhatsAppUrl("+971568757331", "   "), /empty_whatsapp_message/);

assert.deepEqual(extractTemplateVariables("{customer_name} {tracking_number} {customer_name}"), ["customer_name", "tracking_number"]);
assert.deepEqual(validateTemplateVariables("{customer_name} {unknown_value}", ["customer_name"]), ["unknown_value"]);
assert.equal(compactMessage("A  \n\n\nB"), "A\n\nB");

console.log("DAY NIGHT customer experience message-core tests: PASS");
