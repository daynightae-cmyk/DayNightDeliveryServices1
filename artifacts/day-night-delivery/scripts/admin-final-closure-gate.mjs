import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, "admin-final-closure-gate-legacy.mjs");
const temporaryPath = path.join(directory, `.admin-final-closure-gate-${process.pid}.mjs`);
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(
    'read("src/components/admin/AdminSectionWorkspaceComplete.tsx")',
    'read("src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx")',
  )
  .replace(
    'read("src/components/admin/AdminOperationsLayer.tsx")',
    'read("src/components/admin/AdminOperationsLayerLegacy.tsx")',
  );

fs.writeFileSync(temporaryPath, source, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
