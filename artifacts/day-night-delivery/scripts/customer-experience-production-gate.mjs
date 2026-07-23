import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd());
const requireFile = (relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) throw new Error(`missing required file: ${relative}`);
  return fs.readFileSync(full, "utf8");
};
const requireText = (content, needle, file) => {
  if (!content.includes(needle)) throw new Error(`${file} is missing required contract: ${needle}`);
};

const company = requireFile("src/config/companyContact.ts");
for (const value of [
  "https://www.daynightae.com",
  "https://www.daynightae.com/tracking",
  "971568757331",
  "Admin@daynightae.com",
  "Fast • Reliable • Every Time",
]) requireText(company, value, "companyContact.ts");

const service = requireFile("src/services/whatsappMessageService.ts");
for (const value of [
  "prepareWhatsAppMessage",
  "sanitizeWhatsAppPhone",
  "buildWhatsAppUrl",
  "log_outbound_message",
  "mark_outbound_message_status",
  "create_feedback_token_for_order",
  "record_driver_contact_attempt",
]) requireText(service, value, "whatsappMessageService.ts");

const templates = requireFile("src/config/messageTemplates.ts");
for (const key of [
  "driver_on_the_way",
  "driver_request_location",
  "driver_arrived",
  "driver_unreachable",
  "driver_delivered_feedback",
  "merchant_welcome",
  "merchant_orders_today",
  "merchant_settlement",
  "tracking_support",
  "complaint_support",
]) requireText(templates, key, "messageTemplates.ts");

const driver = requireFile("src/components/driver/DriverCustomerCommunication.tsx");
for (const label of [
  "أنا في الطريق",
  "طلب إرسال الموقع",
  "وصلت إلى الموقع",
  "تعذر التواصل",
  "تم التسليم – طلب تقييم",
  "اتصال بالعميل",
  "فتح التتبع",
  "نسخ رقم الشحنة",
]) requireText(driver, label, "DriverCustomerCommunication.tsx");
requireText(driver, "فتح واتساب لا يغيّر حالة الطلب", "DriverCustomerCommunication.tsx");

const feedback = requireFile("src/components/FeedbackPage.tsx");
for (const value of [
  "كيف كانت تجربتك مع داي نايت؟",
  "submitOrderFeedback",
  "submitPublicComplaint",
  "uploadComplaintAttachment",
  "لدي شكوى أو مشكلة",
  "أوافق على عرض تقييمي",
]) requireText(feedback, value, "FeedbackPage.tsx");

const admin = requireFile("src/components/admin/AdminCustomerExperiencePage.tsx");
for (const value of [
  'id: "overview"',
  'id: "ratings"',
  'id: "complaints"',
  'id: "drivers"',
  'id: "merchants"',
  'id: "messages"',
  'id: "templates"',
  "subscribeCustomerExperience",
  "merchant_welcome",
  "merchant_orders_today",
]) requireText(admin, value, "AdminCustomerExperiencePage.tsx");

const main = requireFile("src/main.tsx");
for (const value of [
  "FeedbackPage",
  "AdminCustomerExperiencePage",
  "ProtectedAdminRoute",
  "WhatsAppRuntimeGuard",
  "normalizeTrackingNumberQuery",
]) requireText(main, value, "main.tsx");

const migrationPath = path.resolve(root, "../../supabase/migrations/20260723140000_smart_whatsapp_feedback_complaints.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
for (const table of [
  "message_templates",
  "outbound_message_logs",
  "order_feedback",
  "complaints",
  "complaint_attachments",
  "complaint_events",
  "feedback_tokens",
  "order_contact_attempts",
]) requireText(migration, `public.${table}`, path.basename(migrationPath));
for (const security of [
  "enable row level security",
  "create_feedback_token_for_order",
  "get_feedback_context",
  "submit_order_feedback",
  "submit_public_complaint",
  "duplicate_complaint_rate_limited",
  "complaint-attachments",
  "supabase_realtime",
  "generated','opened','copied','failed",
]) requireText(migration, security, path.basename(migrationPath));

const healthPath = path.resolve(root, "../../supabase/migrations/20260723140500_customer_experience_runtime_health.sql");
const health = fs.readFileSync(healthPath, "utf8");
for (const contract of [
  "customer_experience_runtime_health",
  "missing_tables",
  "rls_missing",
  "realtime_missing",
  "attachment_bucket",
  "pg_notify('pgrst','reload schema')",
]) requireText(health, contract, path.basename(healthPath));

const runtimeGuard = requireFile("src/components/WhatsAppRuntimeGuard.tsx");
requireText(runtimeGuard, "hasMessageText", "WhatsAppRuntimeGuard.tsx");
requireText(runtimeGuard, "MutationObserver", "WhatsAppRuntimeGuard.tsx");
requireText(runtimeGuard, "prepareWhatsAppMessage", "WhatsAppRuntimeGuard.tsx");

const forbiddenDeliveredClaim = /status\s*[:=]\s*["']delivered["']/i;
if (forbiddenDeliveredClaim.test(service)) {
  throw new Error("WhatsApp message service must not claim delivered status without WhatsApp Business API evidence");
}

const coreTest = requireFile("scripts/customer-experience-tests.mjs");
requireText(coreTest, "invalid_whatsapp_phone", "customer-experience-tests.mjs");
requireText(coreTest, "empty_whatsapp_message", "customer-experience-tests.mjs");
requireText(coreTest, "مدفوعة مسبقًا", "customer-experience-tests.mjs");

console.log("DAY NIGHT customer experience production gate: PASS");
