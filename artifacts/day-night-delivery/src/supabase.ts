/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { Order } from "./types";
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

function normalizePublicOrderPayload(payload: Record<string, unknown>) {
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

  return {
    ...payload,
    notes: notes || "N/A"
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

  const { data, error } = await supabase.rpc("create_public_order", {
    p_order_data: normalizePublicOrderPayload(payload)
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

  const { data, error } = await supabase.rpc("create_public_order", {
    p_order_data: normalizePublicOrderPayload(payload)
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

export async function updateExistingOrderStatus(orderId: string, status: Order["status"], note?: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_note: note || null
  });

  if (error || !data) {
    console.error("admin_update_order_status RPC failed.");
    return false;
  }

  return true;
}
