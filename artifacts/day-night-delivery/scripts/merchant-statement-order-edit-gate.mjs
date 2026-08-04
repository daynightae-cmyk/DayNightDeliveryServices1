import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, "merchant-statement-order-edit-gate-legacy.mjs");
const temporaryPath = path.join(directory, `.merchant-statement-order-edit-gate-${process.pid}.mjs`);
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(
    "/No mixed or fabricated fallback was shown|لم يتم عرض بيانات بديلة أو مختلطة/",
    "/No mixed data was shown|No merchant account was opened with incomplete or mixed data|لم يتم عرض بيانات مختلطة|لم يتم فتح أي ملف تاجر ببيانات ناقصة أو مختلطة/",
  )
  .replace(
    'const persistence = read("src/lib/adminOrderEditPersistence.ts");',
    'const persistence = read("src/lib/adminOrderEditPersistence.ts");\nconst mutationService = read("src/lib/adminOrderMutations.ts");\nconst crudV3Migration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");',
  )
  .replace(
    'expect(editModal, /sticky bottom-0/, "Order update controls remain visible while scrolling");',
    'expect(editModal, /<header[^>]*shrink-0[\\s\\S]*min-h-0 flex-1[\\s\\S]*overflow-y-auto[\\s\\S]*<footer[^>]*shrink-0/, "Order update controls remain visible outside the scrolling form body");',
  )
  .replace(
    'expect(editModalBoundary, /setLastSavedOrder\\(savedOrder\\)/, "Verified saves keep the order editor mounted");',
    'expect(editModal, /window\\.setTimeout\\(onClose/, "Verified core saves close the editor only after database confirmation");',
  )
  .replace(
    'expect(editModalBoundary, /if \\(lastSavedOrder\\) await onSaved\\?\\.\\(lastSavedOrder\\)/, "Parent refresh is deferred until explicit close");',
    'reject(editModalBoundary, /await onSaved\\?\\.\\(|_legacyParentRefresh\\s*\\(/, "Verified saves never invoke the legacy parent refresh");',
  )
  .replace(
    'expect(editModalBoundary, /onClose=\\{\\(\\) => void handleExplicitClose\\(\\)\\}/, "Only the explicit close action exits the order editor");',
    'expect(editModal, /dn-admin-order-operation-result[\\s\\S]*window\\.setTimeout\\(onClose/, "Returned-row cache update happens before the modal closes");',
  )
  .replace(
    'expect(\n  persistence,\n  /select\\("\\*"\\)[\\s\\S]*\\.limit\\(1\\)[\\s\\S]*data\\?\\.\\[0\\]\\?\\.id/s,\n  "Database update verifies the returned order row",\n);',
    'expect(mutationService, /envelope\\.order\\?\\.id[\\s\\S]*order:\\s*envelope\\.order/, "Database update verifies and returns the saved order row");',
  )
  .replace(
    'expect(persistence, /financialsAreLocked/, "Delivered financial snapshots remain protected");',
    'expect(crudV3Migration, /financial_reconciliation_required[\\s\\S]*core_delivery_saved_before_optional_ledgers/, "Delivered core save preserves entered values and queues optional financial reconciliation");',
  )
  .replace(
    'expect(persistence, /corePatch/, "Delivered orders still allow safe core-data edits");',
    'expect(persistence, /updateAdminOrder[\\s\\S]*customer_total/, "Delivered orders use the same canonical patch path for core-data edits");',
  )
  .replace(
    'expect(persistence, /isMissingFinancialUpdateRuntime/, "Missing RPC runtime has a controlled compatibility path");',
    'expect(crudV3Migration, /admin_update_order_complete_verified_v2[\\s\\S]*admin_update_order_complete_v3[\\s\\S]*admin_update_order_complete_verified\\(p_payload jsonb\\)[\\s\\S]*admin_update_order_complete_v3/, "Legacy complete RPC callers are redirected forward to canonical v3");',
  );

fs.writeFileSync(temporaryPath, source, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
