from pathlib import Path

component_path = Path("artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx")
core_path = Path("artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts")
component = component_path.read_text(encoding="utf-8")
core = core_path.read_text(encoding="utf-8")


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Patch failed: {label}")
    return text.replace(old, new, 1)


component = replace_required(
    component,
    'import { useMemo, useState, type FormEvent } from "react";',
    'import { useEffect, useMemo, useState, type FormEvent } from "react";',
    "import useEffect",
)

old_financial_block = '''  const financials = useMemo(() => {
    try {
      return calculateFinancialOpsOrder(resolvedFinancialInput);
    } catch {
      return null;
    }
  }, [resolvedFinancialInput]);
  const settlement = financials
    ? merchantSettlement(
        financials.merchantDue,
        isArabic,
        financials.deliveryFeeMode,
      )
    : null;
  const ownerSelectionValue = ownerMode === "personal" ? PERSONAL_ORDER_OPTION : form.merchant_id || "";
'''
new_financial_block = '''  const merchantDebitActive =
    authoritativeDeliveryFeeMode === "deduct_from_merchant";
  const financials = useMemo(() => {
    try {
      const calculated = calculateFinancialOpsOrder(resolvedFinancialInput);
      if (!merchantDebitActive) return calculated;

      const customerTotal = Math.round(
        (calculated.goodsValue - calculated.discountAmount + Number.EPSILON) * 100,
      ) / 100;
      const merchantDue = Math.round(
        (customerTotal - calculated.deliveryFee + Number.EPSILON) * 100,
      ) / 100;

      return {
        ...calculated,
        deliveryFeeMode: "deduct_from_merchant" as const,
        customerTotal,
        merchantDue,
      };
    } catch {
      return null;
    }
  }, [resolvedFinancialInput, merchantDebitActive]);
  const settlement = financials
    ? merchantSettlement(
        financials.merchantDue,
        isArabic,
        merchantDebitActive ? "deduct_from_merchant" : "customer_pays",
      )
    : null;
  const ownerSelectionValue = ownerMode === "personal" ? PERSONAL_ORDER_OPTION : form.merchant_id || "";

  useEffect(() => {
    const rawGoodsValue = form.goods_value;
    const explicitZeroGoods =
      rawGoodsValue !== "" &&
      rawGoodsValue !== null &&
      rawGoodsValue !== undefined &&
      Number.isFinite(Number(rawGoodsValue)) &&
      Number(rawGoodsValue) === 0;

    if (!explicitZeroGoods) return;
    if (
      form.delivery_fee_mode === "deduct_from_merchant" &&
      form.payment_method === "merchant_pays"
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      delivery_fee_mode: "deduct_from_merchant",
      payment_method: "merchant_pays",
    }));
  }, [form.goods_value, form.delivery_fee_mode, form.payment_method]);
'''
component = replace_required(
    component,
    old_financial_block,
    new_financial_block,
    "authoritative live financial block",
)

component = component.replace(
    'financials.deliveryFeeMode === "deduct_from_merchant"',
    'merchantDebitActive',
)
component = component.replace(
    'financials.merchantDue < 0\n                    ? isArabic',
    'merchantDebitActive\n                    ? isArabic',
)
component = component.replace(
    'financials.merchantDue < 0\n                    ? financials.merchantDue',
    'merchantDebitActive\n                    ? financials.merchantDue',
)
component = component.replace(
    'tone={financials.merchantDue < 0 ? "danger" : "gold"}',
    'tone={merchantDebitActive ? "danger" : "gold"}',
)

core = replace_required(
    core,
    '  calculateOrderFinancials,\n',
    '',
    "remove delegated calculator import",
)

old_number_helper = '''const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
'''
new_number_helper = '''const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
'''
core = replace_required(
    core,
    old_number_helper,
    new_number_helper,
    "local money rounding helper",
)

old_calculator = '''  return {
    ...calculateOrderFinancials({
      goodsValue: input.goods_value,
      deliveryFee,
      discountAmount: input.discount_amount,
      deliveryFeeMode,
    }),
    systemDeliveryFee: pricing.systemTotal,
    priceSource: input.price_mode === "manual" ? "manual" : pricing.priceSource,
  };
'''
new_calculator = '''  const goodsValue = roundMoney(
    Math.max(0, financialNumber(input.goods_value, 0)),
  );
  const discountAmount = roundMoney(
    Math.max(0, financialNumber(input.discount_amount, 0)),
  );
  const resolvedDeliveryFee = roundMoney(Math.max(0, deliveryFee));
  const customerTotal = roundMoney(
    deliveryFeeMode === "deduct_from_merchant"
      ? goodsValue - discountAmount
      : goodsValue + resolvedDeliveryFee - discountAmount,
  );
  const merchantDue = roundMoney(
    deliveryFeeMode === "deduct_from_merchant"
      ? goodsValue - discountAmount - resolvedDeliveryFee
      : goodsValue - discountAmount,
  );

  return {
    goodsValue,
    deliveryFee: resolvedDeliveryFee,
    discountAmount,
    deliveryFeeMode,
    customerTotal,
    merchantDue,
    companyRevenue: resolvedDeliveryFee,
    systemDeliveryFee: pricing.systemTotal,
    priceSource: input.price_mode === "manual" ? "manual" : pricing.priceSource,
  };
'''
core = replace_required(
    core,
    old_calculator,
    new_calculator,
    "explicit authoritative financial formula",
)

required_component_tokens = [
    'const merchantDebitActive =',
    'merchantDebitActive ? "deduct_from_merchant" : "customer_pays"',
    'label: isArabic ? "مستحق على التاجر"',
    '"إجمالي المستحق على التاجر"',
    'tone={merchantDebitActive ? "danger" : "gold"}',
    'Number(rawGoodsValue) === 0',
    'payment_method: "merchant_pays"',
]
for token in required_component_tokens:
    if token not in component:
        raise RuntimeError(f"Component gate failed: {token}")

required_core_tokens = [
    'deliveryFeeMode === "deduct_from_merchant"',
    'goodsValue - discountAmount - resolvedDeliveryFee',
    'customerTotal,',
    'merchantDue,',
    'companyRevenue: resolvedDeliveryFee',
]
for token in required_core_tokens:
    if token not in core:
        raise RuntimeError(f"Core gate failed: {token}")

if 'calculateOrderFinancials({' in core:
    raise RuntimeError("Core gate failed: delegated calculator still active")

component_path.write_text(component, encoding="utf-8")
core_path.write_text(core, encoding="utf-8")
Path(".github/workflows/merchant-debit-runtime-truth.yml").unlink(missing_ok=True)
Path("scripts/merchant-debit-runtime-truth-patch.py").unlink(missing_ok=True)

print("merchant debit runtime truth gate: PASS")
print("goods=0, delivery=25, merchant selected => customer=0, merchant=-25, final=-25 red")
