import type { FinancialOpsOrderInput } from "./orderFinancialOperations";

export type AdminFinancialField =
  | "goods_value"
  | "manual_delivery_price"
  | "discount_amount";

export function isExplicitFinancialZero(value: unknown) {
  return (
    value !== "" &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value)) &&
    Number(value) === 0
  );
}

export function updateAdminFinancialField(
  current: FinancialOpsOrderInput,
  field: AdminFinancialField,
  rawValue: string,
): FinancialOpsOrderInput {
  const next: FinancialOpsOrderInput = {
    ...current,
    [field]: rawValue,
  };

  if (field === "manual_delivery_price") {
    next.price_mode = "manual";
  }

  const explicitZeroGoods = isExplicitFinancialZero(next.goods_value);
  const explicitZeroManual =
    next.price_mode === "manual" &&
    isExplicitFinancialZero(next.manual_delivery_price);

  if (explicitZeroGoods || explicitZeroManual) {
    next.delivery_fee_mode = "deduct_from_merchant";
    next.payment_method = "merchant_pays";
  }

  return next;
}

export function selectAdminPriceMode(
  current: FinancialOpsOrderInput,
  mode: "system" | "manual",
): FinancialOpsOrderInput {
  if (mode === "system") {
    return {
      ...current,
      price_mode: "system",
      manual_delivery_price: "",
    };
  }

  return {
    ...current,
    price_mode: "manual",
  };
}
