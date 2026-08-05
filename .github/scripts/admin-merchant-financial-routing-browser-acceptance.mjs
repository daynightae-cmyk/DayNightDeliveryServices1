import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), "artifacts/day-night-delivery/node_modules/@supabase/supabase-js"),
);

const base = String(process.env.TEST_BASE_URL || "").replace(/\/$/, "");
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "");
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || "").trim();
const evidenceDir = path.resolve("admin-merchant-financial-browser-evidence");
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;
fs.mkdirSync(evidenceDir, { recursive: true });

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

async function createAdminSession() {
  const memoryStorage = createMemoryStorage();
  const sessionClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memoryStorage.adapter,
      storageKey,
    },
  });

  const { data, error } = await sessionClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (error) throw new Error(`admin_session_login_failed_${error.message}`);

  const session = data?.session;
  const userId = data?.user?.id;
  assert(session?.access_token && session?.refresh_token && userId, "admin_session_missing");

  const { data: profile, error: profileError } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profileError) throw new Error(`admin_profile_check_failed_${profileError.message}`);
  assert(String(profile?.role || "").toLowerCase() === "admin", `admin_profile_role_${profile?.role || "null"}`);

  const serializedSession = memoryStorage.values.get(storageKey);
  assert(
    typeof serializedSession === "string" && serializedSession.includes(session.access_token),
    "admin_serialized_session_missing",
  );

  return { serializedSession, sessionClient };
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

