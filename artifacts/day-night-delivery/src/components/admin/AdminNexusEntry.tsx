import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Radar, Sparkles } from "lucide-react";
import "../../styles/dn-nexus-command-launcher.css";
import "../../styles/dn-nexus-luxury-consolidation.css";

const AdminNexusControlTower = lazy(() => import("./AdminNexusControlTower"));
const AdminNexusPhase2Intelligence = lazy(() => import("./AdminNexusPhase2Intelligence"));
const AdminNexusPhase3PredictiveOperations = lazy(() => import("./AdminNexusPhase3PredictiveOperations"));
const AdminNexusPhase4ServiceAssurance = lazy(() => import("./AdminNexusPhase4ServiceAssurance"));

function findVisibleCommandNavigation() {
  return document.querySelector<HTMLElement>(".dncc-shell .dncc-navigation")
    || document.querySelector<HTMLElement>(".dncc-navigation");
}

function triggerNexusControlTower() {
  const launcher = document.querySelector<HTMLButtonElement>(".dn-nexus-launcher:not(:disabled)");
  if (!launcher) return false;
  launcher.click();
  return true;
}

function NexusDeferredIntelligenceLayers() {
  const [nexusOpen, setNexusOpen] = useState(false);

  useEffect(() => {
    let last = false;
    const sync = () => {
      const next = Boolean(document.querySelector(".dn-nexus-overlay"));
      if (next === last) return;
      last = next;
      setNexusOpen(next);
    };
    sync();
    const timer = window.setInterval(sync, 250);
    return () => window.clearInterval(timer);
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

function NexusCommandLauncher({ onRequestOpen }: { onRequestOpen: () => void }) {
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

      const navigation = findVisibleCommandNavigation();
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
    if (!createdHost && window.innerWidth > 980) acquisitionTimer = window.setInterval(acquire, 250);

    const onResize = () => {
      attempts = 0;
      const ready = sync();
      if (!ready && !acquisitionTimer && window.innerWidth > 980) acquisitionTimer = window.setInterval(acquire, 250);
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (acquisitionTimer) window.clearInterval(acquisitionTimer);
      window.removeEventListener("resize", onResize);
      createdHost?.remove();
    };
  }, []);

  const button = (
    <button type="button" className={`dn-nexus-command-launcher ${mobile ? "is-mobile" : ""}`} onClick={onRequestOpen}
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
  const [controlTowerMounted, setControlTowerMounted] = useState(false);

  const requestNexusOpen = useCallback(() => {
    setControlTowerMounted(true);

    const openWhenReady = (attempt: number) => {
      if (triggerNexusControlTower()) return;
      if (attempt >= 20) return;
      window.setTimeout(() => openWhenReady(attempt + 1), 75);
    };
    window.setTimeout(() => openWhenReady(0), 0);
  }, []);

  return <>
    {controlTowerMounted && (
      <Suspense fallback={null}>
        <AdminNexusControlTower />
      </Suspense>
    )}
    {controlTowerMounted && <NexusDeferredIntelligenceLayers />}
    <NexusCommandLauncher onRequestOpen={requestNexusOpen} />
  </>;
}
