import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = process.cwd();
let failed = false;

function pass(label) {
  console.log(`PASS: ${label}`);
}

function fail(label, detail = "") {
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
  failed = true;
}

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    fail(`missing ${relative}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function assertEqual(actual, expected, label) {
  if (Object.is(actual, expected)) pass(label);
  else fail(label, `expected ${expected}, received ${actual}`);
}

function expect(content, pattern, label) {
  pattern.test(content) ? pass(label) : fail(label);
}

function reject(content, pattern, label) {
  pattern.test(content) ? fail(label) : pass(label);
}

console.log("\n--- DAY NIGHT precise order financial matrix gate ---");

const financialSource = read("src/lib/orderFinancials.ts");
const transpiled = ts.transpileModule(financialSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const moduleRecord = { exports: {} };
const sandbox = {
  module: moduleRecord,
  exports: moduleRecord.exports,
  require(specifier) {
    throw new Error(`Unexpected runtime import in financial matrix: ${specifier}`);
  },
  console,
};
vm.runInNewContext(
  `(function(exports,module,require){${transpiled}\n})(module.exports,module,require);`,
  sandbox,
  { filename: "orderFinancials.js" },
);

const { calculateOrderFinancials } = moduleRecord.exports;
if (typeof calculateOrderFinancials !== "function") {
  fail("calculateOrderFinancials is executable");
} else {
  const zeroGoodsCustomer = calculateOrderFinancials({
    goodsValue: 0,
    deliveryFee: 25,
    discountAmount: 0,
    deliveryFeeMode: "customer_pays",
  });
  assertEqual(zeroGoodsCustomer.customerTotal, 25, "0 goods + 25 delivery = 25 on customer");
  assertEqual(zeroGoodsCustomer.merchantDue, 0, "0 goods + 25 delivery leaves merchant balance at 0");

  const zeroEnteredDelivery = calculateOrderFinancials({
    goodsValue: 0,
    deliveryFee: 25,
    discountAmount: 0,
    deliveryFeeMode: "deduct_from_merchant",
  });
  assertEqual(zeroEnteredDelivery.customerTotal, 0, "0 goods + entered zero delivery = 0 on customer");
  assertEqual(zeroEnteredDelivery.merchantDue, -25, "0 goods + entered zero delivery = -25 on merchant");

  const standardCustomerOrder = calculateOrderFinancials({
    goodsValue: 50,
    deliveryFee: 25,
    discountAmount: 0,
    deliveryFeeMode: "customer_pays",
  });
  assertEqual(standardCustomerOrder.customerTotal, 75, "50 goods + 25 delivery = 75 on customer");
  assertEqual(standardCustomerOrder.merchantDue, 50, "50 goods preserves 50 merchant merchandise balance");
}

const operations = read("src/lib/orderFinancialOperations.ts");
expect(operations, /hasExplicitZeroManualDelivery/, "explicit manual zero is recorded as settlement intent");
expect(operations, /persistedManualDeliveryPrice[\s\S]*return 0;/, "manual zero marker is persisted for database and edits");
expect(operations, /goodsAreZero && hasExplicitZeroManualDelivery/, "only explicit zero delivery auto-selects merchant liability");

const plugin = read("scripts/precise-financial-rule-plugin.ts");
expect(plugin, /manual !== null && manual > 0/, "manual zero falls back to official system fee");
expect(plugin, /preciseDeliveryFeeMode/, "new and edit screens use the precise settlement resolver");
reject(plugin, /goodsValueIsZero\s*\|\|[\s\S]{0,120}payment_method/, "zero goods alone never forces merchant payment");

const statementButton = read("src/components/admin/MerchantStatementExportButton.tsx");
expect(statementButton, /CUSTOMER_PAID_ZERO_GOODS_SENTINEL/, "customer-paid zero-goods rows are protected in PDF/CSV");
reject(statementButton, /DEFAULT_ZERO_ORDER_DELIVERY_FEE\s*=\s*180/, "statements no longer fabricate the obsolete 180 AED fallback");

const migration = read("../../supabase/migrations/20260727090000_precise_zero_goods_delivery_settlement.sql");
expect(migration, /manual_delivery_price[\s\S]*deduct_from_merchant/, "database distinguishes explicit zero delivery from positive delivery");
reject(migration, /if\s+v_goods\s*=\s*0\s+and\s+v_fee\s*>\s*0[\s\S]*deduct_from_merchant/i, "database no longer charges every zero-goods order to merchant");

if (failed) {
  console.error("Precise order financial matrix gate FAILED.");
  process.exit(1);
}
console.log("Precise order financial matrix gate PASSED.\n");
