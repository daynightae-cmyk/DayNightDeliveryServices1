import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const mapboxToken = String(process.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();
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
  const launcher = page.locator('.dn-nexus-command-launcher').first();
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
  const commandMap = page.locator('.dn-nexus-command-map');
  const sourceProof = page.locator('.dn-nexus-source-proof');

  assert(metricCount === 8, `${label}: expected 8 KPI cards, got ${metricCount}`);
  assert(riskTotalCount === 3, `${label}: expected 3 risk severity totals, got ${riskTotalCount}`);
  assert(await actionCard.isVisible(), `${label}: Action Queue is not visible`);
  assert(await financeCard.isVisible(), `${label}: financial pulse is not visible`);
  assert(await mapCard.isVisible(), `${label}: Live Control Tower map card is not visible`);
  assert(await commandMap.isVisible(), `${label}: NEXUS live command map is not visible`);
  assert(await sourceProof.isVisible(), `${label}: real-source proof is not visible`);

  const sourceText = (await sourceProof.innerText()).trim();
  assert(sourceText.length > 8, `${label}: finance source proof is empty`);
  const shellText = await shell.innerText();
  assert(!/demo value|mock value|sample data/i.test(shellText), `${label}: mock/sample value marker found`);

  const configWarning = page.locator('.dn-nexus-command-map__configuration');
  assert(!(await configWarning.isVisible().catch(() => false)), `${label}: Mapbox environment is missing`);
  const mapError = page.locator('.dn-nexus-command-map__map-error');
  assert(!(await mapError.isVisible().catch(() => false)), `${label}: Mapbox runtime error is visible`);

  const mapSurface = page.locator('.dn-nexus-command-map .mapboxgl-canvas');
  await mapSurface.waitFor({ state: 'visible', timeout: 60000 });
  const canvasBox = await mapSurface.boundingBox();
  assert(canvasBox && canvasBox.width > 260 && canvasBox.height > 250, `${label}: Mapbox canvas has invalid geometry`);

  const truthStrip = page.locator('.dn-nexus-command-map__truth-strip');
  const pendingPanel = page.locator('.dn-nexus-command-map__order-list');
  const search = page.locator('.dn-nexus-command-map__search input');
  assert(await truthStrip.isVisible(), `${label}: real-data truth strip is not visible`);
  assert(await pendingPanel.isVisible(), `${label}: pending dispatch panel is not visible`);
  assert(await search.isVisible(), `${label}: NEXUS search control is not visible`);

  const result = {
    label,
    metricCount,
    riskTotalCount,
    signalCount: await page.locator('.dn-nexus-signal').count(),
    actionCount: await page.locator('.dn-nexus-action').count(),
    sourceText,
    commandLauncherVisible: await page.locator('.dn-nexus-command-launcher').first().isVisible(),
    mapVisible: await mapSurface.isVisible(),
    mapCanvas: canvasBox,
    pendingRows: await page.locator('.dn-nexus-command-map__order-list button').count(),
    driverStats: (await page.locator('.dn-nexus-command-map__stats').innerText()).trim(),
    truthText: (await truthStrip.innerText()).trim(),
    viewport: page.viewportSize(),
  };

  await page.screenshot({
    path: path.join(evidenceDir, `${label}-nexus-live-command-center.png`),
    fullPage: true,
  });
  return result;
}

async function main() {
  assert(base, 'TEST_BASE_URL is required');
  assert(adminEmail, 'RUNTIME_ADMIN_EMAIL is required');
  assert(adminPassword, 'RUNTIME_ADMIN_PASSWORD is required');
  assert(mapboxToken.startsWith('pk.'), 'VITE_MAPBOX_ACCESS_TOKEN public pk token is required');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const mapboxFailures = [];
  const mapboxRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error?.message || error)));
  page.on('response', (response) => {
    const url = response.url();
    if (!/mapbox\.com|mapbox\.cn/i.test(url)) return;
    mapboxRequests.push({ url, status: response.status() });
    if (response.status() === 401 || response.status() === 403 || response.status() >= 500) {
      mapboxFailures.push({ url, status: response.status() });
    }
  });

  try {
    await loginAdmin(page);
    const desktop = await verifyNexus(page, 'desktop');

    await page.locator('.dn-nexus-close').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 60000 });
    const mobile = await verifyNexus(page, 'mobile-390x844');

    const relevantErrors = consoleErrors.filter((line) =>
      /nexus|mapbox|uncaught|typeerror|referenceerror|rangeerror/i.test(line),
    );
    assert(relevantErrors.length === 0, `relevant browser errors: ${relevantErrors.join(' | ')}`);
    assert(mapboxFailures.length === 0, `Mapbox auth/server failures: ${JSON.stringify(mapboxFailures.slice(0, 8))}`);
    assert(mapboxRequests.some((item) => item.status >= 200 && item.status < 400), 'no successful Mapbox network response observed');

    fs.writeFileSync(
      path.join(evidenceDir, 'nexus-live-command-center-browser-report.json'),
      JSON.stringify({
        status: 'PASS',
        desktop,
        mobile,
        relevantErrors,
        mapboxFailures,
        mapboxRequestCount: mapboxRequests.length,
        successfulMapboxRequests: mapboxRequests.filter((item) => item.status >= 200 && item.status < 400).length,
      }, null, 2),
    );
    console.log('NEXUS live command center browser acceptance: PASS');
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
