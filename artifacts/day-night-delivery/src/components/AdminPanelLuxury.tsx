import { Activity, BarChart3, Database, Download, ShieldCheck, Store, Truck } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminDrawerMini from "./AdminDrawerMini";
import AdminProspectingLinks from "./AdminProspectingLinks";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-admin-drawer.css";
import "../styles/dn-admin-cartoon-command.css";

export default function AdminPanelLuxury() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const cards = [
    { icon: Activity, value: "Live", label: isArabic ? "متابعة مباشرة" : "Live view" },
    { icon: Database, value: "Data", label: isArabic ? "بيانات الطلبات" : "Order data" },
    { icon: Download, value: "Export", label: isArabic ? "تصدير فوري" : "Quick export" },
    { icon: Truck, value: "Fleet", label: isArabic ? "تشغيل الشحنات" : "Shipment flow" },
  ];

  return (
    <div id="dn-admin-top" className="dn-admin-luxury-shell space-y-7 scroll-smooth" dir={isArabic ? "rtl" : "ltr"}>
      <AdminDrawerMini />
      <section className="relative overflow-hidden rounded-[2.35rem] border border-brand-sky/20 bg-[#031226] p-5 shadow-2xl shadow-black/30 sm:p-7 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(212,166,42,0.18),transparent_24rem),radial-gradient(circle_at_90%_12%,rgba(25,167,255,0.24),transparent_30rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(79,215,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(79,215,255,0.045)_1px,transparent_1px)] bg-[size:48px_48px] opacity-70" />
        <div className="relative z-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-16 w-16 rounded-full border-2 border-brand-gold/55 bg-white object-contain shadow-xl shadow-brand-sky/10" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">DAY NIGHT</p>
                <p className="text-sm font-black text-white/78">{isArabic ? "مركز الإدارة" : "Admin Center"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold"><ShieldCheck className="h-4 w-4" /> {isArabic ? "لوحة تشغيل الطلبات" : "Orders workspace"}</span>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">{isArabic ? "لوحة فاخرة لإدارة الشحنات والطلبات" : "Premium dashboard for shipments and orders"}</h1>
            <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-white/58">{isArabic ? "مركز واحد للتجار، الطلبيات، الكوبونات، الفواتير، البحث الذكي، والتقارير بنفس هوية DAY NIGHT." : "One operations hub for merchants, coupon orders, invoices, smart search, and reports in the DAY NIGHT identity."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cards.map(({ icon: Icon, value, label }) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl"><Icon className="mb-3 h-5 w-5 text-brand-gold" /><p className="font-mono text-xl font-black text-brand-gold" dir="ltr">{value}</p><p className="mt-1 text-xs font-bold text-white/58">{label}</p></div>)}
            <div className="col-span-2 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-brand-gold" /><div><p className="text-sm font-black text-white">{isArabic ? "ذكاء تشغيلي للتجار" : "Merchant intelligence"}</p><p className="text-xs font-bold text-white/50">{isArabic ? "بحث، تقييم، مخاطر، وقرارات أسرع" : "Search, scoring, risk, and faster decisions"}</p></div></div></div>
          </div>
        </div>
      </section>
      <section id="dn-admin-ai" className="scroll-mt-28"><AdminMerchantIntelligence isArabic={isArabic} onSearchOrders={() => undefined} onCreateOrder={() => undefined} /></section>
      <AdminProspectingLinks />
      <section id="dn-admin-core" className="scroll-mt-28 rounded-[2rem] border border-white/10 bg-brand-cool/20 p-4 sm:p-5"><div className="mb-4 flex items-center gap-3 text-brand-gold"><Store className="h-5 w-5" /><strong>{isArabic ? "مستودع الطلبات والتجار" : "Orders and merchants workspace"}</strong></div><AdminPanelCore /></section>
    </div>
  );
}
