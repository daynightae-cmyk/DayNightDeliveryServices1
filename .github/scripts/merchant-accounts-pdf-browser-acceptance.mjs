import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(directory, 'merchant-accounts-pdf-browser-acceptance-legacy.mjs');
const temporaryPath = path.join(directory, `.merchant-accounts-pdf-browser-${process.pid}.mjs`);
let source = fs.readFileSync(sourcePath, 'utf8');

function replaceRequired(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`merchant_accounts_acceptance_patch_missing_${label}`);
  source = next;
}

replaceRequired(
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

  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const shellReady = await shell
    .waitFor({ state: 'visible', timeout: 60000 })
    .then(() => true)
    .catch(() => false);

  if (!shellReady) {
    await page.goto(\`${'${base}'}/auth?nosplash=1&lang=ar&__dn_acceptance=merchant_accounts_pdf_login\`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    const intro = page.locator('.auth-clean__intro-cta');
    if (await intro.isVisible().catch(() => false)) await intro.click();
    await page.locator('#dn-admin-email').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#dn-admin-email').fill(adminEmail);
    await page.locator('#dn-admin-password').fill(adminPassword);
    await page.locator('button[type="submit"]').click();
    await shell.waitFor({ state: 'visible', timeout: 90000 });
  }

  await openSection(page, 'accounts', 'Accounts preload');
  const ready = page.locator('[data-admin-merchant-accounts-ready="true"]');
  if (!(await ready.waitFor({ state: 'attached', timeout: 90000 }).then(() => true).catch(() => false))) {
    const refresh = page.getByRole('button', { name: /تحديث|Refresh/ }).first();
    if (await refresh.isVisible().catch(() => false)) await refresh.click();
    await ready.waitFor({ state: 'attached', timeout: 120000 });
  }

  const root = page.locator('[data-admin-merchant-accounts-ready="true"]').first();
  const orderCount = Number(await root.getAttribute('data-authoritative-order-count'));
  const merchantCount = Number(await root.getAttribute('data-authoritative-merchant-count'));
  assert(orderCount > 0, 'merchant_accounts_verified_order_count_missing');
  assert(merchantCount > 0, 'merchant_accounts_verified_merchant_count_missing');
}`,
  'open_admin',
);

replaceRequired(
  /async function verifyAccounts\(page, label\) \{[\s\S]*?^\}/m,
  `async function verifyAccounts(page, label) {
  await openSection(page, 'accounts', 'Accounts');
  const ready = page.locator('[data-admin-merchant-accounts-ready="true"]');
  await ready.waitFor({ state: 'attached', timeout: 120000 });

  const directory = page.locator('[data-admin-merchant-accounts-directory="true"]');
  await directory.waitFor({ state: 'visible', timeout: 90000 });
  assert(!(await page.locator('text=70 صف مالي حقيقي').isVisible().catch(() => false)), label + ': legacy mixed finance table is still visible.');
  await selectIlytkCard(directory, /فتح الحساب والطلبيات|Open account and orders/, label + ' accounts');

  const account = page.locator('[data-admin-merchant-account-file="true"]');
  await account.waitFor({ state: 'visible', timeout: 90000 });
  let accountText = await account.innerText();
  assert(/DN-MER-SHOP-ILYTK|استبي ما عرفنالك/.test(accountText), label + ': selected merchant account header is missing.');
  assert(!accountText.includes('DN-MER-SHOP-G3BXG'), label + ': another merchant identity leaked into the selected account.');

  await clickFirstVisible(account.getByRole('button', { name: /طلبيات التاجر|Merchant orders/ }), label + ': merchant orders tab');
  const orderRows = account.locator('tbody tr');
  await orderRows.first().waitFor({ state: 'visible', timeout: 90000 });
  assert((await orderRows.count()) > 0, label + ': selected merchant has no rendered order rows.');
  accountText = await account.innerText();
  assert(!accountText.includes('DN-MER-SHOP-G3BXG'), label + ': another merchant leaked into the selected order list.');

  await clickFirstVisible(account.getByRole('button', { name: /الحركات المالية|Finance ledger/ }), label + ': finance ledger tab');
  await page.waitForTimeout(700);
  const ledgerText = await account.innerText();
  assert(!ledgerText.includes('DN-MER-SHOP-G3BXG'), label + ': another merchant leaked into the finance ledger.');
  assert(/عزل البيانات|Data isolation|merchant_id مطابق فقط|ميرتشانت_يد مطابق فقط|Exact merchant_id only/.test(ledgerText), label + ': exact merchant isolation indicator missing.');

  await account.screenshot({ path: 'merchant-accounts-pdf-evidence/' + label + '-merchant-account.png' });
}`,
  'verify_accounts',
);

replaceRequired(
  /async function verifyPdfStatements\(page, label\) \{[\s\S]*?^\}/m,
  `async function verifyPdfStatements(page, label) {
  await openSection(page, 'merchant_statements', 'Merchant statements');
  const section = page.locator('section').filter({ hasText: /كشوف PDF للتجار|Merchant PDF statements/ }).first();
  await section.waitFor({ state: 'visible', timeout: 90000 });
  await selectIlytkCard(section, /فتح كشوف التاجر|Open statements/, label + ' PDF statements');

  await page
    .getByText(/جاري تحميل سجل كشوف|Loading PDF statement history/)
    .first()
    .waitFor({ state: 'hidden', timeout: 120000 })
    .catch(() => {});

  const body = page.locator('body');
  const bodyText = await body.innerText();
  assert(/DN-MER-SHOP-ILYTK|استبي ما عرفنالك/.test(bodyText), label + ': selected merchant PDF workspace is missing.');
  assert(!bodyText.includes('DN-MER-SHOP-G3BXG'), label + ': another merchant leaked into the PDF workspace.');
  assert(!/تعذر التحقق من سجل كشوف|سجل كشوف PDF غير جاهز|PDF statement log could not be verified|PDF statement log is unavailable/.test(bodyText), label + ': PDF history verification failed and export remained unsafe.');

  const statusBadges = page.locator('[data-merchant-pdf-exported="true"], [data-merchant-pdf-not-exported="true"]');
  await statusBadges.first().waitFor({ state: 'visible', timeout: 90000 });
  assert((await statusBadges.count()) > 0, label + ': PDF inclusion status is missing beside merchant orders.');
  assert((await page.getByText(/تم تحويلها للتاجر|Sent to merchant/).count()) === 0, label + ': obsolete WhatsApp transfer status is still rendered.');

  const whatsapp = page.getByRole('link', { name: /فتح واتساب — بدون تغيير الحالة|Open WhatsApp — no status change/ }).first();
  await whatsapp.waitFor({ state: 'visible', timeout: 30000 });
  const href = await whatsapp.getAttribute('href');
  assert(href?.startsWith('https://wa.me/'), label + ': prefilled WhatsApp link is invalid.');
  assert(href.includes('text='), label + ': WhatsApp summary is not prefilled.');

  const pdfButtons = page.locator('.dn-admin-pdf-button');
  const pdfButtonCount = await pdfButtons.count();
  assert(pdfButtonCount > 0, label + ': PDF export control is missing.');
  let enabledPdfButton = null;
  for (let index = 0; index < pdfButtonCount; index += 1) {
    const candidate = pdfButtons.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      enabledPdfButton = candidate;
      break;
    }
  }
  assert(enabledPdfButton, label + ': no visible PDF export control was found.');
  assert(!(await enabledPdfButton.isDisabled()), label + ': PDF export is disabled after history verification.');

  await page.screenshot({ path: 'merchant-accounts-pdf-evidence/' + label + '-pdf-statements.png', fullPage: true });
}`,
  'verify_pdf',
);

source = source.replace(
  "      reviewedOrdersVisible: 'PASS',",
  "      merchantOrderRowsVisible: 'PASS',",
);
source = source.replace(
  "      crossMerchantOrderBlocked: 'PASS',",
  "      crossMerchantDataBlocked: 'PASS',",
);
source = source.replace(
  "      reviewedCoupons,\n      excludedCoupon,",
  "      fixedCouponFixturesRemoved: true,",
);

fs.writeFileSync(temporaryPath, source, 'utf8');
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
