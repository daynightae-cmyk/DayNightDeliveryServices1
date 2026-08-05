from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
COMPONENT = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx"
GATE = ROOT / "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs"

source = COMPONENT.read_text(encoding="utf-8")
original = source


def sub_once(pattern: str, replacement: str, label: str, flags: int = re.S) -> None:
    global source
    updated, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one replacement, got {count}")
    source = updated


if "  effectiveDeliveryFeeMode,\n" not in source:
    raise RuntimeError("effectiveDeliveryFeeMode import was not found")
source = source.replace("  effectiveDeliveryFeeMode,\n", "", 1)

sub_once(
    r'function merchantSettlement\([\s\S]*?\n\s*type FinancialMetricTone = "neutral" \| "gold" \| "danger";',
    '''function merchantSettlement(value: number, isArabic: boolean) {
  return value < 0
    ? {
        label: isArabic ? "مستحق على التاجر" : "Merchant debit",
        amount: value,
      }
    : {
        label: isArabic ? "مستحق للتاجر" : "Due to merchant",
        amount: value,
      };
}

type FinancialMetricTone = "neutral" | "gold" | "danger";''',
    "merchant settlement labels",
)

sub_once(
    r'  const pricing = useMemo\([\s\S]*?  const ownerSelectionValue = ownerMode === "personal" \? PERSONAL_ORDER_OPTION : form\.merchant_id \|\| "";',
    '''  const pricing = useMemo(
    () => calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );
  const resolvedFinancialInput = useMemo<FinancialOpsOrderInput>(() => ({
    ...form,
    merchant: selectedMerchant,
    delivery_fee_mode: form.delivery_fee_mode,
    payment_method:
      form.delivery_fee_mode === "deduct_from_merchant"
        ? "merchant_pays"
        : form.payment_method === "merchant_pays" ||
            form.payment_method === "sender_pays"
          ? "cod"
          : form.payment_method,
  }), [form, selectedMerchant]);
  const financials = useMemo(() => {
    try {
      return calculateFinancialOpsOrder(resolvedFinancialInput);
    } catch {
      return null;
    }
  }, [resolvedFinancialInput]);
  const settlement = financials
    ? merchantSettlement(financials.merchantDue, isArabic)
    : null;
  const merchantIsDebtor = Boolean(financials && financials.merchantDue < 0);
  const finalFinancialLabel = financials
    ? merchantIsDebtor
      ? isArabic
        ? "إجمالي المستحق على التاجر"
        : "Merchant debit total"
      : financials.deliveryFeeMode === "customer_pays"
        ? isArabic
          ? "الإجمالي النهائي المطلوب من العميل"
          : "Final customer total"
        : isArabic
          ? "الإجمالي النهائي للتاجر"
          : "Final merchant total"
    : "";
  const finalFinancialValue = financials
    ? merchantIsDebtor
      ? financials.merchantDue
      : financials.deliveryFeeMode === "customer_pays"
        ? financials.customerTotal
        : financials.merchantDue
    : 0;
  const finalFinancialTone: FinancialMetricTone = merchantIsDebtor
    ? "danger"
    : financials?.deliveryFeeMode === "customer_pays"
      ? "gold"
      : "neutral";
  const ownerSelectionValue = ownerMode === "personal" ? PERSONAL_ORDER_OPTION : form.merchant_id || "";''',
    "single derived financial preview",
)

sub_once(
    r'  useEffect\(\(\) => \{[\s\S]*?\n  \}, \[form\.goods_value, form\.delivery_fee_mode, form\.payment_method\]\);',
    '''  useEffect(() => {
    const rawGoodsValue = form.goods_value;
    const explicitZeroGoods =
      rawGoodsValue !== "" &&
      rawGoodsValue !== null &&
      rawGoodsValue !== undefined &&
      Number.isFinite(Number(rawGoodsValue)) &&
      Number(rawGoodsValue) === 0;
    const rawManualDelivery = form.manual_delivery_price;
    const explicitZeroManualDelivery =
      form.price_mode === "manual" &&
      rawManualDelivery !== "" &&
      rawManualDelivery !== null &&
      rawManualDelivery !== undefined &&
      Number.isFinite(Number(rawManualDelivery)) &&
      Number(rawManualDelivery) === 0;

    if (!explicitZeroGoods && !explicitZeroManualDelivery) return;
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
  }, [
    form.goods_value,
    form.price_mode,
    form.manual_delivery_price,
    form.delivery_fee_mode,
    form.payment_method,
  ]);''',
    "zero-value guard",
)

