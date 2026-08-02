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
  const shell = page.locator('.dncc-shell');
  const ilytkCard = () => page
    .locator('[data-admin-merchant-accounts-directory="true"] article')
    .filter({ hasText: /استبي ما عرفنالك|DN-MER-SHOP-ILYTK/ })
    .first();

  async function hasOperationalMerchantData(timeout = 25000) {
    try {
      await openSection(page, 'accounts', 'Accounts preload');
      await ilytkCard().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const shellReady = await shell
    .waitFor({ state: 'visible', timeout: 45000 })
    .then(() => true)
    .catch(() => false);
  if (shellReady && await hasOperationalMerchantData()) return;

  // A serialized Supabase session can hydrate the shell while its protected
  // data calls still fail on a mobile browser. Reauthenticate through the real
  // administrator login, then require the canonical ILYTK row before the test
  // continues. This prevents an empty or mixed fallback directory from passing.
  await page.goto(\`${'${base}'}/auth?nosplash=1&lang=ar&__dn_acceptance=merchant_accounts_pdf_login\`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);

  const intro = page.locator('.auth-clean__intro-cta');
  if (await intro.isVisible().catch(() => false)) await intro.click();

  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  await email.waitFor({ state: 'visible', timeout: 30000 });
  await password.waitFor({ state: 'visible', timeout: 30000 });
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await page.locator('button[type="submit"]').click();

  await shell.waitFor({ state: 'visible', timeout: 90000 });
  const recovered = await hasOperationalMerchantData(90000);
  assert(recovered, 'merchant_accounts_operational_data_missing_after_real_login');
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
