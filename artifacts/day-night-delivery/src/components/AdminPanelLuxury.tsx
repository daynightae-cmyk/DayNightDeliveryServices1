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
  Package,
  PackageCheck,
  PackagePlus,
  Printer,
  ReceiptText,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";
import companyMeta from "../data/companyMeta";
import { fetchAllOrders, supabase } from "../supabase";
import { fetchAdminStats, fetchFinanceSummary, fetchExpenses, createExpense, voidExpense, fetchLedgerEntries, fetchMerchantStatements, fetchDriverStatements, fetchMerchants, fetchAdminOrders, updateOrderStatus, type AdminStats, type FinanceSummary, type FinanceRow } from "../lib/adminData";
import type { Merchant } from "../types";
import { useAppContext } from "../lib/AppContext";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import AdminNewMerchant from "./admin/AdminNewMerchant";
import AdminNewOrder from "./admin/AdminNewOrder";
import AdminLiveOperationsMap from "./admin/AdminLiveOperationsMap";
import KhalifaGuidanceFeed from "./admin/KhalifaGuidanceFeed";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-khalifa-final.css";
import "../styles/dn-admin-task2.css";
import "../styles/dn-admin-task3.css";

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
  { id: "cod", ar: "التحصيل COD", en: "COD", groupAr: "المالية", groupEn: "Finance", Icon: Wallet },
  { id: "expenses", ar: "المصروفات", en: "Expenses", groupAr: "المالية", groupEn: "Finance", Icon: Database },
  { id: "accounts", ar: "الحسابات", en: "Accounts", groupAr: "المالية", groupEn: "Finance", Icon: Database },
  { id: "adjustments", ar: "التسويات", en: "Adjustments", groupAr: "المالية", groupEn: "Finance", Icon: RotateCcw },
  { id: "audit_log", ar: "سجل التدقيق", en: "Audit Log", groupAr: "المالية", groupEn: "Finance", Icon: ShieldCheck },
  { id: "import", ar: "استيراد الشحنات", en: "Import Shipments", groupAr: "الأدوات", groupEn: "Tools", Icon: Import },
  { id: "print", ar: "طباعة فواتير", en: "Print Invoices", groupAr: "الأدوات", groupEn: "Tools", Icon: Printer },
  { id: "reports", ar: "التقارير", en: "Reports", groupAr: "الأدوات", groupEn: "Tools", Icon: BarChart3 },
  { id: "settings", ar: "الإعدادات", en: "Settings", groupAr: "النظام", groupEn: "System", Icon: Settings },
  { id: "support", ar: "الدعم الفني", en: "Technical Support", groupAr: "النظام", groupEn: "System", Icon: Headphones },
  { id: "logout", ar: "تسجيل الخروج", en: "Logout", groupAr: "النظام", groupEn: "System", Icon: LogOut },
] as const;

type SectionId = typeof menu[number]["id"];

type MetricMap = {
  total: number;
  cancelled: number;
  review: number;
  postponed: number;
  returned: number;
  pickup: number;
  abuDhabi: number;
  external: number;
  outScope: number;
  codTotal: number;
  income: number;
};

const coreFormSections: SectionId[] = [];

