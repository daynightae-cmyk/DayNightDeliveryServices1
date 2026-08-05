import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const base = String(process.env.TEST_BASE_URL || "").replace(/\/$/, "");
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || "").trim();
const evidenceDir = path.resolve("admin-merchant-financial-browser-evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function openAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=merchant_financial_routing`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const shell = page.locator(".dncc-shell");
  if (await shell.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false)) {
    return;
  }

  await page.goto(`${base}/auth?nosplash=1&lang=ar&__dn_acceptance=merchant_financial_routing_login`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const intro = page.locator(".auth-clean__intro-cta");
  if (await intro.isVisible().catch(() => false)) await intro.click();

  const email = page.locator("#dn-admin-email");
  const password = page.locator("#dn-admin-password");
  await email.waitFor({ state: "visible", timeout: 30000 });
  await password.waitFor({ state: "visible", timeout: 30000 });
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  await shell.waitFor({ state: "visible", timeout: 90000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1150 } });
const page = await context.newPage();

try {
  await openAdmin(page);
  await clickFirstVisible(page.locator('[data-dn-command-section="new_order"]'), "new_order_control");

  const form = page.locator('[data-admin-new-order-form="merchant"]');
  await form.waitFor({ state: "visible", timeout: 90000 });

  const preview = form.locator('[data-admin-financial-preview-version="7"]');
  await preview.waitFor({ state: "visible", timeout: 30000 });

  const ownerSelect = form.locator('[data-admin-order-owner-select="true"]').first();
  await ownerSelect.waitFor({ state: "visible", timeout: 30000 });
  const options = await ownerSelect.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({ value: node.value, text: node.textContent || "" })),
  );
  const merchantOption = options.find(
    (option) => option.value && option.value !== "__personal_order__",
  );
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
}
