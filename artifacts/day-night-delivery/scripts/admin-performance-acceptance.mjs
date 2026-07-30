import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const runnerDir = String(process.env.PLAYWRIGHT_RUNNER_DIR || '').trim();
if (!runnerDir) throw new Error('PLAYWRIGHT_RUNNER_DIR is required.');
const require = createRequire(path.join(runnerDir, 'package.json'));
const { chromium } = require('playwright');

const OUTPUT_DIR = path.resolve(
  process.env.ADMIN_PERFORMANCE_OUTPUT_DIR ||
    'artifacts/day-night-delivery/admin-performance-evidence',
);
const BASE_URL = String(
  process.env.ADMIN_PERFORMANCE_BASE_URL || 'https://daynightae.com',
).replace(/\/$/, '');
const INP_BUDGET_MS = 200;
const MAX_ACTION_MS = 300;
const MAX_LONG_TASK_MS = 200;

for (const name of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'RUNTIME_ADMIN_EMAIL',
  'RUNTIME_ADMIN_PASSWORD',
]) {
  if (!String(process.env[name] || '').trim()) {
    throw new Error(`Missing protected environment value: ${name}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(Number(value || 0) * 10) / 10;

function percentile(values, target) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((target / 100) * sorted.length) - 1)];
}

function sanitizeUrl(value) {
  try {
    const url = new URL(String(value));
    return `${url.origin}${url.pathname
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]')
      .replace(/\b\d{5,}\b/g, '[number]')}`;
  } catch {
    return '[unavailable]';
  }
}

async function authenticateAdmin() {
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL).replace(/\/$/, '');
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: String(process.env.VITE_SUPABASE_ANON_KEY),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: process.env.RUNTIME_ADMIN_EMAIL,
      password: process.env.RUNTIME_ADMIN_PASSWORD,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token || !payload?.user?.id) {
    throw new Error(`Protected admin authentication failed with HTTP ${response.status}.`);
  }
  return payload;
}

function initPerformanceState({ storageKey, session }) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(session));
  } catch {
    // The script runs again after the production origin is available.
  }

  window.__dnPerformanceAcceptance = {
    eventEntries: {},
    appSamples: [],
    longTasks: [],
    scenarios: [],
    errors: [],
  };

  window.addEventListener('dn-admin-inp-sample', (event) => {
    const detail = event?.detail || {};
    window.__dnPerformanceAcceptance.appSamples.push({
      duration: Number(detail.duration || 0),
      budget: Number(detail.budget || 0),
      overBudget: Boolean(detail.overBudget),
      target: String(detail.target || 'unknown').slice(0, 180),
      measuredAt: String(detail.measuredAt || new Date().toISOString()),
    });
  });

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const interactionId = Number(entry.interactionId || 0);
        if (!interactionId) continue;
        const previous = Number(window.__dnPerformanceAcceptance.eventEntries[interactionId] || 0);
        window.__dnPerformanceAcceptance.eventEntries[interactionId] = Math.max(
          previous,
          Number(entry.duration || 0),
        );
      }
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch {
    window.__dnPerformanceAcceptance.errors.push('event-observer-unavailable');
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__dnPerformanceAcceptance.longTasks.push({
          startTime: Number(entry.startTime || 0),
          duration: Number(entry.duration || 0),
          name: String(entry.name || 'longtask'),
        });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    window.__dnPerformanceAcceptance.errors.push('longtask-observer-unavailable');
  }
}

async function readTrace(cdp, handle) {
  const chunks = [];
  while (true) {
    const result = await cdp.send('IO.read', { handle, size: 1024 * 1024 });
    chunks.push(
      result.base64Encoded
        ? Buffer.from(result.data, 'base64')
        : Buffer.from(result.data || '', 'utf8'),
    );
    if (result.eof) break;
  }
  await cdp.send('IO.close', { handle });
  return Buffer.concat(chunks);
}

async function clickSection(page, profile, labels) {
  if (profile.mobile) {
    const opener = page.locator('.dn-admin-mobile-open');
    await opener.waitFor({ state: 'visible' });
    await opener.click();
    await page.locator('.dn-admin-sidebar-full.is-open').waitFor({ state: 'visible' });
  }
  const nav = page.locator('.dn-admin-side-nav button');
  const target = nav.filter({ hasText: labels }).first();
  await target.waitFor({ state: 'visible' });
  await target.click();
}

async function scenario(page, name, action) {
  const startedAt = Date.now();
  await page.evaluate((scenarioName) => {
    window.__dnPerformanceAcceptance.scenarios.push({
      name: scenarioName,
      status: 'started',
      startedAt: performance.now(),
    });
  }, name);

  try {
    await action();
    await page.evaluate((scenarioName) => {
      const item = [...window.__dnPerformanceAcceptance.scenarios]
        .reverse()
        .find((entry) => entry.name === scenarioName && entry.status === 'started');
      if (item) {
        item.status = 'completed';
        item.finishedAt = performance.now();
      }
    }, name);
    return { name, status: 'completed', wallTimeMs: Date.now() - startedAt };
  } catch (error) {
    await page.evaluate(({ scenarioName, message }) => {
      const item = [...window.__dnPerformanceAcceptance.scenarios]
        .reverse()
        .find((entry) => entry.name === scenarioName && entry.status === 'started');
      if (item) {
        item.status = 'failed';
        item.finishedAt = performance.now();
        item.error = message;
      }
    }, { scenarioName: name, message: String(error?.message || error) });
    throw new Error(`${name}: ${error?.message || error}`);
  }
}

async function redactAndCapture(page, destination) {
  await page.addStyleTag({
    content: `
      table tbody td,
      [class*="order-card"] p,
      [class*="order-card"] small,
      [class*="customer"]:not(button):not([role="button"]),
      [class*="phone"]:not(button),
      [class*="email"]:not(button) {
        color: transparent !important;
        text-shadow: 0 0 9px rgba(255,255,255,.65) !important;
      }
    `,
  });
  await page.screenshot({ path: destination, fullPage: false });
}

async function runProfile(profile, session, storageKey) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    screen: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    userAgent: profile.mobile
      ? 'Mozilla/5.0 (Linux; Android 14; DAY NIGHT Performance Device) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36'
      : undefined,
    locale: 'en-AE',
    timezoneId: 'Asia/Dubai',
  });
  await context.addInitScript(initPerformanceState, { storageKey, session });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${BASE_URL}/admin?nosplash=1&performanceAcceptance=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible', timeout: 45000 });
    await page.locator('.dn-admin-loading-banner').waitFor({ state: 'hidden', timeout: 45000 });
    await sleep(1200);

    await page.evaluate(() => {
      window.__dnPerformanceAcceptance.eventEntries = {};
      window.__dnPerformanceAcceptance.appSamples = [];
      window.__dnPerformanceAcceptance.longTasks = [];
      window.__dnPerformanceAcceptance.scenarios = [];
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
    await cdp.send('Tracing.start', {
      categories: [
        'devtools.timeline',
        'blink.user_timing',
        'loading',
        'latencyInfo',
        'disabled-by-default-devtools.timeline',
      ].join(','),
      options: 'record-as-much-as-possible',
      transferMode: 'ReturnAsStream',
    });

    const scenarios = [];

    scenarios.push(await scenario(page, 'open-abu-khalifa-executive-card', async () => {
      const launcher = page.locator('[data-testid="abu-khalifa-executive-launcher"]');
      await launcher.click();
      await page.locator('.abu-khalifa-flyout[role="dialog"]').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('.abu-khalifa-flyout[role="dialog"]').waitFor({ state: 'hidden' });
    }));

    if (profile.mobile) {
      scenarios.push(await scenario(page, 'expand-admin-sidebar', async () => {
        await page.locator('.dn-admin-mobile-open').click();
        await page.locator('.dn-admin-sidebar-full.is-open').waitFor({ state: 'visible' });
        await page.locator('.dn-admin-mobile-shade').click();
      }));
    }

    scenarios.push(await scenario(page, 'open-new-order-and-move-across-fields', async () => {
      await clickSection(page, profile, /إضافة\s*طلب\s*جديد|New\s*Order/i);
      const fields = page.locator(
        '.dn-admin-center-zone input:not([disabled]), .dn-admin-center-zone select:not([disabled]), .dn-admin-center-zone textarea:not([disabled])',
      );
      await fields.first().waitFor({ state: 'visible' });
      await fields.first().click();
      for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
    }));

    scenarios.push(await scenario(page, 'edit-and-restore-numeric-price-or-salary', async () => {
      const numeric = page.locator([
        '.dn-admin-center-zone input[type="number"]:visible',
        '.dn-admin-center-zone input[inputmode="decimal"]:visible',
        '.dn-admin-center-zone input[inputmode="numeric"]:visible',
      ].join(', ')).first();
      await numeric.waitFor({ state: 'visible' });
      const original = await numeric.inputValue();
      await numeric.fill(original === '37' ? '38' : '37');
      await sleep(250);
      await numeric.fill(original);
      await sleep(250);
    }));

    scenarios.push(await scenario(page, 'open-finance-center-and-change-tabs', async () => {
      await clickSection(page, profile, /لوحة\s*المالية|Finance\s*Dashboard/i);
      const finance = page.locator('.dn-admin-center-zone');
      await finance.getByText(/الملخص\s*المالي|Finance\s*summary/i).first().waitFor();
      await finance.getByRole('button', { name: /كشوفات\s*التجار|Merchant\s*statements/i }).first().click();
      await finance.getByRole('button', { name: /كشوفات\s*المناديب|Driver\s*statements/i }).first().click();
      await finance.getByRole('button', { name: /الملخص\s*المالي|Finance\s*summary/i }).first().click();
    }));

    scenarios.push(await scenario(page, 'select-order-and-open-details', async () => {
      await clickSection(page, profile, /كافة\s*الطلبات|All\s*Orders/i);
      const workspace = page.locator('.dn-admin-center-zone');
      await workspace.waitFor({ state: 'visible' });
      const labelled = workspace.getByRole('button', { name: /تفاصيل|عرض|Details|View/i }).first();
      if (await labelled.count()) {
        await labelled.click();
        return;
      }
      const fallback = workspace.locator(
        'tbody tr button:not([disabled]), [class*="order-card"] button:not([disabled]), article button:not([disabled])',
      ).filter({ hasNotText: /حذف|إلغاء|Delete|Cancel/i }).first();
      await fallback.waitFor({ state: 'visible' });
      await fallback.click();
    }));

    const traceComplete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await traceComplete;
    const trace = await readTrace(cdp, stream);
    const traceName = `${profile.id}.trace.json`;
    await writeFile(path.join(OUTPUT_DIR, traceName), trace);

    const screenshotName = `${profile.id}.redacted.png`;
    await redactAndCapture(page, path.join(OUTPUT_DIR, screenshotName));

    const evidence = await page.evaluate(() => {
      const state = window.__dnPerformanceAcceptance || {};
      return {
        eventDurations: Object.values(state.eventEntries || {}),
        appSamples: state.appSamples || [],
        longTasks: state.longTasks || [],
        browserScenarios: state.scenarios || [],
        observerErrors: state.errors || [],
        resources: performance.getEntriesByType('resource').map((entry) => ({
          name: entry.name,
          duration: entry.duration,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize || 0,
        })),
        viewport: {
          width: innerWidth,
          height: innerHeight,
          devicePixelRatio,
        },
      };
    });

    const durations = evidence.eventDurations
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);
    const p75 = round(percentile(durations, 75));
    const worst = round(Math.max(0, ...durations));
    const longTasks = evidence.longTasks.filter(
      (entry) => Number(entry.duration) > MAX_LONG_TASK_MS,
    );
    const resources = evidence.resources.map((entry) => ({
      ...entry,
      name: sanitizeUrl(entry.name),
      duration: round(entry.duration),
      transferSize: Number(entry.transferSize || 0),
    }));

    const acceptance = {
      hasInteractionSamples: durations.length > 0,
      p75UnderBudget: durations.length > 0 && p75 < INP_BUDGET_MS,
      worstCoreActionUnderLimit: durations.length > 0 && worst <= MAX_ACTION_MS,
      noLongTaskOver200Ms: longTasks.length === 0,
      allScenariosCompleted: scenarios.every((item) => item.status === 'completed'),
    };
    acceptance.ok = Object.values(acceptance).every(Boolean);

    return {
      profile: profile.id,
      description: profile.description,
      measuredAt: new Date().toISOString(),
      target: `${BASE_URL}/admin`,
      emulation: {
        width: profile.width,
        height: profile.height,
        mobile: profile.mobile,
        deviceScaleFactor: profile.deviceScaleFactor,
        cpuThrottlingRate: profile.cpuRate,
        networkThrottling: 'none; resource latency reported separately',
      },
      metrics: {
        interactionCount: durations.length,
        p75InpMs: p75,
        worstInteractionMs: worst,
        appWorstSamples: evidence.appSamples,
        longTasksOver200Ms: longTasks,
      },
      scenarios,
      browserScenarios: evidence.browserScenarios,
      observerErrors: evidence.observerErrors,
      network: {
        resourceCount: resources.length,
        slowestResources: [...resources]
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 15),
      },
      trace: traceName,
      screenshot: screenshotName,
      acceptance,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function markdownReport(results) {
  const lines = [
    '# DAY NIGHT Admin Performance Acceptance',
    '',
    `- Production target: \`${BASE_URL}/admin\``,
    `- p75 INP budget: \`< ${INP_BUDGET_MS}ms\``,
    `- Individual action ceiling: \`<= ${MAX_ACTION_MS}ms\``,
    '- Network throttling: none; resource latency is reported separately.',
    '- Production screenshots are redacted before capture.',
    '',
    '| Profile | Samples | p75 INP | Worst | Long tasks >200ms | Result |',
    '|---|---:|---:|---:|---:|---|',
  ];
  for (const result of results) {
    lines.push(
      `| ${result.profile} | ${result.metrics.interactionCount} | ${result.metrics.p75InpMs}ms | ${result.metrics.worstInteractionMs}ms | ${result.metrics.longTasksOver200Ms.length} | ${result.acceptance.ok ? 'PASS' : 'FAIL'} |`,
    );
  }
  lines.push('', '## Scenarios');
  for (const result of results) {
    lines.push('', `### ${result.profile}`);
    for (const item of result.scenarios) {
      lines.push(`- ${item.status === 'completed' ? 'PASS' : 'FAIL'} — ${item.name} (${item.wallTimeMs}ms wall time)`);
    }
  }
  lines.push(
    '',
    '## Privacy boundary',
    '',
    '- No passwords, access tokens, refresh tokens, API keys, raw provider payloads, or customer PII are written to the summary.',
    '- Screenshots blur production table/customer values.',
    '',
  );
  return lines.join('\n');
}

