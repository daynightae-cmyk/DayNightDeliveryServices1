import type { Order } from "../types";
import { softDeleteAdminOrder } from "./adminOrderMutations";

export type AdminOrderDeleteResult = {
  deleted: boolean;
  reference: string;
  source: "rpc";
  softDeleted: true;
  warnings: Array<{ code: string; [key: string]: unknown }>;
  reconciliationRequired: boolean;
};

const INTERNAL_DELETE_REASON =
  "Automatic audited soft deletion from DAY NIGHT admin order manager";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function orderReference(order: Order) {
  return clean(
    order.tracking_number ||
      order.invoice_number ||
      order.coupon_number ||
      order.id,
  );
}

/**
 * The normal Admin Delete button is archive/soft-delete only. It never removes
 * the order row, status history, financial evidence, coupon reference or audit.
 * Permanent deletion is exposed separately through the Super Admin v3 contract.
 */
export async function deleteAdminOrderImmediately(
  order: Order,
): Promise<AdminOrderDeleteResult> {
  const orderId = clean(order.id);
  const reference = orderReference(order);
  if (!orderId) throw new Error("order_id_required_for_soft_delete");

  const result = await softDeleteAdminOrder(orderId, {
    reason: INTERNAL_DELETE_REASON,
    sourcePage: "admin_order_manager",
  });

  if (!result.order.is_deleted && !result.order.deleted_at) {
    throw new Error("admin_soft_delete_readback_not_confirmed");
  }

  window.dispatchEvent(
    new CustomEvent("dn-admin-orders-updated", {
      detail: {
        order: result.order,
        operation: "soft_delete",
        source: result.source,
        auditId: result.auditId,
        warnings: result.warnings,
        reconciliationRequired: result.reconciliationRequired,
      },
    }),
  );

  return {
    deleted: true,
    reference,
    source: "rpc",
    softDeleted: true,
    warnings: result.warnings,
    reconciliationRequired: result.reconciliationRequired,
  };
}
