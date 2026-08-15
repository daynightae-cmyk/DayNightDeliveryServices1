import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const evidenceDir = path.resolve('nexus-phase4-evidence');

function assert(condition, message) { if (!condition) throw new Error(`NEXUS_PHASE4_BROWSER_FAILED: ${message}`); }

async function loginAdmin(page) {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=nexus_phase4`, { waitUntil:'domcontentloaded', timeout:90000 });
  if (await page.locator('.dn-admin-fullscreen').waitFor({ state:'visible', timeout:30000 }).then(()=>true).catch(()=>false)) return;
  await page.goto(`${base}/auth?nosplash=1&lang=ar&__dn_acceptance=nexus_phase4_login`, { waitUntil:'domcontentloaded', timeout:90000 });
  const intro = page.locator('.auth-clean__intro-cta'); if (await intro.isVisible().catch(()=>false)) await intro.click();
  await page.locator('#dn-admin-email').waitFor({ state:'visible', timeout:30000 });
  await page.locator('#dn-admin-email').fill(adminEmail);
  await page.locator('#dn-admin-password').fill(adminPassword);
  await page.locator('button[type="submit"]').click();
  await page.locator('.dn-admin-fullscreen').waitFor({ state:'visible', timeout:90000 });
}

async function waitForPhase4Ready(page, label) {
  await page.waitForFunction(() => {
    const root = document.querySelector('.dn-nexus4');
    if (!root) return false;
    return Boolean(root.querySelector('.dn-nexus4-kpis') || root.querySelector('.dn-nexus4-error'));
  }, null, { timeout: 90000 });
  const error = page.locator('.dn-nexus4-error');
  if (await error.isVisible().catch(()=>false)) throw new Error(`NEXUS_PHASE4_BROWSER_FAILED: ${label}: ${(await error.innerText()).trim()}`);
}

async function verify(page, label) {
  const launcher = page.locator('.dn-nexus-command-launcher').first();
  await launcher.waitFor({ state:'visible', timeout:60000 });
  await launcher.click();
  await page.locator('.dn-nexus-shell').waitFor({ state:'visible', timeout:30000 });
  await page.locator('.dn-nexus4').waitFor({ state:'visible', timeout:90000 });
  await waitForPhase4Ready(page, label);
  assert(await page.locator('.dn-nexus4-kpis').isVisible(), `${label}: KPI strip missing`);
  assert((await page.locator('.dn-nexus4-kpis article').count()) === 5, `${label}: expected 5 KPIs`);
  assert(await page.locator('.dn-nexus4-baselines').isVisible(), `${label}: observed baseline section missing`);
  assert(await page.locator('.dn-nexus4-recovery').isVisible(), `${label}: recovery queue missing`);
  assert(await page.locator('.dn-nexus4-friction').isVisible(), `${label}: customer journey signals missing`);
  assert(await page.locator('.dn-nexus4-merchants').isVisible(), `${label}: merchant service promise missing`);
  const text = await page.locator('.dn-nexus4').innerText();
  assert(/OBSERVED SERVICE BASELINES/i.test(text), `${label}: observed baseline proof missing`);
  assert(/CUSTOMER RECOVERY QUEUE/i.test(text), `${label}: recovery queue proof missing`);
  assert(/CUSTOMER JOURNEY SIGNALS/i.test(text), `${label}: journey signals proof missing`);
  assert(/MERCHANT SERVICE PROMISE/i.test(text), `${label}: merchant promise proof missing`);
  assert(/Read-only|لا تعديل طلبات/i.test(text), `${label}: read-only proof missing`);
  assert(/not a contractual SLA|ليس SLA تعاقد/i.test(text), `${label}: non-contractual baseline disclaimer missing`);
  assert(!/mock data|fake data|sample data/i.test(text), `${label}: fake/sample marker found`);
  await page.screenshot({ path:path.join(evidenceDir, `${label}-nexus-phase4.png`), fullPage:true });
  return { label, viewport:page.viewportSize(), kpis:5 };
}

async function main() {
  assert(base, 'TEST_BASE_URL is required'); assert(adminEmail, 'RUNTIME_ADMIN_EMAIL is required'); assert(adminPassword, 'RUNTIME_ADMIN_PASSWORD is required');
  fs.mkdirSync(evidenceDir, { recursive:true });
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({ viewport:{ width:1440, height:1100 } });
  const page = await context.newPage(); const errors=[];
  page.on('console', (m)=>{ if(m.type()==='error') errors.push(m.text()); }); page.on('pageerror', (e)=>errors.push(String(e?.message||e)));
  try {
    await loginAdmin(page); const desktop = await verify(page,'desktop');
    await page.locator('.dn-nexus-close').click(); await page.setViewportSize({ width:390, height:844 }); await page.reload({ waitUntil:'domcontentloaded', timeout:90000 });
    await page.locator('.dn-admin-fullscreen').waitFor({ state:'visible', timeout:60000 }); const mobile = await verify(page,'mobile-390x844');
    const relevantErrors = errors.filter((line)=>/nexus|phase 4|typeerror|referenceerror|rangeerror/i.test(line));
    assert(relevantErrors.length===0, `relevant browser errors: ${relevantErrors.join(' | ')}`);
    fs.writeFileSync(path.join(evidenceDir,'nexus-phase4-browser-report.json'), JSON.stringify({ status:'PASS', desktop, mobile, relevantErrors }, null, 2));
    console.log('NEXUS Phase 4 browser acceptance: PASS');
  } finally { await context.close(); await browser.close(); }
}
await main();