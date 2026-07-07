import type { FormEvent } from "react";
import type { AuthLanguage } from "./AuthIntroScreen";

interface AuthLoginScreenProps {
  email: string;
  password: string;
  rememberMe: boolean;
  errorMessage: string;
  isSubmitting: boolean;
  language: AuthLanguage;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
  onToggleLanguage: () => void;
}

const text = {
  ar: { toggle: "English", eyebrow: "DAY NIGHT DELIVERY SERVICES", title: "تسجيل الدخول", sub: "أدخل بيانات الإدارة للمتابعة", email: "البريد الإلكتروني", password: "كلمة المرور", remember: "تذكرني", forgot: "نسيت كلمة المرور؟", submit: "دخول", wait: "جاري التحقق..." },
  en: { toggle: "العربية", eyebrow: "DAY NIGHT DELIVERY SERVICES", title: "Admin Sign In", sub: "Enter admin credentials to continue", email: "Email", password: "Password", remember: "Remember me", forgot: "Forgot password?", submit: "Sign in", wait: "Checking..." },
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
      <button type="button" className="auth-clean__language" onClick={props.onToggleLanguage}>{t.toggle}</button>
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
          <button type="submit" className="auth-clean__submit" disabled={props.isSubmitting}>{props.isSubmitting ? t.wait : t.submit}</button>
        </form>
      </main>
    </section>
  );
}
