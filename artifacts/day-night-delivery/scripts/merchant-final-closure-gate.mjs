import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
let failures = 0;
const pass = (message) => console.log(`PASS: ${message}`);
const fail = (message) => { failures += 1; console.error(`FAIL: ${message}`); };
const assert = (condition, message) => condition ? pass(message) : fail(message);
const read = (relative) => {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) { fail(`${relative} exists`); return ""; }
  pass(`${relative} exists`);
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
};

console.log("\n--- DAY NIGHT Merchant final closure gate ---");

const requiredFiles = [
  "src/components/merchant/MerchantPortalCommandCenter.tsx",
  "src/portal-designs/merchant/MerchantPortalShell.tsx",
  "src/portal-designs/merchant/MerchantSectionRenderer.tsx",
  "src/portal-designs/merchant/MerchantCreateOrderView.tsx",
  "src/portal-designs/merchant/MerchantCouponPhotoIntake.tsx",
  "src/portal-designs/merchant/MerchantOrdersView.tsx",
  "src/portal-designs/merchant/MerchantOrderDetailsView.tsx",
  "src/portal-designs/merchant/MerchantWorkspaces.tsx",
  "src/portal-designs/merchant/MerchantBusinessWorkspace.tsx",
  "src/portal-designs/merchant/merchantViewModels.ts",
  "src/portal-designs/merchant/merchantCallbacks.ts",
  "src/styles/dn-merchant-command-center.css",
  "MERCHANT_PORTAL_INTEGRATION.md",
  "MERCHANT_PORTAL_FILE_MANIFEST.md",
  "MERCHANT_PORTAL_CALLBACK_CONTRACTS.md",
  "MERCHANT_PORTAL_AUDIT_REPORT.md",
];
const contents = new Map(requiredFiles.map((file) => [file, read(file)]));
const controller = contents.get("src/components/merchant/MerchantPortalCommandCenter.tsx") || "";
const renderer = contents.get("src/portal-designs/merchant/MerchantSectionRenderer.tsx") || "";
const viewModels = contents.get("src/portal-designs/merchant/merchantViewModels.ts") || "";
const callbacks = contents.get("src/portal-designs/merchant/merchantCallbacks.ts") || "";
const createOrder = contents.get("src/portal-designs/merchant/MerchantCreateOrderView.tsx") || "";
const coupon = contents.get("src/portal-designs/merchant/MerchantCouponPhotoIntake.tsx") || "";
const workspaces = contents.get("src/portal-designs/merchant/MerchantWorkspaces.tsx") || "";
const business = contents.get("src/portal-designs/merchant/MerchantBusinessWorkspace.tsx") || "";
const css = contents.get("src/styles/dn-merchant-command-center.css") || "";
const app = read("src/App.tsx");
const migrationFoundation = read("../../supabase/migrations/20260721120000_merchant_business_center.sql");
const migrationRuntime = read("../../supabase/migrations/20260721123000_merchant_business_center_runtime.sql");

const sectionIds = [
  "dashboard", "new_order", "orders", "order_details", "tracking", "pickup_requests",
  "returns", "cancelled", "postponed", "under_review", "import_shipments", "cod",
  "settlements", "statements", "invoices", "wallet", "transactions", "analytics",
  "reports", "branches", "pickup_addresses", "address_book", "profile", "branding",
  "business_details", "bank_details", "documents", "team", "notifications", "support",
  "integrations", "settings", "security",
];
assert(new Set(sectionIds).size === 33, "exactly 33 Merchant section identifiers are audited");
for (const id of sectionIds) {
  assert(viewModels.includes(`| \"${id}\"`) || viewModels.includes(`= \"${id}\"`), `view model contains ${id}`);
  assert(renderer.includes(`case \"${id}\"`) || renderer.includes(`case \"${id}\":`), `renderer covers ${id}`);
}
assert(renderer.includes("const exhaustive: never = section"), "section renderer is exhaustive");
assert(!renderer.includes("../demo/"), "production renderer does not import Demo fixtures");

for (const token of [
  "merchant_get_session_profile", "merchant_claim_approved_account", "merchant_portal_orders",
  "merchant_portal_business_center", "merchant_create_order", "merchant_create_pickup_request",
  "merchant_create_support_ticket", "merchant_request_order_action", "merchant_update_bank_details",
  "merchant_save_branch", "merchant_save_address_book_entry", "merchant_save_team_member",
  "merchant_create_import_preview", "merchant_commit_import", "merchant_mark_notification_read",
  "TrackingMap", "postgres_changes", "merchant-coupon-images", "merchant-assets", "merchant-documents",
]) assert(controller.includes(token), `controller integrates ${token}`);
assert(controller.includes("calculateDeliveryPrice"), "controller uses the existing pricing client");
assert(controller.includes("buildAdminPdf") && controller.includes("buildAdminCsv"), "controller uses existing PDF and CSV export infrastructure");
assert(app.includes('import("./components/merchant/MerchantPortalCommandCenter")'), "production /merchant route loads the new Merchant Command Center");
assert(!app.includes("MerchantDesignPreview"), "production App contains no Merchant design-preview route");

