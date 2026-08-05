import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const base = String(process.env.TEST_BASE_URL || "").replace(/\/$/, "");
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || "").trim();
const evidenceDir = path.resolve("admin-financial-browser-evidence");
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
  const timeoutAt = Date.now() + 15000;
  let actual = null;
  while (Date.now() < timeoutAt) {
    actual = await locator.getAttribute(name);
    if (String(actual) === String(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: expected ${name}=${expected}, received ${actual}`);
}

async function openAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=financial_real_browser`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const shell = page.locator(".dncc-shell");
  if (await shell.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false)) {
    return;
  }

  await page.goto(`${base}/auth?nosplash=1&lang=ar&__dn_acceptance=financial_real_browser_login`, {
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
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

try {
  await openAdmin(page);
  await clickFirstVisible(page.locator('[data-dn-command-section="new_order"]'), "new_order_control");

  const form = page.locator('[data-admin-new-order-form="merchant"]');
  await form.waitFor({ state: "visible", timeout: 90000 });

  const preview = form.locator('[data-admin-financial-preview-version="6"]');
  await preview.waitFor({ state: "visible", timeout: 30000 });

  const goods = form.locator('[data-admin-financial-field="goods_value"]');
  await goods.waitFor({ state: "visible", timeout: 30000 });
  await goods.fill("4444");
  await waitAttribute(preview, "data-customer-total", "4469", "goods_4444_customer_total");
  await waitAttribute(preview, "data-merchant-due", "4444", "goods_4444_merchant_due_customer_mode");

  await clickFirstVisible(
    form.getByRole("button", { name: /رسوم التوصيل على حساب التاجر|Charge delivery to merchant/i }),
    "merchant_delivery_mode",
  );
  await waitAttribute(preview, "data-customer-total", "4444", "goods_4444_customer_total_merchant_mode");
  await waitAttribute(preview, "data-merchant-due", "4419", "goods_4444_merchant_due");

  await goods.fill("0");
  await waitAttribute(preview, "data-customer-total", "0", "goods_zero_customer_total");
  await waitAttribute(preview, "data-merchant-due", "-25", "goods_zero_merchant_debit");

  await clickFirstVisible(
    form.getByRole("button", { name: /^يدوي$|^Manual$/i }),
    "manual_price_mode",
  );
  const manualDelivery = form.locator('[data-admin-financial-field="manual_delivery_price"]');
  await manualDelivery.waitFor({ state: "visible", timeout: 30000 });
  await manualDelivery.fill("10");
  await waitAttribute(preview, "data-customer-total", "0", "manual_10_customer_total");
  await waitAttribute(preview, "data-merchant-due", "-10", "manual_10_merchant_debit");

  await goods.fill("100");
  await waitAttribute(preview, "data-customer-total", "100", "goods_100_customer_total");
  await waitAttribute(preview, "data-merchant-due", "90", "goods_100_manual_10_merchant_due");

  const inputValue = await goods.inputValue();
  assert(inputValue === "100", `goods_dom_value_mismatch_${inputValue}`);

  await page.screenshot({
    path: path.join(evidenceDir, "admin-financial-real-browser-pass.png"),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(evidenceDir, "result.txt"),
    [
      "PASS real browser financial input synchronization",
      "goods=4444 customer mode => customer=4469 merchant=4444",
      "goods=4444 merchant mode => customer=4444 merchant=4419",
      "goods=0 merchant mode => customer=0 merchant=-25",
      "goods=0 manual delivery=10 => customer=0 merchant=-10",
      "goods=100 manual delivery=10 => customer=100 merchant=90",
    ].join("\n"),
    "utf8",
  );
  console.log("PASS real browser financial input synchronization");
} catch (error) {
  await page.screenshot({
    path: path.join(evidenceDir, "admin-financial-real-browser-failure.png"),
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