const filteredSectionIds = new Set<SectionId>([
  "all_orders",
  "cancelled",
  "review",
  "postponed",
  "returned",
  "pickup",
  "abu_dhabi",
  "external",
  "out_scope",
  "driver_statements",
  "merchant_statements",
  "income",
  "expenses",
  "import",
  "print",
  "reports",
  "settings",
]);

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
    commandCenter: "مركز القيادة",
    welcome: "مرحباً بك في مركز القيادة",
    subtitle: "تحكم كامل بشحناتك من نقطة إلى نقطة",
    trackingTitle: "تتبع الشحنة",
    trackingSubtitle: "تابع شحنتك لحظة بلحظة",
    pickupPoint: "نقطة الاستلام",
    pickupText: "تم استلام الشحنة",
    deliveryPoint: "نقطة التسليم",
    deliveryText: "الشحنة في طريقها إليك",
    inTransit: "جاري التوصيل",
    inTransitText: "الشحنة في الطريق إليك",
    helper: "خليفة",
    helperRole: "مساعدك الذكي",
    helperText: "تحت أمرك يا أبو خليفة. أراقب الطلبات، التحصيل، التأخير، والطلبات التي تحتاج متابعة.",
    ask: "اسألني أي شيء",
    latest: "آخر التحديثات",
    shipmentInfo: "معلومات الشحنة",
    details: "تفاصيل الشحنة",
    quickHelp: "مساعدة سريعة",
    noUpdates: "لا توجد تنبيهات عاجلة حالياً",
    noData: "البيانات الحية جاهزة داخل مستودع العمليات",
    preparing: "خليفة يقرأ ملخص الطلبات ويقترح عليك الإجراء التالي.",
    language: "English",
    menu: "قائمة الإدارة",
    help: "مساعدة",
    websiteNav: "روابط الموقع الأساسي",
    liveOrders: "طلبات حية",
    actionPlan: "خطة العمل داخل القسم",
    quickActions: "إجراءات سريعة",
    openOperations: "فتح مستودع العمليات الكامل",
    totalOrders: "إجمالي الطلبات",
    sectionCount: "عدد هذا القسم",
    codTotal: "إجمالي التحصيل COD",
    income: "دخل التوصيل",
    filteredData: "البيانات المفلترة لهذا القسم",
    tableTracking: "التتبع",
    tableStatus: "الحالة",
    tableMerchant: "التاجر / المرسل",
    tableRoute: "المسار",
    tableReceiver: "المستلم",
    tableAmount: "المبلغ",
    tableDate: "التاريخ",
    tableAction: "الإجراء",
    noSectionOrders: "لا توجد طلبات مطابقة لهذا القسم حالياً.",
    liveFilter: "فلتر حي من بيانات Supabase",
    rowsShown: "صفوف معروضة",
  },
  en: {
    owner: "Abu Khalifa",
    role: "System Manager",
    commandCenter: "Command Center",
    welcome: "Welcome to the Command Center",
    subtitle: "Full control of shipments from point to point",
    trackingTitle: "Shipment Tracking",
    trackingSubtitle: "Track your shipment moment by moment",
    pickupPoint: "Pickup Point",
    pickupText: "Shipment received",
    deliveryPoint: "Delivery Point",
    deliveryText: "Shipment is on its way",
    inTransit: "In Transit",
    inTransitText: "Shipment is moving to you",
    helper: "Khalifa",
    helperRole: "Smart assistant",
    helperText: "At your service. I monitor orders, COD, delays, and items that need follow-up.",
    ask: "Ask me anything",
    latest: "Latest Updates",
    shipmentInfo: "Shipment Info",
    details: "Shipment Details",
    quickHelp: "Quick Help",
    noUpdates: "No urgent alerts right now",
    noData: "Live data is available inside Operations Warehouse",
    preparing: "Khalifa reads the order summary and suggests the next action.",
    language: "العربية",
    menu: "Admin Menu",
    help: "Help",
    websiteNav: "Main website links",
    liveOrders: "Live Orders",
    actionPlan: "Section Action Plan",
    quickActions: "Quick Actions",
    openOperations: "Open Full Operations Warehouse",
    totalOrders: "Total Orders",
    sectionCount: "Section Count",
    codTotal: "COD Total",
    income: "Delivery Income",
    filteredData: "Filtered data for this section",
    tableTracking: "Tracking",
    tableStatus: "Status",
    tableMerchant: "Merchant / Sender",
    tableRoute: "Route",
    tableReceiver: "Receiver",
    tableAmount: "Amount",
    tableDate: "Date",
    tableAction: "Action",
    noSectionOrders: "No matching orders for this section right now.",
    liveFilter: "Live filter from Supabase data",
    rowsShown: "Rows shown",
  },
};

function getMenuLabel(item: typeof menu[number], isArabic: boolean) {
  return isArabic ? item.ar : item.en;
}

function normalize(value: unknown) {
  return String(value || "").toLowerCase().replace(/[_-]/g, " ").trim();
}

function money(value: number) {
  return `${value.toFixed(2)} AED`;
}

function getOrderAmount(order: any) {
  return Number(order.cod_amount || order.delivery_price || order.price || order.total_amount || 0);
}

function getOrderIncome(order: any) {
  return Number(order.delivery_price || order.price || order.service_fee || 0);
}

function getRoute(order: any) {
  const from = order.sender_city || order.pickup_city || order.origin_city || order.from_city || "—";
  const to = order.receiver_city || order.delivery_city || order.destination_city || order.to_city || "—";
  return `${from} → ${to}`;
}

function getTracking(order: any) {
  return order.tracking_number || order.tracking_code || order.invoice_number || order.id || "—";
}