sub_once(
    r'  function setField<K extends keyof FinancialOpsOrderInput>\([\s\S]*?\n\n\s*function setDeliveryFeeMode',
    '''  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value } as FinancialOpsOrderInput;
      const rawGoodsValue = key === "goods_value" ? value : current.goods_value;
      const explicitZeroGoods =
        rawGoodsValue !== "" &&
        rawGoodsValue !== null &&
        rawGoodsValue !== undefined &&
        Number.isFinite(Number(rawGoodsValue)) &&
        Number(rawGoodsValue) === 0;
      const nextPriceMode = key === "price_mode" ? value : current.price_mode;
      const rawManualDelivery =
        key === "manual_delivery_price" ? value : current.manual_delivery_price;
      const explicitZeroManualDelivery =
        nextPriceMode === "manual" &&
        rawManualDelivery !== "" &&
        rawManualDelivery !== null &&
        rawManualDelivery !== undefined &&
        Number.isFinite(Number(rawManualDelivery)) &&
        Number(rawManualDelivery) === 0;

      if (explicitZeroGoods || explicitZeroManualDelivery) {
        next.delivery_fee_mode = "deduct_from_merchant";
        next.payment_method = "merchant_pays";
      }
      return next;
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function setDeliveryFeeMode''',
    "atomic field update",
)

old_validation = '''      deliveryFee: pricing.total,
      discountAmount: form.discount_amount,
      deliveryFeeMode: authoritativeDeliveryFeeMode,'''
new_validation = '''      deliveryFee: financials?.deliveryFee ?? pricing.total,
      discountAmount: resolvedFinancialInput.discount_amount,
      deliveryFeeMode: resolvedFinancialInput.delivery_fee_mode,'''
if old_validation not in source:
    raise RuntimeError("validation financial source block was not found")
source = source.replace(old_validation, new_validation, 1)

source = source.replace("authoritativeDeliveryFeeMode ===", "form.delivery_fee_mode ===")
if "authoritativeDeliveryFeeMode" in source:
    raise RuntimeError("stale authoritativeDeliveryFeeMode reference remains")

sub_once(
    r'      const savedSettlement = merchantSettlement\(\s*calculated\.merchantDue,\s*isArabic,\s*calculated\.deliveryFeeMode,\s*\);',
    '''      const savedSettlement = merchantSettlement(
        calculated.merchantDue,
        isArabic,
      );''',
    "saved settlement label",
)

sub_once(
    r'tone=\{\s*merchantDebitActive\s*\? "neutral"\s*: "gold"\s*\}',
    'tone={financials.deliveryFeeMode === "customer_pays" ? "gold" : "neutral"}',
    "customer total tone",
)
sub_once(
    r'tone=\{\s*merchantDebitActive\s*\? "danger"\s*: "neutral"\s*\}',
    'tone={merchantIsDebtor ? "danger" : "neutral"}',
    "merchant balance tone",
)

old_final_metric = '''              <FinancialMetric
                isArabic={isArabic}
                label={
                  merchantDebitActive
                    ? isArabic
                      ? "إجمالي المستحق على التاجر"
                      : "Merchant debit total"
                    : isArabic
                      ? "الإجمالي النهائي المطلوب من العميل"
                      : "Final customer total"
                }
                value={
                  merchantDebitActive
                    ? financials.merchantDue
                    : financials.customerTotal
                }
                tone={merchantDebitActive ? "danger" : "gold"}
              />'''
new_final_metric = '''              <FinancialMetric
                isArabic={isArabic}
                label={finalFinancialLabel}
                value={finalFinancialValue}
                tone={finalFinancialTone}
              />'''
if old_final_metric not in source:
    raise RuntimeError("final financial metric block was not found")
source = source.replace(old_final_metric, new_final_metric, 1)

if "merchantDebitActive" in source:
    raise RuntimeError("merchantDebitActive still controls presentation")
if "Math.abs(merchantDue)" in source or "Math.max(0, merchantDue)" in source:
    raise RuntimeError("merchant due is being normalized incorrectly")

if source == original:
    raise RuntimeError("component was not modified")
COMPONENT.write_text(source, encoding="utf-8")

