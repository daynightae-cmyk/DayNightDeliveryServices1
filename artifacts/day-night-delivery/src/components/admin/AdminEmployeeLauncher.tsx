import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, UsersRound } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import AdminEmployeesCenter, { type EmployeeCenterMode } from "./AdminEmployeesCenter";
import "../../styles/dn-employee-hr-navigation.css";

type Surface = "legacy" | "command";
type Target = { element: HTMLElement; surface: Surface; mode: EmployeeCenterMode };

export const EMPLOYEE_PATH_EVENT = "dn-employee-hr-path";
const NEW_EMPLOYEE_PATH = "/admin/new-employee";
const EMPLOYEES_PATH = "/admin/employees";

function pathname() {
  return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/+$/, "") || "/";
}

function modeFromPath(path: string): EmployeeCenterMode | null {
  if (path === NEW_EMPLOYEE_PATH) return "new";
  if (path === EMPLOYEES_PATH) return "directory";
  return null;
}

function replacePath(path: string) {
  const url = new URL(window.location.href);
  url.pathname = path;
  if (path === "/admin") url.search = "";
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new CustomEvent<string>(EMPLOYEE_PATH_EVENT, { detail: path }));
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
  const roots: Array<{ selector: string; surface: Surface }> = [
    { selector: ".dn-admin-side-nav", surface: "legacy" },
    { selector: ".dncc-navigation", surface: "command" },
  ];

  roots.forEach(({ selector, surface }) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((root, index) => {
      const addMerchant = matchingButton(root, ["إضافة تاجر", "New Merchant", "Add Merchant"]);
      const merchants = matchingButton(root, ["التجار", "Merchants"]);
      if (addMerchant) targets.push(ensureTarget(root, surface, "new", addMerchant, index));
      if (merchants) targets.push(ensureTarget(root, surface, "directory", merchants, index));
    });
  });
  return targets;
}

function sameTargets(left: Target[], right: Target[]) {
  return left.length === right.length && left.every((item, index) =>
    item.element === right[index]?.element && item.surface === right[index]?.surface && item.mode === right[index]?.mode,
  );
}

function EmployeeNavButton({ surface, mode, active, isArabic, onOpen }: {
  surface: Surface;
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

  if (surface === "command") {
    return <button type="button" className={`dn-employee-nav dn-employee-nav-command ${active ? "is-active" : ""}`} onClick={onOpen} aria-current={active ? "page" : undefined}><span className="dncc-nav-icon"><Icon /></span><span className="dncc-nav-copy"><strong>{title}</strong><small>{subtitle}</small></span></button>;
  }

  return <button type="button" className={`dn-employee-nav ${active ? "is-active" : ""}`} onClick={onOpen} aria-current={active ? "page" : undefined}><span className="dn-admin-sidebar-icon"><Icon className="h-4 w-4" /></span><span className="dn-employee-nav-copy"><strong>{title}</strong><small>{subtitle}</small></span></button>;
}

export default function AdminEmployeeLauncher() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [path, setPath] = useState(pathname);
  const [targets, setTargets] = useState<Target[]>([]);
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const activeMode = modeFromPath(path);
  const isAdminRoute = /^\/admin(?:\/|$)/.test(path);

  useEffect(() => {
    if (!isAdminRoute) {
      setTargets([]);
      setWorkspace(null);
      return;
    }
    const sync = () => {
      const livePath = pathname();
      setPath((current) => current === livePath ? current : livePath);
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
    const sync = () => setPath(pathname());
    const custom = (event: Event) => setPath((event as CustomEvent<string>).detail || pathname());
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
        ".dn-admin-side-nav button:not(.dn-employee-nav), .dncc-navigation button:not(.dn-employee-nav)",
      );
      if (regularButton) {
        replacePath("/admin");
        setPath("/admin");
      }
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, [activeMode]);

  function open(mode: EmployeeCenterMode) {
    const next = mode === "new" ? NEW_EMPLOYEE_PATH : EMPLOYEES_PATH;
    replacePath(next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isAdminRoute) return null;

  return <>
    {targets.map((target, index) => createPortal(
      <EmployeeNavButton surface={target.surface} mode={target.mode} active={activeMode === target.mode} isArabic={isArabic} onOpen={() => open(target.mode)} />,
      target.element,
      `${target.surface}-${target.mode}-${index}`,
    ))}
    {activeMode && workspace && createPortal(
      <div className="dn-employee-hr-embedded-root"><AdminEmployeesCenter isArabic={isArabic} mode={activeMode} onNavigate={(next) => open(next === NEW_EMPLOYEE_PATH ? "new" : "directory")} /></div>,
      workspace,
      "employee-hr-workspace",
    )}
  </>;
}
