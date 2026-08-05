import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const base = String(process.env.TEST_BASE_URL || "").replace(/\/$/, "");
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || "");
const expectedVersion = String(process.env.EXPECTED_FINANCIAL_PREVIEW_VERSION || "7");
const evidenceDir = path.resolve("admin-financial-browser-evidence");

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
  throw new Error(`missing_visible_control_${label}`);
}

async function openAdmin(page) {
  const shell = page.locator(".dncc-shell");
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=financial_diagnostic`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });

  if (await shell.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false)) {
    return;
  }

  await page.goto(`${base}/auth?nosplash=1&lang=ar&__dn_acceptance=financial_diagnostic_login`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  const intro = page.locator(".auth-clean__intro-cta");
  if (await intro.isVisible().catch(() => false)) await intro.click();

  await page.locator("#dn-admin-email").fill(adminEmail);
  await page.locator("#dn-admin-password").fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  await shell.waitFor({ state: "visible", timeout: 90_000 });
}

async function openNewOrder(page) {
  const section = page.locator('[data-dn-command-section="new_order"]');
  await section.first().waitFor({ state: "attached", timeout: 90_000 });

  const count = await section.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = section.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      await page.locator('[data-admin-new-order-form="merchant"]').waitFor({ state: "visible", timeout: 90_000 });
      return;
    }
  }

  await page.locator(".dncc-mobile-menu").click();
  await page.locator(".dncc-mobile-layer").waitFor({ state: "visible", timeout: 30_000 });
  await clickFirstVisible(section, "new_order_mobile");
  await page.locator('[data-admin-new-order-form="merchant"]').waitFor({ state: "visible", timeout: 90_000 });
}

async function previewNumber(preview, attribute) {
  const raw = await preview.getAttribute(attribute);
  const value = Number(raw);
  assert(Number.isFinite(value), `${attribute}_not_numeric_${raw}`);
  return value;
}

async function assertPreview(preview, expected, label) {
  await preview.page().waitForFunction(
    ({ selector, customer, merchant }) => {
      const node = document.querySelector(selector);
      return (
        node instanceof HTMLElement &&
        Number(node.dataset.customerTotal) === customer &&
        Number(node.dataset.merchantDue) === merchant
      );
    },
    {
      selector: `[data-admin-financial-preview-version="${expectedVersion}"]`,
      customer: expected.customer,
      merchant: expected.merchant,
    },
    { timeout: 15_000 },
  );

  const actualCustomer = await previewNumber(preview, "data-customer-total");
  const actualMerchant = await previewNumber(preview, "data-merchant-due");
  assert(actualCustomer === expected.customer, `${label}_customer_expected_${expected.customer}_received_${actualCustomer}`);
  assert(actualMerchant === expected.merchant, `${label}_merchant_expected_${expected.merchant}_received_${actualMerchant}`);
}

async function typeFinancialValue(input, rawValue) {
  await input.focus();
  await input.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await input.pressSequentially(String(rawValue), { delay: 65 });
  assert((await input.inputValue()) === String(rawValue), `input_dom_value_mismatch_${rawValue}`);
}

fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

const report = {
  browser: "Chromium",
  expectedVersion,
  selectMerchant: "NO",
  liveInput: "NO",
  switchCustomerMerchant: "NO",
  cases: {},
};

try {
  await openAdmin(page);
  await openNewOrder(page);

  const preview = page.locator(`[data-admin-financial-preview-version="${expectedVersion}"]`);
  await preview.waitFor({ state: "visible", timeout: 90_000 });

  const merchantSelect = page.locator('[data-admin-order-owner-select="true"]').first();
  const merchantValue = await merchantSelect.locator("option").evaluateAll((options) => {
    const match = options.find((option) => {
      const value = option.getAttribute("value") || "";
      return value && value !== "__personal_order__";
    });
    return match?.getAttribute("value") || "";
  });
  assert(merchantValue, "no_real_merchant_option_available");
  await merchantSelect.selectOption(merchantValue);

  await page.waitForFunction(
    ({ merchantValue, expectedVersion }) => {
      const node = document.querySelector(`[data-admin-financial-preview-version="${expectedVersion}"]`);
      return (
        node instanceof HTMLElement &&
        node.dataset.selectedMerchantId === merchantValue &&
        node.dataset.deliveryFeeMode === "deduct_from_merchant"
      );
    },
    { merchantValue, expectedVersion },
    { timeout: 15_000 },
  );
  report.selectMerchant = "YES";

  const goods = page.locator('[data-admin-financial-field="goods_value"]');
  const sequence = [
    { value: "0", customer: 0, merchant: -25, name: "CASE 1" },
    { value: "10", customer: 10, merchant: -15, name: "CASE 3" },
    { value: "50", customer: 50, merchant: 25, name: "LIVE 50" },
    { value: "100", customer: 100, merchant: 75, name: "CASE 2" },
    { value: "4444", customer: 4444, merchant: 4419, name: "LIVE 4444" },
  ];

  for (const item of sequence) {
    await typeFinancialValue(goods, item.value);
    await assertPreview(preview, item, item.name.replace(/\s+/g, "_"));
    report.cases[item.name] = "PASS";
  }
  report.liveInput = "YES";

  await typeFinancialValue(goods, "100");
  await clickFirstVisible(page.getByRole("button", { name: /رسوم التوصيل تُضاف على العميل|Customer pays delivery fee/ }), "customer_pays");
  await assertPreview(preview, { customer: 125, merchant: 100 }, "CASE_4");
  report.cases["CASE 4"] = "PASS";

  await clickFirstVisible(page.getByRole("button", { name: /رسوم التوصيل على حساب التاجر|Charge delivery to merchant/ }), "merchant_pays");
  await assertPreview(preview, { customer: 100, merchant: 75 }, "switch_back_merchant");
  report.switchCustomerMerchant = "YES";

  await clickFirstVisible(page.getByRole("button", { name: /^يدوي$|^Manual$/ }), "manual_price");
  const manualDelivery = page.locator('[data-admin-financial-field="manual_delivery_price"]');
  await manualDelivery.waitFor({ state: "visible", timeout: 15_000 });
  await typeFinancialValue(goods, "50");
  await typeFinancialValue(manualDelivery, "60");
  await assertPreview(preview, { customer: 50, merchant: -10 }, "CASE_5");
  report.cases["CASE 5"] = "PASS";

  await page.screenshot({ path: path.join(evidenceDir, "financial-diagnostic-pass.png"), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(evidenceDir, "financial-diagnostic-failure.png"), fullPage: true }).catch(() => {});
  fs.writeFileSync(
    path.join(evidenceDir, "failure.txt"),
    `${error instanceof Error ? error.stack || error.message : String(error)}\n\n${await page.locator("body").innerText().catch(() => "body unavailable")}`,
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
