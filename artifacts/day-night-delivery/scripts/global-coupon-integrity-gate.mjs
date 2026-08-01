import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDirectory, "..");
const repositoryRoot = path.resolve(appRoot, "../..");

const workspacePath = path.join(
  appRoot,
  "src/components/admin/AdminSectionWorkspaceComplete.tsx",
);
const financialOperationsPath = path.join(
  appRoot,
  "src/lib/orderFinancialOperations.ts",
);
const migrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20260801043000_global_coupon_uniqueness.sql",
);

const workspace = fs.readFileSync(workspacePath, "utf8");
const financialOperations = fs.readFileSync(financialOperationsPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

function extractBalancedBlock(source, marker, label) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${label}: marker not found.`);

  const openBraceIndex = source.indexOf("{", markerIndex);
  assert.notEqual(openBraceIndex, -1, `${label}: opening brace not found.`);

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(markerIndex, index + 1);
  }

  assert.fail(`${label}: closing brace not found.`);
}

const updateFinancialOperations = extractBalancedBlock(
  financialOperations,
  "export async function updateFinancialOpsOrder(",
  "updateFinancialOpsOrder",
);
const updateCouponPreflightBlock = extractBalancedBlock(
  updateFinancialOperations,
  "if (couponChanged) {",
  "update coupon preflight",
);
const updateErrorBlock = extractBalancedBlock(
  updateFinancialOperations,
  "if (error) {",
  "update error block",
);
const updateCouponRecoveryBlock = extractBalancedBlock(
  updateErrorBlock,
  "if (couponChanged) {",
  "update coupon recovery guard",
);
const updateErrorOutsideCouponRecovery = updateErrorBlock.replace(
  updateCouponRecoveryBlock,
  "",
);

assert.match(
  workspace,
  /"رقم التتبع"\s*:\s*"Tracking number"/,
  "Admin orders table must expose a dedicated tracking-number header.",
);
assert.match(
  workspace,
  /"رقم الكوبون"\s*:\s*"Coupon number"/,
  "Admin orders table must expose a dedicated coupon-number header.",
);
assert.doesNotMatch(
  workspace,
  /التتبع والكوبون|Tracking \/ coupon/,
  "Tracking and coupon must not be merged into one admin table column.",
);
assert.match(
  workspace,
  /couponCounts\.get\(couponKey\)/,
  "Historical duplicate coupons must be visibly flagged in the admin table.",
);
assert.match(
  workspace,
  /مكرر في البيانات الحالية/,
  "Arabic duplicate warning must remain visible.",
);

assert.match(
  financialOperations,
  /supabase\.rpc\("admin_find_coupon_conflict"/,
  "Financial order creation must preflight the authoritative coupon-conflict RPC.",
);
assert.match(
  financialOperations,
  /const existingConflict = await findCouponConflict\(input\.coupon_number\)/,
  "New financial orders must be checked before the create RPC is called.",
);
assert.match(
  financialOperations,
  /const conflict = await recoverCouponConflict\(input\.coupon_number\)/,
  "A masked database rejection must be followed by a conflict lookup for precise diagnostics.",
);
assert.match(
  financialOperations,
  /رقم الكوبون «\$\{coupon\}» مسجل بالفعل على الطلب \$\{tracking\} للتاجر \$\{merchant\}/,
  "The operator-facing error must identify coupon, existing order, and merchant.",
);
assert.match(
  financialOperations,
  /coupon_integrity_check_unavailable/,
  "Order entry must fail closed when the coupon integrity RPC is unavailable.",
);
assert.match(
  updateFinancialOperations,
  /normalizeCouponForComparison\(input\.coupon_number\)[\s\S]*normalizeCouponForComparison\(input\.order\.coupon_number\)/,
  "Coupon edits must compare normalized new and stored coupon identities.",
);
assert.match(
  updateCouponPreflightBlock,
  /findCouponConflict\(input\.coupon_number, excludeOrderId\)/,
  "Update preflight must run inside the couponChanged guard.",
);
assert.match(
  updateCouponRecoveryBlock,
  /recoverCouponConflict\(input\.coupon_number, excludeOrderId\)/,
  "Masked update errors must recover coupon conflicts inside the couponChanged guard.",
);
assert.doesNotMatch(
  updateErrorOutsideCouponRecovery,
  /recoverCouponConflict\(/,
  "Update error recovery must never classify an unchanged historical coupon as a duplicate.",
);
assert.match(
  updateErrorBlock,
  /throw operationError\(/,
  "Non-coupon update errors must retain their normal operation error path.",
);
assert.doesNotMatch(
  updateFinancialOperations,
  /const excludeOrderId = clean\(input\.order\.id\) \|\| null;\s*const existingConflict = await findCouponConflict/,
  "Historical duplicates must remain editable when their coupon number is unchanged.",
);

assert.match(
  migration,
  /create or replace function public\.normalized_order_coupon/,
  "Coupon comparison must use one canonical global normalizer.",
);
assert.match(
  migration,
  /idx_orders_coupon_global_lookup/,
  "A global normalized coupon lookup index is required.",
);
assert.match(
  migration,
  /pg_advisory_xact_lock\(hashtextextended\(v_coupon_key/,
  "Concurrent writes for the same coupon must be transaction-serialized.",
);
assert.match(
  migration,
  /where public\.normalized_order_coupon\(o\.coupon_number\) = v_coupon_key/,
  "Conflict lookup must search all orders globally.",
);
assert.doesNotMatch(
  migration,
  /where\s+o\.merchant_id\s*=\s*new\.merchant_id[\s\S]*normalized_order_coupon/,
  "Coupon uniqueness must not be scoped to one merchant.",
);
assert.match(
  migration,
  /errcode = '23505'/,
  "Duplicate coupons must be rejected as a database uniqueness violation.",
);
assert.match(
  migration,
  /رقم الكوبون «%s» مسجل بالفعل على الطلب %s للتاجر %s/,
  "The rejection must identify the existing order and merchant.",
);
assert.match(
  migration,
  /admin_find_coupon_conflict/,
  "Admin conflict lookup RPC must be present for precise diagnostics.",
);
assert.match(
  migration,
  /historical_rows_preserved', true/,
  "Historical duplicate shipments must be preserved rather than silently changed.",
);

console.log("PASS global coupon integrity gate");
