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
const productionAudit = read("scripts/global-order-merchant-production-readonly-audit.mjs");

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
