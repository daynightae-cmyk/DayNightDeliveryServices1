import type { Order } from "../types";
import { normalizeInternationalDestination } from "../data/internationalDestinations";
import { isPersonalAdminOrder } from "./adminOrderLogic";
import { PERSONAL_ORDER_DELIVERY_FEE } from "./personalOrderOperations";
import type { FinancialOpsOrderUpdateInput } from "./orderFinancialOperations";
import {
  updateAdminOrder,
  type AdminOrderWarning,
} from "./adminOrderMutations";

export type AdminOrderEditSaveResult = {
  row: Order;
  source: "rpc";
  financialsLocked?: boolean;
  auditId?: string;
  changedFields?: string[];
  merchantChanged?: boolean;
  warnings?: AdminOrderWarning[];
  reconciliationRequired?: boolean;
  requestId?: string;
};

const clean = (value: unknown) => String(value ?? "").trim();

function numberValue(value: unknown, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function composeAddress(parts: unknown[]) {
  return parts.map(clean).filter(Boolean).join(" - ");
}

function normalizePaymentMethod(value: unknown) {
  const normalized = clean(value || "cod").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "merchant_pays") return "sender_pays";
  if (normalized === "cash") return "cod";
  if (["card", "bank_transfer", "wallet"].includes(normalized)) return "prepaid";
  return normalized || "cod";
}

function deliveryFeeMode(input: FinancialOpsOrderUpdateInput) {
  const payment = normalizePaymentMethod(input.payment_method);
  if (payment === "sender_pays") return "deduct_from_merchant";
  return input.delivery_fee_mode === "deduct_from_merchant"
    ? "deduct_from_merchant"
    : "customer_pays";
}

function buildCanonicalPatch(input: FinancialOpsOrderUpdateInput) {
  const order = input.order;
  const personal = isPersonalAdminOrder(order);
  const merchant = personal ? null : input.merchant || null;
  const paymentMethod = normalizePaymentMethod(input.payment_method || order.payment_method);
  const mode = personal ? "customer_pays" : deliveryFeeMode(input);
  const goodsValue = Math.max(0, numberValue(input.goods_value, numberValue(order.goods_value, 0)));
  const discountAmount = Math.max(
    0,
    numberValue(input.discount_amount, numberValue(order.discount_amount, 0)),
  );
  const manualValue =
    input.manual_delivery_price === "" ||
    input.manual_delivery_price === null ||
    input.manual_delivery_price === undefined
      ? null
      : Math.max(0, numberValue(input.manual_delivery_price, 0));
  const savedDelivery = Math.max(
    0,
    numberValue(order.delivery_fee ?? order.delivery_price ?? order.price, 0),
  );
  const deliveryFee = personal
    ? PERSONAL_ORDER_DELIVERY_FEE
    : input.price_mode === "manual" && manualValue !== null
      ? manualValue
      : savedDelivery;
  const customerTotal = Math.max(
    0,
    mode === "deduct_from_merchant"
      ? goodsValue - discountAmount
      : goodsValue + deliveryFee - discountAmount,
  );
  const merchantDue = personal
    ? 0
    : mode === "deduct_from_merchant"
      ? goodsValue - discountAmount - deliveryFee
      : goodsValue - discountAmount;
  const explicitCod =
    input.cod_amount === "" || input.cod_amount === null || input.cod_amount === undefined
      ? null
      : Math.max(0, numberValue(input.cod_amount, 0));
  const codAmount = explicitCod ?? (paymentMethod === "cod" ? customerTotal : 0);
  const international = input.shipping_scope === "international";
  const destination = international
    ? normalizeInternationalDestination(
        input.destination_country || input.delivery_city || order.destination_country || "WORLD",
        "WORLD",
      )
    : null;
  const packageValue =
    clean(input.package_description || input.package_type) ||
    clean(order.package_description || order.package_type);
  const pickupCity = clean(input.pickup_city || order.sender_city);
  const deliveryCity = clean(input.delivery_city || order.receiver_city);

  return {
    status: clean(input.status || order.status || "pending"),
    merchant_id: personal ? null : clean(input.merchant_id || merchant?.id) || null,
    merchant_name:
      clean(input.merchant_name || merchant?.trade_name || order.merchant_name) || null,
    merchant_code:
      clean(input.merchant_code || merchant?.merchant_code || order.merchant_code) || null,
    sender_name: clean(input.sender_name || merchant?.trade_name || order.sender_name),
    sender_phone: clean(input.sender_phone || merchant?.phone || order.sender_phone),
    sender_city: pickupCity,
    sender_address: composeAddress([
      input.pickup_area,
      input.pickup_street,
      order.sender_address,
    ]),
    receiver_name: clean(input.receiver_name),
    receiver_phone: clean(input.receiver_phone),
    receiver_city: international ? destination : deliveryCity,
    receiver_address: composeAddress([
      input.delivery_area,
      input.delivery_street,
      input.receiver_address,
    ]),
    destination_country: destination,
    shipping_scope: input.shipping_scope,
    coupon_number: clean(input.coupon_number) || null,
    package_type: packageValue,
    package_description: packageValue,
    weight: Math.max(0.1, numberValue(input.weight, numberValue(order.weight, 1))),
    pieces: Math.max(1, Math.round(numberValue(input.order_count, numberValue(order.pieces, 1)))),
    order_count: Math.max(
      1,
      Math.round(numberValue(input.order_count, numberValue(order.order_count, 1))),
    ),
    service_type: international ? "international" : order.service_type || "standard",
    payment_method: paymentMethod,
    cod_amount: codAmount,
    notes: clean(input.notes),
    goods_value: goodsValue,
    delivery_fee: deliveryFee,
    delivery_price: deliveryFee,
    base_price: deliveryFee,
    manual_delivery_price: personal ? null : manualValue,
    price_source: personal ? "system" : input.price_mode || order.price_source || "manual",
    discount_amount: discountAmount,
    delivery_fee_mode: mode,
    customer_total: customerTotal,
    merchant_due: merchantDue,
    company_revenue: deliveryFee,
    subtotal: customerTotal,
    total: customerTotal,
    total_price: customerTotal,
    amount: customerTotal,
    price: customerTotal,
    currency: "AED",
  };
}

async function saveThroughCanonicalV3(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  const orderId = clean(input.order.id);
  if (!orderId) throw new Error("order_id_required_for_complete_edit");

  const patch = buildCanonicalPatch(input);
  const result = await updateAdminOrder(orderId, patch, {
    reason: clean(input.edit_reason) || "DAY NIGHT Admin complete order edit",
    sourcePage: "admin_complete_order_editor",
  });

  return {
    row: result.order,
    source: "rpc",
    financialsLocked: false,
    auditId: result.auditId || undefined,
    changedFields: result.changedFields,
    merchantChanged:
      clean(result.order.merchant_id) !== clean(input.order.merchant_id),
    warnings: result.warnings,
    reconciliationRequired: result.reconciliationRequired,
    requestId: result.requestId,
  };
}

export function saveAdminLockedMerchantCoreEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  return saveThroughCanonicalV3(input);
}

export function saveAdminOrderEdit(
  input: FinancialOpsOrderUpdateInput,
): Promise<AdminOrderEditSaveResult> {
  return saveThroughCanonicalV3(input);
}
