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
console.log("Scoped create assertions and personal coupon input-tag verification.");
