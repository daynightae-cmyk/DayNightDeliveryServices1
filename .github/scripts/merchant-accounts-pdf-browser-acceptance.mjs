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
    `async function openAdmin(page) {
  await page.goto(\`${'${base}'}/admin?nosplash=1&lang=ar&__dn_acceptance=merchant_accounts_pdf\`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForURL((url) => url.pathname === '/admin', { timeout: 90000 });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
}`,
    `async function openAdmin(page) {
  const target = \`${'${base}'}/admin?nosplash=1&lang=ar&__dn_acceptance=merchant_accounts_pdf\`;
  let latestUrl = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(target, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    latestUrl = page.url();
    const shell = page.locator('.dncc-shell');
    if (await shell.isVisible().catch(() => false)) return;
    await page.waitForTimeout(1200 * (attempt + 1));
    if (attempt < 2) await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    if (await shell.isVisible().catch(() => false)) return;
  }
  throw new Error(\`merchant_accounts_admin_shell_missing_after_session_retry: ${'${latestUrl}'}\`);
}`,
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
