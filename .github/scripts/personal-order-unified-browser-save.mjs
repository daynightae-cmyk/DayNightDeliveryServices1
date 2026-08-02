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
const runId = String(process.env.GITHUB_RUN_ID || Date.now());
const coupon = `PERS-E2E-${runId}`;
const senderName = `E2E Personal Sender ${runId}`;
const receiverName = `E2E Personal Receiver ${runId}`;
const senderPhone = '971500000111';
const receiverPhone = '971500000222';
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;
const evidenceDir = path.resolve('personal-order-browser-evidence');

fs.mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMemoryStorage() {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, value); },
      removeItem(key) { values.delete(key); },
    },
  };
}

function isOptionalSchemaError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code)
    || /does not exist|schema cache|column .* not found/i.test(message);
}

async function clickFirstVisible(locator, label) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`missing_visible_${label}`);
}

async function createAdminSession() {
  const memory = createMemoryStorage();
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
  if (error) throw new Error(`admin_login_failed_${error.message}`);
  assert(data?.session?.access_token && data?.session?.refresh_token && data?.user?.id, 'admin_session_missing');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (profileError) throw new Error(`admin_profile_failed_${profileError.message}`);
  assert(String(profile?.role || '').toLowerCase() === 'admin', `admin_role_${profile?.role || 'null'}`);

  const serialized = memory.values.get(storageKey);
  assert(typeof serialized === 'string' && serialized.includes(data.session.access_token), 'serialized_admin_session_missing');
  return { client, serialized };
}

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

async function findTestOrders() {
  const { data, error } = await service
    .from('orders')
    .select('*')
    .eq('coupon_number', coupon)
    .eq('source_channel', 'admin_personal_order');
  if (error) throw new Error(`test_order_lookup_failed_${error.message}`);
  return Array.isArray(data) ? data : [];
}

async function deleteFromOptionalTable(table, orderId) {
  const { error } = await service.from(table).delete().eq('order_id', orderId);
  if (error && !isOptionalSchemaError(error)) {
    throw new Error(`cleanup_${table}_failed_${error.code || 'unknown'}_${error.message}`);
  }
}

async function cleanupTestOrder() {
  const rows = await findTestOrders();
  for (const row of rows) {
    const orderId = String(row.id || '');
    if (!orderId) continue;
    const dependentTables = [
      'merchant_statement_dispatch_log',
      'order_status_history',
      'order_status_events',
      'order_events',
      'cod_collections',
      'merchant_statement_entries',
      'driver_statement_entries',
      'order_financial_settlements',
      'financial_account_entries',
      'merchant_invoices',
      'invoices',
      'notifications',
      'delivery_assignments',
      'order_driver_assignments',
      'driver_missions',
      'shipment_events',
      'order_tracking_events',
      'order_notes',
    ];
    for (const table of dependentTables) await deleteFromOptionalTable(table, orderId);

    const deletion = await service
      .from('orders')
      .delete()
      .eq('id', orderId)
      .eq('coupon_number', coupon)
      .eq('source_channel', 'admin_personal_order')
      .select('id');
    if (deletion.error) throw new Error(`cleanup_order_failed_${deletion.error.code || 'unknown'}_${deletion.error.message}`);
    assert(Array.isArray(deletion.data) && deletion.data.length === 1, `cleanup_order_count_${deletion.data?.length || 0}`);
  }
  const remaining = await findTestOrders();
  assert(remaining.length === 0, `cleanup_remaining_orders_${remaining.length}`);
}

