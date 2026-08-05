import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const baseUrl = String(process.env.DEPLOYED_PREVIEW_URL || "").replace(/\/$/, "");
const expectedCommit = String(process.env.EXPECTED_COMMIT_SHA || "").trim();
const branchName = String(process.env.EXPECTED_BRANCH || "").trim();
const pullRequest = String(process.env.EXPECTED_PR_NUMBER || "").trim();
const deploymentCreatedAt = String(process.env.DEPLOYMENT_CREATED_AT || "").trim();
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || "");
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const evidenceDir = path.resolve("admin-financial-browser-evidence");

fs.mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(actual, expected, tolerance = 0.005) {
  return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) <= tolerance;
}

async function waitUntil(label, callback, timeoutMs = 20000, intervalMs = 150) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      last = await callback();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label}_timeout: ${last instanceof Error ? last.message : JSON.stringify(last)}`);
}

async function clickFirstVisible(locator, label) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return candidate;
    }
  }
  throw new Error(`missing_visible_control_${label}`);
}

async function readPreview(preview) {
  return preview.evaluate((element) => ({
    version: element.getAttribute("data-admin-financial-preview-version") || "",
    selectedMerchantId: element.getAttribute("data-selected-merchant-id") || "",
    paymentMethod: element.getAttribute("data-payment-method") || "",
    deliveryFeeMode: element.getAttribute("data-delivery-fee-mode") || "",
    goodsValue: Number(element.getAttribute("data-goods-value") || 0),
    deliveryFee: Number(element.getAttribute("data-delivery-fee") || 0),
    discountAmount: Number(element.getAttribute("data-discount-amount") || 0),
    customerTotal: Number(element.getAttribute("data-customer-total") || 0),
    merchantDue: Number(element.getAttribute("data-merchant-due") || 0),
    companyRevenue: Number(element.getAttribute("data-company-revenue") || 0),
    finalFinancialValue: Number(element.getAttribute("data-final-financial-value") || 0),
  }));
}

async function expectPreview(preview, expected, label) {
  return waitUntil(label, async () => {
    const actual = await readPreview(preview);
    for (const [key, value] of Object.entries(expected)) {
      if (typeof value === "number") {
        if (!nearlyEqual(actual[key], value)) return false;
      } else if (actual[key] !== value) {
        return false;
      }
    }
    return actual;
  });
}

async function rest(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`supabase_rest_${response.status}_${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function authenticateAdmin(page) {
  const shell = page.locator(".dncc-shell");
  await page.goto(`${baseUrl}/admin?nosplash=1&lang=ar&__dn_acceptance=admin_financial_verified_v1`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  if (await shell.waitFor({ state: "visible", timeout: 25000 }).then(() => true).catch(() => false)) return;

  await page.goto(`${baseUrl}/auth?nosplash=1&lang=ar&__dn_acceptance=admin_financial_verified_v1_login`, {
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

async function openSection(page, id) {
  const controls = page.locator(`[data-dn-command-section="${id}"]`);
  await controls.first().waitFor({ state: "attached", timeout: 90000 });
  try {
    await clickFirstVisible(controls, id);
  } catch {
    const mobileMenu = page.locator(".dncc-mobile-menu");
    if (await mobileMenu.isVisible().catch(() => false)) {
      await mobileMenu.click();
      await page.locator(".dncc-mobile-layer").waitFor({ state: "visible", timeout: 30000 });
      await clickFirstVisible(controls, `${id}_mobile`);
      return;
    }
    throw new Error(`section_${id}_not_visible`);
  }
}

async function selectRealMerchant(ownerSelect) {
  await waitUntil("merchant_options", async () => {
    const values = await ownerSelect.locator("option").evaluateAll((options) =>
      options.map((option) => option.value).filter((value) => value && value !== "__personal_order__"),
    );
    return values.length ? values : false;
  }, 60000, 300);
  const values = await ownerSelect.locator("option").evaluateAll((options) =>
    options.map((option) => option.value).filter((value) => value && value !== "__personal_order__"),
  );
  const merchantId = values[0];
  await ownerSelect.selectOption(merchantId);
  return merchantId;
}

async function fillFinancial(input, value, preview, expectedKey, expectedValue, label) {
  await input.fill(String(value));
  await waitUntil(`${label}_input_state`, async () => {
    const dom = await input.inputValue();
    const reactValue = await input.getAttribute("data-react-financial-value");
    const state = await readPreview(preview);
    return dom === String(value) && reactValue === String(value) && nearlyEqual(state[expectedKey], expectedValue);
  });
}

async function setManualDelivery(page, preview, input, value) {
  if (!(await input.isVisible().catch(() => false))) {
    await clickFirstVisible(preview.getByRole("button", { name: /يدوي|Manual/i }), "manual_price_mode");
    await input.waitFor({ state: "visible", timeout: 10000 });
  }
  await fillFinancial(input, value, preview, "deliveryFee", Number(value) === 0 ? 25 : Number(value), "manual_delivery");
}

async function setPayer(preview, mode) {
  const button = mode === "customer_pays"
    ? preview.getByRole("button", { name: /رسوم التوصيل تُضاف على العميل|Customer pays delivery fee/i })
    : preview.getByRole("button", { name: /رسوم التوصيل على حساب التاجر|Charge delivery to merchant/i });
  await clickFirstVisible(button, mode);
  await expectPreview(
    preview,
    {
      deliveryFeeMode: mode,
      paymentMethod: mode === "deduct_from_merchant" ? "merchant_pays" : "cod",
    },
    `payer_${mode}`,
  );
}

async function runCase({ page, preview, goodsInput, deliveryInput, discountInput, index, goods, delivery, mode, customer, merchant, revenue, final }) {
  await setManualDelivery(page, preview, deliveryInput, delivery);
  await goodsInput.fill(String(goods));
  await discountInput.fill("0");
  await setPayer(preview, mode);
  const actual = await expectPreview(
    preview,
    {
      goodsValue: goods,
      deliveryFee: delivery,
      discountAmount: 0,
      deliveryFeeMode: mode,
      customerTotal: customer,
      merchantDue: merchant,
      companyRevenue: revenue,
      finalFinancialValue: final,
    },
    `case_${index}`,
  );
  await preview.screenshot({ path: path.join(evidenceDir, `case-${index}.png`) });
  return actual;
}

async function verifyPreviewIdentity() {
  const response = await fetch(`${baseUrl}/version.json`, { cache: "no-store" });
  assert(response.ok, `version_json_http_${response.status}`);
  const version = await response.json();
  assert(String(version.buildId || "") === expectedCommit, `preview_commit_mismatch_${version.buildId || "missing"}_${expectedCommit}`);
  return version;
}

assert(baseUrl.startsWith("https://") && baseUrl.includes("vercel.app"), "fresh_vercel_preview_url_required");
assert(expectedCommit.length >= 40, "expected_commit_sha_required");
assert(adminEmail && adminPassword, "protected_admin_credentials_required");
assert(supabaseUrl && serviceRoleKey, "protected_supabase_cleanup_credentials_required");

const report = {
  rootCause: "",
  filesChanged: [
    "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
    ".github/scripts/admin-financial-preview-browser-acceptance.mjs",
    ".github/workflows/admin-financial-preview-browser-acceptance.yml",
  ],
  databaseChanged: "NO",
  browser: "",
  selectMerchantPass: false,
  liveInputPass: false,
  switchCustomerMerchantPass: false,
  cases: { 1: false, 2: false, 3: false, 4: false, 5: false },
  saveReopenPass: false,
  previewUrl: baseUrl,
  commit: expectedCommit,
  branch: branchName,
  pullRequest,
  marker: "",
  deploymentCreatedAt,
  productionDeployed: "NO",
  temporaryOrderId: "",
  temporaryOrderDeleted: false,
};

let createdOrderId = "";
let browser;
const consoleLines = [];
try {
  const version = await verifyPreviewIdentity();
  browser = await chromium.launch({ headless: true });
  report.browser = `Chromium ${browser.version()}`;
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: path.join(evidenceDir, "video"), size: { width: 1600, height: 1000 } },
  });
  const page = await context.newPage();
  page.on("console", (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => consoleLines.push(`[pageerror] ${error.message}`));

  await authenticateAdmin(page);
  await openSection(page, "new_order");

  const form = page.locator('[data-admin-new-order-form="merchant"]');
  await form.waitFor({ state: "visible", timeout: 90000 });
  const preview = form.locator('[data-admin-financial-preview-version="verified-v1"]');
  await preview.waitFor({ state: "visible", timeout: 30000 });
  report.marker = await preview.getAttribute("data-admin-financial-preview-version");
  assert(report.marker === "verified-v1", "verified_v1_marker_missing");

  const ownerSelect = form.locator('[data-admin-order-owner-select="true"]');
  const merchantId = await selectRealMerchant(ownerSelect);
  await expectPreview(
    preview,
    {
      selectedMerchantId: merchantId,
      deliveryFeeMode: "deduct_from_merchant",
      paymentMethod: "merchant_pays",
    },
    "select_merchant_default",
  );
  report.selectMerchantPass = true;

  const goodsInput = form.locator('[data-admin-financial-field="goods_value"]');
  const deliveryInput = form.locator('[data-admin-financial-field="manual_delivery_price"]');
  const discountInput = form.locator('[data-admin-financial-field="discount_amount"]');
  await goodsInput.waitFor({ state: "visible", timeout: 30000 });
  assert((await goodsInput.getAttribute("name")) === null, "financial_goods_input_must_not_have_restorable_name");
  assert((await goodsInput.getAttribute("data-admin-smart-autocomplete-bound")) === null, "financial_input_bound_to_history_autocomplete");

  await setManualDelivery(page, preview, deliveryInput, 25);
  await setPayer(preview, "deduct_from_merchant");
  for (const goods of [0, 10, 50, 100, 4444]) {
    await fillFinancial(goodsInput, goods, preview, "goodsValue", goods, `live_goods_${goods}`);
    await expectPreview(
      preview,
      {
        customerTotal: goods,
        merchantDue: goods - 25,
        companyRevenue: 25,
      },
      `live_cards_${goods}`,
    );
  }
  report.liveInputPass = true;

  await setPayer(preview, "customer_pays");
  await expectPreview(preview, { customerTotal: 4469, merchantDue: 4444 }, "switch_customer");
  await setPayer(preview, "deduct_from_merchant");
  await expectPreview(preview, { customerTotal: 4444, merchantDue: 4419 }, "switch_merchant");
  report.switchCustomerMerchantPass = true;

  const cases = [
    { index: 1, goods: 0, delivery: 25, mode: "deduct_from_merchant", customer: 0, merchant: -25, revenue: 25, final: -25 },
    { index: 2, goods: 100, delivery: 25, mode: "deduct_from_merchant", customer: 100, merchant: 75, revenue: 25, final: 75 },
    { index: 3, goods: 10, delivery: 25, mode: "deduct_from_merchant", customer: 10, merchant: -15, revenue: 25, final: -15 },
    { index: 4, goods: 100, delivery: 25, mode: "customer_pays", customer: 125, merchant: 100, revenue: 25, final: 125 },
    { index: 5, goods: 50, delivery: 60, mode: "deduct_from_merchant", customer: 50, merchant: -10, revenue: 60, final: -10 },
  ];
  for (const testCase of cases) {
    await runCase({ page, preview, goodsInput, deliveryInput, discountInput, ...testCase });
    report.cases[testCase.index] = true;
  }

  const coupon = `DN-ACCEPT-${Date.now()}`;
  const couponInput = form.locator('[data-admin-next-order-focus="true"]');
  const receiverName = form.locator('input[placeholder*="اسم العميل"], input[placeholder*="Customer name"]').first();
  const receiverPhone = form.locator('input[placeholder*="رقم تليفون"], input[placeholder*="Customer phone"]').first();
  await couponInput.fill(coupon);
  await receiverName.fill("DAY NIGHT BROWSER ACCEPTANCE DELETE");
  await receiverPhone.fill("0500000000");
  await page.screenshot({ path: path.join(evidenceDir, "before-save.png"), fullPage: true });
  await form.getByRole("button", { name: /حفظ وبدء طلب جديد|Save and start next order/i }).click();
  await waitUntil("save_success_message", async () => {
    const text = await form.innerText().catch(() => "");
    return text.includes("تم حفظ الطلب") && text.includes(coupon);
  }, 90000, 500);

  const rows = await rest(`orders?coupon_number=eq.${encodeURIComponent(coupon)}&select=*`);
  assert(Array.isArray(rows) && rows.length === 1, `temporary_order_lookup_count_${Array.isArray(rows) ? rows.length : "invalid"}`);
  const saved = rows[0];
  createdOrderId = String(saved.id || "");
  report.temporaryOrderId = createdOrderId;
  assert(createdOrderId, "temporary_order_id_missing");
  assert(nearlyEqual(saved.goods_value, 50), `saved_goods_${saved.goods_value}`);
  assert(nearlyEqual(saved.delivery_fee, 60), `saved_delivery_${saved.delivery_fee}`);
  assert(nearlyEqual(saved.discount_amount, 0), `saved_discount_${saved.discount_amount}`);
  assert(String(saved.delivery_fee_mode) === "deduct_from_merchant", `saved_mode_${saved.delivery_fee_mode}`);
  assert(["merchant_pays", "sender_pays"].includes(String(saved.payment_method)), `saved_payment_${saved.payment_method}`);
  assert(nearlyEqual(saved.customer_total, 50), `saved_customer_${saved.customer_total}`);
  assert(nearlyEqual(saved.merchant_due, -10), `saved_merchant_${saved.merchant_due}`);
  assert(nearlyEqual(saved.company_revenue, 60), `saved_revenue_${saved.company_revenue}`);

  await openSection(page, "all_orders");
  const search = page.locator('[data-admin-order-search="true"]');
  await search.waitFor({ state: "visible", timeout: 90000 });
  await search.fill(coupon);
  await waitUntil("saved_order_visible_in_admin", async () => (await page.locator("body").innerText()).includes(coupon), 90000, 500);
  await clickFirstVisible(page.getByRole("button", { name: /تعديل|Edit/i }), "temporary_order_edit");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30000 });
  const dialogText = await dialog.innerText();
  const dialogValues = await dialog.locator("input, select").evaluateAll((controls) =>
    controls.map((control) => ({
      value: control.value,
      name: control.getAttribute("name") || "",
      data: { ...control.dataset },
    })),
  );
  assert(dialogText.includes(coupon), "reopened_dialog_coupon_missing");
  assert(dialogValues.some((item) => Number(item.value) === 50), "reopened_goods_value_missing");
  assert(dialogValues.some((item) => Number(item.value) === 60), "reopened_delivery_value_missing");
  await dialog.screenshot({ path: path.join(evidenceDir, "saved-order-reopened.png") });
  await clickFirstVisible(dialog.getByRole("button", { name: /إلغاء|Cancel|إغلاق|Close/i }), "close_reopened_order");
  report.saveReopenPass = true;

  report.rootCause = "The browser-visible number could diverge from React state because PR #353 combined form-level input capture, field onChange, and field onBlur while retaining a stable restorable input name. Browser/session/extension value restoration can write the DOM property without an input/change event; the cards then continue reading the older controlled form state. The repair removes the duplicate capture/blur mutation routes, removes the restorable financial name, excludes all financial inputs from autocomplete, and keeps preview and save on one resolvedFinancialInput object.";
  await page.screenshot({ path: path.join(evidenceDir, "final-admin-state.png"), fullPage: true });
  await context.close();
} catch (error) {
  report.failure = error instanceof Error ? error.stack || error.message : String(error);
  throw error;
} finally {
  if (createdOrderId) {
    try {
      const deleted = await rest(`orders?id=eq.${encodeURIComponent(createdOrderId)}`, { method: "DELETE" });
      report.temporaryOrderDeleted = Array.isArray(deleted) && deleted.some((row) => String(row.id) === createdOrderId);
    } catch (cleanupError) {
      report.cleanupFailure = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
  }
  if (browser) await browser.close().catch(() => {});
  fs.writeFileSync(path.join(evidenceDir, "browser-console.log"), `${consoleLines.join("\n")}\n`, "utf8");
  fs.writeFileSync(path.join(evidenceDir, "acceptance-report.json"), JSON.stringify(report, null, 2), "utf8");
  const markdown = `# DAY NIGHT Admin Financial Preview Acceptance\n\n- ROOT CAUSE: ${report.rootCause || report.failure || "Not established"}\n- DATABASE CHANGED: ${report.databaseChanged}\n- REAL BROWSER TEST: ${report.browser || "NOT EXECUTED"}\n- SELECT MERCHANT PASS: ${report.selectMerchantPass ? "YES" : "NO"}\n- LIVE INPUT PASS: ${report.liveInputPass ? "YES" : "NO"}\n- SWITCH CUSTOMER/MERCHANT PASS: ${report.switchCustomerMerchantPass ? "YES" : "NO"}\n- CASE 1 PASS: ${report.cases[1] ? "YES" : "NO"}\n- CASE 2 PASS: ${report.cases[2] ? "YES" : "NO"}\n- CASE 3 PASS: ${report.cases[3] ? "YES" : "NO"}\n- CASE 4 PASS: ${report.cases[4] ? "YES" : "NO"}\n- CASE 5 PASS: ${report.cases[5] ? "YES" : "NO"}\n- SAVE/REOPEN PASS: ${report.saveReopenPass ? "YES" : "NO"}\n- TEMPORARY ORDER DELETED: ${report.temporaryOrderDeleted ? "YES" : "NO"}\n- PREVIEW URL: ${report.previewUrl}\n- COMMIT: ${report.commit}\n- BRANCH: ${report.branch}\n- PR: ${report.pullRequest}\n- MARKER: ${report.marker || "NOT VERIFIED"}\n- DEPLOYMENT CREATED: ${report.deploymentCreatedAt}\n- PRODUCTION DEPLOYED: ${report.productionDeployed}\n`;
  fs.writeFileSync(path.join(evidenceDir, "acceptance-report.md"), markdown, "utf8");
}

assert(report.temporaryOrderDeleted, "temporary_order_cleanup_not_verified");
console.log(JSON.stringify(report, null, 2));
