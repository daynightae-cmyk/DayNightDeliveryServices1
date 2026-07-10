import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  Eye,
  FileBarChart,
  FileText,
  Gauge,
  Landmark,
  Languages,
  LayoutDashboard,
  LocateFixed,
  MapPinned,
  Maximize2,
  MousePointerClick,
  Navigation,
  PackagePlus,
  PackageSearch,
  Radar,
  Receipt,
  RefreshCw,
  Route,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserCheck,
  Users,
  Wallet,
  ZoomIn,
  ZoomOut,
  Bell,
} from "lucide-react";

export type AdminIconName =
  | "dashboard" | "orders" | "active-orders" | "delivered-orders" | "pending-orders" | "unassigned-orders"
  | "cod" | "income" | "finance" | "expenses" | "adjustments" | "database-health" | "production-readiness"
  | "pdf-export" | "refresh" | "add-order" | "add-merchant" | "review-orders" | "map" | "route" | "zoom-in"
  | "zoom-out" | "reset-map" | "fit-route" | "driver" | "merchant" | "audit" | "warning" | "success" | "error"
  | "info" | "empty-state" | "khalifa-insight" | "live-data" | "quick-help" | "shipment-details" | "daily-closing"
  | "language" | "settings" | "notifications" | "search" | "view" | "click";

const iconMap = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  "active-orders": Activity,
  "delivered-orders": CheckCircle2,
  "pending-orders": Clock,
  "unassigned-orders": UserCheck,
  cod: Wallet,
  income: Receipt,
  finance: Landmark,
  expenses: CreditCard,
  adjustments: FileBarChart,
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
  "reset-map": LocateFixed,
  "fit-route": Maximize2,
  driver: Truck,
  merchant: Users,
  audit: ScanLine,
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
} satisfies Record<AdminIconName, typeof Activity>;

export function getAdminIcon(name: AdminIconName) {
  return iconMap[name] || Sparkles;
}

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
