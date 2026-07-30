import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Crown,
  FileBarChart,
  MessageSquare,
  PackagePlus,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ADMIN_IDENTITY } from "../../config/adminIdentity";

export type AbuKhalifaAction =
  | "new-order"
  | "orders"
  | "employees"
  | "payroll"
  | "reports"
  | "messages";

type Props = {
  isArabic: boolean;
  isAvailable?: boolean;
  sidebarWidth?: number;
  ordersToday?: number;
  activeServices?: number;
  lastSync?: string;
  currentSection?: string;
  onNavigate: (action: AbuKhalifaAction) => void;
};

type QuickAction = {
  id: AbuKhalifaAction;
  icon: LucideIcon;
  ar: string;
  en: string;
  descriptionAr: string;
  descriptionEn: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "new-order",
    icon: PackagePlus,
    ar: "إضافة طلب جديد",
    en: "New Order",
    descriptionAr: "إنشاء طلب وتشغيله مباشرة",
    descriptionEn: "Create and launch an order",
  },
  {
    id: "orders",
    icon: ClipboardList,
    ar: "متابعة الطلبات",
    en: "Orders",
    descriptionAr: "مراجعة حالة العمليات الحالية",
    descriptionEn: "Review active operations",
  },
  {
    id: "employees",
    icon: Users,
    ar: "الموارد البشرية",
    en: "Employees",
    descriptionAr: "الموظفون والحضور والملفات",
    descriptionEn: "Staff, attendance and records",
  },
  {
    id: "payroll",
    icon: WalletCards,
    ar: "الرواتب والمالية",
    en: "Payroll",
    descriptionAr: "الرواتب والبدلات والخصومات",
    descriptionEn: "Payroll, allowances and deductions",
  },
  {
    id: "reports",
    icon: BarChart3,
    ar: "التقارير",
    en: "Reports",
    descriptionAr: "قراءة الأداء ومؤشرات التشغيل",
    descriptionEn: "Performance and operations data",
  },
  {
    id: "messages",
    icon: MessageSquare,
    ar: "مركز الرسائل",
    en: "Messages",
    descriptionAr: "التواصل والمتابعة الإدارية",
    descriptionEn: "Administrative communication",
  },
];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function displayMetric(value: number | undefined): string {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US").format(value)
    : "—";
}

