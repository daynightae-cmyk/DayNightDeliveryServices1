import { supabase } from "./supabase";
import type { Order } from "./types";

export type AdminStatusUpdateErrorCode =
  | "missing_migration"
  | "permission"
  | "not_found"
  | "invalid_status"
  | "supabase_not_configured"
  | "unknown";

export class AdminStatusUpdateError extends Error {
  code: AdminStatusUpdateErrorCode;
  detail?: string;

  constructor(
    code: AdminStatusUpdateErrorCode,
    message: string,
    detail?: string,
  ) {
    super(message);
    this.name = "AdminStatusUpdateError";
    this.code = code;
    this.detail = detail;
  }
}

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
    new: "pending",
    waiting: "pending",
    order_pending: "pending",
    قيد_الانتظار: "pending",
    انتظار: "pending",
    جديد: "pending",
    طلب_جديد: "pending",
    review: "review",
    under_review: "review",
    needs_review: "review",
    manual_review: "review",
    manual_approval: "review",
    hold: "review",
    قيد_المراجعة: "review",
    مراجعة: "review",
    تحت_المراجعة: "review",
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
    معين: "assigned",
    تم_تعيين_مندوب: "assigned",
    تعيين_مندوب: "assigned",
    picked_up: "picked_up",
    pickup: "picked_up",
    collecting: "picked_up",
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
    on_route: "in_transit",
    on_the_way: "in_transit",
    في_الطريق: "in_transit",
    جاري_التوصيل: "in_transit",
    بالطريق: "in_transit",
    delivered: "delivered",
    order_delivered: "delivered",
    complete: "delivered",
    completed: "delivered",
    تم_التسليم: "delivered",
    مسلم: "delivered",
    تسليم: "delivered",
    postponed: "postponed",
    postpone: "postponed",
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
    cancel: "cancelled",
    order_cancelled: "cancelled",
    ملغي: "cancelled",
    ملغية: "cancelled",
    مكنسل: "cancelled",
    إلغاء: "cancelled",
    الغاء: "cancelled",
    كنسل: "cancelled",
    مرفوض: "cancelled",
    رفض: "cancelled",
  };
  return map[raw] || raw || "pending";
}

function classifyRpcError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}) {
  const message =
    `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
  const code = String(error.code || "").toLowerCase();
  if (
    code === "pgrst202" ||
    code === "42883" ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    (message.includes("function") && message.includes("does not exist"))
  ) {
    return new AdminStatusUpdateError(
      "missing_migration",
      "تحديث الحالة يحتاج تطبيق Migration في Supabase.",
      error.message,
    );
  }
  if (
    code === "42501" ||
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("admin/support")
  ) {
    return new AdminStatusUpdateError(
      "permission",
      "لا توجد صلاحية كافية لتحديث حالة الطلب في Supabase.",
      error.message,
    );
  }
  if (code === "p0002" || message.includes("order not found")) {
    return new AdminStatusUpdateError(
      "not_found",
      "لم يتم العثور على الطلب في Supabase.",
      error.message,
    );
  }
  if (code === "22023" || message.includes("unsupported order status")) {
    return new AdminStatusUpdateError(
      "invalid_status",
      "حالة الطلب غير مدعومة.",
      error.message,
    );
  }
  return new AdminStatusUpdateError(
    "unknown",
    "فشل تحديث الحالة في Supabase.",
    error.message,
  );
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
    return ["admin", "support"].includes(
      String(data?.role || "").toLowerCase(),
    );
  } catch {
    return false;
  }
}

export async function adminUpdateOrderStatus({
  orderRef,
  nextStatus,
  note,
}: {
  orderRef: string;
  nextStatus: string;
  note?: string;
}): Promise<Order> {
  if (!supabase) {
    throw new AdminStatusUpdateError(
      "supabase_not_configured",
      "Supabase غير مهيأ لتحديث حالة الطلب.",
    );
  }
  if (!orderRef || !nextStatus) {
    throw new AdminStatusUpdateError(
      "invalid_status",
      "مرجع الطلب والحالة مطلوبان.",
    );
  }

  const normalizedStatus = normalizeAdminOrderStatus(nextStatus);
  const { data, error } = await supabase.rpc("admin_update_order_status", {
    p_order_ref: orderRef,
    p_status: normalizedStatus,
    p_note: normalizeStatusNote(note),
  });

  if (error) throw classifyRpcError(error);
  if (!data || !(data as Order).id) {
    throw new AdminStatusUpdateError(
      "unknown",
      "لم يرجع Supabase صف الطلب المحدث.",
    );
  }

  return data as Order;
}

export async function updateExistingOrderStatus(
  orderId: string,
  status: string,
  note?: string,
): Promise<boolean> {
  await adminUpdateOrderStatus({ orderRef: orderId, nextStatus: status, note });
  return true;
}
