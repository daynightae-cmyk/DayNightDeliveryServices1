import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "artifacts/day-night-delivery/src/lib/adminOperationsData.ts");
let source = fs.readFileSync(file, "utf8");
const originalSource = source;

// These replacements are safe on both legacy and already-hardened source.
source = source
  .replace(/weight:\s*Math\.max\(1,\s*numberValue\(input\.weight,\s*1\)\)/g, "weight: Number(input.weight)")
  .replace(/input\.payment_method\s*\|\|\s*"merchant_pays"/g, "input.payment_method");

const alreadyHardened =
  source.includes('import { resolveOrderMerchant } from "./merchantOrderOwnership";')
  && source.includes("assertCompleteOpsOrderInput")
  && source.includes("saved_order_merchant_portal_link_mismatch")
  && source.includes("updated_order_merchant_portal_link_mismatch")
  && !source.includes("createPublicOrder")
  && !source.includes("attachMerchantToCreatedOrder")
  && !source.includes("findCreatedOrder");

if (alreadyHardened) {
  if (source !== originalSource) fs.writeFileSync(file, source, "utf8");
  console.log("Admin operations order ownership hardening is already applied.");
  process.exit(0);
}

function replaceOnce(pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (matches !== 1) throw new Error(`${label}: expected one match, found ${matches}`);
  source = source.replace(pattern, replacement);
}

source = source.replace(
  'import { createPublicOrder, supabase } from "../supabase";',
  'import { supabase } from "../supabase";',
);
source = source.replace(
  'import { resolveOrderMerchant } from "./orderFinancialOperations";',
  'import { resolveOrderMerchant } from "./merchantOrderOwnership";',
);
if (!source.includes('import { resolveOrderMerchant } from "./merchantOrderOwnership";')) {
  source = source.replace(
    'import { createDayNightInvoiceNumber } from "./printableDocuments";',
    'import { createDayNightInvoiceNumber } from "./printableDocuments";\nimport { resolveOrderMerchant } from "./merchantOrderOwnership";',
  );
}

replaceOnce(
  /async function findCreatedOrder[\s\S]*?\n(?=function normalizeInitialOrderStatus)/,
  "",
  "remove public/direct creation attachment helpers",
);

replaceOnce(
  /export async function fetchOpsOrders\([\s\S]*?\n}\n\n(?=export async function fetchOpsSnapshot)/,
  `export async function fetchOpsOrders(pageSize = 1000): Promise<Order[]> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for order operations.",
    );

  const safePageSize = Math.min(Math.max(Math.trunc(pageSize || 1000), 1), 1000);
  const rows: Order[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + safePageSize - 1);
    if (error)
      throw operationsError(
        error,
        "Orders table could not be loaded safely.",
      );

    const page = (data || []) as Order[];
    rows.push(...page);
    if (page.length < safePageSize) break;
    from += safePageSize;
  }

  return rows;
}

`,
  "paginated operations order load",
);

const validationHelper = `function assertCompleteOpsOrderInput(input: OpsOrderInput, merchant: Merchant) {
  const isInternational = input.shipping_scope === "international";
  const receiverCity = clean(isInternational ? input.destination_country : input.delivery_city);
  const weight = Number(input.weight);
  const missing = [
    !clean(input.coupon_number) && "coupon_number",
    !clean(merchant.id) && "merchant_id",
    !clean(merchant.trade_name) && "merchant.trade_name",
    !clean(merchant.merchant_code) && "merchant.merchant_code",
    !clean(merchant.phone) && "merchant.phone",
    !clean(input.pickup_city) && "pickup_city",
    !receiverCity && (isInternational ? "destination_country" : "delivery_city"),
    !clean(input.receiver_name) && "receiver_name",
    !clean(input.receiver_phone) && "receiver_phone",
    !clean(input.receiver_address) && "receiver_address",
    !clean(input.package_description || input.package_type) && "package_type",
    !clean(input.payment_method) && "payment_method",
    !clean(input.status) && "status",
    (!Number.isFinite(Number(input.order_count)) || Number(input.order_count) <= 0) && "order_count",
    (!Number.isFinite(weight) || weight <= 0) && "weight",
  ].filter(Boolean);
  if (missing.length) {
    throw operationsError(
      null,
      \`order_required_fields_missing:\${missing.join(",")}\`,
    );
  }
}

`;
if (!source.includes("function assertCompleteOpsOrderInput")) {
  const marker = "function buildOrderPayload(\n";
  if (!source.includes(marker)) throw new Error("buildOrderPayload marker was not found");
  source = source.replace(marker, `${validationHelper}${marker}`);
}

