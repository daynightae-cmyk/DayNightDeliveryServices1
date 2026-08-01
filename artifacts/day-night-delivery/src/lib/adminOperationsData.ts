import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";
import { calculateDomesticPrice, calculateInternationalPrice } from "./pricing";
import { createDayNightInvoiceNumber } from "./printableDocuments";
import { resolveOrderMerchant } from "./merchantOrderOwnership";

export type OpsDataSource = "rpc" | "db";
export type OpsPriceMode = "system" | "manual";

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
  sender_name?: string;
  sender_phone?: string;
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
  price_mode?: OpsPriceMode;
  manual_delivery_price?: number | string | null;
};

export type OpsOrderUpdateInput = OpsOrderInput & {
  order: Order;
  edit_reason?: string;
};

export type OpsCreateResult<T> = { row: T; source: OpsDataSource };
export type OpsDeleteResult = {
  deleted: boolean;
  reference: string;
  source: "rpc";
};
export type OpsSnapshot = {
  merchants: Merchant[];
  orders: Order[];
  source: OpsDataSource;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalPositiveNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function removeEmptyUndefined<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as T;
}

function merchantCode(seed?: string) {
  const suffix =
    clean(seed)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || "SHOP";
  const serial = Date.now().toString(36).toUpperCase().slice(-5);
  return `DN-MER-${suffix}-${serial}`;
}

function composeLocationAddress(
  parts: Array<string | undefined | null>,
) {
  return parts.map(clean).filter(Boolean).join(" - ");
}

export function opsErrorDetail(error: unknown) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    dbDetail?: string;
  };
  return [record?.dbDetail, record?.message, record?.details, record?.hint]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" | ");
}

function operationsError(error: unknown, fallback: string) {
  const detail = opsErrorDetail(error);
  if (detail) console.warn("Admin operations DB detail:", detail);
  const wrapped = new Error(fallback) as Error & { dbDetail?: string };
  wrapped.dbDetail = detail;
  return wrapped;
}

async function rpcOne<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(
      `${fn} unavailable, using compatibility fallback when possible:`,
      error.message,
    );
    return null;
  }
  if (Array.isArray(data)) return (data[0] || null) as T | null;
  return (data || null) as T | null;
}

async function rpcRequired<T>(
  fn: string,
  args: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for order operations.",
    );
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw operationsError(error, fallback);
  if (Array.isArray(data)) {
    if (!data[0]) throw operationsError(null, fallback);
    return data[0] as T;
  }
  if (!data) throw operationsError(null, fallback);
  return data as T;
}

export function getOpsOrderReference(order: Order) {
  return clean(
    order.id ||
      order.tracking_number ||
      order.invoice_number ||
      order.coupon_number,
  );
}

function normalizeInitialOrderStatus(status: unknown) {
  const normalized = clean(status)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    [
      "pending",
      "confirmed",
      "assigned",
      "picked_up",
      "in_transit",
      "delivered",
      "cancelled",
      "returned",
    ].includes(normalized)
  ) {
    return normalized;
  }
  return "pending";
}

function normalizedPaymentMethod(value: unknown) {
  const normalized = clean(value || "merchant_pays").toLowerCase();
  if (normalized === "merchant_pays") return "sender_pays";
  if (["sender_pays", "receiver_pays", "cod"].includes(normalized)) {
    return normalized;
  }
  return "sender_pays";
}

export async function fetchOpsMerchants(): Promise<Merchant[]> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for merchant operations.",
    );
  const { data, error } = await supabase
    .from("merchants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error)
    throw operationsError(
      error,
      "Merchants table is not ready. Apply the admin operations migration.",
    );
  return (data || []) as Merchant[];
}

export async function fetchOpsOrders(pageSize = 1000): Promise<Order[]> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for order operations.",
    );

  const safePageSize = Math.min(Math.max(Math.trunc(pageSize || 1000), 1), 1000);
  const rows: Order[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + safePageSize - 1);
    if (error)
      throw operationsError(
        error,
        "Orders table could not be loaded safely.",
      );

    const page = (data || []) as Order[];
    rows.push(...page);
    if (page.length < safePageSize) break;
    from += safePageSize;
  }

  return rows;
}

