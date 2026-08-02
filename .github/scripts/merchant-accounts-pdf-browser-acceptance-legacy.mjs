import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const ilytkId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const reviewedCoupons = ['003860', '010503', '010505'];
const excludedCoupon = '010504';
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };
}

async function createAdminSession() {
  const memory = memoryStorage();
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memory.adapter,
      storageKey,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (error) throw new Error(`merchant_accounts_admin_login_failed: ${error.message}`);
  assert(data?.session?.access_token && data?.user?.id, 'merchant_accounts_admin_session_missing');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw new Error(`merchant_accounts_admin_profile_failed: ${profileError.message}`);
  assert(['admin', 'support'].includes(String(profile?.role || '').toLowerCase()), 'merchant_accounts_user_not_admin');

  const serialized = memory.values.get(storageKey);
  assert(typeof serialized === 'string' && serialized.includes(data.session.access_token), 'merchant_accounts_serialized_session_missing');
  return { serialized, client };
}

async function createContext(browser, options, serialized) {
  const context = await browser.newContext(options);
  await context.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: serialized },
  );
  return context;
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

async function openSection(page, id, description) {
  const section = page.locator(`[data-dn-command-section="${id}"]`);
  await section.first().waitFor({ state: 'attached', timeout: 90000 });
  const count = await section.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = section.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }

  const menu = page.locator('.dncc-mobile-menu');
  await menu.waitFor({ state: 'visible', timeout: 30000 });
  await menu.click();
  await page.locator('.dncc-mobile-layer').waitFor({ state: 'visible', timeout: 30000 });
  await clickFirstVisible(section, `${description} in mobile menu`);
}

async function waitForText(locator, expected, label) {
  let latest = '';
  for (let attempt = 0; attempt < 120; attempt += 1) {
    latest = await locator.innerText().catch(() => '');
    if (expected.every((value) => latest.includes(value))) return latest;
    await locator.page().waitForTimeout(500);
  }
  throw new Error(`${label} missing expected values. Last text: ${latest.slice(0, 1000)}`);
}

