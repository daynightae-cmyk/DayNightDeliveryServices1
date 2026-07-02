import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { CheckCircle, KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import TurnstileCaptcha, { TURNSTILE_FALLBACK_TOKEN } from "./security/TurnstileCaptcha";
import { useAppContext } from "../lib/AppContext";
import CustomerDashboard from "./customer/CustomerDashboard";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const isCustomerRoute = typeof window !== "undefined" && window.location.pathname === "/customer";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);
  const usableCaptchaToken = captchaToken && captchaToken !== TURNSTILE_FALLBACK_TOKEN ? captchaToken : "";

  useEffect(() => {
    if (isCustomerRoute) return;
    async function verifyCurrentAdmin() {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user && await isAdminUser(user.id)) onAuthSuccess();
    }
    void verifyCurrentAdmin();
  }, [onAuthSuccess, isCustomerRoute]);

  if (isCustomerRoute) {
    return <CustomerDashboard />;
  }

  function guardHumanCheck() {
    if (captchaEnabled && !usableCaptchaToken && !captchaUnavailable) {
      setErrorMsg(isArabic ? "يرجى إكمال التحقق الأمني أولاً." : "Please complete the security check first.");
      return false;
    }
    return true;
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!guardHumanCheck()) return;
    if (!supabase) {
      setErrorMsg(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: usableCaptchaToken ? { captchaToken: usableCaptchaToken } : undefined,
      } as any);

      if (error) {
        const message = String(error.message || "").toLowerCase();
        if (message.includes("captcha")) {
          setErrorMsg(isArabic
            ? "Cloudflare Turnstile غير مفعل لهذا الدومين داخل Cloudflare أو Supabase. أضف daynightae.com في Hostname Management ثم أعد المحاولة."
            : "Cloudflare Turnstile is not authorized for this domain in Cloudflare or Supabase. Add daynightae.com in Hostname Management, then retry.");
        } else {
          setErrorMsg(isArabic ? "بيانات الدخول غير صحيحة أو غير مخولة." : "Invalid or unauthorized credentials.");
        }
        setLoading(false);
        return;
      }

      const user = data?.user;
      if (!user || !(await isAdminUser(user.id))) {
        await supabase.auth.signOut();
        setErrorMsg(isArabic ? "هذه البوابة مخصصة للإدارة فقط." : "This portal is restricted to administrators only.");
        setLoading(false);
        return;
      }

      setSuccessMsg(isArabic ? "تم التحقق. جاري فتح لوحة الإدارة..." : "Verified. Opening admin panel...");
      onAuthSuccess();
    } catch {
      setErrorMsg(isArabic ? "حدث خطأ أثناء تسجيل الدخول." : "A sign-in error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto my-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-brand-deep/85 p-8 sm:p-10 shadow-2xl text-right" dir={isArabic ? "rtl" : "ltr"}>
        <div className="absolute -top-20 -left-20 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto -mt-2 mb-6 w-16 h-16 bg-brand-gold rounded-2xl flex items-center justify-center border border-white/10 shadow-lg shadow-brand-gold/10">
            <Lock className="w-7 h-7 text-brand-deep" />
          </div>

          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold">
              <ShieldCheck className="w-4 h-4" /> {isArabic ? "دخول الإدارة فقط" : "Admin access only"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">{isArabic ? "بوابة الإدارة الآمنة" : "Secure Admin Portal"}</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              {isArabic ? "هذه الصفحة مخصصة للحسابات الإدارية المخولة لإدارة الطلبات والتشغيل." : "This page is restricted to authorized administrative accounts for operations management."}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-4 rounded-xl flex items-start gap-2 mt-5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="font-bold">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-4 rounded-xl flex items-start gap-2 mt-5">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="font-bold">{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4 mt-7">
            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-bold">{isArabic ? "بريد الإدارة" : "Admin email"}</label>
              <div className="relative">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin@daynightae.com" className="w-full bg-brand-cool/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold placeholder:text-white/20 text-right" dir="ltr" />
                <Mail className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-white/80 text-xs font-bold">{isArabic ? "كلمة المرور" : "Password"}</label>
              <div className="relative">
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className="w-full bg-brand-cool/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold placeholder:text-white/20 text-left tracking-widest" dir="ltr" />
                <KeyRound className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
              </div>
            </div>
            {captchaEnabled && (
              <TurnstileCaptcha
                siteKey={captchaSiteKey}
                language={language}
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setCaptchaUnavailable(token === TURNSTILE_FALLBACK_TOKEN);
                }}
                onExpire={() => {
                  setCaptchaToken("");
                  setCaptchaUnavailable(false);
                }}
              />
            )}
            {captchaUnavailable && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-center text-[11px] font-bold text-amber-200">
                {isArabic
                  ? "تنبيه تشغيل: Turnstile لم يعتمد هذا الدومين بعد. يمكنك محاولة الدخول الآن، وإذا رفض Supabase الطلب أضف daynightae.com داخل Cloudflare Hostname Management."
                  : "Operations notice: Turnstile has not authorized this hostname yet. You may try signing in now; if Supabase rejects it, add daynightae.com in Cloudflare Hostname Management."}
              </p>
            )}
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-brand-gold hover:bg-white text-brand-deep font-black rounded-xl text-sm transition-all disabled:opacity-50">
              {loading ? (isArabic ? "جاري التحقق..." : "Verifying...") : (isArabic ? "دخول لوحة الإدارة" : "Open Admin Panel")}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
