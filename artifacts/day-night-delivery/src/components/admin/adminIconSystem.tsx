import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  Eye,
  FileText,
  Gauge,
  Landmark,
  Languages,
  LayoutDashboard,
  LocateFixed,
  MapPinned,
  MousePointerClick,
  Navigation,
  PackagePlus,
  PackageSearch,
  Radar,
  RefreshCw,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  ZoomIn,
  ZoomOut,
  Bell,
  PackageCheck,
  UserRoundX,
  ReceiptText,
  TrendingUp,
  Send,
  Trash2,
  Package,
  XCircle,
  SearchCheck,
  CalendarClock,
  RotateCcw,
  Globe2,
  AlertOctagon,
  BarChart3,
  FileMinus,
  Scale,
  Printer,
  Import,
  Headphones,
  LogOut,
  Layers,
  Loader2,
} from "lucide-react";

export type AdminIconName =
  | "dashboard" | "orders" | "active-orders" | "delivered-orders" | "pending-orders" | "unassigned-orders"
  | "cod" | "income" | "finance" | "expenses" | "adjustments" | "database-health" | "production-readiness"
  | "pdf-export" | "refresh" | "add-order" | "add-merchant" | "review-orders" | "map" | "route" | "zoom-in"
  | "zoom-out" | "reset-map" | "fit-route" | "driver" | "merchant" | "audit" | "warning" | "success" | "error"
  | "info" | "empty-state" | "khalifa-insight" | "live-data" | "quick-help" | "shipment-details" | "daily-closing"
  | "language" | "settings" | "notifications" | "search" | "view" | "click" | "package-check" | "user-x" | "receipt-text" | "trending-up" | "send" | "clear" | "package" | "cancelled-orders" | "search-check" | "calendar-clock" | "returned-orders" | "globe" | "out-scope" | "bar-chart" | "file-minus" | "scale" | "printer" | "import" | "support" | "logout" | "layers" | "focus-driver";

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
  adjustments: Scale,
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
  driver: Truck,
  merchant: Store,
  audit: ShieldCheck,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertTriangle,
  info: Gauge,
  "empty-state": Archive,
  "khalifa-insight": Bot,
  "live-data": Radar,
  "quick-help": Sparkles,
  "shipment-details": PackageSearch,
  "daily-closing": ShieldCheck,
  language: Languages,
  settings: Settings,
  notifications: Bell,
  search: Eye,
  view: Navigation,
  click: MousePointerClick,
  "package-check": PackageCheck,
  "user-x": UserRoundX,
  "receipt-text": ReceiptText,
  "trending-up": TrendingUp,
  send: Send,
  clear: Trash2,
  package: Package,
  "cancelled-orders": XCircle,
  "search-check": SearchCheck,
  "calendar-clock": CalendarClock,
  "returned-orders": RotateCcw,
  globe: Globe2,
  "out-scope": AlertOctagon,
  "bar-chart": BarChart3,
  "file-minus": FileMinus,
  scale: Scale,
  printer: Printer,
  import: Import,
  support: Headphones,
  logout: LogOut,
  layers: Layers,
  "focus-driver": LocateFixed,
} satisfies Record<AdminIconName, typeof Activity>;

export function getAdminIcon(name: AdminIconName | undefined): ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false"; role?: string }> {
  return (name ? iconMap[name] : undefined) || Sparkles;
}

export type AdminIconTone = "info" | "success" | "warning" | "danger" | "neutral" | "gold";
type IconizedBaseProps = { icon: AdminIconName; title: ReactNode; tone?: AdminIconTone; dir?: "rtl" | "ltr"; className?: string; children?: ReactNode; disabled?: boolean; loading?: boolean; };

export function AdminIconBadge({ name, label, className = "" }: { name: AdminIconName; label?: string; className?: string }) {
  const Icon = getAdminIcon(name);
  return <span className={`dn-admin-icon-badge ${className}`} aria-label={label} aria-hidden={label ? undefined : true}><Icon className="h-4 w-4" /></span>;
}

