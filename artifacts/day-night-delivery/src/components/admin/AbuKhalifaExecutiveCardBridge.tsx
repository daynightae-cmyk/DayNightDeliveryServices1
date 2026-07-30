import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppContext } from "../../lib/AppContext";
import { fetchAdminStats, type AdminStats } from "../../lib/adminData";
import AbuKhalifaExecutiveCard, {
  type AbuKhalifaAction,
} from "./AbuKhalifaExecutiveCard";
import "../../styles/abu-khalifa-executive-card.css";

const EMPLOYEE_PATH_EVENT = "dn-employee-hr-path";
const ADMIN_ROOT_SELECTOR = ".dn-admin-fullscreen";
const EXECUTIVE_PANEL_SELECTOR = ".dn-admin-left-ai";
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
  return typeof window !== "undefined" && /^\/admin(?:\/|$)/i.test(window.location.pathname);
}

function ensureHost(root: ParentNode) {
  const panel = root.querySelector<HTMLElement>(EXECUTIVE_PANEL_SELECTOR);
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

function currentSectionLabel(root: ParentNode = document) {
  return (
    root.querySelector<HTMLElement>(".dn-admin-current-section strong")?.textContent
      ?.replace(/\s+/g, " ")
      .trim() || ""
  );
}

function sidebarWidth(root: ParentNode = document) {
  const sidebar = root.querySelector<HTMLElement>(".dn-admin-sidebar-full");
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

    const applicationRoot = document.getElementById("root");
    if (!applicationRoot) return;

    let adminRoot: HTMLElement | null = null;
    let shellObserver: MutationObserver | null = null;
    let bootstrapObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        adminRoot = document.querySelector<HTMLElement>(ADMIN_ROOT_SELECTOR);
        if (!adminRoot) return;
        const nextHost = ensureHost(adminRoot);
        setHost((current) => (current === nextHost ? current : nextHost));
        const nextSection = currentSectionLabel(adminRoot);
        setSection((current) => (current === nextSection ? current : nextSection));
        const nextWidth = sidebarWidth(adminRoot);
        setMeasuredSidebarWidth((current) => (current === nextWidth ? current : nextWidth));
      });
    };

    const connectAdminRoot = () => {
      const nextRoot = document.querySelector<HTMLElement>(ADMIN_ROOT_SELECTOR);
      if (!nextRoot || nextRoot === adminRoot) return Boolean(nextRoot);
      adminRoot = nextRoot;
      sync();

      shellObserver?.disconnect();
      shellObserver = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) sync();
      });
      shellObserver.observe(adminRoot, { childList: true, subtree: true });

      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(sync);
      const sidebar = adminRoot.querySelector<HTMLElement>(".dn-admin-sidebar-full");
      if (sidebar) resizeObserver.observe(sidebar);
      return true;
    };

    if (!connectAdminRoot()) {
      bootstrapObserver = new MutationObserver(() => {
        if (connectAdminRoot()) bootstrapObserver?.disconnect();
      });
      bootstrapObserver.observe(applicationRoot, { childList: true, subtree: true });
    }

    const handleAdminClick = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".dn-admin-side-nav button")) sync();
    };

    void refreshMetrics();
    applicationRoot.addEventListener("click", handleAdminClick, true);
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("popstate", sync);
    window.addEventListener("dn-international-shipment-updated", refreshMetrics);
    window.addEventListener("dn-admin-settings-change", refreshMetrics);
    const timer = window.setInterval(() => void refreshMetrics(), 60_000);

    return () => {
      cancelAnimationFrame(frame);
      bootstrapObserver?.disconnect();
      shellObserver?.disconnect();
      resizeObserver?.disconnect();
      applicationRoot.removeEventListener("click", handleAdminClick, true);
      window.removeEventListener("resize", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("dn-international-shipment-updated", refreshMetrics);
      window.removeEventListener("dn-admin-settings-change", refreshMetrics);
      window.clearInterval(timer);
      const panel = adminRoot?.querySelector<HTMLElement>(EXECUTIVE_PANEL_SELECTOR);
      panel?.classList.remove("dn-admin-left-ai--executive");
      panel?.querySelector<HTMLElement>(":scope > .dn-abu-khalifa-executive-host")?.remove();
    };
  }, [refreshMetrics]);

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
