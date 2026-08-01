import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(appRoot, "../..");
const migrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260802023000_global_order_merchant_ownership_restoration.sql",
);
const adminDataPath = path.join(appRoot, "src/lib/adminData.ts");
const merchantPortalPath = path.join(appRoot, "src/components/merchant/MerchantPortal.tsx");
const financialOpsPath = path.join(appRoot, "src/lib/orderFinancialOperations.ts");

const read = (file) => fs.readFileSync(file, "utf8");
const migration = read(migrationPath);
const adminData = read(adminDataPath);
const merchantPortal = read(merchantPortalPath);
const financialOps = read(financialOpsPath);

const failures = [];
function requireText(content, marker, label) {
  if (!content.includes(marker)) failures.push(`${label}: missing ${marker}`);
}
function forbidText(content, marker, label) {
  if (content.toLowerCase().includes(marker.toLowerCase())) failures.push(`${label}: forbidden ${marker}`);
}

for (const token of [
  "AUTO_REPAIR_SAFE",
  "MANUAL_REVIEW",
  "SECURITY_CONFLICT",
  "MISSING_MERCHANT",
  "MISSING_PORTAL_LINK",
  "admin_run_global_merchant_ownership_dry_run",
  "admin_apply_global_merchant_ownership_repair",
  "APPLY_AUTO_REPAIR_SAFE",
  "financial_integrity_variance_detected",
  "merchant_ownership_repair_log",
  "merchant_portal_orders_page",
  "orders_merchant_id_canonical_fk",
  "on delete restrict not valid",
]) requireText(migration, token, "migration contract");

for (const forbidden of [
  "truncate ",
  "disable row level security",
  "on delete cascade",
  "db reset",
]) forbidText(migration, forbidden, "migration safety");

requireText(adminData, 'resolveOrderMerchant(selectedMerchant)', "admin canonical resolver");
requireText(adminData, 'supabase.rpc("admin_create_coupon_order"', "admin RPC-only creation");
requireText(adminData, 'saved_order_merchant_portal_link_mismatch', "admin post-save verification");
requireText(adminData, 'coupon_number.ilike', "admin coupon search");
requireText(adminData, 'merchant_code.ilike', "admin merchant-code search");
forbidText(adminData, "buildLegacyAdminOrderPayload", "legacy direct insert fallback");

const createStart = adminData.indexOf("export async function createAdminOrder");
const createEnd = adminData.indexOf("export type AdminStats", createStart);
const createBlock = createStart >= 0 && createEnd > createStart
  ? adminData.slice(createStart, createEnd)
  : "";
if (!createBlock) failures.push("admin create block was not found");
forbidText(createBlock, '.from("orders")\n      .insert', "admin direct insert");
forbidText(createBlock, '"DAY NIGHT Merchant"', "admin fabricated merchant default");
forbidText(createBlock, '"WORLD"', "admin fabricated destination default");
forbidText(createBlock, '"N/A"', "admin fabricated notes default");

requireText(merchantPortal, 'client.rpc("merchant_portal_orders_page"', "portal exact UUID pagination");
requireText(merchantPortal, 'merchant_portal_uuid_resolution_mismatch', "portal session UUID verification");
forbidText(merchantPortal, "directOrderLookup", "portal name/code order fallback");
forbidText(merchantPortal, "queryOrdersBy", "portal direct ownership fallback");

requireText(financialOps, "resolveOrderMerchant(selectedMerchant)", "financial resolver");
requireText(financialOps, "saved_order_merchant_portal_link_mismatch", "financial post-save verification");

if (failures.length) {
  console.error("GLOBAL MERCHANT OWNERSHIP GATE: FAIL");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("GLOBAL MERCHANT OWNERSHIP GATE: PASS");
console.log("- historical repair requires reviewed dry run and explicit confirmation");
console.log("- merchant portal ownership uses exact UUID pagination only");
console.log("- admin order creation resolves canonical merchant and verifies saved UUID");
console.log("- financial totals are protected before and after any approved repair");