function translateStatus(status: unknown, isArabic: boolean) {
  const raw = normalize(status);
  if (!raw) return isArabic ? "غير محدد" : "Unspecified";
  if (raw === "pending" || raw.includes("pending")) return isArabic ? "قيد الانتظار" : "Pending";
  if (raw === "confirmed" || raw.includes("confirm")) return isArabic ? "مؤكد" : "Confirmed";
  if (raw.includes("under review") || raw.includes("review")) return isArabic ? "قيد المراجعة" : "Under Review";
  if (raw.includes("postpone") || raw.includes("defer") || raw.includes("schedule")) return isArabic ? "مؤجل" : "Postponed";
  if (raw.includes("return")) return isArabic ? "راجع" : "Returned";
  if (raw.includes("cancel") || raw.includes("fail")) return isArabic ? "ملغي" : "Cancelled";
  if (raw.includes("assign")) return isArabic ? "تم التعيين" : "Assigned";
  if (raw.includes("pick") || raw.includes("collect")) return isArabic ? "قيد الإحضار" : "Pickup";
  if (raw.includes("transit") || raw.includes("progress")) return isArabic ? "جاري التوصيل" : "In Transit";
  if (raw.includes("deliver") || raw.includes("complete")) return isArabic ? "تم التسليم" : "Delivered";
  return isArabic ? String(status).replace(/_/g, " ") : String(status).replace(/_/g, " ");
}

function filterOrdersForSection(id: SectionId, orders: any[]) {
  return orders.filter((order) => {
    const status = normalize(order.status);
    const route = `${order.sender_city || ""} ${order.receiver_city || ""} ${order.pickup_city || ""} ${order.delivery_city || ""}`;
    const routeLower = route.toLowerCase();
    const notes = normalize(order.notes || order.internal_notes || order.admin_notes);
    const scope = normalize(order.shipping_scope || order.scope || order.service_type);
    const destination = normalize(order.destination_country || order.country || order.receiver_country);

    switch (id) {
      case "all_orders":
      case "reports":
      case "print":
        return true;
      case "cancelled":
        return status.includes("cancel") || status.includes("fail");
      case "review":
        return status.includes("pending") || status.includes("confirm") || status.includes("review");
      case "postponed":
        return status.includes("postpone") || status.includes("defer") || status.includes("schedule");
      case "returned":
        return status.includes("return");
      case "pickup":
        return status.includes("pick") || status.includes("assign") || status.includes("collect");
      case "abu_dhabi":
        return routeLower.includes("abu dhabi") || route.includes("أبوظبي") || route.includes("ابوظبي");
      case "external":
        return scope.includes("international") || scope.includes("external") || Boolean(destination && !destination.includes("uae") && !destination.includes("emirates"));
      case "out_scope":
        return status.includes("scope") || notes.includes("out of scope") || notes.includes("خارج النطاق");
      case "income":
        return getOrderIncome(order) > 0 || getOrderAmount(order) > 0;
      case "driver_statements":
        return Boolean(order.driver_id || order.driver_name || status.includes("deliver") || status.includes("assign"));
      case "merchant_statements":
        return Boolean(order.merchant_id || order.merchant_name || order.sender_name);
      case "import":
        return Boolean(order.batch_id || order.import_id || order.source_file || order.created_at);
      case "expenses":
      case "settings":
        return false;
      default:
        return true;
    }
  });
}

function getSectionCount(id: SectionId, metrics: MetricMap, orders: any[]) {
  if (filteredSectionIds.has(id)) return filterOrdersForSection(id, orders).length;
  const counts: Partial<Record<SectionId, number>> = {
    cancelled: metrics.cancelled,
    review: metrics.review,
    postponed: metrics.postponed,
    returned: metrics.returned,
    pickup: metrics.pickup,
    abu_dhabi: metrics.abuDhabi,
    external: metrics.external,
    out_scope: metrics.outScope,
    income: Math.round(metrics.income),
  };
  return counts[id] ?? metrics.total;
}

