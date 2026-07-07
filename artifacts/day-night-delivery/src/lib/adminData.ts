import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";
import { calculateDomesticPrice, calculateInternationalPrice } from "./pricing";
import { createDayNightInvoiceNumber } from "./printableDocuments";

function clean(value?: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function merchantCode(seed?: string) {
  const suffix = clean(seed).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "SHOP";
  const serial = Date.now().toString(36).toUpperCase().slice(-5);
  return `DN-MER-${suffix}-${serial}`;
}

function removeEmptyUndefined<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

function isMissingSchemaError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "").toLowerCase();
  return message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("permission denied") ||
    message.includes("violates row-level security") ||
    message.includes("not_authorized");
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc(fn, args);
  if (!error && data) return data as T;

  if (error) {
    console.warn(`${fn} RPC failed. Falling back where possible:`, error.message);
  }
  return null;
}

export type MerchantInput = {
  trade_name: string;
  owner_name?: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  emirate?: string;
  city?: string;
  address?: string;
  pickup_address?: string;
  license_number?: string;
  trn?: string;
  tax_number?: string;
  logo_url?: string;
  bank_name?: string;
  iban?: string;
  settlement_cycle?: string;
  commission_type?: string;
  default_payment_method?: string;
  notes?: string;
  status?: string;
};

export type AdminOrderInput = {
  merchant?: Merchant | null;
  merchant_id?: string;
  merchant_name?: string;
  merchant_code?: string;
  coupon_number?: string;
  shipping_scope: "local" | "international";
  order_count: number;
  pickup_city: string;
  delivery_city: string;
  destination_country?: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_address?: string;
  delivery_address?: string;
  emirate?: string;
  city?: string;
  package_type: string;
  package_description?: string;
  weight?: number;
  payment_method: string;
  cod_amount?: number | string | null;
  delivery_fee?: number | string | null;
  notes?: string;
  status?: string;
};

export type AdminStats = {
  total: number;
  pending: number;
  in_transit: number;
  delivered: number;
  cancelled: number;
};

export function calculateOrderStats(orders: Array<Pick<Order, "status"> | Record<string, unknown>>): AdminStats {
  const stats: AdminStats = { total: orders.length, pending: 0, in_transit: 0, delivered: 0, cancelled: 0 };
  for (const order of orders) {
    const status = String((order as { status?: unknown }).status || "pending").toLowerCase().replace(/[\s-]+/g, "_");
    if (status.includes("cancel") || status.includes("fail")) stats.cancelled += 1;
    else if (status.includes("deliver") || status.includes("complete")) stats.delivered += 1;
    else if (status.includes("transit") || status.includes("out_for_delivery") || status.includes("pickup") || status.includes("assign")) stats.in_transit += 1;
    else stats.pending += 1;
  }
  return stats;
}

export async function fetchAdminStats(orders?: Order[]): Promise<AdminStats> {
  if (orders) return calculateOrderStats(orders);
  if (!supabase) return calculateOrderStats([]);

  const rpcStats = await callRpc<AdminStats>("admin_get_order_stats", {});
  if (rpcStats && typeof rpcStats.total === "number") return rpcStats;

  const fetched = await fetchAdminOrders();
  return calculateOrderStats(fetched);
}

export async function fetchAdminOrders(): Promise<Order[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("Failed to fetch admin orders:", error.message);
    return [];
  }
  return (data || []) as Order[];
}

export async function updateAdminOrderStatus(orderId: string, status: string): Promise<boolean> {
  if (!supabase || !orderId) return false;
  const rpcResult = await callRpc<boolean>("admin_update_order_status", { p_order_id: orderId, p_status: status, p_note: "Admin dashboard update" });
  if (rpcResult) return true;
  const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);
  return true;
}

export async function createInvoiceData(order: Order): Promise<Record<string, unknown>> {
  const payload = {
    order_id: order.id,
    invoice_number: order.invoice_number || createDayNightInvoiceNumber(order.id),
    amount: Number((order as any).total_price || (order as any).total || order.delivery_price || 0),
    currency: "AED",
    created_at: new Date().toISOString(),
  };
  if (!supabase) return payload;
  const rpcInvoice = await callRpc<Record<string, unknown>>("admin_create_invoice", { p_invoice: payload });
  return rpcInvoice || payload;
}

export async function fetchMerchants(): Promise<Merchant[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to fetch merchants:", error.message);
    return [];
  }

  return (data || []) as Merchant[];
}

export async function createMerchant(input: MerchantInput): Promise<Merchant> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const now = new Date().toISOString();
  const payload = removeEmptyUndefined({
    merchant_code: merchantCode(input.trade_name),
    trade_name: clean(input.trade_name),
    owner_name: clean(input.owner_name),
    phone: clean(input.phone),
    alt_phone: clean(input.alt_phone),
    email: clean(input.email).toLowerCase(),
    emirate: clean(input.emirate),
    city: clean(input.city),
    address: clean(input.address),
    pickup_address: clean(input.pickup_address || input.address),
    license_number: clean(input.license_number),
    trn: clean(input.trn || input.tax_number),
    tax_number: clean(input.tax_number || input.trn),
    logo_url: clean(input.logo_url),
    bank_name: clean(input.bank_name),
    iban: clean(input.iban),
    settlement_cycle: clean(input.settlement_cycle || "weekly"),
    commission_type: clean(input.commission_type || "fixed_delivery_fee"),
    default_payment_method: clean(input.default_payment_method || "sender_pays"),
    notes: clean(input.notes),
    status: clean(input.status || "active"),
    created_at: now,
    updated_at: now,
  });

  const rpcMerchant = await callRpc<Merchant>("admin_create_merchant", { p_merchant: payload });
  if (rpcMerchant?.id) return rpcMerchant;

  const { data, error } = await supabase
    .from("merchants")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Merchant;
}

