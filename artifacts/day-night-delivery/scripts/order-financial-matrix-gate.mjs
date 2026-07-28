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

function executeTypeScript(relative) {
  const source = read(relative);
  const transpiled = ts.transpileModule(source, {
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
      throw new Error(`Unexpected runtime import in ${relative}: ${specifier}`);
    },
    console,
  };
  vm.runInNewContext(
    `(function(exports,module,require){${transpiled}\n})(module.exports,module,require);`,
    sandbox,
    { filename: relative },
  );
  return moduleRecord.exports;
}

console.log("\n--- DAY NIGHT authoritative pricing and financial matrix gate ---");

const { calculateOrderFinancials } = executeTypeScript("src/lib/orderFinancials.ts");
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

  const explicitZeroMerchant = calculateOrderFinancials({
    goodsValue: 0,
    deliveryFee: 25,
    discountAmount: 0,
    deliveryFeeMode: "deduct_from_merchant",
  });
  assertEqual(explicitZeroMerchant.customerTotal, 0, "manual zero leaves customer total at zero");
  assertEqual(explicitZeroMerchant.merchantDue, -25, "manual zero creates a 25 AED merchant debit");

  const goodsWithZeroManual = calculateOrderFinancials({
    goodsValue: 290,
    deliveryFee: 25,
    discountAmount: 0,
    deliveryFeeMode: "deduct_from_merchant",
  });
  assertEqual(goodsWithZeroManual.customerTotal, 290, "290 goods with manual zero remains 290 on customer");
  assertEqual(goodsWithZeroManual.merchantDue, 265, "290 goods with manual zero leaves merchant net 265");

  const exactManualThousand = calculateOrderFinancials({
    goodsValue: 290,
    deliveryFee: 1000,
    discountAmount: 0,
    deliveryFeeMode: "customer_pays",
  });
  assertEqual(exactManualThousand.deliveryFee, 1000, "manual 1000 remains exactly 1000");
  assertEqual(exactManualThousand.customerTotal, 1290, "290 goods + manual 1000 = 1290 customer total");
  assertEqual(exactManualThousand.merchantDue, 290, "manual customer-paid fee preserves merchant goods 290");
}

const coverage = executeTypeScript("src/data/coverage.ts");
if (typeof coverage.isExtendedCoverage !== "function") {
  fail("isExtendedCoverage is executable");
} else {
  assertEqual(coverage.isExtendedCoverage("Al Ain"), false, "Al Ain is main 25 AED coverage");
  assertEqual(coverage.isExtendedCoverage("العين - الجيمي"), false, "all Al Ain districts remain 25 AED");
  assertEqual(coverage.isExtendedCoverage("Al Ruwais"), false, "Al Ruwais remains 25 AED");
  assertEqual(coverage.isExtendedCoverage("الرويس"), false, "Arabic Ruwais remains 25 AED");
  assertEqual(coverage.isExtendedCoverage("Al Dhafra"), true, "Al Dhafra remote route is 50 AED");
  assertEqual(coverage.isExtendedCoverage("Western Region"), true, "Western Region remote route is 50 AED");
  assertEqual(coverage.isExtendedCoverage("Liwa"), true, "Liwa remote route is 50 AED");
  assertEqual(coverage.isExtendedCoverage("Ghayathi"), true, "Ghayathi remote route is 50 AED");
  assertEqual(coverage.isExtendedCoverage("Dubai"), false, "Dubai remains 25 AED");
}

const operations = read("src/lib/orderFinancialOperations.ts");
expect(operations, /EXPLICIT_ZERO_MANUAL_DELIVERY_FEE\s*=\s*25/, "manual zero resolves to official 25 AED fee");
expect(operations, /if \(hasExplicitZeroManualDelivery\(input\)\)/, "manual zero always selects merchant deduction");
expect(operations, /persistedManualDeliveryPrice[\s\S]*return 0;/, "manual zero marker is persisted");
expect(operations, /explicitZero[\s\S]*EXPLICIT_ZERO_MANUAL_DELIVERY_FEE/, "calculation uses 25 for explicit zero");
reject(operations, /goodsAreZero\s*&&\s*hasExplicitZeroManualDelivery/, "manual zero is not incorrectly restricted to zero-goods orders");

const deliveredAdjustment = read("src/lib/adminDeliveredFinancialAdjustment.ts");
expect(deliveredAdjustment, /AUDITED_ZERO_MANUAL_DELIVERY_FEE\s*=\s*25/, "delivered adjustment resolves zero to 25");
expect(deliveredAdjustment, /p_delivery_fee:\s*enteredDeliveryFee/, "RPC receives the raw zero marker");

const plugin = read("scripts/precise-financial-rule-plugin.ts");
expect(plugin, /day-night-precise-financial-rule-v4/, "production build uses pricing rule v4");
expect(plugin, /smart chat keeps Al Ain and Ruwais at 25 AED/, "smart chat receives the Al Ain policy");
expect(plugin, /public order uses 25\/50 route pricing/, "public request uses authoritative route pricing");
reject(plugin, /goodsAreZero\s*&&\s*hasExplicitZeroManualDelivery/, "UI does not restrict zero intent by goods value");

const migration = read("../../supabase/migrations/20260729010000_al_ain_25_manual_delivery_final.sql");
expect(migration, /daynight_official_local_delivery_fee/, "database has authoritative local pricing function");
expect(migration, /manual_delivery_price[\s\S]*v_entered_delivery\s*=\s*0/, "database preserves explicit zero intent");
expect(migration, /v_effective_delivery\s*:=\s*25/, "database resolves zero to 25 AED");
expect(migration, /al[ _-]?ain[\s\S]*return false/i, "database explicitly excludes Al Ain from extended pricing");
expect(migration, /ruwais[\s\S]*return false/i, "database explicitly excludes Ruwais from extended pricing");

if (failed) {
  console.error("Authoritative pricing and financial matrix gate FAILED.");
  process.exit(1);
}
console.log("Authoritative pricing and financial matrix gate PASSED.\n");
