import { DAY_NIGHT_BUILD_ID } from "./buildInfo";

declare global {
  interface Window {
    __DAY_NIGHT_DEPLOYMENT_WATCHER__?: boolean;
  }
}

const CHECK_INTERVAL_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 8_000;
const DEFERRED_RELOAD_LIMIT_MS = 120_000;

type VersionPayload = {
  buildId?: string;
  builtAt?: string;
};

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
  const response = await fetch(`/version.json?__dn_update_check=${Date.now()}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-DAY-NIGHT-LIVE-CHECK": "1",
    },
  });

  if (!response.ok) throw new Error(`version_check_failed_${response.status}`);
  return (await response.json()) as VersionPayload;
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

async function prepareServiceWorkerForReload() {
  const registration = window.__DAY_NIGHT_SW_REGISTRATION__;
  if (!registration) return;

  await registration.update().catch(() => undefined);
  if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

function reloadWithCacheBust(buildId: string) {
  const next = new URL(window.location.href);
  next.searchParams.set("__dn_live_reload", buildId || Date.now().toString());
  window.location.replace(next.toString());
}

function scheduleSafeReload(buildId: string) {
  let completed = false;
  const reload = async () => {
    if (completed) return;
    if (hasActiveEditor()) return;
    completed = true;
    await prepareServiceWorkerForReload();
    window.setTimeout(() => reloadWithCacheBust(buildId), 250);
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
    void prepareServiceWorkerForReload().finally(() => reloadWithCacheBust(buildId));
  }, DEFERRED_RELOAD_LIMIT_MS);
}

export function initializeLiveDeploymentWatcher() {
  if (typeof window === "undefined" || window.__DAY_NIGHT_DEPLOYMENT_WATCHER__) return;
  window.__DAY_NIGHT_DEPLOYMENT_WATCHER__ = true;

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
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
}

export {};
