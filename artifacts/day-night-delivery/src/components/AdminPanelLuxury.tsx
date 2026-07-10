import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  Headphones,
  Home,
  Import,
  Languages,
  LogOut,
  Menu,
  PackageCheck,
  PackagePlus,
  Printer,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";
import companyMeta from "../data/companyMeta";
import { supabase } from "../supabase";
import {
  fetchAdminOrders,
  fetchFinanceSummary,
  fetchMerchants,
  type FinanceSummary,
  type FinanceSummarySource,
} from "../lib/adminData";
import type { Merchant } from "../types";
import { useAppContext } from "../lib/AppContext";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminNewMerchant from "./admin/AdminNewMerchant";
import AdminNewOrder from "./admin/AdminNewOrder";
import AdminLiveOperationsMap from "./admin/AdminLiveOperationsMap";
import KhalifaGuidanceFeed from "./admin/KhalifaGuidanceFeed";
import AdminPdfExportButton from "./admin/AdminPdfExportButton";
import AdminControlSettings from "./admin/AdminControlSettings";
import AdminOperationsLayer from "./admin/AdminOperationsLayer";
import AdminDailyClosingPanel from "./admin/AdminDailyClosingPanel";
import AdminDatabaseHealthCenter from "./admin/AdminDatabaseHealthCenter";
import SpecializedAdminSectionWorkspace from "./admin/AdminSectionWorkspace";
import type { AdminSectionId } from "./admin/AdminSectionRegistry";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-khalifa-final.css";
import "../styles/dn-admin-task2.css";
import "../styles/dn-admin-task3.css";
import "../styles/dn-admin-pdf.css";

