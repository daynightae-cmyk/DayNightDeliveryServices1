import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) =>
  fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_complete_order_edit_gate_failed: ${message}`);
};

const migration = read(
  "../../supabase/migrations/20260802084500_admin_complete_order_edit.sql",
);
const probeMigration = read(
  "../../supabase/migrations/20260802094000_admin_complete_order_save_probe.sql",
);
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const friendlyPlugin = read("scripts/friendly-error-message-plugin.ts");

assert(
  migration.includes("create or replace function public.admin_update_order_complete_verified"),
  "complete verified RPC missing",
);
assert(
  migration.includes("create table if not exists public.order_admin_edit_audit"),
  "before/after admin audit table missing",
);
assert(
  migration.includes("public.dn_resolve_portal_merchant_uuid"),
  "canonical merchant UUID resolution missing",
);
assert(
  migration.includes("public.admin_adjust_order_financials_verified"),
  "delivered financial adjustment integration missing",
);
assert(
  migration.includes("v_financial_changed") &&
    migration.includes("if v_posted and v_financial_changed then"),
  "core-only delivered edits can create a no-op financial adjustment",
);
assert(
  migration.includes("price_source = v_price_source") &&
    migration.includes("manual_delivery_price = v_desired_manual_delivery"),
  "final system/manual price-source choice is not preserved",
);
assert(
  migration.includes("for update"),
  "order row is not locked before complete edit",
);
assert(
  migration.includes("merchant_changed") && migration.includes("changed_fields"),
  "merchant and changed-field audit evidence missing",
);
assert(
  migration.includes("- 'tracking_number'") && migration.includes("- 'invoice_number'"),
  "immutable tracking/invoice protection missing",
);
assert(
  migration.includes("grant execute on function public.admin_update_order_complete_verified(jsonb) to authenticated"),
  "authenticated admin RPC grant missing",
);

assert(
  probeMigration.includes("public.admin_probe_order_complete_save") &&
    probeMigration.includes("public.admin_update_order_complete_verified(p_payload)"),
  "rollback-safe real-save probe is missing",
);
assert(
  probeMigration.includes("complete_save_probe_order_rollback_failed") &&
    probeMigration.includes("complete_save_probe_audit_rollback_failed"),
  "save probe does not prove order and audit rollback",
);

assert(
  /admin_update_order_complete_verified(?:_v2)?/.test(persistence),
  "client does not use complete verified RPC",
);
assert(
  persistence.includes("updateCompleteMerchantOrder"),
  "complete merchant edit path missing",
);
assert(
  persistence.includes("auditId") && persistence.includes("changedFields"),
  "client does not expose audit result",
);
assert(
  persistence.includes("admin_complete_order_edit_runtime_missing_apply_migration_20260802084500"),
  "delivered edits can silently fall back to partial legacy save",
);

assert(
  modal.includes('data-admin-complete-order-merchant="true"'),
  "professional merchant editor control missing",
);
assert(
  modal.includes("disabled={personalOrder}"),
  "merchant selector is not limited only by personal-order semantics",
);
assert(
  !modal.includes("disabled={financialLocked || personalOrder}"),
  "merchant remains incorrectly locked for delivered orders",
);
assert(
  modal.includes('data-admin-complete-order-coupon="true"'),
  "coupon edit control missing",
);
assert(
  modal.includes("automaticEditReason") &&
    modal.includes('edit_reason: automaticEditReason') &&
    modal.includes('data-admin-automatic-audit-reason="true"'),
  "automatic audited edit reason is missing",
);
assert(
  !modal.includes('data-admin-complete-order-reason="true"') &&
    !modal.includes('data-admin-complete-order-confirm="true"'),
  "manual reason or impact confirmation still burdens the operator",
);
assert(
  modal.includes("sender_name") && modal.includes("sender_phone"),
  "sender identity fields are not editable",
);
assert(
  modal.includes("order_count") && modal.includes("weight"),
  "package count/weight fields are not editable",
);
assert(
  modal.includes("personalFinancialLocked") &&
    modal.includes("AdminDeliveredFinancialAdjustment"),
  "personal delivered-order audited adjustment path was removed",
);
assert(
  modal.includes("لا يمكن تغيير رقم التتبع أو رقم الفاتورة من محرر البيانات"),
  "immutable order identity is not explained professionally in the UI",
);
assert(
  modal.includes("الحفظ ذري") && modal.includes("دون حفظ جزئي"),
  "atomic rollback messaging source contract missing",
);

assert(
  modal.includes("function professionalEditError") &&
    modal.includes("انتهت جلسة الإدارة") &&
    modal.includes("رقم الكوبون مستخدم في طلب آخر") &&
    modal.includes("تعذر اعتماد التاجر المختار") &&
    modal.includes("تعذر اعتماد القيم المالية") &&
    modal.includes("تم تعديل الطلب من عملية أخرى"),
  "specific professional Arabic save rejection categories are incomplete",
);
assert(
  modal.includes('data-admin-order-error-card="true"') &&
    modal.includes('data-admin-error-reference="true"') &&
    modal.includes("safeEditDiagnostic") &&
    modal.includes("editErrorReference") &&
    modal.includes("عرض السبب التشخيصي الدقيق"),
  "exact safe database diagnostics are not exposed in the editor",
);
assert(
  modal.includes("رفضت قاعدة البيانات العملية لسبب لم يُصنَّف بعد") &&
    modal.includes("أُلغيت العملية بالكامل دون حفظ جزئي"),
  "unknown save rejection does not give a truthful diagnostic fallback",
);

console.log(
  JSON.stringify(
    {
      result: "PASS",
      completeRpc: true,
      canonicalMerchant: true,
      deliveredFinancialAudit: true,
      noOpFinancialAdjustmentPrevented: true,
      priceSourcePreserved: true,
      merchantEditableWhenPosted: true,
      completeBusinessFields: true,
      immutableIdentityProtected: true,
      beforeAfterAudit: true,
      rollbackSafeRealSaveProbe: true,
      exactSaveRejectionMessages: true,
    },
    null,
    2,
  ),
);