export async function fetchOpsSnapshot(): Promise<OpsSnapshot> {
  const [merchants, orders] = await Promise.all([
    fetchOpsMerchants(),
    fetchOpsOrders(),
  ]);
  return { merchants, orders, source: "db" };
}

export async function createOpsMerchant(
  input: OpsMerchantInput,
): Promise<OpsCreateResult<Merchant>> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for merchant operations.",
    );
  const now = new Date().toISOString();
  const emirate = clean(input.emirate || "Abu Dhabi");
  const area = clean(input.area || input.city || emirate);
  const address = composeLocationAddress([
    area,
    input.street_details,
    input.address,
  ]);
  const pickupAddress = composeLocationAddress([
    area,
    input.street_details,
    input.pickup_address || input.address,
  ]);
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
    commission_type: clean(
      input.commission_type || "fixed_delivery_fee",
    ),
    default_payment_method: clean(
      input.default_payment_method || "merchant_pays",
    ),
    notes: clean(input.notes),
    status: clean(input.status || "active"),
    created_at: now,
    updated_at: now,
  });

  const rpcMerchant = await rpcOne<Merchant>("admin_create_merchant", {
    p_merchant: payload,
  });
  if (rpcMerchant?.id) return { row: rpcMerchant, source: "rpc" };

  const { data, error } = await supabase
    .from("merchants")
    .insert(payload)
    .select("*")
    .single();
  if (error)
    throw operationsError(
      error,
      "Could not create merchant. Apply the admin operations migration and confirm admin/support RLS access.",
    );
  return { row: data as Merchant, source: "db" };
}

export async function updateOpsMerchantStatus(
  merchantId: string,
  status: string,
): Promise<OpsCreateResult<Merchant>> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for merchant operations.",
    );
  const patch = {
    status: clean(status),
    updated_at: new Date().toISOString(),
  };
  const rpcMerchant = await rpcOne<Merchant>("admin_update_merchant", {
    p_merchant_id: merchantId,
    p_patch: patch,
  });
  if (rpcMerchant?.id) return { row: rpcMerchant, source: "rpc" };
  const { data, error } = await supabase
    .from("merchants")
    .update(patch)
    .eq("id", merchantId)
    .select("*")
    .single();
  if (error)
    throw operationsError(
      error,
      "Could not update merchant status. Confirm admin/support RLS access.",
    );
  return { row: data as Merchant, source: "db" };
}

export async function deleteOpsMerchant(
  merchantId: string,
): Promise<OpsCreateResult<Merchant>> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for merchant operations.",
    );

  const { count, error: countError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId);

  if (countError)
    throw operationsError(
      countError,
      "Could not verify linked orders before deleting this merchant.",
    );
  if ((count || 0) > 0) {
    throw new Error(
      "Cannot delete this merchant because orders are directly linked by merchant_id. Pause or review the merchant instead.",
    );
  }

  const rpcDeleted = await rpcOne<Merchant>("admin_delete_merchant", {
    p_merchant_id: merchantId,
  });
  if (rpcDeleted?.id) return { row: rpcDeleted, source: "rpc" };

  const { data, error } = await supabase
    .from("merchants")
    .delete()
    .eq("id", merchantId)
    .select("*")
    .single();
  if (error)
    throw operationsError(
      error,
      "Could not delete merchant. Confirm admin/support RLS access and that no linked orders exist.",
    );
  return { row: data as Merchant, source: "db" };
}

function systemOrderPrice(input: OpsOrderInput) {
  if (input.shipping_scope === "international") {
    const intl = calculateInternationalPrice({
      destination: clean(input.destination_country),
      weight: Math.max(1, numberValue(input.weight, 1)),
    });
    return {
      unitPrice: intl.total,
      total: Number(intl.total.toFixed(2)),
      breakdown: intl.breakdown,
      pricingCategory: intl.pricingCategory,
    };
  }

  const local = calculateDomesticPrice({
    pickupCity: input.pickup_city,
    deliveryCity: input.delivery_city,
    pieces: 1,
    serviceType: "standard",
  });
  return {
    unitPrice: Number(local.total.toFixed(2)),
    total: Number(local.total.toFixed(2)),
    breakdown: local.breakdown,
    pricingCategory: local.pricingCategory,
  };
}

