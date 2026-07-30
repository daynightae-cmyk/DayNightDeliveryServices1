#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPO = path.resolve(ROOT, "../..");

function read(relativePath) {
  return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8");
}

function readRepo(relativePath) {
  return fs.readFileSync(path.resolve(REPO, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label}: missing ${expected}`);
}

function forbidText(source, forbidden, label) {
  if (source.includes(forbidden)) throw new Error(`${label}: forbidden ${forbidden}`);
}

function requireSingleOccurrence(source, expected, label) {
  const count = source.split(expected).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one occurrence, found ${count}`);
}

const main = read("src/main.tsx");
requireText(main, "adminRoute && <AdminExperienceEnhancements />", "admin-only enhancements");
requireSingleOccurrence(main, "<AdminExperienceEnhancements />", "admin enhancement mount count");

const identityHook = read("src/hooks/useAdminManagerIdentity.ts");
forbidText(identityHook, "new MutationObserver", "manager identity observer");
forbidText(identityHook, "document.body", "manager identity document scan");

const formHook = read("src/hooks/useAdminFormKeyboardNavigation.ts");
requireText(formHook, 'const ADMIN_ROOT_SELECTOR = ".dn-admin-fullscreen"', "form admin scope");
forbidText(formHook, "observer.observe(document.body", "form document observer");
forbidText(formHook, "characterData: true", "form character observer");

const adminPanel = read("src/components/AdminPanelLuxury.tsx");
requireText(adminPanel, 'from "./admin/AbuKhalifaExecutiveCard"', "direct executive card import");
requireSingleOccurrence(adminPanel, "<AbuKhalifaExecutiveCard", "direct executive card render count");
requireText(adminPanel, "onNavigate={handleExecutiveAction}", "React-owned executive navigation");
forbidText(adminPanel, "function KhalifaPanel(", "legacy Khalifa component");
forbidText(adminPanel, "<KhalifaPanel", "legacy Khalifa render");
forbidText(adminPanel, "مساعد العمليات الذكي", "legacy assistant identity");
forbidText(adminPanel, "Smart Operations Assistant", "legacy assistant identity English");

const enhancements = read("src/components/admin/AdminExperienceEnhancements.tsx");
forbidText(enhancements, "AbuKhalifaExecutiveCardBridge", "executive bridge mount");
if (fs.existsSync(path.resolve(ROOT, "src/components/admin/AbuKhalifaExecutiveCardBridge.tsx"))) {
  throw new Error("executive bridge file must be deleted");
}

const executiveCard = read("src/components/admin/AbuKhalifaExecutiveCard.tsx");
requireText(executiveCard, 'data-testid="abu-khalifa-executive-card"', "executive card DOM contract");
requireText(executiveCard, 'data-testid="abu-khalifa-executive-launcher"', "executive launcher DOM contract");
requireText(executiveCard, 'import { fetchAdminStats } from "../../lib/adminData"', "executive runtime source");
requireText(executiveCard, "window.setInterval(requestRefresh, 60_000)", "executive metrics polling");
requireText(
  executiveCard,
  'window.addEventListener("dn-international-shipment-updated", requestRefresh)',
  "executive shipment refresh event",
);
requireText(
  executiveCard,
  'window.addEventListener("dn-admin-settings-change", requestRefresh)',
  "executive settings refresh event",
);
requireText(executiveCard, "window.innerWidth > 1280", "desktop sidebar breakpoint");
requireText(executiveCard, "window.innerWidth > 1100", "compact sidebar breakpoint");
requireText(executiveCard, "resolvedSidebarWidth", "responsive executive flyout offset");
forbidText(executiveCard, "new MutationObserver", "executive card mutation observer");
forbidText(executiveCard, "document.querySelector", "executive card DOM lookup");

const executiveCss = read("src/styles/abu-khalifa-executive-card.css");
forbidText(executiveCss, "dn-abu-khalifa-executive-host", "injected executive host CSS");
forbidText(executiveCss, "> :not(.dn-abu-khalifa-executive-host)", "legacy child hiding CSS");

const inp = read("src/hooks/useAdminInteractionPerformanceBudget.ts");
requireText(inp, "ADMIN_INP_BUDGET_MS = 200", "INP 200ms budget");
requireText(inp, 'observer.observe({ type: "event"', "INP browser event timing");

