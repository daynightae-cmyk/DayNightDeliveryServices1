import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardList,
  Database,
  FileMinus,
  FileText,
  Globe2,
  Headphones,
  Import,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PackagePlus,
  Printer,
  ReceiptText,
  RotateCcw,
  Scale,
  SearchCheck,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import companyMeta from "../../../data/companyMeta";
import { supabase } from "../../../supabase";
import AdminPanelLuxury from "../../AdminPanelLuxury";
import type { AdminSectionId } from "../AdminSectionRegistry";
import AdminCommandCenterShell, {
  type AdminCommandMenuItem,
  type AdminCommandSearchItem,
} from "./AdminCommandCenterShell";
import "../../../styles/dn-admin-command-center-v1.css";

const menu: readonly AdminCommandMenuItem[] = [
  { id: "dashboard", ar: "لوحة التحكم", en: "Dashboard", groupAr: "القيادة", groupEn: "Command", Icon: LayoutDashboard },
  { id: "live_drivers", ar: "المندوبون المباشرون", en: "Live Drivers", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "new_order", ar: "إضافة طلب جديد", en: "New Order", groupAr: "العمليات", groupEn: "Operations", Icon: PackagePlus },
  { id: "new_merchant", ar: "إضافة تاجر", en: "New Merchant", groupAr: "العمليات", groupEn: "Operations", Icon: UserRoundPlus },
  { id: "merchants", ar: "التجار", en: "Merchants", groupAr: "العمليات", groupEn: "Operations", Icon: Store },
  { id: "all_orders", ar: "كافة الطلبات", en: "All Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: ClipboardList },
  { id: "cancelled", ar: "الطلبات الملغية", en: "Cancelled Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: XCircle },
  { id: "review", ar: "الطلبات قيد المراجعة", en: "Under Review", groupAr: "الطلبات", groupEn: "Orders", Icon: SearchCheck },
  { id: "postponed", ar: "الطلبات المؤجلة", en: "Postponed Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: CalendarClock },
  { id: "returned", ar: "الطلبات الراجعة", en: "Returned Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: RotateCcw },
  { id: "pickup", ar: "الطلبات قيد الإحضار", en: "Pickup Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "abu_dhabi", ar: "طلبات أبوظبي", en: "Abu Dhabi Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: MapPinned },
  { id: "external", ar: "الطلبات الدولية", en: "International Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Globe2 },
  { id: "out_scope", ar: "باقي الإمارات", en: "Other Emirates", groupAr: "التوزيع", groupEn: "Dispatch", Icon: AlertOctagon },
  { id: "finance_dashboard", ar: "لوحة المالية", en: "Finance Dashboard", groupAr: "المالية", groupEn: "Finance", Icon: BarChart3 },
  { id: "driver_statements", ar: "كشوفات المناديب", en: "Driver Statements", groupAr: "المالية", groupEn: "Finance", Icon: FileText },
  { id: "merchant_statements", ar: "كشوفات التجار", en: "Merchant Statements", groupAr: "المالية", groupEn: "Finance", Icon: ReceiptText },
  { id: "income", ar: "الدخل", en: "Income", groupAr: "المالية", groupEn: "Finance", Icon: TrendingUp },
  { id: "cod", ar: "التحصيل COD", en: "COD Collection", groupAr: "المالية", groupEn: "Finance", Icon: ReceiptText },
  { id: "expenses", ar: "المصروفات", en: "Expenses", groupAr: "المالية", groupEn: "Finance", Icon: FileMinus },
  { id: "accounts", ar: "الحسابات", en: "Accounts", groupAr: "المالية", groupEn: "Finance", Icon: Landmark },
  { id: "adjustments", ar: "التسويات", en: "Adjustments", groupAr: "المالية", groupEn: "Finance", Icon: Scale },
  { id: "audit_log", ar: "سجل التدقيق", en: "Audit Log", groupAr: "الرقابة", groupEn: "Control", Icon: ShieldCheck },
  { id: "import", ar: "استيراد الشحنات", en: "Import Shipments", groupAr: "الأدوات", groupEn: "Tools", Icon: Import },
  { id: "print", ar: "طباعة فواتير", en: "Print Invoices", groupAr: "الأدوات", groupEn: "Tools", Icon: Printer },
  { id: "reports", ar: "التقارير", en: "Reports", groupAr: "الأدوات", groupEn: "Tools", Icon: BarChart3 },
  { id: "settings", ar: "الإعدادات", en: "Settings", groupAr: "النظام", groupEn: "System", Icon: Settings },
  { id: "support", ar: "الدعم الفني", en: "Technical Support", groupAr: "النظام", groupEn: "System", Icon: Headphones },
  { id: "database_health", ar: "فحص قاعدة البيانات", en: "Database Health", groupAr: "النظام", groupEn: "System", Icon: Database },
  { id: "production_readiness", ar: "جاهزية الإنتاج", en: "Production Readiness", groupAr: "النظام", groupEn: "System", Icon: ShieldCheck },
  { id: "logout", ar: "تسجيل الخروج", en: "Logout", groupAr: "الحساب", groupEn: "Account", Icon: LogOut },
];

function hiddenSidebarButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button"));
}

function hiddenTopAction(index: number) {
  return document.querySelectorAll<HTMLButtonElement>(".dn-admin-top-actions button").item(index);
}

export default function AdminPanelCommandCenter() {
  const [active, setActive] = useState<AdminSectionId>("dashboard");
  const [isArabic, setIsArabic] = useState(true);
  const [operatorLabel, setOperatorLabel] = useState("DAY NIGHT Operations Admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const activeItem = menu.find((item) => item.id === active) ?? menu[0];
  const searchItems = useMemo<AdminCommandSearchItem[]>(
    () =>
      menu.map((item) => ({
        key: `section:${item.id}`,
        sectionId: item.id,
        labelAr: item.ar,
        labelEn: item.en,
        secondaryAr: item.groupAr,
        secondaryEn: item.groupEn,
        kind: "section",
      })),
    [],
  );

  useEffect(() => {
    let mounted = true;
    void supabase?.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const user = data.user;
      const metadata = user?.user_metadata as Record<string, unknown> | undefined;
      const name = String(metadata?.full_name || metadata?.name || metadata?.display_name || "").trim();
      setOperatorLabel(name || String(user?.email || "").split("@")[0] || "DAY NIGHT Operations Admin");
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const syncFromLegacyPanel = () => {
      const root = document.querySelector<HTMLElement>(".dn-admin-fullscreen");
      setIsArabic(root?.getAttribute("dir") !== "ltr");

      const buttons = hiddenSidebarButtons();
      const selectedIndex = buttons.findIndex((button) => button.classList.contains("is-active"));
      if (selectedIndex >= 0 && menu[selectedIndex]) setActive(menu[selectedIndex].id);

      const isLoading = Boolean(document.querySelector(".dn-admin-loading-banner"));
      const errorNode = document.querySelector<HTMLElement>(".dn-admin-error-banner");
      setLoading(isLoading);
      setError(errorNode?.textContent?.trim() || "");
      if (!isLoading && root) setLastSyncAt((current) => current ?? new Date());
    };

    syncFromLegacyPanel();
    const observer = new MutationObserver(syncFromLegacyPanel);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "dir"] });
    return () => observer.disconnect();
  }, []);

  const navigate = (id: AdminSectionId) => {
    const index = menu.findIndex((item) => item.id === id);
    const button = hiddenSidebarButtons()[index];
    if (button) button.click();
    else if (id === "logout") window.location.href = "/auth";
    setActive(id);
  };

  const refresh = () => {
    const button = hiddenTopAction(1);
    if (button) {
      setLoading(true);
      button.click();
      setLastSyncAt(new Date());
    }
  };

  return (
    <AdminCommandCenterShell
      isArabic={isArabic}
      active={active}
      menu={menu}
      logoUrl={companyMeta.logoUrl}
      companyName={companyMeta.legalNameEn}
      companyNameAr={companyMeta.legalNameAr}
      operatorLabel={operatorLabel}
      operatorRole={isArabic ? "إدارة العمليات" : "Operations Management"}
      activeTitle={isArabic ? activeItem.ar : activeItem.en}
      activeGroup={isArabic ? activeItem.groupAr : activeItem.groupEn}
      lastSyncAt={lastSyncAt}
      loading={loading}
      error={error}
      searchItems={searchItems}
      onNavigate={navigate}
      onSearchSelect={(item) => navigate(item.sectionId)}
      onToggleLanguage={() => hiddenTopAction(0)?.click()}
      onRefresh={refresh}
      notificationSlot={<Bell aria-hidden="true" />}
    >
      <AdminPanelLuxury />
    </AdminCommandCenterShell>
  );
}
