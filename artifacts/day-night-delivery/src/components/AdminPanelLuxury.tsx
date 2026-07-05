import { useState } from "react";
import { BarChart3, ClipboardList, Database, FileText, Headphones, Home, Import, LogOut, Menu, PackageCheck, PackagePlus, Printer, ReceiptText, RotateCcw, Settings, ShieldCheck, Store, Truck, UserRound, UserRoundPlus, Wallet, X } from "lucide-react";
import { supabase } from "../supabase";
import companyMeta from "../data/companyMeta";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-admin-drawer.css";
import "../styles/dn-admin-cartoon-command.css";

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
  ["out_scope", "الطلبات خارج النطاق", Database],
  ["driver_statements", "كشوفات المناديب", FileText],
  ["merchant_statements", "كشوفات التجار", ReceiptText],
  ["income", "الدخل", Wallet],
  ["expenses", "المصروفات", Database],
  ["import_shipments", "استيراد الشحنات", Import],
  ["print", "طباعة فواتير", Printer],
  ["reports", "التقارير", BarChart3],
  ["settings", "الإعدادات", Settings],
  ["support", "الدعم الفني", Headphones],
  ["logout", "تسجيل الخروج", LogOut]
] as const;

type SectionId = typeof menu[number][0];

export default function AdminPanelLuxury() {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const activeTitle = menu.find((item) => item[0] === active)?.[1] || "لوحة التحكم";

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    window.location.href = "/";
  };

  function content() {
    if (active === "dashboard") {
      return (
        <div className="dn-command-panel p-7">
          <h2 className="text-3xl font-black text-white">مرحباً يا أبو خليفة</h2>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/55">
            اختر القسم من القائمة اليمنى. لا يتم عرض أسماء أو أرقام أو إحصائيات غير حقيقية.
          </p>
        </div>
      );
    }
    if (active === "merchants") {
      return <AdminMerchantIntelligence isArabic onSearchOrders={() => setActive("all_orders")} onCreateOrder={() => setActive("new_order")} />;
    }
    if (active === "support") {
      return <AdminProspectingLinks />;
    }
    if (["expenses", "import_shipments", "settings", "print", "reports", "driver_statements", "merchant_statements", "income", "cancelled", "review", "postponed", "returned", "pickup", "abu_dhabi", "external", "out_scope"].includes(active)) {
      return (
        <div className="dn-command-panel p-8 text-center">
          <Database className="mx-auto mb-4 h-7 w-7 text-brand-gold" />
          <h2 className="text-2xl font-black text-white">{activeTitle}</h2>
          <p className="mt-3 text-sm font-bold leading-7 text-white/50">
            هذا القسم قيد التجهيز، وسيتم عرض البيانات الحقيقية هنا عند توفرها.
          </p>
        </div>
      );
    }
    if (active === "logout") {
      handleLogout();
      return null;
    }
    return <AdminPanelCore />;
  }

  return (
    <div id="dn-admin-top" className="dn-admin-luxury-shell dn-admin-cinematic scroll-smooth" dir="rtl">
      <AdminFloatingHelper />
      <button type="button" className="dn-command-menu-button" onClick={() => setMobileMenu(true)}>
        <Menu className="h-5 w-5" /> قائمة الإدارة
      </button>
      {mobileMenu && <button type="button" className="dn-command-backdrop" aria-label="Close" onClick={() => setMobileMenu(false)} />}
      <div className="dn-command-layout">
        <aside className={`dn-command-sidebar p-4 ${mobileMenu ? "is-open" : ""}`}>
          <button type="button" className="mb-3 hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 max-[1100px]:block" onClick={() => setMobileMenu(false)}>
            <X className="h-4 w-4" />
          </button>

          {/* Admin Profile Block */}
          <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-center">
            <img
              src={companyMeta.logoUrl}
              onError={(e) => {
                e.currentTarget.src = companyMeta.logoRemoteUrl;
              }}
              alt="DAY NIGHT"
              className="mx-auto h-20 w-20 rounded-full border-2 border-brand-gold/45 bg-white object-contain"
            />
            <div className="mx-auto mt-4 grid h-11 w-11 place-items-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
              <UserRound className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-xl font-black text-white">أبو خليفة</h2>
            <p className="text-xs font-bold text-white/45">مدير النظام</p>
            <p className="mt-3 text-[11px] font-bold leading-5 text-brand-gold">نصل إليك في كل وقت</p>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-2">
            {menu.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === "logout") {
                    handleLogout();
                  } else {
                    setActive(id as SectionId);
                    setMobileMenu(false);
                  }
                }}
                className={`dn-command-nav-item ${active === id ? "is-active" : ""}`}
              >
                <div className="dn-command-nav-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="flex-1 text-sm font-bold">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="dn-command-main">
          {content()}
        </main>
      </div>
    </div>
  );
}
