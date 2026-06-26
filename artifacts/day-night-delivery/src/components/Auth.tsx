import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { Lock, Mail, KeyRound, CheckCircle, ShieldAlert, Smartphone, ShieldCheck } from "lucide-react";
import TurnstileCaptcha from "./security/TurnstileCaptcha";
import { useAppContext } from "../lib/AppContext";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);

  async function verifyCurrentUser() {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;
    const admin = await isAdminUser(user.id);
    if (admin) onAuthSuccess();
  }

  useEffect(() => {
    void verifyCurrentUser();
  }, []);

  function guardHumanCheck() {
    if (captchaEnabled && !captchaToken) {
      setErrorMsg(isArabic ? "يرجى إكمال التحقق الأمني أولاً." : "Please complete the security check first.");
      return false;
    }
    return true;
  }

  async function handleSupabaseLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!guardHumanCheck()) return;
    setLoading(true);

    if (!supabase) {
      setErrorMsg(isArabic ? "خدمة الدخول غير متاحة حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم." : "Secure sign-in is currently unavailable. Please try again later or contact support.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captchaToken ? { captchaToken } : undefined,
      } as any);

      if (error) {
        setErrorMsg(`${isArabic ? "تعذر تسجيل الدخول" : "Sign-in failed"}: ${error.message}`);
      } else if (data?.user) {
        setSuccessMsg(isArabic ? "تم تسجيل الدخول. جاري فتح حسابك الآمن..." : "Signed in. Opening your secure account...");
        const admin = await isAdminUser(data.user.id);
        if (!admin) {
          setErrorMsg(isArabic ? "هذا الحساب غير مخول للوصول إلى هذه البوابة." : "This account is not authorized to access this portal.");
          await supabase.auth.signOut();
          setSuccessMsg("");
          setLoading(false);
          return;
        }
        onAuthSuccess();
      }
    } catch {
      setErrorMsg(isArabic ? "حدث خطأ غير متوقع أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى." : "Unexpected sign-in error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    setErrorMsg("");
    setSuccessMsg("");
    if (!guardHumanCheck()) return;
    if (!supabase) return setErrorMsg(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    } as any);
    setLoading(false);
    if (error) setErrorMsg(error.message);
    else setSuccessMsg(isArabic ? "تم إرسال رابط دخول آمن إلى بريدك الإلكتروني." : "A secure sign-in link was sent to your email.");
  }

  async function handleGoogleLogin() {
    setErrorMsg("");
    setSuccessMsg("");
    if (!supabase) return setErrorMsg(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) setErrorMsg(error.message);
  }

  async function handlePhoneOtp() {
    setErrorMsg("");
    setSuccessMsg("");
    if (!guardHumanCheck()) return;
    if (!supabase) return setErrorMsg(isArabic ? "خدمة الدخول غير متاحة حالياً." : "Secure sign-in is currently unavailable.");
    if (!phone.trim()) return setErrorMsg(isArabic ? "أدخل رقم الهاتف أولاً." : "Enter the phone number first.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
      options: captchaToken ? { captchaToken } : undefined,
    } as any);
    setLoading(false);
    if (error) setErrorMsg(error.message);
    else setSuccessMsg(isArabic ? "تم إرسال رمز الدخول إلى الهاتف المسجل." : "A sign-in code was sent to the registered phone number.");
  }

  return (
    <div className="max-w-5xl mx-auto my-10 grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-6">
      <section className="p-8 bg-brand-deep/80 rounded-3xl border border-white/10 shadow-2xl relative text-right">
        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-brand-gold rounded-2xl flex items-center justify-center border border-white/10 shadow-lg shadow-brand-gold/10">
          <Lock className="w-6 h-6 text-brand-deep" />
        </div>

        <div className="text-center pt-6 pb-2 space-y-2">
          <h2 className="text-2xl font-black text-white">{isArabic ? "بوابة الدخول الآمنة" : "Secure Access Portal"}</h2>
          <p className="text-xs text-white/50 leading-relaxed font-sans">
            {isArabic ? "دخول آمن للحسابات المعتمدة لإدارة الطلبات ومتابعة الشحنات وخدمات داي نايت الرقمية." : "Secure access for approved accounts to manage orders, track shipments, and use DAY NIGHT digital services."}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl flex items-start gap-2 mt-4 text-right">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-bold">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl flex items-start gap-2 mt-4 text-right">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-bold">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleSupabaseLogin} className="space-y-4 text-right mt-6">
          <div className="space-y-1.5 pt-2">
            <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "البريد الإلكتروني" : "Email address"}</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isArabic ? "أدخل بريدك المسجل" : "Enter your registered email"}
                className="w-full bg-brand-cool/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-cool transition-all placeholder:text-white/20 text-right font-sans"
                dir="ltr"
              />
              <Mail className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-white/80 text-xs font-bold font-sans">{isArabic ? "كلمة المرور" : "Password"}</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-brand-cool/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold focus:bg-brand-cool transition-all placeholder:text-white/20 text-left font-sans tracking-widest"
                dir="ltr"
              />
              <KeyRound className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
            </div>
          </div>

          {captchaEnabled && (
            <TurnstileCaptcha
              siteKey={captchaSiteKey}
              language={language}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken("")}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-gold hover:bg-white text-brand-deep font-black rounded-xl text-sm transition-all disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
          >
            {loading ? (isArabic ? "جاري التحقق..." : "Verifying...") : (isArabic ? "تسجيل الدخول" : "Sign in")}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
          <button onClick={handleMagicLink} disabled={loading} className="py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-colors">
            {isArabic ? "رابط دخول عبر البريد" : "Email sign-in link"}
          </button>
          <button onClick={handleGoogleLogin} disabled={loading} className="py-3 rounded-xl border border-brand-gold/25 bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold text-xs font-bold transition-colors">
            {isArabic ? "الدخول عبر Google" : "Continue with Google"}
          </button>
        </div>
      </section>

      <aside className="p-6 rounded-3xl border border-white/10 bg-brand-cool/35 space-y-4 text-right">
        <div className="flex items-center justify-end gap-2 text-brand-gold font-black">
          <ShieldCheck className="w-5 h-5" />
          <span>{isArabic ? "خيارات دخول موثوقة" : "Trusted access options"}</span>
        </div>
        <p className="text-white/60 text-sm leading-relaxed">
          {isArabic ? "استخدم البريد المسجل أو رابط الدخول الآمن. ولحسابات الهاتف المعتمدة يمكن طلب رمز تحقق مباشر." : "Use your registered email or a secure sign-in link. Approved phone accounts can request a verification code."}
        </p>
        <div className="space-y-2">
          <label className="text-white/70 text-xs font-bold">{isArabic ? "الدخول برمز الهاتف" : "Phone verification"}</label>
          <div className="relative">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 56 875 7331" dir="ltr" className="w-full bg-brand-deep/70 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-brand-gold" />
            <Smartphone className="absolute right-3 top-3.5 w-5 h-5 text-white/30" />
          </div>
          <button onClick={handlePhoneOtp} disabled={loading} className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-colors">
            {isArabic ? "إرسال رمز التحقق" : "Send verification code"}
          </button>
        </div>
      </aside>
    </div>
  );
}