async function openAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=merchant_accounts_pdf`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForURL((url) => url.pathname === '/admin', { timeout: 90000 });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
}

async function selectIlytkCard(directory, actionPattern, label) {
  const card = directory.locator('article').filter({ hasText: /استبي ما عرفنالك|DN-MER-SHOP-ILYTK/ }).first();
  await card.waitFor({ state: 'visible', timeout: 90000 });
  const text = await card.innerText();
  assert(/DN-MER-SHOP-ILYTK|استبي ما عرفنالك/.test(text), `${label}: canonical ILYTK card missing.`);
  await clickFirstVisible(card.getByRole('button', { name: actionPattern }), `${label}: ILYTK action`);
}

async function verifyAccounts(page, label) {
  await openSection(page, 'accounts', 'Accounts');
  const directory = page.locator('[data-admin-merchant-accounts-directory="true"]');
  await directory.waitFor({ state: 'visible', timeout: 90000 });
  assert(!(await page.locator('text=70 صف مالي حقيقي').isVisible().catch(() => false)), `${label}: legacy mixed 70-row finance table is still visible.`);
  await selectIlytkCard(directory, /فتح الحساب والطلبيات|Open account and orders/, `${label} accounts`);

  const account = page.locator('[data-admin-merchant-account-file="true"]');
  await account.waitFor({ state: 'visible', timeout: 90000 });
  let accountText = await account.innerText();
  assert(accountText.includes('DN-MER-SHOP-ILYTK') || accountText.includes('استبي ما عرفنالك'), `${label}: account header is not canonical ILYTK.`);
  assert(!accountText.includes('DN-MER-SHOP-G3BXG'), `${label}: G3BXG identity leaked into ILYTK account.`);

  await clickFirstVisible(account.getByRole('button', { name: /طلبيات التاجر|Merchant orders/ }), `${label}: merchant orders tab`);
  accountText = await waitForText(account, reviewedCoupons, `${label}: ILYTK account orders`);
  for (const coupon of reviewedCoupons) {
    assert(accountText.includes(coupon), `${label}: account is missing ${coupon}.`);
  }
  assert(!accountText.includes(excludedCoupon), `${label}: excluded coupon ${excludedCoupon} leaked into ILYTK account.`);

  await clickFirstVisible(account.getByRole('button', { name: /الحركات المالية|Finance ledger/ }), `${label}: finance ledger tab`);
  await page.waitForTimeout(700);
  const ledgerText = await account.innerText();
  assert(!ledgerText.includes('DN-MER-SHOP-G3BXG'), `${label}: another merchant leaked into ILYTK ledger.`);
  assert(/merchant_id مطابق فقط|Exact merchant_id only/.test(ledgerText), `${label}: exact merchant isolation indicator missing.`);

  await account.screenshot({ path: `merchant-accounts-pdf-evidence/${label}-merchant-account.png` });
}

async function verifyPdfStatements(page, label) {
  await openSection(page, 'merchant_statements', 'Merchant statements');
  const directory = page.getByText(/اختر التاجر أولًا|Choose the merchant first/).locator('..').locator('..');
  await directory.first().waitFor({ state: 'visible', timeout: 90000 });

  const section = page.locator('section').filter({ hasText: /كشوف PDF للتجار|Merchant PDF statements/ }).first();
  await section.waitFor({ state: 'visible', timeout: 90000 });
  await selectIlytkCard(section, /فتح كشوف التاجر|Open statements/, `${label} PDF statements`);

  const body = page.locator('body');
  const text = await waitForText(body, reviewedCoupons, `${label}: PDF statement orders`);
  for (const coupon of reviewedCoupons) {
    assert(text.includes(coupon), `${label}: PDF statement view is missing ${coupon}.`);
  }
  assert(!text.includes(excludedCoupon), `${label}: excluded coupon ${excludedCoupon} leaked into ILYTK PDF statement view.`);

  const whatsapp = page.getByRole('link', { name: /فتح واتساب — بدون تغيير الحالة|Open WhatsApp — no status change/ }).first();
  await whatsapp.waitFor({ state: 'visible', timeout: 30000 });
  const href = await whatsapp.getAttribute('href');
  assert(href?.startsWith('https://wa.me/'), `${label}: prefilled WhatsApp link is invalid.`);
  assert(href.includes('text='), `${label}: WhatsApp summary is not prefilled.`);

  const statusBadges = page.locator('[data-merchant-pdf-exported="true"], [data-merchant-pdf-not-exported="true"]');
  assert((await statusBadges.count()) >= reviewedCoupons.length, `${label}: PDF status badge missing beside reviewed orders.`);
  assert((await page.getByText(/تم تحويلها للتاجر|Sent to merchant/).count()) === 0, `${label}: obsolete WhatsApp transfer badge is still rendered.`);

  const newPdfButton = page.getByRole('button', { name: /إنشاء PDF جديد|Create new PDF/ }).first();
  const reexportButton = page.getByRole('button', { name: /إعادة PDF|Re-export PDF/ }).first();
  assert((await newPdfButton.count()) + (await reexportButton.count()) > 0, `${label}: PDF export control is missing.`);

  await page.screenshot({ path: `merchant-accounts-pdf-evidence/${label}-pdf-statements.png`, fullPage: true });
}

async function dispatchLogCount(serviceClient) {
  const { count, error } = await serviceClient
    .from('merchant_statement_dispatch_log')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', ilytkId);
  if (error) throw new Error(`merchant_statement_dispatch_count_failed: ${error.message}`);
  return Number(count || 0);
}

fs.mkdirSync('merchant-accounts-pdf-evidence', { recursive: true });
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const beforeCount = await dispatchLogCount(serviceClient);
const browser = await chromium.launch({ headless: true });
const scenarios = [
  { label: 'desktop', context: { viewport: { width: 1440, height: 1000 }, locale: 'ar-AE' } },
  { label: 'phone', context: { ...devices['Pixel 7'], locale: 'ar-AE' } },
];
const report = [];
let cleanupError = null;

try {
  for (const scenario of scenarios) {
    const auth = await createAdminSession();
    try {
      const context = await createContext(browser, scenario.context, auth.serialized);
      try {
        const page = await context.newPage();
        await openAdmin(page);
        await verifyAccounts(page, scenario.label);
        await verifyPdfStatements(page, scenario.label);
      } catch (error) {
        const pages = context.pages();
        const page = pages[pages.length - 1];
        await page?.screenshot({ path: `merchant-accounts-pdf-evidence/${scenario.label}-failure.png`, fullPage: true }).catch(() => {});
        await fs.promises.writeFile(
          `merchant-accounts-pdf-evidence/${scenario.label}-failure.txt`,
          `${String(error?.stack || error)}\n\n${await page?.locator('body').innerText().catch(() => 'body unavailable')}`,
        ).catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    } finally {
      await auth.client.auth.signOut({ scope: 'local' }).catch((error) => {
        cleanupError ||= error;
      });
    }

    report.push({
      scenario: scenario.label,
      merchantDirectoryFirst: 'PASS',
      exactMerchantAccountIsolation: 'PASS',
      reviewedOrdersVisible: 'PASS',
      crossMerchantOrderBlocked: 'PASS',
      pdfOnlyStatus: 'PASS',
      whatsappNoStatusChange: 'PASS',
    });
  }
} finally {
  await browser.close();
}

if (cleanupError) throw cleanupError;
const afterCount = await dispatchLogCount(serviceClient);
assert(afterCount === beforeCount, `Browser acceptance changed dispatch log rows: ${beforeCount} -> ${afterCount}`);

fs.writeFileSync(
  'merchant-accounts-pdf-evidence/report.json',
  JSON.stringify(
    {
      result: 'PASS',
      branchHead: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA,
      merchantId: ilytkId,
      reviewedCoupons,
      excludedCoupon,
      dispatchLogBefore: beforeCount,
      dispatchLogAfter: afterCount,
      noProductionWrite: true,
      scenarios: report,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(report, null, 2));
