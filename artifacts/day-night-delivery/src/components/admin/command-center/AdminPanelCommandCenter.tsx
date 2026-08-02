import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  MessageSquareWarning,
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
  UsersRound,
  XCircle,
} from "lucide-react";
import companyMeta from "../../../data/companyMeta";
import { fetchAdminOrders, fetchMerchants } from "../../../lib/adminData";
import { useAppContext } from "../../../lib/AppContext";
import { supabase } from "../../../supabase";
import type { Merchant, Order } from "../../../types";
import AdminPanelLuxury from "../../AdminPanelLuxury";
import type { AdminSectionId } from "../AdminSectionRegistry";
import AdminCommandCenterShell, {
  type AdminCommandMenuItem,
  type AdminCommandSearchItem,
  type AdminCommandSectionId,
} from "./AdminCommandCenterShell";
import "../../../styles/dn-admin-command-center-v1.css";

const EMPLOYEE_PATH_EVENT = "dn-employee-hr-path";
const CUSTOMER_EXPERIENCE_PATH_EVENT = "dn-customer-experience-path";
const LEGACY_NEW_EMPLOYEE_PATH = "/admin/new-employee";
const LEGACY_EMPLOYEES_PATH = "/admin/employees";
const LEGACY_CUSTOMER_EXPERIENCE_PATH = "/admin/customer-experience";
const NEW_EMPLOYEE_ROUTE = "/admin?hr=new";
const EMPLOYEES_ROUTE = "/admin?hr=employees";
const CUSTOMER_EXPERIENCE_ROUTE = "/admin?cx=messages";

