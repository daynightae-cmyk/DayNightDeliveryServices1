import fs from "node:fs";
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
  write(gate, content);`,
    "lifecycle gate v3 contract",
  ],
];

for (const [from, to, label] of replacements) {
  if (!content.includes(from)) throw new Error(`finalizer_patch_target_missing: ${label}`);
  content = content.replace(from, to);
}

fs.writeFileSync(file, content);
console.log("Patched generated JSX, gates and canonical lifecycle assertions.");
