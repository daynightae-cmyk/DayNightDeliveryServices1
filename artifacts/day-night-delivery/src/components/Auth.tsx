import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { CheckCircle, KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import TurnstileCaptcha, { TURNSTILE_FALLBACK_TOKEN } from "./security/TurnstileCaptcha";
import { useAppContext } from "../lib/AppContext";
import CustomerDashboard from "./customer/CustomerDashboard";
import companyMeta from "../data/companyMeta";
import AdminMascotWelcome from "./admin/AdminMascotWelcome";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-khalifa-final.css";

interface AuthProps { onAuthSuccess: () => void; }

function LoginEntry() {
  return <AdminMascotWelcome />;
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

  useEffect(() => {
    if (isCustomerRoute) return;
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user && await isAdminUser(user.id)) onAuthSuccess();
    })();
  }, [onAuthSuccess, isCustomerRoute]);

  if (isCustomerRoute) return <CustomerDashboard />;

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (captchaEnabled && !usableCaptchaToken) {
      setErrorMsg("يرجى إكمال التحقق الأمني أولاً.");
      return;
    }

    if (!supabase) {
      setErrorMsg("خدمة الدخول غير متاحة حالياً.");
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
        setErrorMsg("بيانات الدخول غير صحيحة أو غير مخولة.");
        setLoading(false);
        return;
      }

      const user = data?.user;
      if (!user || !(await isAdminUser(user.id))) {
        await supabase.auth.signOut();
        setErrorMsg("هذه البوابة مخصصة للإدارة فقط.");
        setLoading(false);
        return;
      }

      setSuccessMsg("تم التحقق. جاري فتح لوحة الإدارة...");
      setEntry(true);
      window.setTimeout(onAuthSuccess, 1900);
    } catch {
      setErrorMsg("حدث خطأ أثناء تسجيل الدخول.");
      setLoading(false);
    }
  }

  return (
    <div className="dn-auth-page" dir="rtl">
      {entry && <LoginEntry />}

      <div className="dn-auth-shell">
        <section className="dn-auth-hero" aria-label="خليفة مساعد الإدارة">
          <div className="dn-auth-hero-bubble">
            <strong>هلا أبو خليفة يا قيادة</strong>
            <span>خليفة جاهز داخل بوابة الإدارة</span>
          </div>
          <img src={khalifaAssets.staticMascot} alt="خليفة" className="dn-auth-hero-image" />
        </section>

        <section className="dn-auth-card" aria-label="تسجيل دخول الإدارة">
          <div className="dn-auth-logo-wrap">
            <img
              src={companyMeta.logoUrl}
              onError={(e) => { e.currentTarget.src = companyMeta.logoRemoteUrl; }}
              alt="DAY NIGHT DELIVERY SERVICES"
            />
          </div>

          <div className="text-center">
            <h1 className="dn-auth-title">بوابة الإدارة</h1>
            <p className="dn-auth-subtitle">تسجيل الدخول للوصول إلى لوحة التحكم</p>
          </div>

          {errorMsg && <div className="dn-auth-alert is-error"><ShieldAlert className="ml-2 inline h-4 w-4" />{errorMsg}</div>}
          {successMsg && <div className="dn-auth-alert is-success"><CheckCircle className="ml-2 inline h-4 w-4" />{successMsg}</div>}

          <form onSubmit={handleAdminLogin} className="dn-auth-form">
            <label className="dn-auth-field">
              <span>البريد الإلكتروني أو اسم المستخدم</span>
              <div className="dn-auth-input-wrap">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin@daynightae.com"
                  dir="ltr"
                />
                <Mail className="dn-auth-input-icon" />
              </div>
            </label>

            <label className="dn-auth-field">
              <span>كلمة المرور</span>
              <div className="dn-auth-input-wrap">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  dir="ltr"
                />
                <KeyRound className="dn-auth-input-icon" />
              </div>
            </label>

            <div className="dn-auth-row">
              <label className="inline-flex items-center gap-2"><input type="checkbox" /> تذكرني</label>
              <a href={`mailto:${companyMeta.email}`}>نسيت كلمة المرور؟</a>
            </div>

            {captchaEnabled && (
              <div className="dn-auth-captcha">
                <TurnstileCaptcha
                  siteKey={captchaSiteKey}
                  language={language}
                  onVerify={(token) => { setCaptchaToken(token); setCaptchaUnavailable(token === TURNSTILE_FALLBACK_TOKEN); }}
                  onExpire={() => { setCaptchaToken(""); setCaptchaUnavailable(false); }}
                />
              </div>
            )}

            {captchaUnavailable && <p className="dn-auth-captcha-note">تعذر تشغيل التحقق الأمني لهذا المتصفح.</p>}

            <button type="submit" disabled={loading || entry} className="dn-auth-submit">
              <Lock className="ml-2 inline h-5 w-5" />
              {loading ? "جاري التحقق..." : "تسجيل الدخول"}
            </button>

            <p className="dn-auth-secure"><ShieldCheck className="ml-1 inline h-4 w-4" /> دخول آمن ومشفر للحسابات الإدارية فقط</p>
          </form>
        </section>
      </div>
    </div>
  );
}
