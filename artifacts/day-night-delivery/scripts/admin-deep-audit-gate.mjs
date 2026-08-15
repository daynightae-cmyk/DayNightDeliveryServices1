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
const dailyClosingRuntimePath = path.join(src, "lib", "adminDailyClosingRuntime.ts");
const financeCenterPath = path.join(src, "components", "admin", "AdminFinanceOperationsCenter.tsx");
const closingPath = path.join(src, "components", "admin", "AdminDailyClosingPanel.tsx");
const healthPath = path.join(src, "components", "admin", "AdminDatabaseHealthCenter.tsx");
const orderFinancePath = path.join(src, "lib", "orderFinancials.ts");
const migrationPath = path.join(repoRoot, "supabase", "migrations", "20260720010000_admin_finance_budget_expenses_hardening.sql");
const dailyClosingMigrationPath = path.join(repoRoot, "supabase", "migrations", "20260815081500_admin_daily_closing_authoritative_v3.sql");

const financeLayer = required(financeLayerPath, "Authoritative finance data layer");
const dailyClosingRuntime = required(dailyClosingRuntimePath, "Authoritative daily closing runtime");
const financeCenter = required(financeCenterPath, "Finance and budget control center");
const closing = required(closingPath, "Authoritative daily closing panel");
const health = required(healthPath, "Database and finance health center");
const orderFinance = required(orderFinancePath, "Order financial formula module");
const migration = required(migrationPath, "Finance budget and expenses migration");
const dailyClosingMigration = required(dailyClosingMigrationPath, "Authoritative daily closing v3 migration");

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

// Daily closing v3 is intentionally split into a presentation component and a
// dedicated database runtime. Validate the real contract rather than coupling
// the gate to old import names inside the React component.
assert(closing.includes('from "../../lib/adminDailyClosingRuntime"'), "Daily closing UI uses the authoritative v3 runtime");
assert(closing.includes("fetchDailyClosing"), "Daily closing UI loads from the authoritative runtime");
assert(closing.includes("saveDailyClosing"), "Daily closing UI saves through the authoritative runtime");
assert(closing.includes("unposted_delivered_orders"), "Daily closing blocks unposted delivered orders");
assert(closing.includes("budget_remaining"), "Daily closing includes budget variance");
assert(closing.includes('type="date"'), "Daily closing supports an explicit closing date");
assert(closing.includes("قاعدة البيانات فقط"), "Daily closing declares database-only persistence");
assert(closing.includes('return "—"'), "Unavailable finance data is not represented by fabricated zeroes");
assert(!closing.includes("buildPreview"), "Daily closing no longer builds a local financial preview");
assert(!closing.includes("saveDailyClosingSnapshot"), "Daily closing does not use the legacy local-capable save path");
assert(!closing.includes("localStorage"), "Daily closing UI never stores financial records locally");

assert(dailyClosingRuntime.includes('supabase.rpc("admin_daily_closing_snapshot"'), "Daily closing runtime reads the authoritative RPC first");
assert(dailyClosingRuntime.includes('supabase.rpc("admin_save_daily_closing"'), "Daily closing runtime saves through the finance RPC first");
assert(dailyClosingRuntime.includes('from("order_financial_settlements")'), "Daily closing runtime can read authoritative settlement rows directly");
assert(dailyClosingRuntime.includes('from("admin_expenses")'), "Daily closing runtime reads approved production expenses");
assert(dailyClosingRuntime.includes('from("admin_adjustments")'), "Daily closing runtime reads production adjustments");
assert(dailyClosingRuntime.includes('from("admin_finance_budget_status")'), "Daily closing runtime reads production budget status");
assert(dailyClosingRuntime.includes('from("admin_daily_closings")'), "Daily closing runtime persists snapshots in the database");
assert(dailyClosingRuntime.includes('source: "unavailable"'), "Daily closing runtime exposes unavailable state instead of invented values");
assert(dailyClosingRuntime.includes("persistedClosedSnapshot"), "Closed daily closing is read from its persisted frozen snapshot");
assert(!dailyClosingRuntime.includes("localStorage"), "Daily closing runtime never stores finance in localStorage");

assert(health.includes("fetchFinanceHardeningHealth"), "Database health verifies the finance hardening RPC");
assert(health.includes("20260720010000_admin_finance_budget_expenses_hardening.sql"), "Health center points to the finance foundation migration");

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
  assert(migration.includes(objectName), `Finance foundation migration defines ${objectName}`);
}
assert(migration.includes("enable row level security"), "Finance tables have RLS enabled");
assert(migration.includes("public.is_admin_or_support()"), "Finance operations enforce admin/support authorization");
assert(migration.includes("financial_account_entries"), "Approved expenses and adjustments post to the account ledger");
assert(migration.includes("daynight_admin_finance_audit"), "Finance writes create audit events");
assert(!migration.toLowerCase().includes("truncate table"), "Finance migration never truncates business data");
assert(!migration.toLowerCase().includes("drop table"), "Finance migration never drops business tables");

for (const objectName of [
  "admin_daily_closing_live_snapshot",
  "admin_daily_closing_snapshot",
  "admin_save_daily_closing",
  "admin_daily_closing_health",
  "snapshot_version",
  "admin_audit_events",
]) {
  assert(dailyClosingMigration.includes(objectName), `Daily closing v3 migration defines ${objectName}`);
}
assert(dailyClosingMigration.includes("daily-closing-v3"), "Daily closing migration versions authoritative snapshots");
assert(dailyClosingMigration.includes("financial_posted_at is null"), "Daily closing migration detects unposted delivered orders");
assert(dailyClosingMigration.includes("coalesce(o.updated_at,o.created_at)::date = d"), "Unposted delivered risk is scoped to the selected closing date");
assert(dailyClosingMigration.includes("saved.status = 'closed'"), "Closed-day reads use the persisted frozen snapshot");
assert(dailyClosingMigration.includes("live_drift"), "Closed-day snapshot exposes post-close live drift without mutating the frozen values");
assert(dailyClosingMigration.includes("_health_check"), "Daily closing save RPC has a no-write production verification path");
assert(dailyClosingMigration.includes("public.is_admin_or_support()"), "Daily closing v3 enforces admin/support authorization");
assert(dailyClosingMigration.includes("enable row level security"), "Daily closing v3 enables RLS");
assert(!dailyClosingMigration.toLowerCase().includes("truncate table"), "Daily closing v3 never truncates business data");
assert(!dailyClosingMigration.toLowerCase().includes("drop table"), "Daily closing v3 never drops business tables");

assert(orderFinance.includes("customer_pays"), "Order finance supports customer-paid delivery");
assert(orderFinance.includes("deduct_from_merchant"), "Order finance supports merchant-deducted delivery");
assert(orderFinance.includes("discount_exceeds_goods_value"), "Order finance validates merchant-deducted discounts");

console.log("\n--- Admin deep audit gate complete ---");
if (process.exitCode === 1) {
  console.error("Admin finance audit FAILED. Do not deploy.");
} else {
  console.log("Admin finance audit PASSED.");
}
