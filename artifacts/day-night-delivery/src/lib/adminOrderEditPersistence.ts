import { supabase } from "../supabase";
import type { Order } from "../types";
import {
  calculateFinancialOpsOrder,
  updateFinancialOpsOrder,
  type FinancialOpsOrderUpdateInput,
} from "./orderFinancialOperations";

export type AdminOrderEditSaveResult = {
  row: Order;
  source: "rpc" | "db";
  financialsLocked?: boolean;
};

const clean = (value: unknown) => String(value ?? "").trim();

function errorDetail(error: unknown) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    dbDetail?: string;
  };
  return [record?.code, record?.dbDetail, record?.message, record?.details, record?.hint]
    .map(clean)
    .filter(Boolean)
    .join(" | ");
}

function isMissingFinancialUpdateRuntime(error: unknown) {
  const detail = errorDetail(error).toLowerCase();
  if (/not_authorized|permission denied|row-level security|financials_locked|delivered settlements are locked/.test(detail)) {
    return false;
  }
  return /admin_update_order_with_financials|pgrst202|schema cache|could not find the function|function .* does not exist|migration/.test(detail);
}

function financialsAreLocked(order: Order) {
  const status = clean(order.status).toLowerCase().replace(/[\s-]+/g, "_");
  return Boolean(order.financial_posted_at) || ["delivered", "completed", "complete"].includes(status);
}

function uniqueAddress(parts: unknown[]) {
  const seen = new Set<string>();
  return parts
    .map(clean)
    .filter((part) => {
      if (!part || seen.has(part.toLowerCase())) return false;
      seen.add(part.toLowerCase());
      return true;
    })
    .join(" - ");
}

function normalizedPaymentMethod(value: unknown) {
  const normalized = clean(value || "cod").toLowerCase();
  if (normalized === "merchant_pays") return "sender_pays";
  if (["sender_pays", "receiver_pays", "cod"].includes(normalized)) return normalized;
  return "cod";
}

function corePatch(input: FinancialOpsOrderUpdateInput) {
  const merchant = input.merchant;
  if (!merchant?.id) throw new Error("merchant_required");
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(input.package_description || input.package_type || "Shipment");
  const count = Math.max(1, Math.ceil(Number(input.order_count || 1)));
  const notes = clean(input.notes);
  const editReason = clean(input.edit_reason || "Updated from admin order editor");

  return {
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: uniqueAddress([
      input.delivery_area,
      input.delivery_street,
      input.receiver_address,
    ]),
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(input.weight || 1)),
    pieces: count,
    order_count: count,
    notes: [notes, `Admin edit: ${editReason}`].filter(Boolean).join(" | "),
    updated_at: new Date().toISOString(),
  };
}

function fullPatch(input: FinancialOpsOrderUpdateInput) {
  const merchant = input.merchant;
  if (!merchant?.id) throw new Error("merchant_required");
  const financials = calculateFinancialOpsOrder(input);
  const isInternational = input.shipping_scope === "international";
  const paymentMethod = normalizedPaymentMethod(input.payment_method);
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city || "WORLD")
    : clean(input.delivery_city || "Abu Dhabi");
  const packageValue = clean(input.package_description || input.package_type || "Shipment");
  const count = Math.max(1, Math.ceil(Number(input.order_count || 1)));
  const notes = clean(input.notes);
  const editReason = clean(input.edit_reason || "Updated from admin order editor");

  return {
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code || "",
    sender_name: merchant.trade_name,
    sender_phone: clean(merchant.phone),
    sender_city: clean(input.pickup_city || merchant.emirate),
    sender_address: uniqueAddress([
      input.pickup_area,
      input.pickup_street,
      merchant.pickup_address,
      merchant.address,
    ]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: receiverCity,
    receiver_address: uniqueAddress([
      input.delivery_area,
      input.delivery_street,
      input.receiver_address,
    ]),
    coupon_number: clean(input.coupon_number),
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, Number(input.weight || 1)),
    pieces: count,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? financials.customerTotal : 0,
    goods_value: financials.goodsValue,
    delivery_fee: financials.deliveryFee,
    discount_amount: financials.discountAmount,
    delivery_fee_mode: financials.deliveryFeeMode,
    customer_total: financials.customerTotal,
    merchant_due: financials.merchantDue,
    company_revenue: financials.companyRevenue,
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
    notes: [notes, `Admin edit: ${editReason}`].filter(Boolean).join(" | "),
    updated_at: new Date().toISOString(),
  };
}

async function updateWithPatch(
  input: FinancialOpsOrderUpdateInput,
  patch: Record<string, unknown>,
): Promise<Order> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const orderId = clean(input.order.id);

  if (orderId) {
    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("order_update_verification_failed");
    return data as Order;
  }

  const reference = clean(
    input.order.tracking_number ||
      input.order.invoice_number ||
      input.order.coupon_number,
  );
  if (!reference) throw new Error("order_reference_required");

  for (const column of ["tracking_number", "invoice_number", "coupon_number"]) {
    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq(column, reference)
      .select("*")
      .limit(1);
    if (!error && data?.[0]?.id) return data[0] as Order;
  }
  throw new Error("order_update_verification_failed");
}

export async function saveAdminOrderEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  if (financialsAreLocked(input.order)) {
    const row = await updateWithPatch(input, corePatch(input));
    return { row, source: "db", financialsLocked: true };
  }

  try {
    const result = await updateFinancialOpsOrder(input);
    if (!result.row?.id) throw new Error("financial_order_update_returned_no_row");
    return { row: result.row, source: result.source, financialsLocked: false };
  } catch (error) {
    if (!isMissingFinancialUpdateRuntime(error)) throw error;
    const row = await updateWithPatch(input, fullPatch(input));
    return { row, source: "db", financialsLocked: false };
  }
}
