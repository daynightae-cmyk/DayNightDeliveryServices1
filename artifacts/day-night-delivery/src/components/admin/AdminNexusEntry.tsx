import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Radar, Sparkles } from "lucide-react";
import AdminNexusControlTower from "./AdminNexusControlTower";
import "../../styles/dn-nexus-command-launcher.css";

function isElementVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function findVisibleCommandNavigation() {
  const navigations = Array.from(
    document.querySelectorAll<HTMLElement>(".dncc-navigation"),
  );
  return navigations.find(isElementVisible) || null;
}

function triggerNexusControlTower() {
  const internalLaunchers = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".dn-nexus-launcher"),
  );
  const launcher = internalLaunchers.find((item) => !item.disabled) || null;
  if (launcher) {
    launcher.click();
    return true;
  }
  return false;
}

function NexusCommandLauncher() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mobile, setMobile] = useState(() => window.innerWidth <= 980);
  const [isArabic, setIsArabic] = useState(true);

  useEffect(() => {
    let createdHost: HTMLElement | null = null;

    const sync = () => {
      const shell = document.querySelector<HTMLElement>(".dncc-shell");
      setIsArabic(shell?.getAttribute("dir") !== "ltr");
      const nextMobile = window.innerWidth <= 980;
      setMobile(nextMobile);

      if (nextMobile) {
        setHost(null);
        return;
      }

      const navigation = findVisibleCommandNavigation();
      if (!navigation) {
        setHost(null);
        return;
      }

      let nextHost = navigation.querySelector<HTMLElement>(":scope > .dn-nexus-command-host");
      if (!nextHost) {
        nextHost = document.createElement("div");
        nextHost.className = "dn-nexus-command-host";
        navigation.prepend(nextHost);
      }
      createdHost = nextHost;
      setHost(nextHost);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", sync, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      createdHost?.remove();
    };
  }, []);

  const openNexus = () => {
    if (triggerNexusControlTower()) return;
    window.setTimeout(() => {
      triggerNexusControlTower();
    }, 120);
  };

  const button = (
    <button
      type="button"
      className={`dn-nexus-command-launcher ${mobile ? "is-mobile" : ""}`}
      onClick={openNexus}
      aria-label={isArabic ? "فتح NEXUS AI برج التحكم الذكي" : "Open NEXUS AI control tower"}
    >
      <span className="dn-nexus-command-icon"><Radar size={18} /></span>
      <span className="dn-nexus-command-copy">
        <b>NEXUS AI</b>
        <small>{isArabic ? "برج التحكم الذكي" : "AI Control Tower"}</small>
      </span>
      <span className="dn-nexus-command-live"><Sparkles size={11} /> LIVE</span>
    </button>
  );

  if (mobile || !host) {
    return <div className="dn-nexus-command-floating">{button}</div>;
  }

  return createPortal(button, host);
}

export default function AdminNexusEntry() {
  return (
    <>
      <AdminNexusControlTower />
      <NexusCommandLauncher />
    </>
  );
}