const menu: readonly AdminCommandMenuItem[] = [
  { id: "dashboard", ar: "لوحة التحكم", en: "Dashboard", groupAr: "القيادة", groupEn: "Command", Icon: LayoutDashboard },
  { id: "live_drivers", ar: "المندوبون المباشرون", en: "Live Drivers", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "new_order", ar: "إضافة طلب جديد", en: "New Order", groupAr: "العمليات", groupEn: "Operations", Icon: PackagePlus },
  { id: "personal_orders", ar: "الطلبيات الشخصية", en: "Personal Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: PackagePlus },
  { id: "new_merchant", ar: "إضافة تاجر", en: "New Merchant", groupAr: "العمليات", groupEn: "Operations", Icon: UserRoundPlus },
  { id: "merchants", ar: "التجار", en: "Merchants", groupAr: "العمليات", groupEn: "Operations", Icon: Store },
  { id: "new_employee", ar: "إضافة موظف", en: "Add Employee", groupAr: "الموارد البشرية", groupEn: "Human Resources", Icon: UserRoundPlus },
  { id: "employees", ar: "الموظفون", en: "Employees", groupAr: "الموارد البشرية", groupEn: "Human Resources", Icon: UsersRound },
  { id: "all_orders", ar: "كافة الطلبات", en: "All Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: ClipboardList },
  { id: "cancelled", ar: "الطلبات الملغية", en: "Cancelled Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: XCircle },
  { id: "review", ar: "الطلبات قيد المراجعة", en: "Under Review", groupAr: "الطلبات", groupEn: "Orders", Icon: SearchCheck },
  { id: "postponed", ar: "الطلبات المؤجلة", en: "Postponed Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: CalendarClock },
  { id: "returned", ar: "الطلبات الراجعة", en: "Returned Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: RotateCcw },
  { id: "customer_experience", ar: "مركز الرسائل", en: "Message Center", groupAr: "تجربة العملاء", groupEn: "Customer Experience", Icon: MessageSquareWarning },
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

function pathname() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function specialSectionFromLocation(): "new_employee" | "employees" | "customer_experience" | null {
  const url = new URL(window.location.href);
  const path = pathname();
  const hr = url.searchParams.get("hr");
  const customerExperience = url.searchParams.get("cx");
  if (path === LEGACY_NEW_EMPLOYEE_PATH || (path === "/admin" && hr === "new")) return "new_employee";
  if (path === LEGACY_EMPLOYEES_PATH || (path === "/admin" && hr === "employees")) return "employees";
  if (path === LEGACY_CUSTOMER_EXPERIENCE_PATH || (path === "/admin" && customerExperience === "messages")) return "customer_experience";
  return null;
}

function isEmployeeSection(id: AdminCommandSectionId): id is "new_employee" | "employees" {
  return id === "new_employee" || id === "employees";
}

function isCustomerExperienceSection(id: AdminCommandSectionId): id is "customer_experience" {
  return id === "customer_experience";
}

function isSpecialSection(id: AdminCommandSectionId) {
  return isEmployeeSection(id) || isCustomerExperienceSection(id);
}

function isLegacySection(id: AdminCommandSectionId): id is AdminSectionId {
  return !isSpecialSection(id);
}

function employeeRouteFor(id: "new_employee" | "employees") {
  return id === "new_employee" ? NEW_EMPLOYEE_ROUTE : EMPLOYEES_ROUTE;
}

function announceEmployeeRoute(id: "new_employee" | "employees" | null) {
  const detail = id === "new_employee" ? "employee:new" : id === "employees" ? "employee:directory" : "/admin";
  window.dispatchEvent(new CustomEvent<string>(EMPLOYEE_PATH_EVENT, { detail }));
}

function announceCustomerExperienceRoute(active: boolean) {
  window.dispatchEvent(new CustomEvent<string>(CUSTOMER_EXPERIENCE_PATH_EVENT, {
    detail: active ? CUSTOMER_EXPERIENCE_ROUTE : "/admin",
  }));
}

function normalizeMenuText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function legacySidebarButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button"));
}

function menuItemFromLegacyButton(button: HTMLButtonElement | null) {
  if (!button) return null;
  const text = normalizeMenuText(button.textContent);
  return menu.find((item) => text === normalizeMenuText(item.ar) || text === normalizeMenuText(item.en)) ?? null;
}

function legacySidebarButtonFor(id: AdminSectionId) {
  const item = menu.find((entry) => entry.id === id);
  if (!item) return null;
  return legacySidebarButtons().find((button) => {
    const text = normalizeMenuText(button.textContent);
    return text === normalizeMenuText(item.ar) || text === normalizeMenuText(item.en);
  }) ?? null;
}

function legacyRefreshAction() {
  return document.querySelectorAll<HTMLButtonElement>(".dn-admin-top-actions button").item(1);
}

function orderReference(order: Order) {
  return String(order.tracking_number || order.invoice_number || order.coupon_number || order.id || "").trim();
}

function applyWorkspaceSearch(value: string) {
  const run = () => {
    const input = document.querySelector<HTMLInputElement>('[data-admin-order-search="true"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
    return true;
  };
  if (run()) return;
  window.setTimeout(run, 120);
  window.setTimeout(run, 360);
}

export default function AdminPanelCommandCenter() {
  const navigateRouter = useNavigate();
  const { language, toggleLanguage, theme, toggleTheme } = useAppContext();
  const isArabic = language === "ar";
  const [active, setActive] = useState<AdminCommandSectionId>(() => specialSectionFromLocation() ?? "dashboard");
  const [operatorLabel, setOperatorLabel] = useState("DAY NIGHT Operations Admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [khalifaOpen, setKhalifaOpen] = useState(false);
  const [searchOrders, setSearchOrders] = useState<Order[]>([]);
  const [searchMerchants, setSearchMerchants] = useState<Merchant[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const activeItem = menu.find((item) => item.id === active) ?? menu[0];
  const searchItems = useMemo<AdminCommandSearchItem[]>(() => {
    const sections = menu.map((item) => ({
      key: `section:${item.id}`,
      sectionId: item.id,
      labelAr: item.ar,
      labelEn: item.en,
      secondaryAr: item.groupAr,
      secondaryEn: item.groupEn,
      searchValues: [item.ar, item.en, item.groupAr, item.groupEn],
      kind: "section" as const,
    }));
    const orders = searchOrders.map((order) => {
      const reference = orderReference(order) || (isArabic ? "طلب بدون مرجع" : "Order without reference");
      const secondary = [order.merchant_name || order.sender_name, order.receiver_name || order.customer_name, order.receiver_phone]
        .filter(Boolean)
        .join(" · ");
      return {
        key: `order:${String(order.id || reference)}`,
        sectionId: "all_orders" as const,
        entityId: String(order.id || ""),
        labelAr: reference,
        labelEn: reference,
        secondaryAr: secondary,
        secondaryEn: secondary,
        searchValues: [
          order.id, order.tracking_number, order.invoice_number, order.coupon_number,
          order.merchant_id, order.merchant_code, order.merchant_name,
          order.sender_name, order.sender_phone, order.receiver_name,
          order.customer_name, order.receiver_phone, order.customer_phone,
          order.sender_city, order.receiver_city, order.sender_address,
          order.receiver_address, order.status, order.notes,
        ],
        kind: "order" as const,
      };
    });
    const merchants = searchMerchants.map((merchant) => {
      const name = String(merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id);
      const secondary = [merchant.merchant_code, merchant.phone, merchant.city || merchant.emirate].filter(Boolean).join(" · ");
      return {
        key: `merchant:${merchant.id}`,
        sectionId: "merchants" as const,
        entityId: String(merchant.id || ""),
        labelAr: name,
        labelEn: name,
        secondaryAr: secondary,
        secondaryEn: secondary,
        searchValues: [merchant.id, merchant.trade_name, merchant.owner_name, merchant.merchant_code, merchant.phone, merchant.alt_phone, merchant.email, merchant.city, merchant.emirate],
        kind: "merchant" as const,
      };
    });
    return [...sections, ...orders, ...merchants];
  }, [isArabic, searchMerchants, searchOrders]);

  async function loadSearchData() {
    setSearchLoading(true);
    setSearchError("");
    const [ordersResult, merchantsResult] = await Promise.allSettled([fetchAdminOrders(), fetchMerchants()]);
    if (ordersResult.status === "fulfilled") setSearchOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
    if (merchantsResult.status === "fulfilled") setSearchMerchants(Array.isArray(merchantsResult.value) ? merchantsResult.value : []);
    const failures = [ordersResult, merchantsResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    if (failures.length) setSearchError(failures.join(" · "));
    setSearchLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    void supabase?.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const user = data.user;
      const metadata = user?.user_metadata as Record<string, unknown> | undefined;
      const name = String(metadata?.full_name || metadata?.name || metadata?.display_name || "").trim();
      setOperatorLabel(name || String(user?.email || "").split("@")[0] || "DAY NIGHT Operations Admin");
    });
    void loadSearchData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
  const syncRoute = () => {
    const section = specialSectionFromLocation();
    if (section) setActive(section);
  };
  window.addEventListener("popstate", syncRoute);
  window.addEventListener(EMPLOYEE_PATH_EVENT, syncRoute);
  window.addEventListener(CUSTOMER_EXPERIENCE_PATH_EVENT, syncRoute);
  syncRoute();
  return () => {
    window.removeEventListener("popstate", syncRoute);
    window.removeEventListener(EMPLOYEE_PATH_EVENT, syncRoute);
    window.removeEventListener(CUSTOMER_EXPERIENCE_PATH_EVENT, syncRoute);
  };
}, []);

useEffect(() => {
  const syncFromLegacyPanel = () => {
      const specialSection = specialSectionFromLocation();
      if (specialSection) {
        setActive(specialSection);
      } else {
        const selectedButton = legacySidebarButtons().find((button) => button.classList.contains("is-active")) ?? null;
        const selectedItem = menuItemFromLegacyButton(selectedButton);
        if (selectedItem && isLegacySection(selectedItem.id)) setActive(selectedItem.id);
      }
      const isLoading = Boolean(document.querySelector(".dn-admin-loading-banner"));
      const errorNode = document.querySelector<HTMLElement>(".dn-admin-error-banner");
      setLoading(isLoading);
      setError(errorNode?.textContent?.trim() || "");
      if (!isLoading && document.querySelector(".dn-admin-fullscreen")) setLastSyncAt((current) => current ?? new Date());
    };
    syncFromLegacyPanel();
    const observer = new MutationObserver(syncFromLegacyPanel);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "dir"] });
    return () => observer.disconnect();
  }, []);

  const navigate = (id: AdminCommandSectionId) => {
  if (isEmployeeSection(id)) {
    navigateRouter(employeeRouteFor(id));
    setActive(id);
    window.setTimeout(() => announceEmployeeRoute(id), 0);
    return;
  }

  if (isCustomerExperienceSection(id)) {
    navigateRouter(CUSTOMER_EXPERIENCE_ROUTE);
    setActive(id);
    window.setTimeout(() => announceCustomerExperienceRoute(true), 0);
    return;
  }

  if (!isLegacySection(id)) return;
  const button = legacySidebarButtonFor(id);
  const currentSpecialSection = specialSectionFromLocation();
  if (currentSpecialSection) {
    navigateRouter("/admin");
    announceEmployeeRoute(null);
    announceCustomerExperienceRoute(false);
    window.setTimeout(() => button?.click(), 0);
  } else if (button) {
    button.click();
  } else if (id === "logout") {
    navigateRouter("/auth");
  }
  setActive(id);
};

const selectSearchItem = (item: AdminCommandSearchItem) => {
    if (item.kind === "merchant" && item.entityId) {
      window.dispatchEvent(new CustomEvent("dn-admin-open-merchant-orders", { detail: { merchantId: item.entityId } }));
      return;
    }
    navigate(item.sectionId);
    if (item.kind === "order") applyWorkspaceSearch(item.labelEn);
  };

  const refresh = () => {
    const button = legacyRefreshAction();
    if (button) {
      setLoading(true);
      button.click();
      setLastSyncAt(new Date());
    }
    void loadSearchData();
  };

  const openNotifications = () => {
    const clickBell = () => document.querySelector<HTMLButtonElement>(".dn-admin-notification-bell > button")?.click();
    if (document.querySelector(".dn-admin-notification-bell > button")) {
      clickBell();
      return;
    }
    navigate("dashboard");
    window.setTimeout(clickBell, 120);
    window.setTimeout(clickBell, 360);
  };

  const goBack = () => {
    if (window.history.length > 1) navigateRouter(-1);
    else navigateRouter("/");
  };

  return (
    <AdminCommandCenterShell
      isArabic={isArabic}
      theme={theme}
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
      searchLoading={searchLoading}
      searchError={searchError}
      onRetrySearch={() => void loadSearchData()}
      khalifaOpen={khalifaOpen}
      onNavigate={navigate}
      onSearchSelect={selectSearchItem}
      onToggleLanguage={toggleLanguage}
      onToggleTheme={toggleTheme}
      onToggleKhalifa={() => setKhalifaOpen((value) => !value)}
      onBack={goBack}
      onOpenWebsite={() => navigateRouter("/")}
      onRefresh={refresh}
      notificationSlot={
        <button type="button" onClick={openNotifications} aria-label={isArabic ? "فتح الإشعارات" : "Open notifications"} title={isArabic ? "الإشعارات" : "Notifications"}>
          <Bell aria-hidden="true" />
        </button>
      }
    >
      <AdminPanelLuxury />
    </AdminCommandCenterShell>
  );
}
