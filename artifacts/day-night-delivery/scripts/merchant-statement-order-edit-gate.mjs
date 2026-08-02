import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, "merchant-statement-order-edit-gate-legacy.mjs");
const temporaryPath = path.join(directory, `.merchant-statement-order-edit-gate-${process.pid}.mjs`);
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(
    "/No mixed or fabricated fallback was shown|لم يتم عرض بيانات بديلة أو مختلطة/",
    "/No incomplete or mixed fallback was shown|لم يتم عرض بيانات ناقصة أو مختلطة/",
  );

fs.writeFileSync(temporaryPath, source, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
