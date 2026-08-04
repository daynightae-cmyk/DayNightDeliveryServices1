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
  "supabase/production-reconciliation/20260802035000_apply_reviewed_order_merchant_reconciliation.sql",
  repoRoot,
);
const statementEntryTypeMigration = read(
  "supabase/migrations/20260802035500_delivered_statement_entry_type_integrity.sql",
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
  assert.match(
    source,
    /admin_create_canonical_merchant_order|createAdminOrder/,
    "order creation must use either the legacy canonical merchant RPC or the unified Admin v3 mutation service",
  );
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
assert.match(migration, /set constraints all immediate/i);
assert.match(migration, /set constraints all deferred/i);
assert.match(migration, /returning\s+\*/i);
assert.match(dryRunTimeoutMigration, /statement_timeout/i);
assert.match(unlinkedMerchantFinanceMigration, /merchant_portal_account_not_linked/i);
assert.match(reviewedReconciliationMigration, /apply_reviewed/i);
assert.match(statementEntryTypeMigration, /entry_type/i);
assert.match(customerE2eCleanupMigration, /customer/i);
assert.match(customerE2e, /customer/i);
assert.match(projectionBackfillGuardMigration, /projection/i);
assert.match(orderStatusCompatMigration, /status/i);
assert.match(privilegedDbExecutorMigration, /security definer/i);
assert.match(productionAudit, /readonly|read-only/i);
assert.match(p1Workflow, /runtime/i);
assert.match(integrityWorkflow, /global-order-merchant/i);

console.log("global order merchant integrity gate passed");
