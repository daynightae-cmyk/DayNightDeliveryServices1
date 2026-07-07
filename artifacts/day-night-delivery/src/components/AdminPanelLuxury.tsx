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
import { supabase } from "../supabase";
import { calculateOrderStats, fetchAdminOrders, fetchAdminStats, fetchMerchants, type AdminStats } from "../lib/adminData";
import { useAppContext } from "../lib/AppContext";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import AdminNewMerchant from "./admin/AdminNewMerchant";
import AdminNewOrder from "./admin/AdminNewOrder";
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
  { id: "driver_statements", ar: "كشوفات المناديب", en: "Driver Statements", groupAr: "المالية", groupEn: "Finance", Icon: FileText },
  { id: "merchant_statements", ar: "كشوفات التجار", en: "Merchant Statements", groupAr: "المالية", groupEn: "Finance", Icon: ReceiptText },
  { id: "income", ar: "الدخل", en: "Income", groupAr: "المالية", groupEn: "Finance", Icon: Wallet },
  { id: "expenses", ar: "المصروفات", en: "Expenses", groupAr: "المالية", groupEn: "Finance", Icon: Database },
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
  pending: number;
  inTransit: number;
  delivered: number;
};

const coreFormSections: SectionId[] = ["new_order", "new_merchant"];

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
    noSectionOrders: "لا توجد طلبات مطابقة لهذا القسم حالياً.",
    liveFilter: "فلتر حي من بيانات Supabase",
    rowsShown: "صفوف معروضة",
    loadingData: "جاري تحميل بيانات الإدارة...",
    errorData: "تعذر تحميل بعض بيانات الإدارة. يمكنك التحديث أو متابعة الأقسام المتاحة.",
    emptyData: "لا توجد طلبات حتى الآن.",
    retry: "إعادة المحاولة",
    pending: "قيد الانتظار",
    delivered: "تم التسليم",
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
    noSectionOrders: "No matching orders for this section right now.",
    liveFilter: "Live filter from Supabase data",
    rowsShown: "Rows shown",
    loadingData: "Loading admin data...",
    errorData: "Some admin data could not be loaded. Refresh or continue with available sections.",
    emptyData: "No orders yet.",
    retry: "Retry",
    pending: "Pending",
    delivered: "Delivered",
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
  if (raw.includes("cancel") || raw.includes("fail")) return isArabic ? "ملغي / فشل" : "Cancelled / Failed";
  if (raw.includes("pending") || raw.includes("confirm") || raw.includes("review")) return isArabic ? "قيد المراجعة" : "Under Review";
  if (raw.includes("postpone") || raw.includes("defer") || raw.includes("schedule")) return isArabic ? "مؤجل" : "Postponed";
  if (raw.includes("return")) return isArabic ? "راجع" : "Returned";
  if (raw.includes("pick") || raw.includes("assign") || raw.includes("collect")) return isArabic ? "قيد الإحضار" : "Pickup";
  if (raw.includes("deliver") || raw.includes("complete")) return isArabic ? "تم التسليم" : "Delivered";
  if (raw.includes("transit") || raw.includes("progress")) return isArabic ? "جاري التوصيل" : "In Transit";
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

