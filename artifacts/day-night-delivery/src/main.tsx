import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AppProvider } from "./lib/AppContext.tsx";
import { reportError } from "./lib/monitoring";
import { initializeDayNightNativeRuntime } from "./lib/nativeAndroidRuntime";
import { initializeLiveDeploymentWatcher } from "./lib/liveDeploymentRuntime";
import ProductionExperience from "./components/ProductionExperience";
import ProductionOrderRealtimeBridge from "./components/ProductionOrderRealtimeBridge";
import AdminDeferredMerchantAccounting from "./components/admin/AdminDeferredMerchantAccounting";
import NativeRoleErrorBoundary from "./components/native/NativeRoleErrorBoundary";
import WhatsAppRuntimeGuard from "./components/WhatsAppRuntimeGuard";
import AdminCustomerExperienceLauncher from "./components/admin/AdminCustomerExperienceLauncher";
import "./index.css";
import "./styles/dn-premium.css";
import "./styles/dn-ui-fixes.css";
import "./styles/dn-support-polish.css";
import "./styles/dn-floating-final.css";
import "./styles/dn-admin-final-polish.css";
import "./styles/dn-admin-approved-reference.css";
import "./styles/dn-map-tile-fallback-guard.css";
import "./styles/dn-site-unification.css";
import "./styles/dn-vehicle-marker-system.css";
import "./styles/dn-native-android.css";
import "./styles/dn-portal-figma-reference-v6.css";
import "./styles/dn-portal-figma-final-v7.css";
import "./styles/dn-portal-notification-final.css";
import "./styles/dn-operations-control-rescue.css";
import "./styles/dn-production-visual-rescue-v3.css";
import "./styles/dn-admin-unified-sections-v4.css";
import "./styles/dn-merchant-mobile-drawer-final.css";
import "./styles/dn-pointer-performance.css";
import "./styles/dn-role-auth-mobile-final.css";
import "./styles/dn-merchant-brand-v114.css";

const FALLBACK_LOGO = "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png";
type NativeRole = "driver" | "merchant";

function isMapTileImage(img: HTMLImageElement) {
  return img.classList.contains("leaflet-tile");
}

function nativeRoleFromLocation(): NativeRole | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const nativeRole = params.get("nativeShell");
  if (nativeRole === "driver" && /^\/driver(?:\/|$)/.test(window.location.pathname)) return "driver";
  if (nativeRole === "merchant" && /^\/merchant(?:\/|$)/.test(window.location.pathname)) return "merchant";
  return null;
}

function normalizeTrackingNumberQuery() {
  if (!/^\/tracking(?:\/|$)/i.test(window.location.pathname)) return;
  const url = new URL(window.location.href);
  const number = url.searchParams.get("number")?.trim();
  if (!number || url.searchParams.get("code")) return;
  url.searchParams.set("code", number);
  window.history.replaceState({}, "", url);
}

function installGlobalRuntimeHandlers() {
  if (typeof window === "undefined") return;
  initializeDayNightNativeRuntime();
  initializeLiveDeploymentWatcher();

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "IMG") {
        const img = target as HTMLImageElement;
        if (isMapTileImage(img)) {
          img.classList.add("dn-map-tile-load-failed");
          return;
        }
        if (!img.dataset.dnFallbackApplied) {
          img.dataset.dnFallbackApplied = "1";
          img.decoding = "async";
          img.loading = img.loading || "lazy";
          img.src = FALLBACK_LOGO;
          img.classList.add("dn-image-fallback-applied");
          return;
        }
      }
      reportError(event.error || event.message, "window_error");
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandled_rejection");
  });
}

function rootElement() {
  const root = document.getElementById("root");
  if (!root) throw new Error("DAY NIGHT root element is missing");
  return root;
}

function mountPublicApplication() {
  createRoot(rootElement()).render(
    <StrictMode>
      <AppProvider>
        <App />
        <WhatsAppRuntimeGuard />
        <AdminCustomerExperienceLauncher />
        <ProductionOrderRealtimeBridge />
        <AdminDeferredMerchantAccounting />
        <ProductionExperience />
      </AppProvider>
    </StrictMode>,
  );
}

async function mountNativeRoleApplication(role: NativeRole) {
  const { default: NativeRoleRoot } = await import("./components/native/NativeRoleRoot");
  createRoot(rootElement()).render(
    <StrictMode>
      <BrowserRouter>
        <NativeRoleErrorBoundary role={role}>
          <AppProvider>
            <NativeRoleRoot role={role} />
            <WhatsAppRuntimeGuard />
          </AppProvider>
        </NativeRoleErrorBoundary>
      </BrowserRouter>
    </StrictMode>,
  );
}

async function mountStandaloneCustomerExperience() {
  const pathname = window.location.pathname;
  if (/^\/(?:feedback|rate)\/[^/]+\/?$/i.test(pathname)) {
    const { default: FeedbackPage } = await import("./components/FeedbackPage");
    createRoot(rootElement()).render(
      <StrictMode>
        <AppProvider>
          <FeedbackPage />
          <WhatsAppRuntimeGuard />
        </AppProvider>
      </StrictMode>,
    );
    return true;
  }

  if (/^\/admin\/customer-experience\/?$/i.test(pathname)) {
    const [
      { default: AdminCustomerExperiencePage },
      { default: AdminCustomerExperienceActions },
      { default: ProtectedAdminRoute },
    ] = await Promise.all([
      import("./components/admin/AdminCustomerExperiencePage"),
      import("./components/admin/AdminCustomerExperienceActions"),
      import("./components/ProtectedAdminRoute"),
    ]);
    createRoot(rootElement()).render(
      <StrictMode>
        <BrowserRouter>
          <AppProvider>
            <ProtectedAdminRoute>
              <>
                <AdminCustomerExperiencePage />
                <AdminCustomerExperienceActions />
              </>
            </ProtectedAdminRoute>
            <WhatsAppRuntimeGuard />
          </AppProvider>
        </BrowserRouter>
      </StrictMode>,
    );
    return true;
  }

  return false;
}

async function bootstrapApplication() {
  normalizeTrackingNumberQuery();
  installGlobalRuntimeHandlers();
  try {
    if (await mountStandaloneCustomerExperience()) return;
  } catch (error) {
    reportError(error, "customer_experience_mount");
  }

  const nativeRole = nativeRoleFromLocation();
  if (nativeRole) {
    try {
      await mountNativeRoleApplication(nativeRole);
      return;
    } catch (error) {
      reportError(error, "native_role_mount");
    }
  }
  mountPublicApplication();
}

void bootstrapApplication();
