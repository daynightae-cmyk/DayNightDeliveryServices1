import { supabase } from "./supabase";
import { updateAdminOrderStatus } from "./lib/adminOrderMutations";

function normalizeStatusNote(note?: string | null) {
  const clean = String(note || "").trim();
  return clean || "Admin status update";
}

export function normalizeAdminOrderStatus(status: string) {
  const raw = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    pending: "pending",
    waiting: "pending",
    order_pending: "pending",
    قيد_الانتظار: "pending",
    انتظار: "pending",
    جديد: "pending",
    review: "review",
    under_review: "review",
    needs_review: "review",
    manual_review: "review",
    manual_approval: "review",
    hold: "review",
    قيد_المراجعة: "review",
    مراجعة: "review",
    تحتاج_قرار: "review",
    confirmed: "confirmed",
    accepted: "confirmed",
    approved: "confirmed",
    تم_التأكيد: "confirmed",
    تم_التاكيد: "confirmed",
    مؤكد: "confirmed",
    معتمد: "confirmed",
    assigned: "assigned",
    driver_assigned: "assigned",
    assign: "assigned",
    تم_تعيين_مندوب: "assigned",
    تعيين_مندوب: "assigned",
    picked_up: "picked_up",
    pickup: "picked_up",
    collected: "picked_up",
    collect: "picked_up",
    قيد_الإحضار: "picked_up",
    قيد_الاحضار: "picked_up",
    تم_الإحضار: "picked_up",
    تم_الاحضار: "picked_up",
    إحضار: "picked_up",
    احضار: "picked_up",
    in_transit: "in_transit",
    transit: "in_transit",
    out_for_delivery: "in_transit",
    on_the_way: "in_transit",
    في_الطريق: "in_transit",
    بالطريق: "in_transit",
    delivered: "delivered",
    order_delivered: "delivered",
    complete: "delivered",
    completed: "delivered",
    تم_التسليم: "delivered",
    مسلم: "delivered",
    تسليم: "delivered",
    postponed: "postponed",
    deferred: "postponed",
    scheduled: "postponed",
    later: "postponed",
    مؤجل: "postponed",
    مؤجلة: "postponed",
    تأجيل: "postponed",
    تاجيل: "postponed",
    returned: "returned",
    return: "returned",
    return_to_merchant: "returned",
    راجع: "returned",
    راجعة: "returned",
    مرتجع: "returned",
    مرتجعة: "returned",
    إرجاع: "returned",
    ارجاع: "returned",
    استرجاع: "returned",
    failed: "cancelled",
    cancelled: "cancelled",
    canceled: "cancelled",
    order_cancelled: "cancelled",
    ملغي: "cancelled",
    ملغية: "cancelled",
    إلغاء: "cancelled",
    الغاء: "cancelled",
    كنسل: "cancelled",
    مرفوض: "cancelled",
    رفض: "cancelled",
  };
  return map[raw] || raw || "pending";
}

export async function isAdminUser(userId: string): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (error) return false;
    return ["admin", "support", "super_admin", "owner"].includes(
      String(data?.role || "").toLowerCase(),
    );
  } catch {
    return false;
  }
}

/**
 * One canonical Admin status mutation. There is no legacy RPC chain and no direct
 * table fallback. Success is returned only after v3 returns the saved order row.
 * Optional merchant/coupon/finance/notification issues are warnings, not failure.
 */
export async function updateExistingOrderStatus(
  orderId: string,
  status: string,
  note?: string,
): Promise<boolean> {
  if (!orderId || !status) return false;
  const normalizedStatus = normalizeAdminOrderStatus(status);
  try {
    const result = await updateAdminOrderStatus(orderId, normalizedStatus, {
      note: normalizeStatusNote(note),
      sourcePage: "admin_quick_status",
    });
    window.dispatchEvent(
      new CustomEvent("dn-admin-orders-updated", {
        detail: {
          order: result.order,
          source: result.source,
          auditId: result.auditId,
          warnings: result.warnings,
          reconciliationRequired: result.reconciliationRequired,
          requestId: result.requestId,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("dn-admin-order-operation-result", {
        detail: {
          success: true,
          operation: "status",
          order: result.order,
          warnings: result.warnings,
          reconciliationRequired: result.reconciliationRequired,
        },
      }),
    );
    return normalizeAdminOrderStatus(String(result.order.status || "")) === normalizedStatus;
  } catch (error) {
    console.error("DAY NIGHT canonical Admin status update failed", error);
    return false;
  }
}
