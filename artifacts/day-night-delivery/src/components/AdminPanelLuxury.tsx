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
import { useAppContext } from "../lib/AppContext";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-khalifa-final.css";
import "../styles/dn-admin-task2.css";

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
};

const liveCoreSections: SectionId[] = ["new_order", "new_merchant", "all_orders"];

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
    openOperations: "فتح مستودع العمليات",
    totalOrders: "إجمالي الطلبات",
    sectionCount: "عدد هذا القسم",
    codTotal: "إجمالي التحصيل COD",
    income: "دخل التوصيل",
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
    openOperations: "Open Operations Warehouse",
    totalOrders: "Total Orders",
    sectionCount: "Section Count",
    codTotal: "COD Total",
    income: "Delivery Income",
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

function getSectionCount(id: SectionId, metrics: MetricMap) {
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
      "مراجعة البيانات الحية وربطها بقرار تشغيلي واضح.",
      "تجهيز الإجراءات اليومية: اتصال، متابعة، طباعة، أو تحديث حالة.",
      "فتح مستودع العمليات عند الحاجة لعرض الجدول الكامل والفلاتر المتقدمة.",
    ];
  }
  return [
    "Review live data and connect it to a clear operational decision.",
    "Prepare daily actions: call, follow-up, print, or update status.",
    "Open Operations Warehouse when full table filters are needed.",
  ];
}

function AdminSectionWorkspace({ id, title, ui, isArabic, metrics, onOpenOperations }: { id: SectionId; title: string; ui: typeof copy.ar; isArabic: boolean; metrics: MetricMap; onOpenOperations: () => void }) {
  const count = getSectionCount(id, metrics);
  return (
    <section className="dn-admin-section-workspace">
      <header className="dn-admin-section-hero">
        <span>{isArabic ? "مركز تشغيل مخصص" : "Dedicated Operations Center"}</span>
        <h1>{title}</h1>
        <p>{sectionDescription(id, isArabic)}</p>
      </header>

      <div className="dn-admin-section-kpis">
        <article><strong>{metrics.total}</strong><span>{ui.totalOrders}</span></article>
        <article><strong>{count}</strong><span>{ui.sectionCount}</span></article>
        <article><strong>{money(metrics.codTotal)}</strong><span>{ui.codTotal}</span></article>
        <article><strong>{money(metrics.income)}</strong><span>{ui.income}</span></article>
      </div>

      <div className="dn-admin-section-panels">
        <div>
          <h2>{ui.actionPlan}</h2>
          {sectionBullets(id, isArabic).map((item) => <p key={item}>• {item}</p>)}
        </div>
        <div>
          <h2>{ui.quickActions}</h2>
          <button type="button" onClick={onOpenOperations}>{ui.openOperations}</button>
          <small>{isArabic ? "يتم الاعتماد على بيانات Supabase الحية في مستودع العمليات." : "Uses live Supabase data inside the Operations Warehouse."}</small>
        </div>
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

  const activeItem = menu.find((item) => item.id === active) || menu[0];
  const activeTitle = getMenuLabel(activeItem, isArabic);

  useEffect(() => {
    let alive = true;
    fetchAllOrders()
      .then((data) => { if (alive) setOrders(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setOrders([]); });
    return () => { alive = false; };
  }, []);

  const metrics = useMemo<MetricMap>(() => {
    const cancelled = orders.filter((o) => normalize(o.status).includes("cancel") || normalize(o.status).includes("fail")).length;
    const review = orders.filter((o) => normalize(o.status).includes("pending") || normalize(o.status).includes("confirm") || normalize(o.status).includes("review")).length;
    const postponed = orders.filter((o) => normalize(o.status).includes("postpone") || normalize(o.status).includes("defer") || normalize(o.status).includes("schedule")).length;
    const returned = orders.filter((o) => normalize(o.status).includes("return")).length;
    const pickup = orders.filter((o) => normalize(o.status).includes("pick") || normalize(o.status).includes("assign")).length;
    const abuDhabi = orders.filter((o) => `${o.sender_city || ""} ${o.receiver_city || ""}`.toLowerCase().includes("abu dhabi") || `${o.sender_city || ""} ${o.receiver_city || ""}`.includes("أبوظبي")).length;
    const external = orders.filter((o) => normalize(o.shipping_scope).includes("international") || normalize(o.destination_country)).length;
    const outScope = orders.filter((o) => normalize(o.status).includes("scope") || normalize(o.notes).includes("out of scope")).length;
    const codTotal = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    const income = orders.reduce((sum, order) => sum + Number(order.delivery_price || order.price || 0), 0);
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
    if (liveCoreSections.includes(active)) return <div className="dn-admin-core-full"><AdminPanelCore /></div>;
    if (active === "merchants") return <div className="dn-admin-core-full"><AdminMerchantIntelligence isArabic={isArabic} onSearchOrders={() => setActive("all_orders")} onCreateOrder={() => setActive("new_order")} /></div>;
    if (active === "support") return <div className="dn-admin-core-full"><AdminProspectingLinks /></div>;
    return <AdminSectionWorkspace id={active} title={activeTitle} ui={ui} isArabic={isArabic} metrics={metrics} onOpenOperations={openOperations} />;
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
