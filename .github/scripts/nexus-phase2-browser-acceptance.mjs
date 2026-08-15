import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const evidenceDir = path.resolve('nexus-phase2-evidence');

function assert(condition, message) {
  if (!condition) throw new Error(`NEXUS_PHASE2_BROWSER_FAILED: ${message}`);
}

async function loginAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=nexus_phase2`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  if (await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)) return;

  await page.goto(`${base}/auth?nosplash=1&lang=ar&__dn_acceptance=nexus_phase2_login`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  const intro = page.locator('.auth-clean__intro-cta');
  if (await intro.isVisible().catch(() => false)) await intro.click();
  await page.locator('#dn-admin-email').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#dn-admin-email').fill(adminEmail);
  await page.locator('#dn-admin-password').fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 90000 });
}

async function openNexus(page) {
  const launcher = page.locator('.dn-nexus-command-launcher').first();
  await launcher.waitFor({ state: 'visible', timeout: 60000 });
  await launcher.click();
  await page.locator('.dn-nexus-shell').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('.dn-nexus-content').waitFor({ state: 'visible', timeout: 90000 });
  await page.locator('.dn-nexus2').waitFor({ state: 'visible', timeout: 90000 });
  await page.locator('.dn-nexus2-profit-card').waitFor({ state: 'visible', timeout: 90000 });
}

async function verify(page, label) {
  await openNexus(page);
  assert(!(await page.locator('.dn-nexus2-error').isVisible().catch(() => false)), `${label}: Phase 2 error banner visible`);
  assert(await page.locator('.dn-nexus2-brief-card').isVisible(), `${label}: AI Operations Brief missing`);
  assert(await page.locator('.dn-nexus2-dispatch').isVisible(), `${label}: Smart Dispatch panel missing`);
  assert(await page.locator('.dn-nexus2-merchants').isVisible(), `${label}: Merchant Health panel missing`);
  assert(await page.locator('.dn-nexus2-profit-card').isVisible(), `${label}: Profit Intelligence panel missing`);
  assert(await page.locator('.dn-nexus2-proof').isVisible(), `${label}: recommendation-only proof missing`);

  const briefCount = await page.locator('.dn-nexus2-brief-list article').count();
  const profitKpis = await page.locator('.dn-nexus2-profit-kpis > div').count();
  assert(briefCount >= 1, `${label}: executive brief has no items`);
  assert(profitKpis === 4, `${label}: expected 4 profit KPIs, got ${profitKpis}`);

  const proofText = (await page.locator('.dn-nexus2-proof').innerText()).trim();
  assert(/no assign|لا يوجد Assign|بدون تنفيذ|no automatic/i.test(proofText), `${label}: read-only proof text missing`);

  const fullText = await page.locator('.dn-nexus2').innerText();
  assert(!/mock value|sample data|fake data/i.test(fullText), `${label}: mock/sample marker found`);

  const result = {
    label,
    briefCount,
    dispatchCards: await page.locator('.dn-nexus2-dispatch-card').count(),
    merchantRows: await page.locator('.dn-nexus2-merchant-row').count(),
    profitKpis,
    proofText,
    viewport: page.viewportSize(),
  };

  await page.screenshot({ path: path.join(evidenceDir, `${label}-nexus-phase2.png`), fullPage: true });
  return result;
}

async function main() {
  assert(base, 'TEST_BASE_URL is required');
  assert(adminEmail, 'RUNTIME_ADMIN_EMAIL is required');
  assert(adminPassword, 'RUNTIME_ADMIN_PASSWORD is required');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(String(error?.message || error)));

  try {
    await loginAdmin(page);
    const desktop = await verify(page, 'desktop');

    await page.locator('.dn-nexus-close').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 60000 });
    const mobile = await verify(page, 'mobile-390x844');

    const relevantErrors = errors.filter((line) => /nexus|phase 2|typeerror|referenceerror|rangeerror/i.test(line));
    assert(relevantErrors.length === 0, `relevant browser errors: ${relevantErrors.join(' | ')}`);

    fs.writeFileSync(
      path.join(evidenceDir, 'nexus-phase2-browser-report.json'),
      JSON.stringify({ status: 'PASS', desktop, mobile, relevantErrors }, null, 2),
    );
    console.log('NEXUS Phase 2 browser acceptance: PASS');
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