export function calculateOpsOrderPrice(input: OpsOrderInput) {
  const system = systemOrderPrice(input);
  const manual = optionalPositiveNumber(input.manual_delivery_price);
  if (input.price_mode === "manual" && manual !== null) {
    return {
      unitPrice: Number(manual.toFixed(2)),
      total: Number(manual.toFixed(2)),
      systemTotal: system.total,
      breakdown: [
        `Manual admin price: ${manual.toFixed(2)} AED`,
        `System reference: ${system.total.toFixed(2)} AED`,
      ],
      pricingCategory: "manual_admin",
      priceSource: "manual" as const,
    };
  }

  return {
    ...system,
    systemTotal: system.total,
    priceSource: "system" as const,
  };
}

function collectionAmountForPayment(
  paymentMethod: string,
  rawAmount: unknown,
) {
  return paymentMethod === "cod"
    ? Math.max(0, numberValue(rawAmount, 0))
    : 0;
}

function merchantNetForPayment(
  paymentMethod: string,
  collectionAmount: number,
  deliveryFee: number,
) {
  if (paymentMethod === "receiver_pays") return 0;
  return Number((collectionAmount - deliveryFee).toFixed(2));
}

function paymentMethodArabic(paymentMethod: string) {
  if (paymentMethod === "cod") return "تحصيل عند التسليم";
  if (paymentMethod === "receiver_pays")
    return "المستلم يدفع رسوم التوصيل";
  if (
    paymentMethod === "merchant_pays" ||
    paymentMethod === "sender_pays"
  )
    return "التاجر يتحمل رسوم التوصيل";
  return paymentMethod;
}

export function calculateMerchantStatementNet(input: OpsOrderInput) {
  const pricing = calculateOpsOrderPrice(input);
  const paymentMethod = clean(
    input.payment_method || "merchant_pays",
  );
  const collectionAmount = collectionAmountForPayment(
    paymentMethod,
    input.cod_amount,
  );
  const deliveryFee = pricing.total;
  return {
    deliveryFee,
    collectionAmount,
    merchantNet: merchantNetForPayment(
      paymentMethod,
      collectionAmount,
      deliveryFee,
    ),
    paymentMethod,
  };
}

function assertCompleteOpsOrderInput(input: OpsOrderInput, merchant: Merchant) {
  const isInternational = input.shipping_scope === "international";
  const receiverCity = clean(isInternational ? input.destination_country : input.delivery_city);
  const weight = Number(input.weight);
  const missing = [
    !clean(input.coupon_number) && "coupon_number",
    !clean(merchant.id) && "merchant_id",
    !clean(merchant.trade_name) && "merchant.trade_name",
    !clean(merchant.merchant_code) && "merchant.merchant_code",
    !clean(merchant.phone) && "merchant.phone",
    !clean(input.pickup_city) && "pickup_city",
    !receiverCity && (isInternational ? "destination_country" : "delivery_city"),
    !clean(input.receiver_name) && "receiver_name",
    !clean(input.receiver_phone) && "receiver_phone",
    !clean(input.receiver_address) && "receiver_address",
    !clean(input.package_description || input.package_type) && "package_type",
    !clean(input.payment_method) && "payment_method",
    !clean(input.status) && "status",
    (!Number.isFinite(Number(input.order_count)) || Number(input.order_count) <= 0) && "order_count",
    (!Number.isFinite(weight) || weight <= 0) && "weight",
  ].filter(Boolean);
  if (missing.length) {
    throw operationsError(
      null,
      `order_required_fields_missing:${missing.join(",")}`,
    );
  }
}

