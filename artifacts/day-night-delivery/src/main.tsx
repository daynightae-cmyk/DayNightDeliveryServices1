import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AppProvider } from "./lib/AppContext.tsx";
import { reportError } from "./lib/monitoring";
import { initializeDayNightNativeRuntime } from "./lib/nativeAndroidRuntime";
import { ensureCurrentProtectedDeployment, initializeLiveDeploymentWatcher } from "./lib/liveDeploymentRuntime";
import { installMerchantCredentialAutofill } from "./lib/merchantCredentialAutofill";
import { installAlAinLocationOptions } from "./data/installAlAinLocation";
import ProductionExperience from "./components/ProductionExperience";
import ProductionOrderRealtimeBridge from "./components/ProductionOrderRealtimeBridge";
import AdminDeferredMerchantAccounting from "./components/admin/AdminDeferredMerchantAccounting";
import AdminExperienceEnhancements from "./components/admin/AdminExperienceEnhancements";
import NativeRoleErrorBoundary from "./components/native/NativeRoleErrorBoundary";
import WhatsAppRuntimeGuard from "./components/WhatsAppRuntimeGuard";
import AdminCustomerExperienceLauncher from "./components/admin/AdminCustomerExperienceLauncher";
import AdminRatingsLauncher from "./components/admin/AdminRatingsLauncher";
import AdminEmployeeLauncher from "./components/admin/AdminEmployeeLauncher";
import MerchantFeedbackSummaryLauncher from "./components/merchant/MerchantFeedbackSummaryLauncher";
import InternationalTrackingEntryLauncher from "./components/InternationalTrackingEntryLauncher";
import MerchantInternationalTrackingLauncher from "./components/merchant/MerchantInternationalTrackingLauncher";
import ArabicAddressRuntimeBridge from "./components/ArabicAddressRuntimeBridge";
import DeveloperSignature from "./components/DeveloperSignature";
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
import "./styles/dn-international-map-resilience.css";
import "./styles/dn-admin-inp-acceptance.css";
import "./styles/dn-work-max-foundation.css";
import "./styles/dn-global-day-mode-closure.css";
import "./styles/dn-admin-light-contrast-final-v2.css";

