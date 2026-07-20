import { DAY_NIGHT_BUILD_ID } from "./buildInfo";

declare global {
  interface Window {
    __DAY_NIGHT_PWA_RUNTIME__?: boolean;
    __DAY_NIGHT_SW_REGISTRATION__?: ServiceWorkerRegistration;
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

function announceUpdate(registration: ServiceWorkerRegistration) {
  window.__DAY_NIGHT_SW_REGISTRATION__ = registration;
  window.dispatchEvent(
    new CustomEvent(DAY_NIGHT_PWA_UPDATE_EVENT, {
      detail: { registration, buildId: DAY_NIGHT_BUILD_ID },
    }),
  );
}

async function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || isNativeCapacitor()) return;

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
