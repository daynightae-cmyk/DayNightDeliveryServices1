import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const deployedPreview = String(process.env.DEPLOYED_PREVIEW_URL || '').replace(/\/$/, '');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const adminEmail = process.env.RUNTIME_ADMIN_EMAIL;
const adminPassword = process.env.RUNTIME_ADMIN_PASSWORD;

const ilytkId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const g3bxgId = 'b0da2d6d-2fc9-43b3-9e38-260ff2dbd68e';
const expectedMerchant = /استبي ما عرفنالك|DN-MER-SHOP-ILYTK|ILYTK/i;
const reviewedCoupons = ['003860', '010503', '010505'];
const excludedCoupon = '010504';
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;

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

function createPersistentSessionClient(storage) {
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

function verifySerializedSession(memoryStorage, session, label) {
  const serializedSession = memoryStorage.values.get(storageKey);
  assert(typeof serializedSession === 'string' && serializedSession.length > 100, `${label}_serialized_session_missing`);
  assert(serializedSession.includes(session.access_token), `${label}_serialized_session_access_token_missing`);
  return serializedSession;
}

async function bodyText(page) {
  return page.locator('body').innerText();
}

async function clickFirstVisible(locator, description) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
  }
  throw new Error(`Missing visible control: ${description}`);
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
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth_user_lookup_failed_${error.message}`);
    const users = data?.users || [];
    const linkedUser = users.find((user) => linkedIds.has(String(user.id)) && user.email);
    if (linkedUser) return linkedUser;
    if (users.length < perPage) break;
    page += 1;
  }

  throw new Error('ilytk_linked_auth_user_not_found');
}

async function createAdminSession() {
  const memoryStorage = createMemoryStorage();
  const sessionClient = createPersistentSessionClient(memoryStorage.adapter);
  const { data, error } = await sessionClient.auth.signInWithPassword({
    email: String(adminEmail || '').trim().toLowerCase(),
    password: String(adminPassword || '').trim(),
  });
  if (error) throw new Error(`admin_session_login_failed_${error.message}`);

  const session = data?.session;
  const userId = data?.user?.id;
  assert(session?.access_token && session?.refresh_token && userId, 'admin_session_missing');

  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (profileError) throw new Error(`admin_profile_check_failed_${profileError.message}`);
  assert(String(profile?.role || '').toLowerCase() === 'admin', `admin_profile_role_${profile?.role || 'null'}`);

  return {
    serializedSession: verifySerializedSession(memoryStorage, session, 'admin'),
    sessionClient,
  };
}

async function createTemporaryIlytkSession() {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const linkedUser = await resolveLinkedIlytkUser(adminClient);
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: linkedUser.email,
  });
  if (linkError) throw new Error(`ilytk_magic_link_failed_${linkError.message}`);

  const tokenHash = linkData?.properties?.hashed_token;
  const verificationType = linkData?.properties?.verification_type || 'magiclink';
  assert(tokenHash, 'ilytk_magic_link_hash_missing');
  assert(verificationType === 'magiclink', `ilytk_unexpected_verification_type_${verificationType}`);

  const memoryStorage = createMemoryStorage();
  const sessionClient = createPersistentSessionClient(memoryStorage.adapter);
  const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError) throw new Error(`ilytk_magic_link_verification_failed_${verifyError.message}`);

  const session = verified?.session;
  assert(session?.access_token && session?.refresh_token, 'ilytk_temporary_session_missing');
  assert(String(session.user?.id || '') === String(linkedUser.id), 'ilytk_temporary_session_user_mismatch');

  const { data: resolvedMerchantId, error: merchantSessionError } = await sessionClient.rpc('merchant_session_id');
  if (merchantSessionError) throw new Error(`ilytk_session_rpc_failed_${merchantSessionError.message}`);
  assert(String(resolvedMerchantId || '') === ilytkId, `ilytk_session_rpc_resolved_${resolvedMerchantId || 'null'}`);

  return {
    serializedSession: verifySerializedSession(memoryStorage, session, 'ilytk'),
    sessionClient,
  };
}

async function createAuthenticatedContext(browser, contextOptions, serializedSession) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: serializedSession },
  );
  return context;
}

async function openAllOrders(page) {
  const shell = page.locator('.dncc-shell');
  await shell.waitFor({ state: 'visible', timeout: 90000 });

  const section = page.locator('[data-dn-command-section="all_orders"]');
  await section.first().waitFor({ state: 'attached', timeout: 90000 });
  const sectionCount = await section.count();
  for (let index = 0; index < sectionCount; index += 1) {
    const item = section.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }
  }

  const mobileMenu = page.locator('.dncc-mobile-menu');
  await mobileMenu.waitFor({ state: 'visible', timeout: 30000 });
  await mobileMenu.click();
  await page.locator('.dncc-mobile-layer').waitFor({ state: 'visible', timeout: 30000 });
  await clickFirstVisible(section, 'All Orders command section in mobile drawer');
}

async function openAdminFromInjectedSession(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=admin`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForURL((url) => url.pathname === '/admin', { timeout: 90000 });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
  assert(/لوحة التحكم|Dashboard/.test(await bodyText(page)), 'Admin portal did not render from the verified admin session.');
}

async function selectorText(page) {
  await page.waitForTimeout(700);
  return page.locator('.dn-admin-bulk-selector-list').innerText();
}

