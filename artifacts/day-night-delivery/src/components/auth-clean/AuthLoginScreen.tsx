import type { FormEvent } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import type { AuthLanguage } from "./AuthIntroScreen";

interface AuthLoginScreenProps {
  email: string;
  password: string;
  rememberMe: boolean;
  errorMessage: string;
  isSubmitting: boolean;
  passkeyEnabled?: boolean;
  passkeyBusy?: boolean;
  language: AuthLanguage;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSubmit: () => void;
  onPasskeySignIn?: () => void;
  onForgotPassword: () => void;
  onToggleLanguage: () => void;
  onBackToSite: () => void;
}

const text = {
  ar: {
    toggle: "English",
    back: "العودة للموقع",
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "تسجيل الدخول",
    sub: "أدخل بيانات الإدارة للمتابعة إلى لوحة التشغيل.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    remember: "تذكرني",
    forgot: "نسيت كلمة المرور؟",
    submit: "دخول",
    wait: "جاري التحقق...",
    passkey: "الدخول باستخدام Passkey أو بصمة الجهاز",
    passkeyWait: "جاري فتح حماية الجهاز...",
    divider: "أو",
  },
  en: {
    toggle: "العربية",
    back: "Back to website",
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "Admin Sign In",
    sub: "Enter admin credentials to continue to operations.",
    email: "Email",
    password: "Password",
    remember: "Remember me",
    forgot: "Forgot password?",
    submit: "Sign in",
    wait: "Checking...",
    passkey: "Sign in with passkey or device biometrics",
    passkeyWait: "Opening device protection...",
    divider: "or",
  },
} as const;

export default function AuthLoginScreen(props: AuthLoginScreenProps) {
  const isArabic = props.language === "ar";
  const t = text[props.language];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onSubmit();
  }

  return (
    <section className="auth-clean auth-clean--login" dir={isArabic ? "rtl" : "ltr"}>
      <div className="auth-clean__top-actions">
        <button type="button" className="auth-clean__home" onClick={props.onBackToSite}>{t.back}</button>
        <button type="button" className="auth-clean__language" onClick={props.onToggleLanguage}>{t.toggle}</button>
      </div>
      <main className="auth-clean__card" aria-labelledby="auth-clean-title">
        <p className="auth-clean__eyebrow">{t.eyebrow}</p>
        <h1 className="auth-clean__card-title" id="auth-clean-title">{t.title}</h1>
        <p className="auth-clean__card-subtitle">{t.sub}</p>
        <form className="auth-clean__form" onSubmit={submit} autoComplete="off" noValidate>
          <label className="auth-clean__label" htmlFor="dn-admin-email">{t.email}</label>
          <input id="dn-admin-email" name="dn-admin-email" className="auth-clean__input" type="email" value={props.email} onChange={(event) => props.onEmailChange(event.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} dir="ltr" />
          <label className="auth-clean__label" htmlFor="dn-admin-password">{t.password}</label>
          <input id="dn-admin-password" name="dn-admin-password" className="auth-clean__input" type="password" value={props.password} onChange={(event) => props.onPasswordChange(event.target.value)} autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} dir="ltr" />
          <div className="auth-clean__options">
            <label className="auth-clean__remember"><input type="checkbox" checked={props.rememberMe} onChange={(event) => props.onRememberChange(event.target.checked)} />{t.remember}</label>
            <button type="button" className="auth-clean__link" onClick={props.onForgotPassword}>{t.forgot}</button>
          </div>
          {props.errorMessage ? <p className="auth-clean__error" role="alert">{props.errorMessage}</p> : null}
          <button type="submit" className="auth-clean__submit" disabled={props.isSubmitting || props.passkeyBusy}>{props.isSubmitting ? t.wait : t.submit}</button>
          {props.passkeyEnabled && props.onPasskeySignIn ? (
            <>
              <div className="auth-clean__passkey-divider"><span>{t.divider}</span></div>
              <button type="button" className="auth-clean__passkey" onClick={props.onPasskeySignIn} disabled={props.isSubmitting || props.passkeyBusy}>
                {props.passkeyBusy ? <Loader2 className="animate-spin" /> : <Fingerprint />}
                {props.passkeyBusy ? t.passkeyWait : t.passkey}
              </button>
            </>
          ) : null}
        </form>
      </main>
      <style>{`
        .auth-clean__passkey-divider{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.62);font-size:11px;font-weight:900}.auth-clean__passkey-divider:before,.auth-clean__passkey-divider:after{content:"";flex:1;height:1px;background:rgba(255,255,255,.16)}.auth-clean__passkey{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;border:1px solid rgba(244,194,79,.62);border-radius:14px;background:rgba(7,26,51,.86);color:#ffe8a3;font:inherit;font-size:.9rem;font-weight:950;cursor:pointer}.auth-clean__passkey:disabled{cursor:wait;opacity:.65}.auth-clean__passkey svg{width:19px;height:19px}
      `}</style>
    </section>
  );
}
