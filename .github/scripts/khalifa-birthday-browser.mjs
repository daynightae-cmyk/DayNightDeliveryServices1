import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(`${process.env.PLAYWRIGHT_NODE_PATH}/package.json`);
const { chromium } = require('playwright');
const out = 'khalifa-browser-evidence';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const report = { sha: process.env.GITHUB_HEAD_SHA, checks: [], admin: 'BLOCKED: authenticated operations not exercised', errors: [] };
async function context(width=1440, reduced='no-preference', storage=false) {
 const c = await browser.newContext({ viewport: { width, height: width===390 ? 844 : width===768 ? 1024 : 900 }, reducedMotion: reduced, locale: 'ar-AE' });
 if(storage) await c.addInitScript(() => { Object.defineProperty(window,'sessionStorage',{get(){throw new Error('storage blocked for test');}}); });
 const p=await c.newPage(); p.on('pageerror', e=>report.errors.push(e.message));
 return [c,p];
}
try {
 for(const width of [1440,768,390]) {
  const [c,p]=await context(width);
  await p.goto(`${base}/?lang=ar`,{waitUntil:'domcontentloaded'});
  await p.locator('[data-kb-phase="intro"]').waitFor();
  const start=Date.now();
  assert.equal(await p.locator('.kb-root').count(),1);
  const marks=[[900,'opening'],[2200,'story'],[4600,'formation'],[6000,'name'],[8500,'wish'],[12000,'exit'],[13000,'ambient']];
  for(const [at,name] of marks) {
   const remaining=at-(Date.now()-start); if(remaining>0) await p.waitForTimeout(remaining);
   await p.screenshot({path:`${out}/${width}-${name}.png`});
  }
  assert.equal(await p.locator('.kb-root').getAttribute('data-kb-phase'),'ambient');
  assert.equal(await p.locator('canvas.kb-particle-title').count(),0);
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('daynight_khalifa_birthday_seen')),'1');
  await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('[data-kb-phase="ambient"]').waitFor();
  assert.equal(await p.locator('.kb-intro').count(),0);
  await p.getByRole('button',{name:'إعادة عرض احتفال عيد ميلاد خليفة'}).click();
  await p.locator('[data-kb-phase="intro"]').waitFor();
  await p.keyboard.press('Escape');
  await p.locator('[data-kb-phase="ambient"]').waitFor();
  await p.getByRole('button',{name:'إعادة عرض احتفال عيد ميلاد خليفة'}).click();
  await p.getByRole('button',{name:'متابعة للموقع'}).click();
  await p.locator('[data-kb-phase="ambient"]').waitFor();
  await p.goto(`${base}/tracking?lang=ar`,{waitUntil:'domcontentloaded'});
  await p.locator('[data-kb-mode="quiet"]').waitFor();
  const input=p.locator('input:visible').first();
  await input.fill('DN-BIRTHDAY-READONLY'); assert.equal(await input.inputValue(),'DN-BIRTHDAY-READONLY');
  await p.screenshot({path:`${out}/${width}-tracking.png`});
  await p.goto(`${base}/auth?lang=ar`,{waitUntil:'domcontentloaded'});
  await p.locator('[data-kb-mode="minimal"]').waitFor();
  await p.screenshot({path:`${out}/${width}-auth.png`});
  assert.equal(await p.locator('.kb-root').count(),1);
  report.checks.push({width,autostart:true,ambient:true,refresh:true,replay:true,escape:true,skip:true,trackingInput:true,authAmbient:true});
  await c.close();
 }
 for(const route of ['/tracking','/auth','/admin']) {
  const [c,p]=await context();
  await p.goto(`${base}${route}?lang=ar`,{waitUntil:'domcontentloaded'});
  await p.locator('[data-kb-phase="intro"]').waitFor();
  await p.getByRole('button',{name:'متابعة للموقع'}).click();
  await p.locator('[data-kb-phase="ambient"]').waitFor();
  report.checks.push({freshDirectEntry:route,autostart:true}); await c.close();
 }
 const [rc,rp]=await context(390,'reduce');
 await rp.goto(base,{waitUntil:'domcontentloaded'});
 await rp.locator('[data-kb-phase="intro"]').waitFor();
 assert.equal(await rp.locator('canvas,.kb-bursts').count(),0);
 await rp.waitForTimeout(2200); await rp.screenshot({path:`${out}/390-reduced-name.png`});
 await rp.locator('[data-kb-phase="ambient"]').waitFor({timeout:6500});
 report.checks.push({reducedMotion:true}); await rc.close();
 const [sc,sp]=await context(390,'no-preference',true);
 await sp.goto(base,{waitUntil:'domcontentloaded'}); await sp.locator('[data-kb-phase="intro"]').waitFor();
 await sp.getByRole('button',{name:'متابعة للموقع'}).click(); await sp.locator('[data-kb-phase="ambient"]').waitFor();
 report.checks.push({storageFailure:true}); await sc.close();
 assert.deepEqual(report.errors,[]);
 report.result='VERIFIED runtime checks; visual acceptance requires screenshot review';
} catch(e) { report.result='FAILED';report.failure=e.stack;throw e; }
finally { await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close(); }
