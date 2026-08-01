import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminDataPath = path.join(root, "artifacts/day-night-delivery/src/lib/adminData.ts");
const financialPath = path.join(root, "artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts");

function replaceExactly(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

let adminData = fs.readFileSync(adminDataPath, "utf8");
adminData = adminData.replace(
  'import { resolveOrderMerchant } from "./orderFinancialOperations";',
  'import { resolveOrderMerchant } from "./merchantOrderOwnership";',
);
adminData = adminData.replace(
  'if (!supabase) return [];\n\n  const { data, error } = await supabase\n    .from("merchants")',
  'if (!supabase) throw new Error("Supabase is not configured.");\n\n  const { data, error } = await supabase\n    .from("merchants")',
);
fs.writeFileSync(adminDataPath, adminData, "utf8");

let source = fs.readFileSync(financialPath, "utf8");
if (!source.includes('import { resolveOrderMerchant } from "./merchantOrderOwnership";')) {
  source = source.replace(
    'import { createDayNightInvoiceNumber } from "./printableDocuments";',
    'import { createDayNightInvoiceNumber } from "./printableDocuments";\nimport { resolveOrderMerchant } from "./merchantOrderOwnership";',
  );
}

source = source.replace(
  /export type MerchantPortalResolution = \{[\s\S]*?\n\};\n\n/,
  "",
);
source = replaceExactly(
  source,
  /function merchantPortalLinkError[\s\S]*?\n}\n\nexport async function resolveOrderMerchant[\s\S]*?\n}\n\n(?=async function recoverCouponConflict)/,
  "",
  "remove duplicated merchant resolver",
);

const validator = `function assertCompleteFinancialOrderInput(
  input: FinancialOpsOrderInput,
  merchant: Merchant,
) {
  const isInternational = input.shipping_scope === "international";
  const destination = clean(isInternational ? input.destination_country : input.delivery_city);
  const weight = Number(input.weight);
  const orderCount = Number(input.order_count);
  const missing = [
    !clean(input.coupon_number) && "coupon_number",
    !clean(merchant.id) && "merchant_id",
    !clean(merchant.trade_name) && "merchant.trade_name",
    !clean(merchant.merchant_code) && "merchant.merchant_code",
    !clean(merchant.phone) && "merchant.phone",
    !clean(input.pickup_city) && "pickup_city",
    !destination && (isInternational ? "destination_country" : "delivery_city"),
    !clean(input.receiver_name) && "receiver_name",
    !clean(input.receiver_phone) && "receiver_phone",
    !clean(input.receiver_address) && "receiver_address",
    !clean(input.package_description || input.package_type) && "package_type",
    !clean(input.payment_method) && "payment_method",
    (!Number.isFinite(weight) || weight <= 0) && "weight",
    (!Number.isFinite(orderCount) || orderCount <= 0) && "order_count",
  ].filter(Boolean);
  if (missing.length) {
    throw operationError(null, \`order_required_fields_missing:\${missing.join(",")}\`);
  }
}

`;
source = source.replace("function buildFinancialOrderPayload(\n", `${validator}function buildFinancialOrderPayload(\n`);

source = source
  .replace(/clean\(input\.destination_country \|\| input\.delivery_city \|\| "WORLD"\)/g, "clean(input.destination_country || input.delivery_city)")
  .replace(/clean\(input\.delivery_city \|\| "Abu Dhabi"\)/g, "clean(input.delivery_city)")
  .replace(/clean\(input\.pickup_city \|\| merchant\.emirate \|\| "Abu Dhabi"\)/g, "clean(input.pickup_city || merchant.emirate)")
  .replace(/clean\(input\.package_description \|\| input\.package_type \|\| "Shipment"\)/g, "clean(input.package_description || input.package_type)")
  .replace('clean(merchant.phone || "971568757331")', "clean(merchant.phone)")
  .replace(/Math\.max\(0\.1, numberValue\(input\.weight, 1\)\)/g, "Number(input.weight)");

source = source.replace(
  "  const merchant = await resolveOrderMerchant(selectedMerchant);\n\n  const existingConflict",
  "  const merchant = await resolveOrderMerchant(selectedMerchant);\n  assertCompleteFinancialOrderInput(input, merchant);\n\n  const existingConflict",
);
source = source.replace(
  "  const merchant = merchantChanged\n    ? await resolveOrderMerchant(selectedMerchant)\n    : selectedMerchant;\n\n  const excludeOrderId",
  "  const merchant = await resolveOrderMerchant(selectedMerchant);\n  assertCompleteFinancialOrderInput(input, merchant);\n\n  const excludeOrderId",
);
source = source.replace(
  "  const merchantChanged = clean(selectedMerchant.id) !== clean(input.order.merchant_id);\n",
  "",
);

const oldCreateTail = `  const row = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!row?.id && !row?.tracking_number && !row?.invoice_number) {
    throw operationError(null, "financial_order_creation_returned_no_row");
  }
  if (clean(row.merchant_id) !== clean(merchant.id)) {
    throw operationError(null, "saved_order_merchant_portal_link_mismatch");
  }
  return { row, source: "rpc" };
}`;
const newCreateTail = `  const returned = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!returned?.id) {
    throw operationError(null, "financial_order_creation_returned_no_row");
  }

  const { data: saved, error: readError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", returned.id)
    .single();
  if (readError || !saved) {
    throw operationError(readError, "saved_financial_order_verification_failed");
  }
  if (clean(saved.merchant_id) !== clean(merchant.id)) {
    throw operationError(null, "saved_order_merchant_portal_link_mismatch");
  }
  return { row: saved as Order, source: "rpc" };
}`;
if (!source.includes(oldCreateTail)) throw new Error("financial creation tail marker missing");
source = source.replace(oldCreateTail, newCreateTail);

source = source.replace(
  '  const row = (Array.isArray(data) ? data[0] : data) as Order | null;\n  if (!row?.id) throw operationError(null, "financial_order_update_returned_no_row");\n  return { row, source: "rpc" };',
  '  const row = (Array.isArray(data) ? data[0] : data) as Order | null;\n  if (!row?.id) throw operationError(null, "financial_order_update_returned_no_row");\n  if (clean(row.merchant_id) !== clean(merchant.id)) {\n    throw operationError(null, "updated_order_merchant_portal_link_mismatch");\n  }\n  return { row, source: "rpc" };',
);

for (const forbidden of [
  'destination_country || input.delivery_city || "WORLD"',
  'input.delivery_city || "Abu Dhabi"',
  'merchant.emirate || "Abu Dhabi"',
  'package_type || "Shipment"',
  'merchant.phone || "971568757331"',
]) {
  if (source.includes(forbidden)) throw new Error(`Financial order default remains: ${forbidden}`);
}
if (!source.includes("saved_financial_order_verification_failed")) {
  throw new Error("Financial post-save database verification missing");
}

fs.writeFileSync(financialPath, source, "utf8");
console.log("Central merchant resolver and financial order validation hardening applied.");