source = source
  .replace(/merchant\?\.trade_name\s*\|\|\s*input\.merchant_name\s*\|\|\s*"DAY NIGHT Merchant"/g, "merchant?.trade_name || input.merchant_name")
  .replace(/clean\(merchant\?\.phone\s*\|\|\s*"971568757331"\)/g, "clean(merchant?.phone)")
  .replace(/input\.pickup_city\s*\|\|\s*merchant\?\.emirate\s*\|\|\s*"Abu Dhabi"/g, "input.pickup_city || merchant?.emirate")
  .replace(/input\.payment_method\s*\|\|\s*merchant\?\.default_payment_method\s*\|\|\s*"merchant_pays"/g, "input.payment_method || merchant?.default_payment_method")
  .replace(/clean\(input\.delivery_city\s*\|\|\s*"Dubai"\)/g, "clean(input.delivery_city)")
  .replace(/input\.destination_country\s*\|\|\s*deliveryEmirate\s*\|\|\s*"WORLD"/g, "input.destination_country || deliveryEmirate")
  .replace(/destination:\s*input\.destination_country\s*\|\|\s*"WORLD"/g, "destination: clean(input.destination_country)")
  .replace(/input\.package_description\s*\|\|\s*input\.package_type\s*\|\|\s*"Shipment"/g, "input.package_description || input.package_type")
  .replace(/clean\(input\.status\s*\|\|\s*"pending"\)/g, "clean(input.status)")
  .replace(/Math\.max\(0\.1,\s*numberValue\(input\.weight,\s*1\)\)/g, "Number(input.weight)")
  .replace(/notes:\s*\[clean\(input\.notes\), reviewNote, priceNote, settlementNote\]\s*\.filter\(Boolean\)\s*\.join\(" \| "\)\s*\|\|\s*"Created from admin operations section"/g, 'notes: [clean(input.notes), reviewNote, priceNote, settlementNote]\n      .filter(Boolean)\n      .join(" | ")');

replaceOnce(
  /export async function createOpsOrder\([\s\S]*?\n}\n\n(?=export async function updateOpsOrder)/,
  `export async function createOpsOrder(
  input: OpsOrderInput,
): Promise<OpsCreateResult<Order>> {
  if (!supabase)
    throw operationsError(
      null,
      "Supabase is not configured for order operations.",
    );

  const selectedMerchant = input.merchant;
  if (!selectedMerchant?.id) {
    throw operationsError(
      null,
      "تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.",
    );
  }
  const merchant = await resolveOrderMerchant(selectedMerchant);
  assertCompleteOpsOrderInput(input, merchant);

  const createdAt = new Date().toISOString();
  const couponNumber = clean(input.coupon_number);
  const trackingNumber = createDayNightInvoiceNumber(
    couponNumber,
    new Date(createdAt),
  );
  const payload = buildOrderPayload(
    { ...input, merchant, merchant_id: merchant.id, merchant_name: merchant.trade_name, merchant_code: merchant.merchant_code },
    merchant,
    trackingNumber,
    createdAt,
  );

  const { data, error } = await supabase.rpc("admin_create_coupon_order", {
    p_order: payload,
  });
  if (error)
    throw operationsError(
      error,
      "Could not create the order through the canonical admin RPC.",
    );

  const returned = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!returned?.id) throw operationsError(null, "admin_order_creation_returned_no_row");

  const { data: saved, error: readError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", returned.id)
    .single();
  if (readError || !saved)
    throw operationsError(readError, "saved_order_verification_failed");
  if (clean(saved.merchant_id) !== clean(merchant.id))
    throw operationsError(null, "saved_order_merchant_portal_link_mismatch");

  return { row: saved as Order, source: "rpc" };
}

`,
  "canonical operations order creation",
);

replaceOnce(
  /export async function updateOpsOrder\([\s\S]*?\n}\n\n(?=export async function deleteOpsOrder)/,
  `export async function updateOpsOrder(
  input: OpsOrderUpdateInput,
): Promise<OpsCreateResult<Order>> {
  const reference = getOpsOrderReference(input.order);
  if (!reference)
    throw operationsError(null, "Order reference is missing.");
  if (!supabase)
    throw operationsError(null, "Supabase is not configured for order operations.");

  const candidate = input.merchant || ({
    id: input.merchant_id || input.order.merchant_id || "",
    trade_name: input.merchant_name || input.order.merchant_name || "",
    merchant_code: input.merchant_code || input.order.merchant_code,
    phone: input.order.sender_phone || "",
  } as Merchant);
  if (!candidate.id) throw operationsError(null, "merchant_required");
  const merchant = await resolveOrderMerchant(candidate);
  assertCompleteOpsOrderInput(input, merchant);

  const patch = buildOrderPayload(
    { ...input, merchant, merchant_id: merchant.id, merchant_name: merchant.trade_name, merchant_code: merchant.merchant_code },
    merchant,
    input.order.tracking_number || input.order.invoice_number || reference,
    input.order.created_at || new Date().toISOString(),
  );

  delete (patch as Record<string, unknown>).created_at;
  delete (patch as Record<string, unknown>).tracking_number;
  delete (patch as Record<string, unknown>).invoice_number;
  delete (patch as Record<string, unknown>).status_history;
  delete (patch as Record<string, unknown>).status;

  const row = await rpcRequired<Order>(
    "admin_update_order_runtime",
    {
      p_payload: {
        reference,
        patch,
        reason: clean(input.edit_reason) || "Updated from admin flexible order editor",
      },
    },
    "Could not update this order. Apply the flexible-order migration and confirm admin permissions.",
  );
  if (clean(row.merchant_id) !== clean(merchant.id))
    throw operationsError(null, "updated_order_merchant_portal_link_mismatch");

  return { row, source: "rpc" };
}

`,
  "canonical operations order update",
);

for (const forbidden of [
  "createPublicOrder",
  "attachMerchantToCreatedOrder",
  "findCreatedOrder",
  '"DAY NIGHT Merchant"',
  '"971568757331"',
  'destination_country || deliveryEmirate || "WORLD"',
  'destination_country || "WORLD"',
  '.from("orders")\n    .insert',
]) {
  if (source.includes(forbidden)) throw new Error(`Forbidden legacy order path remains: ${forbidden}`);
}
if (!source.includes("saved_order_merchant_portal_link_mismatch")) {
  throw new Error("Post-save canonical merchant verification is missing.");
}

fs.writeFileSync(file, source, "utf8");
console.log("Admin operations order ownership hardening applied.");
