import { useState } from "react";
import { Activity, BarChart3, ClipboardList, Database, Download, FileText, Menu, Radar, ShieldCheck, Sparkles, Store, Target, Truck, Wallet, X } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import AdminPanelCore from "./AdminPanel";
import AdminMerchantIntelligence from "./AdminMerchantIntelligence";
import AdminProspectingLinks from "./AdminProspectingLinks";
import AdminMascotWelcome from "./admin/AdminMascotWelcome";
import AdminFloatingHelper from "./admin/AdminFloatingHelper";
import "../styles/dn-dashboard-map.css";
import "../styles/dn-admin-drawer.css";
import "../styles/dn-admin-cartoon-command.css";

type SectionId = "overview" | "orders" | "merchants" | "hunter" | "tracking" | "finance" | "reports" | "settings";

const menu = [
  { id: "overview", label: "الرئيسية", hint: "ملخص القيادة", icon: BarChart3 },
  { id: "orders", label: "إدارة الطلبات", hint: "طلبات وفواتير", icon: ClipboardList },
  { id: "merchants", label: "التجار الحاليين", hint: "تحليل التجار", icon: Store },
  { id: "hunter", label: "صياد التجار", hint: "فرص تعاقد", icon: Target },
  { id: "tracking", label: "التشغيل والتتبع", hint: "مسارات وحالات", icon: Radar },
  { id: "finance", label: "المالية", hint: "تحصيل وكشوفات", icon: Wallet },
  { id: "reports", label: "التقارير", hint: "PDF وطباعة", icon: FileText },
  { id: "settings", label: "الحماية", hint: "صلاحيات وجودة", icon: ShieldCheck },
] as const;

function MiniStat({ icon: Icon, value, label }: { icon: typeof Activity; value: string; label: string }) {
  return <div className="dn-command-stat-card p-4"><Icon className="mb-3 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-brand-gold" dir="ltr">{value}</p><p className="mt-1 text-xs font-bold text-white/45">{label}</p></div>;
}

export default function AdminPanelLuxury() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [intro, setIntro] = useState(true);
  const [active, setActive] = useState<SectionId>("overview");
  const [open, setOpen] = useState(false);
  const activeTitle = menu.find((item) => item.id === active)?.label || "الرئيسية";

  function openSection(id: SectionId) { setActive(id); setOpen(false); }

  function sectionContent() {
    if (active === "orders") return <AdminPanelCore />;
    if (active === "merchants") return <AdminMerchantIntelligence isArabic={isArabic} onSearchOrders={() => openSection("orders")} onCreateOrder={() => openSection("orders")} />;
    if (active === "hunter") return <AdminProspectingLinks />;
    if (active === "overview") return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><MiniStat icon={Activity} value="Live" label="تشغيل مباشر" /><MiniStat icon={ClipboardList} value="30 AED" label="المحلي بالطلبية" /><MiniStat icon={Store} value="AI" label="ذكاء التجار" /><MiniStat icon={Database} value="DB" label="بيانات حقيقية" /></div><div className="dn-command-panel p-6"><h2 className="text-3xl font-black text-white">لوحة قيادة الإدارة</h2><p className="mt-3 text-sm font-bold leading-7 text-white/55">اختر من القائمة اليمنى لفتح الطلبات أو التجار أو صياد التجار أو التقارير. كل قسم يظهر في المساحة المقابلة بشكل كروت وبيانات واضحة.</p><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{menu.slice(1,5).map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => openSection(item.id)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-start hover:border-brand-gold/40"><Icon className="mb-3 h-5 w-5 text-brand-gold" /><strong className="block text-white">{item.label}</strong><span className="mt-1 block text-xs text-white/45">{item.hint}</span></button>; })}</div></div></div>;
    return <div className="dn-command-panel p-6"><h2 className="text-3xl font-black text-white">{activeTitle}</h2><p className="mt-3 text-sm font-bold leading-7 text-white/55">هذا القسم جاهز بصرياً، ويمكن فتح مستودع الطلبات للاطلاع على البيانات الحقيقية والتصدير.</p><button onClick={() => openSection("orders")} className="mt-5 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep">فتح مستودع الطلبات</button></div>;
  }

  return (
    <div id="dn-admin-top" className="dn-admin-luxury-shell dn-admin-cinematic space-y-7 scroll-smooth" dir="rtl">
      {intro && <AdminMascotWelcome onComplete={() => setIntro(false)} />}
      <AdminFloatingHelper />
      <button type="button" className="dn-command-menu-button" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /> قائمة الإدارة</button>
      {open && <button type="button" aria-label="Close menu" className="dn-command-backdrop" onClick={() => setOpen(false)} />}
      <div className="dn-command-layout">
        <aside className={`dn-command-sidebar p-4 ${open ? "is-open" : ""}`}>
          <button type="button" className="mb-3 hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 max-[1100px]:block" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-center"><img src={companyMeta.logoUrl} alt="DAY NIGHT" className="mx-auto h-20 w-20 rounded-full border-2 border-brand-gold/45 bg-white object-contain" /><h2 className="mt-3 text-xl font-black text-white">DAY NIGHT</h2><p className="text-xs font-bold text-white/45">لوحة القيادة</p></div>
          <div className="space-y-2">{menu.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => openSection(item.id)} className={`dn-command-nav-item ${active === item.id ? "is-active" : ""}`}><span className="dn-command-nav-icon"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">{item.label}</strong><small className="mt-1 block truncate text-[11px] font-bold text-white/40">{item.hint}</small></span></button>; })}</div>
        </aside>
        <main className="dn-command-main space-y-5">
          <section className="relative overflow-hidden rounded-[2.35rem] border border-brand-sky/20 bg-[#031226] p-5 shadow-2xl shadow-black/30 sm:p-7 lg:p-8"><div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(212,166,42,0.18),transparent_24rem),radial-gradient(circle_at_90%_12%,rgba(25,167,255,0.24),transparent_30rem)]" /><div className="relative z-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-center"><div><span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold"><Sparkles className="h-4 w-4" /> مركز القيادة الجديد</span><h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">لوحة إدارة داي نايت السينمائية</h1><p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-white/58">القسم الحالي: {activeTitle}. القائمة على اليمين والمساعد الذكي على الجانب الآخر.</p></div><div className="grid grid-cols-2 gap-3"><MiniStat icon={Activity} value="Live" label="متابعة" /><MiniStat icon={Database} value="Data" label="بيانات" /><MiniStat icon={Download} value="Export" label="تصدير" /><MiniStat icon={Truck} value="Fleet" label="تشغيل" /></div></div></section>
          <section id={active === "merchants" ? "dn-admin-ai" : active === "hunter" ? "dn-admin-prospect" : "dn-admin-core"} className="scroll-mt-28">{sectionContent()}</section>
        </main>
      </div>
    </div>
  );
}