const orderValidation = readRepo("supabase/migrations/20260730094500_admin_order_authoritative_validation.sql");
for (const contract of [
  "admin_validate_order_payload",
  "dn_guard_admin_order_required_fields",
  "admin_order_validation_health",
  "admin_order_validation_failed",
]) requireText(orderValidation, contract, "admin order authority");

const legacyOrderGuard = readRepo("supabase/migrations/20260730101500_admin_order_legacy_insert_guard.sql");
for (const contract of [
  "v_admin_actor",
  "source_channel",
  "admin_order_validation_failed",
  "legacy direct inserts",
]) requireText(legacyOrderGuard, contract, "legacy admin order guard");

const financeHealth = readRepo("supabase/migrations/20260730095500_finance_authoritative_reconciliation_health.sql");
for (const contract of [
  "admin_finance_reconciliation_health",
  "admin_assert_authoritative_finance",
  "missing_settlement_rows",
  "missing_cod_rows",
  "missing_merchant_statement_rows",
  "missing_driver_statement_rows",
  "variance_zero",
  "authoritative_finance_required",
]) requireText(financeHealth, contract, "finance authority");

const internationalHealth = readRepo("supabase/migrations/20260730100500_international_tracking_runtime_health.sql");
for (const contract of [
  "international_tracking_runtime_health",
  "register-track17-shipment",
  "sync-track17-shipment",
  "track17-webhook",
  "TRACK17_API_KEY",
  "quota_fresh",
]) requireText(internationalHealth, contract, "international runtime health");

const runtimeRepair = readRepo("supabase/migrations/20260730114000_p1_runtime_reconciliation_repair.sql");
for (const contract of [
  "admin_reconcile_authoritative_finance",
  "order_financial_settlements",
  "cod_collections",
  "merchant_statement_entries",
  "driver_statement_entries",
  "api_unresolved_errors_last_24h",
  "Historical failures are retained",
]) requireText(runtimeRepair, contract, "P1 runtime reconciliation repair");
forbidText(runtimeRepair, "delete from public.track17_api_logs", "provider audit log deletion");
forbidText(runtimeRepair, "truncate", "runtime reconciliation destructive SQL");

const directFinanceBackfill = readRepo("supabase/migrations/20260730130000_p1_direct_finance_backfill.sql");
for (const contract of [
  "p1_finance_backfill_incomplete",
  "order_financial_settlements",
  "cod_collections",
  "merchant_statement_entries",
  "driver_statement_entries",
  "v_missing_settlements",
  "v_missing_cod",
  "v_missing_merchants",
  "v_missing_drivers",
]) requireText(directFinanceBackfill, contract, "direct authoritative finance backfill");
forbidText(directFinanceBackfill, "delete from", "direct finance backfill destructive delete");
forbidText(directFinanceBackfill, "truncate", "direct finance backfill destructive truncate");

const customerRuntimeE2E = read("scripts/customer-experience-runtime-e2e.mjs");
requireText(customerRuntimeE2E, 'admin.rpc("admin_dispatch_order_runtime"', "stable Customer Experience dispatch RPC");
requireText(customerRuntimeE2E, "p_payload", "stable Customer Experience dispatch payload");
forbidText(customerRuntimeE2E, 'admin.rpc("admin_dispatch_order",', "overloaded Customer Experience dispatch RPC");

const whatsapp = read("src/services/whatsappMessageService.ts");
requireText(whatsapp, '"generated" | "opened" | "copied" | "failed"', "WhatsApp proof states");
forbidText(whatsapp, 'OutboundMessageStatus = "delivered"', "unproven WhatsApp delivery state");

const whatsappSql = readRepo("supabase/migrations/20260723140000_smart_whatsapp_feedback_complaints.sql");
requireText(whatsappSql, "status in ('generated','opened','copied','failed')", "WhatsApp database proof states");
forbidText(whatsappSql, "status in ('generated','opened','copied','delivered'", "unproven WhatsApp database delivery state");

const driverLocation = read("src/hooks/useDriverLocation.ts");
requireText(driverLocation, "order controls remain available", "GPS non-blocking presence");
requireText(driverLocation, 'permissionRef.current === "denied"', "GPS retry suppression");
requireText(driverLocation, "يمكنك متابعة الطلب وتسجيل التسليم", "GPS Arabic guidance");

console.log("P1 PRODUCTION HARDENING GATE: PASS");
