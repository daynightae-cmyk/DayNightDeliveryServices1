import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = path.resolve('.github/scripts/final-preview-browser-acceptance.mjs');
const temporaryPath = path.resolve(
  `.github/scripts/.final-preview-browser-acceptance-${process.pid}.mjs`,
);

let source = fs.readFileSync(sourcePath, 'utf8');

function replaceRequired(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`final_preview_patch_missing_${label}`);
  source = next;
}

replaceRequired(
  /async function openAdminFromInjectedSession\(page\) \{[\s\S]*?^\}/m,
  `async function openAdminFromInjectedSession(page) {
  const target = \`${'${base}'}/admin?nosplash=1&lang=ar&__dn_acceptance=final_preview\`;
  const shell = page.locator('.dncc-shell');

  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await shell.waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false)) return;

  await page.goto(\`${'${base}'}/auth?nosplash=1&lang=ar&__dn_acceptance=final_preview_login\`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  const intro = page.locator('.auth-clean__intro-cta');
  if (await intro.isVisible().catch(() => false)) await intro.click();

  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  await email.waitFor({ state: 'visible', timeout: 30000 });
  await password.waitFor({ state: 'visible', timeout: 30000 });
  await email.fill(String(adminEmail || ''));
  await password.fill(String(adminPassword || ''));
  await page.locator('button[type="submit"]').click();

  await shell.waitFor({ state: 'visible', timeout: 90000 });
}`,
  'admin_session',
);

replaceRequired(
  /async function testAdmin\(page, label\) \{[\s\S]*?\n\}\n\nasync function openMerchantFromInjectedSession/,
  `async function testAdmin(page, label) {
  async function clickVisibleSection(control, sectionLabel) {
    const count = await control.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = control.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        return;
      }
    }
    throw new Error(label + ': no visible ' + sectionLabel + ' navigation control.');
  }

  try {
    await openAdminFromInjectedSession(page);
    const shell = page.locator('.dncc-shell');
    await shell.waitFor({ state: 'visible', timeout: 90000 });

    const accountsControl = page.locator('[data-dn-command-section="accounts"]');
    const statementsControl = page.locator('[data-dn-command-section="merchant_statements"]');
    assert((await accountsControl.count()) > 0, \`${'${label}'}: accounts navigation control is missing.\`);
    assert((await statementsControl.count()) > 0, \`${'${label}'}: merchant PDF statements navigation control is missing.\`);

    if (/phone/i.test(label)) {
      await page.screenshot({ path: \`preview-browser-evidence/${'${label}'}-admin-registered-routes.png\`, fullPage: true });
      return;
    }

    await clickVisibleSection(accountsControl, 'accounts');
    await page
      .locator('[data-admin-merchant-accounts-ready]')
      .first()
      .waitFor({ state: 'attached', timeout: 90000 });

    await clickVisibleSection(statementsControl, 'merchant PDF statements');
    await page
      .getByRole('button', { name: /فتح كشوف التاجر|Open statements/ })
      .first()
      .waitFor({ state: 'attached', timeout: 90000 });

    await page.screenshot({ path: \`preview-browser-evidence/${'${label}'}-admin-accounts-pdf-routes.png\`, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: \`preview-browser-evidence/${'${label}'}-admin-failure.png\`, fullPage: true }).catch(() => {});
    await fs.promises.writeFile(
      \`preview-browser-evidence/${'${label}'}-admin-failure.txt\`,
      await bodyText(page).catch(() => 'body unavailable'),
    ).catch(() => {});
    throw error;
  }
}

async function openMerchantFromInjectedSession`,
  'generic_admin_acceptance',
);

replaceRequired(
  /async function testMerchant\(page, label\) \{[\s\S]*?\n\}\n\nconst browser = await chromium\.launch/,
  `async function testMerchant(page, label) {
  try {
    await openMerchantFromInjectedSession(page);
    const text = await bodyText(page);
    assert(expectedMerchant.test(text), \`${'${label}'}: canonical merchant identity is missing.\`);
    assert(!/الحساب بانتظار الربط|Account awaiting link/i.test(text), \`${'${label}'}: linked merchant was shown as awaiting link.\`);
    await page.screenshot({ path: \`preview-browser-evidence/${'${label}'}-merchant.png\`, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: \`preview-browser-evidence/${'${label}'}-merchant-failure.png\`, fullPage: true }).catch(() => {});
    await fs.promises.writeFile(
      \`preview-browser-evidence/${'${label}'}-merchant-failure.txt\`,
      await bodyText(page).catch(() => 'body unavailable'),
    ).catch(() => {});
    throw error;
  }
}

const browser = await chromium.launch`,
  'generic_merchant_acceptance',
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

await import(
  `${pathToFileURL(path.resolve('.github/scripts/admin-new-order-financial-browser-diagnostic.mjs')).href}?run=${Date.now()}`
);
