import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";
import {
  calculateOpsOrderPrice,
  getOpsOrderReference,
  opsErrorDetail,
  type OpsCreateResult,
  type OpsOrderInput,
  type OpsOrderUpdateInput,
} from "./adminOperationsData";
import { createDayNightInvoiceNumber } from "./printableDocuments";
import {
  calculateOrderFinancials,
  normalizeDeliveryFeeMode,
  orderFinancialValidation,
  type DeliveryFeeMode,
  type OrderFinancialBreakdown,
} from "./orderFinancials";

export type FinancialOpsOrderInput = OpsOrderInput & {
  goods_value: number | string;
  discount_amount?: number | string;
  delivery_fee_mode: DeliveryFeeMode;
};

export type FinancialOpsOrderUpdateInput = Omit<OpsOrderUpdateInput, keyof OpsOrderInput> &
  FinancialOpsOrderInput;

const clean = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function composeAddress(parts: unknown[]) {
  return parts.map(clean).filter(Boolean).join(" - ");
}

function normalizePaymentMethod(value: unknown) {
  const normalized = clean(value || "cod").toLowerCase();
  if (normalized === "merchant_pays") return "sender_pays";
  if (["sender_pays", "receiver_pays", "cod"].includes(normalized)) return normalized;
  return "cod";
}

function operationError(error: unknown, fallback: string) {
  const detail = opsErrorDetail(error);
  const wrapped = new Error(detail || fallback) as Error & { dbDetail?: string };
  wrapped.dbDetail = detail;
  return wrapped;
}

export function calculateFinancialOpsOrder(input: FinancialOpsOrderInput): OrderFinancialBreakdown & {
  systemDeliveryFee: number;
  priceSource: "system" | "manual";
} {
  const pricing = calculateOpsOrderPrice(input);
  const validation = orderFinancialValidation({
    goodsValue: input.goods_value,
    deliveryFee: pricing.total,
    discountAmount: input.discount_amount,
    deliveryFeeMode: input.delivery_fee_mode,
  });
  if (validation) throw new Error(validation);

  return {
    ...calculateOrderFinancials({
      goodsValue: input.goods_value,
      deliveryFee: pricing.total,
      discountAmount: input.discount_amount,
      deliveryFeeMode: input.delivery_fee_mode,
    }),
    systemDeliveryFee: pricing.systemTotal,
    priceSource: pricing.priceSource,
  };
}

