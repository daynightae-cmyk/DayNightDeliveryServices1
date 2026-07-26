import type { Plugin } from "vite";

function replaceRequired(
  source: string,
  pattern: string | RegExp,
  replacement: string,
  label: string,
) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`DAY NIGHT precise financial rule could not apply: ${label}`);
  }
  return next;
}

const preciseHelpers = `function hasExplicitZeroManualDelivery(input: FinancialOpsOrderInput) {
  const raw = input.manual_delivery_price;
  return (
    input.price_mode === "manual" &&
    raw !== "" &&
    raw !== null &&
    raw !== undefined &&
    Number.isFinite(Number(raw)) &&
    Number(raw) === 0
  );
}

function preciseDeliveryFeeMode(input: FinancialOpsOrderInput) {
  const paymentMethod = String(input.payment_method || "").trim().toLowerCase();
  if (paymentMethod === "merchant_pays" || paymentMethod === "sender_pays") {
    return "deduct_from_merchant" as const;
  }
  const goodsAreZero = input.goods_value !== "" && Number(input.goods_value) === 0;
  if (goodsAreZero && hasExplicitZeroManualDelivery(input)) {
    return "deduct_from_merchant" as const;
  }
  return input.delivery_fee_mode === "deduct_from_merchant"
    ? ("deduct_from_merchant" as const)
    : ("customer_pays" as const);
}`;

const preciseSetField = `  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value } as FinancialOpsOrderInput;
      const paymentMethod = String(next.payment_method || "").trim().toLowerCase();
      const merchantPayment = paymentMethod === "merchant_pays" || paymentMethod === "sender_pays";
      const goodsAreZero = next.goods_value !== "" && Number(next.goods_value) === 0;
      const explicitZeroDelivery = goodsAreZero && hasExplicitZeroManualDelivery(next);

      if (merchantPayment || explicitZeroDelivery) {
        next.delivery_fee_mode = "deduct_from_merchant";
      } else if (
        key === "goods_value" ||
        key === "manual_delivery_price" ||
        key === "price_mode"
      ) {
        next.delivery_fee_mode = "customer_pays";
      }
      return next;
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function setPaymentMethod`;

const preciseEditSetField = `  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value } as FinancialOpsOrderInput;
      const paymentMethod = String(next.payment_method || "").trim().toLowerCase();
      const merchantPayment = paymentMethod === "merchant_pays" || paymentMethod === "sender_pays";
      const goodsAreZero = next.goods_value !== "" && Number(next.goods_value) === 0;
      const explicitZeroDelivery = goodsAreZero && hasExplicitZeroManualDelivery(next);

      if (merchantPayment || explicitZeroDelivery) {
        next.delivery_fee_mode = "deduct_from_merchant";
      } else if (
        key === "goods_value" ||
        key === "manual_delivery_price" ||
        key === "price_mode"
      ) {
        next.delivery_fee_mode = "customer_pays";
      }
      return next;
    });
    setMessage("");
    setError("");
  }

  function chooseMerchant`;

