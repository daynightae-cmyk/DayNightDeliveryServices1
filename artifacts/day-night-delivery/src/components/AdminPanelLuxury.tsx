import { useState } from "react";
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
import { useAppContext } from "../lib/AppContext";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-khalifa-final.css";

const menu = [
  ["dashboard", "لوحة التحكم", "Dashboard", Home],
  ["new_order", "إضافة طلب جديد", "New Order", PackagePlus],
  ["new_merchant", "إضافة تاجر", "New Merchant", UserRoundPlus],
  ["merchants", "التجار", "Merchants", Store],
  ["all_orders", "كافة الطلبات", "All Orders", ClipboardList],
  ["cancelled", "الطلبات الملغية", "Cancelled", X],
  ["review", "الطلبات قيد المراجعة", "Under Review", ShieldCheck],
  ["postponed", "الطلبات المؤجلة", "Postponed", PackageCheck],
  ["returned", "الطلبات الراجعة", "Returned", RotateCcw],
  ["pickup", "الطلبات قيد الإحضار", "Pickup", Truck],
  ["abu_dhabi", "طلبات أبوظبي", "Abu Dhabi Orders", Truck],
  ["external", "الطلبات الخارجية", "External Orders", Import],
  ["out_scope", "الطلبات خارج النطاق", "Out of Scope", AlertTriangle],
  ["driver_statements", "كشوفات المناديب", "Driver Statements", FileText],
  ["merchant_statements", "كشوفات التجار", "Merchant Statements", ReceiptText],
  ["income", "الدخل", "Income", Wallet],
  ["expenses", "المصروفات", "Expenses", Database],
  ["import", "استيراد الشحنات", "Import Shipments", Import],
  ["print", "طباعة فواتير", "Print Invoices", Printer],
  ["reports", "التقارير", "Reports", BarChart3],
  ["settings", "الإعدادات", "Settings", Settings],
  ["support", "الدعم الفني", "Support", Headphones],
  ["logout", "تسجيل الخروج", "Logout", LogOut],
] as const;

type SectionId = typeof menu[number][0];

const liveCoreSections: SectionId[] = ["new_order", "new_merchant", "all_orders"];

const copy = {
  ar: {
    owner: "أبو خليفة",
    role: "مدير النظام",
    commandCenter: "مركز القيادة",
    welcome: "مرحبا بك في مركز القيادة",
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
    helperText: "تحت أمرك يا أبو خليفة كيف أقدر أساعدك اليوم",
    ask: "اسألني أي شيء",
    latest: "آخر التحديثات",
    shipmentInfo: "معلومات الشحنة",
    details: "تفاصيل الشحنة",
    quickHelp: "مساعدة سريعة",
    noUpdates: "لا توجد تحديثات حاليا",
    noData: "لا توجد بيانات حاليا",
    preparing: "سيظهر المحتوى هنا عند توفر البيانات الحقيقية.",
    notReady: "هذا القسم قيد التجهيز وسيتم عرض البيانات الحقيقية هنا عند توفرها.",
    language: "English",
    menu: "قائمة الإدارة",
    help: "مساعدة",
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
    helperText: "At your service, Abu Khalifa. How can I help today?",
    ask: "Ask me anything",
    latest: "Latest Updates",
    shipmentInfo: "Shipment Info",
    details: "Shipment Details",
    quickHelp: "Quick Help",
    noUpdates: "No updates yet",
    noData: "No data yet",
    preparing: "Real content will appear here when available.",
    notReady: "This section is being prepared. Real data will appear here when available.",
    language: "العربية",
    menu: "Admin Menu",
    help: "Help",
  },
};

function getMenuLabel(item: typeof menu[number], isArabic: boolean) {
  return isArabic ? item[1] : item[2];
}

function AdminEmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="dn-admin-empty-full">
      <Database className="h-9 w-9" />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export default function AdminPanelLuxury() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const ui = isArabic ? copy.ar : copy.en;
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);

  const activeItem = menu.find((item) => item[0] === active) || menu[0];
  const activeTitle = getMenuLabel(activeItem, isArabic);

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

  function renderDashboard() {
    return (
      <div className="dn-admin-home-full">
        <aside className="dn-admin-left-ai">
          <div className="dn-admin-user-head">
            <img src={khalifaAssets.bot} alt={ui.helper} />
            <div>
              <strong>{ui.owner}</strong>
              <span>{ui.role}</span>
            </div>
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
          <header className="dn-admin-main-title">
            <span>{ui.commandCenter}</span>
            <h1>{ui.welcome}</h1>
            <p>{ui.subtitle}</p>
          </header>

          <div className="dn-admin-map-live">
            <div className="dn-admin-map-bg" />

            <div className="dn-admin-map-heading">
              <Truck className="h-5 w-5" />
              <strong>{ui.trackingTitle}</strong>
              <p>{ui.trackingSubtitle}</p>
            </div>

            <div className="dn-admin-route-line" />

            <div className="dn-admin-pin is-pickup">
              <strong>{ui.pickupPoint}</strong>
              <span>{ui.pickupText}</span>
            </div>

            <div className="dn-admin-pin is-current">
              <strong>{ui.inTransit}</strong>
              <span>{ui.inTransitText}</span>
            </div>

            <div className="dn-admin-pin is-delivery">
              <strong>{ui.deliveryPoint}</strong>
              <span>{ui.deliveryText}</span>
            </div>

            <div className="dn-admin-van">
              <Truck className="h-7 w-7" />
            </div>
          </div>

          <div className="dn-admin-bottom-cards">
            {[
              [ui.latest, ui.noUpdates, FileText],
              [ui.shipmentInfo, ui.noData, Package],
              [ui.details, ui.noData, ClipboardList],
              [ui.quickHelp, ui.preparing, Headphones],
            ].map(([title, text, Icon]) => {
              const CardIcon = Icon as typeof FileText;
              return (
                <article key={String(title)}>
                  <div><CardIcon className="h-6 w-6" /></div>
                  <strong>{title as string}</strong>
                  <p>{text as string}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (active === "dashboard") return renderDashboard();

    if (liveCoreSections.includes(active)) {
      return <div className="dn-admin-core-full"><AdminPanelCore /></div>;
    }

    if (active === "merchants") {
      return (
        <div className="dn-admin-core-full">
          <AdminMerchantIntelligence
            isArabic={isArabic}
            onSearchOrders={() => setActive("all_orders")}
            onCreateOrder={() => setActive("new_order")}
          />
        </div>
      );
    }

    if (active === "support") {
      return <div className="dn-admin-core-full"><AdminProspectingLinks /></div>;
    }

    return <AdminEmptyState title={activeTitle} text={ui.notReady} />;
  }

  return (
    <div className="dn-admin-fullscreen" dir={isArabic ? "rtl" : "ltr"}>
      <AdminFloatingHelper />

      <button type="button" className="dn-admin-mobile-open" onClick={() => setMobileMenu(true)}>
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
        <main className="dn-admin-content-full">
          <div className="dn-admin-language-row">
            <button type="button" onClick={toggleLanguage}>
              <Languages className="h-4 w-4" />
              {ui.language}
            </button>
          </div>
          {renderContent()}
        </main>

        <aside className={`dn-admin-right-sidebar ${mobileMenu ? "is-open" : ""}`}>
          <button type="button" className="dn-admin-sidebar-close-final" onClick={() => setMobileMenu(false)}>
            <X className="h-4 w-4" />
          </button>

          <div className="dn-admin-brand-card">
            <img
              src={companyMeta.logoUrl}
              onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }}
              alt="DAY NIGHT"
            />
            <strong>DAY NIGHT</strong>
            <span>DELIVERY SERVICES</span>
          </div>

          <div className="dn-admin-owner-card">
            <UserRound className="h-5 w-5" />
            <strong>{ui.owner}</strong>
            <span>{ui.role}</span>
          </div>

          <nav className="dn-admin-menu-full">
            {menu.map((item) => {
              const [id, , , Icon] = item;
              const label = getMenuLabel(item, isArabic);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectSection(id)}
                  className={active === id ? "is-active" : ""}
                >
                  <span><Icon className="h-5 w-5" /></span>
                  <strong>{label}</strong>
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
}