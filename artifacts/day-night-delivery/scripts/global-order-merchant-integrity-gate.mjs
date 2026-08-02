import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "../..");
const read = (relative, root = appRoot) =>
  fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");

const resolver = read("src/lib/orderMerchantResolver.ts");
const portalPages = read("src/lib/merchantPortalOrders.ts");
const portal = read("src/components/merchant/MerchantPortalCommandCenter.tsx");
const adminPanel = read("src/components/AdminPanelLuxury.tsx");
const merchantCard = read("src/components/AdminMerchantIntelligence.tsx");
const adminWorkspace = read("src/components/admin/AdminSectionWorkspace.tsx");
const creators = [
  read("src/lib/adminData.ts"),
  read("src/lib/adminOperationsData.ts"),
  read("src/lib/orderFinancialOperations.ts"),
];
const migration = read(
  "supabase/migrations/20260802023000_global_order_merchant_integrity_restoration.sql",
  repoRoot,
);
const dryRunTimeoutMigration = read(
  "supabase/migrations/20260802033000_order_merchant_dry_run_timeout.sql",
  repoRoot,
);
const unlinkedMerchantFinanceMigration = read(
  "supabase/migrations/20260802034000_financial_reconciliation_without_portal_link.sql",
  repoRoot,
);
const reviewedReconciliationMigration = read(
  "supabase/migrations/20260802035000_apply_reviewed_order_merchant_reconciliation.sql",
  repoRoot,
);
const customerE2eCleanupMigration = read(
  "supabase/migrations/20260802034500_customer_e2e_dependency_cleanup.sql",
  repoRoot,
);
const customerE2e = read("scripts/customer-experience-runtime-e2e.mjs");
const projectionBackfillGuardMigration = read(
  "supabase/migrations/20260802034700_defer_projection_during_merchant_backfill.sql",
  repoRoot,
);
const orderStatusCompatMigration = read(
  "supabase/migrations/20260802034800_order_status_snapshot_type_compat.sql",
  repoRoot,
);
const privilegedDbExecutorMigration = read(
  "supabase/migrations/20260802034900_privileged_db_reconciliation_executor.sql",
  repoRoot,
);
const productionAudit = read("scripts/global-order-merchant-production-readonly-audit.mjs");
const p1Workflow = read(".github/workflows/p1-runtime-evidence.yml", repoRoot);
const integrityWorkflow = read(
  ".github/workflows/global-order-merchant-integrity-production.yml",
  repoRoot,
);

