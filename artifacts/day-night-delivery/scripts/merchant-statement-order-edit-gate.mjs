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

console.log("\n--- DAY NIGHT merchant statement & order edit gate ---");

const statement = read("src/components/admin/AdminMerchantStatementsCenter.tsx");
const exporter = read("src/lib/merchantStatementExport.ts");
const exportButton = read("src/components/admin/MerchantStatementExportButton.tsx");
const editModal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const editModalBoundary = read("src/components/admin/AdminOrderEditModal.tsx");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const migration = read("../../supabase/migrations/20260727090000_precise_zero_goods_delivery_settlement.sql");
const precisePlugin = read("scripts/precise-financial-rule-plugin.ts");

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
expect(exportButton, /CUSTOMER_PAID_ZERO_GOODS_SENTINEL/, "Zero-goods customer-paid rows retain their real customer total in PDF and CSV");
expect(exportButton, /Math\.abs\(customerTotal - deliveryFee\)/, "Statement protection requires customer total to equal delivery");
reject(exportButton, /DEFAULT_ZERO_ORDER_DELIVERY_FEE\s*=\s*180/, "Statement export does not fabricate the obsolete 180 AED fallback");
expect(migration, /manual_delivery_price[\s\S]*resolved_mode/, "Database migration resolves explicit zero and positive manual delivery separately");
reject(migration, /if\s+v_goods\s*=\s*0\s+and\s+v_fee\s*>\s*0/i, "Database function does not force all zero-goods orders onto merchant");
expect(precisePlugin, /manual !== null && manual > 0/, "Manual zero uses official pricing while retaining merchant liability intent");

expect(
  editModal,
  /حفظ(?: كل)? التعديلات(?: الآن)?|Save(?: all)? changes(?: now)?/,
  "Order edit has an explicit visible save button",
);
expect(editModal, /sticky bottom-0/, "Order update controls remain visible while scrolling");
expect(editModal, /saveAdminOrderEdit/, "Order edits use verified persistence");
expect(editModal, /dn-admin-orders-updated/, "Successful edits notify the live admin workspace");
expect(editModalBoundary, /setLastSavedOrder\(savedOrder\)/, "Verified saves keep the order editor mounted");
expect(editModalBoundary, /if \(lastSavedOrder\) await onSaved\?\.\(lastSavedOrder\)/, "Parent refresh is deferred until explicit close");
expect(editModalBoundary, /onClose=\{\(\) => void handleExplicitClose\(\)\}/, "Only the explicit close action exits the order editor");
expect(
  persistence,
  /select\("\*"\)[\s\S]*\.limit\(1\)[\s\S]*data\?\.\[0\]\?\.id/s,
  "Database update verifies the returned order row",
);
expect(persistence, /financialsAreLocked/, "Delivered financial snapshots remain protected");
expect(persistence, /corePatch/, "Delivered orders still allow safe core-data edits");
expect(persistence, /isMissingFinancialUpdateRuntime/, "Missing RPC runtime has a controlled compatibility path");

if (failed) {
  console.error("Merchant statement & order edit gate FAILED.");
  process.exit(1);
}
console.log("Merchant statement & order edit gate PASSED.\n");
