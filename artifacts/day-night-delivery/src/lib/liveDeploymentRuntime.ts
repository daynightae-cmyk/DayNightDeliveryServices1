declare global {
  interface Window {
    __DAY_NIGHT_DEPLOYMENT_WATCHER__?: boolean;
  }
}

const CHECK_INTERVAL_MS = 120_000;
const FIRST_CHECK_DELAY_MS = 15_000;

function normalizeAssets(values: string[]) {
  return [...new Set(values)]
    .filter((value) => value.includes('/assets/'))
    .map((value) => {
      try {
        return new URL(value, window.location.origin).pathname;
      } catch {
        return value;
      }
    })
    .sort();
}

function assetsFromDocument(documentValue: Document) {
  const scripts = Array.from(documentValue.querySelectorAll<HTMLScriptElement>('script[src]')).map((item) => item.src);
  const links = Array.from(documentValue.querySelectorAll<HTMLLinkElement>('link[href]')).map((item) => item.href);
  return normalizeAssets([...scripts, ...links]);
}

async function fetchLatestAssets() {
  const response = await fetch(`/index.html?__dn_deployment_check=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      'X-DAY-NIGHT-LIVE-CHECK': '1',
    },
  });

  if (!response.ok) throw new Error(`deployment_check_failed_${response.status}`);

  const html = await response.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return assetsFromDocument(parsed);
}

function sameAssets(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function reloadWithCacheBust() {
  const next = new URL(window.location.href);
  next.searchParams.set('__dn_live_reload', Date.now().toString());
  window.location.replace(next.toString());
}

export function initializeLiveDeploymentWatcher() {
  if (typeof window === 'undefined' || window.__DAY_NIGHT_DEPLOYMENT_WATCHER__) return;
  window.__DAY_NIGHT_DEPLOYMENT_WATCHER__ = true;

  let baseline = assetsFromDocument(document);
  let checking = false;

  const check = async () => {
    if (checking || !navigator.onLine || document.visibilityState === 'hidden') return;
    checking = true;

    try {
      const latest = await fetchLatestAssets();
      if (latest.length > 0 && baseline.length > 0 && !sameAssets(baseline, latest)) {
        baseline = latest;
        reloadWithCacheBust();
      }
    } catch {
      // Keep the current working screen. The next scheduled check retries.
    } finally {
      checking = false;
    }
  };

  window.setTimeout(() => void check(), FIRST_CHECK_DELAY_MS);
  window.setInterval(() => void check(), CHECK_INTERVAL_MS);
  window.addEventListener('focus', () => void check());
  window.addEventListener('online', () => void check());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}

export {};
