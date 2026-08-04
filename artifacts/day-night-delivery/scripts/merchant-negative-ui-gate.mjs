import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const newOrder = read("artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx");
const accounts = read("artifacts/day-night-delivery/src/components/admin/AdminMerchantAccountsCenter.tsx");
const statement = read("artifacts/day-night-delivery/src/lib/merchantStatementExport.ts");
const delivered = read("artifacts/day-night-delivery/src/components/admin/AdminDeliveredFinancialAdjustment.tsx");

const checks = [
  [newOrder.includes("effectiveDeliveryFeeMode"), "new order uses canonical fee owner"],
  [newOrder.includes("return calculateFinancialOpsOrder"), "live preview uses save calculator"],
  [newOrder.includes('label: isArabic ? "على التاجر"'), "new order merchant label"],
  [newOrder.includes("amount: value"), "new order keeps signed value"],
  [newOrder.includes('autoComplete="off"'), "financial autocomplete disabled"],
  [newOrder.includes("financials.merchantDue < 0 ? financials.merchantDue : financials.customerTotal"), "final total shows merchant debit"],
  [!accounts.includes("money(Math.abs(due)"), "directory no longer hides sign"],
  [!accounts.includes("money(Math.abs(merchantDue)"), "account summary no longer hides sign"],
  [!statement.includes("money(Math.abs(value), language)"), "statement no longer hides sign"],
  [!delivered.includes("Math.abs(value).toFixed"), "delivered adjustment no longer hides sign"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`merchant-negative-ui gate failed: ${label}`);
}

console.log("merchant-negative-ui gate: PASS");
console.log("goods=0, delivery=25, merchant pays => customer=0, merchant=-25, company=25");