function sectionDescription(id: SectionId, isArabic: boolean) {
  const ar: Partial<Record<SectionId, string>> = {
    all_orders: "مستودع تشغيلي شامل يعرض كل الطلبات الحية مع فلترة سريعة حسب الحالة والمسار والتحصيل.",
    cancelled: "مراجعة أسباب الإلغاء، فصل الطلبات الفاشلة، وتحديد ما يحتاج اتصالاً أو إعادة جدولة.",
    review: "قائمة متابعة للطلبات التي تحتاج تأكيد بيانات، مراجعة تاجر، أو قرار إداري قبل التحريك.",
    postponed: "إدارة الطلبات المؤجلة حسب التاريخ والسبب، مع تجهيزها للرجوع إلى مسار التوصيل.",
    returned: "متابعة الشحنات الراجعة، سبب الرجوع، حالة التحصيل، وخطة الإغلاق مع التاجر.",
    pickup: "مركز تشغيل لطلبات الاستلام من التاجر أو العميل قبل دخولها خط التوزيع.",
    abu_dhabi: "تجميع طلبات أبوظبي لتسهيل توزيع السائقين، تحديد المناطق، ومتابعة الحركة اليومية.",
    external: "متابعة الشحنات خارج الإمارات أو خارج المدن الرئيسية وتجهيز بيانات الوجهة والتسعير.",
    out_scope: "رصد الطلبات خارج نطاق الخدمة لاتخاذ قرار: قبول خاص، تسعير إضافي، أو اعتذار منظم.",
    driver_statements: "تجميع مستحقات المناديب، عدد الطلبات، التسليمات، والخصومات التشغيلية.",
    merchant_statements: "تجهيز كشف التاجر: الطلبات، التحصيل، المستحقات، الفواتير، وأرصدة التسوية.",
    income: "ملخص دخل التوصيل والتحصيل، مع فصل COD عن رسوم الخدمة.",
    expenses: "منطقة لتسجيل ومراجعة المصروفات التشغيلية قبل اعتمادها في التقارير.",
    import: "مركز استيراد دفعات الشحنات من CSV أو قوائم التجار وتحويلها إلى طلبات منظمة.",
    print: "تجهيز طباعة الفواتير، الملصقات، وقسائم التتبع للطلبات المحددة.",
    reports: "تقارير إدارية عن الطلبات، الأداء، التحصيل، والمدن الأكثر نشاطاً.",
    settings: "إعدادات النظام والهوية، الأسعار، المستخدمين، وربط الخدمات الخارجية.",
  };
  const en: Partial<Record<SectionId, string>> = {
    all_orders: "Full operations warehouse showing all live orders with quick status, route, and collection filtering.",
    cancelled: "Review cancellation reasons, separate failed orders, and decide which ones need calls or rescheduling.",
    review: "Follow-up queue for orders that need data confirmation, merchant review, or an admin decision.",
    postponed: "Manage postponed orders by date and reason, then move them back to the delivery workflow.",
    returned: "Track returned shipments, return reason, collection status, and merchant closure plan.",
    pickup: "Pickup operations center before shipments enter the dispatch route.",
    abu_dhabi: "Group Abu Dhabi orders to plan drivers, zones, and daily movement.",
    external: "Manage external shipments, destination data, and pricing review.",
    out_scope: "Monitor out-of-scope requests and decide special acceptance, extra pricing, or formal rejection.",
    driver_statements: "Collect driver dues, order counts, deliveries, and operational deductions.",
    merchant_statements: "Prepare merchant statements: orders, COD, dues, invoices, and settlements.",
    income: "Delivery income and collection summary, separating COD from service revenue.",
    expenses: "Register and review operational expenses before reports.",
    import: "Import bulk shipments from CSV or merchant lists into structured orders.",
    print: "Prepare invoices, labels, and tracking slips for selected shipments.",
    reports: "Admin reports for orders, performance, collection, and active cities.",
    settings: "System settings, identity, pricing, users, and external integrations.",
  };
  return isArabic ? ar[id] || "مركز عمل إداري مرتبط بالبيانات الحية." : en[id] || "Admin workspace connected to live operational data.";
}

function sectionBullets(id: SectionId, isArabic: boolean) {
  if (isArabic) {
    return [
      "تصفية تلقائية حسب نوع القسم من بيانات الطلبات الحية.",
      "إظهار أهم الأعمدة التشغيلية: التتبع، الحالة، التاجر، المسار، المستلم، والمبلغ.",
      "الانتقال إلى مستودع العمليات الكامل عند الحاجة لإدارة متقدمة أو إنشاء طلب جديد.",
    ];
  }
  return [
    "Automatic filtering by section type from live order data.",
    "Shows key operational columns: tracking, status, merchant, route, receiver, and amount.",
    "Open the full operations warehouse for advanced management or new order creation.",
  ];
}

