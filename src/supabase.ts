/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { Order } from "./types";
import { calculateLocalPrice, calculateInternationalPrice } from "./lib/pricing";

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase config missing. Supabase RPC and tracking will be disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided.");
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Supabase RPC callers

export async function calculateDeliveryPriceRpc(city: string, weight: number): Promise<any> {
  if (!supabase) {
    return calculateLocalPrice(city, weight);
  }

  try {
    const { data, error } = await supabase.rpc("calculate_delivery_price", { 
      p_city_name: city, 
      p_weight_kg: weight 
    });
    if (!error && data !== null) {
      return data;
    }
    if (error) {
      console.warn("Supabase RPC calculate_delivery_price error, using fallback:", error);
    }
  } catch (e) {
    console.warn("RPC calculate_delivery_price not available, running fallback:", e);
  }
  return calculateLocalPrice(city, weight);
}

export async function calculateInternationalPriceRpc(destination: string, weight: number): Promise<any> {
  if (!supabase) {
    return calculateInternationalPrice(destination, weight);
  }

  try {
    const { data, error } = await supabase.rpc("calculate_international_price", {
      p_destination: destination,
      p_weight_kg: weight
    });
    if (!error && data !== null) {
      return data;
    }
    if (error) {
      console.warn("Supabase RPC calculate_international_price error, using fallback:", error);
    }
  } catch (e) {
    console.warn("RPC calculate_international_price not available, running fallback:", e);
  }
  return calculateInternationalPrice(destination, weight);
}

export async function createPublicOrderRpc(orderData: any): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("create_public_order", {
      p_order_data: orderData
    });
    if (!error && data !== null) {
      return data;
    }
    if (error) {
       console.error("Supabase RPC error create_public_order:", error);
    }
  } catch (e) {
    console.warn("RPC create_public_order not available:", e);
  }
  return null;
}

export async function trackOrderRpc(trackingCode: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("track_order", {
      p_tracking_code: trackingCode
    });
    if (!error && data !== null) {
      return data;
    }
    if (error) {
       console.error("Supabase RPC error track_order:", error);
    }
  } catch (e) {
    console.warn("RPC track_order not available:", e);
  }
  return null;
}

export async function searchChatbotAnswerRpc(queryText: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("search_chatbot_answer", {
      p_query: queryText
    });
    if (!error && data !== null) {
      return data;
    }
  } catch (e) {
    console.warn("RPC search_chatbot_answer not available:", e);
  }
  return null;
}

// Global Order Integration that talks directly to Supabase
export async function fetchAllOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch output error:", error);
      return [];
    }

    if (data && data.length > 0) {
      return data as Order[];
    }
  } catch (e) {
    console.error("Supabase fetch failure:", e);
  }
  return [];
}

export async function insertNewOrder(orderData: Partial<Order>): Promise<string | null> {
  // Attempt to submit via RPC first
  const rpcResult = await createPublicOrderRpc(orderData);
  if (rpcResult) {
    console.log("Successfully saved order via public RPC handler!");
    // The RPC might return just the string, or an object like { tracking_code: '...' } or { id: '...' }
    if (typeof rpcResult === 'string') return rpcResult;
    return rpcResult.tracking_code || rpcResult.id || rpcResult;
  }

  try {
    const { data: insertedData, error } = await supabase
      .from("orders")
      .insert([orderData])
      .select();

    if (!error && insertedData && insertedData.length > 0) {
      console.log("Successfully saved order in remote Supabase cloud!");
      return insertedData[0].id;
    } else {
      console.error("Save in remote cloud error:", error);
    }
  } catch (e) {
    console.error("Supabase insert failure:", e);
  }
  return null;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      // Fallback: check if the authenticated user has an admin email
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email?.toLowerCase();
      if (email === 'admin@daynight.ae' || email === 'admin@day-night.ae') {
        return true;
      }
      return false;
    }
    
    return data?.role?.toLowerCase() === 'admin';
  } catch (e) {
    console.error("Admin check failed", e);
    return false;
  }
}

export async function updateExistingOrderStatus(orderId: string, status: Order["status"], note?: string): Promise<boolean> {

  const historyItem = {
    status,
    date: new Date().toLocaleString(),
    note: note || `تحديث حالة الشحنة إلى: ${status}`
  };
  
  // Sync to database
  try {
    // First fetch the order to get the current history
    const { data: orderData, error: fetchError } = await supabase
      .from("orders")
      .select("status_history")
      .eq("id", orderId)
      .single();
      
    if (fetchError) {
      console.error("Failed to fetch order for update:", fetchError);
      return false;
    }
    
    const currentHistory = orderData?.status_history || [];
    const newHistory = [...currentHistory, historyItem];
    
    const { error } = await supabase
      .from("orders")
      .update({ status: status, status_history: newHistory })
      .eq("id", orderId);
      
    if (!error) {
      console.log("Successfully updated order status in Supabase!");
      return true;
    } else {
       console.error("Failed to update remote cloud order:", error);
    }
  } catch (e) {
    console.error("Failed to synchronize updated state in remote cloud:", e);
  }

  return false;
}
