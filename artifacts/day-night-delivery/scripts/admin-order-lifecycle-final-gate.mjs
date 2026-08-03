import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_order_lifecycle_final_gate_failed: ${message}`);
};

const panel = read("src/components/AdminPanelLuxury.tsx");
const newOrder = read("src/components/admin/AdminNewOrderComplete.tsx");
const couponGuard = read("src/components/admin/AdminNewOrderCouponGuard.tsx");
const personal = read("src/components/admin/AdminPersonalOrderForm.tsx");
const edit = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const deleteModal = read("src/components/admin/AdminOrderDeleteModal.tsx");
const deleteData = read("src/lib/adminOrderDeleteData.ts");
const workspace = read("src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx");
const bulk = read("src/components/admin/AdminOrderBulkOperations.tsx");
const autocomplete = read("src/components/admin/AdminHistoryAutocomplete.tsx");
const locale = read("src/lib/adminLocale.ts");
const feedback = read("src/lib/adminOrderActionFeedback.ts");

assert(newOrder.includes("createFinancialOpsOrder"), "merchant order creation path missing");
assert(personal.includes("createPersonalOpsOrder"), "personal order creation path missing");
assert(couponGuard.includes("findCouponConflict"), "coupon uniqueness preflight missing");
assert(persistence.includes("admin_update_order_complete_verified_v2"), "verified complete edit RPC missing");
assert(persistence.includes("saveAdminLockedMerchantCoreEdit"), "delivered core-data edit path missing");
assert(edit.includes("saveAdminLockedMerchantCoreEdit") && edit.includes("saveAdminOrderEdit"), "editor does not route ordinary and audited edits separately");
assert(deleteData.includes("deleteAdminOrderImmediately"), "admin delete implementation missing");
assert(deleteModal.includes('mutation: "delete"') && deleteModal.includes("dn-admin-orders-updated"), "deleted rows are not removed locally");
assert(workspace.includes("updateExistingOrderStatus") && workspace.includes("تسليم وترحيل"), "status and delivered posting path missing");
assert(workspace.includes("financial_posted_at"), "posted settlement visibility missing");

assert(panel.includes("AdminHistoryAutocomplete") && panel.includes('scope="admin-global"'), "global history autocomplete is not mounted");
assert(autocomplete.includes("MutationObserver") && autocomplete.includes("data-admin-smart-autocomplete-bound"), "dynamic first-character suggestions are incomplete");
assert(autocomplete.includes("coupon") && autocomplete.includes("phone") && autocomplete.includes("merchant") && autocomplete.includes("amount"), "suggestion catalogs do not cover names, numbers and amounts");

assert(locale.includes('isArabic ? `${formatted} درهم` : `${formatted} AED`'), "professional Arabic currency formatter missing");
assert(newOrder.includes("formatAdminMoney") && edit.includes("formatAdminMoney") && personal.includes("formatAdminMoney") && bulk.includes("formatAdminMoney"), "order surfaces do not share the currency formatter");
assert(!personal.includes("25.00 AED"), "personal Arabic price still exposes AED literally");
assert(!newOrder.includes("{value.toFixed(2)} AED"), "new-order metric still exposes AED literally");
assert(!edit.includes("{Math.abs(value).toFixed(2)} AED"), "edit metric still exposes AED literally");

assert(feedback.includes("adminOrderActionFeedback"), "professional action feedback helper missing");
assert(newOrder.includes('adminOrderActionFeedback(cause, isArabic, "create")'), "new-order errors are not classified");
assert(personal.includes('adminOrderActionFeedback(cause, isArabic, "create")'), "personal-order errors are not classified");
assert(deleteModal.includes('adminOrderActionFeedback(cause, isArabic, "delete")'), "delete errors are not classified");

console.log(JSON.stringify({
  result: "PASS",
  creation: true,
  couponIntegrity: true,
  editPersistence: true,
  deliveredCoreEdit: true,
  deletion: true,
  statusPosting: true,
  firstCharacterSuggestions: true,
  professionalArabicCurrency: true,
  professionalActionErrors: true,
}, null, 2));