async function waitForSavedOrder() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await findTestOrders();
    if (rows.length === 1) return rows[0];
    if (rows.length > 1) throw new Error(`duplicate_test_orders_${rows.length}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('saved_personal_order_not_found');
}

let browser;
let adminClient;
let page;
try {
  assert(base && supabaseUrl && anonKey && serviceRoleKey && adminEmail && adminPassword, 'personal_order_acceptance_configuration_missing');
  await cleanupTestOrder();
  const admin = await createAdminSession();
  adminClient = admin.client;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: storageKey,
    value: admin.serialized,
  });
  page = await context.newPage();

  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=unified_personal_order`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
  assert(await page.locator('[data-dn-command-section="personal_orders"]').count() === 0, 'standalone_personal_orders_menu_still_present');

  await clickFirstVisible(page.locator('[data-dn-command-section="new_order"]'), 'new_order_section');
  const ownerSelect = page.locator('[data-admin-order-owner-select="true"]').first();
  await ownerSelect.waitFor({ state: 'visible', timeout: 90000 });
  const optionText = await ownerSelect.locator('option[value="__personal_order__"]').textContent();
  assert(/غرض شخصي|Personal purpose/.test(String(optionText || '')), 'personal_purpose_option_missing');
  await ownerSelect.selectOption('__personal_order__');

  const personalForm = page.locator('[data-admin-personal-order-form="true"]');
  await personalForm.waitFor({ state: 'visible', timeout: 30000 });
  assert(await page.locator('[data-admin-unified-personal-order-entry="true"]').count() === 1, 'personal_form_not_inside_new_order_route');

  await page.locator('[data-admin-personal-coupon="true"]').fill(coupon);
  await page.locator('[data-admin-personal-sender-name="true"]').fill(senderName);
  await page.locator('[data-admin-personal-sender-phone="true"]').fill(senderPhone);
  await page.locator('[data-admin-personal-pickup-address="true"]').fill('E2E pickup address, Mussafah');
  await page.locator('[data-admin-personal-receiver-name="true"]').fill(receiverName);
  await page.locator('[data-admin-personal-receiver-phone="true"]').fill(receiverPhone);
  await page.locator('[data-admin-personal-delivery-address="true"]').fill('E2E delivery address, Al Shahama');
  await page.locator('[data-admin-personal-goods-value="true"]').fill('125');

  await page.screenshot({ path: path.join(evidenceDir, 'personal-order-form-before-save.png'), fullPage: true });
  await page.locator('[data-admin-personal-order-save="true"]').click();
  const saved = await waitForSavedOrder();
  const successMessageVisible = await page
    .getByText(/تم إنشاء الطلب الشخصي|Personal order .* was created/)
    .isVisible()
    .catch(() => false);
  await page.screenshot({ path: path.join(evidenceDir, 'personal-order-after-save.png'), fullPage: true });
  assert(String(saved.merchant_id || '') === '', `personal_order_merchant_id_${saved.merchant_id}`);
  assert(String(saved.merchant_name || '') === '', `personal_order_merchant_name_${saved.merchant_name}`);
  assert(String(saved.merchant_code || '') === '', `personal_order_merchant_code_${saved.merchant_code}`);
  assert(String(saved.source_channel || '') === 'admin_personal_order', `personal_order_source_${saved.source_channel}`);
  assert(Number(saved.delivery_fee) === 25, `personal_order_delivery_fee_${saved.delivery_fee}`);
  assert(Number(saved.merchant_due) === 0, `personal_order_merchant_due_${saved.merchant_due}`);
  assert(Number(saved.company_revenue) === 25, `personal_order_company_revenue_${saved.company_revenue}`);
  assert(Number(saved.goods_value) === 125, `personal_order_goods_${saved.goods_value}`);
  assert(Number(saved.customer_total) === 150, `personal_order_customer_total_${saved.customer_total}`);
  assert(String(saved.sender_name || '') === senderName, 'personal_order_sender_mismatch');
  assert(String(saved.receiver_name || '') === receiverName, 'personal_order_receiver_mismatch');
  assert(String(saved.status || '').toLowerCase() === 'pending', `personal_order_status_${saved.status}`);

  await clickFirstVisible(page.locator('[data-dn-command-section="all_orders"]'), 'all_orders_section');
  const search = page.locator('[data-admin-order-search="true"]').first();
  await search.waitFor({ state: 'visible', timeout: 90000 });
  await search.fill(coupon);
  const list = page.locator('.dn-admin-bulk-selector-list');
  await list.waitFor({ state: 'visible', timeout: 90000 });
  const orderRow = page.locator('tr').filter({ hasText: coupon }).first();
  await orderRow.waitFor({ state: 'visible', timeout: 90000 });
  const rowText = await orderRow.innerText();
  assert(rowText.includes(coupon), 'saved_personal_order_not_visible_in_all_orders');
  assert(rowText.includes(senderName), 'saved_personal_order_sender_not_visible_in_all_orders');
  assert(/مستحق التاجر\s*0\.00|Merchant due\s*0\.00/i.test(rowText), 'personal_order_ui_merchant_due_is_not_zero');
  assert(!/مستحق التاجر\s*125\.00|Merchant due\s*125\.00/i.test(rowText), 'personal_order_goods_leaked_into_merchant_due');
  await page.screenshot({ path: path.join(evidenceDir, 'personal-order-visible-in-all-orders.png'), fullPage: true });

  fs.writeFileSync(
    path.join(evidenceDir, 'result.json'),
    JSON.stringify({
      result: 'PASS',
      coupon,
      order_id: saved.id,
      tracking_number: saved.tracking_number,
      source_channel: saved.source_channel,
      merchant_id: saved.merchant_id,
      delivery_fee: Number(saved.delivery_fee),
      merchant_due: Number(saved.merchant_due),
      company_revenue: Number(saved.company_revenue),
      customer_total: Number(saved.customer_total),
      visible_in_all_orders: true,
      success_message_visible: successMessageVisible,
      standalone_personal_menu_removed: true,
    }, null, 2),
  );
  console.log(JSON.stringify({ result: 'PASS', coupon, order_id: saved.id, visible_in_all_orders: true }, null, 2));
  await context.close();
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(evidenceDir, 'personal-order-failure.png'), fullPage: true }).catch(() => {});
    const body = await page.locator('body').innerText().catch(() => 'body unavailable');
    fs.writeFileSync(path.join(evidenceDir, 'failure-body.txt'), body);
  }
  fs.writeFileSync(path.join(evidenceDir, 'failure.txt'), String(error?.stack || error));
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  await cleanupTestOrder();
  if (adminClient) await adminClient.auth.signOut({ scope: 'local' }).catch(() => {});
}