function buildFinancialOrderPayload(
  input: FinancialOpsOrderInput,
  merchant: Merchant,
  financials: ReturnType<typeof calculateFinancialOpsOrder>,
  trackingNumber: string,
  createdAt: string,
) {
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Abu Dhabi");
  const senderCity = clean(input.pickup_city || merchant.emirate || "Abu Dhabi");
  const senderAddress = composeAddress([
    input.pickup_area,
    input.pickup_street,
    merchant.pickup_address || merchant.address || senderCity,
  ]);
  const receiverAddress = composeAddress([
    input.delivery_area,
    input.delivery_street,
    input.receiver_address || receiverCity,
  ]);
  const packageValue = clean(input.package_description || input.package_type || "Shipment");
  const paymentMethod = normalizePaymentMethod(input.payment_method);
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  const codAmount = paymentMethod === "cod" ? financials.customerTotal : 0;
  const financeNote = [
    `Goods value ${financials.goodsValue.toFixed(2)} AED`,
    `Delivery fee ${financials.deliveryFee.toFixed(2)} AED`,
    `Discount ${financials.discountAmount.toFixed(2)} AED`,
    `Customer total ${financials.customerTotal.toFixed(2)} AED`,
    `Merchant due ${financials.merchantDue.toFixed(2)} AED`,
    `DAY NIGHT revenue ${financials.companyRevenue.toFixed(2)} AED`,
    `Delivery fee mode ${financials.deliveryFeeMode}`,
  ].join(" | ");

  return {
    tracking_number: trackingNumber,
    tracking_code: trackingNumber,
    invoice_number: trackingNumber,
    coupon_number: clean(input.coupon_number),
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code || "",
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    source_channel: "admin_financial_order",
    source_domain: "daynightae.com",
    sender_name: merchant.trade_name,
    sender_phone: clean(merchant.phone || "971568757331"),
    sender_city: senderCity,
    sender_address: senderAddress,
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: receiverAddress,
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, numberValue(input.weight, 1)),
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: codAmount,
    goods_value: financials.goodsValue,
    delivery_fee: financials.deliveryFee,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: financials.deliveryFeeMode,
    customer_total: financials.customerTotal,
    merchant_due: financials.merchantDue,
    company_revenue: financials.companyRevenue,
    collected_amount: 0,
    financial_version: 1,
    delivery_price: financials.deliveryFee,
    base_price: financials.deliveryFee,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price: financials.priceSource === "manual" ? financials.deliveryFee : null,
    price_source: financials.priceSource,
    currency: "AED",
    notes: [clean(input.notes), financeNote].filter(Boolean).join(" | "),
    status: "pending",
    status_history: [
      {
        status: "pending",
        date: createdAt,
        created_at: createdAt,
        note: financeNote,
      },
    ],
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function createFinancialOpsOrder(
  input: FinancialOpsOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw operationError(null, "Supabase is not configured.");
  const merchant = input.merchant;
  if (!merchant?.id) throw operationError(null, "merchant_required");

  const financials = calculateFinancialOpsOrder(input);
  const createdAt = new Date().toISOString();
  const trackingSeed = clean(input.coupon_number) || `${merchant.merchant_code || "ADMIN"}-${Date.now().toString(36)}`;
  const trackingNumber = createDayNightInvoiceNumber(trackingSeed, new Date(createdAt));
  const payload = buildFinancialOrderPayload(input, merchant, financials, trackingNumber, createdAt);

  const { data, error } = await supabase.rpc("admin_create_coupon_order", { p_order: payload });
  if (error) {
    throw operationError(
      error,
      "Could not create the financially separated merchant order. Apply the order financial ledger migration.",
    );
  }
  const row = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!row?.id && !row?.tracking_number && !row?.invoice_number) {
    throw operationError(null, "financial_order_creation_returned_no_row");
  }
  return { row, source: "rpc" };
}

function buildCorePatch(
  input: FinancialOpsOrderUpdateInput,
  merchant: Merchant,
  financials: ReturnType<typeof calculateFinancialOpsOrder>,
) {
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(input.package_description || input.package_type || "Shipment");
  const paymentMethod = normalizePaymentMethod(input.payment_method);
  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));

  return {
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code || "",
    sender_name: merchant.trade_name,
    sender_phone: clean(merchant.phone),
    sender_city: clean(input.pickup_city || merchant.emirate),
    sender_address: composeAddress([input.pickup_area, input.pickup_street, merchant.pickup_address || merchant.address]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: composeAddress([input.delivery_area, input.delivery_street, input.receiver_address]),
    coupon_number: clean(input.coupon_number),
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, numberValue(input.weight, 1)),
    pieces: count,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    delivery_price: financials.deliveryFee,
    base_price: financials.deliveryFee,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price: financials.priceSource === "manual" ? financials.deliveryFee : null,
    price_source: financials.priceSource,
    currency: "AED",
    notes: clean(input.notes),
  };
}

export async function updateFinancialOpsOrder(
  input: FinancialOpsOrderUpdateInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw operationError(null, "Supabase is not configured.");
  const reference = getOpsOrderReference(input.order);
  if (!reference) throw operationError(null, "order_reference_required");
  const merchant = input.merchant;
  if (!merchant?.id) throw operationError(null, "merchant_required");

  const financials = calculateFinancialOpsOrder(input);
  const corePatch = buildCorePatch(input, merchant, financials);
  const { data, error } = await supabase.rpc("admin_update_order_with_financials", {
    p_payload: {
      reference,
      patch: corePatch,
      financials: {
        goods_value: financials.goodsValue,
        delivery_fee: financials.deliveryFee,
        discount_amount: financials.discountAmount,
        delivery_fee_mode: normalizeDeliveryFeeMode(input.delivery_fee_mode),
      },
      reason: clean(input.edit_reason) || "Updated from admin financial order editor",
    },
  });
  if (error) {
    throw operationError(
      error,
      "Could not update the financial order. Delivered settlements are locked and require an audited adjustment.",
    );
  }
  const row = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!row?.id) throw operationError(null, "financial_order_update_returned_no_row");
  return { row, source: "rpc" };
}
