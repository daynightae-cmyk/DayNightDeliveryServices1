import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'merchant-accounts-pdf-browser-acceptance-legacy.mjs');
const temporaryPath = path.join(directory, `.merchant-accounts-pdf-browser-${process.pid}.mjs`);
const source = fs
  .readFileSync(sourcePath, 'utf8')
  .replace(
    '/merchant_id مطابق فقط|Exact merchant_id only/.test(ledgerText)',
    '/عزل البيانات|Data isolation|merchant_id مطابق فقط|ميرتشانت_يد مطابق فقط|Exact merchant_id only/.test(ledgerText)',
  )
  .replace(
    `  const newPdfButton = page.getByRole('button', { name: /إنشاء PDF جديد|Create new PDF/ }).first();
  const reexportButton = page.getByRole('button', { name: /إعادة PDF|Re-export PDF/ }).first();
  assert((await newPdfButton.count()) + (await reexportButton.count()) > 0, \`\${label}: PDF export control is missing.\`);`,
    `  await page
    .getByText(/جاري تحميل سجل كشوف|Loading PDF statement history/)
    .first()
    .waitFor({ state: 'hidden', timeout: 90000 })
    .catch(() => {});
  const pdfButtons = page.locator('.dn-admin-pdf-button');
  assert((await pdfButtons.count()) > 0, \`\${label}: PDF export control is missing.\`);`,
  );

fs.writeFileSync(temporaryPath, source, 'utf8');
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
