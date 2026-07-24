import type { Order } from "../types";

export type DeliveryFeeMode = "customer_pays" | "deduct_from_merchant";

export type OrderFinancialInput = {
  goodsValue?: unknown;
  deliveryFee?: unknown;
  discountAmount?: unknown;
  deliveryFeeMode?: unknown;
};

export type OrderFinancialBreakdown = {
  goodsValue: number;
  deliveryFee: number;
  discountAmount: number;
  deliveryFeeMode: DeliveryFeeMode;
  customerTotal: number;
  merchantDue: number;
  companyRevenue: number;
};

export type OrderFinancialValidationError =
  | ""
  | "invalid_financial_number"
  | "negative_financial_value"
  | "discount_exceeds_customer_total"
  | "discount_exceeds_goods_value";

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function financialNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeDeliveryFeeMode(value: unknown): DeliveryFeeMode {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    ["deduct_from_merchant", "merchant_pays", "sender_pays"].includes(
      normalized,
    )
  ) {
    return "deduct_from_merchant";
  }
  return "customer_pays";
}

/**
 * DAY NIGHT accounting rule:
 * A merchant order with zero goods/customer value and a positive delivery fee
 * is always charged to the merchant. The operator does not need to choose the
 * fee mode manually, and the order can never appear as "due to merchant 0".
 */
export function resolveDeliveryFeeMode(
  goodsValue: unknown,
  deliveryFee: unknown,
  requestedMode: unknown,
): DeliveryFeeMode {
  const goods = roundMoney(Math.max(0, financialNumber(goodsValue, 0)));
  const fee = roundMoney(Math.max(0, financialNumber(deliveryFee, 0)));
  if (goods === 0 && fee > 0) return "deduct_from_merchant";
  return normalizeDeliveryFeeMode(requestedMode);
}

export function calculateOrderFinancials(
  input: OrderFinancialInput,
): OrderFinancialBreakdown {
  const goodsValue = roundMoney(
    Math.max(0, financialNumber(input.goodsValue, 0)),
  );
  const deliveryFee = roundMoney(
    Math.max(0, financialNumber(input.deliveryFee, 0)),
  );
  const discountAmount = roundMoney(
    Math.max(0, financialNumber(input.discountAmount, 0)),
  );
  const deliveryFeeMode = resolveDeliveryFeeMode(
    goodsValue,
    deliveryFee,
    input.deliveryFeeMode,
  );

  const maximumDiscount =
    deliveryFeeMode === "customer_pays"
      ? goodsValue + deliveryFee
      : goodsValue;
  if (discountAmount > maximumDiscount) {
    throw new Error(
      deliveryFeeMode === "customer_pays"
        ? "discount_exceeds_customer_total"
        : "discount_exceeds_goods_value",
    );
  }

  const customerTotal = roundMoney(
    deliveryFeeMode === "customer_pays"
      ? goodsValue + deliveryFee - discountAmount
      : goodsValue - discountAmount,
  );
  const merchantDue = roundMoney(
    deliveryFeeMode === "customer_pays"
      ? goodsValue - discountAmount
      : goodsValue - discountAmount - deliveryFee,
  );

  return {
    goodsValue,
    deliveryFee,
    discountAmount,
    deliveryFeeMode,
    customerTotal,
    merchantDue,
    companyRevenue: deliveryFee,
  };
}

export function financialsFromOrder(
  order: Partial<Order> & Record<string, unknown>,
): OrderFinancialBreakdown {
  const deliveryFee = financialNumber(
    order.delivery_fee ??
      order.delivery_price ??
      order.manual_delivery_price ??
      order.base_price ??
      order.price,
    0,
  );
  const goodsValue = financialNumber(
    order.goods_value ?? order.product_value ?? order.merchant_goods_value,
    Math.max(
      0,
      financialNumber(order.cod_amount ?? order.customer_total, 0) -
        deliveryFee,
    ),
  );
  const discountAmount = financialNumber(
    order.discount_amount ?? order.discount,
    0,
  );
  const mode = resolveDeliveryFeeMode(
    goodsValue,
    deliveryFee,
    order.delivery_fee_mode ??
      (String(order.payment_method || "").toLowerCase() === "sender_pays"
        ? "deduct_from_merchant"
        : "customer_pays"),
  );

  try {
    return calculateOrderFinancials({
      goodsValue,
      deliveryFee,
      discountAmount,
      deliveryFeeMode: mode,
    });
  } catch {
    const safeDiscount = Math.min(
      discountAmount,
      mode === "customer_pays" ? goodsValue + deliveryFee : goodsValue,
    );
    return calculateOrderFinancials({
      goodsValue,
      deliveryFee,
      discountAmount: safeDiscount,
      deliveryFeeMode: mode,
    });
  }
}

export function orderFinancialValidation(
  input: OrderFinancialInput,
): OrderFinancialValidationError {
  const goods = financialNumber(input.goodsValue, Number.NaN);
  const fee = financialNumber(input.deliveryFee, Number.NaN);
  const discount = financialNumber(input.discountAmount, Number.NaN);
  if (![goods, fee, discount].every(Number.isFinite)) {
    return "invalid_financial_number";
  }
  if (goods < 0 || fee < 0 || discount < 0) {
    return "negative_financial_value";
  }

  const mode = resolveDeliveryFeeMode(goods, fee, input.deliveryFeeMode);
  const maximumDiscount = mode === "customer_pays" ? goods + fee : goods;
  if (discount > maximumDiscount) {
    return mode === "customer_pays"
      ? "discount_exceeds_customer_total"
      : "discount_exceeds_goods_value";
  }
  return "";
}

export function formatOrderMoney(
  value: unknown,
  locale: "ar-AE" | "en-AE" = "en-AE",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(financialNumber(value, 0));
}
