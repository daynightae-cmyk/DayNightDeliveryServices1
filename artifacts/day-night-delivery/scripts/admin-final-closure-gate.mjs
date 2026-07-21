import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const src = path.join(root, "src");

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    fail(`${relative} exists`);
    return "";
  }
  pass(`${relative} exists`);
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

let failures = 0;
function pass(message) {
  console.log(`PASS: ${message}`);
}
function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}
function assert(condition, message) {
  condition ? pass(message) : fail(message);
}
function includesAll(content, values, label) {
  for (const value of values) assert(content.includes(value), `${label}: ${value}`);
}

console.log("\n--- DAY NIGHT Admin final closure gate ---");

const sectionRegistry = read("src/components/admin/AdminSectionRegistry.ts");
const legacyPanel = read("src/components/AdminPanelLuxury.tsx");
const commandCenter = read("src/components/admin/command-center/AdminPanelCommandCenter.tsx");
const commandShell = read("src/components/admin/command-center/AdminCommandCenterShell.tsx");
const workspace = read("src/components/admin/AdminSectionWorkspaceComplete.tsx");
const operationsLayer = read("src/components/admin/AdminOperationsLayer.tsx");
const productionData = read("src/lib/adminProductionData.ts");
const orderForm = read("src/components/admin/AdminNewOrderComplete.tsx");
const merchantForm = read("src/components/admin/AdminNewMerchant.tsx");
const drivers = read("src/components/admin/DriverTrackingPanel.tsx");
const driverHook = read("src/hooks/useAdminDrivers.ts");
const finance = read("src/components/admin/AdminFinanceOperationsCenter.tsx");
const financeLedger = read("src/lib/adminFinanceLedger.ts");
const support = read("src/components/admin/AdminSystemSupportCenter.tsx");
const health = read("src/components/admin/AdminDatabaseHealthCenter.tsx");
const readiness = read("src/components/admin/AdminProductionReadinessCenter.tsx");
const settings = read("src/components/admin/AdminControlSettings.tsx");
const map = read("src/components/admin/AdminLiveOperationsMap.tsx");
const assignment = read("src/components/admin/AdminDriverAssignmentModal.tsx");
const pdf = read("src/components/admin/AdminPdfExportButton.tsx");
const migration = read("../../supabase/migrations/20260711010000_admin_production_foundation.sql");
const financeMigration = read("../../supabase/migrations/20260720010000_admin_finance_budget_expenses_hardening.sql");

const sectionIds = [
  "dashboard", "live_drivers", "new_order", "new_merchant", "merchants",
  "all_orders", "cancelled", "review", "postponed", "returned", "pickup",
  "abu_dhabi", "external", "out_scope", "finance_dashboard", "driver_statements",
  "merchant_statements", "income", "cod", "expenses", "accounts", "adjustments",
  "audit_log", "import", "print", "reports", "settings", "support",
  "database_health", "production_readiness", "logout",
];

for (const id of sectionIds) {
  assert(sectionRegistry.includes(`cfg(\"${id}\"`), `registry contains ${id}`);
  assert(commandCenter.includes(`id: \"${id}\"`), `command center contains ${id}`);
  assert(legacyPanel.includes(`id: \"${id}\"`), `legacy production panel contains ${id}`);
}
assert(new Set(sectionIds).size === 31, "exactly 31 Admin section identifiers are audited");
assert(sectionRegistry.includes("as Record<AdminSectionId, AdminSectionConfig>"), "section registry remains typed");

includesAll(legacyPanel, [
  'active === "dashboard"', 'active === "new_order"', 'active === "new_merchant"',
  'active === "merchants"', 'active === "live_drivers"', 'active === "finance_dashboard"',
  'active === "database_health"', 'active === "production_readiness"',
  'active === "settings"', 'active === "support"', "operationsLayerSections.includes(active)",
  "SpecializedAdminSectionWorkspace",
], "renderer coverage");

includesAll(commandCenter, [
  "useNavigate", "toggleTheme", "toggleLanguage", "onOpenWebsite", "onBack",
  "onToggleKhalifa", "openNotifications", "fetchAdminOrders", "fetchMerchants",
], "command-center controls");
assert(!commandCenter.includes("notificationSlot={<Bell aria-hidden=\"true\" />}") , "notification control is not a dead decorative bell");
includesAll(commandShell, ["onToggleTheme", "onToggleKhalifa", "onBack", "onOpenWebsite"], "shell control contracts");

