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
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;
const preferredMerchantId = '325bb302-75c3-48cc-84ba-e58817d6d148';
const outputDirectory = 'preview-browser-evidence';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function memoryStorage() {
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

async function createAdminStorage() {
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
  if (error) throw error;
  assert(data?.session?.access_token, 'diagnostic_admin_session_missing');
  const serialized = memory.values.get(storageKey);
  assert(typeof serialized === 'string', 'diagnostic_serialized_session_missing');
  return { client, serialized };
}

async function snapshot(page, stage) {
  return page.evaluate((snapshotStage) => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const rect = (node) => {
      const value = node.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height };
    };
    const forms = [...document.querySelectorAll('[data-admin-new-order-form="merchant"]')];
    const previews = [...document.querySelectorAll('[data-admin-financial-preview-version="verified-v1"]')];
    const inputs = [...document.querySelectorAll('[data-admin-financial-field]')];
    return {
      stage: snapshotStage,
      timestamp: new Date().toISOString(),
      formCount: forms.length,
      visibleFormCount: forms.filter(visible).length,
      previewCount: previews.length,
      visiblePreviewCount: previews.filter(visible).length,
      forms: forms.map((node, index) => ({ index, visible: visible(node), rect: rect(node) })),
      previews: previews.map((node, index) => ({
        index,
        visible: visible(node),
        rect: rect(node),
        dataset: { ...node.dataset },
        text: node.innerText,
      })),
      inputs: inputs.map((node, index) => ({
        index,
        field: node.dataset.adminFinancialField,
        visible: visible(node),
        rect: rect(node),
        value: node.value,
        defaultValue: node.defaultValue,
        valueAttribute: node.getAttribute('value'),
        trackerValue: node._valueTracker?.getValue?.() ?? null,
      })),
      events: Array.isArray(window.__dnFinancialEventLog) ? window.__dnFinancialEventLog : [],
    };
  }, stage);
}

async function resolveAvailableMerchantValue(select) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const value = await select.locator('option').evaluateAll((options, preferred) => {
      const real = options.filter((option) => {
        const optionValue = String(option.getAttribute('value') || '').trim();
        return optionValue && optionValue !== '__personal_order__';
      });
      const preferredOption = real.find(
        (option) => String(option.getAttribute('value') || '').trim() === preferred,
      );
      return String(
        preferredOption?.getAttribute('value') || real[0]?.getAttribute('value') || '',
      ).trim();
    }, preferredMerchantId);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('diagnostic_real_merchant_option_missing');
}

fs.mkdirSync(outputDirectory, { recursive: true });
const auth = await createAdminStorage();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ar-AE' });
await context.addInitScript(
  ({ key, value }) => window.localStorage.setItem(key, value),
  { key: storageKey, value: auth.serialized },
);
const page = await context.newPage();

try {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=financial_event_diagnostic`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
  const newOrderControls = page.locator('[data-dn-command-section="new_order"]');
  for (let index = 0; index < (await newOrderControls.count()); index += 1) {
    if (await newOrderControls.nth(index).isVisible().catch(() => false)) {
      await newOrderControls.nth(index).click();
      break;
    }
  }

  const visibleForm = page.locator('[data-admin-new-order-form="merchant"]:visible');
  await visibleForm.waitFor({ state: 'visible', timeout: 90000 });
  assert((await visibleForm.count()) === 1, `diagnostic_visible_form_count_${await visibleForm.count()}`);
  const merchantSelect = visibleForm.locator('[data-admin-order-owner-select="true"]');
  const merchantValue = await resolveAvailableMerchantValue(merchantSelect);
  await merchantSelect.selectOption(merchantValue);

  await page.evaluate(() => {
    window.__dnFinancialEventLog = [];
    const publish = (phase, event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      window.__dnFinancialEventLog.push({
        at: performance.now(),
        phase,
        type: event.type,
        field: target.dataset.adminFinancialField || '',
        value: target.value,
        bubbles: event.bubbles,
        cancelBubble: event.cancelBubble,
        defaultPrevented: event.defaultPrevented,
        isTrusted: event.isTrusted,
      });
    };
    document.addEventListener('input', (event) => publish('document-capture', event), true);
    document.addEventListener('change', (event) => publish('document-capture', event), true);
    document.addEventListener('input', (event) => publish('document-bubble', event), false);
    document.addEventListener('change', (event) => publish('document-bubble', event), false);
    for (const input of document.querySelectorAll('[data-admin-financial-field]')) {
      input.addEventListener('input', (event) => publish('target-input', event));
      input.addEventListener('change', (event) => publish('target-change', event));
    }
  });

  const snapshots = [await snapshot(page, 'before')];
  const goods = visibleForm.locator('[data-admin-financial-field="goods_value"]');
  await goods.focus();
  await goods.press('Control+A');
  await goods.pressSequentially('50', { delay: 80 });
  snapshots.push(await snapshot(page, 'goods-immediate'));
  await page.waitForTimeout(1500);
  snapshots.push(await snapshot(page, 'goods-after-1500ms'));

  await visibleForm.getByRole('button', { name: /^يدوي$|^Manual$/ }).click();
  const manual = visibleForm.locator('[data-admin-financial-field="manual_delivery_price"]');
  await manual.waitFor({ state: 'visible', timeout: 15000 });
  await manual.focus();
  await manual.press('Control+A');
  await manual.pressSequentially('60', { delay: 80 });
  snapshots.push(await snapshot(page, 'manual-immediate'));
  await page.waitForTimeout(1500);
  snapshots.push(await snapshot(page, 'manual-after-1500ms'));

  await page.screenshot({
    path: `${outputDirectory}/financial-event-ownership.png`,
    fullPage: true,
  });
  fs.writeFileSync(
    `${outputDirectory}/financial-event-ownership.json`,
    JSON.stringify({
      commit: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || '',
      browser: await page.evaluate(() => navigator.userAgent),
      merchantValue,
      snapshots,
    }, null, 2),
  );

  const final = snapshots.at(-1);
  const visiblePreview = final.previews.find((item) => item.visible);
  assert(visiblePreview, 'diagnostic_visible_preview_missing');
  assert(final.visiblePreviewCount === 1, `diagnostic_visible_preview_count_${final.visiblePreviewCount}`);
  assert(final.inputs.find((item) => item.visible && item.field === 'goods_value')?.value === '50', 'diagnostic_goods_dom_mismatch');
  assert(final.inputs.find((item) => item.visible && item.field === 'manual_delivery_price')?.value === '60', 'diagnostic_manual_dom_mismatch');
  assert(Number(visiblePreview.dataset.goodsValue) === 50, 'diagnostic_goods_state_mismatch');
  assert(Number(visiblePreview.dataset.deliveryFee) === 60, 'diagnostic_delivery_state_mismatch');
  assert(Number(visiblePreview.dataset.customerTotal) === 50, 'diagnostic_customer_state_mismatch');
  assert(Number(visiblePreview.dataset.merchantDue) === -10, 'diagnostic_merchant_state_mismatch');
  assert(Number(visiblePreview.dataset.companyRevenue) === 60, 'diagnostic_company_state_mismatch');
  const visibleText = String(visiblePreview.text || '').replace(/,/g, '');
  assert(visibleText.includes('50.00'), 'diagnostic_visible_goods_or_customer_missing');
  assert(visibleText.includes('60.00'), 'diagnostic_visible_delivery_or_revenue_missing');
  assert(visibleText.includes('-10.00'), 'diagnostic_visible_negative_merchant_missing');
} finally {
  await context.close();
  await auth.client.auth.signOut({ scope: 'local' }).catch(() => {});
  await browser.close();
}
