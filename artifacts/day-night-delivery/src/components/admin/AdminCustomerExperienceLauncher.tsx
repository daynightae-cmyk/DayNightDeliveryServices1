import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareWarning } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import useOpenComplaintsCount from "../../hooks/useOpenComplaintsCount";
import AdminCustomerExperienceActions from "./AdminCustomerExperienceActions";
import AdminCustomerExperiencePage from "./AdminCustomerExperiencePage";
import "../../styles/dn-customer-experience-navigation.css";

type NavSurface = "legacy" | "command";
type NavTarget = { element: HTMLElement; surface: NavSurface };

const CUSTOMER_EXPERIENCE_PATH = "/admin/customer-experience";
const CUSTOMER_EXPERIENCE_PATH_EVENT = "dn-customer-experience-path";
const RETURNED_LABELS = ["الطلبات الراجعة", "Returned Orders"];

function currentPathname() {
  return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/+$/, "") || "/";
}

function isCustomerExperiencePath(pathname: string) {
  return pathname === CUSTOMER_EXPERIENCE_PATH;
}

function replaceAdminPath(pathname: string) {
  const url = new URL(window.location.href);
  url.pathname = pathname;
  if (pathname === "/admin") url.search = "";
  window.history.replaceState({}, "", url);
}

function matchingReturnedButton(root: Element) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
    return RETURNED_LABELS.some((label) => text.includes(label));
  });
}

function ensureNavigationTargets() {
  const targets: NavTarget[] = [];
  const roots: Array<{ selector: string; surface: NavSurface }> = [
    { selector: ".dn-admin-side-nav", surface: "legacy" },
    { selector: ".dncc-navigation", surface: "command" },
  ];

  roots.forEach(({ selector, surface }) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((root, index) => {
      const returnedButton = matchingReturnedButton(root);
      if (!returnedButton?.parentElement) return;

      const hostClass = `dn-customer-experience-nav-host-${surface}`;
      let host = root.querySelector<HTMLElement>(`.${hostClass}[data-dn-target-index="${index}"]`);
      if (!host) {
        host = document.createElement("span");
        host.className = `dn-customer-experience-nav-host ${hostClass}`;
        host.dataset.dnTargetIndex = String(index);
        returnedButton.insertAdjacentElement("afterend", host);
      }
      targets.push({ element: host, surface });
    });
  });

  return targets;
}

function sameTargets(left: NavTarget[], right: NavTarget[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.element === right[index]?.element && item.surface === right[index]?.surface)
  );
}

function ComplaintBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <b className="dn-customer-experience-badge">{count > 99 ? "99+" : count}</b>;
}

function CustomerExperienceNavButton({
  surface,
  isArabic,
  active,
  count,
  onOpen,
}: {
  surface: NavSurface;
  isArabic: boolean;
  active: boolean;
  count: number;
  onOpen: () => void;
}) {
  const title = isArabic ? "تجربة العملاء" : "Customer Experience";
  const subtitle = isArabic ? "التقييمات • الشكاوى • الرسائل" : "Ratings • Complaints • Messages";

  if (surface === "command") {
    return (
      <button
        type="button"
        className={`dn-customer-experience-nav ${active ? "is-active" : ""}`}
        onClick={onOpen}
        title={`${title} — ${subtitle}`}
        aria-current={active ? "page" : undefined}
      >
        <span className="dncc-nav-icon relative">
          <MessageSquareWarning />
          <ComplaintBadge count={count} />
        </span>
        <span className="dncc-nav-copy dn-customer-experience-nav-copy">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`dn-customer-experience-nav ${active ? "is-active" : ""}`}
      onClick={onOpen}
      title={`${title} — ${subtitle}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="dn-admin-sidebar-icon relative">
        <MessageSquareWarning className="h-4 w-4" />
        <ComplaintBadge count={count} />
      </span>
      <span className="dn-customer-experience-nav-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </button>
  );
}

export default function AdminCustomerExperienceLauncher() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [pathname, setPathname] = useState(currentPathname);
  const [navTargets, setNavTargets] = useState<NavTarget[]>([]);
  const [workspaceTarget, setWorkspaceTarget] = useState<HTMLElement | null>(null);
  const isAdminRoute = /^\/admin(?:\/|$)/.test(pathname);
  const active = isCustomerExperiencePath(pathname);
  const count = useOpenComplaintsCount(isAdminRoute);

  useEffect(() => {
    if (!isAdminRoute) {
      setNavTargets([]);
      setWorkspaceTarget(null);
      return;
    }

    const syncTargets = () => {
      const livePath = currentPathname();
      setPathname((current) => (current === livePath ? current : livePath));
      const nextTargets = ensureNavigationTargets();
      setNavTargets((current) => (sameTargets(current, nextTargets) ? current : nextTargets));
      const nextWorkspace = document.querySelector<HTMLElement>(".dn-admin-workspace-host");
      setWorkspaceTarget((current) => (current === nextWorkspace ? current : nextWorkspace));
    };

    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(syncTargets, 1200);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [isAdminRoute]);

  useEffect(() => {
    const syncPath = () => setPathname(currentPathname());
    const syncCustomPath = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setPathname(detail || currentPathname());
    };
    window.addEventListener("popstate", syncPath);
    window.addEventListener(CUSTOMER_EXPERIENCE_PATH_EVENT, syncCustomPath);
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener(CUSTOMER_EXPERIENCE_PATH_EVENT, syncCustomPath);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dn-customer-experience-embedded", active);
    return () => document.body.classList.remove("dn-customer-experience-embedded");
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const captureAdminNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const backLink = target?.closest<HTMLAnchorElement>('a[href="/admin"]');
      if (backLink) {
        event.preventDefault();
        replaceAdminPath("/admin");
        setPathname("/admin");
        return;
      }

      const regularAdminButton = target?.closest<HTMLButtonElement>(
        ".dn-admin-side-nav button:not(.dn-customer-experience-nav), .dncc-navigation button:not(.dn-customer-experience-nav)",
      );
      if (regularAdminButton) {
        replaceAdminPath("/admin");
        setPathname("/admin");
      }
    };

    document.addEventListener("click", captureAdminNavigation, true);
    return () => document.removeEventListener("click", captureAdminNavigation, true);
  }, [active]);

  const openCustomerExperience = () => {
    replaceAdminPath(CUSTOMER_EXPERIENCE_PATH);
    setPathname(CUSTOMER_EXPERIENCE_PATH);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sectionLabels = useMemo(
    () =>
      isArabic
        ? ["نظرة عامة", "التقييمات", "الشكاوى", "الرسائل", "إحصائيات رضا العملاء"]
        : ["Overview", "Ratings", "Complaints", "Messages", "Customer satisfaction analytics"],
    [isArabic],
  );

  if (!isAdminRoute) return null;

  return (
    <>
      {navTargets.map((target, index) =>
        createPortal(
          <CustomerExperienceNavButton
            surface={target.surface}
            isArabic={isArabic}
            active={active}
            count={count}
            onOpen={openCustomerExperience}
          />,
          target.element,
          `${target.surface}-${index}`,
        ),
      )}

      {active &&
        workspaceTarget &&
        createPortal(
          <div className="dn-customer-experience-embedded-root">
            <div className="dn-customer-experience-section-map" aria-label={isArabic ? "أقسام تجربة العملاء" : "Customer Experience sections"}>
              {sectionLabels.map((label) => <span key={label}>{label}</span>)}
            </div>
            <AdminCustomerExperiencePage />
            <AdminCustomerExperienceActions />
          </div>,
          workspaceTarget,
          "customer-experience-workspace",
        )}
    </>
  );
}
