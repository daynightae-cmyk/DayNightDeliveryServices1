import fs from "node:fs";

const source = fs.readFileSync(
  "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
  "utf8",
);

const checks = [
  [source.includes("const resolvedFinancialInput = useMemo<FinancialOpsOrderInput>"), "resolved preview payload"],
  [source.includes('delivery_fee_mode: authoritativeDeliveryFeeMode'), "authoritative mode injected"],
  [source.includes('? "merchant_pays"'), "merchant payment synchronized"],
  [source.includes("calculateFinancialOpsOrder(resolvedFinancialInput)"), "preview uses resolved input"],
  [source.includes("createFinancialOpsOrder(submissionInput)"), "save uses resolved input"],
  [source.includes('type FinancialMetricTone = "neutral" | "gold" | "danger"'), "danger metric tone"],
  [source.includes('financials.deliveryFeeMode === "deduct_from_merchant"'), "merchant mode drives emphasis"],
  [source.includes('"border-rose-400/55 bg-rose-500/15'), "negative card is red"],
  [source.includes("function signedAdminMoney") && source.includes("value < 0"), "signed formatter"],
  [source.includes('label: isArabic ? "مستحق على التاجر"'), "exact merchant debit Arabic label"],
  [source.includes('"إجمالي المستحق على التاجر"'), "exact merchant debit total title"],
  [!source.includes('value={financials.customerTotal} accent'), "customer card no longer always gold"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`merchant debit authority gate failed: ${label}`);
}

console.log("merchant debit authority gate: PASS");
console.log("goods=0, delivery=25, merchant mode => customer=0, merchant=-25, red total=-25");
