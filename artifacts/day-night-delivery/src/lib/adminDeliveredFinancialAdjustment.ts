import { supabase } from "../supabase";
import type { Order } from "../types";
import {
  calculateOrderFinancials,
  financialNumber,
  normalizeDeliveryFeeMode,
  type DeliveryFeeMode,
} from "./orderFinancials";

export type AuditedFinancialAdjustmentInput = {
  order: Order;
  goodsValue: number | string;
  deliveryFee: number | string;
  discountAmount?: number | string;
  deliveryFeeMode: DeliveryFeeMode;
  paymentMethod: string;
  reason: string;
};

export type AuditedFinancialAdjustmentResult = {
  order: Order;
  adjustmentId: string;
};

export const AUDITED_ZERO_MANUAL_DELIVERY_FEE = 25;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid_financial_number");
  return Number(parsed.toFixed(2));
}

function normalizedPaymentMethod(value: unknown) {
  const raw = clean(value || "cod").toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "merchant_pays") return "sender_pays";
  if (raw === "cash") return "cod";
  if (raw === "card" || raw === "bank_transfer") return "prepaid";
  if (["cod", "receiver_pays", "sender_pays", "prepaid"].includes(raw)) {
    return raw;
  }
  return "cod";
}

function unwrap<T>(value: unknown): T {
  return (Array.isArray(value) ? value[0] : value) as T;
}

function approximatelyEqual(left: unknown, right: number) {
  return Math.abs(financialNumber(left, Number.NaN) - right) < 0.005;
}

/**
 * Delivered-order adjustment semantics:
 * - positive delivery input is saved exactly as entered;
 * - explicit zero is preserved as the manual marker sent to the RPC, while the
 *   effective accounting fee becomes 25 AED and is deducted from the merchant.
 */
export async function adjustDeliveredOrderFinancials(
  input: AuditedFinancialAdjustmentInput,
): Promise<AuditedFinancialAdjustmentResult> {
  if (!supabase) throw new Error("supabase_not_configured");
  const orderId = clean(input.order.id);
  if (!orderId) throw new Error("order_id_required");

  const reason = clean(input.reason);
  if (reason.length < 6) throw new Error("financial_adjustment_reason_required");

  const goodsValue = money(input.goodsValue);
  const enteredDeliveryFee = money(input.deliveryFee);
  const deliveryFee = enteredDeliveryFee === 0
    ? AUDITED_ZERO_MANUAL_DELIVERY_FEE
    : enteredDeliveryFee;
  const discountAmount = money(input.discountAmount ?? 0);
  if (goodsValue < 0 || enteredDeliveryFee < 0 || discountAmount < 0) {
    throw new Error("negative_financial_value");
  }

  const paymentMethod = normalizedPaymentMethod(input.paymentMethod);
  const deliveryFeeMode = enteredDeliveryFee === 0 || paymentMethod === "sender_pays"
    ? "deduct_from_merchant"
    : normalizeDeliveryFeeMode(input.deliveryFeeMode);
  const expected = calculateOrderFinancials({
    goodsValue,
    deliveryFee,
    discountAmount,
    deliveryFeeMode,
  });

  const { data, error } = await supabase.rpc("admin_adjust_order_financials_verified", {
    p_order_id: orderId,
    p_goods_value: goodsValue,
    p_delivery_fee: enteredDeliveryFee,
    p_discount_amount: discountAmount,
    p_delivery_fee_mode: deliveryFeeMode,
    p_payment_method: paymentMethod,
    p_reason: reason,
  });
  if (error) throw error;

  const payload = unwrap<any>(data);
  const row = payload?.order as Order | undefined;
  if (!payload?.ok || !row?.id) throw new Error("financial_adjustment_returned_no_order");
  if (
    !approximatelyEqual(row.goods_value, expected.goodsValue) ||
    !approximatelyEqual(row.delivery_fee, expected.deliveryFee) ||
    !approximatelyEqual(row.discount_amount, expected.discountAmount) ||
    !approximatelyEqual(row.customer_total, expected.customerTotal) ||
    !approximatelyEqual(row.merchant_due, expected.merchantDue) ||
    !approximatelyEqual(row.company_revenue, expected.companyRevenue)
  ) {
    throw new Error("financial_adjustment_readback_mismatch");
  }

  return {
    order: row,
    adjustmentId: clean(payload.adjustment_id),
  };
}
