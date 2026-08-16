import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareWarning } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import useOpenComplaintsCount from "../../hooks/useOpenComplaintsCount";
import AdminCustomerExperienceActions from "./AdminCustomerExperienceActions";
import AdminCustomerExperiencePage from "./AdminCustomerExperiencePage";
import AdminMessageControlCenter from "./AdminMessageControlCenter";
import "../../styles/dn-customer-experience-navigation.css";

type NavSurface = "legacy" | "command";
type NavTarget = { element: HTMLElement; surface: NavSurface };

const CUSTOMER_EXPERIENCE_PATH = "/admin/customer-experience";
const CUSTOMER_EXPERIENCE_PATH_EVENT = "dn-customer-experience-path";
const ADMIN_COMMAND_SECTION_EVENT = "dn-admin-command-section-change";
const RETURNED_LABELS = ["الطلبات الراجعة", "Returned Orders"];
const FINANCE_LABELS = ["المالية", "Finance"];

function currentPathname() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname.replace(/\/+$/, "") || "/"}${window.location.search}`;
}

function isCustomerExperiencePath(locationKey: string) {
  const url = new URL(locationKey || "/", window.location.origin);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return pathname === CUSTOMER_EXPERIENCE_PATH || (pathname === "/admin" && url.searchParams.get("cx") === "messages");
}

function replaceAdminPath(pathname: string) {
  const url = new URL(window.location.href);
  const openMessageCenter = pathname === CUSTOMER_EXPERIENCE_PATH;
  url.pathname = "/admin";
  url.search = "";
  if (openMessageCenter) url.searchParams.set("cx", "messages");
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new CustomEvent(CUSTOMER_EXPERIENCE_PATH_EVENT, { detail: `${url.pathname}${url.search}` }));
}

function normalizedText(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function matchingReturnedButton(root: Element) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = normalizedText(button);
    return RETURNED_LABELS.some((label) => text.includes(label));
  });
}

function matchingFinanceSection(root: Element) {
  return Array.from(root.querySelectorAll<HTMLElement>(":scope > section")).find((section) => {
    const heading = normalizedText(section.querySelector("h3"));
    return FINANCE_LABELS.some((label) => heading === label || heading.includes(label));
  });
}

function ensureLegacyTarget(root: HTMLElement, index: number, isArabic: boolean) {
  const selector = `section[data-dn-customer-experience-section="${index}"]`;
  let section = root.querySelector<HTMLElement>(selector);
  if (!section) {
    section = document.createElement("section");
    section.dataset.dnCustomerExperienceSection = String(index);
    section.className = "dn-customer-experience-native-section";

    const heading = document.createElement("h3");
    heading.dataset.dnCustomerExperienceHeading = "true";
    section.appendChild(heading);

    const host = document.createElement("span");
    host.className = "dn-customer-experience-nav-host dn-customer-experience-nav-host-legacy";
    host.dataset.dnTargetIndex = String(index);
    section.appendChild(host);

    const returnedGroup = matchingReturnedButton(root)?.closest("section");
    const financeGroup = matchingFinanceSection(root);
    if (returnedGroup?.parentElement === root) returnedGroup.insertAdjacentElement("afterend", section);
    else if (financeGroup?.parentElement === root) root.insertBefore(section, financeGroup);
    else root.appendChild(section);
  }

  const heading = section.querySelector<HTMLElement>("[data-dn-customer-experience-heading]");
  const nextHeading = isArabic ? "خدمة العملاء" : "Customer Service";
  if (heading && heading.textContent !== nextHeading) heading.textContent = nextHeading;
  return section.querySelector<HTMLElement>(".dn-customer-experience-nav-host-legacy");
}

function ensureCommandTarget(root: HTMLElement, index: number) {
  const hostClass = "dn-customer-experience-nav-host-command";
  let host = root.querySelector<HTMLElement>(`.${hostClass}[data-dn-target-index="${index}"]`);
  if (!host) {
    host = document.createElement("span");
    host.className = `dn-customer-experience-nav-host ${hostClass}`;
    host.dataset.dnTargetIndex = String(index);
    const returnedButton = matchingReturnedButton(root);
    if (returnedButton) returnedButton.insertAdjacentElement("afterend", host);
    else root.appendChild(host);
  }
  return host;
}

function ensureNavigationTargets(isArabic: boolean) {
  const targets: NavTarget[] = [];

  document.querySelectorAll<HTMLElement>(".dn-admin-side-nav").forEach((root, index) => {
    const host = ensureLegacyTarget(root, index, isArabic);
    if (host) targets.push({ element: host, surface: "legacy" });
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
  const title = isArabic ? "مركز الرسائل" : "Message Center";
  const subtitle = isArabic ? "الرسائل • الشكاوى • التقييمات" : "Messages • Complaints • Ratings";

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
  const isAdminRoute = /^\/admin(?:\/|\?|$)/.test(pathname);
  const active = isCustomerExperiencePath(pathname);
  const count = useOpenComplaintsCount(isAdminRoute);

  useEffect(() => {
    if (!isAdminRoute) {
      setNavTargets([]);
      setWorkspaceTarget(null);
      return;
    }

    let timer = 0;
    let attempts = 0;
    const syncTargets = () => {
      const livePath = currentPathname();
      setPathname((current) => (current === livePath ? current : livePath));
      const nextTargets = ensureNavigationTargets(isArabic);
      setNavTargets((current) => (sameTargets(current, nextTargets) ? current : nextTargets));
      const nextWorkspace = document.querySelector<HTMLElement>(".dn-admin-workspace-host");
      setWorkspaceTarget((current) => (current === nextWorkspace ? current : nextWorkspace));
      return Boolean(nextTargets.length && nextWorkspace);
    };
    const acquire = () => {
      attempts += 1;
      if (syncTargets() || attempts >= 40) {
        if (timer) window.clearInterval(timer);
        timer = 0;
      }
    };
    const reacquire = () => {
      attempts = 0;
      if (syncTargets()) return;
      if (!timer) timer = window.setInterval(acquire, 250);
    };

    acquire();
    if (!timer) timer = window.setInterval(acquire, 250);
    window.addEventListener(ADMIN_COMMAND_SECTION_EVENT, reacquire);
    return () => {
      if (timer) window.clearInterval(timer);
      window.removeEventListener(ADMIN_COMMAND_SECTION_EVENT, reacquire);
    };
  }, [isAdminRoute, isArabic]);

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
        return;
      }

      const regularAdminButton = target?.closest<HTMLButtonElement>(
        ".dn-admin-side-nav button:not(.dn-customer-experience-nav), .dncc-navigation button:not(.dn-customer-experience-nav):not([data-dn-command-section=\"customer_experience\"])",
      );
      if (regularAdminButton) replaceAdminPath("/admin");
    };

    document.addEventListener("click", captureAdminNavigation, true);
    return () => document.removeEventListener("click", captureAdminNavigation, true);
  }, [active]);

  const openCustomerExperience = () => {
    replaceAdminPath(CUSTOMER_EXPERIENCE_PATH);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sectionLabels = useMemo(
    () =>
      isArabic
        ? ["مركز الرسائل", "التقييمات", "الشكاوى", "سجل الإرسال", "قوالب الرسائل"]
        : ["Message Center", "Ratings", "Complaints", "Message log", "Message templates"],
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
            <div className="dn-customer-experience-section-map" aria-label={isArabic ? "أقسام مركز الرسائل" : "Message Center sections"}>
              {sectionLabels.map((label) => <span key={label}>{label}</span>)}
            </div>
            <AdminMessageControlCenter isArabic={isArabic} />
            <AdminCustomerExperiencePage />
            <AdminCustomerExperienceActions />
          </div>,
          workspaceTarget,
          "customer-experience-workspace",
        )}
    </>
  );
}
