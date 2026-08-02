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
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");

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
  persistence.includes('supabase.rpc("admin_update_order_complete_verified"'),
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
  modal.includes('data-admin-complete-order-reason="true"'),
  "required audit reason control missing",
);
assert(
  modal.includes('data-admin-complete-order-confirm="true"'),
  "explicit impact confirmation missing",
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
  modal.includes("رقم التتبع والفاتورة لا بيتغيروش"),
  "immutable order identity is not explained in the UI",
);
assert(
  modal.includes("العملية اتلغت بالكامل ومفيش تعديل جزئي"),
  "atomic rollback failure messaging missing",
);

console.log(
  JSON.stringify(
    {
      result: "PASS",
      completeRpc: true,
      canonicalMerchant: true,
      deliveredFinancialAudit: true,
      merchantEditableWhenPosted: true,
      completeBusinessFields: true,
      immutableIdentityProtected: true,
      beforeAfterAudit: true,
      atomicFailureMessage: true,
    },
    null,
    2,
  ),
);
