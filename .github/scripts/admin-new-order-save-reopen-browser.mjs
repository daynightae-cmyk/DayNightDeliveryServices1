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
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const expectedCommit = String(process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || '').trim();
const merchantId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;
const testCoupon = `98${Date.now().toString().slice(-8)}`;
const staleAcceptanceCoupons = ['9801593698'];
const evidenceDirectory = 'preview-browser-evidence';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
}

function createSessionClient(storage) {
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

async function clickFirstVisible(locator, description) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`missing_visible_control_${description}`);
}

async function createAdminSession() {
  const memory = createMemoryStorage();
  const client = createSessionClient(memory.adapter);
  const { data, error } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (error) throw new Error(`save_reopen_admin_login_failed: ${error.message}`);
  assert(data?.session?.access_token && data?.session?.refresh_token, 'save_reopen_admin_session_missing');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw new Error(`save_reopen_profile_failed: ${profileError.message}`);
  assert(
    ['admin', 'support', 'owner', 'super_admin'].includes(String(profile?.role || '').toLowerCase()),
    'save_reopen_user_not_admin',
  );

  const serialized = memory.values.get(storageKey);
  assert(
    typeof serialized === 'string' && serialized.includes(data.session.access_token),
    'save_reopen_serialized_session_missing',
  );
  return { client, serialized, role: profile.role };
}

