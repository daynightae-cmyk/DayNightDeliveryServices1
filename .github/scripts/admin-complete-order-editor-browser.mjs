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
const ilytkId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clickFirstVisible(locator, description) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`Missing visible control: ${description}`);
}

async function bodyText(page) {
  return page.locator('body').innerText();
}

async function signInAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_editor_acceptance=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  const shell = page.locator('.dncc-shell');
  const intro = page.getByRole('button', { name: /تسجيل الدخول|Sign in/ });
  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    if (await shell.isVisible().catch(() => false)) return;
    if (await email.isVisible().catch(() => false)) break;
    if (await intro.isVisible().catch(() => false)) {
      await intro.click();
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(250);
  }

  if (!(await email.isVisible().catch(() => false))) {
    throw new Error('Admin UI did not reach the authenticated shell or login form.');
  }

  await password.waitFor({ state: 'visible', timeout: 30000 });
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await clickFirstVisible(
    page.getByRole('button', { name: /دخول|Sign in/ }),
    'Admin sign-in submit',
  );

  await shell.waitFor({ state: 'visible', timeout: 120000 });
  await page.locator('[data-dn-command-section="all_orders"]').first().waitFor({
    state: 'attached',
    timeout: 120000,
  });
}

async function openAllOrders(page) {
  const section = page.locator('[data-dn-command-section="all_orders"]');
  await section.first().waitFor({ state: 'attached', timeout: 120000 });

  const count = await section.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = section.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }

  const mobileMenu = page.locator('.dncc-mobile-menu');
  await mobileMenu.waitFor({ state: 'visible', timeout: 30000 });
  await mobileMenu.click();
  await page.locator('.dncc-mobile-layer').waitFor({ state: 'visible', timeout: 30000 });
  await clickFirstVisible(section, 'All Orders mobile section');
}

async function waitForCoupon(page, coupon) {
  const list = page.locator('.dn-admin-bulk-selector-list');
  await list.waitFor({ state: 'visible', timeout: 120000 });
  const deadline = Date.now() + 120000;
  let latest = '';
  while (Date.now() < deadline) {
    latest = await list.innerText().catch(() => '');
    if (latest.includes(coupon)) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Coupon ${coupon} did not appear. Last list: ${latest.slice(0, 700)}`);
}

async function prepareReviewedOrder(page) {
  await openAllOrders(page);
  const search = page.locator('[data-admin-order-search="true"]');
  const merchantFilter = page
    .locator('.dn-admin-bulk-filter-grid select')
    .filter({ has: page.locator(`option[value="${ilytkId}"]`) })
    .first();
  await search.waitFor({ state: 'visible', timeout: 90000 });
  await merchantFilter.waitFor({ state: 'visible', timeout: 90000 });
  await merchantFilter.selectOption(ilytkId);
  await search.fill('003860');
  await waitForCoupon(page, '003860');
}

async function verifyEditor(page, label) {
  await clickFirstVisible(
    page.getByRole('button', { name: /تعديل|Edit/ }),
    `${label} order edit button`,
  );

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  const merchant = dialog.locator('[data-admin-complete-order-merchant="true"]');
  const coupon = dialog.locator('[data-admin-complete-order-coupon="true"]');
  const reason = dialog.locator('[data-admin-complete-order-reason="true"]');
  const confirmation = dialog.locator('[data-admin-complete-order-confirm="true"]');

  await merchant.waitFor({ state: 'visible', timeout: 30000 });
  await coupon.waitFor({ state: 'visible', timeout: 30000 });
  await reason.waitFor({ state: 'visible', timeout: 30000 });
  await confirmation.waitFor({ state: 'visible', timeout: 30000 });

  assert(!(await merchant.isDisabled()), `${label}: merchant selector is disabled.`);
  assert((await merchant.inputValue()) === ilytkId, `${label}: merchant UUID is not ILYTK.`);
  assert((await coupon.inputValue()).trim() === '003860', `${label}: coupon is not 003860.`);
  assert(!(await reason.isDisabled()), `${label}: edit reason is disabled.`);
  assert(!(await confirmation.isDisabled()), `${label}: confirmation is disabled.`);
  assert(
    (await dialog.getByText(
      /رقم التتبع والفاتورة لا بيتغيروش|Tracking and invoice identifiers are immutable/,
    ).count()) > 0,
    `${label}: immutable identity guidance is missing.`,
  );

  await dialog.screenshot({
    path: `admin-complete-order-editor-evidence/${label}-editor.png`,
  });
  await clickFirstVisible(
    dialog.getByRole('button', { name: /إلغاء|Cancel/ }),
    `${label} editor cancel`,
  );
  await dialog.waitFor({ state: 'hidden', timeout: 30000 });
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

fs.mkdirSync('admin-complete-order-editor-evidence', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'ar-AE',
});
const page = await context.newPage();
const report = [];

try {
  await signInAdmin(page);
  await prepareReviewedOrder(page);
  await verifyEditor(page, 'desktop');
  report.push({ scenario: 'desktop', completeOrderEditor: 'PASS', savedOrder: false });

  await page.setViewportSize({ width: 412, height: 915 });
  await verifyEditor(page, 'phone');
  report.push({ scenario: 'phone', completeOrderEditor: 'PASS', savedOrder: false });

  fs.writeFileSync(
    'admin-complete-order-editor-evidence/report.json',
    JSON.stringify(
      {
        result: 'PASS',
        merchantId: ilytkId,
        coupon: '003860',
        realAdminUiLogin: true,
        sameSessionAcrossViewports: true,
        saveButtonNeverClicked: true,
        scenarios: report,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page
    .screenshot({
      path: 'admin-complete-order-editor-evidence/failure.png',
      fullPage: true,
    })
    .catch(() => {});
  await fs.promises
    .writeFile(
      'admin-complete-order-editor-evidence/failure.txt',
      `${String(error?.stack || error)}\n\n${await bodyText(page).catch(() => 'body unavailable')}`,
    )
    .catch(() => {});
  throw error;
} finally {
  await revokeSession(page).catch(() => {});
  await context.close();
  await browser.close();
}