function buildOrderPayload(
  input: OpsOrderInput,
  merchant: Merchant | null,
  trackingNumber: string,
  createdAt: string,
) {
  const count = Math.max(
    1,
    Math.ceil(numberValue(input.order_count, 1)),
  );
  const pricing = calculateOpsOrderPrice({
    ...input,
    order_count: count,
  });
  const senderName = clean(
    merchant?.trade_name || input.merchant_name,
  );
  const senderPhone = clean(merchant?.phone);
  const pickupEmirate = clean(
    input.pickup_city || merchant?.emirate,
  );
  const merchantArea = clean(merchant?.city);
  const pickupArea = clean(
    input.pickup_area ||
      (merchantArea && merchantArea !== pickupEmirate
        ? merchantArea
        : ""),
  );
  const senderAddress = composeLocationAddress([
    pickupArea,
    input.pickup_street,
    merchant?.pickup_address ||
      merchant?.address ||
      pickupEmirate,
  ]);
  const uiPaymentMethod = clean(
    input.payment_method || merchant?.default_payment_method,
  );
  const paymentMethod = normalizedPaymentMethod(uiPaymentMethod);
  const isInternational = input.shipping_scope === "international";
  const deliveryEmirate = clean(input.delivery_city);
  const receiverCity = isInternational
    ? clean(
        input.destination_country || deliveryEmirate,
      )
    : deliveryEmirate;
  const receiverAddress = composeLocationAddress([
    input.delivery_area,
    input.delivery_street,
    input.receiver_address || receiverCity,
  ]);
  const description = clean(
    input.package_description || input.package_type,
  );
  const codAmount = collectionAmountForPayment(
    uiPaymentMethod,
    input.cod_amount,
  );
  const deliveryFee = pricing.total;
  const merchantPaysDelivery = ["merchant_pays", "sender_pays"].includes(
    uiPaymentMethod,
  );
  const deliveryFeeMode = merchantPaysDelivery
    ? "deduct_from_merchant"
    : "customer_pays";
  const goodsValue =
    uiPaymentMethod === "cod"
      ? Math.max(0, Number((codAmount - deliveryFee).toFixed(2)))
      : 0;
  const customerTotal = Number(
    (
      merchantPaysDelivery ? goodsValue : goodsValue + deliveryFee
    ).toFixed(2),
  );
  const merchantDue = Number(
    (goodsValue - (merchantPaysDelivery ? deliveryFee : 0)).toFixed(2),
  );
  const merchantNet = merchantNetForPayment(
    uiPaymentMethod,
    codAmount,
    deliveryFee,
  );
  const requestedStatus = clean(input.status);
  const safeInitialStatus =
    normalizeInitialOrderStatus(requestedStatus);
  const reviewNote =
    requestedStatus !== safeInitialStatus
      ? `Requested workflow status: ${requestedStatus}`
      : "";
  const priceNote =
    pricing.priceSource === "manual"
      ? `Manual admin delivery price ${deliveryFee.toFixed(2)} AED; system reference ${pricing.systemTotal.toFixed(2)} AED`
      : `System delivery price ${deliveryFee.toFixed(2)} AED`;
  const settlementNote = `Payment: ${paymentMethodArabic(
    uiPaymentMethod,
  )} | Collection ${codAmount.toFixed(
    2,
  )} AED | Delivery fee ${deliveryFee.toFixed(
    2,
  )} AED | Merchant statement net ${merchantNet.toFixed(2)} AED`;

  return removeEmptyUndefined({
    tracking_number: trackingNumber,
    invoice_number: trackingNumber,
    coupon_number: clean(input.coupon_number),
    merchant_id: merchant?.id || clean(input.merchant_id) || null,
    merchant_name: senderName,
    merchant_code:
      merchant?.merchant_code || clean(input.merchant_code),
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
    weight: Number(input.weight),
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: uiPaymentMethod === "cod" ? customerTotal : 0,
    goods_value: goodsValue,
    delivery_fee: deliveryFee,
    discount_amount: 0,
    delivery_fee_mode: deliveryFeeMode,
    customer_total: customerTotal,
    merchant_due: merchantDue,
    company_revenue: deliveryFee,
    collected_amount: 0,
    financial_version: 1,
    delivery_price: deliveryFee,
    subtotal: customerTotal,
    base_price: deliveryFee,
    total: customerTotal,
    total_price: customerTotal,
    amount: customerTotal,
    price: customerTotal,
    manual_delivery_price:
      pricing.priceSource === "manual" ? deliveryFee : null,
    price_source: pricing.priceSource,
    currency: "AED",
    notes: [clean(input.notes), reviewNote, priceNote, settlementNote]
      .filter(Boolean)
      .join(" | "),
    status: safeInitialStatus,
    status_history: [
      {
        status: safeInitialStatus,
        date: createdAt,
        note: [reviewNote, priceNote, settlementNote]
          .filter(Boolean)
          .join(" | "),
      },
    ],
    created_at: createdAt,
    updated_at: createdAt,
  });
}

