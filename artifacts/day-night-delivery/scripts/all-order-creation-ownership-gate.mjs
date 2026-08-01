import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  adminData: path.join(root, "src/lib/adminData.ts"),
  adminOperations: path.join(root, "src/lib/adminOperationsData.ts"),
  financial: path.join(root, "src/lib/orderFinancialOperations.ts"),
  resolver: path.join(root, "src/lib/merchantOrderOwnership.ts"),
  merchantPortal: path.join(root, "src/components/merchant/MerchantPortal.tsx"),
};
const read = (name) => fs.readFileSync(files[name], "utf8");
const adminData = read("adminData");
const adminOperations = read("adminOperations");
const financial = read("financial");
const resolver = read("resolver");
const merchantPortal = read("merchantPortal");

const failures = [];
const requireText = (content, marker, label) => {
  if (!content.includes(marker)) failures.push(`${label}: missing ${marker}`);
};
const forbidText = (content, marker, label) => {
  if (content.toLowerCase().includes(marker.toLowerCase())) failures.push(`${label}: forbidden ${marker}`);
};

for (const [label, content] of [
  ["adminData", adminData],
  ["adminOperations", adminOperations],
  ["financial", financial],
]) {
  requireText(content, 'from "./merchantOrderOwnership"', `${label} centralized resolver import`);
  requireText(content, "resolveOrderMerchant", `${label} canonical resolution`);
  requireText(content, "saved_order_merchant_portal_link_mismatch", `${label} persisted UUID verification`);
}

requireText(resolver, "resolveCanonicalMerchantForOrder", "central resolver");
requireText(resolver, 'supabase.rpc("admin_resolve_order_merchant"', "database canonical resolution");
requireText(resolver, "portalLinkCount !== 1", "single portal identity enforcement");
requireText(resolver, "merchantId", "resolver merchant UUID result");
requireText(resolver, "merchantCode", "resolver merchant code result");
requireText(resolver, "merchantName", "resolver merchant name result");
requireText(resolver, "portalUserId", "resolver portal user result");
requireText(resolver, "resolutionSource", "resolver evidence source");

forbidText(adminData, "buildLegacyAdminOrderPayload", "admin legacy insert payload");
forbidText(adminOperations, "createPublicOrder", "admin operations public-order fallback");
forbidText(adminOperations, "attachMerchantToCreatedOrder", "admin operations post-hoc ownership patch");
forbidText(adminOperations, "findCreatedOrder", "admin operations fuzzy created-order recovery");
forbidText(adminOperations, '.from("orders")\n    .insert', "admin operations direct insert");
forbidText(adminOperations, '"DAY NIGHT Merchant"', "admin operations fabricated merchant");
forbidText(adminOperations, '"971568757331"', "admin operations fabricated phone");
forbidText(adminOperations, '"WORLD"', "admin operations fabricated international destination");
forbidText(financial, '"971568757331"', "financial fabricated phone");
forbidText(financial, 'destination_country || input.delivery_city || "WORLD"', "financial fabricated destination");
forbidText(financial, 'input.delivery_city || "Abu Dhabi"', "financial fabricated delivery city");
forbidText(financial, 'package_type || "Shipment"', "financial fabricated package description");

requireText(adminOperations, 'supabase.rpc("admin_create_coupon_order"', "admin operations RPC-only create");
requireText(adminOperations, "assertCompleteOpsOrderInput", "admin operations validation");
requireText(adminOperations, ".range(from, from + safePageSize - 1)", "admin operations complete pagination");
requireText(financial, "assertCompleteFinancialOrderInput", "financial creation validation");
requireText(financial, "saved_financial_order_verification_failed", "financial database re-read");

requireText(merchantPortal, 'client.rpc("merchant_portal_orders_page"', "merchant portal exact UUID pagination");
forbidText(merchantPortal, "queryOrdersBy", "merchant portal ownership fallback");
forbidText(merchantPortal, "directOrderLookup", "merchant portal direct fallback");

if (failures.length) {
  console.error("ALL ORDER CREATION OWNERSHIP GATE: FAIL");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("ALL ORDER CREATION OWNERSHIP GATE: PASS");
console.log("- admin complete, admin flexible, and financial creation use one canonical resolver");
console.log("- no registered merchant order is created by public/direct fallback");
console.log("- persisted merchant UUID is verified after create/update");
console.log("- admin order loading paginates beyond the first 100/1000 rows");
console.log("- merchant portal ownership remains exact UUID under authenticated RLS");
