import fs from "node:fs";

const gatePath =
  "artifacts/day-night-delivery/scripts/admin-order-save-localization-gate.mjs";
let gate = fs.readFileSync(gatePath, "utf8");

const declarationsTarget = `const exportLocalization = read("src/lib/exportLocalization.ts");
const plugin = read("scripts/friendly-error-message-plugin.ts");`;
const declarationsReplacement = `const exportLocalization = read("src/lib/exportLocalization.ts");
const plugin = read("scripts/friendly-error-message-plugin.ts");
const mutations = read("src/lib/adminOrderMutations.ts");
const v3Migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");`;
if (!gate.includes(declarationsTarget)) {
  throw new Error("localization_gate_declarations_target_missing");
}
gate = gate.replace(declarationsTarget, declarationsReplacement);

const legacyCouponAssertions = `expect(modal, /!clean\\(currentForm\\.coupon_number\\)/, "every edited order requires a coupon");
reject(modal, /رقم الكوبون — اختياري/, "personal edit no longer marks coupon optional");`;
const v3CouponAssertions = `reject(modal, /!clean\\(currentForm\\.coupon_number\\)/, "missing coupon does not block the core order edit");
expect(modal, /رقم الكوبون — اختياري/, "Admin edit identifies coupon as optional and reviewable");`;
if (!gate.includes(legacyCouponAssertions)) {
  throw new Error("localization_gate_coupon_assertions_target_missing");
}
gate = gate.replace(legacyCouponAssertions, v3CouponAssertions);

const saveAssertionPattern = /^expect\(persistence,\s*\/[^\n]+\/,[^\n]*"save calls[^\n]*\);$/m;
const personalCouponAssertionPattern =
  /^expect\(persistence,\s*\/[^\n]+\/,[^\n]*"personal edit rejects a missing coupon"\);$/m;
if (!saveAssertionPattern.test(gate)) {
  throw new Error("localization_gate_save_assertion_missing");
}
if (!personalCouponAssertionPattern.test(gate)) {
  throw new Error("localization_gate_personal_coupon_assertion_missing");
}
gate = gate.replace(
  saveAssertionPattern,
  'expect(persistence, /updateAdminOrder/, "save calls the unified canonical Admin mutation service");',
);
gate = gate.replace(
  personalCouponAssertionPattern,
  `reject(persistence, /coupon_number_required_for_personal_order/, "personal edit does not reject a missing coupon");
expect(mutations, /admin_update_order_complete_v3/, "unified mutation service calls the canonical v3 RPC");
expect(
  v3Migration,
  /coupon_reconciliation_required[\\s\\S]*coupon_missing_or_blank/,
  "database converts a missing coupon into a non-blocking reconciliation warning",
);`,
);

fs.writeFileSync(gatePath, gate);
console.log(
  "Patched localization verification for the canonical v3 non-blocking coupon contract.",
);
