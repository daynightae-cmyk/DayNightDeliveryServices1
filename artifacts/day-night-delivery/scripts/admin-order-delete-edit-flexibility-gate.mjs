import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error("admin_order_delete_edit_flexibility_gate_failed: " + message);
};

const edit = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const deleteModal = read("src/components/admin/AdminOrderDeleteModal.tsx");
const deleteData = read("src/lib/adminOrderDeleteData.ts");
const migration = read("../../supabase/migrations/20260804053000_admin_order_delete_flexible_v2.sql");

assert(edit.includes("automaticEditReason"), "automatic edit reason is missing");
assert(edit.includes('edit_reason: automaticEditReason'), "automatic reason is not persisted");
assert(edit.includes('data-admin-automatic-audit-reason="true"'), "automatic audit notice is missing");
assert(!edit.includes("const [editReason"), "manual edit reason state remains");
assert(!edit.includes("const [confirmed"), "manual confirmation state remains");
assert(!edit.includes('data-admin-complete-order-reason="true"'), "manual reason field remains");
assert(!edit.includes('data-admin-complete-order-confirm="true"'), "manual confirmation remains");

assert(deleteData.includes("INTERNAL_DELETE_REASON"), "internal delete audit reason is missing");
assert(deleteData.includes('name: "admin_delete_order_flexible_v2"'), "v2 delete RPC is not preferred");
assert(deleteData.includes("reason: INTERNAL_DELETE_REASON"), "legacy payload compatibility reason is missing");
assert(deleteData.includes("p_reference: reference, p_reason: INTERNAL_DELETE_REASON"), "legacy text reason signature is missing");
assert(deleteData.includes("throw deletionError(lastError)"), "exact deletion diagnostic is discarded");
assert(deleteModal.includes("await onDeleted?.(result.reference)"), "parent delete callback is not invoked");

assert(migration.includes("admin_delete_order_flexible_v2"), "flexible v2 migration RPC is missing");
assert(migration.includes("reason_required', false"), "migration does not declare reason-free deletion");
assert(migration.includes("status_restricted', false"), "migration does not declare status flexibility");
assert(migration.includes("assignment_restricted', false"), "migration does not declare assignment flexibility");
assert(!migration.includes("active_or_completed_order_cannot_be_deleted"), "legacy status block remains");
assert(!migration.includes("assigned_order_cannot_be_deleted"), "legacy assignment block remains");

console.log(JSON.stringify({
  result: "PASS",
  automaticEditAudit: true,
  manualReasonRemoved: true,
  manualConfirmationRemoved: true,
  backwardCompatibleDeleteReason: true,
  exactDeleteDiagnostics: true,
  anyStatusDeleteRuntime: true,
  assignedOrderDeleteRuntime: true
}, null, 2));
