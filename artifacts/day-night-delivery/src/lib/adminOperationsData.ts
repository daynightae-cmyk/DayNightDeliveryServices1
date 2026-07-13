import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";
import { calculateDomesticPrice, calculateInternationalPrice } from "./pricing";
import { createDayNightInvoiceNumber } from "./printableDocuments";

export type OpsDataSource = "rpc" | "db";

export type OpsMerchantInput = {
  trade_name: string;
  owner_name?: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  emirate?: string;
  city?: string;
  area?: string;
  street_details?: string;
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

export type OpsOrderInput = {
  merchant?: Merchant | null;
  merchant_id?: string;
  merchant_name?: string;
  merchant_code?: string;
  coupon_number?: string;
  shipping_scope: "local" | "international";
  order_count: number;
  pickup_city: string;
  pickup_area?: string;
  pickup_street?: string;
  delivery_city: string;
  delivery_area?: string;
  delivery_street?: string;
  destination_country?: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  package_type: string;
  package_description?: string;
  weight?: number;
  payment_method: string;
  cod_amount?: number | string | null;
  notes?: string;
  status?: string;
};

export type OpsCreateResult<T> = { row: T; source: OpsDataSource };
export type OpsSnapshot = { merchants: Merchant[]; orders: Order[]; source: OpsDataSource };

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function removeEmptyUndefined<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ""),
  ) as T;
}

function merchantCode(seed?: string) {
  const suffix = clean(seed).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "SHOP";
  const serial = Date.now().toString(36).toUpperCase().slice(-5);
  return `DN-MER-${suffix}-${serial}`;
}

function composeLocationAddress(parts: Array<string | undefined | null>) {
  return parts.map(clean).filter(Boolean).join(" - ");
}

function operationsError(error: unknown, fallback: string) {
  const detail = String((error as { message?: string })?.message || error || "");
  if (detail) console.warn("Admin operations DB detail:", detail);
  return new Error(fallback);
}

async function rpcOne<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(`${fn} unavailable, using direct database operation when possible:`, error.message);
    return null;
  }
  if (Array.isArray(data)) return (data[0] || null) as T | null;
  return (data || null) as T | null;
}

export async function fetchOpsMerchants(): Promise<Merchant[]> {
  if (!supabase) throw operationsError(null, "Supabase is not configured for merchant operations.");
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw operationsError(error, "Merchants table is not ready. Apply the admin operations migration.");
  return (data || []) as Merchant[];
}

export async function fetchOpsOrders(limit = 1000): Promise<Order[]> {
  if (!supabase) throw operationsError(null, "Supabase is not configured for order operations.");
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw operationsError(error, "Orders table is not ready. Apply the admin operations migration.");
  return (data || []) as Order[];
}

export async function fetchOpsSnapshot(): Promise<OpsSnapshot> {
  const [merchants, orders] = await Promise.all([fetchOpsMerchants(), fetchOpsOrders()]);
  return { merchants, orders, source: "db" };
}

export async function createOpsMerchant(input: OpsMerchantInput): Promise<OpsCreateResult<Merchant>> {
  if (!supabase) throw operationsError(null, "Supabase is not configured for merchant operations.");
  const now = new Date().toISOString();
  const emirate = clean(input.emirate || "Abu Dhabi");
  const area = clean(input.area || input.city || emirate);
  const address = composeLocationAddress([area, input.street_details, input.address]);
  const pickupAddress = composeLocationAddress([area, input.street_details, input.pickup_address || input.address]);
  const payload = removeEmptyUndefined({
    merchant_code: merchantCode(input.trade_name),
    trade_name: clean(input.trade_name),
    owner_name: clean(input.owner_name),
    phone: clean(input.phone),
    alt_phone: clean(input.alt_phone),
    email: clean(input.email).toLowerCase(),
    emirate,
    city: area,
    address,
    pickup_address: pickupAddress || address,
    license_number: clean(input.license_number),
    trn: clean(input.trn || input.tax_number),
    tax_number: clean(input.tax_number || input.trn),
    logo_url: clean(input.logo_url),
    bank_name: clean(input.bank_name),
    iban: clean(input.iban),
    settlement_cycle: clean(input.settlement_cycle || "weekly"),
    commission_type: clean(input.commission_type || "fixed_delivery_fee"),
    default_payment_method: clean(input.default_payment_method || "merchant_pays"),
    notes: clean(input.notes),
    status: clean(input.status || "active"),
    created_at: now,
    updated_at: now,
  });

  const rpcMerchant = await rpcOne<Merchant>("admin_create_merchant", { p_merchant: payload });
  if (rpcMerchant?.id) return { row: rpcMerchant, source: "rpc" };

  const { data, error } = await supabase.from("merchants").insert(payload).select("*").single();
  if (error) throw operationsError(error, "Could not create merchant. Apply the admin operations migration and confirm admin/support RLS access.");
  return { row: data as Merchant, source: "db" };
}