export async function createOpsOrder(
  input: OpsOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for order operations.",
    );

  const selectedMerchant = input.merchant;
  if (!selectedMerchant?.id) {
    throw operationsError(
      null,
      "تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.",
    );
  }
  const merchant = await resolveOrderMerchant(selectedMerchant);
  assertCompleteOpsOrderInput(input, merchant);

  const createdAt = new Date().toISOString();
  const couponNumber = clean(input.coupon_number);
  const trackingNumber = createDayNightInvoiceNumber(
    couponNumber,
    new Date(createdAt),
  );
  const payload = buildOrderPayload(
    { ...input, merchant, merchant_id: merchant.id, merchant_name: merchant.trade_name, merchant_code: merchant.merchant_code },
    merchant,
    trackingNumber,
    createdAt,
  );

  const { data, error } = await supabase.rpc("admin_create_coupon_order", {
    p_order: payload,
  });
  if (error)
    throw operationsError(
      error,
      "Could not create the order through the canonical admin RPC.",
    );

  const returned = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!returned?.id) throw operationsError(null, "admin_order_creation_returned_no_row");

  const { data: saved, error: readError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", returned.id)
    .single();
  if (readError || !saved)
    throw operationsError(readError, "saved_order_verification_failed");
  if (clean(saved.merchant_id) !== clean(merchant.id))
    throw operationsError(null, "saved_order_merchant_portal_link_mismatch");

  return { row: saved as Order, source: "rpc" };
}

export async function updateOpsOrder(
  input: OpsOrderUpdateInput,
): Promise<OpsCreateResult<Order>> {
  const reference = getOpsOrderReference(input.order);
  if (!reference)
    throw operationsError(null, "Order reference is missing.");
  if (!supabase)
    throw operationsError(null, "Supabase is not configured for order operations.");

  const candidate = input.merchant || ({
    id: input.merchant_id || input.order.merchant_id || "",
    trade_name: input.merchant_name || input.order.merchant_name || "",
    merchant_code: input.merchant_code || input.order.merchant_code,
    phone: input.order.sender_phone || "",
  } as Merchant);
  if (!candidate.id) throw operationsError(null, "merchant_required");
  const merchant = await resolveOrderMerchant(candidate);
  assertCompleteOpsOrderInput(input, merchant);

  const patch = buildOrderPayload(
    { ...input, merchant, merchant_id: merchant.id, merchant_name: merchant.trade_name, merchant_code: merchant.merchant_code },
    merchant,
    input.order.tracking_number || input.order.invoice_number || reference,
    input.order.created_at || new Date().toISOString(),
  );

  delete (patch as Record<string, unknown>).created_at;
  delete (patch as Record<string, unknown>).tracking_number;
  delete (patch as Record<string, unknown>).invoice_number;
  delete (patch as Record<string, unknown>).status_history;
  delete (patch as Record<string, unknown>).status;

  const row = await rpcRequired<Order>(
    "admin_update_order_runtime",
    {
      p_payload: {
        reference,
        patch,
        reason: clean(input.edit_reason) || "Updated from admin flexible order editor",
      },
    },
    "Could not update this order. Apply the flexible-order migration and confirm admin permissions.",
  );
  if (clean(row.merchant_id) !== clean(merchant.id))
    throw operationsError(null, "updated_order_merchant_portal_link_mismatch");

  return { row, source: "rpc" };
}

export async function deleteOpsOrder(
  order: Order,
  reason: string,
): Promise<OpsDeleteResult> {
  const reference = getOpsOrderReference(order);
  if (!reference)
    throw operationsError(null, "Order reference is missing.");

  const result = await rpcRequired<{
    deleted?: boolean;
    reference?: string;
  }>(
    "admin_delete_order_runtime",
    {
      p_payload: {
        reference,
        reason: clean(reason) || "Deleted from admin order manager",
      },
    },
    "Could not delete this order. Only safe, unassigned orders can be deleted.",
  );

  return {
    deleted: Boolean(result.deleted),
    reference: clean(result.reference || reference),
    source: "rpc",
  };
}
