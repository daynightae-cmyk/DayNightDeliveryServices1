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
expect(workspace, /clean\(order\.merchant_id\) === merchantFilterId/, "Merchant filter uses orders.merchant_id only");
expect(workspace, /matchesAdminSection/, "Bulk list respects the active operational order section");

const driver = read("src/components/driver/DriverOrderCard.tsx");
for (const status of ["confirmed", "accepted", "picked_up", "in_transit", "delivered", "cancelled", "returned"]) {
  expect(driver, new RegExp(`value: [\"']${status}[\"']`), `Driver card exposes ${status} action`);
}
expect(driver, /requiresNote: true/, "Risk/closure driver actions require an operational note");

const realtime = read("src/components/ProductionOrderRealtimeBridge.tsx");
expect(realtime, /table: [\"']orders[\"']/, "Admin subscribes to real order changes");
expect(realtime, /order_status_history/, "Admin subscribes to status-history changes");
expect(realtime, /clickAdminRefresh/, "Realtime changes refresh the existing authoritative admin loader");

const styles = read("src/styles/dn-operations-control-rescue.css");
expect(styles, /dn-section-table-wrap tbody tr/, "Admin order rows have explicit high-contrast styling");
expect(styles, /dn-admin-bulk-console/, "Bulk operations console has production styling");
expect(styles, /dn-merchant-mobile-sheet-backdrop/, "Merchant desktop/mobile navigation collision is guarded");

const combined = `${bulk}\n${workspace}\n${driver}\n${realtime}`;
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