export async function updateOpsMerchantStatus(merchantId: string, status: string): Promise<OpsCreateResult<Merchant>> {
  if (!supabase) throw operationsError(null, "Supabase is not configured for merchant operations.");
  const patch = { status: clean(status), updated_at: new Date().toISOString() };
  const rpcMerchant = await rpcOne<Merchant>("admin_update_merchant", { p_merchant_id: merchantId, p_patch: patch });
  if (rpcMerchant?.id) return { row: rpcMerchant, source: "rpc" };
  const { data, error } = await supabase.from("merchants").update(patch).eq("id", merchantId).select("*").single();
  if (error) throw operationsError(error, "Could not update merchant status. Confirm admin/support RLS access.");
  return { row: data as Merchant, source: "db" };
}

export async function deleteOpsMerchant(merchantId: string): Promise<OpsCreateResult<Merchant>> {
  if (!supabase) throw operationsError(null, "Supabase is not configured for merchant operations.");

  const { count, error: countError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);

  if (countError) throw operationsError(countError, "Could not verify linked orders before deleting this merchant.");
  if ((count || 0) > 0) {
    throw new Error("Cannot delete this merchant because orders are directly linked by merchant_id. Pause or review the merchant instead.");
  }

  const rpcDeleted = await rpcOne<Merchant>("admin_delete_merchant", { p_merchant_id: merchantId });
  if (rpcDeleted?.id) return { row: rpcDeleted, source: "rpc" };

  const { data, error } = await supabase.from("merchants").delete().eq("id", merchantId).select("*").single();
  if (error) throw operationsError(error, "Could not delete merchant. Confirm admin/support RLS access and that no linked orders exist.");
  return { row: data as Merchant, source: "db" };
}

