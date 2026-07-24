import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, UsersRound } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import AdminEmployeesCenter, { type EmployeeCenterMode } from "./AdminEmployeesCenter";
import EmployeePayrollStatementActions from "./EmployeePayrollStatementActions";
import "../../styles/dn-employee-hr-navigation.css";

type Surface = "legacy";
type Target = { element: HTMLElement; surface: Surface; mode: EmployeeCenterMode };
type EmployeeRouteState = "/admin" | "employee:new" | "employee:directory";

export const EMPLOYEE_PATH_EVENT = "dn-employee-hr-path";
const ADMIN_PATH = "/admin";
const LEGACY_NEW_EMPLOYEE_PATH = "/admin/new-employee";
const LEGACY_EMPLOYEES_PATH = "/admin/employees";
const NEW_EMPLOYEE_ROUTE: EmployeeRouteState = "employee:new";
const EMPLOYEES_ROUTE: EmployeeRouteState = "employee:directory";

function normalizedPathname() {
  return typeof window === "undefined"
    ? ""
    : window.location.pathname.replace(/\/+$/, "") || "/";
}

function routeState(): EmployeeRouteState | string {
  if (typeof window === "undefined") return "";
  const path = normalizedPathname();

  // Compatibility for an already-open legacy URL before Vercel redirects it.
  if (path === LEGACY_NEW_EMPLOYEE_PATH) return NEW_EMPLOYEE_ROUTE;
  if (path === LEGACY_EMPLOYEES_PATH) return EMPLOYEES_ROUTE;
  if (path !== ADMIN_PATH) return path;

  const view = new URL(window.location.href).searchParams.get("hr");
  if (view === "new") return NEW_EMPLOYEE_ROUTE;
  if (view === "employees") return EMPLOYEES_ROUTE;
  return ADMIN_PATH;
}

function modeFromRoute(route: EmployeeRouteState | string): EmployeeCenterMode | null {
  if (route === NEW_EMPLOYEE_ROUTE) return "new";
  if (route === EMPLOYEES_ROUTE) return "directory";
  return null;
}

function replaceRoute(route: EmployeeRouteState) {
  const url = new URL(window.location.href);
  url.pathname = ADMIN_PATH;
  url.search = "";

  if (route === NEW_EMPLOYEE_ROUTE) url.searchParams.set("hr", "new");
  if (route === EMPLOYEES_ROUTE) url.searchParams.set("hr", "employees");

  window.history.replaceState(window.history.state, "", url);

  // BrowserRouter only reacts to history events. Dispatching popstate keeps the
  // URL, React Router and the embedded HR workspace synchronized immediately.
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  window.dispatchEvent(new CustomEvent<EmployeeRouteState>(EMPLOYEE_PATH_EVENT, { detail: route }));
}

function matchingButton(root: Element, labels: string[]) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
    return labels.some((label) => text === label || text.includes(label));
  });
}

function ensureTarget(root: HTMLElement, surface: Surface, mode: EmployeeCenterMode, anchor: HTMLButtonElement, index: number) {
  const key = `dn-employee-nav-host-${surface}-${mode}-${index}`;
  let host = root.querySelector<HTMLElement>(`[data-dn-employee-host="${key}"]`);
  if (!host) {
    host = document.createElement("span");
    host.className = "dn-employee-nav-host";
    host.dataset.dnEmployeeHost = key;
    anchor.insertAdjacentElement("afterend", host);
  }
  return { element: host, surface, mode } as Target;
}

function ensureNavigationTargets() {
  const targets: Target[] = [];
  document.querySelectorAll<HTMLElement>(".dn-admin-side-nav").forEach((root, index) => {
    const addMerchant = matchingButton(root, ["إضافة تاجر", "New Merchant", "Add Merchant"]);
    const merchants = matchingButton(root, ["التجار", "Merchants"]);
    if (addMerchant) targets.push(ensureTarget(root, "legacy", "new", addMerchant, index));
    if (merchants) targets.push(ensureTarget(root, "legacy", "directory", merchants, index));
  });
  return targets;
}

