type NativeListenerHandle = { remove?: () => Promise<void> | void };
type NativePlugin = Record<string, (...args: any[]) => any> & {
  addListener?: (eventName: string, listener: (...args: any[]) => void) => Promise<NativeListenerHandle> | NativeListenerHandle;
};

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, NativePlugin | undefined>;
};

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
    __DAY_NIGHT_NATIVE_RUNTIME__?: boolean;
  }
}

const INTERNAL_HOSTS = new Set(["daynightae.com", "www.daynightae.com"]);
const SAFE_NATIVE_PATHS = [
  "/auth",
  "/admin",
  "/tracking",
  "/merchant",
  "/driver",
  "/customer",
  "/request",
  "/request-delivery",
  "/pricing",
];

function plugin(name: string): NativePlugin | undefined {
  return window.Capacitor?.Plugins?.[name];
}

function isNativeAndroid() {
  const bridge = window.Capacitor;
  if (!bridge) return false;
  if (typeof bridge.isNativePlatform === "function" && !bridge.isNativePlatform()) return false;
  return typeof bridge.getPlatform !== "function" || bridge.getPlatform() === "android";
}

function navigateInsideApp(path: string) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (!SAFE_NATIVE_PATHS.some((prefix) => safePath === prefix || safePath.startsWith(`${prefix}/`) || safePath.startsWith(`${prefix}?`))) {
    return;
  }

  window.history.pushState({}, "", safePath);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function pathFromAppUrl(rawUrl: string) {
  try {
    if (rawUrl.startsWith("daynightadmin://")) {
      const withoutScheme = rawUrl.replace(/^daynightadmin:\/\//i, "");
      const slash = withoutScheme.indexOf("/");
      return slash >= 0 ? `/${withoutScheme.slice(slash + 1)}` : "/auth";
    }

    const url = new URL(rawUrl);
    if (INTERNAL_HOSTS.has(url.hostname)) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }

  return null;
}

function showExitHint() {
  let hint = document.getElementById("dn-native-exit-hint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "dn-native-exit-hint";
    hint.className = "dn-native-exit-hint";
    hint.textContent = document.documentElement.dir === "rtl" ? "اضغط رجوع مرة أخرى للخروج" : "Press back again to exit";
    document.body.appendChild(hint);
  }

  hint.classList.add("is-visible");
  window.setTimeout(() => hint?.classList.remove("is-visible"), 1700);
}

function ensureConnectivityBanner() {
  let banner = document.getElementById("dn-native-connectivity");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "dn-native-connectivity";
    banner.className = "dn-native-connectivity";
    document.body.appendChild(banner);
  }

  const online = navigator.onLine;
  banner.textContent = online
    ? document.documentElement.dir === "rtl"
      ? "تم استعادة الاتصال"
      : "Connection restored"
    : document.documentElement.dir === "rtl"
      ? "لا يوجد اتصال بالإنترنت"
      : "No internet connection";
  banner.classList.toggle("is-offline", !online);
  banner.classList.toggle("is-online", online);

  if (online) window.setTimeout(() => banner?.classList.remove("is-online"), 1800);
}

export function initializeDayNightNativeRuntime() {
  if (typeof window === "undefined" || window.__DAY_NIGHT_NATIVE_RUNTIME__) return;
  window.__DAY_NIGHT_NATIVE_RUNTIME__ = true;

  if (!isNativeAndroid()) return;

  document.documentElement.classList.add("dn-native-android");
  document.body?.classList.add("dn-native-android-body");

  if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
    window.history.replaceState({}, "", "/auth");
  }

  const App = plugin("App");
  const Browser = plugin("Browser");
  const Haptics = plugin("Haptics");
  const Keyboard = plugin("Keyboard");
  const SplashScreen = plugin("SplashScreen");
  const StatusBar = plugin("StatusBar");

  void StatusBar?.setOverlaysWebView?.({ overlay: false });
  void StatusBar?.setBackgroundColor?.({ color: "#071A33" });
  void StatusBar?.setStyle?.({ style: "LIGHT" });
  void Keyboard?.setResizeMode?.({ mode: "body" });

  const hideSplash = () => {
    window.setTimeout(() => void SplashScreen?.hide?.({ fadeOutDuration: 350 }), 350);
  };
  if (document.readyState === "complete") hideSplash();
  else window.addEventListener("load", hideSplash, { once: true });

  let lastBackAt = 0;
  void App?.addListener?.("backButton", ({ canGoBack }: { canGoBack?: boolean }) => {
    const protectedRoot = window.location.pathname === "/auth" || window.location.pathname === "/";
    if (canGoBack && !protectedRoot) {
      window.history.back();
      return;
    }

    const now = Date.now();
    if (now - lastBackAt < 1800) {
      void App?.exitApp?.();
      return;
    }

    lastBackAt = now;
    showExitHint();
  });

  void App?.addListener?.("appUrlOpen", ({ url }: { url?: string }) => {
    const path = url ? pathFromAppUrl(url) : null;
    if (path) navigateInsideApp(path);
  });

  let lastHapticAt = 0;
  document.addEventListener(
    "pointerup",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("button, [role='button'], .dn-native-haptic")) return;
      const now = Date.now();
      if (now - lastHapticAt < 80) return;
      lastHapticAt = now;
      void Haptics?.impact?.({ style: "LIGHT" });
    },
    { passive: true },
  );

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.hasAttribute("download")) return;

    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    try {
      const url = new URL(anchor.href, window.location.href);
      if (INTERNAL_HOSTS.has(url.hostname)) return;

      if (url.protocol === "http:" || url.protocol === "https:") {
        event.preventDefault();
        void Browser?.open?.({ url: url.toString(), presentationStyle: "popover" });
      }
    } catch {
      // tel:, mailto:, sms:, and WhatsApp intents are left to Android/WebView.
    }
  });

  window.addEventListener("offline", ensureConnectivityBanner);
  window.addEventListener("online", ensureConnectivityBanner);
  if (!navigator.onLine) ensureConnectivityBanner();
}

export {};
