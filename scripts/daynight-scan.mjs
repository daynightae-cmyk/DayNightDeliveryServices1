import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["src", "public", "supabase/sql", "scripts"];
const ignoreDirs = new Set([".git", "node_modules"]);
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".sql",
  ".css",
  ".html",
  ".txt",
  ".yml",
  ".yaml"
]);

const forbiddenRules = [
  { id: "legacy-domain-daynightae", type: "text", value: ["daynight", ".ae"].join("") },
  { id: "legacy-domain-day-night", type: "text", value: ["day-night", ".ae"].join("") },
  { id: "legacy-email-admin-lower", type: "text", value: ["admin", "@", "daynight", ".ae"].join("") },
  { id: "legacy-admin-auth-flag", type: "text", value: ["dn", "_admin_", "authenticated"].join("") },
  { id: "legacy-admin-mock-btn", type: "text", value: ["admin", "_mock_", "btn"].join("") },
  { id: "legacy-mock-order-handler", type: "text", value: ["handle", "Create", "Mock", "Order"].join("") },
  { id: "arabic-mock-sender", type: "text", value: ["مرسل", "مجهول"].join(" ") },
  { id: "arabic-mock-receiver", type: "text", value: ["مستلم", "مجهول"].join(" ") },
  { id: "fake-phone-number", type: "text", value: ["+971", "0000000"].join("") },
  { id: "mock-locations", type: "text", value: ["mock", "Locations"].join("") },
  { id: "mock-order", type: "text", value: ["mock", " order"].join("") },
  { id: "fake-example-mail", type: "text", value: ["example", "@mail.com"].join("") },
  { id: "fake-example-domain", type: "text", value: ["example", "@domain.ae"].join("") },
  { id: "masked-phone", type: "text", value: ["+971 50 ", "XXXXXXX"].join("") },
  { id: "localhost", type: "regex", value: /localhost/i },
  { id: "loopback-ip", type: "regex", value: /127\.0\.0\.1/i },
  { id: "todo-unsafe", type: "regex", value: /TODO\s+unsafe/i },
  { id: "fixme-unsafe", type: "regex", value: /FIXME\s+unsafe/i },
  { id: "lorem-ipsum", type: "regex", value: /lorem ipsum/i },
  { id: "undefined-phone", type: "regex", value: /undefined\s+phone/i },
  { id: "empty-href", type: "regex", value: /href\s*=\s*["']\s*["']/i },
  { id: "javascript-void", type: "regex", value: /javascript:void/i },
  { id: "gemini-api-leftover", type: "regex", value: /Gemini API leftover/i },
  { id: "google-ai-studio", type: "regex", value: /Google AI Studio/i },
  { id: "my-google-ai-studio-app", type: "regex", value: /My Google AI Studio App/i },
  {
    id: "service-role-token",
    type: "regex",
    value: /service_role/i,
    allowLine: /DO NOT USE service_role IN FRONTEND\./i
  },
  { id: "supabase-secret-token", type: "text", value: ["sb", "_secret_"].join("") },
  { id: "hardcoded-supabase-secret", type: "regex", value: /supabase[^\n\r]{0,120}(secret|service_role|sb_secret)/i },
  { id: "frontend-orders-insert", type: "regex", value: /from\(['"]orders['"]\)\.insert\(/i, onlyPath: /^src\// },
  { id: "frontend-orders-update", type: "regex", value: /from\(['"]orders['"]\)\.update\(/i, onlyPath: /^src\// }
];

function walk(dirPath, output) {
  if (!fs.existsSync(dirPath)) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      walk(fullPath, output);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (ext && !textExtensions.has(ext)) continue;
    output.push(fullPath);
  }
}

function scanFile(filePath) {
  const normalized = toRelative(filePath);
  if (normalized === "scripts/daynight-scan.mjs") {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const findings = new Set();
  const lines = content.split(/\r?\n/);

  for (const rule of forbiddenRules) {
    if (rule.onlyPath && !rule.onlyPath.test(normalized)) {
      continue;
    }

    if (rule.type === "text") {
      if (content.includes(rule.value)) {
        findings.add(rule.id);
      }
      continue;
    }

    for (const line of lines) {
      if (!rule.value.test(line)) {
        continue;
      }

      if (rule.allowLine && rule.allowLine.test(line)) {
        continue;
      }

      findings.add(rule.id);
      break;
    }
  }

  return [...findings];
}

function toRelative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function main() {
  const files = [];
  for (const target of targets) {
    walk(path.resolve(root, target), files);
  }

  const failures = [];

  for (const file of files) {
    const matches = scanFile(file);
    if (matches.length > 0) {
      failures.push({ file: toRelative(file), matches });
    }
  }

  if (failures.length > 0) {
    console.error("SCAN FAIL");
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.matches.join(", ")}`);
    }
    process.exit(1);
  }

  console.log("SCAN PASS");
}

main();