function sameTargets(left: Target[], right: Target[]) {
  return left.length === right.length && left.every((item, index) =>
    item.element === right[index]?.element && item.surface === right[index]?.surface && item.mode === right[index]?.mode,
  );
}

function EmployeeNavButton({ mode, active, isArabic, onOpen }: {
  mode: EmployeeCenterMode;
  active: boolean;
  isArabic: boolean;
  onOpen: () => void;
}) {
  const isNew = mode === "new";
  const Icon = isNew ? UserPlus : UsersRound;
  const title = isNew ? (isArabic ? "إضافة موظف" : "Add Employee") : (isArabic ? "الموظفون" : "Employees");
  const subtitle = isNew
    ? (isArabic ? "وظيفة • هاتف • راتب" : "Role • Phone • Salary")
    : (isArabic ? "البطاقات • الرواتب • الخصومات" : "Cards • Payroll • Deductions");

  return <button type="button" className={`dn-employee-nav ${active ? "is-active" : ""}`} onClick={onOpen} aria-current={active ? "page" : undefined}><span className="dn-admin-sidebar-icon"><Icon className="h-4 w-4" /></span><span className="dn-employee-nav-copy"><strong>{title}</strong><small>{subtitle}</small></span></button>;
}

export default function AdminEmployeeLauncher() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [route, setRoute] = useState<EmployeeRouteState | string>(routeState);
  const [targets, setTargets] = useState<Target[]>([]);
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const activeMode = modeFromRoute(route);
  const isAdminRoute = normalizedPathname().startsWith(ADMIN_PATH);

  useEffect(() => {
    if (!isAdminRoute) {
      setTargets([]);
      setWorkspace(null);
      return;
    }
    const sync = () => {
      const liveRoute = routeState();
      setRoute((current) => current === liveRoute ? current : liveRoute);
      const nextTargets = ensureNavigationTargets();
      setTargets((current) => sameTargets(current, nextTargets) ? current : nextTargets);
      const nextWorkspace = document.querySelector<HTMLElement>(".dn-admin-workspace-host");
      setWorkspace((current) => current === nextWorkspace ? current : nextWorkspace);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(sync, 1200);
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, [isAdminRoute]);

  useEffect(() => {
    const sync = () => setRoute(routeState());
    const custom = (event: Event) => setRoute((event as CustomEvent<EmployeeRouteState>).detail || routeState());
    window.addEventListener("popstate", sync);
    window.addEventListener(EMPLOYEE_PATH_EVENT, custom);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(EMPLOYEE_PATH_EVENT, custom);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dn-employee-hr-embedded", Boolean(activeMode));
    return () => document.body.classList.remove("dn-employee-hr-embedded");
  }, [activeMode]);

  useEffect(() => {
    if (!activeMode) return;
    const capture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const regularButton = target?.closest<HTMLButtonElement>(
        ".dn-admin-side-nav button:not(.dn-employee-nav)",
      );
      if (regularButton) {
        replaceRoute(ADMIN_PATH);
        setRoute(ADMIN_PATH);
      }
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, [activeMode]);

  function open(mode: EmployeeCenterMode) {
    const next = mode === "new" ? NEW_EMPLOYEE_ROUTE : EMPLOYEES_ROUTE;
    replaceRoute(next);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isAdminRoute) return null;

  return <>
    {targets.map((target, index) => createPortal(
      <EmployeeNavButton mode={target.mode} active={activeMode === target.mode} isArabic={isArabic} onOpen={() => open(target.mode)} />,
      target.element,
      `${target.surface}-${target.mode}-${index}`,
    ))}
    {activeMode && workspace && createPortal(
      <div className="dn-employee-hr-embedded-root"><AdminEmployeesCenter isArabic={isArabic} mode={activeMode} onNavigate={(next) => open(next === LEGACY_NEW_EMPLOYEE_PATH ? "new" : "directory")} /></div>,
      workspace,
      "employee-hr-workspace",
    )}
    <EmployeePayrollStatementActions active={activeMode === "directory"} isArabic={isArabic} />
  </>;
}
