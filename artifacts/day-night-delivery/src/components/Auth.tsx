import React, { useState } from "react";
import { supabase } from "../supabase";
import { isAdminUser } from "../supabaseAdminOps";
import { useAppContext } from "../lib/AppContext";
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
    adminOnly: "هذه البوابة مخصصة للإدارة فقط.",
    unavailable: "خدمة الدخول غير متاحة حالياً. تأكد من إعدادات Supabase.",
    generic: "حدث خطأ أثناء تسجيل الدخول.",
  },
  en: {
    invalid: "Invalid or unauthorized login details.",
    adminOnly: "This portal is for administrators only.",
    unavailable: "Login service is currently unavailable. Check Supabase config.",
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

  async function handleSubmit() {
    setErrorMessage("");

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
        if (error) console.error("[DAY NIGHT auth signIn error]", { message: error.message, status: error.status, name: error.name, email: cleanEmail });
        setErrorMessage(t.invalid);
        return;
      }

      const isAdmin = await isAdminUser(data.user.id);

      if (!isAdmin) {
        await supabase.auth.signOut();
        setErrorMessage(t.adminOnly);
        return;
      }

      if (rememberMe) window.localStorage.setItem("dn-admin-remember", "true");
      else window.localStorage.removeItem("dn-admin-remember");

      setStage("loading");
      window.setTimeout(() => onAuthSuccess(), 2500);
    } catch (error) {
      console.error("[DAY NIGHT auth signIn error]", error);
      setErrorMessage(t.generic);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (stage === "intro") {
    return <AuthIntroScreen language={authLanguage} onEnter={() => setStage("login")} onToggleLanguage={toggleLanguage} />;
  }

  if (stage === "loading") return <AuthLoadingScreen language={authLanguage} percent={75} />;

  return (
    <AuthLoginScreen
      email={email}
      password={password}
      rememberMe={rememberMe}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      language={authLanguage}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onRememberChange={setRememberMe}
      onSubmit={handleSubmit}
      onForgotPassword={() => { window.location.href = `mailto:${companyMeta.email}`; }}
      onToggleLanguage={toggleLanguage}
    />
  );
}
