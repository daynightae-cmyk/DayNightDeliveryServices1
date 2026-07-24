import { DAY_NIGHT_BUILD_ID } from "./buildInfo";

declare global {
  interface Window {
    __DAY_NIGHT_PWA_RUNTIME__?: boolean;
    __DAY_NIGHT_SW_REGISTRATION__?: ServiceWorkerRegistration;
    __DAY_NIGHT_NATIVE_ROLE__?: string;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

export const DAY_NIGHT_PWA_UPDATE_EVENT = "daynight:pwa-update";
const RELOAD_KEY = "dn_pwa_controller_reload";
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function isNativeCapacitor() {
  const bridge = window.Capacitor;
  if (!bridge) return false;
  if (typeof bridge.isNativePlatform === "function") return bridge.isNativePlatform();
  return Boolean(bridge.getPlatform?.());
}

function isNativeRoleShell() {
  const role = document.documentElement.dataset.nativeShell || window.__DAY_NIGHT_NATIVE_ROLE__;
  return role === "driver" || role === "merchant" || /DAYNIGHT\/\d+(?:\.\d+)*\s+(?:driver|merchant)/i.test(navigator.userAgent);
}

function isAdminRoute() {
  return window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
}

function isStandaloneDisplay() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

function platformClass() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(userAgent) || isIPadDesktopMode) return "dn-platform-ios";
  if (/android/.test(userAgent)) return "dn-platform-android";
  return "dn-platform-desktop";
}

function applyRuntimeClasses() {
  const root = document.documentElement;
  root.classList.add(platformClass());
  root.classList.toggle("dn-installed-web-app", isStandaloneDisplay());
  root.classList.toggle("dn-native-capacitor", isNativeCapacitor());
  root.dataset.dayNightBuild = DAY_NIGHT_BUILD_ID;
}

async function removeDayNightCaches() {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((registrations || []).map((registration) => registration.unregister()));
  } catch {
    // A missing or locked service-worker store must never block a live portal.
  }

  try {
    const keys = await window.caches?.keys?.();
    await Promise.all((keys || []).filter((key) => key.startsWith("day-night-")).map((key) => window.caches.delete(key)));
  } catch {
    // Cache cleanup is best-effort and never blocks the current application.
  }
}

function announceUpdate(registration: ServiceWorkerRegistration) {
  window.__DAY_NIGHT_SW_REGISTRATION__ = registration;
  window.dispatchEvent(
    new CustomEvent(DAY_NIGHT_PWA_UPDATE_EVENT, {
      detail: { registration, buildId: DAY_NIGHT_BUILD_ID },
    }),
  );
}

async function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || isNativeCapacitor() || isNativeRoleShell() || isAdminRoute()) return;

  try {
    const workerUrl = `/sw.js?v=${encodeURIComponent(DAY_NIGHT_BUILD_ID)}`;
    const registration = await navigator.serviceWorker.register(workerUrl, {
      scope: "/",
      updateViaCache: "none",
    });
    window.__DAY_NIGHT_SW_REGISTRATION__ = registration;

    if (registration.waiting) announceUpdate(registration);

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          announceUpdate(registration);
        }
      });
    });

    const checkForUpdate = () => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      void registration.update().catch(() => undefined);
    };

    window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    window.addEventListener("online", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);
  } catch {
    // PWA registration is progressive enhancement. The website remains fully usable.
  }
}

export function initializeDayNightPwaRuntime() {
  if (typeof window === "undefined" || window.__DAY_NIGHT_PWA_RUNTIME__) return;
  window.__DAY_NIGHT_PWA_RUNTIME__ = true;

  applyRuntimeClasses();

  // Administration must always run from the current deployed bundle. Removing
  // old PWA control here prevents a cached public router from rendering the
  // public NotFound screen for /admin employee navigation.
  if (isNativeRoleShell() || isAdminRoute()) {
    void removeDayNightCaches();
    return;
  }

  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", applyRuntimeClasses);

  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem(RELOAD_KEY) !== "1") return;
    sessionStorage.removeItem(RELOAD_KEY);
    window.location.reload();
  });

  if (document.readyState === "complete") void registerServiceWorker();
  else window.addEventListener("load", () => void registerServiceWorker(), { once: true });
}

export async function activateDayNightPwaUpdate() {
  const registration = window.__DAY_NIGHT_SW_REGISTRATION__;
  if (!registration) {
    window.location.reload();
    return;
  }

  if (!registration.waiting) {
    await registration.update().catch(() => undefined);
  }

  if (registration.waiting) {
    sessionStorage.setItem(RELOAD_KEY, "1");
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => window.location.reload(), 1800);
    return;
  }

  window.location.reload();
}

export {};
