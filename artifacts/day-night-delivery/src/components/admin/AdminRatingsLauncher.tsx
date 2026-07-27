import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import AdminRatingsCenter from "./AdminRatingsCenter";
import "../../styles/dn-customer-experience-navigation.css";

const PATH_EVENT = "dn-ratings-center-path";

function locationKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function isRatingsPath(value: string) {
  const url = new URL(value || "/", window.location.origin);
  return url.pathname.replace(/\/+$/, "") === "/admin" && url.searchParams.get("cx") === "ratings";
}

function openRatingsPath(open: boolean) {
  const url = new URL(window.location.href);
  url.pathname = "/admin";
  url.search = "";
  if (open) {
    url.searchParams.set("cx", "ratings");
    url.searchParams.set("tab", "ratings");
  }
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new CustomEvent(PATH_EVENT, { detail: `${url.pathname}${url.search}` }));
}

function ensureRatingsTarget(isArabic: boolean) {
  const nav = document.querySelector<HTMLElement>(".dn-admin-side-nav");
  if (!nav) return null;
  let section = nav.querySelector<HTMLElement>('[data-dn-customer-experience-section="0"]');
  if (!section) {
    section = document.createElement("section");
    section.dataset.dnCustomerExperienceSection = "0";
    section.className = "dn-customer-experience-native-section";
    const heading = document.createElement("h3");
    heading.textContent = isArabic ? "خدمة العملاء" : "Customer Service";
    section.appendChild(heading);
    nav.appendChild(section);
  }
  let host = section.querySelector<HTMLElement>(".dn-ratings-center-nav-host");
  if (!host) {
    host = document.createElement("span");
    host.className = "dn-ratings-center-nav-host";
    section.appendChild(host);
  }
  return host;
}

export default function AdminRatingsLauncher() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [path, setPath] = useState(locationKey);
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const isAdmin = /^\/admin(?:\/|\?|$)/.test(path);
  const active = isRatingsPath(path);

  useEffect(() => {
    if (!isAdmin) return;
    let frame = 0;
    const sync = () => {
      setNavTarget(ensureRatingsTarget(isArabic));
      setWorkspace(document.querySelector<HTMLElement>(".dn-admin-workspace-host"));
      setPath(locationKey());
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; sync(); });
    };
    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(schedule, 1500);
    return () => {
      observer.disconnect();
      clearInterval(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isAdmin, isArabic]);

  useEffect(() => {
    const onPath = (event: Event) => setPath((event as CustomEvent<string>).detail || locationKey());
    const onPop = () => setPath(locationKey());
    window.addEventListener(PATH_EVENT, onPath);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(PATH_EVENT, onPath);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dn-customer-experience-embedded", active);
    return () => document.body.classList.remove("dn-customer-experience-embedded");
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const capture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const normalButton = target?.closest<HTMLButtonElement>(".dn-admin-side-nav button:not(.dn-ratings-center-nav)");
      if (normalButton) openRatingsPath(false);
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, [active]);

  if (!isAdmin) return null;

  return (
    <>
      {navTarget && createPortal(
        <button
          type="button"
          className={`dn-customer-experience-nav dn-ratings-center-nav ${active ? "is-active" : ""}`}
          onClick={() => { openRatingsPath(true); setPath(locationKey()); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          aria-current={active ? "page" : undefined}
          title={isArabic ? "قسم التقييمات - العملاء والتجار والمناديب" : "Ratings Center - customers, merchants and drivers"}
        >
          <span className="dn-admin-sidebar-icon relative"><Star className="h-4 w-4 fill-current" /></span>
          <span className="dn-customer-experience-nav-copy"><strong>{isArabic ? "قسم التقييمات" : "Ratings Center"}</strong><small>{isArabic ? "العميل - التاجر - المندوب" : "Customer - Merchant - Driver"}</small></span>
        </button>,
        navTarget,
        "admin-ratings-nav",
      )}
      {active && workspace && createPortal(
        <div className="dn-customer-experience-embedded-root"><AdminRatingsCenter isArabic={isArabic} /></div>,
        workspace,
        "admin-ratings-workspace",
      )}
    </>
  );
}
