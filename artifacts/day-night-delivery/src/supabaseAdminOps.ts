import { supabase } from "./supabase";

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

type PersistedOrderRow = {
  id?: string | null;
  status?: unknown;
  status_history?: unknown;
  financial_posted_at?: unknown;
  goods_value?: unknown;
  delivery_fee?: unknown;
  discount_amount?: unknown;
  customer_total?: unknown;
  delivery_fee_mode?: unknown;
  payment_method?: unknown;
};

function buildStatusHistoryItem(status: string, note: string) {
  const now = new Date().toISOString();
  return {
    status,
    note,
    created_at: now,
    date: now,
    timestamp: now,
    changed_by: "admin",
  };
}

function asMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDeferredZeroMerchantOrder(row: PersistedOrderRow) {
  const mode = String(row.delivery_fee_mode || "").trim().toLowerCase();
  const payment = String(row.payment_method || "").trim().toLowerCase();
  return (
    (mode === "deduct_from_merchant" || payment === "sender_pays" || payment === "merchant_pays") &&
    asMoney(row.goods_value) === 0 &&
    asMoney(row.delivery_fee) === 0 &&
    asMoney(row.discount_amount) === 0 &&
    asMoney(row.customer_total) === 0
  );
}

function rpcConfirmsPersistence(data: unknown, expectedStatus: string) {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row || row.ok !== true) return false;
  return normalizeAdminOrderStatus(String(row.status || "")) === expectedStatus;
}

async function fetchPersistedOrder(orderId: string): Promise<PersistedOrderRow | null> {
  if (!supabase || !orderId) return null;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("Order status verification read failed:", error.message, error.details || "");
    return null;
  }
  return (data as PersistedOrderRow | null) || null;
}

function persistedStatusIsValid(row: PersistedOrderRow | null, expectedStatus: string) {
  if (!row || normalizeAdminOrderStatus(String(row.status || "")) !== expectedStatus) return false;
  if (expectedStatus !== "delivered") return true;

  // Delivered orders must also prove that the financial posting was completed.
  // The only exception is the intentional zero-value merchant order that waits
  // for the separate Accounts close action.
  if (isDeferredZeroMerchantOrder(row)) return true;
  return Boolean(row.financial_posted_at);
}

async function appendOrderStatusHistoryRow(
  orderId: string,
  status: string,
  note: string,
) {
  if (!supabase || !orderId) return;
  try {
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      status,
      note,
      created_at: new Date().toISOString(),
    });
  } catch {
    // The embedded orders.status_history value remains authoritative when the
    // optional normalized history table is unavailable in an older schema.
  }
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
    return String(data?.role || "").toLowerCase() === "admin";
  } catch {
    return false;
  }
}

/**
 * Persist an admin order-status change and verify it by reading the production
 * row back. A request is never reported as successful merely because Supabase
 * returned no error: zero affected rows, a blocked RLS update, a void RPC
 * response, or a failed delivery posting all return false.
 */
export async function updateExistingOrderStatus(
  orderId: string,
  status: string,
  note?: string,
): Promise<boolean> {
  if (!supabase || !orderId || !status) return false;

  const cleanNote = normalizeStatusNote(note);
  const normalizedStatus = normalizeAdminOrderStatus(status);
  const updatedAt = new Date().toISOString();
  const errors: string[] = [];

  // New authoritative RPC: updates by the exact UUID, returns a persisted row
  // contract, and confirms delivered financial posting in the same transaction.
  const verifiedRpc = await supabase.rpc("admin_update_order_status_verified", {
    p_order_id: orderId,
    p_status: normalizedStatus,
    p_note: cleanNote,
  });
  if (!verifiedRpc.error) {
    if (rpcConfirmsPersistence(verifiedRpc.data, normalizedStatus)) return true;
    const verifiedRow = await fetchPersistedOrder(orderId);
    if (persistedStatusIsValid(verifiedRow, normalizedStatus)) return true;
    errors.push("verified_rpc_returned_unconfirmed_state");
  } else {
    errors.push(`verified_rpc:${verifiedRpc.error.message}`);
  }

  // Compatibility with installations that have not applied the new migration.
  // A void/null RPC response is acceptable only after a real read-back proves it.
  const legacyRpc = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: normalizedStatus,
    p_note: cleanNote,
  });
  if (!legacyRpc.error) {
    const verifiedRow = await fetchPersistedOrder(orderId);
    if (persistedStatusIsValid(verifiedRow, normalizedStatus)) return true;
    errors.push("legacy_rpc_did_not_persist_or_post");
  } else {
    errors.push(`legacy_rpc:${legacyRpc.error.message}`);
  }

  // Exact-ID fallback for compatible databases. Unlike the previous code, this
  // requires a returned row and then performs a second read-back verification.
  const existing = await fetchPersistedOrder(orderId);
  if (!existing?.id) {
    console.error("Order status update failed: order not found or unreadable", orderId, errors);
    return false;
  }

  const history = Array.isArray(existing.status_history)
    ? [...existing.status_history]
    : [];
  history.push(buildStatusHistoryItem(normalizedStatus, cleanNote));

  const modernUpdate = await supabase
    .from("orders")
    .update({
      status: normalizedStatus,
      status_history: history,
      updated_at: updatedAt,
    })
    .eq("id", existing.id)
    .select("id,status,financial_posted_at,goods_value,delivery_fee,discount_amount,customer_total,delivery_fee_mode,payment_method")
    .maybeSingle();

  if (!modernUpdate.error && modernUpdate.data) {
    const verifiedRow = await fetchPersistedOrder(String(existing.id));
    if (persistedStatusIsValid(verifiedRow, normalizedStatus)) {
      await appendOrderStatusHistoryRow(String(existing.id), normalizedStatus, cleanNote);
      return true;
    }
    errors.push("direct_modern_update_readback_mismatch");
  } else if (modernUpdate.error) {
    errors.push(`direct_modern_update:${modernUpdate.error.message}`);
  } else {
    errors.push("direct_modern_update_affected_zero_rows");
  }

  const legacyUpdate = await supabase
    .from("orders")
    .update({ status: normalizedStatus, updated_at: updatedAt })
    .eq("id", existing.id)
    .select("id,status,financial_posted_at,goods_value,delivery_fee,discount_amount,customer_total,delivery_fee_mode,payment_method")
    .maybeSingle();

  if (!legacyUpdate.error && legacyUpdate.data) {
    const verifiedRow = await fetchPersistedOrder(String(existing.id));
    if (persistedStatusIsValid(verifiedRow, normalizedStatus)) {
      await appendOrderStatusHistoryRow(String(existing.id), normalizedStatus, cleanNote);
      return true;
    }
    errors.push("direct_legacy_update_readback_mismatch");
  } else if (legacyUpdate.error) {
    errors.push(`direct_legacy_update:${legacyUpdate.error.message}`);
  } else {
    errors.push("direct_legacy_update_affected_zero_rows");
  }

  console.error("Order status update was not persisted:", {
    orderId,
    requestedStatus: normalizedStatus,
    errors,
  });
  return false;
}
