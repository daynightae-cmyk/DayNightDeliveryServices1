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
const messageService = read("src/services/whatsappMessageService.ts");
const messageTemplates = read("src/config/messageTemplates.ts");
expect(driver, /DriverCustomerCommunication/, "Driver card mounts the centralized customer communication console");
expect(driverContact, /prepareWhatsAppMessage/, "Driver WhatsApp action is generated through the central message service");
expect(driverContact, /openPreparedWhatsApp/, "Driver WhatsApp action opens only a prepared non-empty message");
expect(messageService, /buildWhatsAppUrl/, "Central message service creates encoded wa.me links");
expect(messageTemplates, /مع حضرتك \{driver_name\}، مندوب شركة داي نايت/, "Driver customer message carries the DAY NIGHT professional identity");

const driverDashboard = read("src/components/driver/DriverDashboard.tsx");
expect(driverDashboard, /updateDriverOrderStatus\(orderId, status, note\)/, "Driver status controls persist through the authoritative RPC helper");
expect(driverDashboard, /<TrackingMap[\s\S]*navigationMode/, "Driver orders open in the in-app navigation map");

const driverData = read("src/lib/driverData.ts");
expect(driverData, /rpc\(["']driver_update_order_status["']/, "Driver status helper writes through driver_update_order_status");

const statements = read("src/components/admin/AdminMerchantStatementsCenter.tsx");
expect(statements, /merchants\.map/, "Merchant statements list every registered merchant");
expect(statements, /selectedOrderIds/, "Merchant statements support exact multi-order selection");
expect(statements, /AdminPdfExportButton/, "Selected merchant orders use the real PDF/CSV/Word exporter");
expect(statements, /wa\.me\/[\s\S]*merchantWhatsAppMessage/, "Selected merchant orders have a prefilled merchant WhatsApp statement");
expect(statements, /allTime/, "Merchant statement can show the merchant's complete order history");

const portalRuntime = read("src/components/portals/PortalRuntimeOverlay.tsx");
expect(portalRuntime, /dn-portal-mobile-scroll-fix\.css/, "Portal runtime imports the final mobile scroll contract last");

const portalScroll = read("src/styles/dn-portal-mobile-scroll-fix.css");
expect(portalScroll, /dn-driver-shell-v3\.dn-driver-exact-shell/, "Driver dashboard mobile scroll is explicitly unlocked");
expect(portalScroll, /dn-merchant-app/, "Merchant dashboard mobile scroll is explicitly unlocked");
expect(portalScroll, /touch-action:\s*pan-y/, "Touch vertical panning is explicitly enabled");

const realtime = read("src/components/ProductionOrderRealtimeBridge.tsx");
expect(realtime, /table: ["']orders["']/, "Admin subscribes to real order changes");
expect(realtime, /order_status_history/, "Admin subscribes to status-history changes");
expect(realtime, /clickAdminRefresh/, "Realtime changes refresh the existing authoritative admin loader");

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

const combined = `${bulk}\n${workspace}\n${driver}\n${driverContact}\n${messageService}\n${driverDashboard}\n${driverData}\n${statements}\n${realtime}`;
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
