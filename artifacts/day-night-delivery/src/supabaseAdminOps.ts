import { supabase } from "./supabase";

function normalizeStatusNote(note?: string | null) {
  const clean = String(note || "").trim();
  return clean || "Admin status update";
}

function normalizeAdminOrderStatus(status: string) {
  const raw = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    pending: "pending",
    confirmed: "confirmed",
    accepted: "confirmed",
    assigned: "assigned",
    driver_assigned: "assigned",
    picked_up: "picked_up",
    pickup: "picked_up",
    in_transit: "in_transit",
    out_for_delivery: "in_transit",
    delivered: "delivered",
    failed: "cancelled",
    cancelled: "cancelled",
    canceled: "cancelled"
  };
  return map[raw] || "pending";
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

  const rpcResult = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: normalizedStatus,
    p_note: cleanNote
  });

  if (!rpcResult.error && rpcResult.data) {
    return true;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("Order status update failed:", updateError.message, updateError.details || "");
    return false;
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: normalizedStatus,
    note: cleanNote,
    created_at: new Date().toISOString()
  });

  return true;
}