const AdminNexusEntry = lazy(() => import("./components/admin/AdminNexusEntry"));
const FALLBACK_LOGO = "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png";
type NativeRole = "driver" | "merchant";
const isMapTileImage = (img: HTMLImageElement) => img.classList.contains("leaflet-tile");
const isAdminPath = () => typeof window !== "undefined" && /^\/admin(?:\/|$)/i.test(window.location.pathname);
function nativeRoleFromLocation(): NativeRole | null { if (typeof window === "undefined") return null; const params = new URLSearchParams(window.location.search); const role = params.get("nativeShell"); if (role === "driver" && /^\/driver(?:\/|$)/.test(window.location.pathname)) return "driver"; if (role === "merchant" && /^\/merchant(?:\/|$)/.test(window.location.pathname)) return "merchant"; return null; }
function normalizeTrackingNumberQuery() { if (!/^\/tracking(?:\/|$)/i.test(window.location.pathname)) return; const url = new URL(window.location.href); const number = url.searchParams.get("number")?.trim(); if (!number || url.searchParams.get("code")) return; url.searchParams.set("code", number); window.history.replaceState({}, "", url); }
function normalizeLegacyAdminFeaturePath() { if (typeof window === "undefined") return; const url = new URL(window.location.href); const path = url.pathname.replace(/\/+$/, "") || "/"; let changed = false; if (path === "/admin/new-employee") { url.pathname = "/admin"; url.search = ""; url.searchParams.set("hr", "new"); changed = true; } else if (path === "/admin/employees") { url.pathname = "/admin"; url.search = ""; url.searchParams.set("hr", "employees"); changed = true; } else if (path === "/admin/customer-experience") { url.pathname = "/admin"; url.search = ""; url.searchParams.set("cx", "messages"); changed = true; } if (changed) window.history.replaceState(window.history.state, "", url); }
function installGlobalRuntimeHandlers() {
  if (typeof window === "undefined") return; initializeDayNightNativeRuntime(); initializeLiveDeploymentWatcher();
  window.addEventListener("error", (event) => { const target = event.target as HTMLElement | null; if (target?.tagName === "IMG") { const img = target as HTMLImageElement; if (isMapTileImage(img)) { img.classList.add("dn-map-tile-load-failed"); return; } if (!img.dataset.dnFallbackApplied) { img.dataset.dnFallbackApplied = "1"; img.decoding = "async"; img.loading = img.loading || "lazy"; img.src = FALLBACK_LOGO; img.classList.add("dn-image-fallback-applied"); return; } } reportError(event.error || event.message, "window_error"); }, true);
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason, "unhandled_rejection"));
}
function rootElement() { const root = document.getElementById("root"); if (!root) throw new Error("DAY NIGHT root element is missing"); return root; }
function mountPublicApplication() { const adminRoute = isAdminPath(); createRoot(rootElement()).render(<StrictMode><AppProvider><ArabicAddressRuntimeBridge /><App />{adminRoute && <AdminExperienceEnhancements />}{adminRoute && <Suspense fallback={null}><AdminNexusEntry /></Suspense>}<WhatsAppRuntimeGuard /><AdminCustomerExperienceLauncher /><AdminRatingsLauncher /><AdminEmployeeLauncher /><MerchantFeedbackSummaryLauncher /><InternationalTrackingEntryLauncher /><MerchantInternationalTrackingLauncher /><ProductionOrderRealtimeBridge />{adminRoute && <AdminDeferredMerchantAccounting />}<ProductionExperience /></AppProvider></StrictMode>); }
async function mountNativeRoleApplication(role: NativeRole) { const { default: NativeRoleRoot } = await import("./components/native/NativeRoleRoot"); createRoot(rootElement()).render(<StrictMode><BrowserRouter><NativeRoleErrorBoundary role={role}><AppProvider><ArabicAddressRuntimeBridge /><NativeRoleRoot role={role} /><DeveloperSignature /><WhatsAppRuntimeGuard />{role === "merchant" && <MerchantFeedbackSummaryLauncher />}{role === "merchant" && <MerchantInternationalTrackingLauncher />}</AppProvider></NativeRoleErrorBoundary></BrowserRouter></StrictMode>); }
async function mountStandaloneAdminFeatures() {
  const pathname = window.location.pathname;
  if (/^\/international-tracking\/?$/i.test(pathname)) { const { default: InternationalTrackingPage } = await import("./components/InternationalTrackingPage"); createRoot(rootElement()).render(<StrictMode><AppProvider><ArabicAddressRuntimeBridge /><InternationalTrackingPage /><WhatsAppRuntimeGuard /></AppProvider></StrictMode>); return true; }
  if (/^\/(?:feedback|rate)\/[^/]+\/?$/i.test(pathname)) { const ratingModule = await import("./components/MultiPartyRatingPage").catch(() => import("./components/FeedbackPage")); const RatingPage = ratingModule.default; createRoot(rootElement()).render(<StrictMode><AppProvider><ArabicAddressRuntimeBridge /><RatingPage /><WhatsAppRuntimeGuard /></AppProvider></StrictMode>); return true; }
  return false;
}
async function bootstrapApplication() {
  const deploymentReady = await ensureCurrentProtectedDeployment(); if (!deploymentReady) return;
  installAlAinLocationOptions(); normalizeTrackingNumberQuery(); normalizeLegacyAdminFeaturePath(); installMerchantCredentialAutofill(); installGlobalRuntimeHandlers();
  try { if (await mountStandaloneAdminFeatures()) return; } catch (error) { reportError(error, "standalone_admin_feature_mount"); }
  const nativeRole = nativeRoleFromLocation(); if (nativeRole) { try { await mountNativeRoleApplication(nativeRole); return; } catch (error) { reportError(error, "native_role_mount"); } }
  mountPublicApplication();
}
void bootstrapApplication();