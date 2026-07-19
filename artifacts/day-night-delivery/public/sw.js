const VERSION = "2026.07.19-final-production";
const APP_SHELL_CACHE = `day-night-shell-${VERSION}`;
const RUNTIME_CACHE = `day-night-runtime-${VERSION}`;
const IMAGE_CACHE = `day-night-images-${VERSION}`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/logo-daynight.png",
  "/assets/daynight/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("day-night-") && ![APP_SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "CLEAR_DAY_NIGHT_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("day-night-")).map((key) => caches.delete(key)))),
    );
  }
});

function shouldBypass(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname === "/sw.js") return true;
  if (url.searchParams.has("__dn_deployment_check")) return true;
  if (url.searchParams.has("__dn_update_check")) return true;
  if (url.searchParams.has("__dn_live_reload")) return true;
  if (url.searchParams.has("__dn_live")) return true;
  if (request.cache === "no-store") return true;
  return false;
}

async function fetchWithTimeout(request, timeoutMs = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new Request(request, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("/index.html")) ||
      (await caches.match("/offline.html")) ||
      Response.error()
    );
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (shouldBypass(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/assets/") || ["script", "style", "font", "worker"].includes(request.destination)) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
