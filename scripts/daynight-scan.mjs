import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["src", "public", "dist", "supabase/sql", "scripts"];
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

const forbiddenTerms = [
  ["daynight", ".ae"].join(""),
  ["day-night", ".ae"].join(""),
  ["Admin", "@", "daynight", ".ae"].join(""),
  ["admin", "@", "daynight", ".ae"].join(""),
  ["dn", "_admin_", "authenticated"].join(""),
  ["admin", "_mock_", "btn"].join(""),
  ["handle", "Create", "Mock", "Order"].join(""),
  ["مرسل", "مجهول"].join(" "),
  ["مستلم", "مجهول"].join(" "),
  ["+971", "0000000"].join(""),
  ["mock", "Locations"].join(""),
  ["mock", " order"].join(""),
  ["example", "@mail.com"].join(""),
  ["example", "@domain.ae"].join(""),
  ["+971 50 ", "XXXXXXX"].join(""),
  ["sb", "_secret_"].join("")
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
  const findings = [];

  for (const term of forbiddenTerms) {
    if (content.includes(term)) {
      findings.push(term);
    }
  }

  return findings;
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
