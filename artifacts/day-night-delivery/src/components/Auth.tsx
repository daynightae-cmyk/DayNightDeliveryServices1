import { useState } from "react";
import { supabase } from "../supabase";
import { isAdminUser } from "../supabaseAdminOps";
import { useAppContext } from "../lib/AppContext";
import { armAdminLoadingAudio } from "../lib/adminLoadingAudio";
import { adminSignInWithPasskey, SUPABASE_PASSKEYS_ENABLED } from "../lib/supabasePasskeys";
import companyMeta from "../data/companyMeta";

import AuthIntroScreen from "./auth-clean/AuthIntroScreen";
import AuthLoginScreen from "./auth-clean/AuthLoginScreen";
import AuthLoadingScreen from "./auth-clean/AuthLoadingScreen";

import "./auth-clean/auth-clean.css";

interface AuthProps {
  onAuthSuccess: () => void;
}

type AuthStage = "intro" | "login" | "loading";

const copy = {
  ar: {
    invalid: "بيانات الدخول غير صحيحة أو غير مخولة.",
    adminOnly: "هذا الحساب لا يمتلك صلاحية الإدارة.",
    unavailable: "خدمة الدخول غير متاحة حالياً.",
    passkeyUnavailable: "تعذر استخدام Passkey. استخدم كلمة المرور أو تحقق من إعدادات Passkeys في Supabase.",
    generic: "حدث خطأ أثناء تسجيل الدخول.",
  },
  en: {
    invalid: "Invalid or unauthorized login details.",
    adminOnly: "This account does not have administrator access.",
    unavailable: "Login service is currently unavailable.",
    passkeyUnavailable: "Passkey sign-in could not be completed. Use your password or check Supabase passkey settings.",
    generic: "An error occurred during login.",
  },
} as const;

export default function Auth({ onAuthSuccess }: AuthProps) {
  const { language, toggleLanguage } = useAppContext();
  const authLanguage = language === "en" ? "en" : "ar";
  const t = copy[authLanguage];

  const [stage, setStage] = useState<AuthStage>("intro");
  const [email, setEmail] = useState("daynightae@gmail.com");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  function handleBackToSite() {
    window.location.assign("/");
  }

  async function handleSubmit() {
    setErrorMessage("");
    void armAdminLoadingAudio();

    if (!supabase) {
      setErrorMessage(t.unavailable);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage(t.invalid);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });

      if (error || !data?.user) {
        setErrorMessage(t.invalid);
        return;
      }

      const isAdmin = await isAdminUser(data.user.id);

      if (!isAdmin) {
        await supabase.auth.signOut({ scope: "local" });
        setErrorMessage(t.adminOnly);
        return;
      }

      if (rememberMe) window.localStorage.setItem("dn-admin-remember", "true");
      else window.localStorage.removeItem("dn-admin-remember");

      setPassword("");
      setStage("loading");
    } catch {
      setErrorMessage(t.generic);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasskeySignIn() {
    setErrorMessage("");
    setPasskeyBusy(true);
    void armAdminLoadingAudio();
    try {
      const user = await adminSignInWithPasskey();
      if (!user?.id || !(await isAdminUser(user.id))) {
        await supabase?.auth.signOut({ scope: "local" });
        setErrorMessage(t.adminOnly);
        return;
      }
      setPassword("");
      setStage("loading");
    } catch {
      setErrorMessage(t.passkeyUnavailable);
    } finally {
      setPasskeyBusy(false);
    }
  }

  if (stage === "intro") {
    return <AuthIntroScreen language={authLanguage} onEnter={() => setStage("login")} onToggleLanguage={toggleLanguage} onBackToSite={handleBackToSite} />;
  }

  if (stage === "loading") {
    return <AuthLoadingScreen language={authLanguage} percent={100} onComplete={() => window.requestAnimationFrame(() => onAuthSuccess())} />;
  }

  return (
    <AuthLoginScreen
      email={email}
      password={password}
      rememberMe={rememberMe}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      passkeyEnabled={SUPABASE_PASSKEYS_ENABLED}
      passkeyBusy={passkeyBusy}
      language={authLanguage}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onRememberChange={setRememberMe}
      onSubmit={handleSubmit}
      onPasskeySignIn={handlePasskeySignIn}
      onForgotPassword={() => { window.location.href = `mailto:${companyMeta.email}`; }}
      onToggleLanguage={toggleLanguage}
      onBackToSite={handleBackToSite}
    />
  );
}
