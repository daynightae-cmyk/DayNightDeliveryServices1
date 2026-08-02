import { supabase } from "../supabase";
import type { Order } from "../types";
import { opsErrorDetail, type OpsCreateResult } from "./adminOperationsData";
import { createDayNightInvoiceNumber } from "./printableDocuments";

export const PERSONAL_ORDER_DELIVERY_FEE = 25;

export type PersonalOrderInput = {
  reference?: string;
  sender_name: string;
  sender_phone: string;
  pickup_city: string;
  pickup_area?: string;
  pickup_street: string;
  receiver_name: string;
  receiver_phone: string;
  delivery_city: string;
  delivery_area?: string;
  delivery_street: string;
  package_type: string;
  goods_value: number | string;
  discount_amount?: number | string;
  payment_method: string;
  notes?: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function address(parts: unknown[]) {
  const seen = new Set<string>();
  return parts
    .map(clean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" - ");
}

function normalizedPaymentMethod(value: unknown) {
  const method = clean(value || "cod").toLowerCase().replace(/[\s-]+/g, "_");
  if (["cod", "receiver_pays", "prepaid"].includes(method)) return method;
  return "cod";
}

export function calculatePersonalOrderFinancials(input: {
  goodsValue: unknown;
  discountAmount?: unknown;
  deliveryFee?: unknown;
}) {
  const goodsValue = Math.max(0, numberValue(input.goodsValue));
  const deliveryFee = Math.max(0, numberValue(input.deliveryFee, PERSONAL_ORDER_DELIVERY_FEE));
  const discountAmount = Math.max(0, numberValue(input.discountAmount));
  const beforeDiscount = goodsValue + deliveryFee;
  if (discountAmount > beforeDiscount) throw new Error("discount_exceeds_personal_order_total");
  return {
    goodsValue,
    deliveryFee,
    discountAmount,
    deliveryFeeMode: "customer_pays" as const,
    customerTotal: beforeDiscount - discountAmount,
    merchantDue: 0,
    companyRevenue: deliveryFee,
  };
}

export async function createPersonalOpsOrder(
  input: PersonalOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const couponNumber = clean(input.reference);
  const senderName = clean(input.sender_name);
  const senderPhone = clean(input.sender_phone);
  const receiverName = clean(input.receiver_name);
  const receiverPhone = clean(input.receiver_phone);
  if (!couponNumber) {
    throw new Error("coupon_number_required_for_personal_order");
  }
  if (!senderName || !receiverName || !receiverPhone) {
    throw new Error("personal_order_required_contact_fields_missing");
  }

  const financials = calculatePersonalOrderFinancials({
    goodsValue: input.goods_value,
    discountAmount: input.discount_amount,
  });
  const now = new Date();
  const createdAt = now.toISOString();
  const trackingNumber = createDayNightInvoiceNumber(couponNumber, now);
  const paymentMethod = normalizedPaymentMethod(input.payment_method);
  const packageValue = clean(input.package_type) || "Personal shipment";
  const payload = {
    tracking_number: trackingNumber,
    tracking_code: trackingNumber,
    invoice_number: trackingNumber,
    coupon_number: couponNumber,
    merchant_id: null,
    merchant_name: null,
    merchant_code: null,
    source_channel: "admin_personal_order",
    source_domain: "daynightae.com",
    sender_name: senderName,
    sender_phone: senderPhone,
    sender_city: clean(input.pickup_city || "Abu Dhabi"),
    sender_address: address([input.pickup_area, input.pickup_street, input.pickup_city]),
    receiver_name: receiverName,
    receiver_phone: receiverPhone,
    receiver_city: clean(input.delivery_city || "Abu Dhabi"),
    receiver_address: address([input.delivery_area, input.delivery_street, input.delivery_city]),
    package_type: packageValue,
    package_description: packageValue,
    weight: 1,
    pieces: 1,
    order_count: 1,
    shipping_scope: "local",
    service_type: "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    goods_value: financials.goodsValue,
    delivery_fee: PERSONAL_ORDER_DELIVERY_FEE,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: "customer_pays",
    customer_total: financials.customerTotal,
    merchant_due: 0,
    company_revenue: PERSONAL_ORDER_DELIVERY_FEE,
    delivery_price: PERSONAL_ORDER_DELIVERY_FEE,
    base_price: PERSONAL_ORDER_DELIVERY_FEE,
    subtotal: financials.customerTotal,
    total: financials.customerTotal,
    total_price: financials.customerTotal,
    amount: financials.customerTotal,
    price: financials.customerTotal,
    manual_delivery_price: null,
    price_source: "system",
    currency: "AED",
    notes: [clean(input.notes), "PERSONAL_ORDER · Fixed delivery 25 AED"].filter(Boolean).join(" | "),
    status: "pending",
    status_history: [{ status: "pending", date: createdAt, created_at: createdAt, note: "Created by admin as a personal order without merchant" }],
    created_at: createdAt,
    updated_at: createdAt,
  };

  const rpc = await supabase.rpc("admin_create_personal_order", { p_order: payload });
  if (!rpc.error) {
    const row = (Array.isArray(rpc.data) ? rpc.data[0] : rpc.data) as Order | null;
    if (row?.id) return { row, source: "rpc" };
    throw new Error("personal_order_creation_returned_no_row");
  }
  throw new Error(
    [
      opsErrorDetail(rpc.error) || "personal_order_creation_failed",
      "تعذر حفظ الطلب الشخصي عبر المسار الآمن. أعد المحاولة بعد التحقق من اتصال قاعدة البيانات.",
    ].join(" | "),
  );
}
