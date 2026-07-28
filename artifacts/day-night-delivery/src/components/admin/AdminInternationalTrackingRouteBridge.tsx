import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Globe2 } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import AdminInternationalTrackingLauncher from "./AdminInternationalTrackingLauncher";
import "../../styles/dn-international-sidebar.css";

declare global {
  interface Window {
    __DN_TRACK17_HISTORY_BRIDGE__?: boolean;
  }
}

const LOCATION_EVENT = "daynight:track17-location";

function installLocationBridge() {
  if (window.__DN_TRACK17_HISTORY_BRIDGE__) return;
  window.__DN_TRACK17_HISTORY_BRIDGE__ = true;

  const pushState = window.history.pushState.bind(window.history);
  const replaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = (...args) => {
    pushState(...args);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  };

  window.history.replaceState = (...args) => {
    replaceState(...args);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  };
}

export default function AdminInternationalTrackingRouteBridge() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [sidebar, setSidebar] = useState<HTMLElement | null>(null);

  useEffect(() => {
    installLocationBridge();
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
    window.addEventListener(LOCATION_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(LOCATION_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!/^\/admin(?:\/|$)/i.test(pathname)) {
      setSidebar(null);
      return;
    }

    const findSidebar = () => {
      const element = document.querySelector<HTMLElement>(".dn-admin-side-nav");
      if (element) setSidebar(element);
    };

    findSidebar();
    const observer = new MutationObserver(findSidebar);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (!/^\/admin(?:\/|$)/i.test(pathname)) return null;

  const openTracking = () => {
    const launcher = document.querySelector<HTMLButtonElement>(
      ".dn-it-admin-legacy-host .dn-it-admin-launch",
    );
    launcher?.click();
  };

  return (
    <>
      <div className="dn-it-admin-legacy-host" aria-hidden="true">
        <AdminInternationalTrackingLauncher />
      </div>

      {sidebar && createPortal(
        <section className="dn-it-sidebar-section" data-dn-track17-sidebar="true">
          <h3>{isArabic ? "الشحن الدولي" : "International Shipping"}</h3>
          <button
            type="button"
            className="dn-it-sidebar-button"
            onClick={openTracking}
            aria-label={isArabic ? "فتح مركز التتبع الدولي" : "Open international tracking center"}
          >
            <span className="dn-admin-sidebar-icon"><Globe2 className="h-4 w-4" /></span>
            <span>{isArabic ? "التتبع الدولي" : "International Tracking"}</span>
          </button>
        </section>,
        sidebar,
      )}
    </>
  );
}
