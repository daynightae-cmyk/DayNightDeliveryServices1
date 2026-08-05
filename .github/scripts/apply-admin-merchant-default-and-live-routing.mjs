import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`merchant_financial_patch_missing_${label}`);
  }
  const next = source.replace(before, after);
  if (next === source) {
    throw new Error(`merchant_financial_patch_noop_${label}`);
  }
  return next;
}

const componentPath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
);
let component = fs.readFileSync(componentPath, "utf8");

component = replaceRequired(
  component,
  `    pickup_street: merchant?.pickup_address || merchant?.address || "",\n  };\n}`,
  `    pickup_street: merchant?.pickup_address || merchant?.address || "",\n    payment_method: merchant ? "merchant_pays" : emptyOrder.payment_method,\n    delivery_fee_mode: merchant ? "deduct_from_merchant" : emptyOrder.delivery_fee_mode,\n  };\n}`,
  "fresh_order_merchant_default",
);

component = replaceRequired(
  component,
  `      merchant_code: merchant?.merchant_code || "",\n      pickup_city: merchant?.emirate || current.pickup_city,`,
  `      merchant_code: merchant?.merchant_code || "",\n      payment_method: merchant ? "merchant_pays" : "cod",\n      delivery_fee_mode: merchant ? "deduct_from_merchant" : "customer_pays",\n      pickup_city: merchant?.emirate || current.pickup_city,`,
  "merchant_selection_default",
);

component = replaceRequired(
  component,
  `      merchant_code: merchant?.merchant_code || imported.merchant_code || current.merchant_code,\n      coupon_number: clean(imported.coupon_number || current.coupon_number),`,
  `      merchant_code: merchant?.merchant_code || imported.merchant_code || current.merchant_code,\n      payment_method: merchant ? "merchant_pays" : current.payment_method,\n      delivery_fee_mode: merchant ? "deduct_from_merchant" : current.delivery_fee_mode,\n      coupon_number: clean(imported.coupon_number || current.coupon_number),`,
  "coupon_merchant_default",
);

component = replaceRequired(
  component,
  `data-admin-financial-preview-version="6" data-customer-total={financials?.customerTotal ?? ""} data-merchant-due={financials?.merchantDue ?? ""}`,
  `data-admin-financial-preview-version="7" data-selected-merchant-id={form.merchant_id || ""} data-delivery-fee-mode={financials?.deliveryFeeMode ?? ""} data-customer-total={financials?.customerTotal ?? ""} data-merchant-due={financials?.merchantDue ?? ""}`,
  "preview_contract",
);

fs.writeFileSync(componentPath, component, "utf8");

const gatePath = path.join(
  root,
  "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs",
);
let gate = fs.readFileSync(gatePath, "utf8");

gate = replaceRequired(
  gate,
  `[component.includes('data-admin-financial-preview-version="6"'), "deployed form exposes financial truth version 6"],`,
  `[component.includes('data-admin-financial-preview-version="7"'), "deployed form exposes financial truth version 7"],\n  [component.includes('data-delivery-fee-mode={financials?.deliveryFeeMode ?? ""}'), "preview exposes the actual live delivery-fee destination"],\n  [component.includes('payment_method: merchant ? "merchant_pays" : emptyOrder.payment_method'), "fresh merchant orders default to merchant payment"],\n  [component.includes('delivery_fee_mode: merchant ? "deduct_from_merchant" : emptyOrder.delivery_fee_mode'), "fresh merchant orders default to merchant debit"],\n  [component.includes('payment_method: merchant ? "merchant_pays" : "cod"'), "selecting a merchant selects merchant payment atomically"],\n  [component.includes('delivery_fee_mode: merchant ? "deduct_from_merchant" : "customer_pays"'), "selecting a merchant selects merchant debit atomically"],\n  [component.includes('payment_method: merchant ? "merchant_pays" : current.payment_method'), "coupon merchant matching selects merchant payment"],\n  [component.includes('delivery_fee_mode: merchant ? "deduct_from_merchant" : current.delivery_fee_mode'), "coupon merchant matching selects merchant debit"],`,
  "gate_merchant_default",
);

fs.writeFileSync(gatePath, gate, "utf8");

console.log("Applied merchant-default and live-routing financial repair.");
