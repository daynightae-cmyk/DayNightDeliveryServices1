import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Camera, Clock3, MapPin, PackageCheck, ShieldCheck, Sparkles, Truck, Upload, X } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import companyMeta from "../../data/companyMeta";
import CustomerDashboardCore from "./CustomerDashboard";
import "../../styles/dn-dashboard-map.css";

export default function CustomerDashboardLuxury() {
  const { language } = useAppContext();
  const location = useLocation();
  const isArabic = language === "ar";
  const isPasswordUpdate = location.pathname === "/update-password";
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarName, setAvatarName] = useState("");
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "ready" | "saving" | "success" | "error">("idle");
  const avatarMessage = useMemo(() => {
    if (avatarStatus === "success") return isArabic ? "تم تجهيز الصورة للرفع. سيتم ربطها بسلة avatars بعد تأكيد إعدادات Supabase Storage." : "Photo is ready. Storage upload will be enabled after the avatars bucket/policies are confirmed.";
    if (avatarStatus === "error") return isArabic ? "تعذر قراءة الصورة. جرّب ملف صورة آخر." : "Could not read this image. Try another image file.";
    if (avatarStatus === "ready") return isArabic ? "معاينة آمنة فقط — لا يتم رفع أي ملف حالياً." : "Safe preview only — no file is uploaded yet.";
    return isArabic ? "مكان مخصص لتحديث صورة الحساب لاحقاً بدون تغيير بيانات العميل الحالية." : "Prepared profile-photo update area without changing existing customer data.";
  }, [avatarStatus, isArabic]);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarStatus("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result || ""));
      setAvatarName(file.name);
      setAvatarStatus("ready");
    };
    reader.onerror = () => setAvatarStatus("error");
    reader.readAsDataURL(file);
  }

  function clearAvatar() {
    setAvatarPreview("");
    setAvatarName("");
    setAvatarStatus("idle");
  }

  function simulateAvatarPrepare() {
    if (!avatarPreview) {
      setAvatarStatus("error");
      return;
    }
    setAvatarStatus("saving");
    window.setTimeout(() => setAvatarStatus("success"), 450);
  }

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
              <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-16 w-16 rounded-full border-2 border-brand-gold/55 bg-brand-deep object-cover shadow-xl shadow-brand-sky/10 ring-1 ring-white/10" />
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

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-brand-sky/10 backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-brand-gold/45 bg-brand-deep/80">
                {avatarPreview ? <img src={avatarPreview} alt={isArabic ? "معاينة صورة الحساب" : "Profile preview"} className="h-full w-full object-cover" /> : <Camera className="h-9 w-9 text-brand-gold" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">{isArabic ? "صورة الحساب" : "Profile photo"}</p>
                <p className="mt-1 text-xs font-bold leading-6 text-white/55">{avatarMessage}</p>
                {avatarName && <p className="mt-1 truncate font-mono text-[11px] text-brand-gold" dir="ltr">{avatarName}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 text-xs font-black text-brand-gold hover:bg-brand-gold/15">
                    <Upload className="h-4 w-4" /> {isArabic ? "اختيار صورة" : "Choose image"}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                  </label>
                  <button type="button" onClick={simulateAvatarPrepare} disabled={!avatarPreview || avatarStatus === "saving"} className="rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-3 py-2 text-xs font-black text-brand-sky disabled:cursor-not-allowed disabled:opacity-45">{avatarStatus === "saving" ? (isArabic ? "جاري التجهيز..." : "Preparing...") : (isArabic ? "تجهيز للرفع" : "Prepare upload")}</button>
                  {avatarPreview && <button type="button" onClick={clearAvatar} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70"><X className="h-4 w-4" /> {isArabic ? "إزالة" : "Remove"}</button>}
                </div>
              </div>
            </div>
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
