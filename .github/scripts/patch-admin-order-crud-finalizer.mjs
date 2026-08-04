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
];

for (const [from, to, label] of replacements) {
  if (!content.includes(from)) throw new Error(`finalizer_patch_target_missing: ${label}`);
  content = content.replace(from, to);
}

fs.writeFileSync(file, content);
console.log("Patched generated JSX and gate string escaping.");
