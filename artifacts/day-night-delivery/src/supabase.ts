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

function cleanText(value?: string | null) {
  return String(value || "").trim();
}

function normalizePhoneForMatching(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeOrderStatus(value?: unknown) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    pending: "pending",
    confirmed: "confirmed",
    assigned: "assigned",
    picked_up: "picked_up",
    pickup: "picked_up",
    in_transit: "in_transit",
    transit: "in_transit",
    delivered: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled"
  };
  return map[raw] || "pending";
}

function normalizeStatusHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
    return {
      ...row,
      status: normalizeOrderStatus(row.status),
      note: cleanText(String(row.note || "")) || "Admin status update"
    };
  });
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePublicOrderPayload(payload: Record<string, unknown>) {
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const status = normalizeOrderStatus(payload.status);

  return {
    ...payload,
    notes: notes || "N/A",
    status,
    status_history: normalizeStatusHistory(payload.status_history)
  };
}

function buildPublicOrderInsertPayload(payload: Record<string, unknown>) {
  const description = cleanText(String(payload.package_description || payload.package_type || "Local delivery item"));
  const createdAt = cleanText(String(payload.created_at || "")) || new Date().toISOString();
  const total = normalizeNumber(payload.total_price ?? payload.total ?? payload.delivery_price ?? payload.price ?? payload.amount, 30);

  const directPayload: Record<string, unknown> = {
    sender_name: cleanText(String(payload.sender_name || "")),
    sender_phone: cleanText(String(payload.sender_phone || "")),
    sender_city: cleanText(String(payload.sender_city || "")),
    sender_address: cleanText(String(payload.sender_address || "")),
    receiver_name: cleanText(String(payload.receiver_name || "")),
    receiver_phone: cleanText(String(payload.receiver_phone || "")),
    receiver_city: cleanText(String(payload.receiver_city || "")),
    receiver_address: cleanText(String(payload.receiver_address || "")),
    package_type: description,
    package_description: description,
    weight: normalizeNumber(payload.weight, 1) || 1,
    pieces: Math.max(1, Math.trunc(normalizeNumber(payload.pieces, 1) || 1)),
    service_type: cleanText(String(payload.service_type || "standard")) || "standard",
    payment_method: cleanText(String(payload.payment_method || "sender_pays")) || "sender_pays",
    cod_amount: payload.payment_method === "cod" ? normalizeNumber(payload.cod_amount, 0) : null,
    delivery_price: total,
    subtotal: normalizeNumber(payload.subtotal, total),
    base_price: normalizeNumber(payload.base_price, total),
    total,
    total_price: total,
    amount: total,
    price: total,
    currency: cleanText(String(payload.currency || "AED")) || "AED",
    source_domain: cleanText(String(payload.source_domain || "daynightae.com")) || "daynightae.com",
    notes: cleanText(String(payload.notes || "N/A")) || "N/A",
    status: normalizeOrderStatus(payload.status),
    created_at: createdAt,
    status_history: normalizeStatusHistory(payload.status_history)
  };

  for (const key of ["customer_id", "customer_email", "customer_phone", "customer_name"]) {
    if (typeof payload[key] === "string" && cleanText(payload[key] as string)) {
      directPayload[key] = cleanText(payload[key] as string);
    }
  }

  return directPayload;
}

function extractTrackingId(data: any): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  if (typeof row === "string") return row;
  return row.tracking_code || row.tracking_number || row.id || null;
}

async function getSignedInCustomerIdentity() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user?.id) return null;

    const metadata = user.user_metadata || {};
    const email = cleanText(user.email || (typeof metadata.email === "string" ? metadata.email : "")).toLowerCase() || null;
    const rawPhone = cleanText(user.phone || (typeof metadata.phone === "string" ? metadata.phone : "") || (typeof metadata.phone_number === "string" ? metadata.phone_number : ""));

    return {
      id: user.id,
      email,
      phone: rawPhone || null,
      phoneDigits: normalizePhoneForMatching(rawPhone) || null,
      name: cleanText(String(metadata.full_name || metadata.name || user.email || "")) || null
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
    customer_phone: typeof payload.customer_phone === "string" && payload.customer_phone ? payload.customer_phone : customer.phone,
    customer_name: typeof payload.customer_name === "string" && payload.customer_name ? payload.customer_name : customer.name
  };
}

function dedupeOrders(orders: Order[]) {
  const seen = new Set<string>();
  const output: Order[] = [];

  for (const order of orders) {
    const key = String(order.id || order.tracking_code || order.tracking_number || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(order);
  }

  return output.slice(0, 25);
}

async function fetchOrdersByColumn(column: string, value?: string | null, limit = 25): Promise<Order[]> {
  if (!supabase || !value) return [];

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq(column, value)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as Order[];
  } catch {
    return [];
  }
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

  const linkedPayload = normalizePublicOrderPayload(await withSignedInCustomer(payload));
  const safePayload = buildPublicOrderInsertPayload(linkedPayload);

  for (const candidate of [linkedPayload, safePayload]) {
    const { data, error } = await supabase.rpc("create_public_order", {
      p_order_data: candidate
    });

    if (!error && data !== null) {
      return extractTrackingId(data);
    }

    if (error) {
      console.error("create_public_order RPC failed:", error.message, error.details || "");
    }
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .insert(safePayload)
      .select("*")
      .single();

    if (!error && data) {
      return extractTrackingId(data);
    }

    if (error) {
      console.error("direct public order insert failed:", error.message, error.details || "");
    }
  } catch (error) {
    console.error("direct public order insert crashed:", error);
  }

  return null;
}

export async function createPublicOrderRpc(payload: Record<string, unknown>): Promise<any> {
  if (!supabase) return null;

  const linkedPayload = normalizePublicOrderPayload(await withSignedInCustomer(payload));
  const { data, error } = await supabase.rpc("create_public_order", {
    p_order_data: linkedPayload
  });

  if (error) {
    console.error("create_public_order RPC failed:", error.message, error.details || "");
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
  if (!activeCustomerId && !customer?.email && !customer?.phone) return [];

  const rpcResult = await supabase.rpc("public_customer_orders", { p_limit: 25 });
  if (!rpcResult.error && Array.isArray(rpcResult.data)) {
    return dedupeOrders(rpcResult.data as Order[]);
  }

  const directOrders: Order[] = [];

  if (activeCustomerId) {
    directOrders.push(...await fetchOrdersByColumn("customer_id", activeCustomerId));
  }

  if (directOrders.length) return dedupeOrders(directOrders);

  const email = customer?.email || "";
  for (const column of ["customer_email", "sender_email", "receiver_email", "email"]) {
    directOrders.push(...await fetchOrdersByColumn(column, email));
  }

  if (directOrders.length) return dedupeOrders(directOrders);

  const phoneCandidates = Array.from(new Set([customer?.phone, customer?.phoneDigits].filter(Boolean) as string[]));
  for (const phone of phoneCandidates) {
    for (const column of ["customer_phone", "sender_phone", "receiver_phone", "phone"]) {
      directOrders.push(...await fetchOrdersByColumn(column, phone));
    }
  }

  return dedupeOrders(directOrders);
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
