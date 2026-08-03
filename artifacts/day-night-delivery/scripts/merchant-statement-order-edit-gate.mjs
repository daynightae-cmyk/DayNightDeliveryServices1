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
    "/No mixed data was shown|No merchant account was opened with incomplete or mixed data|لم يتم عرض بيانات مختلطة|لم يتم فتح أي ملف تاجر ببيانات ناقصة أو مختلطة/",
  )
  .replace(
    'expect(editModal, /sticky bottom-0/, "Order update controls remain visible while scrolling");',
    'expect(editModal, /<header[^>]*shrink-0[\\s\\S]*min-h-0 flex-1[\\s\\S]*overflow-y-auto[\\s\\S]*<footer[^>]*shrink-0/, "Order update controls remain visible outside the scrolling form body");',
  )
  .replace(
    'expect(editModalBoundary, /setLastSavedOrder\\(savedOrder\\)/, "Verified saves keep the order editor mounted");',
    'expect(editModalBoundary, /async function handleSaved\\(_savedOrder: Order\\)[\\s\\S]*Intentionally no parent callback/, "Verified saves keep the order editor mounted without a refresh");',
  )
  .replace(
    'expect(editModalBoundary, /if \\(lastSavedOrder\\) await onSaved\\?\\.\\(lastSavedOrder\\)/, "Parent refresh is deferred until explicit close");',
    'reject(editModalBoundary, /await onSaved\\?\\.\\(|_legacyParentRefresh\\s*\\(/, "Verified saves never invoke the legacy parent refresh");',
  );

fs.writeFileSync(temporaryPath, source, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}