await mkdir(OUTPUT_DIR, { recursive: true });
const session = await authenticateAdmin();
const projectRef = new URL(String(process.env.VITE_SUPABASE_URL)).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;
const profiles = [
  {
    id: 'desktop-1366x768',
    description: 'Production desktop acceptance at 1366×768',
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
    cpuRate: 1,
  },
  {
    id: 'android-midrange-412x915',
    description: 'Mid-range Android profile with 4× CPU slowdown',
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    mobile: true,
    cpuRate: 4,
  },
];

const results = [];
for (const profile of profiles) {
  console.log(`Running protected admin performance profile: ${profile.id}`);
  results.push(await runProfile(profile, session, storageKey));
}

const report = {
  generatedAt: new Date().toISOString(),
  issue: 268,
  budget: {
    p75InpMs: INP_BUDGET_MS,
    individualActionMs: MAX_ACTION_MS,
    longTaskMs: MAX_LONG_TASK_MS,
  },
  results,
  ok: results.every((result) => result.acceptance.ok),
};

await writeFile(
  path.join(OUTPUT_DIR, 'admin-performance-results.json'),
  JSON.stringify(report, null, 2),
);
await writeFile(
  path.join(OUTPUT_DIR, 'admin-performance-summary.md'),
  markdownReport(results),
);
console.log(markdownReport(results));
if (!report.ok) process.exitCode = 1;
