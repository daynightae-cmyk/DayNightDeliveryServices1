import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { CheckCircle, Eye, KeyRound, Lock, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import TurnstileCaptcha, { TURNSTILE_FALLBACK_TOKEN } from "./security/TurnstileCaptcha";
import { useAppContext } from "../lib/AppContext";
import CustomerDashboard from "./customer/CustomerDashboard";
import companyMeta from "../data/companyMeta";
import AdminMascotWelcome from "./admin/AdminMascotWelcome";
import "../styles/dn-premium-auth-assets.css";

interface AuthProps { onAuthSuccess: () => void; }

const assets = {
  first: "/assets/daynight/premium-auth/01-auth-first-screen.png",
  login: "/assets/daynight/premium-auth/02-auth-login-screen.png",
  loading: "/assets/daynight/premium-auth/03-auth-loading-screen.png",
  logo: "/assets/daynight/premium-auth/04-logo-glass.png",
};

const ar = {
  lang: "English",
  enterPortal: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0628\u0648\u0627\u0628\u0629",
  title: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
  subtitle: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645",
  email: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645",
  password: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
  remember: "\u062A\u0630\u0643\u0631\u0646\u064A",
  forgot: "\u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061F",
  submit: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
  loading: "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642...",
  secure: "\u062F\u062E\u0648\u0644 \u0622\u0645\u0646 \u0648\u0645\u0634\u0641\u0631 \u0644\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0641\u0642\u0637",
  captchaRequired: "\u064A\u0631\u062C\u0649 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0623\u0645\u0646\u064A \u0623\u0648\u0644\u0627\u064B.",
  loginUnavailable: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.",
  invalid: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u062E\u0648\u0644\u0629.",
  adminOnly: "\u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0645\u062E\u0635\u0635\u0629 \u0644\u0644\u0625\u062F\u0627\u0631\u0629 \u0641\u0642\u0637.",
  success: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642. \u062C\u0627\u0631\u064A \u062A\u062C\u0647\u064A\u0632 \u0645\u0631\u0643\u0632 \u0627\u0644\u0642\u064A\u0627\u062F\u0629...",
  genericError: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.",
  captchaIssue: "\u062A\u0639\u0630\u0631 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0623\u0645\u0646\u064A \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u0635\u0641\u062D.",
};

const en = {
  lang: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
  enterPortal: "Enter Admin Portal",
  title: "Admin Portal",
  subtitle: "Sign in to access the control dashboard",
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
  success: "Verified. Preparing command center...",
  genericError: "An error occurred during login.",
  captchaIssue: "Security check could not run in this browser.",
};

function LoginEntry({ isArabic }: { isArabic: boolean }) {
  return <AdminMascotWelcome isArabic={isArabic} />;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const ui = isArabic ? ar : en;
  const isCustomerRoute = typeof window !== "undefined" && window.location.pathname === "/customer";

  const [stage, setStage] = useState<"intro" | "login">("intro");
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

  async function handleAdminLogin(event: React.FormEvent) {
    event.preventDefault();
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
      window.setTimeout(onAuthSuccess, 2450);
    } catch {
      setErrorMsg(ui.genericError);
      setLoading(false);
    }
  }

  if (stage === "intro") {
    return (
      <div className="dn-clean-auth-root dn-clean-auth-intro" dir={isArabic ? "rtl" : "ltr"}>
        <button type="button" className="dn-clean-auth-lang" onClick={toggleLanguage}>{ui.lang}</button>
        <img className="dn-clean-auth-full-image" src={assets.first} alt={ui.title} />
        <button type="button" className="dn-clean-auth-enter" onClick={() => setStage("login")}>{ui.enterPortal}</button>
      </div>
    );
  }

  return (
    <div className="dn-clean-auth-root dn-clean-auth-login" dir={isArabic ? "rtl" : "ltr"}>
      {entry && <LoginEntry isArabic={isArabic} />}
      <button type="button" className="dn-clean-auth-lang" onClick={toggleLanguage}>{ui.lang}</button>
      <img className="dn-clean-auth-bg-image" src={assets.login} alt={ui.title} />
      <main className="dn-clean-auth-shell">
        <section className="dn-clean-auth-form-card" aria-label={ui.title}>
          <div className="dn-clean-auth-logo"><img src={assets.logo} alt="DAY NIGHT DELIVERY SERVICES" /></div>
          <header className="dn-clean-auth-heading"><span>DAY NIGHT COMMAND GATEWAY</span><h1>{ui.title}</h1><p>{ui.subtitle}</p></header>

          {errorMsg && <div className="dn-clean-auth-alert is-error"><ShieldAlert />{errorMsg}</div>}
          {successMsg && <div className="dn-clean-auth-alert is-success"><CheckCircle />{successMsg}</div>}

          <form onSubmit={handleAdminLogin} className="dn-clean-auth-form">
            <label className="dn-clean-auth-field"><span>{ui.email}</span><div><Mail /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin@daynightae.com" dir="ltr" /></div></label>
            <label className="dn-clean-auth-field"><span>{ui.password}</span><div><KeyRound /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" dir="ltr" /><Eye /></div></label>
            <div className="dn-clean-auth-options"><label><input type="checkbox" /> {ui.remember}</label><a href={`mailto:${companyMeta.email}`}>{ui.forgot}</a></div>

            {captchaEnabled && <div className="dn-clean-auth-captcha"><TurnstileCaptcha siteKey={captchaSiteKey} language={language} onVerify={(token) => { setCaptchaToken(token); setCaptchaUnavailable(token === TURNSTILE_FALLBACK_TOKEN); }} onExpire={() => { setCaptchaToken(""); setCaptchaUnavailable(false); }} /></div>}
            {captchaUnavailable && <p className="dn-clean-auth-captcha-note">{ui.captchaIssue}</p>}

            <button type="submit" disabled={loading || entry} className="dn-clean-auth-submit"><Lock />{loading ? ui.loading : ui.submit}</button>
            <p className="dn-clean-auth-secure"><ShieldCheck />{ui.secure}</p>
          </form>
        </section>
      </main>
    </div>
  );
}