import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(appRoot, "../..");
const baseMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260802023000_global_order_merchant_ownership_restoration.sql",
);
const followupMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260802024000_global_order_merchant_ownership_followup.sql",
);
const adminDataPath = path.join(appRoot, "src/lib/adminData.ts");
const merchantPortalPath = path.join(appRoot, "src/components/merchant/MerchantPortal.tsx");
const financialOpsPath = path.join(appRoot, "src/lib/orderFinancialOperations.ts");
const runtimeAuditPath = path.join(appRoot, "scripts/global-merchant-ownership-runtime-audit.mjs");
const multiAccountPath = path.join(appRoot, "scripts/global-merchant-ownership-multi-account-e2e.mjs");
const productionAuditWorkflowPath = path.join(
  repoRoot,
  ".github/workflows/global-merchant-ownership-production-audit.yml",
);
const p1RuntimeWorkflowPath = path.join(repoRoot, ".github/workflows/p1-runtime-evidence.yml");

const read = (file) => fs.readFileSync(file, "utf8");
const baseMigration = read(baseMigrationPath);
const followupMigration = read(followupMigrationPath);
const allMigrations = `${baseMigration}\n${followupMigration}`;
const adminData = read(adminDataPath);
const merchantPortal = read(merchantPortalPath);
const financialOps = read(financialOpsPath);
const runtimeAudit = read(runtimeAuditPath);
const multiAccount = read(multiAccountPath);
const productionAuditWorkflow = read(productionAuditWorkflowPath);
const p1RuntimeWorkflow = read(p1RuntimeWorkflowPath);

const failures = [];
function requireText(content, marker, label) {
  if (!content.includes(marker)) failures.push(`${label}: missing ${marker}`);
}
function forbidText(content, marker, label) {
  if (content.toLowerCase().includes(marker.toLowerCase())) failures.push(`${label}: forbidden ${marker}`);
}
function sliceBetween(content, start, end, label) {
  const from = content.indexOf(start);
  const to = content.indexOf(end, from + start.length);
  if (from < 0 || to <= from) {
    failures.push(`${label}: block boundaries not found`);
    return "";
  }
  return content.slice(from, to);
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
]) requireText(baseMigration, token, "base migration contract");

for (const token of [
  "if tg_op = 'INSERT' then",
  "admin_merchant_identity_inventory",
  "admin_run_global_merchant_system_dry_run",
  "admin_apply_global_merchant_finance_reconciliation",
  "RECONCILE_MISSING_FINANCE_ROWS_FROM_REVIEWED_ORDER_SNAPSHOTS",
  "admin_reconcile_authoritative_finance",
  "order_financial_values_changed_during_reconciliation",
  "p_expected_merchant_code text default '1999'",
  "merchant_ownership_finance_reconciliation_log",
]) requireText(followupMigration, token, "follow-up migration contract");

for (const forbidden of [
  "truncate ",
  "disable row level security",
  "on delete cascade",
  "db reset",
  "db push --include-all",
]) forbidText(allMigrations, forbidden, "migration safety");

requireText(adminData, 'resolveOrderMerchant(selectedMerchant)', "admin canonical resolver");
requireText(adminData, 'supabase.rpc("admin_create_coupon_order"', "admin RPC-only creation");
requireText(adminData, 'saved_order_merchant_portal_link_mismatch', "admin post-save verification");
requireText(adminData, 'coupon_number.ilike', "admin coupon search");
requireText(adminData, 'merchant_code.ilike', "admin merchant-code search");
forbidText(adminData, "buildLegacyAdminOrderPayload", "legacy direct insert fallback");

const createBlock = sliceBetween(
  adminData,
  "export async function createAdminOrder",
  "export type AdminStats",
  "admin create",
);
forbidText(createBlock, '.from("orders")\n      .insert', "admin direct insert");
forbidText(createBlock, '"DAY NIGHT Merchant"', "admin fabricated merchant default");
forbidText(createBlock, '"WORLD"', "admin fabricated destination default");
forbidText(createBlock, '"N/A"', "admin fabricated notes default");

