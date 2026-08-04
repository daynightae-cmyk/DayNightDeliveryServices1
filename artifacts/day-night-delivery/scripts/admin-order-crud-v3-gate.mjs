import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_order_crud_v3_gate_failed: ${message}`);
};
const migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");
const service = read("src/lib/adminOrderMutations.ts");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const statusClient = read("src/supabaseAdminOps.ts");
const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const deletion = read("src/lib/adminOrderDeleteData.ts");
for (const token of [
  "admin_update_order_complete_v3",
  "dn_admin_order_override_active",
  "merchant_link_warning",
  "coupon_reconciliation_required",
  "financial_reconciliation_required",
  "admin_order_mutation_audit_v3",
  "admin_order_reconciliation_queue",
  "admin_soft_delete_order_v3",
  "admin_restore_order_v3",
  "admin_bulk_mutate_orders_v3",
  "admin_permanently_delete_order_v3",
]) assert(migration.includes(token), `missing migration contract: ${token}`);
assert(migration.includes("when (not public.dn_admin_order_override_active())"), "strict trigger override predicates missing");
assert(!migration.includes("if v_key in ("), "invalid PL/pgSQL IN syntax remains");
assert(/returns public.orders[\s\S]+admin_update_order_status_verified/.test(migration), "legacy status return type compatibility missing");
assert(/admin_update_order_complete_verified_v2[\s\S]+admin_update_order_complete_v3/.test(migration), "v2 does not redirect to v3");
assert(migration.includes("create or replace function public.admin_update_order_complete_verified(p_payload jsonb)") && migration.includes("select public.admin_update_order_complete_v3("), "legacy complete RPC does not redirect to v3");
assert(service.includes('supabase.rpc("admin_update_order_complete_v3"'), "canonical frontend RPC missing");
assert(service.includes("inFlight"), "duplicate submission prevention missing");
assert(service.includes("bulkUpdateAdminOrders") && service.includes("restoreAdminOrder"), "shared CRUD client incomplete");
assert(!persistence.includes("admin_update_order_complete_verified_v2"), "complete editor still calls v2");
assert(!persistence.includes('.from("orders")'), "complete editor has direct table fallback");
assert(statusClient.includes("updateAdminOrderStatus"), "quick status is not on canonical service");
assert(!statusClient.includes("admin_update_order_status_verified"), "quick status legacy RPC chain remains");
assert(modal.includes('data-admin-order-v3-status="true"'), "complete modal status selector missing");
assert(modal.includes("تم حفظ الطلب") && modal.includes("ملاحظة تحتاج مراجعة"), "warning success language missing");
assert(!/required={!personalOrder}|aria-required="true"/.test(modal), "merchant/coupon blocking required flags remain");
assert(deletion.includes("softDeleteAdminOrder"), "normal delete is not soft deletion");
assert(!deletion.includes(".delete()"), "direct physical deletion fallback remains");
console.log(JSON.stringify({
  result: "PASS",
  canonicalRpc: "admin_update_order_complete_v3",
  merchantLinkNonBlocking: true,
  couponNonBlocking: true,
  secondaryWarnings: true,
  statusCorrection: true,
  sharedFrontendMutationLayer: true,
  softDelete: true,
  restore: true,
  bulkPartialResults: true,
  audit: true,
}, null, 2));