export default function AbuKhalifaExecutiveCard({
  isArabic,
  isAvailable = true,
  sidebarWidth = 288,
  ordersToday,
  activeServices,
  lastSync = "—",
  currentSection,
  onNavigate,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const direction = isArabic ? "rtl" : "ltr";
  const OpenIcon = isArabic ? ChevronLeft : ChevronRight;
  const name = isArabic ? ADMIN_IDENTITY.nameAr : ADMIN_IDENTITY.nameEn;
  const secondaryName = isArabic ? ADMIN_IDENTITY.nameEn : ADMIN_IDENTITY.nameAr;
  const role = isArabic ? ADMIN_IDENTITY.roleAr : ADMIN_IDENTITY.roleEn;
  const secondaryRole = isArabic ? ADMIN_IDENTITY.roleEn : ADMIN_IDENTITY.roleAr;

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();
    document.body.classList.add("executive-panel-open");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        window.requestAnimationFrame(() => launcherRef.current?.focus());
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.classList.remove("executive-panel-open");
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  function closePanel() {
    setIsOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function runAction(action: AbuKhalifaAction) {
    onNavigate(action);
    closePanel();
  }

  function handleLauncherKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setIsOpen(true);
  }

  const portalStyle = {
    "--admin-sidebar-width": `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <div className="abu-khalifa-card-shell" dir={direction} data-testid="abu-khalifa-executive-card">
      <button
        ref={launcherRef}
        type="button"
        className="abu-khalifa-launcher"
        data-testid="abu-khalifa-executive-launcher"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        onKeyDown={handleLauncherKeyDown}
      >
        <span className="abu-khalifa-launcher__shine" aria-hidden="true" />
        <span className="abu-khalifa-launcher__identity">
          <span className="abu-khalifa-launcher__avatar">
            <img
              src={ADMIN_IDENTITY.logoUrl}
              alt={isArabic ? "شعار أبو خليفه" : "Abu Khalifa logo"}
            />
            <span
              className={`abu-khalifa-status-dot ${isAvailable ? "is-online" : "is-offline"}`}
              aria-hidden="true"
            />
          </span>

          <span className="abu-khalifa-launcher__copy">
            <strong>{name}</strong>
            <small>{role}</small>
            <span className="abu-khalifa-launcher__status">
              <Wifi size={12} aria-hidden="true" />
              {isAvailable
                ? isArabic
                  ? "متاح الآن"
                  : "Available now"
                : isArabic
                  ? "غير متاح"
                  : "Unavailable"}
            </span>
          </span>
        </span>

        <span className="abu-khalifa-launcher__open">
          <OpenIcon size={18} aria-hidden="true" />
        </span>
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="abu-khalifa-portal" style={portalStyle} dir={direction}>
            <button
              type="button"
              className="abu-khalifa-backdrop"
              aria-label={isArabic ? "إغلاق بطاقة أبو خليفه" : "Close Abu Khalifa panel"}
              onClick={closePanel}
            />

            <aside
              ref={dialogRef}
              className="abu-khalifa-flyout"
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              aria-describedby={dialogDescriptionId}
            >
              <span className="abu-khalifa-flyout__ambient" aria-hidden="true" />

              <header className="abu-khalifa-flyout__header">
                <div className="abu-khalifa-flyout__eyebrow">
                  <Crown size={15} aria-hidden="true" />
                  <span>
                    {isArabic ? "بطاقة القيادة التنفيذية" : "Executive Command Profile"}
                  </span>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="abu-khalifa-icon-button"
                  aria-label={isArabic ? "إغلاق" : "Close"}
                  onClick={closePanel}
                >
                  <X size={19} aria-hidden="true" />
                </button>
              </header>

              <section className="abu-khalifa-profile">
                <div className="abu-khalifa-profile__logo-wrap">
                  <span className="abu-khalifa-profile__halo" aria-hidden="true" />
                  <img
                    className="abu-khalifa-profile__logo"
                    src={ADMIN_IDENTITY.logoUrl}
                    alt={isArabic ? "شعار المدير العام أبو خليفه" : "General Manager Abu Khalifa logo"}
                  />
                  <span className="abu-khalifa-profile__crown">
                    <Crown size={16} aria-hidden="true" />
                  </span>
                </div>

                <div className="abu-khalifa-profile__identity">
                  <div className="abu-khalifa-profile__name-row">
                    <div>
                      <h2 id={dialogTitleId}>{name}</h2>
                      <p>{secondaryName}</p>
                    </div>
                    <span className={`abu-khalifa-availability ${isAvailable ? "is-online" : "is-offline"}`}>
                      <span aria-hidden="true" />
                      {isAvailable
                        ? isArabic
                          ? "متاح الآن"
                          : "Available"
                        : isArabic
                          ? "غير متاح"
                          : "Unavailable"}
                    </span>
                  </div>

                  <div className="abu-khalifa-profile__role">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <strong>{role}</strong>
                    <span aria-hidden="true">·</span>
                    <small>{secondaryRole}</small>
                  </div>
                </div>
              </section>

              <section className="abu-khalifa-leadership-copy">
                <div className="abu-khalifa-leadership-copy__icon">
                  <Sparkles size={19} aria-hidden="true" />
                </div>
                <div>
                  <h3>
                    {isArabic
                      ? "قائد العمليات والإشراف الإداري"
                      : "Operations and Administrative Leadership"}
                  </h3>
                  <p id={dialogDescriptionId}>
                    {isArabic
                      ? "يشرف على التشغيل اليومي، جودة التنفيذ، فرق العمل، والتقارير الإدارية للشركة."
                      : "Oversees daily operations, execution quality, workforce performance and administrative reporting."}
                  </p>
                </div>
              </section>

              {currentSection && (
                <div className="abu-khalifa-current-section">
                  <Activity size={15} aria-hidden="true" />
                  <span>{isArabic ? "القسم الحالي" : "Current section"}</span>
                  <strong>{currentSection}</strong>
                </div>
              )}

              <section
                className="abu-khalifa-metrics"
                aria-label={isArabic ? "مؤشرات المدير" : "Manager indicators"}
              >
                <article>
                  <span><ClipboardList size={16} aria-hidden="true" /></span>
                  <div>
                    <small>{isArabic ? "طلبات اليوم" : "Orders Today"}</small>
                    <strong>{displayMetric(ordersToday)}</strong>
                  </div>
                </article>
                <article>
                  <span><Activity size={16} aria-hidden="true" /></span>
                  <div>
                    <small>{isArabic ? "الخدمات النشطة" : "Active Services"}</small>
                    <strong>{displayMetric(activeServices)}</strong>
                  </div>
                </article>
                <article>
                  <span><Clock3 size={16} aria-hidden="true" /></span>
                  <div>
                    <small>{isArabic ? "آخر مزامنة" : "Last Sync"}</small>
                    <strong dir="ltr">{lastSync}</strong>
                  </div>
                </article>
              </section>

              <section className="abu-khalifa-actions">
                <div className="abu-khalifa-section-heading">
                  <div>
                    <small>{isArabic ? "الوصول السريع" : "Quick Access"}</small>
                    <h3>
                      {isArabic ? "مركز قيادة أبو خليفه" : "Abu Khalifa Command Center"}
                    </h3>
                  </div>
                  <FileBarChart size={20} aria-hidden="true" />
                </div>

                <div className="abu-khalifa-actions__grid">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className="abu-khalifa-action"
                        onClick={() => runAction(action.id)}
                      >
                        <span className="abu-khalifa-action__icon">
                          <Icon size={19} aria-hidden="true" />
                        </span>
                        <span className="abu-khalifa-action__copy">
                          <strong>{isArabic ? action.ar : action.en}</strong>
                          <small>
                            {isArabic ? action.descriptionAr : action.descriptionEn}
                          </small>
                        </span>
                        <OpenIcon className="abu-khalifa-action__arrow" size={16} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>

              <footer className="abu-khalifa-flyout__footer">
                <div>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>{isArabic ? "صلاحيات المدير العام" : "General Manager Access"}</span>
                </div>
                <span className="abu-khalifa-secure-badge">
                  {isArabic ? "وصول إداري آمن" : "Secure Admin Access"}
                </span>
              </footer>
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}