includesAll(orderForm, [
  "createFinancialOpsOrder", "calculateFinancialOpsOrder", "orderFinancialValidation",
  "CouponPhotoIntake", "createAdminCouponIntakeSession", "reviewConfirmed",
], "new-order production flow");
assert(!orderForm.includes("alert("), "new-order flow has no alert-based fake success");
includesAll(merchantForm, ["createOpsMerchant", "UAE_LOCATIONS", "validate()"], "merchant onboarding flow");

includesAll(workspace, [
  "updateExistingOrderStatus", "AdminOrderEditModal", "AdminOrderDeleteModal",
  "AdminDriverAssignmentModal", "financialsFromOrder", "AdminPdfExportButton",
], "order workspace operations");
assert(!workspace.includes("onClick={() => {}}"), "order workspace has no empty click handlers");
includesAll(assignment, ["assign", "driver", "onSaved"], "driver assignment modal is connected");

includesAll(drivers, [
  "useAdminDrivers", "DriverLiveMap", "DriverDispatchCenter", "setAdminDriverStatus",
  "updateAdminDriverProfile", "uploadDriverAvatarFile",
], "live-driver operations");
includesAll(driverHook, ["driver_profiles", "driver_locations", "orders", "channel("], "driver data and realtime sources");
assert(!drivers.includes("Math.random("), "driver operations contain no random live data");
includesAll(map, ["react-leaflet", "MapContainer", "TileLayer"], "Admin map uses real Leaflet components");
assert(!map.includes("Math.random("), "Admin map contains no random coordinates");

includesAll(finance, [
  "adminFinanceLedger", "createFinanceExpense", "setFinanceExpenseStatus",
  "createFinanceAdjustment", "upsertFinanceBudget", "AdminDailyClosingPanel",
], "finance center operations");
includesAll(financeLedger, [
  "admin_finance_operations_snapshot", "order_financial_settlements",
  "financial_account_entries", "admin_finance_budget_status",
], "authoritative finance sources");

includesAll(productionData, [
  'id === "import"', 'table: "import_batches"', 'table: "print_jobs"',
  'table: "admin_audit_events"', "admin_sync_order_operation_rows",
], "production tools data mapping");
includesAll(operationsLayer, [
  "createImportBatch", "saveImportPreviewRows", "commitValidImportRows",
  "fetchProductionRows", "AdminPdfExportButton", "window.print()",
], "import, print, reports and audit tools");

includesAll(support, [
  "createAdminAuditEvent", "fetchAdminAuditEvents", "pending_local", "retryPendingNotes",
], "support persistence and retry semantics");
assert(!support.includes('setSaved(true); window.setTimeout'), "support does not claim unconditional database success");
includesAll(health, ["fetchAdminDatabaseHealth", "fetchFinanceHardeningHealth", "import_batches", "print_jobs"], "database health coverage");
includesAll(readiness, ["fetchAdminProductionReadiness", "fetchFinanceHardeningHealth", "blocked", "needs_review"], "production readiness gate");
includesAll(settings, ["theme", "language", "mapMode", "notifications"], "Admin settings coverage");
includesAll(pdf, ["AdminPdfPreviewModal", "generate"], "PDF export flow");

for (const objectName of [
  "admin_expenses", "admin_adjustments", "cod_collections", "merchant_statement_entries",
  "driver_statement_entries", "import_batches", "import_batch_rows", "print_jobs",
  "admin_daily_closings", "admin_audit_events",
]) {
  assert(migration.includes(objectName), `foundation migration defines ${objectName}`);
}
includesAll(financeMigration, [
  "admin_finance_operations_snapshot", "admin_daily_closing_snapshot",
  "admin_finance_hardening_health", "financial_account_entries",
], "finance hardening migration");

const adminFiles = [legacyPanel, commandCenter, commandShell, workspace, operationsLayer, orderForm, merchantForm, drivers, finance, support, health, readiness];
const combined = adminFiles.join("\n");
assert(!combined.includes("alert("), "Admin production components contain no alert() operations");
assert(!combined.includes("onClick={() => {}}"), "Admin production components contain no explicit no-op buttons");
assert(!combined.includes("DEMO MAP"), "Admin production components contain no demo map");
assert(!combined.includes("fake GPS"), "Admin production components contain no fake GPS claim");

console.log("\n--- DAY NIGHT Admin final closure gate complete ---");
if (failures) {
  console.error(`Admin final closure FAILED with ${failures} issue(s).`);
  process.exit(1);
}
console.log("Admin final closure PASSED.");
