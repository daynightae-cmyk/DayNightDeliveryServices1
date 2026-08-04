import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_complete_order_edit_gate_failed: ${message}`);
};

const migration = read(
  "../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql",
);
const service = read("src/lib/adminOrderMutations.ts");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");

assert(
  migration.includes("create or replace function public.admin_update_order_complete_v3"),
  "canonical complete-update v3 RPC missing",
);
assert(
  migration.includes("admin_order_mutation_audit_v3") &&
    migration.includes("before_data") &&
    migration.includes("after_data"),
  "before/after Admin audit evidence missing",
);
assert(
  migration.includes("dn_admin_order_override_active") &&
    migration.includes("when (not public.dn_admin_order_override_active())"),
  "authorized transaction-local trigger override missing",
);
assert(
  migration.includes("merchant_link_warning") &&
    migration.includes("merchant_portal_account_not_linked"),
  "missing merchant portal linkage is not converted to a warning",
);
assert(
  migration.includes("coupon_reconciliation_required"),
  "coupon conflicts are not returned as reconciliation warnings",
);
assert(
  migration.includes("financial_reconciliation_required") &&
    migration.includes("notification_sync_queued"),
  "secondary financial/notification work is not separated from the core save",
);
assert(
  migration.includes("- 'tracking_number'") &&
    migration.includes("- 'invoice_number'"),
  "immutable tracking/invoice protection missing",
);
assert(
  migration.includes("for update") &&
    migration.includes("admin_order_v3_update_affected_zero_rows"),
  "exact order lock/readback verification missing",
);
assert(
  migration.includes("grant execute on function public.admin_update_order_complete_v3(jsonb) to authenticated"),
  "authenticated Admin RPC grant missing",
);
assert(
  migration.includes("daynight_admin_or_support()"),
  "Admin/support authorization check missing",
);

assert(
  service.includes('supabase.rpc("admin_update_order_complete_v3"'),
  "shared frontend service does not call canonical v3 RPC",
);
assert(
  service.includes("inFlight") && service.includes("requestId"),
  "duplicate submission prevention or idempotency request ID missing",
);
assert(
  persistence.includes("updateAdminOrder") &&
    !persistence.includes("admin_update_order_complete_verified_v2") &&
    !persistence.includes(".from(\"orders\")"),
  "complete editor is not exclusively routed through the shared v3 mutation service",
);
assert(
  persistence.includes("warnings") &&
    persistence.includes("reconciliationRequired") &&
    persistence.includes("changedFields"),
  "complete editor does not expose saved-row audit and warning metadata",
);

assert(
  modal.includes('data-admin-complete-order-merchant="true"'),
  "professional merchant editor control missing",
);
assert(
  modal.includes('data-admin-complete-order-coupon="true"'),
  "coupon edit control missing",
);
assert(
  modal.includes('data-admin-order-v3-status="true"'),
  "Admin status correction selector is missing",
);
assert(
  modal.includes("saveAdminOrderEdit") &&
    !modal.includes("saveAdminLockedMerchantCoreEdit"),
  "editor still has split restrictive save routes",
);
assert(
  modal.includes("تم حفظ الطلب") &&
    modal.includes("ملاحظة تحتاج مراجعة") &&
    modal.includes("دون إلغاء الحفظ"),
  "non-blocking warning success language missing",
);
assert(
  modal.includes("warnings") && modal.includes("reconciliationRequired"),
  "warning metadata is not surfaced separately from core failure",
);
assert(
  modal.includes("window.setTimeout(onClose"),
  "modal does not close after confirmed core save",
);
assert(
  !modal.includes('data-admin-complete-order-reason="true"') &&
    !modal.includes('data-admin-complete-order-confirm="true"'),
  "manual reconciliation controls still block ordinary edits",
);
assert(
  !/required=\{!personalOrder\}|aria-required="true"/.test(modal),
  "merchant/coupon relationship fields remain blocking requirements",
);
assert(
  modal.includes("sender_name") && modal.includes("sender_phone") &&
    modal.includes("receiver_name") && modal.includes("receiver_phone"),
  "customer/sender identity fields are not editable",
);
assert(
  modal.includes("order_count") && modal.includes("weight") &&
    modal.includes("manual_delivery_price") && modal.includes("cod_amount"),
  "package and manual financial fields are not editable",
);
assert(
  modal.includes("لا يمكن تغيير رقم التتبع أو رقم الفاتورة من محرر البيانات"),
  "immutable order identity is not explained professionally in the UI",
);
assert(
  modal.includes("function professionalEditError") &&
    modal.includes('data-admin-order-error-card="true"') &&
    modal.includes("safeEditDiagnostic"),
  "professional exact core-error diagnostics are missing",
);

console.log(
  JSON.stringify(
    {
      result: "PASS",
      canonicalRpc: "admin_update_order_complete_v3",
      adminAuthorization: true,
      merchantLinkNonBlocking: true,
      couponNonBlocking: true,
      secondaryWarnings: true,
      exactRowReadback: true,
      unifiedFrontendMutation: true,
      duplicateSubmissionPrevention: true,
      statusCorrection: true,
      warningSuccessUi: true,
      closeAfterCoreSave: true,
    },
    null,
    2,
  ),
);
