import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Radar, Sparkles } from "lucide-react";
import AdminNexusControlTower from "./AdminNexusControlTower";
import "../../styles/dn-nexus-command-launcher.css";
import "../../styles/dn-nexus-luxury-consolidation.css";

const AdminNexusPhase2Intelligence = lazy(() => import("./AdminNexusPhase2Intelligence"));
const AdminNexusPhase3PredictiveOperations = lazy(() => import("./AdminNexusPhase3PredictiveOperations"));
const AdminNexusPhase4ServiceAssurance = lazy(() => import("./AdminNexusPhase4ServiceAssurance"));

const NEXUS_OPEN_EVENT = "dn-nexus-open-state";

function triggerNexusControlTower() {
  const launcher = document.querySelector<HTMLButtonElement>(".dn-nexus-launcher:not(:disabled)");
  if (!launcher) return false;
  launcher.click();
  return true;
}

function NexusDeferredIntelligenceLayers() {
  const [nexusOpen, setNexusOpen] = useState(false);

  useEffect(() => {
    const syncFromDom = () => setNexusOpen(Boolean(document.querySelector(".dn-nexus-overlay")));
    const onOpenState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setNexusOpen(Boolean(detail?.open));
    };
    syncFromDom();
    window.addEventListener(NEXUS_OPEN_EVENT, onOpenState as EventListener);
    return () => window.removeEventListener(NEXUS_OPEN_EVENT, onOpenState as EventListener);
  }, []);

  if (!nexusOpen) return null;
  return (
    <Suspense fallback={null}>
      <AdminNexusPhase2Intelligence />
      <AdminNexusPhase3PredictiveOperations />
      <AdminNexusPhase4ServiceAssurance />
    </Suspense>
  );
}

function NexusCommandLauncher() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mobile, setMobile] = useState(() => window.innerWidth <= 980);
  const [isArabic, setIsArabic] = useState(true);

  useEffect(() => {
    let createdHost: HTMLElement | null = null;
    let acquisitionTimer: number | null = null;
    let attempts = 0;

    const sync = () => {
      const shell = document.querySelector<HTMLElement>(".dncc-shell");
      const nextMobile = window.innerWidth <= 980;
      setMobile(nextMobile);
      setIsArabic(shell?.getAttribute("dir") !== "ltr");

      if (nextMobile) {
        setHost(null);
        return Boolean(shell);
      }

      const navigation = document.querySelector<HTMLElement>(".dncc-shell .dncc-navigation")
        || document.querySelector<HTMLElement>(".dncc-navigation");
      if (!navigation) {
        setHost(null);
        return false;
      }

      let nextHost = navigation.querySelector<HTMLElement>(":scope > .dn-nexus-command-host");
      if (!nextHost) {
        nextHost = document.createElement("div");
        nextHost.className = "dn-nexus-command-host";
        navigation.prepend(nextHost);
      }
      createdHost = nextHost;
      setHost(nextHost);
      return true;
    };

    const acquire = () => {
      attempts += 1;
      const ready = sync();
      if (ready || attempts >= 40) {
        if (acquisitionTimer) window.clearInterval(acquisitionTimer);
        acquisitionTimer = null;
      }
    };

    acquire();
    if (!createdHost && window.innerWidth > 980) {
      acquisitionTimer = window.setInterval(acquire, 250);
    }

    const onResize = () => {
      attempts = 0;
      const ready = sync();
      if (!ready && !acquisitionTimer && window.innerWidth > 980) {
        acquisitionTimer = window.setInterval(acquire, 250);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (acquisitionTimer) window.clearInterval(acquisitionTimer);
      window.removeEventListener("resize", onResize);
      createdHost?.remove();
    };
  }, []);

  const openNexus = () => {
    if (triggerNexusControlTower()) return;
    window.setTimeout(() => { triggerNexusControlTower(); }, 120);
  };

  const button = (
    <button type="button" className={`dn-nexus-command-launcher ${mobile ? "is-mobile" : ""}`} onClick={openNexus}
      aria-label={isArabic ? "فتح NEXUS AI برج التحكم الذكي" : "Open NEXUS AI control tower"}>
      <span className="dn-nexus-command-icon"><Radar size={18} /></span>
      <span className="dn-nexus-command-copy"><b>NEXUS AI</b><small>{isArabic ? "برج التحكم الذكي" : "AI Control Tower"}</small></span>
      <span className="dn-nexus-command-live"><Sparkles size={11} /> LIVE</span>
    </button>
  );

  if (mobile || !host) return <div className="dn-nexus-command-floating">{button}</div>;
  return createPortal(button, host);
}

export default function AdminNexusEntry() {
  return <>
    <AdminNexusControlTower />
    <NexusDeferredIntelligenceLayers />
    <NexusCommandLauncher />
  </>;
}