function AdminSectionWorkspace({ id, title, ui, isArabic, metrics, orders, onOpenOperations }: { id: SectionId; title: string; ui: typeof copy.ar; isArabic: boolean; metrics: MetricMap; orders: any[]; onOpenOperations: () => void }) {
  const filteredOrders = filterOrdersForSection(id, orders);
  const count = filteredOrders.length;
  const totalAmount = filteredOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const totalIncome = filteredOrders.reduce((sum, order) => sum + getOrderIncome(order), 0);
  const rows = filteredOrders.slice(0, 30);

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
                </tr>
              </thead>
              <tbody>
                {rows.map((order, index) => (
                  <tr key={String(order.id || order.tracking_number || index)}>
                    <td><b>{getTracking(order)}</b></td>
                    <td><span className="dn-admin-status-chip">{translateStatus(order.status, isArabic)}</span></td>
                    <td>{order.merchant_name || order.sender_name || order.customer_name || "—"}</td>
                    <td>{getRoute(order)}</td>
                    <td>{order.receiver_name || order.recipient_name || order.customer_name || "—"}</td>
                    <td>{money(getOrderAmount(order))}</td>
                    <td>{order.created_at ? new Date(order.created_at).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—"}</td>
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

export default function AdminPanelLuxury() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const ui = isArabic ? copy.ar : copy.en;
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats>({ total: 0, pending: 0, in_transit: 0, delivered: 0, cancelled: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const activeItem = menu.find((item) => item.id === active) || menu[0];
  const activeTitle = getMenuLabel(activeItem, isArabic);

  async function refreshAdminData() {
    setDataLoading(true);
    setDataError("");
    try {
      const [ordersResult, statsResult] = await Promise.allSettled([fetchAdminOrders(), fetchAdminStats()]);
      const nextOrders = ordersResult.status === "fulfilled" && Array.isArray(ordersResult.value) ? ordersResult.value : [];
      setOrders(nextOrders);
      setAdminStats(statsResult.status === "fulfilled" ? statsResult.value : calculateOrderStats(nextOrders));
      if (ordersResult.status === "rejected" || statsResult.status === "rejected") setDataError(ui.errorData);
    } catch {
      setOrders([]);
      setAdminStats({ total: 0, pending: 0, in_transit: 0, delivered: 0, cancelled: 0 });
      setDataError(ui.errorData);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setDataLoading(true);
    void Promise.allSettled([fetchAdminOrders(), fetchMerchants(), fetchAdminStats()]).then(([ordersResult, merchantsResult, statsResult]) => {
      if (!alive) return;
      const nextOrders = ordersResult.status === "fulfilled" && Array.isArray(ordersResult.value) ? ordersResult.value : [];
      setOrders(nextOrders);
      setAdminStats(statsResult.status === "fulfilled" ? statsResult.value : calculateOrderStats(nextOrders));
      if (ordersResult.status === "rejected" || merchantsResult.status === "rejected" || statsResult.status === "rejected") setDataError(ui.errorData);
      setDataLoading(false);
    }).catch(() => {
      if (!alive) return;
      setOrders([]);
      setAdminStats({ total: 0, pending: 0, in_transit: 0, delivered: 0, cancelled: 0 });
      setDataError(ui.errorData);
      setDataLoading(false);
    });
    return () => { alive = false; };
  }, [ui.errorData]);

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
    return { total: adminStats.total || orders.length, cancelled: adminStats.cancelled || cancelled, review, postponed, returned, pickup, abuDhabi, external, outScope, codTotal, income, pending: adminStats.pending, inTransit: adminStats.in_transit, delivered: adminStats.delivered };
  }, [adminStats, orders]);

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

          <div className="dn-admin-support-card">
            <Headphones className="h-9 w-9" />
            <h3>{ui.help}</h3>
            <p>{ui.preparing}</p>
          </div>
        </aside>

        <section className="dn-admin-center-zone">
          <header className="dn-admin-main-title"><span>{ui.commandCenter}</span><h1>{ui.welcome}</h1><p>{ui.subtitle}</p></header>

          <div className="dn-admin-map-live">
            <div className="dn-admin-map-bg" />
            <div className="dn-admin-map-heading"><Truck className="h-5 w-5" /><strong>{ui.trackingTitle}</strong><p>{ui.trackingSubtitle}</p></div>
            <div className="dn-admin-route-line" />
            <div className="dn-admin-pin is-pickup"><strong>{ui.pickupPoint}</strong><span>{ui.pickupText}</span></div>
            <div className="dn-admin-pin is-current"><strong>{ui.inTransit}</strong><span>{ui.inTransitText}</span></div>
            <div className="dn-admin-pin is-delivery"><strong>{ui.deliveryPoint}</strong><span>{ui.deliveryText}</span></div>
            <div className="dn-admin-van"><Truck className="h-7 w-7" /></div>
          </div>

          <div className="dn-admin-bottom-cards">
            {[[ui.pending, `${metrics.pending} ${ui.liveOrders}`, FileText], [ui.inTransit, `${metrics.inTransit} ${ui.liveOrders}`, Package], [ui.delivered, `${metrics.delivered} ${ui.liveOrders}`, ClipboardList], [ui.quickHelp, ui.preparing, Headphones]].map(([title, text, Icon]) => {
              const CardIcon = Icon as typeof FileText;
              return <article key={String(title)}><div><CardIcon className="h-6 w-6" /></div><strong>{title as string}</strong><p>{text as string}</p></article>;
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (dataLoading) return <div className="dn-admin-filter-empty"><Package className="h-8 w-8 animate-pulse" /><strong>{ui.loadingData}</strong></div>;
    if (dataError) return <div className="dn-admin-section-workspace"><div className="dn-admin-filter-empty"><AlertTriangle className="h-8 w-8" /><strong>{dataError}</strong><button type="button" onClick={() => void refreshAdminData()}>{ui.retry}</button></div></div>;
    if (active === "dashboard") return renderDashboard();
    if (active === "new_order") return <AdminNewOrder isArabic={isArabic} onSaved={() => void refreshAdminData()} />;
    if (active === "new_merchant") return <AdminNewMerchant isArabic={isArabic} onSaved={() => void refreshAdminData()} />;
    if (coreFormSections.includes(active)) return <div className="dn-admin-core-full"><AdminPanelCore /></div>;
    if (active === "merchants") return <div className="dn-admin-core-full"><AdminMerchantIntelligence isArabic={isArabic} onSearchOrders={() => setActive("all_orders")} onCreateOrder={() => setActive("new_order")} /></div>;
    if (active === "support") return <div className="dn-admin-core-full"><AdminProspectingLinks /></div>;
    if (filteredSectionIds.has(active)) return <AdminSectionWorkspace id={active} title={activeTitle} ui={ui} isArabic={isArabic} metrics={metrics} orders={orders} onOpenOperations={openOperations} />;
    return <AdminSectionWorkspace id={active} title={activeTitle} ui={ui} isArabic={isArabic} metrics={metrics} orders={orders} onOpenOperations={openOperations} />;
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
