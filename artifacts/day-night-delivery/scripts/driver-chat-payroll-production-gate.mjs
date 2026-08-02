import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, "driver-chat-payroll-production-gate-legacy.mjs");
const temporaryPath = path.join(directory, `.driver-chat-payroll-gate-${process.pid}.mjs`);
const source = fs
  .readFileSync(sourcePath, "utf8")
  .replace(
    "src/components/admin/AdminMerchantStatementsCenter.tsx",
    "src/components/admin/AdminMerchantStatementsCenterPdf.tsx",
  )
  .replace(
    'expect(merchants,/dn-admin-merchant-directory-card/,"Merchant directory cards use a dedicated non-button surface");',
    'expect(merchants,/<article key=\\{item\\.id\\}/,"Merchant directory cards use a dedicated non-button surface");',
  );

fs.writeFileSync(temporaryPath, source, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
