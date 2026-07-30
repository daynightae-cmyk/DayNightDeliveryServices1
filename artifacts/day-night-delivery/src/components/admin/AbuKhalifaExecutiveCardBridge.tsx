import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppContext } from "../../lib/AppContext";
import { fetchAdminStats, type AdminStats } from "../../lib/adminData";
import AbuKhalifaExecutiveCard, {
  type AbuKhalifaAction,
} from "./AbuKhalifaExecutiveCard";
import "../../styles/abu-khalifa-executive-card.css";

const EMPLOYEE_PATH_EVENT = "dn-employee-hr-path";
const EMPTY_STATS: AdminStats = {
  pending: 0,
  in_transit: 0,
  delivered: 0,
  cancelled: 0,
  total_orders: 0,
  today_orders: 0,
  active_merchants: 0,
  cod_total: 0,
  delivery_income: 0,
};

const ACTION_LABELS: Partial<Record<AbuKhalifaAction, string[]>> = {
  "new-order": ["إضافة طلب جديد", "New Order"],
  orders: ["كافة الطلبات", "All Orders"],
  reports: ["التقارير", "Reports"],
  messages: ["مركز الرسائل", "Message Center", "الدعم الفني", "Technical Support"],
};

function isAdminRoute() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
}

function ensureHost() {
  const panel = document.querySelector<HTMLElement>(".dn-admin-left-ai");
  if (!panel) return null;

  panel.classList.add("dn-admin-left-ai--executive");
  let host = panel.querySelector<HTMLElement>(":scope > .dn-abu-khalifa-executive-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "dn-abu-khalifa-executive-host";
    host.dataset.dnAbuKhalifaExecutiveHost = "true";
    panel.prepend(host);
  }
  return host;
}

function normalizeLabel(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function clickAdminNavigation(labels: string[]) {
  const normalized = labels.map(normalizeLabel);
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button"),
  );
  const target = buttons.find((button) => {
    const text = normalizeLabel(button.textContent);
    return normalized.some((label) => text === label || text.includes(label));
  });

  if (!target) return false;
  target.click();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function openEmployeeWorkspace() {
  const url = new URL(window.location.href);
  url.pathname = "/admin";
  url.search = "";
  url.searchParams.set("hr", "employees");
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  window.dispatchEvent(
    new CustomEvent<string>(EMPLOYEE_PATH_EVENT, { detail: "employee:directory" }),
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function currentSectionLabel() {
  return (
    document.querySelector<HTMLElement>(".dn-admin-current-section strong")?.textContent
      ?.replace(/\s+/g, " ")
      .trim() || ""
  );
}

function sidebarWidth() {
  const sidebar = document.querySelector<HTMLElement>(".dn-admin-sidebar-full");
  const width = sidebar?.getBoundingClientRect().width || 288;
  return Math.max(240, Math.round(width));
}

export default function AbuKhalifaExecutiveCardBridge() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [available, setAvailable] = useState(false);
  const [section, setSection] = useState("");
  const [measuredSidebarWidth, setMeasuredSidebarWidth] = useState(288);

  const refreshMetrics = useCallback(async () => {
    if (!isAdminRoute()) return;
    try {
      const next = await fetchAdminStats();
      setStats(next);
      setLastSync(new Date());
      setAvailable(true);
    } catch (error) {
      console.warn("Abu Khalifa executive metrics could not be refreshed.", error);
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminRoute()) return;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextHost = ensureHost();
        setHost((current) => (current === nextHost ? current : nextHost));
        const nextSection = currentSectionLabel();
        setSection((current) => (current === nextSection ? current : nextSection));
        const nextWidth = sidebarWidth();
        setMeasuredSidebarWidth((current) => (current === nextWidth ? current : nextWidth));
      });
    };

    sync();
    void refreshMetrics();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", sync);
    window.addEventListener("dn-international-shipment-updated", refreshMetrics);
    window.addEventListener("dn-admin-settings-change", refreshMetrics);
    const timer = window.setInterval(() => void refreshMetrics(), 60_000);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("dn-international-shipment-updated", refreshMetrics);
      window.removeEventListener("dn-admin-settings-change", refreshMetrics);
      window.clearInterval(timer);
      document.querySelector(".dn-admin-left-ai")?.classList.remove("dn-admin-left-ai--executive");
      host?.remove();
    };
  }, [host, refreshMetrics]);

  function navigate(action: AbuKhalifaAction) {
    if (action === "employees" || action === "payroll") {
      openEmployeeWorkspace();
      return;
    }

    const labels = ACTION_LABELS[action];
    if (labels && clickAdminNavigation(labels)) return;

    window.dispatchEvent(
      new CustomEvent("dn-admin-executive-action-unavailable", { detail: { action } }),
    );
  }

  if (!host || !isAdminRoute()) return null;

  return createPortal(
    <AbuKhalifaExecutiveCard
      isArabic={isArabic}
      isAvailable={available}
      sidebarWidth={measuredSidebarWidth}
      ordersToday={stats.today_orders}
      activeServices={stats.pending + stats.in_transit}
      lastSync={lastSync ? lastSync.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", {
        hour: "2-digit",
        minute: "2-digit",
      }) : "—"}
      currentSection={section}
      onNavigate={navigate}
    />,
    host,
  );
}
