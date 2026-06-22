/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { Order } from "./types";
import { calculateLocalPrice, calculateInternationalPrice } from "./lib/pricing";

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL || "https://ngdwybpgacauorygoedi.supabase.co").trim();
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZHd5YnBnYWNhdW9yeWdvZWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NzQ0ODksImV4cCI6MjA5NzQ1MDQ4OX0.XnxcHmWfpcpV9P6FJY0riGE0BQfHWC-WsISywyle5KQ").trim();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fallback Local Storage keys to ensure seamless interactive state matching production
const LOCAL_STORAGE_KEY = "daynight_delivery_orders_state_v2";

export function getLocalOrders(): Order[] {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    // Generate initial sample orders with CORRECT high-fidelity prices (31.50 AED for main cities, 52.50 AED for remote)
    const initialOrders: Order[] = [
      {
        id: "DN-2026-89101",
        sender_name: "أحمد بن راشد",
        sender_phone: "+971501234567",
        sender_city: "أبوظبي",
        sender_address: "مصفح 40",
        receiver_name: "مروان المري",
        receiver_phone: "+971569876543",
        receiver_city: "دبي",
        receiver_address: "المرابع العربية",
        package_type: "Documents",
        weight: 0.5,
        pieces: 1,
        service_type: "express",
        delivery_price: 31.5, // Corrected price (31.50 AED incl. VAT)
        payment_method: "sender_pays",
        status: "Delivered",
        created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        status_history: [
          { status: "Pending", date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toLocaleString(), note: "تم إنشاء طلب التوصيل من العميل" },
          { status: "Confirmed", date: new Date(Date.now() - 2.8 * 24 * 3600 * 1000).toLocaleString(), note: "تم تأكيد البيانات والسعر من الإدارة" },
          { status: "Picked Up", date: new Date(Date.now() - 2.5 * 24 * 3600 * 1000).toLocaleString(), note: "تم استلام الشحنة بنجاح من الراسل" },
          { status: "In Transit", date: new Date(Date.now() - 2.2 * 24 * 3600 * 1000).toLocaleString(), note: "الشحنة في الطريق إلى مجمع دبي اللوجستي" },
          { status: "Out For Delivery", date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toLocaleString(), note: "الشحنة مع مندوب التوصيل النهائي" },
          { status: "Delivered", date: new Date(Date.now() - 1.9 * 24 * 3600 * 1000).toLocaleString(), note: "تم التسليم النهائي للعميل بنجاح" }
        ]
      },
      {
        id: "DN-2026-94025",
        sender_name: "متجر الياسمين الإلكتروني",
        sender_phone: "+971521112222",
        sender_city: "الشارقة",
        sender_address: "النهدة الشارقة",
        receiver_name: "سارة المرزوقي",
        receiver_phone: "+971542223333",
        receiver_city: "العين",
        receiver_address: "العين - الهيلي",
        package_type: "Perfumes",
        weight: 1.8,
        pieces: 2,
        service_type: "standard",
        delivery_price: 52.5, // Corrected Remote price (52.50 AED incl. VAT)
        payment_method: "cod",
        cod_amount: 350,
        status: "In Transit",
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        status_history: [
          { status: "Pending", date: new Date(Date.now() - 24 * 3600 * 1000).toLocaleString(), note: "تم استلام بيانات طلب التوصيل" },
          { status: "Confirmed", date: new Date(Date.now() - 22 * 3600 * 1000).toLocaleString(), note: "تم تأكيد طلب التوصيل بنجاح" },
          { status: "Assigned", date: new Date(Date.now() - 18 * 3600 * 1000).toLocaleString(), note: "تم تعيين السائق لاستلام الشحنة" },
          { status: "Picked Up", date: new Date(Date.now() - 15 * 3600 * 1000).toLocaleString(), note: "تم استلام الشحنة من مقر المتجر" },
          { status: "In Transit", date: new Date(Date.now() - 5 * 3600 * 1000).toLocaleString(), note: "الشحنة في طريقها لمدينة العين" }
        ]
      }
    ];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialOrders));
    return initialOrders;
  }
  return JSON.parse(data);
}

export function saveLocalOrders(orders: Order[]): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
}

// Supabase RPC callers with robust local fallbacks as defined in instructions

export async function calculateDeliveryPriceRpc(city: string, weight: number): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("calculate_delivery_price", { 
      p_city_name: city, 
      p_weight_kg: weight 
    });
    if (!error && data !== null) {
      return data;
    }
  } catch (e) {
    console.warn("RPC calculate_delivery_price not available, running fallback:", e);
  }
  return calculateLocalPrice(city, weight);
}

export async function calculateInternationalPriceRpc(destination: string, weight: number): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("calculate_international_price", {
      p_destination: destination,
      p_weight_kg: weight
    });
    if (!error && data !== null) {
      return data;
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
  } catch (e) {
    console.warn("RPC create_public_order not available, inserting via standard from tables:", e);
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
  const localOrders = getLocalOrders();
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetch output. Showing local orders database:", error.message);
      return localOrders;
    }

    if (data && data.length > 0) {
      // Merge with unique local orders to ensure responsive demo experience
      const supabaseOrders = data as Order[];
      const combined = [...supabaseOrders];
      localOrders.forEach(lo => {
        if (!combined.some(so => so.id === lo.id)) {
          combined.push(lo);
        }
      });
      return combined;
    }
  } catch (e) {
    console.error("Supabase integration error, utilizing local storage fallbacks:", e);
  }
  return localOrders;
}

export async function insertNewOrder(order: Order): Promise<boolean> {
  // Always save in localStorage first
  const localOrders = getLocalOrders();
  localOrders.unshift(order);
  saveLocalOrders(localOrders);

  // Attempt to submit via RPC first
  const rpcResult = await createPublicOrderRpc(order);
  if (rpcResult) {
    console.log("Successfully saved order via public RPC handler!");
    return true;
  }

  try {
    const { error } = await supabase
      .from("orders")
      .insert([order]);

    if (!error) {
      console.log("Successfully saved order in remote Supabase cloud!");
      return true;
    } else {
      console.warn("Save in remote cloud output error, kept in browser local storage:", error.message);
    }
  } catch (e) {
    console.error("Supabase insert failure, kept in fallback browser db:", e);
  }
  return true;
}

export async function updateExistingOrderStatus(orderId: string, status: Order["status"], note?: string): Promise<Order[] | null> {
  const localOrders = getLocalOrders();
  const index = localOrders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    const order = localOrders[index];
    order.status = status;
    const historyItem = {
      status,
      date: new Date().toLocaleString(),
      note: note || `تحديث حالة الشحنة إلى: ${status}`
    };
    if (!order.status_history) {
      order.status_history = [];
    }
    order.status_history.push(historyItem);
    localOrders[index] = order;
    saveLocalOrders(localOrders);
  }

  // Sync to database
  try {
    const orderToUpdate = localOrders.find(o => o.id === orderId);
    if (orderToUpdate) {
      const { error } = await supabase
        .from("orders")
        .update({ status: status, status_history: orderToUpdate.status_history })
        .eq("id", orderId);
      if (!error) {
        console.log("Successfully updated order status in Supabase!");
      }
    }
  } catch (e) {
    console.warn("Failed to synchronize updated state in remote cloud:", e);
  }

  return localOrders;
}
