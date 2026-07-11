import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  Eye,
  FileMinus,
  FileText,
  Globe2,
  Headphones,
  Import,
  Info,
  Landmark,
  Languages,
  Layers,
  LayoutDashboard,
  Loader2,
  LocateFixed,
  LogOut,
  MapPinned,
  MousePointerClick,
  Package,
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Printer,
  Radio,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Route,
  Scale,
  Search,
  SearchCheck,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Truck,
  UserRoundX,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const iconMap = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  "active-orders": Activity,
  "delivered-orders": PackageCheck,
  "pending-orders": Clock,
  "unassigned-orders": UserRoundX,
  cod: ReceiptText,
  income: TrendingUp,
  finance: BarChart3,
  expenses: FileMinus,
  accounts: Landmark,
  adjustments: Scale,
  audit: ShieldCheck,
  "database-health": Database,
  "production-readiness": ShieldCheck,
  "pdf-export": FileText,
  refresh: RefreshCw,
  "add-order": PackagePlus,
  "add-merchant": Store,
  "review-orders": ClipboardCheck,
  map: MapPinned,
  route: Route,
  "zoom-in": ZoomIn,
  "zoom-out": ZoomOut,
  "reset-map": RotateCcw,
  "fit-route": Route,
  "focus-driver": LocateFixed,
  driver: Truck,
  merchant: Store,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  "empty-state": Archive,
  khalifa: Bot,
  "khalifa-insight": Sparkles,
  "live-data": Radio,
  "quick-help": Sparkles,
  "shipment-details": PackageSearch,
  "daily-closing": Clock,
  language: Languages,
  settings: Settings,
  notifications: Bell,
  search: Search,
  view: Eye,
  click: MousePointerClick,
  send: Send,
  clear: Trash2,
  package: Package,
  "cancelled-orders": XCircle,
  "review-orders-status": SearchCheck,
  "postponed-orders": CalendarClock,
  "returned-orders": RotateCcw,
  "external-orders": Globe2,
  "out-scope": AlertOctagon,
  printer: Printer,
  import: Import,
  support: Headphones,
  logout: LogOut,
  layers: Layers,
} satisfies Record<string, LucideIcon>;

export type AdminIconName = keyof typeof iconMap;
export type AdminIconTone = "info" | "success" | "warning" | "danger" | "neutral" | "gold" | "error";

type IconizedBaseProps = {
  icon: AdminIconName;
  title: ReactNode;
  tone?: AdminIconTone;
  dir?: "rtl" | "ltr";
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
};

export function getAdminIcon(name?: AdminIconName): LucideIcon {
  return (name && iconMap[name]) || Sparkles;
}

export function AdminIconBadge({
  name = "info",
  label,
  className = "",
}: {
  name?: AdminIconName;
  label?: string;
  className?: string;
}) {
  const Icon = getAdminIcon(name);

  return (
    <span className={`dn-admin-icon-badge ${className}`} role={label ? "img" : "presentation"} aria-label={label}>
      <Icon className="dn-admin-svg-icon" aria-hidden="true" focusable="false" />
    </span>
  );
}

export function AdminStateChip({
  name = "info",
  children,
  tone = "info",
}: {
  name?: AdminIconName;
  children: ReactNode;
  tone?: AdminIconTone;
}) {
  const Icon = getAdminIcon(name);

  return (
    <span className={`dn-admin-state-chip is-${tone}`}>
      <Icon className="dn-admin-state-icon" aria-hidden="true" focusable="false" />
      <span>{children}</span>
    </span>
  );
}

export function AdminEmptyState({
  title,
  message,
  action,
  icon = "empty-state",
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: AdminIconName;
}) {
  return (
    <div className="dn-admin-empty-state">
      <AdminIconBadge name={icon} label={title} />
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}

function IconizedShell({
  as: Tag = "article",
  icon,
  title,
  tone = "gold",
  dir,
  className = "",
  children,
  disabled,
  loading,
}: IconizedBaseProps & { as?: "article" | "div" }) {
  const Icon = getAdminIcon(icon);

  return (
    <Tag dir={dir} className={`dn-iconized dn-iconized-${tone} ${disabled ? "is-disabled" : ""} ${className}`} aria-disabled={disabled || undefined}>
      <span className="dn-iconized-icon" aria-hidden="true">
        {loading ? <Loader2 className="dn-spin" aria-hidden="true" focusable="false" /> : <Icon aria-hidden="true" focusable="false" />}
      </span>
      <span className="dn-iconized-content">
        <strong>{title}</strong>
        {children}
      </span>
    </Tag>
  );
}

export function IconizedPanelHeader(props: IconizedBaseProps & { eyebrow?: ReactNode; action?: ReactNode }) {
  return (
    <header className={`dn-iconized-panel-header ${props.className || ""}`} dir={props.dir}>
      <IconizedShell as="div" {...props} className="">
        {props.eyebrow && <small>{props.eyebrow}</small>}
        {props.children}
      </IconizedShell>
      {props.action}
    </header>
  );
}

export function IconizedMetricCard(props: IconizedBaseProps & { value: ReactNode; hint?: ReactNode }) {
  return (
    <IconizedShell {...props} className={`dn-iconized-metric ${props.className || ""}`}>
      <b>{props.value}</b>
      {props.hint && <em>{props.hint}</em>}
    </IconizedShell>
  );
}

export function IconizedActionTile({
  icon,
  title,
  hint,
  onClick,
  ariaLabel,
  tone = "gold",
  dir,
  disabled,
  loading,
  className = "",
}: IconizedBaseProps & { hint?: ReactNode; onClick?: () => void; ariaLabel: string }) {
  const Icon = getAdminIcon(icon);

  return (
    <button
      type="button"
      className={`dn-iconized-action-tile dn-iconized-${tone} ${className}`}
      dir={dir}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="dn-iconized-icon" aria-hidden="true">
        {loading ? <Loader2 className="dn-spin" aria-hidden="true" focusable="false" /> : <Icon aria-hidden="true" focusable="false" />}
      </span>
      <span>
        <strong>{title}</strong>
        {hint && <em>{hint}</em>}
      </span>
    </button>
  );
}

export function IconizedMapControlButton({
  icon,
  title,
  ariaLabel,
  onClick,
  active,
  disabled,
  loading,
  tone = "gold",
}: {
  icon: AdminIconName;
  title: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tone?: AdminIconTone;
}) {
  const Icon = getAdminIcon(icon);

  return (
    <button
      type="button"
      className={`dn-map-control-button dn-iconized-${tone} ${active ? "is-active" : ""}`}
      aria-label={ariaLabel}
      title={String(title)}
      aria-pressed={active}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 className="dn-spin" aria-hidden="true" focusable="false" /> : <Icon aria-hidden="true" focusable="false" />}
    </button>
  );
}

export function IconizedSectionButton(props: Parameters<typeof IconizedActionTile>[0]) {
  return <IconizedActionTile {...props} className={`dn-iconized-section-button ${props.className || ""}`} />;
}

export function IconizedEmptyState(props: IconizedBaseProps & { message: ReactNode; action?: ReactNode }) {
  return (
    <IconizedShell {...props} className={`dn-iconized-empty ${props.className || ""}`}>
      <p>{props.message}</p>
      {props.action}
    </IconizedShell>
  );
}

export function IconizedStatusRow(props: IconizedBaseProps & { value?: ReactNode }) {
  return (
    <IconizedShell as="div" {...props} className={`dn-iconized-status-row ${props.className || ""}`}>
      {props.value && <b>{props.value}</b>}
      {props.children}
    </IconizedShell>
  );
}
