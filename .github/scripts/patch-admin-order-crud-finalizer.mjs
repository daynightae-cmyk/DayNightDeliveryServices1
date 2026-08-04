import fs from "node:fs";
const file = ".github/scripts/finalize-admin-order-crud-v3.mjs";
let content = fs.readFileSync(file, "utf8");
const from = "className={\\`${sectionClass} mb-4 border-cyan-300/25 bg-cyan-300/[0.055]\\`}";
const to = "className={\\`\\${sectionClass} mb-4 border-cyan-300/25 bg-cyan-300/[0.055]\\`}";
if (!content.includes(from)) throw new Error("finalizer_placeholder_target_missing");
content = content.replace(from, to);
fs.writeFileSync(file, content);
console.log("Patched generated JSX placeholder escaping.");