async function openAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=financial_save_reopen`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
}

async function openSection(page, key, description) {
  const controls = page.locator(`[data-dn-command-section="${key}"]`);
  await controls.first().waitFor({ state: 'attached', timeout: 90000 });
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    if (await control.isVisible().catch(() => false)) {
      await control.click();
      return;
    }
  }

  const mobileMenu = page.locator('.dncc-mobile-menu');
  if (await mobileMenu.isVisible().catch(() => false)) {
    await mobileMenu.click();
    await page.locator('.dncc-mobile-layer').waitFor({ state: 'visible', timeout: 30000 });
    await clickFirstVisible(controls, description);
    return;
  }
  throw new Error(`missing_admin_section_${key}`);
}

async function typeValue(input, value, label) {
  await input.waitFor({ state: 'visible', timeout: 30000 });
  await input.focus();
  await input.press('Control+A');
  await input.pressSequentially(String(value), { delay: 55 });
  assert((await input.inputValue()) === String(value), `${label}_dom_value_mismatch`);
}

async function waitForSavedOrder(client) {
  let latestError = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const { data, error } = await client
      .from('orders')
      .select(
        'id,tracking_number,invoice_number,coupon_number,merchant_id,goods_value,delivery_fee,delivery_price,manual_delivery_price,price_source,discount_amount,delivery_fee_mode,payment_method,customer_total,merchant_due,company_revenue,status,created_at',
      )
      .eq('coupon_number', testCoupon)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.id) return data;
    latestError = error;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`saved_order_readback_timeout: ${latestError?.message || 'no row'}`);
}

async function collectExactTestRows(client, { orderId = '', coupons = [] } = {}) {
  const rows = new Map();
  if (orderId) {
    const { data, error } = await client
      .from('orders')
      .select('id,coupon_number')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new Error(`cleanup_order_lookup_failed: ${error.message}`);
    if (data?.id) rows.set(data.id, data);
  }

  const exactCoupons = [...new Set(coupons.map((value) => String(value || '').trim()).filter(Boolean))];
  if (exactCoupons.length) {
    const { data, error } = await client
      .from('orders')
      .select('id,coupon_number')
      .in('coupon_number', exactCoupons);
    if (error) throw new Error(`cleanup_coupon_lookup_failed: ${error.message}`);
    for (const row of data || []) {
      if (row?.id && exactCoupons.includes(String(row.coupon_number || '').trim())) rows.set(row.id, row);
    }
  }
  return [...rows.values()];
}

async function cleanupExactTestOrders(client, criteria = {}) {
  const rows = await collectExactTestRows(client, criteria);
  for (const row of rows) {
    for (const table of ['admin_order_reconciliation_queue', 'admin_order_mutation_audit_v3']) {
      const { error } = await client.from(table).delete().eq('order_id', row.id);
      if (error && !/does not exist|schema cache|not found/i.test(String(error.message || ''))) {
        throw new Error(`cleanup_${table}_failed: ${error.message}`);
      }
    }

    const { error: deleteError } = await client.from('orders').delete().eq('id', row.id);
    if (deleteError) throw new Error(`cleanup_order_failed: ${deleteError.message}`);
  }

  const remaining = await collectExactTestRows(client, criteria);
  assert(remaining.length === 0, `cleanup_test_orders_still_exist:${remaining.map((row) => row.id).join(',')}`);
  return {
    matched: rows.length,
    deleted: rows.length,
    deletedIds: rows.map((row) => row.id),
    verified: true,
  };
}

fs.mkdirSync(evidenceDirectory, { recursive: true });
const adminAuth = await createAdminSession();
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const preflightCleanup = await cleanupExactTestOrders(serviceClient, {
  coupons: staleAcceptanceCoupons,
});
fs.writeFileSync(
  `${evidenceDirectory}/financial-save-reopen-preflight-cleanup.json`,
  JSON.stringify({ coupons: staleAcceptanceCoupons, ...preflightCleanup }, null, 2),
);

const browser = await chromium.launch({ headless: true });
let createdOrder = null;
let cleanup = { matched: 0, deleted: 0, deletedIds: [], verified: false };
let primaryError = null;

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'ar-AE',
  });
  await context.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: adminAuth.serialized },
  );
  const page = await context.newPage();

  try {
    await openAdmin(page);
    await openSection(page, 'new_order', 'new_order');

    const form = page.locator('[data-admin-new-order-form="merchant"]');
    await form.waitFor({ state: 'visible', timeout: 90000 });
    const preview = form.locator('[data-admin-financial-preview-version="verified-v1"]');
    await preview.waitFor({ state: 'visible', timeout: 30000 });

    const merchantSelect = form.locator('[data-admin-order-owner-select="true"]').first();
    await merchantSelect
      .locator(`option[value="${merchantId}"]`)
      .waitFor({ state: 'attached', timeout: 90000 });
    await merchantSelect.selectOption(merchantId);

    await form.locator('[data-admin-next-order-focus="true"]').fill(testCoupon);
    const textInputs = form.locator('input:not([type="number"])');
    await textInputs.nth(1).fill('DAY NIGHT FINANCIAL TEST');
    await textInputs.nth(2).fill('0500000000');

    const goods = form.locator('[data-admin-financial-field="goods_value"]');
    await typeValue(goods, '50', 'goods_value');
    await clickFirstVisible(
      form.getByRole('button', { name: /^يدوي$|^Manual$/ }),
      'manual_price',
    );
    const manualDelivery = form.locator('[data-admin-financial-field="manual_delivery_price"]');
    await typeValue(manualDelivery, '60', 'manual_delivery_price');
    await clickFirstVisible(
      form.getByRole('button', {
        name: /رسوم التوصيل على حساب التاجر|Charge delivery to merchant/,
      }),
      'merchant_pays',
    );

    await page.waitForFunction(
      ({ selector, selectedMerchant }) => {
        const node = document.querySelector(selector);
        return (
          node instanceof HTMLElement &&
          node.dataset.selectedMerchantId === selectedMerchant &&
          node.dataset.deliveryFeeMode === 'deduct_from_merchant' &&
          node.dataset.paymentMethod === 'merchant_pays' &&
          Number(node.dataset.goodsValue) === 50 &&
          Number(node.dataset.deliveryFee) === 60 &&
          Number(node.dataset.customerTotal) === 50 &&
          Number(node.dataset.merchantDue) === -10 &&
          Number(node.dataset.companyRevenue) === 60
        );
      },
      {
        selector: '[data-admin-financial-preview-version="verified-v1"]',
        selectedMerchant: merchantId,
      },
      { timeout: 15000 },
    );

    await page.screenshot({
      path: `${evidenceDirectory}/financial-save-reopen-before-save.png`,
      fullPage: true,
    });

    await form
      .getByRole('button', { name: /حفظ وبدء طلب جديد|Save and start next order/ })
      .click();

    createdOrder = await waitForSavedOrder(serviceClient);
    assert(createdOrder.merchant_id === merchantId, 'database_merchant_id_mismatch');
    assert(numeric(createdOrder.goods_value) === 50, 'database_goods_value_mismatch');
    assert(
      numeric(createdOrder.delivery_fee ?? createdOrder.delivery_price) === 60,
      'database_delivery_fee_mismatch',
    );
    assert(numeric(createdOrder.manual_delivery_price) === 60, 'database_manual_delivery_price_mismatch');
    assert(String(createdOrder.price_source) === 'manual', 'database_price_source_mismatch');
    assert(numeric(createdOrder.discount_amount) === 0, 'database_discount_amount_mismatch');
    assert(
      String(createdOrder.delivery_fee_mode) === 'deduct_from_merchant',
      'database_delivery_fee_mode_mismatch',
    );
    assert(
      ['sender_pays', 'merchant_pays'].includes(String(createdOrder.payment_method)),
      'database_payment_method_mismatch',
    );
    assert(numeric(createdOrder.customer_total) === 50, 'database_customer_total_mismatch');
    assert(numeric(createdOrder.merchant_due) === -10, 'database_merchant_due_mismatch');
    assert(numeric(createdOrder.company_revenue) === 60, 'database_company_revenue_mismatch');

    await openSection(page, 'all_orders', 'all_orders');
    const search = page.locator('[data-admin-order-search="true"]');
    await search.waitFor({ state: 'visible', timeout: 90000 });
    await search.fill(testCoupon);

    const selectorList = page.locator('.dn-admin-bulk-selector-list');
    await selectorList.waitFor({ state: 'visible', timeout: 90000 });
    await selectorList
      .getByText(testCoupon, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 90000 });

    const savedRow = page.locator('table tbody tr').filter({ hasText: testCoupon }).first();
    await savedRow.waitFor({ state: 'visible', timeout: 90000 });
    await savedRow.scrollIntoViewIfNeeded();
    await savedRow.getByRole('button', { name: /تعديل|Edit/ }).click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 30000 });
    assert(
      (await dialog.locator('[data-admin-complete-order-coupon="true"]').inputValue()) ===
        testCoupon,
      'reopen_coupon_mismatch',
    );
    assert(
      (await dialog.locator('[data-admin-complete-order-merchant="true"]').inputValue()) ===
        merchantId,
      'reopen_merchant_mismatch',
    );

    const accountingSection = dialog
      .locator('section')
      .filter({ hasText: /الحسابات والتحصيل|Accounting and collection/ })
      .first();
    await accountingSection.waitFor({ state: 'visible', timeout: 30000 });
    const financialInputs = accountingSection.locator('input[type="number"]');
    assert((await financialInputs.nth(0).inputValue()) === '50', 'reopen_goods_value_mismatch');
    assert(numeric(await financialInputs.nth(1).inputValue()) === 0, 'reopen_discount_amount_mismatch');
    assert(
      (await financialInputs.nth(2).inputValue()) === '60',
      'reopen_manual_delivery_price_mismatch',
    );
    assert(
      (await accountingSection.locator('select').last().inputValue()) === 'merchant_pays',
      'reopen_payment_method_mismatch',
    );
    const merchantDebitButton = accountingSection.getByRole('button', {
      name: /التوصيل يُخصم من التاجر|Deduct from merchant/,
    });
    assert(
      (await merchantDebitButton.getAttribute('class') || '').includes('bg-brand-gold'),
      'reopen_delivery_fee_mode_mismatch',
    );

    await dialog.screenshot({
      path: `${evidenceDirectory}/financial-save-reopen-dialog.png`,
    });

    const report = {
      result: 'PASS',
      commit: expectedCommit,
      browser: await page.evaluate(() => navigator.userAgent),
      marker: await preview.getAttribute('data-admin-financial-preview-version'),
      testCoupon,
      orderId: createdOrder.id,
      trackingNumber: createdOrder.tracking_number,
      adminRole: adminAuth.role,
      save: 'PASS',
      databaseReadback: 'PASS',
      reopen: 'PASS',
      persisted: {
        merchant_id: createdOrder.merchant_id,
        goods_value: numeric(createdOrder.goods_value),
        delivery_fee: numeric(createdOrder.delivery_fee ?? createdOrder.delivery_price),
        manual_delivery_price: numeric(createdOrder.manual_delivery_price),
        price_source: createdOrder.price_source,
        discount_amount: numeric(createdOrder.discount_amount),
        delivery_fee_mode: createdOrder.delivery_fee_mode,
        payment_method: createdOrder.payment_method,
        customer_total: numeric(createdOrder.customer_total),
        merchant_due: numeric(createdOrder.merchant_due),
        company_revenue: numeric(createdOrder.company_revenue),
      },
    };
    fs.writeFileSync(
      `${evidenceDirectory}/financial-save-reopen-report.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    primaryError = error;
    await page
      .screenshot({
        path: `${evidenceDirectory}/financial-save-reopen-failure.png`,
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    await context.close();
  }
} finally {
  try {
    cleanup = await cleanupExactTestOrders(serviceClient, {
      orderId: createdOrder?.id || '',
      coupons: [testCoupon],
    });
    fs.writeFileSync(
      `${evidenceDirectory}/financial-save-reopen-cleanup.json`,
      JSON.stringify(
        { testCoupon, orderId: createdOrder?.id || null, ...cleanup },
        null,
        2,
      ),
    );
  } catch (cleanupError) {
    fs.writeFileSync(
      `${evidenceDirectory}/financial-save-reopen-cleanup-failure.txt`,
      String(cleanupError?.stack || cleanupError),
    );
    if (!primaryError) primaryError = cleanupError;
  }

  await adminAuth.client.auth.signOut({ scope: 'local' }).catch(() => {});
  await browser.close();
}

if (primaryError) throw primaryError;
assert(cleanup.verified, 'test_order_cleanup_not_verified');
