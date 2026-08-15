import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const evidenceDir = path.resolve('nexus-phase1-evidence');

function assert(condition, message) {
  if (!condition) throw new Error(`NEXUS_BROWSER_ACCEPTANCE_FAILED: ${message}`);
}

async function loginAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=nexus_phase1`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  if (await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)) {
    return;
  }

  await page.goto(`${base}/auth?nosplash=1&lang=ar&__dn_acceptance=nexus_phase1_login`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  const intro = page.locator('.auth-clean__intro-cta');
  if (await intro.isVisible().catch(() => false)) await intro.click();

  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  await email.waitFor({ state: 'visible', timeout: 30000 });
  await password.waitFor({ state: 'visible', timeout: 30000 });
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 90000 });
}

async function openNexus(page) {
  const launcher = page.locator('.dn-nexus-launcher').first();
  await launcher.waitFor({ state: 'visible', timeout: 60000 });
  await launcher.click();
  const shell = page.locator('.dn-nexus-shell');
  await shell.waitFor({ state: 'visible', timeout: 30000 });

  const content = page.locator('.dn-nexus-content');
  await content.waitFor({ state: 'visible', timeout: 90000 });
  assert(!(await page.locator('.dn-nexus-error').isVisible().catch(() => false)), 'runtime error banner is visible');
  return shell;
}

async function verifyNexus(page, label) {
  const shell = await openNexus(page);
  const metricCount = await page.locator('.dn-nexus-metric').count();
  const riskTotalCount = await page.locator('.dn-nexus-risk-totals > div').count();
  const actionCard = page.locator('.dn-nexus-actions-card');
  const financeCard = page.locator('.dn-nexus-finance-card');
  const mapCard = page.locator('.dn-nexus-map-card');
  const sourceProof = page.locator('.dn-nexus-source-proof');

  assert(metricCount === 8, `${label}: expected 8 KPI cards, got ${metricCount}`);
  assert(riskTotalCount === 3, `${label}: expected 3 risk severity totals, got ${riskTotalCount}`);
  assert(await actionCard.isVisible(), `${label}: Action Queue is not visible`);
  assert(await financeCard.isVisible(), `${label}: financial pulse is not visible`);
  assert(await mapCard.isVisible(), `${label}: Live Control Tower map card is not visible`);
  assert(await sourceProof.isVisible(), `${label}: real-source proof is not visible`);

  const sourceText = (await sourceProof.innerText()).trim();
  assert(sourceText.length > 8, `${label}: finance source proof is empty`);
  assert(!/demo value|mock value|sample data/i.test(await shell.innerText()), `${label}: mock/sample value marker found`);

  const mapSurface = page.locator('.dn-nexus-map-host .leaflet-container');
  await mapSurface.waitFor({ state: 'visible', timeout: 45000 });

  const result = {
    label,
    metricCount,
    riskTotalCount,
    signalCount: await page.locator('.dn-nexus-signal').count(),
    actionCount: await page.locator('.dn-nexus-action').count(),
    sourceText,
    launcherVisible: await page.locator('.dn-nexus-launcher').first().isVisible(),
    mapVisible: await mapSurface.isVisible(),
    viewport: page.viewportSize(),
  };

  await page.screenshot({
    path: path.join(evidenceDir, `${label}-nexus-phase1.png`),
    fullPage: true,
  });
  return result;
}

async function main() {
  assert(base, 'TEST_BASE_URL is required');
  assert(adminEmail, 'RUNTIME_ADMIN_EMAIL is required');
  assert(adminPassword, 'RUNTIME_ADMIN_PASSWORD is required');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error?.message || error)));

  try {
    await loginAdmin(page);
    const desktop = await verifyNexus(page, 'desktop');

    await page.locator('.dn-nexus-close').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 60000 });
    const mobile = await verifyNexus(page, 'mobile-390x844');

    const relevantErrors = consoleErrors.filter((line) =>
      /nexus|uncaught|typeerror|referenceerror|rangeerror/i.test(line),
    );
    assert(relevantErrors.length === 0, `relevant browser errors: ${relevantErrors.join(' | ')}`);

    fs.writeFileSync(
      path.join(evidenceDir, 'nexus-phase1-browser-report.json'),
      JSON.stringify({ status: 'PASS', desktop, mobile, relevantErrors }, null, 2),
    );
    console.log('NEXUS Phase 1 browser acceptance: PASS');
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
