import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import {
  CheckCircle,
  KeyRound,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import TurnstileCaptcha, { TURNSTILE_FALLBACK_TOKEN } from "./security/TurnstileCaptcha";
import { useAppContext } from "../lib/AppContext";
import CustomerDashboard from "./customer/CustomerDashboard";
import companyMeta from "../data/companyMeta";
import AdminMascotWelcome from "./admin/AdminMascotWelcome";
import khalifaAssets from "./admin/khalifaAssets";
import "../styles/dn-khalifa-final.css";
import "../styles/dn-auth-gateway-phase1.css";

interface AuthProps {
  onAuthSuccess: () => void;
}

function LoginEntry({ isArabic }: { isArabic: boolean }) {
  return <AdminMascotWelcome isArabic={isArabic} />;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
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

  const ui = isArabic
    ? {
        title: "بوابة الإدارة",
        subtitle: "دخول آمن إلى مركز قيادة DAY NIGHT",
        eyebrow: "DAY NIGHT COMMAND GATEWAY",
        email: "البريد الإلكتروني أو اسم المستخدم",
        password: "كلمة المرور",
        remember: "تذكرني",
        forgot: "نسيت كلمة المرور؟",
        submit: "تسجيل الدخول",
        loading: "جاري التحقق...",
        secure: "دخول آمن ومشفر للحسابات الإدارية فقط",
        captchaRequired: "يرجى إكمال التحقق الأمني أولاً.",
        loginUnavailable: "خدمة الدخول غير متاحة حالياً.",
        invalid: "بيانات الدخول غير صحيحة أو غير مخولة.",
        adminOnly: "هذه البوابة مخصصة للإدارة فقط.",
        success: "تم التحقق. جاري تجهيز مركز القيادة...",
        genericError: "حدث خطأ أثناء تسجيل الدخول.",
        captchaIssue: "تعذر تشغيل التحقق الأمني لهذا المتصفح.",
        imageLabel: "خليفة",
        language: "English",
        mascotTitle: "خليفة جاهز لخدمتك",
        mascotText: "مساعد الإدارة الذكي يجهّز لك لوحة التحكم والطلبات والتحصيل لحظة الدخول.",
        stat1: "تشغيل 24/7",
        stat2: "إدارة الطلبات",
        stat3: "أمان إداري",
        checkpoint1: "التحقق من هوية المدير",
        checkpoint2: "تحميل بيانات التشغيل",
        checkpoint3: "فتح مركز القيادة",
      }
    : {
        title: "Admin Portal",
        subtitle: "Secure access to the DAY NIGHT command center",
        eyebrow: "DAY NIGHT COMMAND GATEWAY",
        email: "Email or username",
        password: "Password",
        remember: "Remember me",
        forgot: "Forgot password?",
        submit: "Sign in",
        loading: "Checking...",
        secure: "Secure encrypted access for admin accounts only",
        captchaRequired: "Please complete the security check first.",
        loginUnavailable: "Login service is currently unavailable.",
        invalid: "Invalid or unauthorized login details.",
        adminOnly: "This portal is for administrators only.",
        success: "Verified. Preparing the command center...",
        genericError: "An error occurred during login.",
        captchaIssue: "Security check could not run in this browser.",
        imageLabel: "Khalifa",
        language: "العربية",
        mascotTitle: "Khalifa is ready",
        mascotText: "Your smart admin assistant prepares operations, orders, and collections as you sign in.",
        stat1: "24/7 Operations",
        stat2: "Order Control",
        stat3: "Admin Security",
        checkpoint1: "Verifying admin identity",
        checkpoint2: "Loading operation data",
        checkpoint3: "Opening command center",
      };

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
      setErrorMsg(ui.captchaRequired);
      return;
    }

    if (!supabase) {
      setErrorMsg(ui.loginUnavailable);
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
        setErrorMsg(ui.invalid);
        setLoading(false);
        return;
      }

      const user = data?.user;
      if (!user || !(await isAdminUser(user.id))) {
        await supabase.auth.signOut();
        setErrorMsg(ui.adminOnly);
        setLoading(false);
        return;
      }

      setSuccessMsg(ui.success);
      setEntry(true);
      window.setTimeout(onAuthSuccess, 2400);
    } catch {
      setErrorMsg(ui.genericError);
      setLoading(false);
    }
  }

  return (
    <div className="dn-auth-page-final dn-auth-gateway-phase1" dir={isArabic ? "rtl" : "ltr"}>
      {entry && <LoginEntry isArabic={isArabic} />}

      <button type="button" className="dn-auth-lang-switch" onClick={toggleLanguage}>
        {ui.language}
      </button>

      <main className="dn-auth-frame-final dn-auth-gateway-shell">
        <section className="dn-auth-khalifa-final dn-auth-showcase-card" aria-label={ui.imageLabel}>
          <div className="dn-auth-showcase-glow" />
          <div className="dn-auth-khalifa-frame-final dn-auth-khalifa-glass-frame">
            <img src={khalifaAssets.staticMascot} alt={ui.imageLabel} />
          </div>
          <div className="dn-auth-showcase-copy">
            <span><Sparkles className="h-4 w-4" /> {ui.eyebrow}</span>
            <h2>{ui.mascotTitle}</h2>
            <p>{ui.mascotText}</p>
          </div>
          <div className="dn-auth-showcase-stats">
            <strong>{ui.stat1}</strong>
            <strong>{ui.stat2}</strong>
            <strong>{ui.stat3}</strong>
          </div>
        </section>

        <section className="dn-auth-card-final dn-auth-login-glass" aria-label={ui.title}>
          <div className="dn-auth-logo-final dn-auth-premium-logo">
            <img
              src={companyMeta.logoUrl}
              onError={(event) => { event.currentTarget.src = companyMeta.logoRemoteUrl; }}
              alt="DAY NIGHT DELIVERY SERVICES"
            />
          </div>

          <div className="dn-auth-heading-final dn-auth-heading-premium">
            <span>{ui.eyebrow}</span>
            <h1>{ui.title}</h1>
            <p>{ui.subtitle}</p>
          </div>

          <div className="dn-auth-checkpoints">
            <span><ShieldCheck className="h-4 w-4" />{ui.checkpoint1}</span>
            <span><UserCog className="h-4 w-4" />{ui.checkpoint2}</span>
            <span><Lock className="h-4 w-4" />{ui.checkpoint3}</span>
          </div>

          {errorMsg && (
            <div className="dn-auth-alert-final is-error">
              <ShieldAlert className="ml-2 inline h-4 w-4" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="dn-auth-alert-final is-success">
              <CheckCircle className="ml-2 inline h-4 w-4" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="dn-auth-form-final dn-auth-form-premium">
            <label className="dn-auth-field-final">
              <span>{ui.email}</span>
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Admin@daynightae.com"
                  dir="ltr"
                />
                <Mail />
              </div>
            </label>

            <label className="dn-auth-field-final">
              <span>{ui.password}</span>
              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••"
                  dir="ltr"
                />
                <KeyRound />
              </div>
            </label>

            <div className="dn-auth-options-final">
              <label><input type="checkbox" /> {ui.remember}</label>
              <a href={`mailto:${companyMeta.email}`}>{ui.forgot}</a>
            </div>

            {captchaEnabled && (
              <div className="dn-auth-captcha-final">
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
              </div>
            )}

            {captchaUnavailable && (
              <p className="dn-auth-captcha-note-final">{ui.captchaIssue}</p>
            )}

            <button type="submit" disabled={loading || entry} className="dn-auth-submit-final dn-auth-submit-premium">
              <Lock className="ml-2 inline h-5 w-5" />
              {loading ? ui.loading : ui.submit}
            </button>

            <p className="dn-auth-secure-final">
              <ShieldCheck className="ml-1 inline h-4 w-4" />
              {ui.secure}
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
