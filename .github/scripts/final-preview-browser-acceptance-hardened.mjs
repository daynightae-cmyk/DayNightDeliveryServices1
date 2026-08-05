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

  async function clickVisibleControl(control, controlLabel) {
    const count = await control.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = control.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        return;
      }
    }
    throw new Error(label + ': no visible ' + controlLabel + '.');
  }

  async function assertFinancialPreview(preview, expected, caseLabel) {
    await page.waitForFunction(
      ({ selector, customer, merchant }) => {
        const node = document.querySelector(selector);
        return (
          node instanceof HTMLElement &&
          Number(node.dataset.customerTotal) === customer &&
          Number(node.dataset.merchantDue) === merchant
        );
      },
      {
        selector: '[data-admin-financial-preview-version="7"]',
        customer: expected.customer,
        merchant: expected.merchant,
      },
      { timeout: 15000 },
    );

    const customer = Number(await preview.getAttribute('data-customer-total'));
    const merchant = Number(await preview.getAttribute('data-merchant-due'));
    assert(customer === expected.customer, \`${'${label}'}: ${'${caseLabel}'} customer expected ${'${expected.customer}'} received ${'${customer}'}.\`);
    assert(merchant === expected.merchant, \`${'${label}'}: ${'${caseLabel}'} merchant expected ${'${expected.merchant}'} received ${'${merchant}'}.\`);
  }

  async function typeFinancialValue(input, value, inputLabel) {
    await input.focus();
    await input.press('Control+A');
    await input.pressSequentially(String(value), { delay: 65 });
    const domValue = await input.inputValue();
    assert(domValue === String(value), \`${'${label}'}: ${'${inputLabel}'} DOM expected ${'${value}'} received ${'${domValue}'}.\`);
  }

  try {
    await openAdminFromInjectedSession(page);
    const shell = page.locator('.dncc-shell');
    await shell.waitFor({ state: 'visible', timeout: 90000 });

    const accountsControl = page.locator('[data-dn-command-section="accounts"]');
    const statementsControl = page.locator('[data-dn-command-section="merchant_statements"]');
    const newOrderControl = page.locator('[data-dn-command-section="new_order"]');
    assert((await accountsControl.count()) > 0, \`${'${label}'}: accounts navigation control is missing.\`);
    assert((await statementsControl.count()) > 0, \`${'${label}'}: merchant PDF statements navigation control is missing.\`);
    assert((await newOrderControl.count()) > 0, \`${'${label}'}: new-order navigation control is missing.\`);

    if (/phone/i.test(label)) {
      await page.screenshot({ path: \`preview-browser-evidence/${'${label}'}-admin-registered-routes.png\`, fullPage: true });
      return;
    }

    await clickVisibleSection(newOrderControl, 'new order');
    const form = page.locator('[data-admin-new-order-form="merchant"]');
    await form.waitFor({ state: 'visible', timeout: 90000 });
    const preview = page.locator('[data-admin-financial-preview-version="7"]');
    await preview.waitFor({ state: 'visible', timeout: 90000 });

    const merchantSelect = page.locator('[data-admin-order-owner-select="true"]').first();
    const merchantValue = await merchantSelect.locator('option').evaluateAll((options) => {
      const match = options.find((option) => {
        const value = option.getAttribute('value') || '';
        return value && value !== '__personal_order__';
      });
      return match?.getAttribute('value') || '';
    });
    assert(Boolean(merchantValue), \`${'${label}'}: no real merchant option is available.\`);
    await merchantSelect.selectOption(merchantValue);

    await page.waitForFunction(
      ({ merchantValue }) => {
        const node = document.querySelector('[data-admin-financial-preview-version="7"]');
        return (
          node instanceof HTMLElement &&
          node.dataset.selectedMerchantId === merchantValue &&
          node.dataset.deliveryFeeMode === 'deduct_from_merchant'
        );
      },
      { merchantValue },
      { timeout: 15000 },
    );

    const report = {
      browser: await page.evaluate(() => navigator.userAgent),
      marker: await preview.getAttribute('data-admin-financial-preview-version'),
      selectMerchant: 'PASS',
      liveInput: 'PENDING',
      switchCustomerMerchant: 'PENDING',
      cases: {},
    };

    const goods = page.locator('[data-admin-financial-field="goods_value"]');
    const sequence = [
      { value: '0', customer: 0, merchant: -25, name: 'CASE 1' },
      { value: '10', customer: 10, merchant: -15, name: 'CASE 3' },
      { value: '50', customer: 50, merchant: 25, name: 'LIVE 50' },
      { value: '100', customer: 100, merchant: 75, name: 'CASE 2' },
      { value: '4444', customer: 4444, merchant: 4419, name: 'LIVE 4444' },
    ];

    for (const item of sequence) {
      await typeFinancialValue(goods, item.value, 'goods value');
      await assertFinancialPreview(preview, item, item.name);
      report.cases[item.name] = 'PASS';
    }
    report.liveInput = 'PASS';

    await typeFinancialValue(goods, '100', 'goods value');
    await clickVisibleControl(
      page.getByRole('button', { name: /رسوم التوصيل تُضاف على العميل|Customer pays delivery fee/ }),
      'customer-pays control',
    );
    await assertFinancialPreview(preview, { customer: 125, merchant: 100 }, 'CASE 4');
    report.cases['CASE 4'] = 'PASS';

    await clickVisibleControl(
      page.getByRole('button', { name: /رسوم التوصيل على حساب التاجر|Charge delivery to merchant/ }),
      'merchant-pays control',
    );
    await assertFinancialPreview(preview, { customer: 100, merchant: 75 }, 'merchant switch back');
    report.switchCustomerMerchant = 'PASS';

    await clickVisibleControl(page.getByRole('button', { name: /^يدوي$|^Manual$/ }), 'manual-price control');
    const manualDelivery = page.locator('[data-admin-financial-field="manual_delivery_price"]');
    await manualDelivery.waitFor({ state: 'visible', timeout: 15000 });
    await typeFinancialValue(goods, '50', 'goods value');
    await typeFinancialValue(manualDelivery, '60', 'manual delivery fee');
    await assertFinancialPreview(preview, { customer: 50, merchant: -10 }, 'CASE 5');
    report.cases['CASE 5'] = 'PASS';

    await fs.promises.writeFile(
      `preview-browser-evidence/${'${label}'}-admin-financial-current-main.json`,
      JSON.stringify(report, null, 2),
    );
    await page.screenshot({ path: `preview-browser-evidence/${'${label}'}-admin-financial-current-main.png`, fullPage: true });

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

    await page.screenshot({ path: `preview-browser-evidence/${'${label}'}-admin-accounts-pdf-routes.png`, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: `preview-browser-evidence/${'${label}'}-admin-failure.png`, fullPage: true }).catch(() => {});
    await fs.promises.writeFile(
      `preview-browser-evidence/${'${label}'}-admin-failure.txt`,
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
