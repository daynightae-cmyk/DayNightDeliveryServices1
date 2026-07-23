import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd());
const requireFile = (relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) throw new Error(`missing required file: ${relative}`);
  return fs.readFileSync(full, "utf8");
};
const requireRepoFile = (relative) => {
  const full = path.resolve(root, "../..", relative);
  if (!fs.existsSync(full)) throw new Error(`missing required repository file: ${relative}`);
  return fs.readFileSync(full, "utf8");
};
const requireText = (content, needle, file) => {
  if (!content.includes(needle)) throw new Error(`${file} is missing required contract: ${needle}`);
};
const rejectText = (content, needle, file) => {
  if (content.includes(needle)) throw new Error(`${file} contains forbidden contract: ${needle}`);
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

const customerService = requireFile("src/services/customerExperienceService.ts");
for (const value of [
  "setFeedbackReview",
  "convertFeedbackToComplaint",
  "suspendDriverForComplaint",
  "loadDriverFeedbackSummary",
  "loadMerchantOrderFeedback",
  "admin_order_feedback_rows",
  "orderHistory",
  "contactAttempts",
]) requireText(customerService, value, "customerExperienceService.ts");
const publicContextType = customerService.slice(
  customerService.indexOf("export type FeedbackContext"),
  customerService.indexOf("export type FeedbackSubmission"),
);
for (const forbidden of ["order_id", "customer_id", "merchant_id", "driver_id"]) {
  rejectText(publicContextType, forbidden, "FeedbackContext public type");
}

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

const adminActions = requireFile("src/components/admin/AdminCustomerExperienceActions.tsx");
for (const value of [
  "setFeedbackReview",
  "convertFeedbackToComplaint",
  "suspendDriverForComplaint",
  "orderHistory",
  "contactAttempts",
  "window.confirm",
]) requireText(adminActions, value, "AdminCustomerExperienceActions.tsx");

const merchantFeedback = requireFile("src/components/merchant/MerchantFeedbackSummaryLauncher.tsx");
for (const value of [
  "merchant_order_feedback",
  "بدون بيانات إدارية حساسة",
  "Customer phones, IP hashes, and internal admin notes are never shown.",
]) requireText(merchantFeedback, value, "MerchantFeedbackSummaryLauncher.tsx");

const main = requireFile("src/main.tsx");
for (const value of [
  "FeedbackPage",
  "AdminCustomerExperiencePage",
  "AdminCustomerExperienceActions",
  "MerchantFeedbackSummaryLauncher",
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

const privacyPath = path.resolve(root, "../../supabase/migrations/20260723141000_customer_experience_privacy_actions.sql");
const privacy = fs.readFileSync(privacyPath, "utf8");
for (const contract of [
  "review_status",
  "driver_feedback_summary",
  "admin_set_feedback_review",
  "admin_create_complaint_from_feedback",
  "admin_suspend_driver_for_complaint",
  "Deliberately excludes order_id, customer_id, merchant_id and driver_id",
  "dn_ce_audit",
]) requireText(privacy, contract, path.basename(privacyPath));

const rlsPath = path.resolve(root, "../../supabase/migrations/20260723141500_customer_experience_rls_storage_hardening.sql");
const rls = fs.readFileSync(rlsPath, "utf8");
for (const contract of [
  "admin_order_feedback_rows",
  "merchant_order_feedback",
  "revoke select on public.order_feedback from authenticated",
  "grant select (",
  "dn_ce_can_upload_complaint_attachment",
  "generated_by is null",
  "metadata->>'ip_hash'",
]) requireText(rls, contract, path.basename(rlsPath));

const piiPath = path.resolve(root, "../../supabase/migrations/20260723142000_customer_experience_pii_hash_hardening.sql");
const pii = fs.readFileSync(piiPath, "utf8");
for (const contract of [
  "privacy_salt",
  "hmac(",
  "No internal IDs, full customer name, phone number, addresses, COD amount or payment data.",
  "masked_phone",
]) requireText(pii, contract, path.basename(piiPath));

const runtimeGuard = requireFile("src/components/WhatsAppRuntimeGuard.tsx");
requireText(runtimeGuard, "hasMessageText", "WhatsAppRuntimeGuard.tsx");
requireText(runtimeGuard, "MutationObserver", "WhatsAppRuntimeGuard.tsx");
requireText(runtimeGuard, "prepareWhatsAppMessage", "WhatsAppRuntimeGuard.tsx");

const forbiddenDeliveredClaim = /status\s*[:=]\s*["']delivered["']/i;
if (forbiddenDeliveredClaim.test(service)) {
  throw new Error("WhatsApp message service must not claim delivered status without WhatsApp Business API evidence");
}

const coreTest = requireFile("scripts/customer-experience-tests.mjs");
for (const contract of ["invalid_whatsapp_phone", "empty_whatsapp_message", "مدفوعة مسبقًا"]) {
  requireText(coreTest, contract, "customer-experience-tests.mjs");
}

const liveE2e = requireFile("scripts/customer-experience-runtime-e2e.mjs");
for (const contract of [
  "customer_experience_runtime_health",
  "submit_order_feedback",
  "submit_public_complaint",
  "duplicate_complaint_rate_limited",
  "complaint-attachments",
  "driver_feedback_summary",
  "admin_update_complaint",
  "admin_update_message_template",
  "log_outbound_message",
  "Temporary Customer Experience E2E records cleaned up.",
]) requireText(liveE2e, contract, "customer-experience-runtime-e2e.mjs");

const liveWorkflow = requireRepoFile(".github/workflows/customer-experience-runtime-e2e.yml");
for (const contract of [
  "environment: production-runtime-tests",
  "SUPABASE_SERVICE_ROLE_KEY",
  "customer-experience:e2e",
  "DAY-NIGHT-Customer-Experience-Runtime-Evidence",
]) requireText(liveWorkflow, contract, "customer-experience-runtime-e2e.yml");

console.log("DAY NIGHT customer experience production gate: PASS");
