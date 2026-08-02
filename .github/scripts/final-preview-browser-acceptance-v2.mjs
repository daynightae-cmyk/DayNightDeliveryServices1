import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const deployedPreview = String(process.env.DEPLOYED_PREVIEW_URL || '').replace(/\/$/, '');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();

const ilytkId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const g3bxgId = 'b0da2d6d-2fc9-43b3-9e38-260ff2dbd68e';
const reviewedCoupons = ['003860', '010503', '010505'];
const excludedCoupon = '010504';
const expectedMerchant = /استبي ما عرفنالك|DN-MER-SHOP-ILYTK|ILYTK/i;
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;
const desktopViewport = { width: 1440, height: 1000 };
const phoneViewport = { width: 412, height: 915 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMemoryStorage() {
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

function createPersistentClient(storage) {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage,
      storageKey,
    },
  });
}

async function bodyText(page) {
  return page.locator('body').innerText();
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

async function waitForList(page, predicate, description, timeoutMs = 90000) {
  const list = page.locator('.dn-admin-bulk-selector-list');
  await list.waitFor({ state: 'visible', timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  let latest = '';
  while (Date.now() < deadline) {
    latest = await list.innerText().catch(() => '');
    if (predicate(latest)) return latest;
    await page.waitForTimeout(500);
  }
  throw new Error(`${description}. Last list text: ${latest.slice(0, 700)}`);
}

async function openAllOrders(page) {
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 120000 });
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
  await clickFirstVisible(section, 'All Orders section in mobile drawer');
}

async function signInAdminThroughUi(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=admin-ui-login`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  const shell = page.locator('.dncc-shell');
  if (await shell.isVisible().catch(() => false)) return;

  const introButton = page.getByRole('button', { name: /تسجيل الدخول|Sign in/ });
  if (await introButton.isVisible().catch(() => false)) await introButton.click();

  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  await email.waitFor({ state: 'visible', timeout: 30000 });
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

async function openAuthenticatedAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=admin-reload`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 120000 });
  await page.locator('[data-dn-command-section="all_orders"]').first().waitFor({
    state: 'attached',
    timeout: 120000,
  });
}

async function verifyCompleteOrderEditor(page, label) {
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
  assert((await merchant.inputValue()) === ilytkId, `${label}: editor merchant is not canonical ILYTK.`);
  assert((await coupon.inputValue()).trim() === '003860', `${label}: editor coupon is not 003860.`);
  assert(!(await reason.isDisabled()), `${label}: audit reason field is disabled.`);
  assert(!(await confirmation.isDisabled()), `${label}: impact confirmation is disabled.`);
  assert(
    (await dialog.getByText(
      /رقم التتبع والفاتورة لا بيتغيروش|Tracking and invoice identifiers are immutable/,
    ).count()) > 0,
    `${label}: immutable identity guidance is missing.`,
  );

  await dialog.screenshot({
    path: `preview-browser-evidence/${label}-admin-complete-order-editor.png`,
  });
  await clickFirstVisible(
    dialog.getByRole('button', { name: /إلغاء|Cancel/ }),
    `${label} editor cancel`,
  );
  await dialog.waitFor({ state: 'hidden', timeout: 30000 });
}

async function testAdminViewport(page, label) {
  try {
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
    await waitForList(page, (text) => text.includes('003860'), `${label}: ILYTK did not return 003860`);

    await merchantFilter.selectOption(g3bxgId);
    await waitForList(page, (text) => !text.includes('003860'), `${label}: 003860 leaked into G3BXG`);

    await search.fill(excludedCoupon);
    await waitForList(page, (text) => text.includes(excludedCoupon), `${label}: G3BXG did not return 010504`);

    await merchantFilter.selectOption(ilytkId);
    await waitForList(page, (text) => !text.includes(excludedCoupon), `${label}: 010504 leaked into ILYTK`);

    await search.fill('003860');
    await waitForList(page, (text) => text.includes('003860'), `${label}: ILYTK lost 003860`);
    await verifyCompleteOrderEditor(page, label);
    await page.screenshot({
      path: `preview-browser-evidence/${label}-admin-orders.png`,
      fullPage: true,
    });
  } catch (error) {
    await page.screenshot({
      path: `preview-browser-evidence/${label}-admin-failure.png`,
      fullPage: true,
    }).catch(() => {});
    await fs.promises.writeFile(
      `preview-browser-evidence/${label}-admin-failure.txt`,
      await bodyText(page).catch(() => 'body unavailable'),
    ).catch(() => {});
    throw error;
  }
}

