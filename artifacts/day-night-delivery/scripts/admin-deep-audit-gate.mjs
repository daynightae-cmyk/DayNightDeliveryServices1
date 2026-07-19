import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const repoRoot = path.resolve(root, "..", "..");
const src = path.join(root, "src");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("PASS:", message);
  }
}

function required(file, label) {
  assert(fs.existsSync(file), `${label} exists`);
  return fs.existsSync(file) ? read(file) : "";
}

console.log("\n--- DAY NIGHT admin deep audit gate ---");

const financeLayerPath = path.join(src, "lib", "adminFinanceLedger.ts");
const financeCenterPath = path.join(src, "components", "admin", "AdminFinanceOperationsCenter.tsx");
const closingPath = path.join(src, "components", "admin", "AdminDailyClosingPanel.tsx");
const healthPath = path.join(src, "components", "admin", "AdminDatabaseHealthCenter.tsx");
const orderFinancePath = path.join(src, "lib", "orderFinancials.ts");
const migrationPath = path.join(repoRoot, "supabase", "migrations", "20260720010000_admin_finance_budget_expenses_hardening.sql");

const financeLayer = required(financeLayerPath, "Authoritative finance data layer");
const financeCenter = required(financeCenterPath, "Finance and budget control center");
const closing = required(closingPath, "Authoritative daily closing panel");
const health = required(healthPath, "Database and finance health center");
const orderFinance = required(orderFinancePath, "Order financial formula module");
const migration = required(migrationPath, "Finance budget and expenses migration");

assert(financeLayer.includes("admin_finance_operations_snapshot"), "Finance reads use audited snapshot RPC");
assert(financeLayer.includes("order_financial_settlements"), "Finance falls back to the authoritative settlement table");
assert(financeLayer.includes("financial_account_entries"), "Finance uses the company and merchant account ledger");
assert(financeLayer.includes("admin_finance_budget_status"), "Finance reads real budget variance rows");
assert(financeLayer.includes("approvedExpenses"), "Approved and draft expenses are separated");
assert(financeLayer.includes("unpostedDeliveredOrders"), "Delivered orders without posting are surfaced");
assert(!financeLayer.includes("localStorage"), "Finance ledger never stores accounting data in localStorage");
assert(!financeLayer.includes("delivered.length * 5"), "Finance ledger has no arbitrary driver payable formula");
assert(!financeLayer.includes("orderCodTotal - totalIncome"), "Finance ledger has no legacy merchant payable formula");

for (const phrase of [
  "قيمة البضاعة",
  "دخل داي نايت",
  "مستحق التجار",
  "المصروفات المعتمدة",
  "صافي التشغيل",
  "الميزانية",
]) {
  assert(financeCenter.includes(phrase), `Finance UI includes ${phrase}`);
}
assert(financeCenter.includes("createFinanceExpense"), "Expense capture is connected to the database RPC");
assert(financeCenter.includes("setFinanceExpenseStatus"), "Expense approval and voiding are implemented");
assert(financeCenter.includes("createFinanceAdjustment"), "Adjustment capture is connected to the database RPC");
assert(financeCenter.includes("upsertFinanceBudget"), "Budget allocation is connected to the database RPC");
assert(financeCenter.includes("adminFinanceLedger"), "Finance center imports the authoritative ledger layer");
assert(!financeCenter.includes("deriveMerchantStatementFromOrders"), "Merchant statements no longer use legacy COD derivation");
assert(!financeCenter.includes("deriveDriverStatementFromOrders"), "Driver statements no longer invent entries from order count");
assert(!financeCenter.includes("localStorage"), "Finance center never persists accounting data locally");

assert(closing.includes("fetchAuthoritativeDailyClosing"), "Daily closing is loaded from authoritative finance RPC");
assert(closing.includes("saveAuthoritativeDailyClosing"), "Daily closing is saved through the finance RPC");
assert(closing.includes("unposted_delivered_orders"), "Daily closing blocks unposted delivered orders");
assert(closing.includes("budget_remaining"), "Daily closing includes budget variance");
assert(!closing.includes("saveDailyClosingSnapshot"), "Daily closing does not use the legacy local-capable save path");
assert(!closing.includes("localStorage"), "Daily closing never stores financial records locally");

assert(health.includes("fetchFinanceHardeningHealth"), "Database health verifies the finance hardening RPC");
assert(health.includes("20260720010000_admin_finance_budget_expenses_hardening.sql"), "Health center points to the exact finance migration");

for (const objectName of [
  "admin_expenses",
  "admin_adjustments",
  "admin_finance_budgets",
  "admin_daily_closings",
  "admin_finance_budget_status",
  "admin_finance_operations_snapshot",
  "admin_daily_closing_snapshot",
  "admin_finance_hardening_health",
  "admin_set_expense_status",
  "admin_set_adjustment_status",
]) {
  assert(migration.includes(objectName), `Migration defines ${objectName}`);
}
assert(migration.includes("enable row level security"), "Finance tables have RLS enabled");
assert(migration.includes("public.is_admin_or_support()"), "Finance operations enforce admin/support authorization");
assert(migration.includes("financial_account_entries"), "Approved expenses and adjustments post to the account ledger");
assert(migration.includes("daynight_admin_finance_audit"), "Finance writes create audit events");
assert(!migration.toLowerCase().includes("truncate table"), "Finance migration never truncates business data");
assert(!migration.toLowerCase().includes("drop table"), "Finance migration never drops business tables");

assert(orderFinance.includes("customer_pays"), "Order finance supports customer-paid delivery");
assert(orderFinance.includes("deduct_from_merchant"), "Order finance supports merchant-deducted delivery");
assert(orderFinance.includes("discount_exceeds_goods_value"), "Order finance validates merchant-deducted discounts");

console.log("\n--- Admin deep audit gate complete ---");
if (process.exitCode === 1) {
  console.error("Admin finance audit FAILED. Do not deploy.");
} else {
  console.log("Admin finance audit PASSED.");
}
