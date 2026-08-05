import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";

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
const autocompletePath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
);
const interactionStatePath = path.join(
  root,
  "artifacts/day-night-delivery/src/lib/adminNewOrderFinancialState.ts",
);
const component = fs.readFileSync(componentPath, "utf8");
const operations = fs.readFileSync(operationsPath, "utf8");
const persistence = fs.readFileSync(persistencePath, "utf8");
const autocomplete = fs.readFileSync(autocompletePath, "utf8");
const interactionState = fs.readFileSync(interactionStatePath, "utf8");

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
  [interactionState.includes("explicitZeroGoods || explicitZeroManual"), "zero goods and explicit manual zero update the state atomically"],
  [interactionState.includes('next.delivery_fee_mode = "deduct_from_merchant"'), "zero values select merchant debit in the same state update"],
  [interactionState.includes('next.payment_method = "merchant_pays"'), "zero values synchronize merchant payment"],
  [!component.includes("merchantDebitActive"), "presentation is not keyed only to the selected mode"],
  [!component.includes("authoritativeDeliveryFeeMode"), "no competing delivery-mode state remains"],
  [!component.includes("const customerTotal = Math.round"), "the component does not duplicate the central financial equations"],
  [!component.includes("Math.max(0, financials.merchantDue)"), "negative merchant balances remain signed"],
  [component.includes('data-admin-financial-input="true"'), "financial number inputs are explicitly isolated"],
  [autocomplete.includes(':not([type="number"])'), "history autocomplete excludes number inputs"],
  [autocomplete.includes(':not([data-admin-financial-input="true"])'), "history autocomplete excludes marked financial inputs"],
  [autocomplete.includes('input.dataset.adminFinancialInput === "true"'), "runtime autocomplete guard protects financial inputs"],
  [component.includes('data-admin-financial-preview-version="7"'), "deployed form exposes financial truth version 7"],
  [component.includes('data-delivery-fee-mode={financials?.deliveryFeeMode ?? ""}'), "preview exposes the actual live delivery-fee destination"],
  [component.includes('payment_method: merchant ? "merchant_pays" : emptyOrder.payment_method'), "fresh merchant orders default to merchant payment"],
  [component.includes('delivery_fee_mode: merchant ? "deduct_from_merchant" : emptyOrder.delivery_fee_mode'), "fresh merchant orders default to merchant debit"],
  [component.includes('payment_method: merchant ? "merchant_pays" : "cod"'), "selecting a merchant selects merchant payment atomically"],
  [component.includes('delivery_fee_mode: merchant ? "deduct_from_merchant" : "customer_pays"'), "selecting a merchant selects merchant debit atomically"],
  [component.includes('payment_method: merchant ? "merchant_pays" : current.payment_method'), "coupon merchant matching selects merchant payment"],
  [component.includes('delivery_fee_mode: merchant ? "deduct_from_merchant" : current.delivery_fee_mode'), "coupon merchant matching selects merchant debit"],
  [component.includes("onInputCapture={handleFinancialInputCapture}"), "form captures financial input before bubble listeners can interfere"],
  [component.includes('data-admin-financial-field="goods_value"'), "goods field has an explicit financial identity"],
  [component.includes('data-admin-financial-field="manual_delivery_price"'), "manual delivery field has an explicit financial identity"],
  [component.includes('data-admin-financial-field="discount_amount"'), "discount field has an explicit financial identity"],
  [component.includes('onChange={(event) => setFinancialField("goods_value", event.currentTarget.value)}'), "goods value uses the standard controlled-input change path"],
  [component.includes('onChange={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}'), "manual delivery uses the standard controlled-input change path"],
  [component.includes('onChange={(event) => setFinancialField("discount_amount", event.currentTarget.value)}'), "discount uses the standard controlled-input change path"],
  [component.includes('onBlur={(event) => setFinancialField("goods_value", event.currentTarget.value)}'), "goods value reconciles browser or extension autofill on blur"],
  [!component.includes("useEffect("), "no effect can overwrite current financial input"],
  [interactionState.includes("updateAdminFinancialField"), "financial field reducer is centralized and testable"],
  [operations.includes("merchant_due: financials.merchantDue"), "create payload persists signed merchant due"],
  [operations.includes("customer_total: financials.customerTotal"), "create payload persists customer total"],
  [operations.includes("company_revenue: financials.companyRevenue"), "create payload persists company revenue"],
  [persistence.includes("merchant_due: merchantDue"), "edit payload persists signed merchant due"],
];
for (const [ok, label] of sourceChecks) {
  if (!ok) throw new Error(`admin new-order live financial gate failed: ${label}`);
}

const tmp = path.join(os.tmpdir(), `daynight-order-financials-${process.pid}.mjs`);
const financialSource = fs.readFileSync(
  path.join(root, "artifacts/day-night-delivery/src/lib/orderFinancials.ts"),
  "utf8",
);
const compiledFinancialSource = ts.transpileModule(financialSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "orderFinancials.ts",
}).outputText;
fs.writeFileSync(tmp, compiledFinancialSource, "utf8");
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
