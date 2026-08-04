import fs from "node:fs";
const file = ".github/scripts/finalize-admin-order-create-v3-ui.mjs";
let content = fs.readFileSync(file, "utf8");

const from = `assert(adminData.includes("createAdminOrder(payload") && !/createOpsOrder[\\\\s\\\\S]*admin_create_canonical_merchant_order/.test(adminData), "flexible create still uses restrictive merchant RPC");
assert(financial.includes("createAdminOrder(payload") && !/createFinancialOpsOrder[\\\\s\\\\S]*resolveCanonicalMerchantForOrder/.test(financial), "financial create still requires portal-linked merchant");
assert(personal.includes("createAdminOrder(payload") && !personal.includes("coupon_number_required_for_personal_order"), "personal create remains coupon-blocked");
assert(!/function validate\\\\(\\\\)[\\\\s\\\\S]*!selectedMerchant/.test(complete), "complete create still blocks missing merchant");
assert(!/function validate\\\\(\\\\)[\\\\s\\\\S]*coupon number/.test(complete), "complete create still blocks missing coupon");
assert(!/function validate\\\\(\\\\)[\\\\s\\\\S]*!selectedMerchant/.test(flexible), "flexible create still blocks missing merchant");`;
const to = `const adminCreateSegment = adminData.slice(
  adminData.indexOf("export async function createOpsOrder"),
  adminData.indexOf("export async function updateOpsOrder"),
);
const financialCreateSegment = financial.slice(
  financial.indexOf("export async function createFinancialOpsOrder"),
  financial.indexOf("function buildCorePatch"),
);
const completeValidateSegment = complete.slice(
  complete.indexOf("function validate()"),
  complete.indexOf("function prepareNextOrder"),
);
const flexibleValidateSegment = flexible.slice(
  flexible.indexOf("function validate()"),
  flexible.indexOf("async function submit"),
);
assert(adminCreateSegment.includes("createAdminOrder(payload") && !adminCreateSegment.includes("admin_create_canonical_merchant_order"), "flexible create still uses restrictive merchant RPC");
assert(financialCreateSegment.includes("createAdminOrder(payload") && !financialCreateSegment.includes("resolveCanonicalMerchantForOrder"), "financial create still requires portal-linked merchant");
assert(personal.includes("createAdminOrder(payload") && !personal.includes("coupon_number_required_for_personal_order"), "personal create remains coupon-blocked");
assert(!completeValidateSegment.includes("!selectedMerchant"), "complete create still blocks missing merchant");
assert(!completeValidateSegment.toLowerCase().includes("coupon number"), "complete create still blocks missing coupon");
assert(!flexibleValidateSegment.includes("!selectedMerchant"), "flexible create still blocks missing merchant");`;
if (!content.includes(from)) throw new Error("create_v3_gate_scope_target_missing");
content = content.replace(from, to);

const couponMarker = "personal form coupon remains required";
const markerIndex = content.indexOf(couponMarker);
if (markerIndex < 0) throw new Error("create_v3_personal_coupon_gate_marker_missing");
const lineStart = content.lastIndexOf("\n", markerIndex) + 1;
const nextNewline = content.indexOf("\n", markerIndex);
const lineEnd = nextNewline < 0 ? content.length : nextNewline;
const couponReplacement =
  'const personalCouponInput = personalForm.match(/<input[^>]*data-admin-personal-coupon=\\"true\\"[^>]*>/)?.[0] || \\"\\";\n' +
  'assert(personalForm.includes(\\"اختياري ويمكن مراجعته لاحقًا\\") && personalCouponInput && !/\\\\brequired\\\\b|aria-required/.test(personalCouponInput), \\"personal form coupon remains required\\");';
content = content.slice(0, lineStart) + couponReplacement + content.slice(lineEnd);

fs.writeFileSync(file, content);

const financialPath = "artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts";
let financial = fs.readFileSync(financialPath, "utf8");
const merchantTarget = `  const merchant = input.merchant || null;
  const financials = calculateFinancialOpsOrder(input);`;
const merchantReplacement = `  const merchant = input.merchant || null;

  const existingConflict = await findCouponConflict(input.coupon_number);
  if (existingConflict) throw duplicateCouponError(existingConflict, input.coupon_number);

  const financials = calculateFinancialOpsOrder(input);`;
if (!financial.includes(merchantTarget)) {
  throw new Error("create_v3_financial_coupon_preflight_target_missing");
}
financial = financial.replace(merchantTarget, merchantReplacement);

const createTarget = `  const result = await createAdminOrder(payload, {
    sourcePage: "admin_new_order_complete",
    reason: "Admin financially complete order creation",
  });`;
const createReplacement = `  let result;
  try {
    result = await createAdminOrder(payload, {
      sourcePage: "admin_new_order_complete",
      reason: "Admin financially complete order creation",
    });
  } catch (error) {
    const conflict = await recoverCouponConflict(input.coupon_number);
    if (conflict) throw duplicateCouponError(conflict, input.coupon_number);
    throw error;
  }`;
if (!financial.includes(createTarget)) {
  throw new Error("create_v3_financial_coupon_recovery_target_missing");
}
financial = financial.replace(createTarget, createReplacement);
fs.writeFileSync(financialPath, financial);

const personalPath = "artifacts/day-night-delivery/src/lib/personalOrderOperations.ts";
let personal = fs.readFileSync(personalPath, "utf8");
const personalValidationTarget = `  if (!supabase) throw new Error("Supabase is not configured.");
  const couponNumber = clean(input.reference);`;
const personalValidationReplacement = `  if (!supabase) throw new Error("Supabase is not configured.");
  const senderName = clean(input.sender_name);
  const receiverName = clean(input.receiver_name);
  const receiverPhone = clean(input.receiver_phone);
  if (!senderName || !receiverName || !receiverPhone) {
    throw new Error("personal_order_core_fields_required");
  }
  const couponNumber = clean(input.reference);`;
if (!personal.includes(personalValidationTarget)) {
  throw new Error("create_v3_personal_core_validation_target_missing");
}
personal = personal.replace(personalValidationTarget, personalValidationReplacement);
personal = personal
  .replace("    sender_name: clean(input.sender_name),", "    sender_name: senderName,")
  .replace("    receiver_name: clean(input.receiver_name),", "    receiver_name: receiverName,")
  .replace("    receiver_phone: clean(input.receiver_phone),", "    receiver_phone: receiverPhone,");
fs.writeFileSync(personalPath, personal);

console.log("Scoped create assertions, preserved coupon integrity, and kept personal sender phone optional while validating core names and receiver phone.");
