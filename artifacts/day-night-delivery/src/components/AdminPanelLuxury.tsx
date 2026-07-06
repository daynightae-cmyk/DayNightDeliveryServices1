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
  UserRound,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";
import companyMeta from "../data/companyMeta";
import { supabase } from "../supabase";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-admin-drawer.css";
import "../styles/dn-khalifa-final.css";

const menu = [
  ["dashboard", "لوحة التحكم", Home],
  ["new_order", "إضافة طلب جديد", PackagePlus],
  ["new_merchant", "إضافة تاجر", UserRoundPlus],
  ["merchants", "التجار", Store],
  ["all_orders", "كافة الطلبات", ClipboardList],
  ["cancelled", "الطلبات الملغية", X],
  ["review", "الطلبات قيد المراجعة", ShieldCheck],
  ["postponed", "الطلبات المؤجلة", PackageCheck],
  ["returned", "الطلبات الراجعة", RotateCcw],
  ["pickup", "الطلبات قيد الإحضار", Truck],
  ["abu_dhabi", "طلبات أبوظبي", Truck],
  ["external", "الطلبات الخارجية", Import],
  ["out_scope", "الطلبات خارج النطاق", AlertTriangle],
  ["driver_statements", "كشوفات المناديب", FileText],
  ["merchant_statements", "كشوفات التجار", ReceiptText],
  ["income", "الدخل", Wallet],
  ["expenses", "المصروفات", Database],
  ["import", "استيراد الشحنات", Import],
  ["print", "طباعة فواتير", Printer],
  ["reports", "التقارير", BarChart3],
  ["settings", "الإعدادات", Settings],
  ["support", "الدعم الفني", Headphones],
  ["logout", "تسجيل الخروج", LogOut],
] as const;

type SectionId = typeof menu[number][0];

const liveCoreSections: SectionId[] = ["new_order", "new_merchant", "all_orders"];

function AdminEmptyState({ title }: { title: string }) {
  return (
    <div className="dn-admin-empty-state">
      <Database className="h-8 w-8" />
      <h2>{title}</h2>
      <p>هذا القسم قيد التجهيز. سيتم عرض البيانات الحقيقية هنا عند توفرها.</p>
    </div>
  );
}

export default function AdminPanelLuxury() {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const activeTitle = menu.find((item) => item[0] === active)?.[1] || "لوحة التحكم";

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

  function renderContent() {
    if (active === "dashboard") {
      return (
        <div className="dn-admin-dashboard-grid">
          <section className="dn-admin-hero-panel">
            <span>مركز القيادة</span>
            <h1>مرحباً يا أبو خليفة</h1>
            <p>واجهة هادئة لإدارة العمليات. لا يتم عرض أسماء أو أرقام أو إحصائيات غير حقيقية.</p>
          </section>

          <section className="dn-admin-map-placeholder">
            <div>
              <strong>مسار الشحنات</strong>
              <p>سيتم عرض البيانات الحقيقية هنا عند توفرها.</p>
            </div>
          </section>

          <section className="dn-admin-quick-grid">
            {[
              "آخر التحديثات",
              "معلومات الشحنة",
              "تفاصيل الشحنة",
              "مساعدة سريعة",
            ].map((label) => (
              <article key={label} className="dn-admin-mini-card">
                <strong>{label}</strong>
                <p>لا توجد بيانات بعد</p>
              </article>
            ))}
          </section>
        </div>
      );
    }

    if (liveCoreSections.includes(active)) {
      return <div className="dn-admin-core-wrapper"><AdminPanelCore /></div>;
    }

    if (active === "merchants") {
      return <div className="dn-admin-core-wrapper"><AdminMerchantIntelligence isArabic onSearchOrders={() => setActive("all_orders")} onCreateOrder={() => setActive("new_order")} /></div>;
    }

    if (active === "support") {
      return <div className="dn-admin-core-wrapper"><AdminProspectingLinks /></div>;
    }

    return <AdminEmptyState title={activeTitle} />;
  }

  return (
    <div id="dn-admin-top" className="dn-admin-phase3" dir="rtl">
      <AdminFloatingHelper />

      <button type="button" className="dn-admin-mobile-trigger" onClick={() => setMobileMenu(true)}>
        <Menu className="h-5 w-5" />
        قائمة الإدارة
      </button>

      {mobileMenu && <button type="button" className="dn-admin-mobile-backdrop" aria-label="Close" onClick={() => setMobileMenu(false)} />}

      <div className="dn-admin-phase3-layout">
        <main className="dn-admin-main">
          <header className="dn-admin-topbar">
            <div>
              <span>بوابة الإدارة</span>
              <h1>{activeTitle}</h1>
              <p>أبو خليفة · مدير النظام</p>
            </div>
          </header>

          {renderContent()}
        </main>

        <aside className={`dn-admin-sidebar-final ${mobileMenu ? "is-open" : ""}`}>
          <button type="button" className="dn-admin-sidebar-close" onClick={() => setMobileMenu(false)} aria-label="إغلاق القائمة">
            <X className="h-4 w-4" />
          </button>

          <div className="dn-admin-profile-card">
            <img src={companyMeta.logoUrl} onError={(e) => { e.currentTarget.src = companyMeta.logoRemoteUrl; }} alt="DAY NIGHT" />
            <div className="dn-admin-avatar-symbol"><UserRound className="h-5 w-5" /></div>
            <h2>أبو خليفة</h2>
            <p>مدير النظام</p>
            <small>نصل إليك في كل وقت</small>
          </div>

          <nav className="dn-admin-sidebar-menu" aria-label="قائمة الإدارة">
            {menu.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => selectSection(id)}
                className={`dn-admin-sidebar-item ${active === id ? "is-active" : ""}`}
              >
                <span className="dn-admin-sidebar-icon"><Icon className="h-4 w-4" /></span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