function AdminSectionWorkspace({ id, title, ui, isArabic, metrics, orders, onOpenOperations, onRefresh }: { id: SectionId; title: string; ui: typeof copy.ar; isArabic: boolean; metrics: MetricMap; orders: any[]; onOpenOperations: () => void; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [statusSavingId, setStatusSavingId] = useState("");
  const baseOrders = filterOrdersForSection(id, orders);
  const normalizedQuery = query.toLowerCase().trim();
  const filteredOrders = normalizedQuery ? baseOrders.filter((order) => [getTracking(order), order.receiver_phone, order.sender_phone, order.receiver_name, order.customer_name, order.merchant_name, order.sender_name].join(" ").toLowerCase().includes(normalizedQuery)) : baseOrders;
  const count = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const totalIncome = filteredOrders.reduce((sum, order) => sum + getOrderIncome(order), 0);
  const rows = filteredOrders.slice(0, 30);

  async function changeStatus(order: any, status: string) {
    const idValue = String(order.id || "");
    if (!idValue || !status || status === order.status) return;
    setStatusSavingId(idValue);
    try {
      await updateOrderStatus(idValue, status, "Updated from luxury admin control center");
      await onRefresh();
    } catch (err) {
      console.warn("Order status update failed:", err);
    } finally {
      setStatusSavingId("");
    }
  }

  return (
    <section className="dn-admin-section-workspace">
      <header className="dn-admin-section-hero">
        <span>{ui.liveFilter}</span>
        <h1>{title}</h1>
        <p>{sectionDescription(id, isArabic)}</p>
      </header>

      <div className="dn-admin-section-kpis">
        <article><strong>{metrics.total}</strong><span>{ui.totalOrders}</span></article>
        <article><strong>{count}</strong><span>{ui.sectionCount}</span></article>
        <article><strong>{money(totalAmount || metrics.codTotal)}</strong><span>{ui.codTotal}</span></article>
        <article><strong>{money(totalIncome || metrics.income)}</strong><span>{ui.income}</span></article>
      </div>

      <div className="dn-admin-section-panels">
        <div>
          <h2>{ui.actionPlan}</h2>
          {sectionBullets(id, isArabic).map((item) => <p key={item}>• {item}</p>)}
        </div>
        <div>
          <h2>{ui.quickActions}</h2>
          <button type="button" onClick={onOpenOperations}>{ui.openOperations}</button>
          <small>{isArabic ? "الفلتر يعمل مباشرة من بيانات Supabase الحالية، وليس صفحة فارغة." : "This filter reads current Supabase data directly; it is not an empty placeholder."}</small>
        </div>
      </div>

      <div className="dn-admin-filter-table-card">
        <div className="mb-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالتتبع / الهاتف / الاسم / التاجر" : "Search tracking / phone / name / merchant"} className="w-full rounded-2xl border border-white/10 bg-brand-deep/70 px-4 py-3 text-sm font-bold text-white outline-none" /></div>
        <div className="dn-admin-filter-table-head">
          <div><span>{ui.filteredData}</span><strong>{title}</strong></div>
          <p>{ui.rowsShown}: {rows.length} / {count}</p>
        </div>

        {rows.length === 0 ? (
          <div className="dn-admin-filter-empty"><Package className="h-8 w-8" /><strong>{ui.noSectionOrders}</strong></div>
        ) : (
          <div className="dn-admin-filter-table-wrap">
            <table className="dn-admin-filter-table">
              <thead>
                <tr>
                  <th>{ui.tableTracking}</th>
                  <th>{ui.tableStatus}</th>
                  <th>{ui.tableMerchant}</th>
                  <th>{ui.tableRoute}</th>
                  <th>{ui.tableReceiver}</th>
                  <th>{ui.tableAmount}</th>
                  <th>{ui.tableDate}</th>
                  <th>{ui.tableAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order, index) => (
                  <tr key={String(order.id || order.tracking_number || index)}>
                    <td><b>{getTracking(order)}</b></td>
                    <td><select disabled={statusSavingId === String(order.id || "")} value={String(order.status || "pending")} onChange={(event) => void changeStatus(order, event.target.value)} className="rounded-xl border border-white/10 bg-brand-deep px-2 py-1 text-xs font-black text-white">{["pending", "confirmed", "assigned", "picked_up", "in_transit", "delivered", "cancelled"].map((status) => <option key={status} value={status}>{translateStatus(status, isArabic)}</option>)}</select></td>
                    <td>{order.merchant_name || order.sender_name || order.customer_name || "—"}</td>
                    <td>{getRoute(order)}</td>
                    <td>{order.receiver_name || order.recipient_name || order.customer_name || "—"}</td>
                    <td>{money(getOrderAmount(order))}</td>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—"}</td>
                    <td><button type="button" onClick={onOpenOperations}>{isArabic ? "فتح" : "Open"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}


function AdminFinanceWorkspace({ id, title, isArabic, summary, orders, merchants, onRefresh }: { id: SectionId; title: string; isArabic: boolean; summary: FinanceSummary | null; orders: any[]; merchants: Merchant[]; onRefresh: () => Promise<void> }) {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");

  async function loadRows() {
    setLoading(true); setError("");
    try {
      if (id === "expenses") setRows(await fetchExpenses());
      else if (id === "merchant_statements") setRows(await fetchMerchantStatements());
      else if (id === "driver_statements") setRows(await fetchDriverStatements());
      else if (["income", "cod", "accounts", "adjustments", "audit_log"].includes(id) && supabase) {
        const table = id === "income" ? "income_entries" : id === "cod" ? "cod_collections" : id === "accounts" ? "finance_accounts" : id === "adjustments" ? "finance_adjustments" : "finance_audit_log";
        const { data, error: requestError } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(500);
        if (requestError) throw new Error(requestError.message);
        setRows((data || []) as FinanceRow[]);
      } else if (id === "finance_dashboard") setRows(await fetchLedgerEntries());
    } catch (err) { setError(String((err as Error).message || err)); } finally { setLoading(false); }
  }

  useEffect(() => { void loadRows(); }, [id]);

  async function addExpense(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await createExpense({ amount: expenseAmount, notes: expenseNotes, status: "draft", payment_method: "cash" });
      setExpenseAmount(""); setExpenseNotes("");
      await loadRows(); await onRefresh();
    } catch (err) { setError(String((err as Error).message || err)); }
  }

  async function voidSelectedExpense(row: FinanceRow) {
    if (!row.id) return;
    try { await voidExpense(row.id, "Voided from admin finance workspace"); await loadRows(); await onRefresh(); } catch (err) { setError(String((err as Error).message || err)); }
  }

  const cards = [
    [isArabic ? "الدخل" : "Income", summary?.total_income || 0], [isArabic ? "المصروفات" : "Expenses", summary?.total_expenses || 0], ["COD", summary?.cod_collected || 0], [isArabic ? "COD معلق" : "COD pending", summary?.cod_pending || 0], [isArabic ? "مستحق التجار" : "Merchant payable", summary?.merchant_payable || 0], [isArabic ? "مستحق المناديب" : "Driver payable", summary?.driver_payable || 0],
  ];

  return <section className="dn-admin-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
    <header className="dn-admin-section-hero"><span>{isArabic ? "بيانات مالية حقيقية" : "Live finance data"}</span><h1>{title}</h1><p>{isArabic ? "كل الأرقام تقرأ من جداول Supabase أو views المالية، ولا توجد إجماليات وهمية." : "All figures read from Supabase finance tables/views; no fake totals are displayed."}</p></header>
    <div className="dn-admin-section-kpis">{cards.map(([label, value]) => <article key={String(label)}><strong>{Number(value).toFixed(2)}</strong><span>{label as string}</span></article>)}</div>
    <div className="dn-admin-section-panels"><div><h2>{isArabic ? "تدفق العمل" : "Workflow"}</h2><p>• {isArabic ? "لا حذف نهائي؛ المصروفات تستخدم void/reversal." : "No hard delete; expenses use void/reversal."}</p><p>• {isArabic ? "عدد التجار" : "Merchants"}: {merchants.length}</p><p>• {isArabic ? "عدد الطلبات" : "Orders"}: {orders.length}</p></div><div><h2>{isArabic ? "تحديث" : "Refresh"}</h2><button type="button" onClick={() => { void loadRows(); void onRefresh(); }}>{isArabic ? "تحديث البيانات" : "Refresh data"}</button><small>{isArabic ? "إذا لم تطبق migration ستظهر رسالة واضحة." : "If the migration is not applied, an explicit error is shown."}</small></div></div>
    {id === "expenses" && <form onSubmit={addExpense} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[180px_1fr_auto]"><input value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} type="number" min="0" placeholder="AED" className="rounded-xl border border-white/10 bg-brand-deep/70 px-3 py-2 text-white" /><input value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} placeholder={isArabic ? "ملاحظات المصروف" : "Expense notes"} className="rounded-xl border border-white/10 bg-brand-deep/70 px-3 py-2 text-white" /><button className="rounded-xl bg-brand-gold px-4 py-2 font-black text-brand-deep">{isArabic ? "إضافة" : "Add"}</button></form>}
    {error && <div className="mb-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{error}</div>}
    <div className="dn-admin-filter-table-card"><div className="dn-admin-filter-table-head"><div><span>{loading ? (isArabic ? "تحميل" : "Loading") : (isArabic ? "صفوف حية" : "Live rows")}</span><strong>{title}</strong></div><p>{rows.length}</p></div><div className="dn-admin-filter-table-wrap"><table className="dn-admin-filter-table"><thead><tr><th>ID</th><th>{isArabic ? "الحالة" : "Status"}</th><th>{isArabic ? "المبلغ" : "Amount"}</th><th>{isArabic ? "التاريخ" : "Date"}</th><th>{isArabic ? "إجراء" : "Action"}</th></tr></thead><tbody>{rows.length ? rows.slice(0, 40).map((row, index) => <tr key={String(row.id || index)}><td><b>{String(row.id || "—").slice(0, 12)}</b></td><td>{String(row.status || row.entry_type || "—")}</td><td>{Number(row.amount || row.debit || row.credit || row.current_balance || 0).toFixed(2)} AED</td><td>{row.created_at ? new Date(String(row.created_at)).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—"}</td><td>{id === "expenses" && row.status !== "void" ? <button type="button" onClick={() => void voidSelectedExpense(row)}>{isArabic ? "إلغاء" : "Void"}</button> : "—"}</td></tr>) : <tr><td colSpan={5}>{isArabic ? "لا توجد بيانات بعد أو لم تطبق الجداول." : "No data yet or finance tables are not applied."}</td></tr>}</tbody></table></div></div>
  </section>;
}

export default function AdminPanelLuxury() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const ui = isArabic ? copy.ar : copy.en;
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [liveStats, setLiveStats] = useState<AdminStats | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState("");

  const activeItem = menu.find((item) => item.id === active) || menu[0];
  const activeTitle = getMenuLabel(activeItem, isArabic);

  async function refreshAdminData() {
    setAdminLoading(true);
    setAdminError("");
    const [ordersResult, merchantsResult, statsResult, financeResult] = await Promise.allSettled([fetchAdminOrders(), fetchMerchants(), fetchAdminStats(), fetchFinanceSummary()]);
    if (ordersResult.status === "fulfilled") setOrders(ordersResult.value); else setAdminError(ordersResult.reason?.message || "Orders request failed");
    if (merchantsResult.status === "fulfilled") setMerchants(merchantsResult.value);
    if (statsResult.status === "fulfilled") setLiveStats(statsResult.value);
    if (financeResult.status === "fulfilled") setFinanceSummary(financeResult.value);
    setAdminLoading(false);
  }

  useEffect(() => {
    void refreshAdminData();
  }, []);

  const metrics = useMemo<MetricMap>(() => {
    const cancelled = filterOrdersForSection("cancelled", orders).length;
    const review = filterOrdersForSection("review", orders).length;
    const postponed = filterOrdersForSection("postponed", orders).length;
    const returned = filterOrdersForSection("returned", orders).length;
    const pickup = filterOrdersForSection("pickup", orders).length;
    const abuDhabi = filterOrdersForSection("abu_dhabi", orders).length;
    const external = filterOrdersForSection("external", orders).length;
    const outScope = filterOrdersForSection("out_scope", orders).length;
    const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    const income = orders.reduce((sum, order) => sum + getOrderIncome(order), 0);
    return { total: orders.length, cancelled, review, postponed, returned, pickup, abuDhabi, external, outScope, codTotal, income };
  }, [orders]);

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  function selectSection(id: SectionId) {
    if (id === "logout") {
      void handleLogout();
      return;
    }
    setActive(id);
    setMobileMenu(false);
  }

  function openOperations() {
    setActive("all_orders");
    setMobileMenu(false);
  }

  function renderDashboard() {
    return (
      <div className="dn-admin-home-full">
        <aside className="dn-admin-left-ai">
          <div className="dn-admin-user-head">
            <img src={khalifaAssets.bot} alt={ui.helper} />
            <div><strong>{ui.owner}</strong><span>{ui.role}</span></div>
          </div>

          <div className="dn-admin-khalifa-card">
            <img src={khalifaAssets.bot} alt={ui.helper} />
            <h2>{ui.helper}</h2>
            <p>{ui.helperRole}</p>
            <small>{ui.helperText}</small>
            <button type="button">{ui.ask}</button>
          </div>

          <KhalifaGuidanceFeed isArabic={isArabic} orders={orders} merchants={merchants} financeSummary={financeSummary} />
        </aside>

        <section className="dn-admin-center-zone">
          <header className="dn-admin-main-title"><span>{ui.commandCenter}</span><h1>{ui.welcome}</h1><p>{ui.subtitle}</p></header>

          <AdminLiveOperationsMap isArabic={isArabic} orders={orders} />

          <div className="dn-admin-bottom-cards">
            {[[ui.latest, ui.noUpdates, FileText], [ui.shipmentInfo, ui.noData, Package], [ui.details, `${metrics.total} ${ui.liveOrders}`, ClipboardList], [ui.quickHelp, ui.preparing, Headphones]].map(([title, text, Icon]) => {
              const CardIcon = Icon as typeof FileText;
              return <article key={String(title)}><div><CardIcon className="h-6 w-6" /></div><strong>{title as string}</strong><p>{text as string}</p></article>;
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (active === "dashboard") return renderDashboard();
    if (active === "new_merchant") return <AdminNewMerchant isArabic={isArabic} onSaved={() => void refreshAdminData()} />;
    if (active === "new_order") return <AdminNewOrder isArabic={isArabic} merchants={merchants} onSaved={() => void refreshAdminData()} />;
    if (active === "merchants") return <div className="dn-admin-core-full"><AdminMerchantIntelligence isArabic={isArabic} onSearchOrders={() => setActive("all_orders")} onCreateOrder={() => setActive("new_order")} /></div>;
    if (["finance_dashboard", "expenses", "income", "cod", "merchant_statements", "driver_statements", "accounts", "adjustments", "audit_log"].includes(active)) return <AdminFinanceWorkspace id={active} title={activeTitle} isArabic={isArabic} summary={financeSummary} orders={orders} merchants={merchants} onRefresh={refreshAdminData} />;
    if (active === "support") return <div className="dn-admin-core-full"><AdminProspectingLinks /></div>;
    if (filteredSectionIds.has(active)) return <AdminSectionWorkspace id={active} title={activeTitle} ui={ui} isArabic={isArabic} metrics={metrics} orders={orders} onOpenOperations={openOperations} onRefresh={refreshAdminData} />;
    return <AdminSectionWorkspace id={active} title={activeTitle} ui={ui} isArabic={isArabic} metrics={metrics} orders={orders} onOpenOperations={openOperations} onRefresh={refreshAdminData} />;
  }

  return (
    <div className="dn-admin-fullscreen" dir={isArabic ? "rtl" : "ltr"}>
      <AdminFloatingHelper />
      <button type="button" className="dn-admin-mobile-open" onClick={() => setMobileMenu(true)}><Menu className="h-5 w-5" />{ui.menu}</button>
      {mobileMenu && <button type="button" className="dn-admin-mobile-shade" aria-label="Close" onClick={() => setMobileMenu(false)} />}

      <div className="dn-admin-layout-full">
        <main className="dn-admin-content-full">
          <div className="dn-admin-top-strip">
            <nav className="dn-admin-site-links" aria-label={ui.websiteNav}>
              {siteLinks.map((link) => <a key={link.href} href={link.href}>{isArabic ? link.ar : link.en}</a>)}
            </nav>
            <button type="button" className="dn-admin-language-button" onClick={toggleLanguage}><Languages className="h-4 w-4" />{ui.language}</button>
          </div>
          {(adminLoading || adminError) && <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-xs font-black text-white/70"><button type="button" onClick={() => void refreshAdminData()} className="me-3 rounded-xl bg-brand-gold px-3 py-1 text-brand-deep">{isArabic ? "تحديث" : "Refresh"}</button>{adminLoading ? (isArabic ? "تحميل البيانات الحية..." : "Loading live data...") : adminError}</div>}
          {renderContent()}
        </main>

        <aside className={`dn-admin-right-sidebar ${mobileMenu ? "is-open" : ""}`}>
          <button type="button" className="dn-admin-sidebar-close-final" onClick={() => setMobileMenu(false)}><X className="h-4 w-4" /></button>
          <div className="dn-admin-brand-card"><img src={companyMeta.logoUrl} onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }} alt="DAY NIGHT" /><strong>DAY NIGHT</strong><span>DELIVERY SERVICES</span></div>
          <div className="dn-admin-owner-card"><UserRound className="h-5 w-5" /><strong>{ui.owner}</strong><span>{ui.role}</span></div>

          <nav className="dn-admin-menu-full">
            {menu.map((item, index) => {
              const Icon = item.Icon;
              const label = getMenuLabel(item, isArabic);
              const groupLabel = isArabic ? item.groupAr : item.groupEn;
              const previous = menu[index - 1];
              const showGroup = index === 0 || previous.groupAr !== item.groupAr;
              return (
                <div key={item.id} className="dn-admin-menu-row">
                  {showGroup && <p className="dn-admin-menu-group">{groupLabel}</p>}
                  <button type="button" onClick={() => selectSection(item.id)} className={active === item.id ? "is-active" : ""}>
                    <span className="dn-admin-nav-icon"><Icon className="dn-admin-nav-svg" size={20} strokeWidth={2.4} /></span>
                    <strong>{label}</strong>
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
}