export function calculateAdminOrderPrice(input: AdminOrderInput) {
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  if (input.shipping_scope === "international") {
    const intl = calculateInternationalPrice({ destination: input.destination_country || "WORLD", weight: numberValue(input.weight, 1) });
    return {
      unitPrice: intl.total,
      total: Number((intl.total * count).toFixed(2)),
      breakdown: [...intl.breakdown, `Admin order count: ${count} x ${intl.total.toFixed(2)} AED`],
      pricingCategory: intl.pricingCategory,
    };
  }

  const local = calculateDomesticPrice({ pickupCity: input.pickup_city, deliveryCity: input.delivery_city, pieces: count, serviceType: "standard" });
  return {
    unitPrice: count > 0 ? Number((local.total / count).toFixed(2)) : local.total,
    total: local.total,
    breakdown: local.breakdown,
    pricingCategory: local.pricingCategory,
  };
}

function buildLegacyAdminOrderPayload(payload: Record<string, unknown>) {
  const legacy = { ...payload };
  for (const key of [
    "invoice_number",
    "coupon_number",
    "merchant_id",
    "merchant_name",
    "merchant_code",
    "order_count",
    "shipping_scope",
    "destination_country",
    "source_channel",
    "package_description",
    "source_domain",
    "subtotal",
    "base_price",
    "total",
    "total_price",
    "amount",
    "price",
    "currency",
    "status_history",
  ]) {
    delete legacy[key];
  }
  return legacy;
}

export async function createAdminOrder(input: AdminOrderInput): Promise<Order> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const merchant = input.merchant || null;
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  const pricing = calculateAdminOrderPrice({ ...input, order_count: count });
  const createdAt = new Date().toISOString();
  const trackingSeed = clean(input.coupon_number) || `${merchant?.merchant_code || "ADMIN"}-${Date.now().toString(36)}`;
  const invoiceNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const senderName = clean(merchant?.trade_name || input.merchant_name || "DAY NIGHT Merchant");
  const senderPhone = clean(merchant?.phone || "971568757331");
  const senderCity = clean(merchant?.city || merchant?.emirate || input.pickup_city || input.emirate || "Abu Dhabi");
  const senderAddress = clean(input.pickup_address || merchant?.pickup_address || merchant?.address || senderCity);
  const description = clean(input.package_description || input.package_type || "Admin shipment");
  const paymentMethod = clean(input.payment_method || merchant?.default_payment_method || "sender_pays");
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || input.city || "Dubai");
  const deliveryWeight = isInternational ? Math.max(1, numberValue(input.weight, 1)) : 1;

  const payload: Record<string, unknown> = removeEmptyUndefined({
    invoice_number: invoiceNumber,
    coupon_number: clean(input.coupon_number),
    merchant_id: merchant?.id || clean(input.merchant_id) || null,
    merchant_name: senderName,
    merchant_code: merchant?.merchant_code || clean(input.merchant_code),
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? clean(input.destination_country || receiverCity || "WORLD") : null,
    source_channel: "admin_panel",
    source_domain: "daynightae.com",
    sender_name: senderName,
    sender_phone: senderPhone,
    sender_city: senderCity,
    sender_address: senderAddress,
    receiver_name: clean(input.receiver_name || input.customer_name),
    receiver_phone: clean(input.receiver_phone || input.customer_phone),
    receiver_city: receiverCity,
    receiver_address: clean(input.receiver_address || input.delivery_address),
    package_type: description,
    package_description: description,
    weight: deliveryWeight,
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? Math.max(0, numberValue(input.cod_amount, 0)) : null,
    delivery_price: Number(input.delivery_fee || 0) > 0 ? numberValue(input.delivery_fee, pricing.total) : pricing.total,
    subtotal: pricing.total,
    base_price: pricing.total,
    total: pricing.total,
    total_price: pricing.total,
    amount: pricing.total,
    price: pricing.total,
    currency: "AED",
    notes: clean(input.notes) || "N/A",
    status: clean(input.status || "pending"),
    created_at: createdAt,
    updated_at: createdAt,
    status_history: [{ status: clean(input.status || "pending"), date: createdAt, note: "Created from DAY NIGHT admin merchant operations hub" }],
  });

  const rpcOrder = await callRpc<Order>("admin_create_coupon_order", { p_order: payload });
  if (rpcOrder?.id || rpcOrder?.invoice_number) return rpcOrder;

  for (const candidate of [payload, buildLegacyAdminOrderPayload(payload)]) {
    const { data, error } = await supabase
      .from("orders")
      .insert(candidate)
      .select("*")
      .single();

    if (!error && data) return data as Order;
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    if (error) console.warn("Admin order insert fallback failed:", error.message);
  }

  throw new Error("Order could not be created. Confirm the admin SQL migration was applied and the signed-in user has admin/support role.");
}
