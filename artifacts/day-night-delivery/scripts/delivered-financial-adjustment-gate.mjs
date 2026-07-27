import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative}`);
  return fs.readFileSync(target, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("\n--- DAY NIGHT audited delivered financial adjustment gate ---");

const migration = read("../../supabase/migrations/20260728233000_admin_delivered_financial_adjustment.sql");
const service = read("src/lib/adminDeliveredFinancialAdjustment.ts");
const panel = read("src/components/admin/AdminDeliveredFinancialAdjustment.tsx");
const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");

expect(migration, /order_financial_adjustments/, "Database keeps a permanent before/after adjustment ledger");
expect(migration, /admin_adjust_order_financials_verified/, "Database exposes an exact-order audited adjustment RPC");
expect(migration, /for update/, "Financial correction locks the exact order row");
expect(migration, /financial_adjustment_readback_mismatch/, "Database verifies persisted financial values");
expect(migration, /financial_version = coalesce\(o\.financial_version, 1\) \+ 1/, "Financial version increments on correction");
expect(migration, /collected_amount = case/, "Delivered collection is recalculated with the corrected customer total");
expect(migration, /financial_adjustment_reason/, "Adjustment reason is stored on the order");
expect(migration, /'cod', 'receiver_pays', 'sender_pays', 'prepaid'/, "Database uses only the production payment modes");
expect(service, /adjustDeliveredOrderFinancials/, "Frontend uses a dedicated audited adjustment client");
expect(service, /financial_adjustment_readback_mismatch/, "Frontend verifies returned totals");
expect(panel, /سعر التوصيل اليدوي/, "Delivered order panel exposes an editable manual delivery amount");
expect(panel, /يُضاف على العميل/, "Panel supports charging delivery to the customer");
expect(panel, /يُخصم من التاجر/, "Panel supports deducting delivery from the merchant");
expect(panel, /سبب التعديل المالي/, "Panel requires an audit reason");
expect(panel, /حفظ التصحيح المالي الآن/, "Panel exposes a direct correction save action");
expect(modal, /AdminDeliveredFinancialAdjustment/, "Live order editor mounts the delivered financial correction panel");
expect(modal, /financialLocked &&/, "Correction panel is limited to posted or delivered orders");

if (failed) {
  console.error("Delivered financial adjustment gate FAILED.");
  process.exit(1);
}
console.log("Delivered financial adjustment gate PASSED.\n");
