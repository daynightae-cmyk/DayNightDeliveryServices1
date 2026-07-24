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

console.log("\n--- DAY NIGHT merchant statement & order edit gate ---");

const statement = read("src/components/admin/AdminMerchantStatementsCenter.tsx");
const exporter = read("src/lib/merchantStatementExport.ts");
const exportButton = read("src/components/admin/MerchantStatementExportButton.tsx");
const editModal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const migration = read("../../supabase/migrations/20260724070000_recover_zero_order_delivery_fee.sql");

expect(statement, /MerchantStatementExportButton/, "Merchant statements use the specialized exporter");
expect(statement, /متابعة الطلبية|Track order/, "Every merchant order exposes a tracking action");
expect(statement, /tracking\?code=|TRACKING_ROOT/, "Tracking links are prefilled per order");
expect(statement, /selectedOrders\.length \? selectedOrders : visibleOrders/, "Empty selection exports all visible orders");
expect(exporter, /merchant-statement-logo\.png/, "Official circular DAY NIGHT logo is loaded from a local build asset");
expect(exporter, /doc\.link\(/, "PDF contains real clickable links");
expect(exporter, /شكراً لشريكنا|Thank you/, "PDF thanks the merchant by name");
expect(exporter, /www\.daynightae\.com/, "PDF contains the official website");
expect(exporter, /Admin@daynightae\.com/, "PDF contains the official email");
expect(exporter, /columnRects/, "PDF uses weighted columns rather than equal compressed columns");
expect(exporter, /type ColumnKey[\s\S]*\| "tracking";/, "Merchant PDF column contract ends with tracking and excludes status");
expect(exportButton, /buildMerchantStatementPdf/, "PDF button calls the merchant-specific generator");
expect(exportButton, /DEFAULT_ZERO_ORDER_DELIVERY_FEE\s*=\s*180/, "Unresolved zero-value orders receive the approved 180 AED fallback fee");
expect(exportButton, /merchantDue:\s*-effectiveFee/, "Zero-value statement rows are charged fully to the merchant");
expect(exportButton, /normalizeZeroOrderPayload/, "PDF and CSV normalize zero-value rows before export");
expect(migration, /greatest\([\s\S]*180[\s\S]*merchant_due\s*=\s*-r\.effective_fee/, "Database backfill recovers hidden fees and charges zero-value rows to merchant");

expect(editModal, /تحديث الطلب الآن|Update order now/, "Order edit has an explicit visible update button");
expect(editModal, /sticky bottom-0/, "Order update controls remain visible while scrolling");
expect(editModal, /saveAdminOrderEdit/, "Order edits use verified persistence");
expect(editModal, /dn-admin-orders-updated/, "Successful edits notify the live admin workspace");
expect(persistence, /select\("\*"\)\s*\.single\(\)/s, "Database update verifies the returned order row");
expect(persistence, /financialsAreLocked/, "Delivered financial snapshots remain protected");
expect(persistence, /corePatch/, "Delivered orders still allow safe core-data edits");
expect(persistence, /isMissingFinancialUpdateRuntime/, "Missing RPC runtime has a controlled compatibility path");

if (failed) {
  console.error("Merchant statement & order edit gate FAILED.");
  process.exit(1);
}
console.log("Merchant statement & order edit gate PASSED.\n");