async function testAdmin(page, label) {
  try {
    await openAdminFromInjectedSession(page);
    await openAllOrders(page);
    const search = page.locator('[data-admin-order-search="true"]');
    const merchantSelect = page
      .locator('.dn-admin-bulk-filter-grid select')
      .filter({ has: page.locator(`option[value="${ilytkId}"]`) })
      .first();
    await search.waitFor({ state: 'visible', timeout: 90000 });
    await merchantSelect.waitFor({ state: 'visible', timeout: 90000 });

    await merchantSelect.selectOption(ilytkId);
    await search.fill('003860');
    let text = await selectorText(page);
    assert(text.includes('003860'), `${label}: ILYTK admin scope did not return coupon 003860.`);

    await merchantSelect.selectOption(g3bxgId);
    text = await selectorText(page);
    assert(!text.includes('003860'), `${label}: coupon 003860 leaked into G3BXG admin scope.`);

    await search.fill(excludedCoupon);
    text = await selectorText(page);
    assert(text.includes(excludedCoupon), `${label}: G3BXG admin scope did not return coupon 010504.`);

    await merchantSelect.selectOption(ilytkId);
    text = await selectorText(page);
    assert(!text.includes(excludedCoupon), `${label}: coupon 010504 leaked into ILYTK admin scope.`);

    await search.fill('003860');
    text = await selectorText(page);
    assert(text.includes('003860'), `${label}: ILYTK admin scope lost coupon 003860 after owner switching.`);
    await page.screenshot({ path: `preview-browser-evidence/${label}-admin-orders.png`, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: `preview-browser-evidence/${label}-admin-failure.png`, fullPage: true }).catch(() => {});
    await fs.promises.writeFile(
      `preview-browser-evidence/${label}-admin-failure.txt`,
      await bodyText(page).catch(() => 'body unavailable'),
    ).catch(() => {});
    throw error;
  }
}

async function openMerchantFromInjectedSession(page) {
  await page.goto(`${base}/merchant?nosplash=1&lang=ar&__dn_acceptance=merchant`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('[data-merchant-authenticated="true"]').waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {});
  const text = await bodyText(page);
  assert(expectedMerchant.test(text), 'Authenticated merchant session is not canonical ILYTK.');
  assert(!/الحساب بانتظار الربط|Account awaiting link/i.test(text), 'ILYTK linked session was shown as awaiting link.');
}

async function merchantSearch(page, query) {
  await clickFirstVisible(page.getByRole('button', { name: /البحث|Search/ }), 'Merchant global search');
  const dialog = page.getByRole('dialog', { name: /البحث الشامل|Global search/ });
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await dialog.locator('input').first().fill(query);
  await page.waitForTimeout(900);
  const text = await dialog.innerText();
  const resultCount = await dialog.locator('.dn-merchant-command-results button').count();
  await page.keyboard.press('Escape');
  return { text, resultCount };
}

async function testMerchant(page, label) {
  try {
    await openMerchantFromInjectedSession(page);
    for (const coupon of reviewedCoupons) {
      const result = await merchantSearch(page, coupon);
      assert(result.resultCount > 0, `${label}: ILYTK search returned no result for ${coupon}.`);
      assert(!/لا توجد نتائج مطابقة|No matching results/.test(result.text), `${label}: ILYTK search reported empty for ${coupon}.`);
    }
    const excluded = await merchantSearch(page, excludedCoupon);
    assert(excluded.resultCount === 0, `${label}: excluded coupon 010504 appeared in ILYTK portal search.`);
    assert(
      /لا توجد نتائج مطابقة|No matching results/.test(excluded.text),
      `${label}: excluded coupon 010504 did not produce explicit empty state.`,
    );
    await page.screenshot({ path: `preview-browser-evidence/${label}-merchant.png`, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: `preview-browser-evidence/${label}-merchant-failure.png`, fullPage: true }).catch(() => {});
    await fs.promises.writeFile(
      `preview-browser-evidence/${label}-merchant-failure.txt`,
      await bodyText(page).catch(() => 'body unavailable'),
    ).catch(() => {});
    throw error;
  }
}

const adminAuth = await createAdminSession();
const merchantAuth = await createTemporaryIlytkSession();
const browser = await chromium.launch({ headless: true });
const scenarios = [
  { label: 'desktop', context: { viewport: { width: 1440, height: 1000 }, locale: 'ar-AE' } },
  { label: 'phone', context: { ...devices['Pixel 7'], locale: 'ar-AE' } },
];
const report = [];
let cleanupError = null;

try {
  for (const scenario of scenarios) {
    const adminContext = await createAuthenticatedContext(browser, scenario.context, adminAuth.serializedSession);
    await testAdmin(await adminContext.newPage(), scenario.label);
    await adminContext.close();

    const merchantContext = await createAuthenticatedContext(browser, scenario.context, merchantAuth.serializedSession);
    await testMerchant(await merchantContext.newPage(), scenario.label);
    await merchantContext.close();
    report.push({
      scenario: scenario.label,
      admin: 'PASS',
      merchant: 'PASS',
      search: 'PASS',
      crossOwner: 'PASS',
    });
  }
} finally {
  await browser.close();
  for (const [label, client] of [
    ['admin', adminAuth.sessionClient],
    ['ilytk', merchantAuth.sessionClient],
  ]) {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error && !cleanupError) cleanupError = new Error(`${label}_temporary_session_cleanup_failed_${error.message}`);
  }
}

if (cleanupError) throw cleanupError;

fs.writeFileSync(
  'preview-browser-evidence/report.json',
  JSON.stringify(
    {
      branchHead: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA,
      deployedPreview,
      testedExactSourceBundle: true,
      adminIdentity: {
        roleVerifiedBeforeBrowser: true,
        authStorageSerializedByInstalledSupabaseClient: true,
        temporarySessionRevokedLocally: true,
      },
      merchantIdentity: {
        merchantId: ilytkId,
        portalLinkResolvedByUuid: true,
        authStorageSerializedByInstalledSupabaseClient: true,
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
