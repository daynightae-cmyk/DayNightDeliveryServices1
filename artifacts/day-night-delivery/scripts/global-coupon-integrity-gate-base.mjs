import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, "global-coupon-integrity-gate-base-legacy.mjs");
const temporaryPath = path.join(directory, `.global-coupon-integrity-gate-${process.pid}.mjs`);
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(
    "src/components/admin/AdminSectionWorkspaceComplete.tsx",
    "src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx",
  );

fs.writeFileSync(temporaryPath, source, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