export function calculateOpsOrderPrice(input: OpsOrderInput) {
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  if (input.shipping_scope === "international") {
    const intl = calculateInternationalPrice({ destination: input.destination_country || "WORLD", weight: numberValue(input.weight, 1) });
    return {
      unitPrice: intl.total,
      total: Number((intl.total * count).toFixed(2)),
      breakdown: [...intl.breakdown, `Admin operation count: ${count} x ${intl.total.toFixed(2)} AED`],
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

function collectionAmountForPayment(paymentMethod: string, rawAmount: unknown) {
  return paymentMethod === "cod" ? Math.max(0, numberValue(rawAmount, 0)) : 0;
}

function merchantNetForPayment(paymentMethod: string, collectionAmount: number, deliveryFee: number) {
  if (paymentMethod === "receiver_pays") return 0;
  if (paymentMethod === "merchant_pays" || paymentMethod === "sender_pays") return Number((collectionAmount - deliveryFee).toFixed(2));
  if (paymentMethod === "cod") return Number((collectionAmount - deliveryFee).toFixed(2));
  return Number((collectionAmount - deliveryFee).toFixed(2));
}

function paymentMethodArabic(paymentMethod: string) {
  if (paymentMethod === "cod") return "تحصيل عند التسليم";
  if (paymentMethod === "receiver_pays") return "المستلم يدفع رسوم التوصيل";
  if (paymentMethod === "merchant_pays" || paymentMethod === "sender_pays") return "التاجر يتحمل رسوم التوصيل";
  return paymentMethod;
}

export function calculateMerchantStatementNet(input: OpsOrderInput) {
  const pricing = calculateOpsOrderPrice(input);
  const paymentMethod = clean(input.payment_method || "merchant_pays");
  const collectionAmount = collectionAmountForPayment(paymentMethod, input.cod_amount);
  const deliveryFee = pricing.total;
  return {
    deliveryFee,
    collectionAmount,
    merchantNet: merchantNetForPayment(paymentMethod, collectionAmount, deliveryFee),
    paymentMethod,
  };
}

export async function createOpsOrder(input: OpsOrderInput): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw operationsError(null, "Supabase is not configured for order operations.");
  const merchant = input.merchant || null;
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  const pricing = calculateOpsOrderPrice({ ...input, order_count: count });
  const createdAt = new Date().toISOString();
  const trackingSeed = clean(input.coupon_number) || `${merchant?.merchant_code || "ADMIN"}-${Date.now().toString(36)}`;
  const trackingNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const senderName = clean(merchant?.trade_name || input.merchant_name || "DAY NIGHT Merchant");
  const senderPhone = clean(merchant?.phone || "971568757331");
  const pickupEmirate = clean(input.pickup_city || merchant?.emirate || "Abu Dhabi");
  const merchantArea = clean(merchant?.city);
  const pickupArea = clean(input.pickup_area || (merchantArea && merchantArea !== pickupEmirate ? merchantArea : ""));
  const senderAddress = composeLocationAddress([
    pickupArea,
    input.pickup_street,
    merchant?.pickup_address || merchant?.address || pickupEmirate,
  ]);
  const paymentMethod = clean(input.payment_method || merchant?.default_payment_method || "merchant_pays");
  const isInternational = input.shipping_scope === "international";
  const deliveryEmirate = clean(input.delivery_city || "Dubai");
  const receiverCity = isInternational ? clean(input.destination_country || deliveryEmirate || "WORLD") : deliveryEmirate;
  const receiverAddress = composeLocationAddress([input.delivery_area, input.delivery_street, input.receiver_address || receiverCity]);
  const description = clean(input.package_description || input.package_type || "Admin shipment");
  const codAmount = collectionAmountForPayment(paymentMethod, input.cod_amount);
  const deliveryFee = pricing.total;
  const merchantNet = merchantNetForPayment(paymentMethod, codAmount, deliveryFee);
  const settlementNote = `Payment: ${paymentMethodArabic(paymentMethod)} | Collection ${codAmount.toFixed(2)} AED | Delivery fee ${deliveryFee.toFixed(2)} AED | Merchant statement net ${merchantNet.toFixed(2)} AED`;

  const payload = removeEmptyUndefined({
    tracking_number: trackingNumber,
    invoice_number: trackingNumber,
    coupon_number: clean(input.coupon_number),
    merchant_id: merchant?.id || clean(input.merchant_id) || null,
    merchant_name: senderName,
    merchant_code: merchant?.merchant_code || clean(input.merchant_code),
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    source_channel: "admin_operations",
    source_domain: "daynightae.com",
    sender_name: senderName,
    sender_phone: senderPhone,
    sender_city: pickupEmirate,
    sender_address: senderAddress,
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: receiverAddress,
    package_type: description,
    package_description: description,
    weight: Math.max(1, numberValue(input.weight, 1)),
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: codAmount,
    delivery_price: deliveryFee,
    subtotal: codAmount,
    base_price: deliveryFee,
    total: codAmount,
    total_price: codAmount,
    amount: codAmount,
    price: codAmount,
    currency: "AED",
    notes: [clean(input.notes), settlementNote].filter(Boolean).join(" | ") || "Created from admin operations section",
    status: clean(input.status || "pending"),
    status_history: [{ status: clean(input.status || "pending"), date: createdAt, note: settlementNote }],
    created_at: createdAt,
    updated_at: createdAt,
  });

  const rpcOrder = await rpcOne<Order>("admin_create_coupon_order", { p_order: payload });
  if (rpcOrder?.id || rpcOrder?.tracking_number || rpcOrder?.invoice_number) return { row: rpcOrder, source: "rpc" };

  const { data, error } = await supabase.from("orders").insert(payload).select("*").single();
  if (error) throw operationsError(error, "Could not create order. Apply the admin operations migration and confirm admin/support RLS access.");
  return { row: data as Order, source: "db" };
}