for (const token of ["pickup", "recipient", "package", "service", "pricing", "review", "created"]) {
  assert(createOrder.includes(`\"${token}\"`), `order wizard contains ${token} step`);
}
for (const token of ["onCalculatePrice", "onCreateOrder", "trackingNumber", "invoiceNumber", "Coupon photo intake"]) {
  assert(createOrder.includes(token) || coupon.includes(token), `order/coupon flow contains ${token}`);
}
for (const token of ['capture="environment"', 'Upload', 'confidence', 'onUseFields', 'URL.createObjectURL']) {
  assert(coupon.includes(token) || coupon.toLowerCase().includes(token.toLowerCase()), `coupon intake contains ${token}`);
}

for (const token of [
  "MerchantTrackingWorkspace", "MerchantPickupRequestsWorkspace", "MerchantExceptionWorkspace",
  "MerchantImportWorkspace", "MerchantFinanceWorkspace", "MerchantAnalyticsWorkspace", "MerchantControlWorkspace",
]) assert(workspaces.includes(token), `operations workspace exports ${token}`);
for (const token of ["profile", "branding", "business_details", "bank_details", "branches", "pickup_addresses", "address_book", "documents", "team"]) {
  assert(business.includes(`section===\"${token}\"`) || business.includes(`section === \"${token}\"`) || business.includes(`case \"${token}\"`) || (token === "team" && business.includes("TeamManager")), `business workspace handles ${token}`);
}

for (const token of [
  "MerchantCreateOrderResult", "MerchantPricingResult", "MerchantOrderTransitionResult",
  "MerchantImportPreviewResult", "MerchantImportCommitResult", "MerchantProfileUpdateResult",
  "MerchantSupportResult", "MerchantGlobalSearchResult",
]) assert(callbacks.includes(token), `typed callback result exists: ${token}`);

const productionFiles = [controller, renderer, viewModels, callbacks, createOrder, coupon, workspaces, business, css].join("\n");
const forbidden = [
  ["Math.random(", "no random business data"],
  ["alert(", "no alert-based business operations"],
  ["onClick={() => {}}", "no explicit no-op click handlers"],
  ["Promise<boolean>", "no generic boolean integration results"],
  ["payload?: any", "no any navigation payload"],
  ["Demo Field", "no Demo Field placeholder"],
  ["John Doe", "no hardcoded fictional customer"],
  ["Coming Soon", "no Coming Soon placeholder"],
  ["قريباً", "no Arabic coming-soon placeholder"],
  ["text-[9px]", "no 9px operational text"],
  ["text-[10px]", "no 10px operational text"],
  ["text-[11px]", "no 11px operational text"],
];
for (const [needle, message] of forbidden) assert(!productionFiles.includes(needle), message);

for (const token of ["--dnm-bg", ".dn-merchant-app.is-dark", "inset-inline-start", "font-size:14px", "@media(max-width:600px)"]) {
  assert(css.includes(token), `Merchant responsive/theme CSS contains ${token}`);
}

for (const token of [
  "merchant_branches", "merchant_pickup_requests", "merchant_address_book", "merchant_documents",
  "merchant_team_members", "merchant_order_action_requests", "merchant_support_tickets",
  "merchant_create_pickup_request", "merchant_create_support_ticket", "merchant_update_bank_details",
  "merchant-assets", "merchant-coupon-images", "merchant-documents",
]) assert(migrationFoundation.includes(token), `foundation migration contains ${token}`);
for (const token of [
  "merchant_notifications", "merchant_create_order", "merchant_save_branch",
  "merchant_save_address_book_entry", "merchant_save_team_member", "merchant_create_import_preview",
  "merchant_commit_import", "merchant_mark_notification_read", "merchant_order_notification_trigger",
  "merchant_portal_business_center",
]) assert(migrationRuntime.includes(token), `runtime migration contains ${token}`);
for (const migration of [migrationFoundation, migrationRuntime]) {
  assert(migration.trimStart().toLowerCase().startsWith("-- day night") && migration.includes("begin;") && migration.trimEnd().endsWith("commit;"), "migration is transaction wrapped");
  assert((migration.match(/\$\$/g) || []).length % 2 === 0, "migration has balanced dollar quote delimiters");
  assert((migration.match(/\(/g) || []).length === (migration.match(/\)/g) || []).length, "migration has balanced parentheses");
}

if (failures > 0) {
  console.error(`\nMerchant final closure gate failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log("\nMerchant final closure gate passed.");