export function AdminStateChip({ name = "info", children, tone = "info" }: { name?: AdminIconName; children: ReactNode; tone?: "info" | "success" | "warning" | "error" }) {
  const Icon = getAdminIcon(name);
  return <span className={`dn-admin-state-chip is-${tone}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{children}</span>;
}

export function AdminEmptyState({ title, message, action, icon = "empty-state" }: { title: string; message: string; action?: ReactNode; icon?: AdminIconName }) {
  return <div className="dn-admin-empty-state"><AdminIconBadge name={icon} /><strong>{title}</strong><p>{message}</p>{action}</div>;
}


function IconizedShell({ as: Tag = "article", icon, title, tone = "gold", dir, className = "", children, disabled, loading }: IconizedBaseProps & { as?: "article" | "div" }) {
  const Icon = getAdminIcon(icon);
  return <Tag dir={dir} className={`dn-iconized dn-iconized-${tone} ${disabled ? "is-disabled" : ""} ${className}`} aria-disabled={disabled || undefined}>
    <span className="dn-iconized-icon">{loading ? <Loader2 className="dn-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}</span>
    <span className="dn-iconized-content"><strong>{title}</strong>{children}</span>
  </Tag>;
}

export function IconizedPanelHeader(props: IconizedBaseProps & { eyebrow?: ReactNode; action?: ReactNode }) {
  return <header className={`dn-iconized-panel-header ${props.className || ""}`} dir={props.dir}><IconizedShell as="div" {...props} className="">{props.eyebrow && <small>{props.eyebrow}</small>}{props.children}</IconizedShell>{props.action}</header>;
}
export function IconizedMetricCard(props: IconizedBaseProps & { value: ReactNode; hint?: ReactNode }) {
  return <IconizedShell {...props} className={`dn-iconized-metric ${props.className || ""}`}><b>{props.value}</b>{props.hint && <em>{props.hint}</em>}</IconizedShell>;
}
export function IconizedActionTile({ icon, title, hint, onClick, ariaLabel, tone = "gold", dir, disabled, loading, className = "" }: IconizedBaseProps & { hint?: ReactNode; onClick?: () => void; ariaLabel: string }) {
  const Icon = getAdminIcon(icon);
  return <button type="button" className={`dn-iconized-action-tile dn-iconized-${tone} ${className}`} dir={dir} disabled={disabled || loading} aria-label={ariaLabel} onClick={onClick}><span className="dn-iconized-icon">{loading ? <Loader2 className="dn-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}</span><span><strong>{title}</strong>{hint && <em>{hint}</em>}</span></button>;
}
export function IconizedSectionButton(props: Parameters<typeof IconizedActionTile>[0]) { return <IconizedActionTile {...props} className={`dn-iconized-section-button ${props.className || ""}`} />; }
export function IconizedEmptyState(props: IconizedBaseProps & { message: ReactNode; action?: ReactNode }) { return <IconizedShell {...props} className={`dn-iconized-empty ${props.className || ""}`}><p>{props.message}</p>{props.action}</IconizedShell>; }
export function IconizedStatusRow(props: IconizedBaseProps & { value?: ReactNode }) { return <IconizedShell as="div" {...props} className={`dn-iconized-status-row ${props.className || ""}`}>{props.value && <b>{props.value}</b>}{props.children}</IconizedShell>; }
export function IconizedMapControlButton({ icon, title, ariaLabel, onClick, active, disabled, loading, tone = "gold" }: { icon: AdminIconName; title: ReactNode; ariaLabel: string; onClick: () => void; active?: boolean; disabled?: boolean; loading?: boolean; tone?: AdminIconTone }) { const Icon = getAdminIcon(icon); return <button type="button" className={`dn-map-control-button dn-iconized-${tone} ${active ? "is-active" : ""}`} aria-label={ariaLabel} title={String(title)} aria-pressed={active} disabled={disabled || loading} onClick={onClick}>{loading ? <Loader2 className="dn-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}</button>; }