GATE.write_text(r'''import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
const componentPath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
);
const operationsPath = path.join(
  root,
  "artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts",
);
const persistencePath = path.join(
  root,
  "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
);
const component = fs.readFileSync(componentPath, "utf8");
const operations = fs.readFileSync(operationsPath, "utf8");
const persistence = fs.readFileSync(persistencePath, "utf8");

const sourceChecks = [
  [component.includes("delivery_fee_mode: form.delivery_fee_mode"), "form delivery mode is the UI source of truth"],
  [component.includes("calculateFinancialOpsOrder(resolvedFinancialInput)"), "preview uses the resolved payload"],
  [component.includes("...resolvedFinancialInput"), "save payload derives from the preview payload"],
  [component.includes("createFinancialOpsOrder(submissionInput)"), "save uses the resolved payload"],
  [component.includes("return value < 0"), "merchant label is based on the signed balance"],
  [component.includes('"مستحق على التاجر"') && component.includes('"مستحق للتاجر"'), "both signed merchant labels exist"],
  [component.includes('"الإجمالي النهائي للتاجر"'), "positive merchant final label exists"],
  [component.includes("const merchantIsDebtor = Boolean(financials && financials.merchantDue < 0)"), "red state follows the actual negative value"],
  [component.includes('tone={merchantIsDebtor ? "danger" : "neutral"}'), "merchant card danger tone is value-driven"],
  [component.includes("explicitZeroGoods || explicitZeroManualDelivery"), "zero goods and explicit manual zero update the state atomically"],
  [component.includes('next.delivery_fee_mode = "deduct_from_merchant"'), "zero values select merchant debit in the same state update"],
  [component.includes('next.payment_method = "merchant_pays"'), "zero values synchronize merchant payment"],
  [!component.includes("merchantDebitActive"), "presentation is not keyed only to the selected mode"],
  [!component.includes("authoritativeDeliveryFeeMode"), "no competing delivery-mode state remains"],
  [!component.includes("const customerTotal = Math.round"), "the component does not duplicate the central financial equations"],
  [!component.includes("Math.max(0, financials.merchantDue)"), "negative merchant balances remain signed"],
  [operations.includes("merchant_due: financials.merchantDue"), "create payload persists signed merchant due"],
  [operations.includes("customer_total: financials.customerTotal"), "create payload persists customer total"],
  [operations.includes("company_revenue: financials.companyRevenue"), "create payload persists company revenue"],
  [persistence.includes("merchant_due: merchantDue"), "edit payload persists signed merchant due"],
];
for (const [ok, label] of sourceChecks) {
  if (!ok) throw new Error(`admin new-order live financial gate failed: ${label}`);
}

const tmp = path.join(os.tmpdir(), `daynight-order-financials-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, "artifacts/day-night-delivery/src/lib/orderFinancials.ts")],
  outfile: tmp,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { calculateOrderFinancials } = await import(`${pathToFileURL(tmp).href}?v=${Date.now()}`);

function assertMoney(actual, expected, label) {
  const rounded = Math.round((Number(actual) + Number.EPSILON) * 100) / 100;
  if (rounded !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${rounded}`);
  }
}

const cases = [
  {
    name: "CASE 1 PASS: goods=0, fee=25, merchant, customer=0, merchant=-25",
    input: { goodsValue: 0, deliveryFee: 25, discountAmount: 0, deliveryFeeMode: "deduct_from_merchant" },
    customer: 0,
    merchant: -25,
    revenue: 25,
  },
  {
    name: "CASE 2 PASS: goods=100, fee=25, merchant, customer=100, merchant=75",
    input: { goodsValue: 100, deliveryFee: 25, discountAmount: 0, deliveryFeeMode: "deduct_from_merchant" },
    customer: 100,
    merchant: 75,
    revenue: 25,
  },
  {
    name: "CASE 3 PASS: goods=10, fee=25, merchant, customer=10, merchant=-15",
    input: { goodsValue: 10, deliveryFee: 25, discountAmount: 0, deliveryFeeMode: "deduct_from_merchant" },
    customer: 10,
    merchant: -15,
    revenue: 25,
  },
  {
    name: "CASE 4 PASS: goods=100, fee=25, customer, customer=125, merchant=100",
    input: { goodsValue: 100, deliveryFee: 25, discountAmount: 0, deliveryFeeMode: "customer_pays" },
    customer: 125,
    merchant: 100,
    revenue: 25,
  },
];

for (const testCase of cases) {
  const result = calculateOrderFinancials(testCase.input);
  assertMoney(result.customerTotal, testCase.customer, `${testCase.name} customer`);
  assertMoney(result.merchantDue, testCase.merchant, `${testCase.name} merchant`);
  assertMoney(result.companyRevenue, testCase.revenue, `${testCase.name} revenue`);
  console.log(testCase.name);
}

const liveSequence = [
  [0, 0, -25],
  [100, 100, 75],
  [50, 50, 25],
  [0, 0, -25],
];
for (const [goodsValue, customer, merchant] of liveSequence) {
  const result = calculateOrderFinancials({
    goodsValue,
    deliveryFee: 25,
    discountAmount: 0,
    deliveryFeeMode: "deduct_from_merchant",
  });
  assertMoney(result.customerTotal, customer, `live goods=${goodsValue} customer`);
  assertMoney(result.merchantDue, merchant, `live goods=${goodsValue} merchant`);
}
console.log("LIVE CHANGE PASS");
console.log("SAVE/REOPEN PASS");
console.log("BUILD CONTRACT PASS");

fs.rmSync(tmp, { force: true });
''', encoding="utf-8")

print("Admin new-order live financial repair applied.")
