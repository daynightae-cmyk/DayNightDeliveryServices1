import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import {
  ArrowRight,
  CheckCircle,
  Eye,
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
import "../styles/dn-khalifa-final.css";
import "../styles/dn-auth-gateway-phase1.css";
import "../styles/dn-premium-auth-assets.css";

interface AuthProps {
  onAuthSuccess: () => void;
}

const premiumAssets = {
  introHero: "/assets/daynight/premium-auth/dn-auth-intro-hero.png",
  loginReference: "/assets/daynight/premium-auth/dn-auth-login-reference.png",
  loadingBridge: "/assets/daynight/premium-auth/dn-auth-loading-bridge.png",
  khalifaAssistant: "/assets/daynight/premium-auth/dn-khalifa-assistant-card.png",
  khalifaRobot: "/assets/daynight/premium-auth/dn-khalifa-robot.png",
  logo: "/assets/daynight/premium-auth/dn-logo-premium-glass.png",
  dashboardReference: "/assets/daynight/premium-auth/dn-admin-dashboard-reference.png",
  liveMap: "/assets/daynight/premium-auth/dn-admin-live-map.png",
};

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
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem("dnAuthIntroSeen") !== "yes";
  });
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);

  const captchaSiteKey = String(((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || "")).trim();
  const captchaEnabled = Boolean(captchaSiteKey);
  const usableCaptchaToken = captchaToken && captchaToken !== TURNSTILE_FALLBACK_TOKEN ? captchaToken : "";

  const ui = isArabic
    ? {
        lang: "English",
        introBadge: "Ù…Ø±Ø­Ø¨Ù‹Ø§ Ø¨Ùƒ ÙÙŠ",
        introTitle: "Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©",
        introText: "ØªØ¬Ø±Ø¨Ø© Ø¯Ø®ÙˆÙ„ ÙØ§Ø®Ø±Ø© Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª ÙˆØ§Ù„ØªØ¬Ø§Ø± ÙˆØ§Ù„ØªØ­ØµÙŠÙ„ Ø¨ÙƒÙ„ Ø³Ø±Ø¹Ø© ÙˆÙˆØ¶ÙˆØ­.",
        introButton: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø¨ÙˆØ§Ø¨Ø©",
        title: "Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©",
        subtitle: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù„Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…",
        email: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø£Ùˆ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…",
        password: "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
        remember: "ØªØ°ÙƒØ±Ù†ÙŠ",
        forgot: "Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±ØŸ",
        submit: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
        loading: "Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù‚Ù‚...",
        secure: "Ø¯Ø®ÙˆÙ„ Ø¢Ù…Ù† ÙˆÙ…Ø´ÙØ± Ù„Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø¥Ø¯Ø§Ø±ÙŠØ© ÙÙ‚Ø·",
        captchaRequired: "ÙŠØ±Ø¬Ù‰ Ø¥ÙƒÙ…Ø§Ù„ Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ø£Ù…Ù†ÙŠ Ø£ÙˆÙ„Ø§Ù‹.",
        loginUnavailable: "Ø®Ø¯Ù…Ø© Ø§Ù„Ø¯Ø®ÙˆÙ„ ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.",
        invalid: "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¯Ø®ÙˆÙ„ ØºÙŠØ± ØµØ­ÙŠØ­Ø© Ø£Ùˆ ØºÙŠØ± Ù…Ø®ÙˆÙ„Ø©.",
        adminOnly: "Ù‡Ø°Ù‡ Ø§Ù„Ø¨ÙˆØ§Ø¨Ø© Ù…Ø®ØµØµØ© Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© ÙÙ‚Ø·.",
        success: "ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚. Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ù…Ø±ÙƒØ² Ø§Ù„Ù‚ÙŠØ§Ø¯Ø©...",
        genericError: "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„.",
        captchaIssue: "ØªØ¹Ø°Ø± ØªØ´ØºÙŠÙ„ Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ø£Ù…Ù†ÙŠ Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…ØªØµÙØ­.",
        feature1: "Ø¢Ù…Ù† ÙˆÙ…ÙˆØ«ÙˆÙ‚",
        feature2: "Ø³Ø±ÙŠØ¹ ÙˆÙØ¹Ø§Ù„",
        feature3: "ØªØªØ¨Ø¹ Ù„Ø­Ø¸ÙŠ",
        feature4: "Ø¯Ø¹Ù… 24/7",
        sideTitle: "Ø®Ù„ÙŠÙØ© Ø¬Ø§Ù‡Ø² Ù„Ø®Ø¯Ù…ØªÙƒ",
        sideText: "Ù…Ø³Ø§Ø¹Ø¯Ùƒ Ø§Ù„Ø°ÙƒÙŠ ÙŠØ¬Ù‡Ù‘Ø² ØªØ¬Ø±Ø¨Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ù‚Ø¨Ù„ Ø¯Ø®ÙˆÙ„Ùƒ Ø¥Ù„Ù‰ Ù…Ø±ÙƒØ² Ø§Ù„Ù‚ÙŠØ§Ø¯Ø©.",
        checkpoint1: "ÙØ­Øµ Ø§Ù„Ø£Ù…Ø§Ù†",
        checkpoint2: "Ø¬Ù„Ø¨ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª",
        checkpoint3: "ØªÙ‡ÙŠØ¦Ø© Ø§Ù„Ù†Ø¸Ø§Ù…",
      }
    : {
        lang: "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©",
        introBadge: "Welcome to",
        introTitle: "Admin Portal",
        introText: "A premium gateway for managing orders, merchants, collections, and operations.",
        introButton: "Enter Admin Portal",
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
        feature1: "Secure",
        feature2: "Fast",
        feature3: "Live tracking",
        feature4: "24/7 support",
        sideTitle: "Khalifa is ready",
        sideText: "Your smart assistant prepares the command center before you enter operations.",
        checkpoint1: "Security check",
        checkpoint2: "Fetching data",
        checkpoint3: "System setup",
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

  function enterLogin() {
    window.sessionStorage.setItem("dnAuthIntroSeen", "yes");
    setShowIntro(false);
  }

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
      window.setTimeout(onAuthSuccess, 2450);
    } catch {
      setErrorMsg(ui.genericError);
      setLoading(false);
    }
  }

  if (showIntro) {
    return (
      <div className="dn-premium-intro-page" dir={isArabic ? "rtl" : "ltr"}>
        <button type="button" className="dn-premium-language-switch" onClick={toggleLanguage}>
          {ui.lang}
        </button>

        <div className="dn-premium-intro-bg" aria-hidden="true" />
        <section className="dn-premium-intro-shell">
          <div className="dn-premium-intro-copy">
            <span>{ui.introBadge}</span>
            <h1>{ui.introTitle}</h1>
            <p>{ui.introText}</p>

            <div className="dn-premium-intro-features">
              <strong><ShieldCheck />{ui.feature1}</strong>
              <strong><Sparkles />{ui.feature2}</strong>
              <strong><UserCog />{ui.feature3}</strong>
              <strong><Lock />{ui.feature4}</strong>
            </div>

            <button type="button" onClick={enterLogin} className="dn-premium-intro-button">
              {ui.introButton}
              <ArrowRight />
            </button>
          </div>

          <div className="dn-premium-intro-image-card">
            <img src={premiumAssets.introHero} alt={ui.introTitle} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dn-auth-page-final dn-auth-assets-page" dir={isArabic ? "rtl" : "ltr"}>
      {entry && <LoginEntry isArabic={isArabic} />}

      <button type="button" className="dn-premium-language-switch" onClick={toggleLanguage}>
        {ui.lang}
      </button>

      <main className="dn-auth-assets-shell">
        <section className="dn-auth-assets-visual-card" aria-label="DAY NIGHT Khalifa">
          <img src={premiumAssets.loginReference} alt="DAY NIGHT admin gateway visual" />
          <div className="dn-auth-assets-visual-glow" />
        </section>

        <section className="dn-auth-assets-login-card" aria-label={ui.title}>
          <div className="dn-auth-assets-logo">
            <img src={premiumAssets.logo} alt="DAY NIGHT DELIVERY SERVICES" />
          </div>

          <div className="dn-auth-assets-heading">
            <span>DAY NIGHT COMMAND GATEWAY</span>
            <h1>{ui.title}</h1>
            <p>{ui.subtitle}</p>
          </div>

          <div className="dn-auth-assets-checks">
            <span><ShieldCheck />{ui.checkpoint1}</span>
            <span><UserCog />{ui.checkpoint2}</span>
            <span><CheckCircle />{ui.checkpoint3}</span>
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

          <form onSubmit={handleAdminLogin} className="dn-auth-assets-form">
            <label className="dn-auth-assets-field">
              <span>{ui.email}</span>
              <div>
                <Mail />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Admin@daynightae.com"
                  dir="ltr"
                />
              </div>
            </label>

            <label className="dn-auth-assets-field">
              <span>{ui.password}</span>
              <div>
                <KeyRound />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  dir="ltr"
                />
                <Eye />
              </div>
            </label>

            <div className="dn-auth-assets-options">
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

            <button type="submit" disabled={loading || entry} className="dn-auth-assets-submit">
              <Lock />
              {loading ? ui.loading : ui.submit}
            </button>

            <p className="dn-auth-assets-secure">
              <ShieldCheck />
              {ui.secure}
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}