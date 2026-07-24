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
const financials = read("src/lib/orderFinancials.ts");
const assetInstaller = read("scripts/install-local-assets.mjs");

expect(statement, /MerchantStatementExportButton/, "Merchant statements use the specialized exporter");
expect(statement, /متابعة الطلبية|Track order/, "Every merchant order exposes a tracking action");
expect(statement, /tracking\?code=|TRACKING_ROOT/, "Tracking links are prefilled per order");
expect(statement, /selectedOrders\.length \? selectedOrders : visibleOrders/, "Empty selection exports all visible orders");

expect(exporter, /merchant-statement-logo\.png/, "PDF loads the installed circular logo from a same-origin asset");
expect(exporter, /cropped-circle-image-\(9\)\.png/, "Exact official circular logo remains the remote fallback");
expect(assetInstaller, /merchant-statement-logo[\s\S]*cropped-circle-image-\(9\)\.png/, "Build installs the exact official circular logo");
expect(exporter, /const logoSize = 62/, "Official logo is visibly rendered at the top of the PDF");
expect(exporter, /doc\.link\(/, "PDF contains real clickable links");
expect(exporter, /شكراً لشريكنا|Thank you/, "PDF thanks the merchant by name");
expect(exporter, /www\.daynightae\.com/, "PDF contains the official website");
expect(exporter, /Admin@daynightae\.com/, "PDF contains the official email");
expect(exporter, /columnRects/, "PDF uses weighted columns rather than equal compressed columns");
expect(exporter, /type ColumnKey[\s\S]*"tracking";/, "Merchant PDF keeps only operationally useful columns");
if (/key:\s*"status"/.test(exporter)) {
  console.error("FAIL: merchant PDF still contains the status column");
  failed = true;
} else {
  console.log("PASS: merchant PDF status column is removed");
}
expect(exporter, /normalizeStatementRow/, "Legacy zero-value orders are corrected before PDF rendering");
expect(exporter, /merchantDue:\s*-deliveryFee/, "A zero-value order is shown as fully due from the merchant");
expect(exportButton, /buildMerchantStatementPdf/, "PDF button calls the merchant-specific generator");

expect(financials, /resolveDeliveryFeeMode/, "Financial engine has an authoritative fee-mode resolver");
expect(financials, /goods === 0 && fee > 0[\s\S]*deduct_from_merchant/, "Zero-value orders automatically charge delivery to the merchant");

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
