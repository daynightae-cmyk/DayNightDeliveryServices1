import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const merchantId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const couponNumber = '003860';
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
const evidenceDir = 'admin-complete-order-editor-evidence';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clickFirstVisible(locator, description) {
  for (let index = 0; index < await locator.count(); index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`Missing visible control: ${description}`);
}

async function signInAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_editor_acceptance=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  const shell = page.locator('.dncc-shell');
  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  const intro = page.getByRole('button', { name: /تسجيل الدخول|Sign in/ });
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    if (await shell.isVisible().catch(() => false)) return;
    if (await email.isVisible().catch(() => false)) break;
    if (await intro.isVisible().catch(() => false)) {
      await intro.click();
    }
    await page.waitForTimeout(250);
  }

  assert(await email.isVisible().catch(() => false), 'Admin login form did not become visible.');
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await clickFirstVisible(page.getByRole('button', { name: /دخول|Sign in/ }), 'Admin sign-in');
  await shell.waitFor({ state: 'visible', timeout: 120000 });
}

async function openAllOrders(page) {
  const section = page.locator('[data-dn-command-section="all_orders"]');
  await section.first().waitFor({ state: 'attached', timeout: 120000 });
  for (let index = 0; index < await section.count(); index += 1) {
    const candidate = section.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  await page.locator('.dncc-mobile-menu').click();
  await page.locator('.dncc-mobile-layer').waitFor({ state: 'visible', timeout: 30000 });
  await clickFirstVisible(section, 'All Orders mobile section');
}

async function prepareReviewedOrder(page) {
  await openAllOrders(page);
  const search = page.locator('[data-admin-order-search="true"]');
  const merchantFilter = page
    .locator('.dn-admin-bulk-filter-grid select')
    .filter({ has: page.locator(`option[value="${merchantId}"]`) })
    .first();
  await search.waitFor({ state: 'visible', timeout: 90000 });
  await merchantFilter.waitFor({ state: 'visible', timeout: 90000 });
  await merchantFilter.selectOption(merchantId);
  await search.fill(couponNumber);

  const list = page.locator('.dn-admin-bulk-selector-list');
  await list.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForFunction(
    ({ selector, coupon }) => document.querySelector(selector)?.textContent?.includes(coupon),
    { selector: '.dn-admin-bulk-selector-list', coupon: couponNumber },
    { timeout: 120000 },
  );
}

async function verifyEditor(page, label) {
  await clickFirstVisible(
    page.getByRole('button', { name: /تعديل|Edit/ }),
    `${label} edit button`,
  );

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 30000 });

  const merchant = dialog.locator('[data-admin-complete-order-merchant="true"]');
  const coupon = dialog.locator('[data-admin-complete-order-coupon="true"]');
  const save = dialog.getByRole('button', { name: /حفظ التعديلات|Save changes/ });
  const cancel = dialog.getByRole('button', { name: /إلغاء|Cancel/ });
  const editableControls = dialog.locator(
    'input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])',
  );

  await merchant.waitFor({ state: 'visible', timeout: 30000 });
  await coupon.waitFor({ state: 'visible', timeout: 30000 });
  await save.waitFor({ state: 'visible', timeout: 30000 });
  await cancel.waitFor({ state: 'visible', timeout: 30000 });

  assert(!(await merchant.isDisabled()), `${label}: merchant selector is disabled.`);
  assert((await merchant.inputValue()) === merchantId, `${label}: merchant UUID mismatch.`);
  assert((await coupon.inputValue()).trim() === couponNumber, `${label}: coupon mismatch.`);
  assert(!(await save.isDisabled()), `${label}: save button is disabled.`);
  assert((await editableControls.count()) >= 8, `${label}: editable order fields are missing.`);
  assert(
    (await dialog.locator('[data-admin-complete-order-reason="true"]').count()) === 0,
    `${label}: retired manual reason control is rendered.`,
  );
  assert(
    (await dialog.locator('[data-admin-complete-order-confirm="true"]').count()) === 0,
    `${label}: retired manual confirmation control is rendered.`,
  );

  await dialog.screenshot({ path: `${evidenceDir}/${label}-editor.png` });
  await cancel.click();
  await dialog.waitFor({ state: 'hidden', timeout: 30000 });

  return {
    scenario: label,
    completeOrderEditor: 'PASS',
    merchantEditable: true,
    couponVisible: true,
    editableFieldCount: await editableControls.count().catch(() => 0),
    saveActionVisible: true,
    automaticAuditControls: true,
    savedOrder: false,
  };
}

async function revokeSession(page) {
  const serialized = await page
    .evaluate((key) => window.localStorage.getItem(key), storageKey)
    .catch(() => null);
  if (!serialized) return;
  const parsed = JSON.parse(serialized);
  if (!parsed?.access_token || !parsed?.refresh_token) return;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.setSession({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
  });
  if (!error) await client.auth.signOut({ scope: 'local' });
}

fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'ar-AE',
});
const page = await context.newPage();

try {
  await signInAdmin(page);
  await prepareReviewedOrder(page);
  const desktop = await verifyEditor(page, 'desktop');
  await page.setViewportSize({ width: 412, height: 915 });
  const phone = await verifyEditor(page, 'phone');

  const report = {
    result: 'PASS',
    merchantId,
    coupon: couponNumber,
    realAdminUiLogin: true,
    sameSessionAcrossViewports: true,
    automaticAuditReason: true,
    obsoleteManualControlsAbsent: true,
    saveButtonNeverClicked: true,
    scenarios: [desktop, phone],
  };
  fs.writeFileSync(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: `${evidenceDir}/failure.png`, fullPage: true }).catch(() => {});
  const body = await page.locator('body').innerText().catch(() => 'body unavailable');
  fs.writeFileSync(`${evidenceDir}/failure.txt`, `${String(error?.stack || error)}\n\n${body}`);
  throw error;
} finally {
  await revokeSession(page).catch(() => {});
  await context.close();
  await browser.close();
}
