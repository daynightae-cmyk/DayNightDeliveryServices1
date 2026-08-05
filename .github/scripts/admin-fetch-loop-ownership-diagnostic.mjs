import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.PLAYWRIGHT_NODE_PATH}/playwright`);
const { createClient } = require(
  path.resolve(process.cwd(), 'artifacts/day-night-delivery/node_modules/@supabase/supabase-js'),
);

const base = String(process.env.TEST_BASE_URL || '').replace(/\/$/, '');
const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '');
const adminEmail = String(process.env.RUNTIME_ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.RUNTIME_ADMIN_PASSWORD || '').trim();
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;
const evidenceDirectory = 'preview-browser-evidence';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    adapter: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
}

async function adminSession() {
  const memory = memoryStorage();
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storage: memory.adapter,
      storageKey,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (error) throw error;
  assert(data?.session?.access_token, 'fetch_diagnostic_admin_session_missing');
  const serialized = memory.values.get(storageKey);
  assert(typeof serialized === 'string', 'fetch_diagnostic_serialized_session_missing');
  return { client, serialized };
}

async function readSerializableOwnership(page) {
  return page.evaluate(() => {
    const source = window.__dnFetchOwnership || {};
    return {
      startedAt: Number(source.startedAt || 0),
      calls: Array.isArray(source.calls)
        ? source.calls.map((call) => ({
            at: Number(call?.at || 0),
            method: String(call?.method || ''),
            url: String(call?.url || ''),
            stack: String(call?.stack || ''),
          }))
        : [],
      totals: { ...(source.totals || {}) },
      fullscreenAdds: Number(source.fullscreenAdds || 0),
      fullscreenRemoves: Number(source.fullscreenRemoves || 0),
      formAdds: Number(source.formAdds || 0),
      formRemoves: Number(source.formRemoves || 0),
      liveFullscreenCount: document.querySelectorAll('.dn-admin-fullscreen').length,
      liveFormCount: document.querySelectorAll('[data-admin-new-order-form="merchant"]').length,
    };
  });
}

fs.mkdirSync(evidenceDirectory, { recursive: true });
const auth = await adminSession();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ar-AE' });
await context.addInitScript(
  ({ authKey, authValue, observedSupabaseUrl }) => {
    window.localStorage.setItem(authKey, authValue);
    window.__dnFetchOwnership = {
      startedAt: performance.now(),
      calls: [],
      totals: {},
      fullscreenAdds: 0,
      fullscreenRemoves: 0,
      formAdds: 0,
      formRemoves: 0,
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '');
      if (url.startsWith(observedSupabaseUrl)) {
        const method = String(
          args[1]?.method || (input instanceof Request ? input.method : 'GET') || 'GET',
        ).toUpperCase();
        const pathname = (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url;
          }
        })();
        const key = `${method} ${pathname}`;
        window.__dnFetchOwnership.totals[key] =
          Number(window.__dnFetchOwnership.totals[key] || 0) + 1;
        if (window.__dnFetchOwnership.calls.length < 160) {
          window.__dnFetchOwnership.calls.push({
            at: performance.now(),
            method,
            url,
            stack: new Error('fetch-owner').stack || '',
          });
        }
      }
      return originalFetch(...args);
    };

    const classify = (node, added) => {
      if (!(node instanceof Element)) return;
      const fullscreens = [
        ...(node.matches('.dn-admin-fullscreen') ? [node] : []),
        ...node.querySelectorAll('.dn-admin-fullscreen'),
      ];
      const forms = [
        ...(node.matches('[data-admin-new-order-form="merchant"]') ? [node] : []),
        ...node.querySelectorAll('[data-admin-new-order-form="merchant"]'),
      ];
      if (added) {
        window.__dnFetchOwnership.fullscreenAdds += fullscreens.length;
        window.__dnFetchOwnership.formAdds += forms.length;
      } else {
        window.__dnFetchOwnership.fullscreenRemoves += fullscreens.length;
        window.__dnFetchOwnership.formRemoves += forms.length;
      }
    };

    document.addEventListener('DOMContentLoaded', () => {
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) classify(node, true);
          for (const node of record.removedNodes) classify(node, false);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.__dnFetchOwnership.observer = observer;
    });
  },
  {
    authKey: storageKey,
    authValue: auth.serialized,
    observedSupabaseUrl: supabaseUrl,
  },
);

const page = await context.newPage();
try {
  await page.goto(`${base}/admin?nosplash=1&lang=ar&__dn_acceptance=fetch_ownership`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.locator('.dncc-shell').waitFor({ state: 'visible', timeout: 90000 });
  const controls = page.locator('[data-dn-command-section="new_order"]');
  for (let index = 0; index < (await controls.count()); index += 1) {
    if (await controls.nth(index).isVisible().catch(() => false)) {
      await controls.nth(index).click();
      break;
    }
  }
  await page
    .locator('[data-admin-new-order-form="merchant"]')
    .waitFor({ state: 'visible', timeout: 90000 });

  const baseline = await readSerializableOwnership(page);
  await page.waitForTimeout(12000);
  const afterIdle = await readSerializableOwnership(page);

  fs.writeFileSync(
    `${evidenceDirectory}/admin-fetch-loop-ownership.json`,
    JSON.stringify(
      {
        commit: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || '',
        browser: await page.evaluate(() => navigator.userAgent),
        baseline,
        afterIdle,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: `${evidenceDirectory}/admin-fetch-loop-ownership.png`,
    fullPage: true,
  });
} finally {
  await context.close();
  await auth.client.auth.signOut({ scope: 'local' }).catch(() => {});
  await browser.close();
}
