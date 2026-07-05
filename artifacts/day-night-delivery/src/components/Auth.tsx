import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { CheckCircle, KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import TurnstileCaptcha, { TURNSTILE_FALLBACK_TOKEN } from "./security/TurnstileCaptcha";
import { useAppContext } from "../lib/AppContext";
import CustomerDashboard from "./customer/CustomerDashboard";
import companyMeta from "../data/companyMeta";
import { CartoonMascot } from "./admin/AdminMascotWelcome";
import "../styles/dn-admin-cartoon-command.css";

interface AuthProps { onAuthSuccess: () => void; }

function LoginEntry() {
  return <div className="dn-admin-intro-overlay"><div className="dn-admin-intro-card"><div className="dn-cartoon-stage"><CartoonMascot /><div className="dn-speech-runner" dir="rtl"><span>هلا أبو خليفة يا قيادة</span></div><div className="dn-admin-loading"><i /></div><p className="text-center text-xs font-black text-white/45">جاري تجهيز بوابة الإدارة...</p></div></div></div>;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language } = useAppContext();
  const isCustomerRoute = typeof window !== "undefined" && window.location.pathname === "/customer";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);
  const usableCaptchaToken = captchaToken && captchaToken !== TURNSTILE_FALLBACK_TOKEN ? captchaToken : "";

  useEffect(() => { if (isCustomerRoute) return; void (async () => { if (!supabase) return; const { data } = await supabase.auth.getUser(); const user = data?.user; if (user && await isAdminUser(user.id)) onAuthSuccess(); })(); }, [onAuthSuccess, isCustomerRoute]);
  if (isCustomerRoute) return <CustomerDashboard />;

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault(); setErrorMsg(""); setSuccessMsg("");
    if (captchaEnabled && !usableCaptchaToken) { setErrorMsg("يرجى إكمال التحقق الأمني أولاً."); return; }
    if (!supabase) { setErrorMsg("خدمة الدخول غير متاحة حالياً."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: usableCaptchaToken ? { captchaToken: usableCaptchaToken } : undefined } as any);
      if (error) { setErrorMsg("بيانات الدخول غير صحيحة أو غير مخولة."); setLoading(false); return; }
      const user = data?.user;
      if (!user || !(await isAdminUser(user.id))) { await supabase.auth.signOut(); setErrorMsg("هذه البوابة مخصصة للإدارة فقط."); setLoading(false); return; }
      setSuccessMsg("تم التحقق. جاري فتح لوحة الإدارة..."); setEntry(true); window.setTimeout(onAuthSuccess, 2600);
    } catch { setErrorMsg("حدث خطأ أثناء تسجيل الدخول."); setLoading(false); }
  }

  return (
    <div className="relative min-h-[calc(100vh-90px)] overflow-hidden px-4 py-8 text-right" dir="rtl">
      {entry && <LoginEntry />}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,183,0,0.12),transparent_28rem),radial-gradient(circle_at_80%_18%,rgba(24,168,232,0.2),transparent_32rem),linear-gradient(135deg,#020914,#071a33_52%,#020713)]" />
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-150px)] max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2.4rem] border border-brand-sky/20 bg-[#031226]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-9">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full border-2 border-brand-gold/45 bg-white p-2"><img src={companyMeta.logoUrl} onError={(e) => { e.currentTarget.src = companyMeta.logoRemoteUrl; }} alt="DAY NIGHT" className="h-full w-full rounded-full object-contain" /></div>
          <div className="text-center"><h1 className="text-4xl font-black text-brand-gold">بوابة الإدارة</h1><p className="mt-3 text-sm font-bold text-white/62">تسجيل الدخول للوصول إلى لوحة التحكم</p></div>
          {errorMsg && <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs font-bold text-rose-200"><ShieldAlert className="ml-2 inline h-4 w-4" />{errorMsg}</div>}
          {successMsg && <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-200"><CheckCircle className="ml-2 inline h-4 w-4" />{successMsg}</div>}
          <form onSubmit={handleAdminLogin} className="mt-7 space-y-4">
            <label className="block"><span className="mb-2 block text-xs font-black text-white/65">البريد الإلكتروني أو اسم المستخدم</span><div className="relative"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin@daynightae.com" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 pr-12 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-brand-gold" dir="ltr" /><Mail className="absolute right-4 top-4 h-5 w-5 text-white/35" /></div></label>
            <label className="block"><span className="mb-2 block text-xs font-black text-white/65">كلمة المرور</span><div className="relative"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 pr-12 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-brand-gold" dir="ltr" /><KeyRound className="absolute right-4 top-4 h-5 w-5 text-white/35" /></div></label>
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-white/55"><label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded" /> تذكرني</label><a href="mailto:Admin@daynightae.com" className="text-brand-sky">نسيت كلمة المرور؟</a></div>
            {captchaEnabled && <TurnstileCaptcha siteKey={captchaSiteKey} language={language} onVerify={(token) => { setCaptchaToken(token); setCaptchaUnavailable(token === TURNSTILE_FALLBACK_TOKEN); }} onExpire={() => { setCaptchaToken(""); setCaptchaUnavailable(false); }} />}
            {captchaUnavailable && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-center text-[11px] font-bold text-amber-200">تعذر تشغيل التحقق الأمني لهذا المتصفح.</p>}
            <button type="submit" disabled={loading || entry} className="w-full rounded-2xl bg-brand-gold px-5 py-4 text-base font-black text-brand-deep shadow-lg shadow-brand-gold/20 hover:bg-white disabled:opacity-55"><Lock className="ml-2 inline h-5 w-5" />{loading ? "جاري التحقق..." : "تسجيل الدخول"}</button>
            <p className="text-center text-[11px] font-bold text-white/42"><ShieldCheck className="ml-1 inline h-4 w-4 text-brand-gold" /> دخول آمن ومشفر للحسابات الإدارية فقط</p>
          </form>
        </section>
        <section className="hidden min-h-[560px] items-center justify-center lg:flex"><div className="relative flex items-center gap-8"><div className="scale-[1.15]"><CartoonMascot /></div><div className="rounded-[2rem] border border-brand-sky/60 bg-black/20 px-8 py-6 text-3xl font-black text-white shadow-[0_0_40px_rgba(24,168,232,0.35)]">هلا أبو خليفة يا قيادة</div></div></section>
      </div>
    </div>
  );
}