assert.match(resolver, /resolveCanonicalMerchantForOrder/);
assert.match(resolver, /admin_resolve_order_merchant/);
assert.match(resolver, /verifySavedOrderMerchant/);
assert.match(resolver, /saved_order_merchant_id_mismatch/);
for (const source of creators) {
  assert.match(source, /resolveCanonicalMerchantForOrder/);
  assert.match(source, /admin_create_canonical_merchant_order/);
  assert.match(source, /verifySavedOrderMerchant/);
  assert.doesNotMatch(source, /admin_create_coupon_order/);
  assert.doesNotMatch(source, /createPublicOrder/);
  assert.doesNotMatch(source, /\.from\(["']orders["']\)\s*\.insert/);
}

assert.match(merchantCard, /onSearchOrders\(selected\.merchant\.id\)/);
assert.match(adminPanel, /setMerchantOrderScopeId/);
assert.match(adminWorkspace, /clean\(order\.merchant_id\) !== merchantFilterId/);
assert.doesNotMatch(adminWorkspace, /textContent|sessionStorage|fuzzy/i);

assert.match(portalPages, /merchant_portal_orders_page/);
assert.match(portalPages, /collected\.length !== expectedTotal/);
assert.match(portalPages, /merchant_orders_cross_owner_row_rejected/);
assert.match(portal, /fetchAllMerchantPortalOrders/);
assert.match(portal, /filter:`merchant_id=eq\.\$\{merchantId\}`/);
assert.match(portal, /merchant_profile_not_found/);
assert.doesNotMatch(portal, /merchant_portal_orders["']\s*,\s*\{p_limit:250\}/);

for (const token of [
  "dn_order_merchant_dry_run_live",
  "dn_merchant_identity_dry_run_live",
  "admin_run_order_merchant_dry_run",
  "admin_review_order_merchant_dry_run",
  "admin_apply_safe_merchant_portal_links",
  "admin_apply_order_merchant_safe_backfill",
  "admin_apply_safe_missing_financial_dependencies",
  "dn_project_delivered_order_dependencies",
  "dn_safe_uuid",
  "dn_safe_numeric",
  "trg_dn_project_delivered_order_dependencies",
  "AUTO_REPAIR_SAFE",
  "MANUAL_REVIEW",
  "SECURITY_CONFLICT",
  "MISSING_MERCHANT",
  "MISSING_PORTAL_LINK",
  "order_merchant_audit_snapshot",
  "order_merchant_repair_audit",
  "merchant_link_repair_audit",
  "order_merchant_financial_repair_audit",
  "financial_integrity_changed_backfill_rolled_back",
  "non_ownership_order_data_changed_backfill_rolled_back",
  "orders_merchant_id_legal_fk",
  "not valid",
]) assert.ok(migration.toLowerCase().includes(token.toLowerCase()), `migration contains ${token}`);

assert.match(migration, /lock table public\.orders in share row exclusive mode/i);
assert.match(migration, /lock table public\.merchants in share mode/i);
assert.match(migration, /lock table public\.merchant_user_links in share mode/i);
assert.match(migration, /perform set_config\('daynight\.order_merchant_reconciliation', 'backfill', true\)/i);
assert.match(migration, /old\.coupon_number|coupon_number is distinct from/i);
assert.match(migration, /old\.status|status is distinct from/i);
assert.match(migration, /EXACT_UNIQUE_CONFIRMED_AUTH_EMAIL/);
assert.match(migration, /EXACT_UNIQUE_CONFIRMED_AUTH_PHONE/);
assert.match(migration, /MISSING_AUTHORITATIVE_ROW_FROM_REVIEWED_ORDER_SNAPSHOT/);
assert.match(migration, /order_financial_values_changed_financial_repair_rolled_back/);
assert.match(migration, /future_financial_projection_ready/);
assert.match(migration, /Authoritative merchant statement projected from delivered order snapshot/);
assert.match(productionAudit, /financial_dependency_gap_rows/);
assert.match(productionAudit, /INSERT_MISSING_DEPENDENCY_FROM_UNCHANGED_ORDER_SNAPSHOT/);
assert.match(productionAudit, /ownership_classification/);
assert.match(migration, /'ALREADY_CORRECT','AUTO_REPAIR_SAFE','MISSING_PORTAL_LINK'/);
assert.doesNotMatch(migration, /^\s*(delete\s+from|truncate\s|drop\s+table).*$/gim);
assert.doesNotMatch(migration, /\bon delete cascade\b/i);
assert.doesNotMatch(
  migration,
  /is\s+distinct\s+from\s+case\b/i,
  "PL/pgSQL CASE operands for IS DISTINCT FROM must be parenthesized",
);
assert.match(
  dryRunTimeoutMigration,
  /alter\s+function\s+public\.admin_run_order_merchant_dry_run\(\)\s+set\s+statement_timeout\s*=\s*'120s'/i,
);
for (const workflow of [p1Workflow, integrityWorkflow]) {
  assert.match(workflow, /20260802033000_order_merchant_dry_run_timeout\.sql/);
  assert.match(workflow, /20260802034000_financial_reconciliation_without_portal_link\.sql/);
  assert.match(workflow, /20260802034500_customer_e2e_dependency_cleanup\.sql/);
  assert.match(workflow, /20260802034700_defer_projection_during_merchant_backfill\.sql/);
  assert.match(workflow, /20260802034800_order_status_snapshot_type_compat\.sql/);
  assert.match(workflow, /20260802034900_privileged_db_reconciliation_executor\.sql/);
  assert.match(workflow, /20260802035000_apply_reviewed_order_merchant_reconciliation\.sql/);
}
assert.match(unlinkedMerchantFinanceMigration, /pg_get_functiondef/);
assert.match(unlinkedMerchantFinanceMigration, /financial_reconciliation_eligibility_contract_not_found/);
assert.doesNotMatch(
  unlinkedMerchantFinanceMigration.match(/v_new text := \$new\$([\s\S]*?)\$new\$/)?.[1] || "",
  /dn_merchant_portal_link_count/,
);
assert.match(reviewedReconciliationMigration, /37348f9e-60d8-4f6b-8cdf-b9181464f2b7/);
assert.match(reviewedReconciliationMigration, /set local statement_timeout = '10min'/);
assert.match(reviewedReconciliationMigration, /request\.jwt\.claim\.role.*service_role/);
assert.match(reviewedReconciliationMigration, /request\.jwt\.claims.*service_role/);
assert.match(reviewedReconciliationMigration, /migration_privileged_session_required/);
assert.match(reviewedReconciliationMigration, /safe_order_repair_audit_count_%_expected_3/);
assert.match(reviewedReconciliationMigration, /merchant_statement_rows_inserted'[\s\S]*<> 43/);
assert.match(reviewedReconciliationMigration, /cod_rows_inserted'[\s\S]*<> 21/);
assert.match(reviewedReconciliationMigration, /driver_statement_rows_inserted'[\s\S]*<> 1/);
assert.match(reviewedReconciliationMigration, /post_reconciliation_financial_health_failed/);
assert.match(customerE2eCleanupMigration, /CUSTOMER_EXPERIENCE_E2E:%/);
assert.match(customerE2eCleanupMigration, /production_test_dependency_cleanup_audit/);
assert.match(customerE2eCleanupMigration, /customer_e2e_cleanup_changed_order_financial_integrity/);
assert.match(customerE2eCleanupMigration, /v_current - 'dependent_tables'/);
assert.match(customerE2eCleanupMigration, /missing_dependencies/);
assert.match(projectionBackfillGuardMigration, /pg_get_functiondef/);
assert.match(projectionBackfillGuardMigration, /daynight\.order_merchant_reconciliation/);
assert.match(projectionBackfillGuardMigration, /delivered_projection_backfill_guard_contract_not_found/);
assert.match(orderStatusCompatMigration, /v_order\.status::text is distinct from v_snapshot\.status::text/);
assert.match(orderStatusCompatMigration, /o\.status::text is distinct from s\.status::text/);
assert.match(orderStatusCompatMigration, /order_backfill_status_guard_contract_not_found/);
assert.match(orderStatusCompatMigration, /finance_backfill_status_guard_contract_not_found/);
assert.match(privilegedDbExecutorMigration, /session_user not in \('postgres', 'supabase_admin'\)/);
assert.match(privilegedDbExecutorMigration, /privileged_db_reconciliation_executor_contract_not_found/);
assert.match(privilegedDbExecutorMigration, /admin_apply_order_merchant_safe_backfill/);
assert.match(privilegedDbExecutorMigration, /admin_apply_safe_missing_financial_dependencies/);
for (const table of [
  "financial_account_entries",
  "cod_collections",
  "merchant_statement_entries",
  "driver_statement_entries",
  "order_financial_settlements",
]) {
  assert.match(customerE2e, new RegExp(`\\[\\"${table}\\", \\"order_id\\"`));
}
assert.match(customerE2e, /Notification cleanup failed/);
assert.equal((migration.match(/\$\$/g) || []).length % 2, 0, "balanced SQL dollar quotes");
assert.equal((migration.match(/\(/g) || []).length, (migration.match(/\)/g) || []).length, "balanced SQL parentheses");
assert.match(productionAudit, /order:\s*["']id\.asc["']/);
assert.match(productionAudit, /٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹/);
assert.match(productionAudit, /\[\^\\p\{L\}\\p\{N\}\]/);
for (const coupon of ["010505", "010503", "003860"]) assert.ok(productionAudit.includes(coupon));
assert.match(productionAudit, /DN-MER-SHOP-ILYTK/);
assert.match(productionAudit, /971501050516/);
assert.match(productionAudit, /DIAGNOSTIC_ONLY_NO_REASSIGNMENT/);

console.log("PASS global order/merchant ownership, visibility and integrity gate");
