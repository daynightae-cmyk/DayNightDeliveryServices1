import React, { useEffect, useState } from "react";
import { supabase, isAdminUser } from "../supabase";
import { useAppContext } from "../lib/AppContext";
import CustomerDashboard from "./customer/CustomerDashboard";
import companyMeta from "../data/companyMeta";
import "../styles/dn-premium-auth-assets.css";

interface AuthProps { onAuthSuccess: () => void; }

type AuthStage = "intro" | "login" | "loading";

const assets = {
  first: "/assets/daynight/premium-auth/01-auth-first-screen.png?v=approved-20260706-3",
  login: "/assets/daynight/premium-auth/02-auth-login-screen.png?v=approved-20260706-3",
  loading: "/assets/daynight/premium-auth/03-auth-loading-screen.png?v=approved-20260706-3",
  logo: "/assets/daynight/premium-auth/04-logo-glass.png?v=approved-20260706-3",
};

const ar = {
  lang: "English",
  enterPortal: "Ø¯Ø®ÙˆÙ„ Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©",
  email: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø£Ùˆ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…",
  password: "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
  invalid: "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¯Ø®ÙˆÙ„ ØºÙŠØ± ØµØ­ÙŠØ­Ø© Ø£Ùˆ ØºÙŠØ± Ù…Ø®ÙˆÙ„Ø©.",
  adminOnly: "Ù‡Ø°Ù‡ Ø§Ù„Ø¨ÙˆØ§Ø¨Ø© Ù…Ø®ØµØµØ© Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© ÙÙ‚Ø·.",
  unavailable: "Ø®Ø¯Ù…Ø© Ø§Ù„Ø¯Ø®ÙˆÙ„ ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.",
  generic: "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„.",
  visualAlt: "Ø¨ÙˆØ§Ø¨Ø© Ø¥Ø¯Ø§Ø±Ø© DAY NIGHT",
};

const en = {
  lang: "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©",
  enterPortal: "Enter Admin Portal",
  email: "Email or username",
  password: "Password",
  invalid: "Invalid or unauthorized login details.",
  adminOnly: "This portal is for administrators only.",
  unavailable: "Login service is currently unavailable.",
  generic: "An error occurred during login.",
  visualAlt: "DAY NIGHT admin gateway",
};

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const ui = isArabic ? ar : en;
  const isCustomerRoute = typeof window !== "undefined" && window.location.pathname === "/customer";

  const [stage, setStage] = useState<AuthStage>("intro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isCustomerRoute) return;
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user && await isAdminUser(user.id)) {
        setStage("loading");
        window.setTimeout(onAuthSuccess, 900);
      }
    })();
  }, [onAuthSuccess, isCustomerRoute]);

  if (isCustomerRoute) return <CustomerDashboard />;

  async function handleAdminLogin(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg("");

    if (!supabase) {
      setErrorMsg(ui.unavailable);
      return;
    }

    setChecking(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(ui.invalid);
        setChecking(false);
        return;
      }

      const user = data?.user;
      if (!user || !(await isAdminUser(user.id))) {
        await supabase.auth.signOut();
        setErrorMsg(ui.adminOnly);
        setChecking(false);
        return;
      }

      setStage("loading");
      window.setTimeout(onAuthSuccess, 2200);
    } catch {
      setErrorMsg(ui.generic);
      setChecking(false);
    }
  }

  if (stage === "loading") {
    return (
      <div className="dn-approved-auth-root dn-approved-loading" dir={isArabic ? "rtl" : "ltr"}>
        <img className="dn-approved-fullscreen-img" src={assets.loading} alt="Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ù…Ø±ÙƒØ² Ø§Ù„Ù‚ÙŠØ§Ø¯Ø©" />
      </div>
    );
  }

  if (stage === "intro") {
    return (
      <div className="dn-approved-auth-root dn-approved-intro" dir={isArabic ? "rtl" : "ltr"}>
        <img className="dn-approved-fullscreen-img" src={assets.first} alt={ui.visualAlt} />
        <button type="button" className="dn-approved-lang" onClick={toggleLanguage}>{ui.lang}</button>
        <button type="button" className="dn-approved-enter-hotspot" onClick={() => setStage("login")} aria-label={ui.enterPortal} />
      </div>
    );
  }

  return (
    <div className="dn-approved-auth-root dn-approved-login" dir={isArabic ? "rtl" : "ltr"}>
      <img className="dn-approved-fullscreen-img" src={assets.login} alt={ui.visualAlt} />
      <button type="button" className="dn-approved-lang" onClick={toggleLanguage}>{ui.lang}</button>

      <form className="dn-approved-form-hotspots" onSubmit={handleAdminLogin} noValidate>
        <input
          className="dn-approved-input dn-approved-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Admin@daynightae.com"
          dir="ltr"
          autoComplete="username"
          aria-label={ui.email}
        />
        <input
          className="dn-approved-input dn-approved-password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
          dir="ltr"
          autoComplete="current-password"
          aria-label={ui.password}
        />
        <a className="dn-approved-forgot" href={`mailto:${companyMeta.email}`}>{isArabic ? "Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±ØŸ" : "Forgot password?"}</a>
        <button className="dn-approved-submit-hotspot" type="submit" disabled={checking} aria-label={isArabic ? "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„" : "Sign in"}>
          <span>{checking ? (isArabic ? "Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù‚Ù‚..." : "Checking...") : ""}</span>
        </button>
      </form>

      {errorMsg && <div className="dn-approved-error" role="alert">{errorMsg}</div>}
    </div>
  );
}