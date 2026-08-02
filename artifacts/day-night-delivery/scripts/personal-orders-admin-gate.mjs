import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
let failed = false;
const read = (relative, repo = false) => {
  const file = path.resolve(repo ? root + "/../.." : root, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${relative}`);
    failed = true;
    return "";
  }
  return fs.readFileSync(file, "utf8");
};
const expect = (content, pattern, label) => {
  if (!pattern.test(content)) {
    console.error(`FAIL ${label}`);
    failed = true;
  } else console.log(`PASS ${label}`);
};
const reject = (content, pattern, label) => {
  if (pattern.test(content)) {
    console.error(`FAIL ${label}`);
    failed = true;
  } else console.log(`PASS ${label}`);
};

const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
expect(
  modal,
  /حفظ(?: كل)? التعديلات(?: الآن)?|حفظ واعتماد التعديلات|Save(?: all)? changes(?: now)?|Save and audit changes/,
  "edit modal has visible save action",
);
expect(
  modal,
  /h-\[(?:94|96)dvh\][\s\S]*max-h-\[(?:94|96)dvh\][\s\S]*overflow-hidden[\s\S]*min-h-0 flex-1 overflow-y-auto/,
  "edit modal is viewport constrained",
);
expect(modal, /personalOrder[\s\S]*merchant: personalOrder \? null/, "personal edit saves without merchant");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
expect(persistence, /isPersonalAdminOrder[\s\S]*personalFullPatch/, "personal edit persistence bypasses merchant requirement");
expect(persistence, /ORDERS_SCHEMA_COLUMN_RE/, "order edit recognizes missing PostgREST schema columns");
expect(persistence, /Retrying order edit without unavailable orders/, "order edit retries without unavailable optional columns");
expect(persistence, /coupon_number: clean\(input\.coupon_number\) \|\| null/, "personal edits persist optional coupon numbers");
const bulk = read("src/components/admin/AdminOrderBulkOperations.tsx");
expect(bulk, /تحديد الطلبات والتصدير الجماعي/, "bulk selector is generic and visible");
expect(bulk, /تصدير كل النتائج PDF/, "all visible results export exists");
expect(bulk, /<details[^>]+open>/, "order selector stays open");
reject(bulk, /طلبات التجار المحددة/, "bulk export is not merchant-only");
const workspace = read("src/components/admin/AdminSectionWorkspace.tsx");
expect(workspace, /sectionId=\{props\.id\}/, "bulk export receives section identity");
expect(workspace, /const workspaceOrders = filteredOrders/, "selection no longer hides unselected rows");
const unified = read("src/components/admin/AdminNewOrderComplete.tsx");
expect(unified, /PERSONAL_ORDER_OPTION = "__personal_order__"/, "new order defines personal purpose option");
expect(unified, /غرض شخصي — بدون تاجر/, "merchant selector exposes personal purpose");
expect(unified, /data-admin-unified-personal-order-entry="true"/, "personal form renders inside new-order route");
expect(unified, /AdminPersonalOrderForm/, "unified new-order route reuses protected personal save flow");
const personal = read("src/components/admin/AdminPersonalOrderForm.tsx");
expect(personal, /إنشاء طلب شخصي بدون تاجر/, "personal order form is present");
expect(personal, /25\.00 AED/, "personal order UI shows fixed 25 AED");
expect(personal, /رقم الكوبون \* — إجباري/, "personal coupon is visibly required");
expect(personal, /data-admin-personal-coupon="true"[\s\S]*required[\s\S]*aria-required="true"/, "personal coupon uses native required semantics");
expect(personal, /هاتف المرسل — اختياري/, "sender phone is explicitly optional");
expect(personal, /عنوان الاستلام التفصيلي — اختياري/, "detailed pickup address is explicitly optional");
expect(personal, /عنوان التسليم التفصيلي — اختياري/, "detailed delivery address is explicitly optional");
expect(personal, /ملاحظات الطلب — اختياري/, "personal notes are explicitly optional");
expect(personal, /data-admin-next-order-focus="true"/, "personal coupon uses global duplicate preflight");
expect(personal, /data-admin-personal-order-save="true"/, "personal save action is browser-testable");
expect(personal, /value: "Al Ain"[\s\S]*areas: AL_AIN_AREAS/, "Al Ain is a standalone top-level location");
expect(personal, /Al Jimi[\s\S]*Al Hili[\s\S]*Al Yahar[\s\S]*Al Wagan/, "Al Ain operational area list is populated");
const orderFinancials = read("src/lib/orderFinancials.ts");
expect(orderFinancials, /source_channel.*admin_personal_order/s, "personal financial display detects true personal orders");
expect(orderFinancials, /merchantDue: 0/, "personal financial display never creates merchant due");
const operations = read("src/lib/personalOrderOperations.ts");
expect(operations, /PERSONAL_ORDER_DELIVERY_FEE = 25/, "personal order runtime fixes fee at 25");
expect(operations, /merchant_id: null/, "personal order has no merchant linkage");
expect(operations, /coupon_number_required_for_personal_order/, "personal runtime rejects a missing coupon");
expect(operations, /if \(!senderName \|\| !receiverName \|\| !receiverPhone\)/, "personal runtime does not require sender phone");
expect(operations, /coupon_number: couponNumber/, "personal coupon is always stored in coupon_number");
expect(operations, /admin_create_personal_order/, "personal order uses protected RPC");
reject(operations, /\.from\(["']orders["']\)\.insert/, "personal order has no direct insert fallback");
const logic = read("src/lib/adminOrderLogic.ts");
expect(logic, /isPersonalAdminOrder/, "personal orders have explicit detection");
const registry = read("src/components/admin/AdminSectionRegistry.ts");
reject(registry, /cfg\("personal_orders"/, "standalone personal section is removed from registry");
const command = read("src/components/admin/command-center/AdminPanelCommandCenter.tsx");
reject(command, /id: "personal_orders"/, "standalone personal section is removed from command center");
const luxury = read("src/components/AdminPanelLuxury.tsx");
reject(luxury, /id: "personal_orders"/, "standalone personal section is removed from legacy sidebar");
const legacy = read("src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx");
reject(legacy, /id === "personal_orders"/, "standalone personal workspace is removed");
const migration = read("supabase/migrations/20260725043000_admin_personal_orders_fixed25.sql", true);
expect(migration, /admin_create_personal_order/, "personal order RPC migration exists");
expect(migration, /v_delivery numeric\(14,2\) := 25/, "database enforces 25 AED delivery");
expect(migration, /'merchant_id', null/, "database enforces null merchant");
const compatibilityMigration = read("supabase/migrations/20260725054500_orders_edit_schema_cache_compat.sql", true);
expect(compatibilityMigration, /add column if not exists manual_delivery_price/, "missing manual delivery column is restored");
expect(compatibilityMigration, /pg_notify\('pgrst', 'reload schema'\)/, "PostgREST schema cache is reloaded");
const fieldPolicyMigration = read("supabase/migrations/20260803023500_personal_order_required_coupon_optional_details.sql", true);
expect(fieldPolicyMigration, /coupon_number_required_for_personal_order/, "database RPC requires a personal-order coupon");
reject(fieldPolicyMigration, /message = 'sender_phone_required'/, "database RPC does not require sender phone");
expect(fieldPolicyMigration, /'sender_phone_required', false/, "runtime health marks sender phone optional");
expect(fieldPolicyMigration, /if v_policy_write and v_core_changed and v_coupon is null then/, "global coupon trigger also requires personal coupons");
expect(fieldPolicyMigration, /pg_advisory_xact_lock/, "required personal coupons remain globally duplicate protected");
if (failed) process.exit(1);
console.log("DAY NIGHT personal orders and admin controls gate PASSED");