const menu = [
  { id: "dashboard", ar: "لوحة التحكم", en: "Dashboard", groupAr: "القيادة", groupEn: "Command", Icon: Home },
  { id: "new_order", ar: "إضافة طلب جديد", en: "New Order", groupAr: "العمليات", groupEn: "Operations", Icon: PackagePlus },
  { id: "new_merchant", ar: "إضافة تاجر", en: "New Merchant", groupAr: "العمليات", groupEn: "Operations", Icon: UserRoundPlus },
  { id: "merchants", ar: "التجار", en: "Merchants", groupAr: "العمليات", groupEn: "Operations", Icon: Store },

  { id: "all_orders", ar: "كافة الطلبات", en: "All Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: ClipboardList },
  { id: "cancelled", ar: "الطلبات الملغية", en: "Cancelled Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: X },
  { id: "review", ar: "الطلبات قيد المراجعة", en: "Under Review", groupAr: "الطلبات", groupEn: "Orders", Icon: ShieldCheck },
  { id: "postponed", ar: "الطلبات المؤجلة", en: "Postponed Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: PackageCheck },
  { id: "returned", ar: "الطلبات الراجعة", en: "Returned Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: RotateCcw },

  { id: "pickup", ar: "الطلبات قيد الإحضار", en: "Pickup Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "abu_dhabi", ar: "طلبات أبوظبي", en: "Abu Dhabi Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Truck },
  { id: "external", ar: "الطلبات الخارجية", en: "External Orders", groupAr: "التوزيع", groupEn: "Dispatch", Icon: Import },
  { id: "out_scope", ar: "الطلبات خارج النطاق", en: "Out of Scope", groupAr: "التوزيع", groupEn: "Dispatch", Icon: AlertTriangle },

  { id: "finance_dashboard", ar: "لوحة المالية", en: "Finance Dashboard", groupAr: "المالية", groupEn: "Finance", Icon: BarChart3 },
  { id: "driver_statements", ar: "كشوفات المناديب", en: "Driver Statements", groupAr: "المالية", groupEn: "Finance", Icon: FileText },
  { id: "merchant_statements", ar: "كشوفات التجار", en: "Merchant Statements", groupAr: "المالية", groupEn: "Finance", Icon: ReceiptText },
  { id: "income", ar: "الدخل", en: "Income", groupAr: "المالية", groupEn: "Finance", Icon: Wallet },
  { id: "cod", ar: "التحصيل COD", en: "COD Collection", groupAr: "المالية", groupEn: "Finance", Icon: Wallet },
  { id: "expenses", ar: "المصروفات", en: "Expenses", groupAr: "المالية", groupEn: "Finance", Icon: Database },
  { id: "accounts", ar: "الحسابات", en: "Accounts", groupAr: "المالية", groupEn: "Finance", Icon: Database },
  { id: "adjustments", ar: "التسويات", en: "Adjustments", groupAr: "المالية", groupEn: "Finance", Icon: RotateCcw },
  { id: "audit_log", ar: "سجل التدقيق", en: "Audit Log", groupAr: "المالية", groupEn: "Finance", Icon: ShieldCheck },

  { id: "import", ar: "استيراد الشحنات", en: "Import Shipments", groupAr: "الأدوات", groupEn: "Tools", Icon: Import },
  { id: "print", ar: "طباعة فواتير", en: "Print Invoices", groupAr: "الأدوات", groupEn: "Tools", Icon: Printer },
  { id: "reports", ar: "التقارير", en: "Reports", groupAr: "الأدوات", groupEn: "Tools", Icon: BarChart3 },

  { id: "settings", ar: "الإعدادات", en: "Settings", groupAr: "النظام", groupEn: "System", Icon: Settings },
  { id: "support", ar: "الدعم الفني", en: "Technical Support", groupAr: "النظام", groupEn: "System", Icon: Headphones },
  { id: "database_health", ar: "فحص قاعدة البيانات", en: "Database Health", groupAr: "النظام", groupEn: "System", Icon: Database },
  { id: "logout", ar: "تسجيل الخروج", en: "Logout", groupAr: "النظام", groupEn: "System", Icon: LogOut },
] as const;

type SectionId = (typeof menu)[number]["id"];

type MetricMap = {
  total: number;
  active: number;
  delivered: number;
  cancelled: number;
  review: number;
  postponed: number;
  returned: number;
  pickup: number;
  abuDhabi: number;
  external: number;
  outScope: number;
  unassigned: number;
  codTotal: number;
  income: number;
};

const operationsLayerSections: SectionId[] = [
  "driver_statements",
  "merchant_statements",
  "expenses",
  "adjustments",
  "audit_log",
  "import",
  "print",
  "reports",
];

const siteLinks = [
  { ar: "الموقع الرئيسي", en: "Website", href: "/" },
  { ar: "من نحن", en: "About", href: "/about" },
  { ar: "الخدمات", en: "Services", href: "/services" },
  { ar: "الأسعار", en: "Pricing", href: "/pricing" },
  { ar: "تتبع شحنة", en: "Tracking", href: "/tracking" },
  { ar: "طلب توصيل", en: "Request", href: "/request-delivery" },
  { ar: "QR Hub", en: "QR Hub", href: "/qr" },
  { ar: "تواصل معنا", en: "Contact", href: "/contact" },
];

const copy = {
  ar: {
    owner: "أبو خليفة",
    role: "مدير النظام",
    helper: "خليفة",
    helperRole: "مساعد العمليات الذكي",
    helperText: "متصل بالبيانات الحية ويغيّر إرشاداته حسب القسم الحالي.",
    ask: "اسألني أي شيء",
    language: "English",
    menu: "قائمة الإدارة",
    websiteNav: "روابط الموقع الأساسي",
    commandCenter: "مركز القيادة",
    welcome: "مرحباً بك في مركز القيادة",
    subtitle: "تحكم كامل بشحناتك من نقطة إلى نقطة",
    totalOrders: "إجمالي الطلبات",
    activeOrders: "طلبات نشطة",
    deliveredOrders: "تم التسليم",
    unassignedOrders: "بدون مندوب",
    codTotal: "إجمالي COD",
    income: "دخل التوصيل",
    latest: "آخر التحديثات",
    shipmentInfo: "معلومات الشحنة",
    details: "تفاصيل الشحنة",
    quickHelp: "مساعدة سريعة",
    noUpdates: "لا توجد تنبيهات عاجلة حالياً",
    noData: "البيانات الحية جاهزة داخل مستودع العمليات",
    preparing: "خليفة يقرأ ملخص الطلبات ويقترح عليك الإجراء التالي.",
    refresh: "تحديث البيانات",
    loading: "تحميل البيانات الحية...",
    lastSync: "آخر مزامنة",
    liveData: "متصل بالبيانات الحية",
    quickActions: "إجراءات سريعة",
    addOrder: "إضافة طلب",
    addMerchant: "إضافة تاجر",
    reviewPending: "مراجعة الطلبات",
    openFinance: "فتح المالية",
    exportPdf: "تصدير PDF",
    systemAlert: "تنبيه النظام",
    cleanFallback: "إذا كان جدول متخصص غير متاح، يتم الاشتقاق بأمان من الطلبات دون عرض أخطاء Supabase الخام.",
  },
  en: {
    owner: "Abu Khalifa",
    role: "System Manager",
    helper: "Khalifa",
    helperRole: "Smart Operations Assistant",
    helperText: "Connected to live data and changes guidance by section.",
    ask: "Ask me anything",
    language: "العربية",
    menu: "Admin Menu",
    websiteNav: "Main website links",
    commandCenter: "Command Center",
    welcome: "Welcome to the Command Center",
    subtitle: "Full control of shipments from point to point",
    totalOrders: "Total Orders",
    activeOrders: "Active Orders",
    deliveredOrders: "Delivered",
    unassignedOrders: "Unassigned",
    codTotal: "COD Total",
    income: "Delivery Income",
    latest: "Latest Updates",
    shipmentInfo: "Shipment Info",
    details: "Shipment Details",
    quickHelp: "Quick Help",
    noUpdates: "No urgent alerts right now",
    noData: "Live data is ready inside the operations warehouse",
    preparing: "Khalifa reads the order summary and suggests the next action.",
    refresh: "Refresh data",
    loading: "Loading live data...",
    lastSync: "Last sync",
    liveData: "Connected to live data",
    quickActions: "Quick Actions",
    addOrder: "Add Order",
    addMerchant: "Add Merchant",
    reviewPending: "Review Pending",
    openFinance: "Open Finance",
    exportPdf: "Export PDF",
    systemAlert: "System Alert",
    cleanFallback: "If a specialized table is unavailable, this workspace safely derives from orders without exposing raw Supabase schema errors.",
  },
};

function getMenuLabel(item: (typeof menu)[number], isArabic: boolean) {
  return isArabic ? item.ar : item.en;
}

function normalize(value: unknown) {
  return String(value || "").toLowerCase().replace(/[_-]/g, " ").trim();
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function getOrderIncome(order: any) {
  return Number(order?.delivery_price || order?.price || order?.service_fee || 0);
}

function isDelivered(order: any) {
  return /deliver|complete/.test(normalize(order?.status));
}

function isCancelled(order: any) {
  return /cancel|fail/.test(normalize(order?.status));
}

function isReturned(order: any) {
  return /return/.test(normalize(order?.status));
}

function isActive(order: any) {
  return !isDelivered(order) && !isCancelled(order) && !isReturned(order);
}

function isReview(order: any) {
  return /pending|review|confirm|hold/.test(normalize(order?.status));
}

function isPostponed(order: any) {
  return /postpone|defer|schedule/.test(normalize(order?.status));
}

function isPickup(order: any) {
  return /pick|assign|collect/.test(normalize(order?.status));
}

function routeText(order: any) {
  return `${order?.sender_city || ""} ${order?.receiver_city || ""} ${order?.pickup_city || ""} ${order?.delivery_city || ""} ${order?.destination_country || ""}`;
}

function isAbuDhabi(order: any) {
  return /abu dhabi|mussafah|khalifa|mbz|أبوظبي|ابوظبي/.test(routeText(order).toLowerCase());
}

function isExternal(order: any) {
  const text = `${routeText(order)} ${order?.service_type || ""} ${order?.shipping_scope || ""} ${order?.destination_country || ""}`.toLowerCase();
  return /international|external|gcc|world|saudi|kuwait|qatar|bahrain|oman|دولي|خارجي/.test(text);
}

function isOutScope(order: any) {
  const text = `${order?.status || ""} ${order?.notes || ""} ${order?.internal_notes || ""} ${order?.admin_notes || ""}`.toLowerCase();
  return /out.?of.?scope|unsupported|خارج النطاق/.test(text);
}

function buildMetrics(orders: any[]): MetricMap {
  return {
    total: orders.length,
    active: orders.filter(isActive).length,
    delivered: orders.filter(isDelivered).length,
    cancelled: orders.filter(isCancelled).length,
    review: orders.filter(isReview).length,
    postponed: orders.filter(isPostponed).length,
    returned: orders.filter(isReturned).length,
    pickup: orders.filter(isPickup).length,
    abuDhabi: orders.filter(isAbuDhabi).length,
    external: orders.filter(isExternal).length,
    outScope: orders.filter(isOutScope).length,
    unassigned: orders.filter(
      (order) =>
        isActive(order) &&
        !order?.driver_id &&
        !order?.assigned_driver_id &&
        !order?.driver_name,
    ).length,
    codTotal: orders.reduce((sum, order) => sum + Number(order?.cod_amount || 0), 0),
    income: orders.reduce((sum, order) => sum + getOrderIncome(order), 0),
  };
}

function buildDashboardPdfPayload(isArabic: boolean, title: string, metrics: MetricMap) {
  return {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: title,
    filters: isArabic ? "لوحة التحكم الحالية" : "Current dashboard",
    totals: {
      total: metrics.total,
      active: metrics.active,
      delivered: metrics.delivered,
      unassigned: metrics.unassigned,
      cod: money(metrics.codTotal),
      income: money(metrics.income),
    },
    columns: [
      { key: "metric", label: isArabic ? "المؤشر" : "Metric" },
      { key: "value", label: isArabic ? "القيمة" : "Value" },
    ],
    rows: Object.entries(metrics).map(([metric, value]) => ({
      metric,
      value: typeof value === "number" ? String(value) : value,
    })),
  };
}

function KhalifaPanel({
  isArabic,
  ui,
  activeTitle,
  active,
  orders,
  merchants,
  financeSummary,
  lastSyncAt,
}: {
  isArabic: boolean;
  ui: typeof copy.ar;
  activeTitle: string;
  active: SectionId;
  orders: any[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  lastSyncAt: Date | null;
}) {
  const [avatarNonce, setAvatarNonce] = useState(0);

  useEffect(() => {
    const handler = () => setAvatarNonce((value) => value + 1);
    window.addEventListener("dn-admin-settings-change", handler);

    return () => window.removeEventListener("dn-admin-settings-change", handler);
  }, []);

  const metrics = useMemo(() => buildMetrics(orders), [orders]);
  const rawAvatar = khalifaAssets.bot;
  const avatar = rawAvatar.startsWith("data:") ? rawAvatar : `${rawAvatar}?v=${avatarNonce}`;

  return (
    <aside className="dn-admin-left-ai" aria-label={isArabic ? "لوحة خليفة" : "Khalifa panel"}>
      <div className="dn-admin-user-head">
        <img src={avatar} alt={ui.helper} />
        <div>
          <strong>{ui.owner}</strong>
          <span>{ui.role}</span>
        </div>
      </div>

      <div className="dn-admin-khalifa-card">
        <img src={avatar} alt={ui.helper} />
        <h2>{ui.helper}</h2>
        <p>{ui.helperRole}</p>
        <small>{ui.helperText}</small>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black text-white/80">
          <span>{ui.liveData}</span>
          <span>{activeTitle}</span>
          <span>{ui.lastSync}</span>
          <span>{lastSyncAt ? lastSyncAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE") : "—"}</span>
          <span>{isArabic ? "بدون مندوب" : "Unassigned"}</span>
          <span>{metrics.unassigned}</span>
        </div>

        <button type="button">{ui.ask}</button>
      </div>

      <KhalifaGuidanceFeed
        key={`${active}-${orders.length}-${merchants.length}`}
        isArabic={isArabic}
        orders={orders}
        merchants={merchants}
        financeSummary={financeSummary}
        sectionTitle={activeTitle}
      />
    </aside>
  );
}

export default function AdminPanelLuxury() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const ui = isArabic ? copy.ar : copy.en;

  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [financeSummarySource, setFinanceSummarySource] = useState<FinanceSummarySource>("derived");
  const [financeWarning, setFinanceWarning] = useState("");
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const activeItem = menu.find((item) => item.id === active) || menu[0];
  const activeTitle = getMenuLabel(activeItem, isArabic);
  const metrics = useMemo(() => buildMetrics(orders), [orders]);

  const groupedMenu = useMemo(() => {
    return menu.reduce<Record<string, (typeof menu)[number][]>>((acc, item) => {
      const group = isArabic ? item.groupAr : item.groupEn;
      acc[group] = acc[group] || [];
      acc[group].push(item);

      return acc;
    }, {});
  }, [isArabic]);

  async function refreshAdminData() {
    setAdminLoading(true);
    setAdminError("");

    const [ordersResult, merchantsResult, financeResult] = await Promise.allSettled([
      fetchAdminOrders(),
      fetchMerchants(),
      fetchFinanceSummary(),
    ]);

    if (ordersResult.status === "fulfilled") {
      setOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
    } else {
      console.warn("Orders request failed:", ordersResult.reason);
      setAdminError(isArabic ? "تعذر تحميل الطلبات حالياً." : "Could not load orders right now.");
    }

    if (merchantsResult.status === "fulfilled") {
      setMerchants(Array.isArray(merchantsResult.value) ? merchantsResult.value : []);
    } else {
      console.warn("Merchants request failed:", merchantsResult.reason);
    }

    if (financeResult.status === "fulfilled") {
      setFinanceSummary(financeResult.value.summary);
      setFinanceSummarySource(financeResult.value.source);
      setFinanceWarning(financeResult.value.warning || "");
    } else {
      console.warn("Finance request failed:", financeResult.reason);
    }

    setLastSyncAt(new Date());
    setAdminLoading(false);
  }

  useEffect(() => {
    void refreshAdminData();
  }, []);

  function setSection(id: SectionId) {
    if (id === "logout") {
      void (async () => {
        try {
          await supabase?.auth.signOut();
        } catch (error) {
          console.warn("Supabase sign out failed:", error);
        } finally {
          window.location.href = "/auth";
        }
      })();

      return;
    }

    setActive(id);
    setMobileMenu(false);
  }

  function renderDashboardCenter() {
    const kpis = [
      { label: ui.totalOrders, value: metrics.total, Icon: ClipboardList },
      { label: ui.activeOrders, value: metrics.active, Icon: Truck },
      { label: ui.deliveredOrders, value: metrics.delivered, Icon: PackageCheck },
      { label: ui.unassignedOrders, value: metrics.unassigned, Icon: AlertTriangle },
      { label: ui.codTotal, value: money(metrics.codTotal), Icon: Wallet },
      { label: ui.income, value: money(metrics.income), Icon: BarChart3 },
    ];

    return (
      <section className="dn-admin-center-zone">
        <header className="dn-admin-main-title">
          <span>{ui.commandCenter}</span>
          <h1>{ui.welcome}</h1>
          <p>{ui.subtitle}</p>
        </header>

        <div className="dn-admin-section-kpis">
          {kpis.map(({ label, value, Icon }) => (
            <article key={label}>
              <Icon className="h-5 w-5" />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        <div className="dn-admin-section-panels">
          <div>
            <h2>{ui.quickActions}</h2>
            <p>• {ui.cleanFallback}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setSection("new_order")}>
                {ui.addOrder}
              </button>
              <button type="button" onClick={() => setSection("new_merchant")}>
                {ui.addMerchant}
              </button>
              <button type="button" onClick={() => setSection("review")}>
                {ui.reviewPending}
              </button>
              <button type="button" onClick={() => setSection("finance_dashboard")}>
                {ui.openFinance}
              </button>
            </div>
          </div>

          <div>
            <h2>{ui.liveData}</h2>
            <p>
              {ui.lastSync}:{" "}
              <b>
                {lastSyncAt
                  ? lastSyncAt.toLocaleString(isArabic ? "ar-AE" : "en-AE")
                  : "—"}
              </b>
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void refreshAdminData()}>
                {ui.refresh}
              </button>
              <AdminPdfExportButton payload={buildDashboardPdfPayload(isArabic, activeTitle, metrics)} />
            </div>
          </div>
        </div>

        <div className="dn-admin-core-full">
          <AdminLiveOperationsMap isArabic={isArabic} orders={orders} />
          <AdminDailyClosingPanel isArabic={isArabic} orders={orders} financeSummary={financeSummary} financeSummarySource={financeSummarySource} onNavigate={(target) => setSection(target as SectionId)} />
          {financeWarning && <p className="dn-clean-note">{isArabic ? "ملخص مالي مشتق مؤقتاً من الطلبات" : "Finance summary temporarily derived from orders"}</p>}
        </div>

        <div className="dn-admin-bottom-cards">
          {[
            [ui.latest, ui.noUpdates, FileText],
            [ui.shipmentInfo, ui.noData, PackageCheck],
            [ui.details, `${metrics.total} ${isArabic ? "طلبات" : "orders"}`, ClipboardList],
            [ui.quickHelp, ui.preparing, Headphones],
          ].map(([title, text, Icon]) => {
            const CardIcon = Icon as typeof FileText;

            return (
              <article key={String(title)}>
                <div>
                  <CardIcon className="h-6 w-6" />
                </div>
                <strong>{title as string}</strong>
                <p>{text as string}</p>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderWorkspace() {
    if (active === "dashboard") {
      return renderDashboardCenter();
    }

    if (active === "new_merchant") {
      return (
        <section className="dn-admin-center-zone">
          <AdminNewMerchant
            isArabic={isArabic}
            onSaved={() => void refreshAdminData()}
          />
        </section>
      );
    }

    if (active === "new_order") {
      return (
        <section className="dn-admin-center-zone">
          <AdminNewOrder
            isArabic={isArabic}
            merchants={merchants}
            onSaved={() => void refreshAdminData()}
          />
        </section>
      );
    }

    if (active === "merchants") {
      return (
        <section className="dn-admin-center-zone">
          <div className="dn-admin-core-full">
            <AdminMerchantIntelligence
              isArabic={isArabic}
              onSearchOrders={() => setSection("all_orders")}
              onCreateOrder={() => setSection("new_order")}
            />
          </div>
        </section>
      );
    }

    if (active === "database_health") {
      return (
        <section className="dn-admin-center-zone">
          <AdminDatabaseHealthCenter isArabic={isArabic} onNavigate={(id) => setSection(id)} />
        </section>
      );
    }

    if (active === "settings") {
      return (
        <section className="dn-admin-center-zone">
          <AdminControlSettings
            isArabic={isArabic}
            orders={orders}
            merchants={merchants}
            financeSummary={financeSummary}
          />
        </section>
      );
    }

    if (operationsLayerSections.includes(active)) {
      return (
        <section className="dn-admin-center-zone">
          <AdminOperationsLayer
            id={active}
            title={activeTitle}
            isArabic={isArabic}
            orders={orders}
            merchants={merchants}
            onRefresh={refreshAdminData}
          />
        </section>
      );
    }

    if (active === "support") {
      return (
        <section className="dn-admin-center-zone">
          <div className="dn-admin-core-full">
            <AdminProspectingLinks />
          </div>
        </section>
      );
    }

    return (
      <section className="dn-admin-center-zone">
        <SpecializedAdminSectionWorkspace
          id={active as AdminSectionId}
          isArabic={isArabic}
          orders={orders}
          merchants={merchants}
          financeSummary={financeSummary}
          financeSummarySource={financeSummarySource}
          financeWarning={financeWarning}
          onRefresh={refreshAdminData}
          onNavigate={(id) => {
            setActive(id as SectionId);
            setMobileMenu(false);
          }}
        />
      </section>
    );
  }

  return (
    <div className="dn-admin-fullscreen" dir={isArabic ? "rtl" : "ltr"}>
      <button
        type="button"
        className="dn-admin-mobile-open"
        onClick={() => setMobileMenu(true)}
      >
        <Menu className="h-5 w-5" />
        {ui.menu}
      </button>

      {mobileMenu && (
        <button
          type="button"
          className="dn-admin-mobile-shade"
          aria-label="Close"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <div className="dn-admin-layout-full">
        <aside className={`dn-admin-sidebar-full ${mobileMenu ? "is-open" : ""}`}>
          <div className="dn-admin-brand-block">
            <img src={companyMeta.logoUrl} alt={companyMeta.name} />
            <div>
              <strong>DAY NIGHT</strong>
              <span>DELIVERY SERVICES</span>
            </div>
          </div>

          <div className="dn-admin-user-mini">
            <strong>{ui.owner}</strong>
            <span>{ui.role}</span>
          </div>

          <nav className="dn-admin-side-nav" aria-label={ui.menu}>
            {Object.entries(groupedMenu).map(([group, items]) => (
              <section key={group}>
                <h3>{group}</h3>

                {items.map((item) => {
                  const Icon = item.Icon;
                  const selected = active === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={selected ? "is-active" : ""}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{getMenuLabel(item, isArabic)}</span>
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        </aside>

        <main className="dn-admin-content-full">
          <div className="dn-admin-top-strip">
            <nav className="dn-admin-site-links" aria-label={ui.websiteNav}>
              {siteLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {isArabic ? link.ar : link.en}
                </a>
              ))}
            </nav>

            <div className="dn-admin-top-actions">
              <button type="button" onClick={toggleLanguage}>
                <Languages className="h-4 w-4" />
                {ui.language}
              </button>

              <button type="button" onClick={() => void refreshAdminData()}>
                {ui.refresh}
              </button>
            </div>
          </div>

          {adminLoading && (
            <div className="dn-admin-loading-banner">
              {ui.loading}
            </div>
          )}

          {adminError && (
            <div className="dn-admin-error-banner">
              <AlertTriangle className="h-4 w-4" />
              {adminError}
            </div>
          )}

          <div className="dn-admin-current-section">
            <span>{isArabic ? activeItem.groupAr : activeItem.groupEn}</span>
            <strong>{activeTitle}</strong>
          </div>

          <div className="dn-admin-home-full">
            <KhalifaPanel
              isArabic={isArabic}
              ui={ui}
              active={active}
              activeTitle={activeTitle}
              orders={orders}
              merchants={merchants}
              financeSummary={financeSummary}
              lastSyncAt={lastSyncAt}
            />

            <div className="dn-admin-workspace-host">
              {renderWorkspace()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}