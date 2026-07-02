/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { Order, OrderStatusHistoryItem } from "./types";
import { calculateDomesticPrice, calculateInternationalPrice as calculateInternationalPriceLocal, calculateLocalPrice } from "./lib/pricing";

const EXPECTED_SUPABASE_URL = "https://ngdwybpgacauorygoedi.supabase.co";
const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in local environment variables.");
}

if (SUPABASE_URL && SUPABASE_URL !== EXPECTED_SUPABASE_URL) {
  console.error("Supabase URL is not the approved DAY NIGHT production project URL.");
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL === EXPECTED_SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export type PublicLiveMapOrder = {
  tracking_ref?: string | null;
  status?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type PublicLiveOperationsMap = {
  generated_at?: string | null;
  mode?: string | null;
  active_orders_count?: number | null;
  driver_count?: number | null;
  orders?: PublicLiveMapOrder[] | null;
};

function normalizePublicOrderPayload(payload: Record<string, unknown>) {
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

  return {
    ...payload,
    notes: notes || "N/A"
  };
}

function normalizeStatusNote(note?: string | null) {
  const clean = String(note || "").trim();
  return clean || "Admin status update";
}

async function getSignedInCustomerIdentity() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user?.id) return null;

    return {
      id: user.id,
      email: user.email || null,
      name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "").trim() || null
    };
  } catch {
    return null;
  }
}

async function withSignedInCustomer(payload: Record<string, unknown>) {
  const customer = await getSignedInCustomerIdentity();
  if (!customer?.id) return payload;

  return {
    ...payload,
    customer_id: typeof payload.customer_id === "string" && payload.customer_id ? payload.customer_id : customer.id,
    customer_email: typeof payload.customer_email === "string" && payload.customer_email ? payload.customer_email : customer.email,
    customer_name: typeof payload.customer_name === "string" && payload.customer_name ? payload.customer_name : customer.name
  };
}

export async function calculateDeliveryPrice(payload: {
  pickupCity?: string | null;
  deliveryCity?: string | null;
  weight?: number | string | null;
  serviceType?: string | null;
}): Promise<any> {
  if (!supabase) {
    return calculateDomesticPrice(payload);
  }

  const { data, error } = await supabase.rpc("calculate_delivery_price", {
    p_from_city: payload.pickupCity || null,
    p_to_city: payload.deliveryCity || null,
    p_weight_kg: Number(payload.weight) || 1
  });

  if (error) {
    console.warn("calculate_delivery_price RPC failed. Using local pricing engine.");
    return calculateDomesticPrice(payload);
  }

  return data;
}

export async function calculateDeliveryPriceRpc(city: string, weight: number): Promise<any> {
  if (!supabase) {
    return calculateLocalPrice(city, weight);
  }

  const { data, error } = await supabase.rpc("calculate_delivery_price", {
    p_city_name: city,
    p_weight_kg: weight
  });

  if (error) {
    console.warn("calculate_delivery_price(city, weight) RPC failed. Using local pricing engine.");
    return calculateLocalPrice(city, weight);
  }

  return data;
}

export async function calculateInternationalPrice(payload: {
  countryCode?: string | null;
  destination?: string | null;
  weight?: number | string | null;
}): Promise<any> {
  if (!supabase) {
    return calculateInternationalPriceLocal(payload);
  }

  const { data, error } = await supabase.rpc("calculate_international_price", {
    p_destination: payload.countryCode || payload.destination || null,
    p_weight_kg: Number(payload.weight) || 1
  });

  if (error) {
    console.warn("calculate_international_price RPC failed. Using local pricing engine.");
    return calculateInternationalPriceLocal(payload);
  }

  return data;
}

export async function calculateInternationalPriceRpc(destination: string, weight: number): Promise<any> {
  return calculateInternationalPrice({ destination, weight });
}

export async function createPublicOrder(payload: Record<string, unknown>): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const linkedPayload = await withSignedInCustomer(payload);
  const { data, error } = await supabase.rpc("create_public_order", {
    p_order_data: normalizePublicOrderPayload(linkedPayload)
  });

  if (error || data === null) {
    console.error("create_public_order failed. Order was not saved.");
    return null;
  }

  if (typeof data === "string") return data;
  return data.tracking_code || data.tracking_number || data.id || null;
}

export async function createPublicOrderRpc(payload: Record<string, unknown>): Promise<any> {
  if (!supabase) return null;

  const linkedPayload = await withSignedInCustomer(payload);
  const { data, error } = await supabase.rpc("create_public_order", {
    p_order_data: normalizePublicOrderPayload(linkedPayload)
  });

  if (error) {
    console.error("create_public_order RPC failed.");
    return null;
  }

  return data;
}

export async function trackOrder(trackingCode: string): Promise<any> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("track_order", {
    p_tracking_code: trackingCode
  });

  if (error) {
    console.error("track_order RPC failed.");
    return null;
  }

  return data;
}

export async function trackOrderRpc(trackingCode: string): Promise<any> {
  return trackOrder(trackingCode);
}

export async function searchChatbotAnswerRpc(queryText: string): Promise<any> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("search_chatbot_answer", {
    p_query: queryText
  });

  if (error) return null;
  return data;
}

export async function fetchPublicLiveOperationsMap(limit = 18): Promise<PublicLiveOperationsMap | null> {
  if (!supabase) return null;

  const safeLimit = Math.min(Math.max(Math.trunc(Number(limit) || 18), 1), 30);
  const { data, error } = await supabase.rpc("public_live_operations_map", {
    p_limit: safeLimit
  });

  if (error || !data || typeof data !== "object") {
    console.warn("public_live_operations_map RPC failed or is not installed.");
    return null;
  }

  return data as PublicLiveOperationsMap;
}

export async function fetchAllOrders(): Promise<Order[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch orders from Supabase.");
    return [];
  }

  return (data || []) as Order[];
}

export async function fetchCustomerOrders(customerId?: string | null): Promise<Order[]> {
  if (!supabase) return [];

  const customer = await getSignedInCustomerIdentity();
  const activeCustomerId = customerId || customer?.id;
  if (!activeCustomerId) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", activeCustomerId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.warn("Customer order fetch failed.");
    return [];
  }

  return (data || []) as Order[];
}

export async function fetchOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryItem[]> {
  if (!supabase || !orderId) return [];

  const { data, error } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    return [];
  }

  return (data || []) as OrderStatusHistoryItem[];
}

export async function insertNewOrder(orderData: Record<string, unknown>): Promise<string | null> {
  return createPublicOrder(orderData);
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

    return data?.role?.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

export async function updateExistingOrderStatus(orderId: string, status: string, note?: string): Promise<boolean> {
  if (!supabase || !orderId || !status) {
    return false;
  }

  const cleanNote = normalizeStatusNote(note);

  const rpcResult = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_note: cleanNote
  });

  if (!rpcResult.error && rpcResult.data) {
    return true;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("Order status update failed.");
    return false;
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    status,
    note: cleanNote,
    created_at: new Date().toISOString()
  });

  return true;
}
