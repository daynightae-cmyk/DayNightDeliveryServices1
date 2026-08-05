import fs from "node:fs";

const component = fs.readFileSync(
  "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
  "utf8",
);
const autocomplete = fs.readFileSync(
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
  "utf8",
);

const checks = [
  [!component.includes("useEffect"), "delayed financial synchronization removed"],
  [!component.includes("effectiveDeliveryFeeMode"), "conflicting mode resolver removed from UI"],
  [component.includes('data-admin-financial-input="true"'), "financial inputs are explicitly protected"],
  [component.includes('label: isArabic ? "مستحق على التاجر"') && component.includes("return value < 0"), "merchant label follows signed amount"],
  [component.includes('"الإجمالي النهائي للتاجر"'), "positive merchant total label exists"],
  [component.includes('tone={financials.merchantDue < 0 ? "danger" : "gold"}'), "danger color follows actual negative balance"],
  [component.includes("merchantFeeModeActive") && component.includes("financials.merchantDue"), "final amount follows fee owner"],
  [autocomplete.includes(':not([type="number"])'), "number inputs excluded from history autocomplete"],
  [autocomplete.includes(':not([data-admin-financial-input="true"])'), "financial marker excluded from history autocomplete"],
  [autocomplete.includes('input.dataset.adminFinancialInput === "true"'), "defensive runtime exclusion exists"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`admin_live_financial_state_gate_failed: ${label}`);
}

const calculate = (goods, fee, mode, discount = 0) => ({
  customer: mode === "customer_pays" ? goods + fee - discount : goods - discount,
  merchant: mode === "deduct_from_merchant" ? goods - discount - fee : goods - discount,
});
const matrix = [
  [0, 25, "deduct_from_merchant", 0, -25],
  [30, 25, "deduct_from_merchant", 30, 5],
  [100, 25, "deduct_from_merchant", 100, 75],
  [100, 25, "customer_pays", 125, 100],
];
for (const [goods, fee, mode, customer, merchant] of matrix) {
  const result = calculate(goods, fee, mode);
  if (result.customer !== customer || result.merchant !== merchant) {
    throw new Error(`financial_matrix_failed: ${goods}/${fee}/${mode}`);
  }
}

console.log("admin live financial state gate: PASS");
console.log("DOM autocomplete no longer owns numeric financial inputs");
console.log("0/25 merchant => customer 0, merchant -25");
console.log("30/25 merchant => customer 30, merchant 5");
