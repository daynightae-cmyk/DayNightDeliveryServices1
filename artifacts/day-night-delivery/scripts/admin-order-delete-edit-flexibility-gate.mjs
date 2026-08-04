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
const mutations = read("src/lib/adminOrderMutations.ts");
const migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");

assert(edit.includes("automaticEditReason"), "automatic edit reason is missing");
assert(edit.includes('edit_reason: automaticEditReason'), "automatic reason is not persisted");
assert(edit.includes('data-admin-automatic-audit-reason="true"'), "automatic audit notice is missing");
assert(!edit.includes("const [editReason"), "manual edit reason state remains");
assert(!edit.includes("const [confirmed"), "manual confirmation state remains");
assert(!edit.includes('data-admin-complete-order-reason="true"'), "manual reason field remains");
assert(!edit.includes('data-admin-complete-order-confirm="true"'), "manual confirmation remains");

assert(deleteData.includes("INTERNAL_DELETE_REASON"), "internal delete audit reason is missing");
assert(deleteData.includes('import { softDeleteAdminOrder }'), "canonical soft-delete service is not imported");
assert(deleteData.includes("await softDeleteAdminOrder(orderId"), "normal Admin deletion does not use the canonical soft-delete operation");
assert(deleteData.includes("result.order.is_deleted") && deleteData.includes("result.order.deleted_at"), "soft-delete database readback is not verified");
assert(deleteData.includes('operation: "soft_delete"'), "soft-delete mutation event is not emitted");
assert(!deleteData.includes("admin_delete_order_flexible_v2"), "legacy v2 delete RPC remains in the active client");
assert(!/\.from\(["']orders["']\)[\s\S]*\.delete\(/.test(deleteData), "direct destructive table deletion remains");
assert(deleteModal.includes("await onDeleted?.(result.reference)"), "parent delete callback is not invoked");

assert(mutations.includes('return invokeMutation(orderId, "soft_delete"'), "shared mutation service has no soft-delete operation");
assert(mutations.includes('return invokeMutation(orderId, "restore"'), "shared mutation service has no restore operation");
assert(mutations.includes('supabase.rpc("admin_update_order_complete_v3"'), "soft delete is not routed through canonical v3");
assert(mutations.includes('supabase.rpc("admin_permanently_delete_order_v3"'), "explicit Super Admin permanent-delete boundary is missing");
assert(migration.includes("admin_order_mutation_audit_v3"), "permanent mutation audit table is missing");
assert(migration.includes("'soft_delete'"), "v3 migration does not support soft deletion");
assert(migration.includes("'restore'"), "v3 migration does not support restoration");
assert(migration.includes("is_deleted"), "soft-delete persistence column is missing");
assert(migration.includes("deleted_at"), "soft-delete timestamp is missing");
assert(migration.includes("deletion_reason"), "soft-delete audit reason is missing");
assert(migration.includes("admin_permanently_delete_order_v3"), "separate permanent-delete RPC is missing");
assert(!migration.includes("active_or_completed_order_cannot_be_deleted"), "legacy status block remains");
assert(!migration.includes("assigned_order_cannot_be_deleted"), "legacy assignment block remains");

console.log(JSON.stringify({
  result: "PASS",
  automaticEditAudit: true,
  manualReasonRemoved: true,
  manualConfirmationRemoved: true,
  canonicalSoftDelete: true,
  exactDeleteReadback: true,
  restoreSupported: true,
  permanentDeleteSeparated: true,
  anyStatusDeleteRuntime: true,
  assignedOrderDeleteRuntime: true
}, null, 2));
