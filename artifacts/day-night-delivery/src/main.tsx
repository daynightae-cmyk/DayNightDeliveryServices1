import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppProvider } from "./lib/AppContext.tsx";
import { reportError } from "./lib/monitoring";
import { initializeDayNightNativeRuntime } from "./lib/nativeAndroidRuntime";
import { initializeLiveDeploymentWatcher } from "./lib/liveDeploymentRuntime";
import ProductionExperience from "./components/ProductionExperience";
import ProductionOrderRealtimeBridge from "./components/ProductionOrderRealtimeBridge";
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

const FALLBACK_LOGO = "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png";

function isMapTileImage(img: HTMLImageElement) {
  return img.classList.contains("leaflet-tile");
}

if (typeof window !== "undefined") {
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
      <ProductionOrderRealtimeBridge />
      <ProductionExperience />
    </AppProvider>
  </StrictMode>,
);
