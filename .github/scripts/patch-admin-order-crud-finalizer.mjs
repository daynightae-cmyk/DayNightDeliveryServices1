import fs from "node:fs";
import { execFileSync } from "node:child_process";

const file = ".github/scripts/finalize-admin-order-crud-v3.mjs";
let content = fs.readFileSync(file, "utf8");

const replacements = [
  [
    "className={\\`${sectionClass} mb-4 border-cyan-300/25 bg-cyan-300/[0.055]\\`}",
    "className={\\`\\${sectionClass} mb-4 border-cyan-300/25 bg-cyan-300/[0.055]\\`}",
    "generated JSX sectionClass placeholder",
  ],
  [
    'assert(!persistence.includes(".from(\\"orders\\")"), "complete editor has direct table fallback");',
    'assert(!persistence.includes(\'.from("orders")\'), "complete editor has direct table fallback");',
    "generated gate orders-table string",
  ],
  [
    'assert(/admin_update_order_complete_verified\\(p_payload jsonb\\)[\\\\s\\\\S]+admin_update_order_complete_v3/.test(migration), "legacy complete RPC does not redirect to v3");',
    'assert(migration.includes("create or replace function public.admin_update_order_complete_verified(p_payload jsonb)") && migration.includes("select public.admin_update_order_complete_v3("), "legacy complete RPC does not redirect to v3");',
    "legacy complete redirect gate",
  ],
  [
    '  content = content.replaceAll("admin_update_order_status_verified", "admin_update_order_complete_v3");\n  write(gate, content);',
    `  content = content.replaceAll("admin_update_order_status_verified", "admin_update_order_complete_v3");
  if (gate.endsWith("admin-order-lifecycle-final-gate.mjs")) {
    content = content.replace(
      'assert(persistence.includes("admin_update_order_complete_v3"), "verified complete edit RPC missing");',
      'assert(persistence.includes("updateAdminOrder"), "canonical v3 complete edit client missing");',
    );
    content = content.replace(
      'assert(persistence.includes("saveAdminLockedMerchantCoreEdit"), "delivered core-data edit path missing");',
      'assert(persistence.includes("saveAdminOrderEdit"), "unified complete edit path missing");',
    );
    content = content.replace(
      'assert(edit.includes("saveAdminLockedMerchantCoreEdit") && edit.includes("saveAdminOrderEdit"), "editor does not route ordinary and audited edits separately");',
      'assert(edit.includes("saveAdminOrderEdit") && edit.includes("data-admin-order-v3-status"), "editor is not unified on the canonical v3 mutation path");',
    );
  }
  if (gate.endsWith("operations-order-control-gate.mjs")) {
    const start = content.indexOf('const adminStatus = read("src/supabaseAdminOps.ts");');
    const end = content.indexOf('const statements = read("src/components/admin/AdminMerchantStatementsCenterPdf.tsx");', start);
    if (start < 0 || end <= start) throw new Error("operations_gate_status_block_missing");
    const replacement = [
      'const adminStatus = read("src/supabaseAdminOps.ts");',
      'const adminMutations = read("src/lib/adminOrderMutations.ts");',
      'expect(adminStatus, /updateAdminOrderStatus/, "Admin status updates use the shared canonical mutation service");',
      'expect(adminStatus, /result.order/, "Admin status success is based on the database-returned order row");',
      'expect(adminStatus, /normalizeAdminOrderStatus/, "Admin status success verifies the returned persisted status");',
      'expect(adminStatus, /dn-admin-orders-updated/, "Admin status changes update the visible list from the returned row");',
      'expect(adminMutations, /admin_update_order_complete_v3/, "Shared service calls the canonical v3 RPC");',
      'expect(adminMutations, /inFlight/, "Repeated status clicks cannot submit the same request twice");',
      'expect(adminMutations, /requestId/, "Admin status requests carry an idempotency request ID");',
      'reject(adminStatus, /admin_update_order_status_verified/, "Admin status client contains no legacy RPC fallback");',
      '',
      'const statusMigration = read("../../supabase/migrations/20260804211500_admin_order_crud_v3_nonblocking.sql");',
      'expect(statusMigration, /admin_update_order_complete_v3/, "Status persistence migration creates the canonical v3 RPC");',
      'expect(statusMigration, /admin_order_v3_update_affected_zero_rows/, "Database RPC rejects zero-row updates");',
      'expect(statusMigration, /returning o/, "Database RPC reads the exact saved row inside its transaction");',
      'expect(statusMigration, /order_status_history/, "Status transitions write normalized history when available");',
      'expect(statusMigration, /financial_reconciliation_required/, "Delivered secondary financial work is returned as a warning");',
      'expect(statusMigration, /admin_order_mutation_audit_v3/, "Previous and new status are permanently audited");',
      'expect(statusMigration, /merchant_portal_account_not_linked/, "Unlinked merchant portal condition is represented as a non-blocking warning");',
      '',
    ].join("\\n");
    content = content.slice(0, start) + replacement + content.slice(end);
  }
  write(gate, content);`,
    "lifecycle and operations gates v3 contract",
  ],
];

for (const [from, to, label] of replacements) {
  if (!content.includes(from)) throw new Error(`finalizer_patch_target_missing: ${label}`);
  content = content.replace(from, to);
}

fs.writeFileSync(file, content);

const integrityGatePath =
  "artifacts/day-night-delivery/scripts/global-order-merchant-integrity-gate.mjs";
const mainIntegrityGate = execFileSync(
  "git",
  ["show", `origin/main:${integrityGatePath}`],
  { encoding: "utf8" },
);
const legacyCreateAssertion =
  "  assert.match(source, /admin_create_canonical_merchant_order/);";
const unifiedCreateAssertion = `  assert.match(
    source,
    /admin_create_canonical_merchant_order|createAdminOrder/,
    "order creation must use either the legacy canonical merchant RPC or the unified Admin v3 mutation service",
  );`;
if (!mainIntegrityGate.includes(legacyCreateAssertion)) {
  throw new Error("global_order_integrity_gate_legacy_assertion_missing");
}
fs.writeFileSync(
  integrityGatePath,
  mainIntegrityGate.replace(legacyCreateAssertion, unifiedCreateAssertion),
);

console.log(
  "Patched generated JSX, lifecycle/operations assertions and the global merchant-integrity gate for the unified v3 contract.",
);
