import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");

const normalization = read("src/lib/searchNormalization.ts");
const adminWorkspace = read("src/components/admin/AdminSectionWorkspace.tsx");
const adminPanel = read("src/components/AdminPanelLuxury.tsx");
const adminBulk = read("src/components/admin/AdminOrderBulkOperations.tsx");
const adminComplete = read("src/components/admin/AdminSectionWorkspaceComplete.tsx");
const international = read("src/components/admin/AdminInternationalOrdersWorkspace.tsx");
const commandPanel = read("src/components/admin/command-center/AdminPanelCommandCenter.tsx");
const commandShell = read("src/components/admin/command-center/AdminCommandCenterShell.tsx");
const merchantPortal = read("src/components/merchant/MerchantPortalCommandCenter.tsx");
const merchantOrders = read("src/portal-designs/merchant/MerchantOrdersView.tsx");
const merchantStatements = read("src/components/admin/AdminMerchantStatementsCenterPdf.tsx");
const merchantAccounts = read("src/components/admin/AdminMerchantAccountsCenter.tsx");
const liveMap = read("src/components/admin/AdminLiveOperationsMap.tsx");
const adminData = read("src/lib/adminData.ts");

for (const token of ["٠-٩۰-۹", "normalize(\"NFKC\")", "searchTokens", "tokens.every", "\\p{L}", "\\p{N}"]) {
  assert.ok(normalization.includes(token), `search normalization contains ${token}`);
}
assert.match(normalization, /compactHaystack/);
assert.match(normalization, /replaceAll\(" ", ""\)/);

assert.match(adminWorkspace, /matchesSearchQuery\(orderSearchValues\(order\), bulkQuery\)/);
assert.match(adminBulk, /data-admin-order-search="true"/);
assert.match(adminComplete, /searchManaged \? baseRows/);
assert.match(adminWorkspace, /searchManaged=\{showBulkConsole\}/);
assert.match(adminWorkspace, /<AdminInternationalOrdersWorkspace[\s\S]*?searchManaged/);
assert.doesNotMatch(adminComplete, /\.slice\(0,\s*200\)/);

assert.doesNotMatch(commandPanel, /searchOrders\.slice\(/);
assert.doesNotMatch(commandPanel, /searchMerchants\.slice\(/);
assert.match(commandPanel, /searchValues:\s*\[[\s\S]*?coupon_number/);
assert.match(commandPanel, /setSearchError\(/);
assert.match(commandShell, /matchesSearchQuery/);
assert.match(commandShell, /searchError/);
assert.match(commandShell, /onRetrySearch/);
assert.match(commandPanel, /dn-admin-open-merchant-orders/);
assert.match(adminPanel, /dn-admin-open-merchant-orders/);

for (const field of ["tracking_number", "invoice_number", "coupon_number", "receiver_phone", "sender_phone", "merchant_name", "merchant_code"]) {
  assert.ok(adminData.includes(`${field}.ilike`), `paginated admin search includes ${field}`);
}
assert.doesNotMatch(adminData, /ordersResult\.status === "fulfilled" \? ordersResult\.value : \[\]/);

assert.match(merchantOrders, /matchesSearchQuery/);
assert.match(merchantPortal, /const invoiceResults=/);
assert.match(merchantPortal, /const settlementResults=/);
assert.match(merchantPortal, /const resultGroups=/);
assert.match(merchantPortal, /resultGroups\.some/);
assert.match(merchantPortal, /fetchAllMerchantPortalOrders/);

const statementOwnership = merchantStatements.match(/function merchantOwnsOrder[\s\S]*?\n}/)?.[0] || "";
assert.match(statementOwnership, /order\.merchant_id/);
assert.doesNotMatch(statementOwnership, /order\.merchant_(code|name)/);

const accountOwnership = merchantAccounts.match(/function ownsOrder[\s\S]*?\n}/)?.[0] || "";
assert.match(accountOwnership, /order\.merchant_id/);
assert.doesNotMatch(accountOwnership, /order\.merchant_(code|name)/);
assert.match(merchantAccounts, /matchesSearchQuery/);
assert.match(merchantAccounts, /بحث داخل حساب التاجر فقط|Search this merchant only/);

assert.match(liveMap, /const visibleOrders = filteredOrders;/);
assert.doesNotMatch(liveMap, /filteredOrders\.length \? filteredOrders : sortedOrders/);
assert.doesNotMatch(liveMap, /visibleOrders\.slice\(0,\s*120\)/);
assert.doesNotMatch(international, /searchText\(order, shipment\)\.includes/);
assert.match(adminData, /\.order\("id", \{ ascending: true \}\)/);

console.log("PASS system-wide admin and merchant search integrity gate");
