import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();

function check(condition, label, failures) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.log(`FAIL: ${label}`);
    failures.push(label);
  }
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function run(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const failures = [];

  check(exists("index.html"), "index exists", failures);
  check(exists("src/components/RequestDelivery.tsx"), "request page exists", failures);
  check(exists("src/components/ContactUs.tsx"), "contact page exists", failures);
  check(exists("src/components/Tracking.tsx"), "tracking page exists", failures);
  check(exists("src/components/AdminPanel.tsx"), "admin page exists", failures);
  check(exists("src/components/SmartChat.tsx"), "smart chat exists", failures);
  check(exists("src/lib/pricing.ts"), "pricing engine exists", failures);
  check(exists("src/lib/monitoring.ts"), "monitoring exists", failures);
  check(exists("src/lib/security.ts"), "security exists", failures);

  check(run("npm run test:pricing"), "pricing scenarios", failures);
  check(run("npm run lint"), "typescript lint", failures);

  const status = failures.length === 0 ? "PASS" : "FAIL";
  console.log(`FULL TEST SUITE ${status}`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`- ${f}`);
    process.exit(1);
  }
}

main();
