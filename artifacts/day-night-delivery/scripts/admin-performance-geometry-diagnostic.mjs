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

function initSession({ storageKey, session }) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

function safeClassName(element) {
  if (!element) return null;
  return String(element.className || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

function captureGeometry(selector) {
  const element = document.querySelector(selector);
  if (!element) return { found: false, selector };

  const serialize = (node, depth) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      depth,
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      className: safeClassName(node),
      rect: {
        x: Math.round(rect.x * 10) / 10,
        y: Math.round(rect.y * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        bottom: Math.round(rect.bottom * 10) / 10,
        left: Math.round(rect.left * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      },
      style: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        zIndex: style.zIndex,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        transform: style.transform,
        translate: style.translate,
        contain: style.contain,
        contentVisibility: style.contentVisibility,
        direction: style.direction,
      },
      dimensions: {
        clientWidth: node.clientWidth,
        clientHeight: node.clientHeight,
        scrollWidth: node.scrollWidth,
        scrollHeight: node.scrollHeight,
        scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop,
      },
    };
  };

  const ancestors = [];
  let current = element;
  let depth = 0;
  while (current && depth < 12) {
    ancestors.push(serialize(current, depth));
    current = current.parentElement;
    depth += 1;
  }

  const rect = element.getBoundingClientRect();
  const centerX = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
  const centerY = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
  const stackAtClampedCenter = document
    .elementsFromPoint(centerX, centerY)
    .slice(0, 8)
    .map((node) => ({
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      className: safeClassName(node),
    }));

  return {
    found: true,
    selector,
    viewport: {
      innerWidth,
      innerHeight,
      visualViewport: window.visualViewport
        ? {
            width: window.visualViewport.width,
            height: window.visualViewport.height,
            offsetLeft: window.visualViewport.offsetLeft,
            offsetTop: window.visualViewport.offsetTop,
            scale: window.visualViewport.scale,
          }
        : null,
      scrollX,
      scrollY,
      documentClientWidth: document.documentElement.clientWidth,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      bodyScrollWidth: document.body.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
    },
    insideViewport: {
      horizontally: rect.left >= 0 && rect.right <= innerWidth,
      vertically: rect.top >= 0 && rect.bottom <= innerHeight,
      intersects:
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < innerWidth &&
        rect.top < innerHeight,
    },
    ancestors,
    stackAtClampedCenter,
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const session = await authenticateAdmin();
const projectRef = new URL(String(process.env.VITE_SUPABASE_URL)).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  screen: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
  locale: 'en-AE',
  timezoneId: 'Asia/Dubai',
});
await context.addInitScript(initSession, { storageKey, session });
const page = await context.newPage();
page.setDefaultTimeout(45000);

try {
  await page.goto(`${BASE_URL}/admin?nosplash=1&performanceAcceptance=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('.dn-admin-fullscreen').waitFor({ state: 'visible' });
  await page.locator('.dn-admin-loading-banner').waitFor({ state: 'hidden' });
  await page.waitForTimeout(1200);

  const selector = '[data-testid="abu-khalifa-executive-launcher"]';
  const before = await page.evaluate(captureGeometry, selector);
  await page.locator(selector).evaluate((node) => {
    node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(captureGeometry, selector);

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
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'desktop-1366x768.geometry.redacted.png'),
    fullPage: false,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    target: `${BASE_URL}/admin`,
    profile: 'desktop-1366x768',
    beforeScrollIntoView: before,
    afterScrollIntoView: after,
  };
  const destination = path.join(OUTPUT_DIR, 'admin-performance-geometry.json');
  await writeFile(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
}
