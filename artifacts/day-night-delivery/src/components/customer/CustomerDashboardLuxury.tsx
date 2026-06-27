import { Link, useLocation } from "react-router-dom";
import { Clock3, MapPin, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import companyMeta from "../../data/companyMeta";
import CustomerDashboardCore from "./CustomerDashboard";
import "../../styles/dn-dashboard-map.css";

export default function CustomerDashboardLuxury() {
  const { language } = useAppContext();
  const location = useLocation();
  const isArabic = language === "ar";
  const isPasswordUpdate = location.pathname === "/update-password";

  const quickStats = [
    { icon: Clock3, value: "24/7", label: isArabic ? "متابعة مستمرة" : "Always on" },
    { icon: PackageCheck, value: "Live", label: isArabic ? "طلبات مرتبطة بالحساب" : "Linked orders" },
    { icon: ShieldCheck, value: "Secure", label: isArabic ? "حساب عميل آمن" : "Secure account" },
    { icon: MapPin, value: "UAE", label: isArabic ? "تغطية داخل الإمارات" : "UAE coverage" },
  ];

  if (isPasswordUpdate) {
    return <CustomerDashboardCore />;
  }

  return (
    <div className="dn-customer-luxury-shell space-y-7" dir={isArabic ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-[2.35rem] border border-brand-sky/20 bg-[#031226] p-5 shadow-2xl shadow-black/30 sm:p-7 lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(212,166,42,0.18),transparent_22rem),radial-gradient(circle_at_86%_10%,rgba(25,167,255,0.20),transparent_28rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(79,215,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(79,215,255,0.045)_1px,transparent_1px)] bg-[size:48px_48px] opacity-70" />
        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-16 w-16 rounded-full border-2 border-brand-gold/55 bg-white object-contain shadow-xl shadow-brand-sky/10" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">DAY NIGHT</p>
                <p className="text-sm font-black text-white/78">{isArabic ? "مركز العملاء الذكي" : "Smart Customer Center"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black text-brand-gold">
              <Sparkles className="h-4 w-4" /> {isArabic ? "تجربة عملاء فاخرة ومتصلة" : "Luxury connected customer experience"}
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl">
              {isArabic ? "حسابك، طلباتك، وتتبع شحناتك في لوحة واحدة" : "Your account, orders, and tracking in one premium hub"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-white/58">
              {isArabic ? "واجهة موحدة للعميل لتسجيل الدخول، إنشاء الطلبات، متابعة الشحنات، والرجوع السريع إلى التتبع والدعم." : "A unified customer workspace for sign-in, delivery requests, live tracking, and support shortcuts."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickStats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
                <Icon className="mb-3 h-5 w-5 text-brand-gold" />
                <p className="font-mono text-xl font-black text-brand-gold" dir="ltr">{value}</p>
                <p className="mt-1 text-xs font-bold text-white/58">{label}</p>
              </div>
            ))}
            <Link to="/request" className="dn-btn dn-btn-primary dn-btn-md col-span-2"><Truck className="h-4 w-4" /> {isArabic ? "طلب توصيل جديد" : "New delivery request"}</Link>
          </div>
        </div>
      </section>

      <CustomerDashboardCore />
    </div>
  );
}
