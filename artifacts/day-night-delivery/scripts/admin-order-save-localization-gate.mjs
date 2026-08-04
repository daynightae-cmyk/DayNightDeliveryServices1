import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const expect = (source, pattern, label) => {
  if (!pattern.test(source)) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
};
const reject = (source, pattern, label) => {
  if (pattern.test(source)) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
};

const modal = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const destinations = read("src/data/internationalDestinations.ts");
const workspace = read("src/components/admin/AdminInternationalOrdersWorkspace.tsx");
const trackingActions = read("src/components/admin/AdminInternationalOrderTrackingActions.tsx");
const launcher = read("src/components/admin/AdminInternationalTrackingLauncher.tsx");
const exportLocalization = read("src/lib/exportLocalization.ts");
const plugin = read("scripts/friendly-error-message-plugin.ts");

expect(destinations, /value: "KW"[\s\S]*ar: "الكويت"/, "Kuwait has a full Arabic label");
expect(destinations, /value: "SA"[\s\S]*ar: "المملكة العربية السعودية"/, "Saudi Arabia has a professional Arabic label");
expect(destinations, /normalizeInternationalDestination/, "country values are canonicalized");
expect(modal, /INTERNATIONAL_DESTINATIONS[\s\S]*دولة الوجهة/, "edit modal uses localized country selector");
reject(modal, /value=\{form\.destination_country \|\| ""\}[\s\S]{0,180}<input/, "edit modal does not expose a raw country-code text input");
expect(modal, /!clean\(currentForm\.coupon_number\)/, "every edited order requires a coupon");
reject(modal, /رقم الكوبون — اختياري/, "personal edit no longer marks coupon optional");
expect(modal, /هاتف المرسل — اختياري/, "sender phone is explicitly optional");
expect(
  modal,
  /automaticEditReason[\s\S]*edit_reason: automaticEditReason/,
  "all edits receive an automatic audit reason",
);
reject(
  modal,
  /data-admin-complete-order-reason|data-admin-complete-order-confirm|sensitiveChange && !confirmed/,
  "manual reason and confirmation controls are removed",
);
expect(modal, /orderStatusLabel\(order\.status, isArabic\)/, "raw database status is localized");
reject(modal, /(اتلغت|مفيش|بيتسجل|بتتسجل|مش هيتم|الرسالة دي|اتساب|اتزامنوا)/, "complete editor contains no colloquial failure wording");
expect(persistence, /admin_update_order_complete_verified_v2/, "save calls corrected complete-edit RPC");
expect(persistence, /coupon_number_required_for_personal_order/, "personal edit rejects a missing coupon");
expect(persistence, /normalizeInternationalDestination/, "edit persistence stores canonical country values");
expect(workspace, /destinationLabel\(order, isArabic\)/, "international queue localizes country names");
expect(trackingActions, /INTERNATIONAL_DESTINATIONS/, "tracking action editor uses country-name selectors");
expect(launcher, /internationalDestinationLabel/, "tracking launcher localizes countries");
expect(exportLocalization, /isKnownInternationalDestination\(text\)/, "PDF/export localization handles ISO country codes");
expect(plugin, /day-night-friendly-error-messages-v5/, "build plugin uses the authoritative professional source");
reject(plugin, /complete order save exact rejection messages/, "build plugin no longer overwrites editor messages");

for (const migration of [
  "../../supabase/migrations/20260802102000_admin_complete_order_legacy_validation_hotfix.sql",
  "../../supabase/migrations/20260802103000_admin_complete_order_sender_identity_fallback.sql",
  "../../supabase/migrations/20260802104000_admin_complete_order_save_compatibility_alias.sql",
]) {
  if (!fs.existsSync(path.resolve(ROOT, migration))) throw new Error(`FAIL missing reviewed migration ${migration}`);
}

console.log("DAY NIGHT admin order save and Arabic localization gate PASSED");
