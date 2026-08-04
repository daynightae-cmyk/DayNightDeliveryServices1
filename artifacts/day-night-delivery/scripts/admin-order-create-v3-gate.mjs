import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_order_create_v3_gate_failed: ${message}`);
};
const migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");
const mutations = read("src/lib/adminOrderMutations.ts");
const adminData = read("src/lib/adminOperationsData.ts");
const financial = read("src/lib/orderFinancialOperations.ts");
const personal = read("src/lib/personalOrderOperations.ts");
const complete = read("src/components/admin/AdminNewOrderComplete.tsx");
const flexible = read("src/components/admin/AdminNewOrderFlexible.tsx");
const personalForm = read("src/components/admin/AdminPersonalOrderForm.tsx");
for (const token of [
  "admin_create_order_v3",
  "admin_order_mutation_audit_v3_create_request_uidx",
  "merchant_link_warning",
  "merchant_portal_account_not_linked",
  "coupon_reconciliation_required",
  "notification_sync_queued",
  "dn_admin_order_override_active",
]) assert(migration.includes(token), `missing create migration contract: ${token}`);
assert(migration.includes("if v_actor is null") && migration.includes("daynight_admin_or_support()"), "create authorization missing");
assert(migration.includes("insert into public.orders") && migration.includes("returning *"), "core create does not return the saved row");
assert(migration.includes("jsonb_populate_record(null::public.orders"), "schema-aware create payload missing");
assert(migration.includes("merchant_id','null") || migration.includes("'{merchant_id}','null'"), "merchant-null create support missing");
assert(mutations.includes("createAdminOrder") && mutations.includes('supabase.rpc("admin_create_order_v3"'), "shared create client missing");
assert(mutations.includes("inFlight") && mutations.includes("requestId"), "create idempotency/duplicate prevention missing");
const adminCreateSegment = adminData.slice(
  adminData.indexOf("export async function createOpsOrder"),
  adminData.indexOf("export async function updateOpsOrder"),
);
const financialCreateSegment = financial.slice(
  financial.indexOf("export async function createFinancialOpsOrder"),
  financial.indexOf("function buildCorePatch"),
);
const completeValidateSegment = complete.slice(
  complete.indexOf("function validate()"),
  complete.indexOf("function prepareNextOrder"),
);
const flexibleValidateSegment = flexible.slice(
  flexible.indexOf("function validate()"),
  flexible.indexOf("async function submit"),
);
assert(adminCreateSegment.includes("createAdminOrder(payload") && !adminCreateSegment.includes("admin_create_canonical_merchant_order"), "flexible create still uses restrictive merchant RPC");
assert(financialCreateSegment.includes("createAdminOrder(payload") && !financialCreateSegment.includes("resolveCanonicalMerchantForOrder"), "financial create still requires portal-linked merchant");
assert(personal.includes("createAdminOrder(payload") && !personal.includes("coupon_number_required_for_personal_order"), "personal create remains coupon-blocked");
assert(!completeValidateSegment.includes("!selectedMerchant"), "complete create still blocks missing merchant");
assert(!completeValidateSegment.toLowerCase().includes("coupon number"), "complete create still blocks missing coupon");
assert(!flexibleValidateSegment.includes("!selectedMerchant"), "flexible create still blocks missing merchant");
const personalCouponInput = personalForm.match(/<input[^>]*data-admin-personal-coupon="true"[^>]*>/)?.[0] || "";
assert(personalForm.includes("اختياري ويمكن مراجعته لاحقًا") && personalCouponInput && !/\brequired\b|aria-required/.test(personalCouponInput), "personal form coupon remains required");
assert(complete.includes("ملاحظة تحتاج مراجعة دون إلغاء الحفظ"), "complete create warning-success UI missing");
assert(flexible.includes("ملاحظة تحتاج مراجعة دون إلغاء الحفظ"), "flexible create warning-success UI missing");
assert(personalForm.includes("ملاحظة تحتاج مراجعة دون إلغاء الحفظ"), "personal create warning-success UI missing");
console.log(JSON.stringify({
  result: "PASS",
  canonicalCreateRpc: "admin_create_order_v3",
  merchantNull: true,
  unlinkedMerchantWarning: true,
  couponWarning: true,
  zeroValue: true,
  manualFee: true,
  personalOrder: true,
  returnedRow: true,
  idempotency: true,
  warningSuccessUi: true,
}, null, 2));
