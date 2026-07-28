import { DAY_NIGHT_BUILD_ID } from "./buildInfo";

declare global {
  interface Window {
    __DAY_NIGHT_DEPLOYMENT_WATCHER__?: boolean;
    __DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__?: Promise<boolean>;
    __DAY_NIGHT_SW_REGISTRATION__?: ServiceWorkerRegistration;
  }
}

const CHECK_INTERVAL_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 350;
const DEFERRED_RELOAD_LIMIT_MS = 120_000;
const PROTECTED_ROUTE_PATTERN = /^\/(admin|auth|driver|merchant|customer|update-password)(?:\/|$)/i;
const RECOVERY_QUERY_KEYS = ["__dn_live_reload", "__dn_cache_recovered", "__dn_entry", "__dn_portal_shell"];

type VersionPayload = {
  buildId?: string;
  builtAt?: string;
};

function isProtectedRoute() {
  return PROTECTED_ROUTE_PATTERN.test(window.location.pathname || "/");
}

function normalizeAssets(values: string[]) {
  return [...new Set(values)]
    .filter((value) => value.includes("/assets/"))
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
  const scripts = Array.from(documentValue.querySelectorAll<HTMLScriptElement>("script[src]")).map((item) => item.src);
  const links = Array.from(documentValue.querySelectorAll<HTMLLinkElement>("link[href]")).map((item) => item.href);
  return normalizeAssets([...scripts, ...links]);
}

async function fetchLatestVersion() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(`/version.json?__dn_update_check=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        "X-DAY-NIGHT-LIVE-CHECK": "1",
      },
    });

    if (!response.ok) throw new Error(`version_check_failed_${response.status}`);
    return (await response.json()) as VersionPayload;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchLatestAssets() {
  const response = await fetch(`/index.html?__dn_deployment_check=${Date.now()}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-DAY-NIGHT-LIVE-CHECK": "1",
    },
  });

  if (!response.ok) throw new Error(`deployment_check_failed_${response.status}`);

  const html = await response.text();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return assetsFromDocument(parsed);
}

function sameAssets(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasActiveEditor() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

async function dayNightCacheKeys() {
  try {
    const keys = await window.caches?.keys?.();
    return (keys || []).filter((key) => key.startsWith("day-night-"));
  } catch {
    return [] as string[];
  }
}

async function serviceWorkerRegistrations() {
  try {
    return (await navigator.serviceWorker?.getRegistrations?.()) || [];
  } catch {
    return [] as ServiceWorkerRegistration[];
  }
}

async function clearStaleProtectedRuntime() {
  const registrations = await serviceWorkerRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      await registration.unregister().catch(() => false);
    }),
  );

  const keys = await dayNightCacheKeys();
  await Promise.all(keys.map((key) => window.caches.delete(key).catch(() => false)));
}

function removeRecoveryQueryParameters() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of RECOVERY_QUERY_KEYS) {
    if (!url.searchParams.has(key)) continue;
    url.searchParams.delete(key);
    changed = true;
  }
  if (changed) window.history.replaceState(window.history.state, "", url);
}

async function prepareServiceWorkerForReload() {
  const registration = window.__DAY_NIGHT_SW_REGISTRATION__;
  if (!registration) return;
  await registration.update().catch(() => undefined);
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}

function reloadPublicPage(buildId: string) {
  const next = new URL(window.location.href);
  next.searchParams.set("__dn_live", buildId || Date.now().toString());
  window.location.replace(next.toString());
}

/**
 * Protected portals are deliberately mounted on the first navigation. An older
 * implementation forced an additional cache-busted navigation whenever any
 * public-site service worker existed, which made the admin launcher appear only
 * after a refresh. The current HTML is already delivered with no-store headers,
 * so protected routes only remove obsolete PWA state in the background and never
 * interrupt or reload the operator's screen.
 */
export async function ensureCurrentProtectedDeployment() {
  if (typeof window === "undefined" || !isProtectedRoute()) return true;
  if (window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__) {
    return window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__;
  }

  window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__ = (async () => {
    removeRecoveryQueryParameters();
    await clearStaleProtectedRuntime();
    return true;
  })();

  return window.__DAY_NIGHT_PROTECTED_DEPLOYMENT_PROMISE__;
}

function scheduleSafeReload(buildId: string) {
  let completed = false;
  const reload = async () => {
    if (completed) return;
    if (hasActiveEditor()) return;
    completed = true;
    await prepareServiceWorkerForReload();
    window.setTimeout(() => reloadPublicPage(buildId), 120);
  };

  if (!hasActiveEditor()) {
    void reload();
    return;
  }

  const onFocusOut = () => window.setTimeout(() => void reload(), 50);
  document.addEventListener("focusout", onFocusOut, { once: true });
  window.setTimeout(() => {
    if (completed) return;
    completed = true;
    void prepareServiceWorkerForReload().finally(() => reloadPublicPage(buildId));
  }, DEFERRED_RELOAD_LIMIT_MS);
}

export function initializeLiveDeploymentWatcher() {
  if (typeof window === "undefined" || window.__DAY_NIGHT_DEPLOYMENT_WATCHER__) return;
  window.__DAY_NIGHT_DEPLOYMENT_WATCHER__ = true;

  // Never reload an operational portal while an administrator, driver, merchant,
  // or customer is working. Root Vercel headers keep the next navigation fresh.
  if (isProtectedRoute()) return;

  let baselineAssets = assetsFromDocument(document);
  let checking = false;
  let updateScheduled = false;

  const check = async () => {
    if (checking || updateScheduled || !navigator.onLine || document.visibilityState === "hidden") return;
    checking = true;

    try {
      const latestVersion = await fetchLatestVersion();
      const latestBuildId = String(latestVersion.buildId || "").trim();
      if (latestBuildId && latestBuildId !== DAY_NIGHT_BUILD_ID) {
        updateScheduled = true;
        scheduleSafeReload(latestBuildId);
        return;
      }

      const latestAssets = await fetchLatestAssets();
      if (latestAssets.length > 0 && baselineAssets.length > 0 && !sameAssets(baselineAssets, latestAssets)) {
        baselineAssets = latestAssets;
        updateScheduled = true;
        scheduleSafeReload(latestBuildId || Date.now().toString());
      }
    } catch {
      // Keep the current working screen. The next scheduled check retries.
    } finally {
      checking = false;
    }
  };

  window.setTimeout(() => void check(), FIRST_CHECK_DELAY_MS);
  window.setInterval(() => void check(), CHECK_INTERVAL_MS);
  window.addEventListener("focus", () => void check());
  window.addEventListener("online", () => void check());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void check();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
}

export {};
