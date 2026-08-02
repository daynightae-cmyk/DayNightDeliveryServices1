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
const dispatchClient = read("src/lib/merchantStatementDispatch.ts");
const dispatchMigration = read("../../supabase/migrations/20260802110000_merchant_statement_dispatch_tracking.sql");
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

expect(statement, /تم تحويلها للتاجر|Sent to merchant/, "Every transferred order has a clear persistent badge");
expect(statement, /لم يتم تحويلها|Not sent/, "Unsent orders remain visibly distinguished");
expect(statement, /data-merchant-dispatch-filter="true"/, "Accounting view can filter sent and unsent merchant orders");
expect(statement, /unsentTransferOrders/, "Normal WhatsApp transfer excludes previously sent orders");
expect(statement, /data-merchant-dispatch-resend="true"/, "Previously sent orders have a separate explicit resend action");
expect(statement, /data-merchant-dispatch-resend-reason="true"/, "Resending requires an operator-entered reason");
expect(statement, /data-merchant-dispatch-confirm="true"/, "Opening WhatsApp does not mark orders sent without explicit confirmation");
expect(statement, /confirmMerchantStatementDispatch/, "Confirmed transfers persist through the protected database client");
expect(statement, /dispatchReady/, "Sending fails closed while transfer history cannot be verified");
expect(
  statement,
  /const whatsappUrl = `https:\/\/wa\.me\/\$\{merchantPhone\}\?text=\$\{encodeURIComponent\(merchantWhatsAppMessage\(targetOrders\)\)\}`;/,
  "Selected merchant orders keep a prefilled WhatsApp statement URL",
);
expect(statement, /window\.open\(whatsappUrl,\s*"_blank"\)/, "WhatsApp opens through a verifiable window handoff");
expect(statement, /opened\.opener = null/, "Opened WhatsApp window is detached from the admin page");
reject(statement, /"noopener,noreferrer"/, "No false blocked-window result is caused by noopener return semantics");
reject(statement, /localStorage|sessionStorage/, "Merchant transfer history is never stored only in the browser");

expect(dispatchClient, /admin_get_merchant_statement_dispatch_status/, "Dispatch client reads authoritative per-order transfer history");
expect(dispatchClient, /admin_confirm_merchant_statement_dispatch/, "Dispatch client records confirmed transfer batches");
expect(dispatchClient, /p_resend_reason/, "Dispatch client passes the audited resend reason");
expect(dispatchClient, /ui_confirmation:\s*true/, "Dispatch writes record explicit UI confirmation");

expect(dispatchMigration, /create table if not exists public\.merchant_statement_dispatch_log/, "Database keeps a permanent merchant transfer log");
expect(dispatchMigration, /unique index[\s\S]*batch_id, order_id/i, "One order is recorded once per transfer batch");
expect(dispatchMigration, /order_row\.merchant_id = p_merchant_id/, "Database verifies every transferred order belongs to the selected merchant");
expect(dispatchMigration, /merchant_statement_resend_reason_required/, "Database blocks duplicate sending without an explicit reason");
expect(dispatchMigration, /admin_audit_events/, "Every confirmed transfer is written to the admin audit trail");
expect(dispatchMigration, /p_dry_run boolean default false/, "Production transfer RPC supports a no-write verification mode");
expect(dispatchMigration, /enable row level security/, "Merchant transfer history is protected by RLS");
reject(dispatchMigration, /alter table public\.orders\s+add column/i, "Transfer tracking does not pollute or rewrite the canonical orders table");
reject(dispatchMigration, /truncate\s+table|delete\s+from\s+public\.(orders|merchants)/i, "Transfer migration never deletes business records");

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
