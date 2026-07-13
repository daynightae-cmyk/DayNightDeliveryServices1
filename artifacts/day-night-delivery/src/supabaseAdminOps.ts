import { supabase } from "./supabase";

function normalizeStatusNote(note?: string | null) {
  const clean = String(note || "").trim();
  return clean || "Admin status update";
}

export function normalizeAdminOrderStatus(status: string) {
  const raw = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    pending: "pending",
    waiting: "pending",
    review: "review",
    under_review: "review",
    confirmed: "confirmed",
    accepted: "confirmed",
    approved: "confirmed",
    assigned: "assigned",
    driver_assigned: "assigned",
    picked_up: "picked_up",
    pickup: "picked_up",
    collected: "picked_up",
    in_transit: "in_transit",
    transit: "in_transit",
    out_for_delivery: "in_transit",
    on_the_way: "in_transit",
    delivered: "delivered",
    complete: "delivered",
    completed: "delivered",
    postponed: "postponed",
    deferred: "postponed",
    scheduled: "postponed",
    returned: "returned",
    return: "returned",
    failed: "cancelled",
    cancelled: "cancelled",
    canceled: "cancelled"
  };
  return map[raw] || raw || "pending";
}

function buildStatusHistoryItem(status: string, note: string) {
  const now = new Date().toISOString();
  return { status, note, created_at: now, date: now, timestamp: now, changed_by: "admin" };
}

async function appendOrderStatusHistoryRow(orderId: string, status: string, note: string) {
  if (!supabase || !orderId) return;
  try {
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      status,
      note,
      created_at: new Date().toISOString()
    });
  } catch {
    // History table is optional in older databases. The orders row still carries status_history when available.
  }
}

export async function isAdminUser(userId: string): Promise<boolean> {
  if (!supabase || !userId) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error) {
      return false;
    }

    return String(data?.role || "").toLowerCase() === "admin";
  } catch {
    return false;
  }
}

export async function updateExistingOrderStatus(orderId: string, status: string, note?: string): Promise<boolean> {
  if (!supabase || !orderId || !status) {
    return false;
  }

  const cleanNote = normalizeStatusNote(note);
  const normalizedStatus = normalizeAdminOrderStatus(status);
  const updatedAt = new Date().toISOString();

  const rpcResult = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: normalizedStatus,
    p_note: cleanNote
  });

  if (!rpcResult.error && rpcResult.data) {
    return true;
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("status_history")
    .eq("id", orderId)
    .maybeSingle();

  const history = Array.isArray((existing as { status_history?: unknown[] } | null)?.status_history)
    ? [...(((existing as { status_history?: unknown[] }).status_history) || [])]
    : [];
  history.push(buildStatusHistoryItem(normalizedStatus, cleanNote));

  const modernUpdate = await supabase
    .from("orders")
    .update({
      status: normalizedStatus,
      status_history: history,
      updated_at: updatedAt
    })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (!modernUpdate.error) {
    await appendOrderStatusHistoryRow(orderId, normalizedStatus, cleanNote);
    return true;
  }

  const { error: legacyError } = await supabase
    .from("orders")
    .update({
      status: normalizedStatus,
      updated_at: updatedAt
    })
    .eq("id", orderId);

  if (legacyError) {
    console.error("Order status update failed:", legacyError.message, legacyError.details || "");
    return false;
  }

  await appendOrderStatusHistoryRow(orderId, normalizedStatus, cleanNote);
  return true;
}
