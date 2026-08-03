import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative} exists`);
  return fs.readFileSync(file, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function reject(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("\n--- DAY NIGHT operations order-control gate ---");

const bulk = read("src/components/admin/AdminOrderBulkOperations.tsx");
expect(bulk, /merchantId/, "Admin bulk console filters by exact merchant id");
expect(bulk, /selectedIds/, "Admin bulk console supports multi-order selection");
expect(bulk, /AdminPdfExportButton/, "Selected orders export through the production PDF/CSV/Word flow");
expect(bulk, /window\.open[\s\S]*window\.print/, "Selected orders have a dedicated print document");
expect(bulk, /orders\.map\(orderId\)/, "Select-all uses only currently filtered real orders");

const workspace = read("src/components/admin/AdminSectionWorkspace.tsx");
expect(workspace, /AdminOrderBulkOperations/, "Admin order workspace mounts bulk operations");
expect(workspace, /merchantFilterId[\s\S]{0,120}clean\(order\.merchant_id\) !== merchantFilterId/, "Merchant filter excludes every non-matching orders.merchant_id row");
expect(workspace, /matchesAdminSection/, "Bulk list respects the active operational order section");
expect(workspace, /data-admin-actions-stay-in-place="true"/, "Admin mutations preserve the current operational workspace");
expect(workspace, /dn-admin-orders-updated/, "Admin workspace applies saved and deleted order rows locally");

const driver = read("src/components/driver/DriverOrderCard.tsx");
for (const status of ["confirmed", "picked_up", "in_transit", "delivered", "cancelled", "returned"]) {
  expect(driver, new RegExp(`value: ["']${status}["']`), `Driver card exposes ${status} action`);
}
if (/value: ["']accepted["']/.test(driver)) {
  console.error("FAIL: Driver card persists the legacy accepted value instead of canonical confirmed");
  failed = true;
} else {
  console.log("PASS: Driver card does not persist the legacy accepted enum value");
}
expect(driver, /requiresNote: true/, "Risk/closure driver actions require an operational note");

const driverContact = read("src/components/driver/DriverCustomerCommunication.tsx");
const deterministicDriverMessages = read("src/services/driverActionMessageService.ts");
const messageService = read("src/services/whatsappMessageService.ts");
const messageTemplates = read("src/config/messageTemplates.ts");
expect(driver, /DriverCustomerCommunication/, "Driver card mounts the centralized customer communication console");
expect(driverContact, /prepareDeterministicDriverWhatsApp/, "Driver UI uses the deterministic per-action message layer");
expect(deterministicDriverMessages, /prepareWhatsAppMessage/, "Deterministic driver messages still use the central message service for recipients and logging");
expect(deterministicDriverMessages, /revisePreparedWhatsAppMessage/, "The action-specific body replaces stale database template content safely");
expect(driverContact, /openPreparedWhatsApp/, "Driver WhatsApp action opens only a prepared non-empty message");
expect(messageService, /buildWhatsAppUrl/, "Central message service creates encoded wa.me links");
expect(messageTemplates, /مع حضرتك \{driver_name\}، مندوب شركة داي نايت/, "Driver customer message carries the DAY NIGHT professional identity");

const driverDashboard = read("src/components/driver/DriverDashboard.tsx");
expect(driverDashboard, /updateDriverOrderStatus\(orderId, status, note\)/, "Driver status controls persist through the authoritative RPC helper");
expect(driverDashboard, /<TrackingMap[\s\S]*navigationMode/, "Driver orders open in the in-app navigation map");

const driverData = read("src/lib/driverData.ts");
expect(driverData, /rpc\(["']driver_update_order_status["']/, "Driver status helper writes through driver_update_order_status");

const adminStatus = read("src/supabaseAdminOps.ts");
expect(adminStatus, /admin_update_order_status_verified/, "Admin status updates use the verified exact-order RPC first");
expect(adminStatus, /fetchPersistedOrder/, "Admin status changes are read back from the production orders row");
expect(adminStatus, /persistedStatusIsValid/, "Admin status success requires persisted status verification");
expect(adminStatus, /financial_posted_at/, "Delivered status verifies financial posting before success");
expect(adminStatus, /affected_zero_rows/, "Zero affected rows are treated as a failure");
expect(adminStatus, /\.eq\("id", existing\.id\)/, "Direct compatibility updates target one exact order UUID");
reject(adminStatus, /if \(!rpcResult\.error && rpcResult\.data\)\s*\{\s*return true/, "A non-error RPC response cannot create false success without read-back");

const statusMigration = read("../../supabase/migrations/20260727131500_admin_order_status_persistence_fix.sql");
expect(statusMigration, /admin_update_order_status_verified/, "Status persistence migration creates the authoritative RPC");
expect(statusMigration, /order_status_update_affected_zero_rows/, "Database RPC rejects zero-row updates");
expect(statusMigration, /order_status_readback_mismatch/, "Database RPC verifies the stored status inside its transaction");
expect(statusMigration, /financial_posted_at = coalesce\(financial_posted_at, \$4\)/, "Deliver and post is atomic for normal orders");
expect(statusMigration, /deferred_zero_merchant/, "Intentional zero-value merchant accounting remains deferred");
expect(statusMigration, /admin_order_status_persistence_health/, "Migration publishes a production health RPC");

const statements = read("src/components/admin/AdminMerchantStatementsCenterPdf.tsx");
expect(statements, /merchants\.map/, "Merchant statements list every registered merchant");
expect(statements, /selectedOrderIds/, "Merchant statements support exact multi-order selection");
expect(statements, /MerchantStatementExportButton/, "Selected merchant orders use a real production PDF flow");
expect(statements, /wa\.me\/[\s\S]*whatsappMessage/, "Selected merchant orders have a prefilled merchant WhatsApp summary");
expect(statements, /allTime/, "Merchant statement can show the merchant's complete order history");
expect(statements, /onPdfCreated=\{\(\) => recordPdfExport/, "Statement status is recorded only after successful PDF creation");
expect(statements, /فتح واتساب — بدون تغيير الحالة|Open WhatsApp — no status change/, "WhatsApp explicitly leaves PDF statement status unchanged");

const portalRuntime = read("src/components/portals/PortalRuntimeOverlay.tsx");
expect(portalRuntime, /dn-portal-mobile-scroll-fix\.css/, "Portal runtime imports the final mobile scroll contract last");

const portalScroll = read("src/styles/dn-portal-mobile-scroll-fix.css");
expect(portalScroll, /dn-driver-shell-v3\.dn-driver-exact-shell/, "Driver dashboard mobile scroll is explicitly unlocked");
expect(portalScroll, /dn-merchant-app/, "Merchant dashboard mobile scroll is explicitly unlocked");
expect(portalScroll, /touch-action:\s*pan-y/, "Touch vertical panning is explicitly enabled");

const realtime = read("src/components/ProductionOrderRealtimeBridge.tsx");
expect(realtime, /table: ["']orders["']/, "Admin subscribes to real order changes");
expect(realtime, /order_status_history/, "Admin subscribes to status-history changes");
expect(realtime, /publishOrderMutation/, "Realtime order changes are converted into exact row mutations");
expect(realtime, /dn-admin-orders-updated/, "Realtime order changes update the open admin workspace locally");
expect(realtime, /dn-admin-order-status-change/, "Realtime status history patches the affected order locally");
reject(realtime, /clickAdminRefresh|window\.location\.reload/, "Realtime changes never trigger a global page refresh");

const styles = read("src/styles/dn-operations-control-rescue.css");
expect(styles, /dn-section-table-wrap tbody tr/, "Admin order rows have explicit high-contrast styling");
expect(styles, /dn-admin-bulk-console/, "Bulk operations console has production styling");
expect(styles, /dn-merchant-mobile-sheet-backdrop/, "Merchant desktop/mobile navigation collision is guarded");

const pricingFiles = [
  "src/components/DeliveryUAE.tsx",
  "src/components/RequestDelivery.tsx",
  "src/components/SmartChat.tsx",
  "src/data/pricingEstimate.ts",
  "src/data/aiAgentKnowledge.ts",
  "src/supabase.ts",
].map(read).join("\n");
if (/(?:PRICE|Price|price|سعر|درهم|AED).{0,55}\b30\b|\b30\b.{0,55}(?:PRICE|Price|price|سعر|درهم|AED)/s.test(pricingFiles)) {
  console.error("FAIL: a customer-facing local price still references 30 AED");
  failed = true;
} else {
  console.log("PASS: all customer-facing local price paths are clear of 30 AED");
}

const combined = `${bulk}\n${workspace}\n${driver}\n${driverContact}\n${deterministicDriverMessages}\n${messageService}\n${driverDashboard}\n${driverData}\n${adminStatus}\n${statements}\n${realtime}`;
if (/Math\.random|demoOrders|mockOrders|localStorage\.setItem\([^)]*order/i.test(combined)) {
  console.error("FAIL: operational controls contain mock/random/local order persistence");
  failed = true;
} else {
  console.log("PASS: no mock/random/local order persistence in the operational controls");
}

if (failed) {
  console.error("Operations order-control gate FAILED.");
  process.exit(1);
}

console.log("Operations order-control gate PASSED.\n");