const statsBlock = sliceBetween(
  adminData,
  "export async function fetchAdminStats",
  "export async function updateOrderStatus",
  "admin statistics",
);
forbidText(statsBlock, "Promise.allSettled", "false-zero admin statistics");
requireText(statsBlock, "Promise.all([", "explicit admin statistics load failure");

requireText(merchantPortal, 'client.rpc("merchant_portal_orders_page"', "portal exact UUID pagination");
requireText(merchantPortal, "merchant_portal_uuid_resolution_mismatch", "portal session UUID verification");
requireText(merchantPortal, "Preserve the last successful rows", "portal load failure behavior");
forbidText(merchantPortal, "directOrderLookup", "portal name/code order fallback");
forbidText(merchantPortal, "queryOrdersBy", "portal direct ownership fallback");

requireText(financialOps, "resolveOrderMerchant(selectedMerchant)", "financial resolver");
requireText(financialOps, "saved_order_merchant_portal_link_mismatch", "financial post-save verification");

requireText(runtimeAudit, "signInWithPassword", "real-admin runtime audit");
requireText(runtimeAudit, "admin_run_global_merchant_system_dry_run", "combined system dry run");
requireText(runtimeAudit, 'p_expected_merchant_code: "1999"', "010505/1999 acceptance");
requireText(runtimeAudit, 'projectRef !== "ngdwybpgacauorygoedi"', "production project pin");
forbidText(runtimeAudit, "SUPABASE_SERVICE_ROLE_KEY", "runtime audit service-role bypass");
forbidText(runtimeAudit, "admin_apply_global_merchant_ownership_repair", "runtime audit ownership mutation");
forbidText(runtimeAudit, "admin_apply_global_merchant_finance_reconciliation", "runtime audit finance mutation");

requireText(multiAccount, "RUNTIME_MERCHANT_ACCOUNTS_JSON", "multi-account protected input");
requireText(multiAccount, 'supabase.rpc("merchant_portal_orders_page"', "multi-account exact UUID reads");
requireText(multiAccount, "cross_account_order_overlap: false", "cross-account overlap assertion");
requireText(multiAccount, "At least two protected merchant accounts", "multi-account minimum");
forbidText(multiAccount, "SUPABASE_SERVICE_ROLE_KEY", "multi-account service-role bypass");

requireText(productionAuditWorkflow, "workflow_dispatch", "trusted production audit trigger");
requireText(productionAuditWorkflow, "production-runtime-tests", "protected production environment");
requireText(productionAuditWorkflow, "RUNTIME_MERCHANT_ACCOUNTS_JSON", "multi-account workflow secret");
requireText(productionAuditWorkflow, "global-merchant-ownership-multi-account-e2e.mjs", "multi-account workflow execution");
forbidText(productionAuditWorkflow, "SUPABASE_SERVICE_ROLE_KEY", "production audit service-role bypass");
forbidText(productionAuditWorkflow, "pull_request:", "production audit PR trigger");

forbidText(p1RuntimeWorkflow, "pull_request:", "P1 production evidence PR trigger");
requireText(p1RuntimeWorkflow, 'project_ref" != "ngdwybpgacauorygoedi"', "P1 active production project pin");

if (failures.length) {
  console.error("GLOBAL MERCHANT OWNERSHIP GATE: FAIL");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("GLOBAL MERCHANT OWNERSHIP GATE: PASS");
console.log("- historical ownership and finance repairs require separate reviewed confirmations");
console.log("- merchant portal ownership uses exact UUID pagination only");
console.log("- admin creation resolves canonical merchant and verifies the persisted UUID");
console.log("- failed loads cannot become false empty/zero success");
console.log("- production evidence uses real admin and multiple merchant accounts, never service-role bypass");
console.log("- production project is pinned to ngdwybpgacauorygoedi");
