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

const statement = read("src/components/admin/AdminMerchantStatementsCenterPdf.tsx");
const accounts = read("src/components/admin/AdminMerchantAccountsCenter.tsx");
const accountsRoute = read("src/components/admin/AdminMerchantAccountsRoute.tsx");
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
expect(statement, /متابعة|Track/, "Every merchant order exposes a tracking action");
expect(statement, /tracking\?code=|TRACKING_ROOT/, "Tracking links are prefilled per order");
expect(statement, /const scopeOrders = selectedOrders\.length \? selectedOrders : visibleOrders/, "Empty selection exports all visible orders");
expect(exporter, /merchant-statement-logo\.png/, "Official circular DAY NIGHT logo is loaded from a local build asset");
expect(exporter, /doc\.link\(/, "PDF contains real clickable links");
expect(exporter, /شكراً لشريكنا|Thank you/, "PDF thanks the merchant by name");
expect(exporter, /www\.daynightae\.com/, "PDF contains the official website");
expect(exporter, /Admin@daynightae\.com/, "PDF contains the official email");
expect(exporter, /columnRects/, "PDF uses weighted columns rather than equal compressed columns");
expect(exporter, /type ColumnKey[\s\S]*\| "tracking";/, "Merchant PDF column contract ends with tracking and excludes status");
expect(exportButton, /buildMerchantStatementPdf/, "PDF button calls the merchant-specific generator");
expect(exportButton, /await buildMerchantStatementPdf\(protectedPayload\)[\s\S]*pdfCreated = true[\s\S]*await onPdfCreated\?\.\(\)/, "Database status callback runs only after PDF creation succeeds");
expect(exportButton, /CUSTOMER_PAID_ZERO_GOODS_SENTINEL/, "Zero-goods customer-paid rows retain their real customer total in PDF and CSV");
expect(exportButton, /Math\.abs\(customerTotal - deliveryFee\)/, "Statement protection requires customer total to equal delivery");
reject(exportButton, /DEFAULT_ZERO_ORDER_DELIVERY_FEE\s*=\s*180/, "Statement export does not fabricate the obsolete 180 AED fallback");
expect(migration, /manual_delivery_price[\s\S]*resolved_mode/, "Database migration resolves explicit zero and positive manual delivery separately");
reject(migration, /if\s+v_goods\s*=\s*0\s+and\s+v_fee\s*>\s*0/i, "Database function does not force all zero-goods orders onto merchant");
expect(precisePlugin, /manual !== null && manual > 0/, "Manual zero uses official pricing while retaining merchant liability intent");

expect(statement, /تم تضمينها في كشف PDF|Included in a PDF statement/, "Every PDF-exported order has a clear persistent badge");
expect(statement, /لم تدخل كشف PDF|Not included in PDF/, "Orders outside PDF statements remain visibly distinguished");
expect(statement, /data-merchant-dispatch-filter="true"/, "Accounting view can filter PDF-exported and not-exported orders");
expect(statement, /newPdfOrders/, "Normal PDF creation excludes orders already included in a prior PDF");
expect(statement, /data-merchant-dispatch-resend="true"/, "Previously exported orders have a separate explicit re-export action");
expect(statement, /data-merchant-dispatch-resend-reason="true"/, "Re-exporting requires an operator-entered reason");
expect(statement, /onPdfCreated=\{\(\) => recordPdfExport/, "Successful PDF generation is the only UI trigger that records statement inclusion");
expect(statement, /confirmMerchantStatementDispatch/, "Successful PDF exports persist through the protected database client");
expect(statement, /statusReady/, "PDF export fails closed while statement history cannot be verified");
expect(statement, /فتح واتساب — بدون تغيير الحالة|Open WhatsApp — no status change/, "WhatsApp explicitly does not change statement status");
expect(statement, /https:\/\/wa\.me\/\$\{merchantPhone\}\?text=\$\{encodeURIComponent\(whatsappMessage\(scopeOrders\)\)\}/, "Selected merchant orders keep a prefilled WhatsApp summary URL");
reject(statement, /localStorage|sessionStorage/, "Merchant PDF history is never stored only in the browser");

expect(dispatchClient, /admin_get_merchant_statement_dispatch_status/, "Dispatch client reads authoritative per-order statement history");
expect(dispatchClient, /admin_confirm_merchant_statement_dispatch/, "Dispatch client records successful PDF statement batches");
expect(dispatchClient, /p_channel:\s*"pdf_only"/, "Statement status records PDF-only channel semantics");
expect(dispatchClient, /p_resend_reason/, "Dispatch client passes the audited re-export reason");
expect(dispatchClient, /pdf_generation_succeeded:\s*true/, "Statement records declare verified PDF generation");
expect(dispatchClient, /whatsapp_changes_status:\s*false/, "WhatsApp cannot change statement status");

expect(dispatchMigration, /create table if not exists public\.merchant_statement_dispatch_log/, "Database keeps a permanent merchant statement log");
expect(dispatchMigration, /unique index[\s\S]*batch_id, order_id/i, "One order is recorded once per statement batch");
expect(dispatchMigration, /order_row\.merchant_id = p_merchant_id/, "Database verifies every statement order belongs to the selected merchant");
expect(dispatchMigration, /merchant_statement_resend_reason_required/, "Database blocks repeated PDF statement recording without an explicit reason");
expect(dispatchMigration, /admin_audit_events/, "Every recorded statement is written to the admin audit trail");
expect(dispatchMigration, /p_dry_run boolean default false/, "Production statement RPC supports a no-write verification mode");
expect(dispatchMigration, /enable row level security/, "Merchant statement history is protected by RLS");
reject(dispatchMigration, /alter table public\.orders\s+add column/i, "Statement tracking does not pollute or rewrite the canonical orders table");
reject(dispatchMigration, /truncate\s+table|delete\s+from\s+public\.(orders|merchants)/i, "Statement migration never deletes business records");

expect(accounts, /data-admin-merchant-accounts-directory="true"/, "Accounts opens with a merchant directory instead of a mixed ledger table");
expect(accounts, /ownsOrder\(order, merchant\.id\)/, "Merchant orders are isolated by exact merchant UUID");
expect(accounts, /ownsLedgerRow\(row, merchant\.id\)/, "Merchant ledger rows are isolated by exact merchant UUID");
expect(accounts, /groupDuplicateLedgerRows/, "Identical accounting rows are collapsed visually without deleting database rows");
expect(accounts, /ملخص الحساب|Account summary/, "Merchant account has a professional summary tab");
expect(accounts, /طلبيات التاجر|Merchant orders/, "Merchant account has an isolated orders tab");
expect(accounts, /الحركات المالية|Finance ledger/, "Merchant account has an isolated ledger tab");
expect(accountsRoute, /fetchFinanceLedgerSnapshot/, "Merchant account route loads the authoritative finance snapshot");
expect(accountsRoute, /AdminMerchantAccountsCenter/, "Merchant account route renders the isolated merchant workspace");
expect(accountsRoute, /No mixed or fabricated fallback was shown|لم يتم عرض بيانات بديلة أو مختلطة/, "Merchant account load failures never show mixed fallback data");

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