async function waitAttribute(locator, name, expected, label) {
  const timeoutAt = Date.now() + 20000;
  let actual = null;
  while (Date.now() < timeoutAt) {
    actual = await locator.getAttribute(name);
    if (String(actual) === String(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: expected ${name}=${expected}, received ${actual}`);
}

async function waitForRealMerchantOption(ownerSelect, page) {
  const timeoutAt = Date.now() + 150000;
  let lastOptions = [];
  let refreshAttempted = false;

  while (Date.now() < timeoutAt) {
    lastOptions = await ownerSelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.value, text: node.textContent || "" })),
    );
    const merchantOption = lastOptions.find(
      (option) => option.value && option.value !== "__personal_order__",
    );
    if (merchantOption) return merchantOption;

    if (!refreshAttempted && Date.now() + 105000 < timeoutAt) {
      const refreshButton = page.getByRole("button", { name: /تحديث|Refresh|تحميل البيانات الحية/i }).first();
      if (await refreshButton.isVisible().catch(() => false)) {
        const disabled = await refreshButton.isDisabled().catch(() => true);
        if (!disabled) {
          await refreshButton.click().catch(() => {});
          refreshAttempted = true;
        }
      }
    }
    await page.waitForTimeout(1000);
  }

  const body = await page.locator("body").innerText().catch(() => "body unavailable");
  throw new Error(
    `no_real_merchant_option_after_live_data_wait options=${JSON.stringify(lastOptions)} body=${body.slice(0, 1600)}`,
  );
}

const { serializedSession, sessionClient } = await createAdminSession();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1150 } });
await context.addInitScript(
  ({ key, value }) => {
    window.localStorage.setItem(key, value);
  },
  { key: storageKey, value: serializedSession },
);
const page = await context.newPage();

try {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=merchant_financial_routing`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const shell = page.locator(".dncc-shell");
  const shellVisible = await shell
    .waitFor({ state: "visible", timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  if (!shellVisible) {
    const body = await page.locator("body").innerText().catch(() => "body unavailable");
    throw new Error(`admin_shell_not_visible_after_injected_session body=${body.slice(0, 1600)}`);
  }

  await clickFirstVisible(page.locator('[data-dn-command-section="new_order"]'), "new_order_control");

  const form = page.locator('[data-admin-new-order-form="merchant"]');
  await form.waitFor({ state: "visible", timeout: 90000 });

  const preview = form.locator('[data-admin-financial-preview-version="7"]');
  await preview.waitFor({ state: "visible", timeout: 30000 });

  const ownerSelect = form.locator('[data-admin-order-owner-select="true"]').first();
  await ownerSelect.waitFor({ state: "visible", timeout: 30000 });
  const merchantOption = await waitForRealMerchantOption(ownerSelect, page);
  assert(merchantOption, "no_real_merchant_option_available");

  await ownerSelect.selectOption(merchantOption.value);
  await waitAttribute(preview, "data-selected-merchant-id", merchantOption.value, "selected_merchant_identity");
  await waitAttribute(preview, "data-delivery-fee-mode", "deduct_from_merchant", "merchant_selection_defaults_to_merchant");

  await clickFirstVisible(
    form.getByRole("button", { name: /^يدوي$|^Manual$/i }),
    "manual_price_mode",
  );

  const manualDelivery = form.locator('[data-admin-financial-field="manual_delivery_price"]');
  const goods = form.locator('[data-admin-financial-field="goods_value"]');
  await manualDelivery.waitFor({ state: "visible", timeout: 30000 });
  await goods.waitFor({ state: "visible", timeout: 30000 });

  await manualDelivery.fill("25");
  await goods.fill("0");
  await waitAttribute(preview, "data-delivery-fee-mode", "deduct_from_merchant", "zero_goods_stays_on_merchant");
  await waitAttribute(preview, "data-customer-total", "0", "zero_goods_customer_total");
  await waitAttribute(preview, "data-merchant-due", "-25", "zero_goods_merchant_debit");

  await goods.fill("100");
  await waitAttribute(preview, "data-customer-total", "100", "goods_100_merchant_mode_customer_total");
  await waitAttribute(preview, "data-merchant-due", "75", "goods_100_merchant_mode_merchant_due");

  await clickFirstVisible(
    form.getByRole("button", { name: /رسوم التوصيل تُضاف على العميل|Customer pays delivery fee/i }),
    "customer_delivery_mode",
  );
  await waitAttribute(preview, "data-delivery-fee-mode", "customer_pays", "manual_switch_to_customer");
  await waitAttribute(preview, "data-customer-total", "125", "goods_100_customer_mode_customer_total");
  await waitAttribute(preview, "data-merchant-due", "100", "goods_100_customer_mode_merchant_due");

  await goods.fill("50");
  await waitAttribute(preview, "data-customer-total", "75", "goods_50_customer_mode_customer_total");
  await waitAttribute(preview, "data-merchant-due", "50", "goods_50_customer_mode_merchant_due");

  await clickFirstVisible(
    form.getByRole("button", { name: /رسوم التوصيل على حساب التاجر|Charge delivery to merchant/i }),
    "merchant_delivery_mode",
  );
  await waitAttribute(preview, "data-delivery-fee-mode", "deduct_from_merchant", "manual_switch_back_to_merchant");
  await waitAttribute(preview, "data-customer-total", "50", "goods_50_merchant_mode_customer_total");
  await waitAttribute(preview, "data-merchant-due", "25", "goods_50_merchant_mode_merchant_due");

  await manualDelivery.fill("60");
  await waitAttribute(preview, "data-customer-total", "50", "manual_60_customer_total");
  await waitAttribute(preview, "data-merchant-due", "-10", "manual_60_merchant_debit");

  await clickFirstVisible(
    form.getByRole("button", { name: /رسوم التوصيل تُضاف على العميل|Customer pays delivery fee/i }),
    "customer_mode_before_reselect",
  );
  await ownerSelect.selectOption("");
  await ownerSelect.selectOption(merchantOption.value);
  await waitAttribute(preview, "data-delivery-fee-mode", "deduct_from_merchant", "reselect_merchant_restores_merchant_default");

  assert((await goods.inputValue()) === "50", "goods_input_value_not_preserved");
  assert((await manualDelivery.inputValue()) === "60", "manual_delivery_input_value_not_preserved");

  await page.screenshot({
    path: path.join(evidenceDir, "merchant-financial-routing-pass.png"),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(evidenceDir, "result.txt"),
    [
      "PASS injected authenticated admin session",
      "PASS merchant selection automatically routes delivery to merchant",
      "PASS goods and manual delivery update every financial card immediately",
      "PASS customer/merchant routing can be switched manually in both directions",
      "PASS selecting the merchant again restores the merchant default",
      "PASS goods=0 fee=25 merchant => customer=0 merchant=-25",
      "PASS goods=100 fee=25 merchant => customer=100 merchant=75",
      "PASS goods=100 fee=25 customer => customer=125 merchant=100",
      "PASS goods=50 fee=60 merchant => customer=50 merchant=-10",
    ].join("\n"),
    "utf8",
  );
  console.log("PASS exact merchant financial routing browser acceptance");
} catch (error) {
  await page.screenshot({
    path: path.join(evidenceDir, "merchant-financial-routing-failure.png"),
    fullPage: true,
  }).catch(() => {});
  fs.writeFileSync(
    path.join(evidenceDir, "failure.txt"),
    String(error?.stack || error),
    "utf8",
  );
  throw error;
} finally {
  await browser.close();
  await sessionClient.auth.signOut({ scope: "local" }).catch(() => {});
}