export function preciseFinancialRulePlugin(): Plugin {
  return {
    name: "day-night-precise-financial-rule-v3",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        const code = replaceRequired(
          source,
          'if (input.price_mode === "manual" && manual !== null) {',
          'if (input.price_mode === "manual" && manual !== null && manual > 0) {',
          "manual zero uses the official system delivery fee",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminNewOrderComplete.tsx")) {
        let code = source;
        code = replaceRequired(
          code,
          /function merchantSettlement\(value: number, isArabic: boolean\) \{[\s\S]*?\n\}\n\nfunction FinancialMetric/,
          `${preciseHelpers}

function merchantSettlement(value: number, isArabic: boolean) {
  return {
    label: isArabic
      ? value <= 0
        ? "مستحق على التاجر"
        : "صافي حساب التاجر"
      : value <= 0
        ? "Due from merchant"
        : "Merchant net",
    amount: value,
  };
}

function FinancialMetric`,
          "new-order precise financial helpers and signed merchant settlement",
        );
        code = replaceRequired(
          code,
          /  const authoritativeDeliveryFeeMode =\n    form\.payment_method === "merchant_pays" \|\| form\.payment_method === "sender_pays"\n      \? "deduct_from_merchant"\n      : form\.delivery_fee_mode;/,
          "  const authoritativeDeliveryFeeMode = preciseDeliveryFeeMode(form);",
          "new-order precise delivery-fee mode",
        );
        code = replaceRequired(
          code,
          /  function setField<K extends keyof FinancialOpsOrderInput>\(key: K, value: FinancialOpsOrderInput\[K\]\) \{[\s\S]*?\n  \}\n\n  function setPaymentMethod/,
          preciseSetField,
          "new-order precise financial field transitions",
        );
        code = replaceRequired(
          code,
          /  function setPaymentMethod\(value: string\) \{[\s\S]*?\n  \}\n\n  function setDeliveryFeeMode/,
          `  function setPaymentMethod(value: string) {
    setForm((current) => {
      const requestedMode =
        value === "merchant_pays" || value === "sender_pays"
          ? "deduct_from_merchant"
          : "customer_pays";
      const next = {
        ...current,
        payment_method: value,
        delivery_fee_mode: requestedMode,
      } as FinancialOpsOrderInput;
      return { ...next, delivery_fee_mode: preciseDeliveryFeeMode(next) };
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function setDeliveryFeeMode`,
          "new-order precise payment transition",
        );
        code = replaceRequired(
          code,
          /  function setDeliveryFeeMode\(value: "customer_pays" \| "deduct_from_merchant"\) \{[\s\S]*?\n  \}\n\n  function chooseMerchant/,
          `  function setDeliveryFeeMode(value: "customer_pays" | "deduct_from_merchant") {
    setForm((current) => {
      const next = { ...current, delivery_fee_mode: value } as FinancialOpsOrderInput;
      return { ...next, delivery_fee_mode: preciseDeliveryFeeMode(next) };
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function chooseMerchant`,
          "new-order precise settlement selection",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminOrderEditModalComplete.tsx")) {
        let code = source;
        code = replaceRequired(
          code,
          /(function merchantOptionLabel\(merchant: Merchant\) \{[\s\S]*?\n\})\n\nfunction initialForm/,
          `$1

${preciseHelpers}

function initialForm`,
          "edit precise financial helpers",
        );
        code = replaceRequired(
          code,
          '    payment_method: order.payment_method === "sender_pays" ? "merchant_pays" : order.payment_method || "cod",',
          `    payment_method:
      finance.deliveryFeeMode === "deduct_from_merchant"
        ? "merchant_pays"
        : order.payment_method === "sender_pays"
          ? "merchant_pays"
          : order.payment_method || "cod",`,
          "edit restores the recorded settlement owner",
        );
        code = replaceRequired(
          code,
          "        deliveryFeeMode: form.delivery_fee_mode,",
          "        deliveryFeeMode: preciseDeliveryFeeMode(form),",
          "edit preview uses precise delivery-fee mode",
        );
        code = replaceRequired(
          code,
          /  function setField<K extends keyof FinancialOpsOrderInput>\(key: K, value: FinancialOpsOrderInput\[K\]\) \{[\s\S]*?\n  \}\n\n  function chooseMerchant/,
          preciseEditSetField,
          "edit precise financial field transitions",
        );
        code = replaceRequired(
          code,
          "      deliveryFeeMode: currentForm.delivery_fee_mode,",
          "      deliveryFeeMode: preciseDeliveryFeeMode(currentForm),",
          "edit validation uses precise delivery-fee mode",
        );
        code = replaceRequired(
          code,
          /<Metric label=\{financials\.merchantDue < 0 \? \(isArabic \? "مستحق على التاجر" : "Due from merchant"\) : \(isArabic \? "مستحق للتاجر" : "Due to merchant"\)\} value=\{Math\.abs\(financials\.merchantDue\)\} \/>/,
          `<Metric
                    label={
                      financials.merchantDue <= 0
                        ? isArabic
                          ? "مستحق على التاجر"
                          : "Due from merchant"
                        : isArabic
                          ? "صافي حساب التاجر"
                          : "Merchant net"
                    }
                    value={financials.merchantDue}
                  />`,
          "edit signed merchant settlement",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminMerchantStatementsCenter.tsx")) {
        const code = replaceRequired(
          source,
          /function merchantSettlement\(value: unknown, isArabic: boolean\) \{[\s\S]*?\n\}/,
          `function merchantSettlement(value: unknown, isArabic: boolean) {
  const parsed = amount(value);
  if (parsed < 0) {
    return isArabic
      ? \`مستحق على التاجر \${money(Math.abs(parsed), true)}\`
      : \`Due from merchant \${money(Math.abs(parsed), false)}\`;
  }
  return isArabic
    ? \`صافي حساب التاجر \${money(parsed, true)}\`
    : \`Merchant net \${money(parsed, false)}\`;
}`,
          "merchant statement settlement wording",
        );
        return { code, map: null };
      }

      return null;
    },
  };
}
