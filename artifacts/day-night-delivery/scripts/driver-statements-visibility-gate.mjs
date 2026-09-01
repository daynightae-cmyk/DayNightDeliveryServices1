import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const hook = read("src/hooks/useAdminDrivers.ts");
const statements = read("src/components/admin/AdminDriverStatementsCenter.tsx");

expect(hook, /waitForAdminOperationalSession\(\)/, "Driver statements wait for hydrated Admin auth before protected reads");
expect(hook, /fetchAdminOrdersResilient\(\)/, "Driver statements reuse complete resilient Admin order retrieval");
expect(hook, /Promise\.all\(\[[\s\S]*driver_assignment_history[\s\S]*fetchAdminOrdersResilient\(\)/, "Profiles, assignment history and complete orders are reconciled in one refresh");
expect(statements, /function normalizePeriodBounds/, "Driver statements normalize date-range direction");
expect(statements, /from && to && from > to/, "A reversed From/To period is detected");
expect(statements, /insidePeriod = \(!period\.from \|\| date >= period\.from\) && \(!period\.to \|\| date <= period\.to\)/, "Order filtering uses normalized period bounds");
expect(statements, /تم تصحيح الفترة تلقائيًا|period was corrected automatically/, "Admin is told when a reversed period is corrected");
expect(statements, /filters: `\$\{period\.from \|\| "—"\} → \$\{period\.to \|\| "—"\}`/, "PDF export uses the same normalized period shown on screen");

if (failed) process.exit(1);
console.log("PASS driver statements visibility gate");
