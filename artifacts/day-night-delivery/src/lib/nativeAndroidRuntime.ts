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
  "/qr",
];

function plugin(name: string): NativePlugin | undefined {
  return window.Capacitor?.Plugins?.[name];
}

function nativePlatform() {
  const bridge = window.Capacitor;
  if (!bridge) return "";
  if (typeof bridge.isNativePlatform === "function" && !bridge.isNativePlatform()) return "";
  return bridge.getPlatform?.() || "native";
}

function isWindowsLiveShell() {
  return /DAY-NIGHT-WINDOWS-LIVE\//i.test(navigator.userAgent);
}

function isStandaloneWebApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

function isInstalledShell() {
  return Boolean(nativePlatform()) || isWindowsLiveShell() || /DAY-NIGHT-ANDROID\//i.test(navigator.userAgent) || isStandaloneWebApp();
}

function isAllowedInternalPath(path: string) {
  if (path === "/" || path === "") return true;
  return SAFE_NATIVE_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );
}

function navigateInsideApp(path: string) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (!isAllowedInternalPath(safePath)) return;

  window.history.pushState({}, "", safePath);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function pathFromAppUrl(rawUrl: string) {
  try {
    if (/^daynight(admin)?:\/\//i.test(rawUrl)) {
      const withoutScheme = rawUrl.replace(/^daynight(admin)?:\/\//i, "");
      const slash = withoutScheme.indexOf("/");
      return slash >= 0 ? `/${withoutScheme.slice(slash + 1)}` : "/";
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

function applyShellClasses(platform: string) {
  const root = document.documentElement;
  root.classList.add("dn-native-shell", "dn-installed-live-shell");

  if (platform === "android") root.classList.add("dn-native-android", "dn-platform-android");
  if (platform === "ios") root.classList.add("dn-native-ios", "dn-platform-ios");
  if (isWindowsLiveShell()) root.classList.add("dn-native-windows");
  if (isStandaloneWebApp()) root.classList.add("dn-installed-web-app");

  document.body?.classList.add("dn-native-shell-body");
  if (platform === "android") document.body?.classList.add("dn-native-android-body");
  if (platform === "ios") document.body?.classList.add("dn-native-ios-body");
}

export function initializeDayNightNativeRuntime() {
  if (typeof window === "undefined" || window.__DAY_NIGHT_NATIVE_RUNTIME__) return;
  window.__DAY_NIGHT_NATIVE_RUNTIME__ = true;

  if (!isInstalledShell()) return;

  const platform = nativePlatform();
  applyShellClasses(platform);

  if (window.location.pathname === "/index.html") {
    window.history.replaceState({}, "", "/");
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
    window.setTimeout(() => void SplashScreen?.hide?.({ fadeOutDuration: 300 }), 300);
  };
  if (document.readyState === "complete") hideSplash();
  else window.addEventListener("load", hideSplash, { once: true });

  if (platform === "android") {
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
  }

  void App?.addListener?.("appUrlOpen", ({ url }: { url?: string }) => {
    const path = url ? pathFromAppUrl(url) : null;
    if (path) navigateInsideApp(path);
  });

  void App?.addListener?.("appStateChange", ({ isActive }: { isActive?: boolean }) => {
    if (isActive) ensureConnectivityBanner();
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

  if (Browser) {
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
          void Browser.open?.({ url: url.toString(), presentationStyle: platform === "ios" ? "popover" : undefined });
        }
      } catch {
        // tel:, mailto:, sms:, and WhatsApp intents are handled by the operating system.
      }
    });
  }

  window.addEventListener("offline", ensureConnectivityBanner);
  window.addEventListener("online", ensureConnectivityBanner);
  if (!navigator.onLine) ensureConnectivityBanner();
}

export {};