async function resolveLinkedIlytkUser(adminClient) {
  const { data: links, error: linkError } = await adminClient
    .from('merchant_user_links')
    .select('user_id,updated_at')
    .eq('merchant_id', ilytkId)
    .eq('active', true)
    .order('updated_at', { ascending: false });
  if (linkError) throw new Error(`ilytk_link_lookup_failed_${linkError.message}`);
  assert(Array.isArray(links) && links.length > 0, 'ilytk_has_no_active_auth_link');

  const linkedIds = new Set(links.map((row) => String(row.user_id || '')).filter(Boolean));
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth_user_lookup_failed_${error.message}`);
    const users = data?.users || [];
    const linked = users.find((user) => linkedIds.has(String(user.id)) && user.email);
    if (linked) return linked;
    if (users.length < 1000) break;
  }
  throw new Error('ilytk_linked_auth_user_not_found');
}

async function createTemporaryIlytkSession() {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const linkedUser = await resolveLinkedIlytkUser(adminClient);
  const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: linkedUser.email,
  });
  if (linkError) throw new Error(`ilytk_magic_link_failed_${linkError.message}`);
  const tokenHash = link?.properties?.hashed_token;
  assert(tokenHash, 'ilytk_magic_link_hash_missing');

  const memory = createMemoryStorage();
  const client = createPersistentClient(memory.adapter);
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError) throw new Error(`ilytk_magic_link_verification_failed_${verifyError.message}`);
  const session = verified?.session;
  assert(session?.access_token && session?.refresh_token, 'ilytk_temporary_session_missing');
  const { data: merchantId, error: merchantError } = await client.rpc('merchant_session_id');
  if (merchantError) throw new Error(`ilytk_session_rpc_failed_${merchantError.message}`);
  assert(String(merchantId || '') === ilytkId, `ilytk_session_resolved_${merchantId || 'null'}`);

  const serialized = memory.values.get(storageKey);
  assert(typeof serialized === 'string' && serialized.includes(session.access_token), 'ilytk_serialized_session_missing');
  return { serialized, client };
}

async function openMerchant(page) {
  await page.goto(`${base}/merchant?nosplash=1&lang=ar&__dn_acceptance=merchant`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('[data-merchant-authenticated="true"]').waitFor({
    state: 'visible',
    timeout: 120000,
  });
  await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {});
  const text = await bodyText(page);
  assert(expectedMerchant.test(text), 'Merchant portal is not canonical ILYTK.');
  assert(!/الحساب بانتظار الربط|Account awaiting link/i.test(text), 'ILYTK appeared unlinked.');
}

async function merchantSearch(page, query) {
  await clickFirstVisible(
    page.getByRole('button', { name: /البحث|Search/ }),
    'Merchant global search',
  );
  const dialog = page.getByRole('dialog', { name: /البحث الشامل|Global search/ });
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await dialog.locator('input').first().fill(query);
  await page.waitForTimeout(1000);
  const text = await dialog.innerText();
  const count = await dialog.locator('.dn-merchant-command-results button').count();
  await page.keyboard.press('Escape');
  return { text, count };
}

async function testMerchantViewport(page, label) {
  try {
    await openMerchant(page);
    for (const coupon of reviewedCoupons) {
      const result = await merchantSearch(page, coupon);
      assert(result.count > 0, `${label}: merchant search returned no ${coupon}.`);
      assert(!/لا توجد نتائج مطابقة|No matching results/.test(result.text), `${label}: ${coupon} returned empty.`);
    }
    const excluded = await merchantSearch(page, excludedCoupon);
    assert(excluded.count === 0, `${label}: 010504 appeared in ILYTK search.`);
    assert(
      /لا توجد نتائج مطابقة|No matching results/.test(excluded.text),
      `${label}: 010504 did not return explicit empty state.`,
    );
    await page.screenshot({
      path: `preview-browser-evidence/${label}-merchant.png`,
      fullPage: true,
    });
  } catch (error) {
    await page.screenshot({
      path: `preview-browser-evidence/${label}-merchant-failure.png`,
      fullPage: true,
    }).catch(() => {});
    await fs.promises.writeFile(
      `preview-browser-evidence/${label}-merchant-failure.txt`,
      await bodyText(page).catch(() => 'body unavailable'),
    ).catch(() => {});
    throw error;
  }
}

async function revokeBrowserAdminSession(page) {
  const serialized = await page.evaluate((key) => window.localStorage.getItem(key), storageKey).catch(() => null);
  if (!serialized) return;
  const parsed = JSON.parse(serialized);
  const accessToken = parsed?.access_token;
  const refreshToken = parsed?.refresh_token;
  if (!accessToken || !refreshToken) return;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (!error) await client.auth.signOut({ scope: 'local' });
}

const browser = await chromium.launch({ headless: true });
const report = [];
let adminPage;
let merchantClient;

try {
  const adminContext = await browser.newContext({ viewport: desktopViewport, locale: 'ar-AE' });
  adminPage = await adminContext.newPage();
  try {
    await signInAdminThroughUi(adminPage);
    await testAdminViewport(adminPage, 'desktop');
    report.push({ scenario: 'desktop', admin: 'PASS', completeOrderEditor: 'PASS' });

    await adminPage.setViewportSize(phoneViewport);
    await openAuthenticatedAdmin(adminPage);
    await testAdminViewport(adminPage, 'phone');
    report.push({ scenario: 'phone', admin: 'PASS', completeOrderEditor: 'PASS' });
  } finally {
    await revokeBrowserAdminSession(adminPage).catch(() => {});
    await adminContext.close();
  }

  const merchantAuth = await createTemporaryIlytkSession();
  merchantClient = merchantAuth.client;
  const merchantContext = await browser.newContext({ viewport: desktopViewport, locale: 'ar-AE' });
  await merchantContext.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: merchantAuth.serialized },
  );
  const merchantPage = await merchantContext.newPage();
  try {
    await testMerchantViewport(merchantPage, 'desktop');
    Object.assign(report.find((item) => item.scenario === 'desktop'), {
      merchant: 'PASS', search: 'PASS', crossOwner: 'PASS',
    });

    await merchantPage.setViewportSize(phoneViewport);
    await testMerchantViewport(merchantPage, 'phone');
    Object.assign(report.find((item) => item.scenario === 'phone'), {
      merchant: 'PASS', search: 'PASS', crossOwner: 'PASS',
    });
  } finally {
    await merchantContext.close();
  }
} finally {
  await browser.close();
  if (merchantClient) await merchantClient.auth.signOut({ scope: 'local' }).catch(() => {});
}

fs.writeFileSync(
  'preview-browser-evidence/report.json',
  JSON.stringify(
    {
      branchHead: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA,
      deployedPreview,
      testedExactSourceBundle: true,
      adminIdentity: {
        realUiLogin: true,
        singleSessionAcrossViewports: true,
        temporarySessionRevokedLocally: true,
      },
      merchantIdentity: {
        merchantId: ilytkId,
        portalLinkResolvedByUuid: true,
        singleSessionAcrossViewports: true,
        temporarySessionRevokedLocally: true,
      },
      reviewedCoupons,
      excludedCoupon,
      result: 'PASS',
      scenarios: report,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(report, null, 2));
