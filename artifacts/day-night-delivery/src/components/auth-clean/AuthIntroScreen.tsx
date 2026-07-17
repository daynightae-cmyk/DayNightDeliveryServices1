export type AuthLanguage = "ar" | "en";

interface AuthIntroScreenProps {
  language: AuthLanguage;
  onEnter: () => void;
  onToggleLanguage: () => void;
  onBackToSite: () => void;
}

const text = {
  ar: {
    toggle: "English",
    back: "العودة للموقع",
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "بوابة الإدارة",
    body: "دخول آمن لإدارة الطلبات، التشغيل، التتبع، والتحصيل من مساحة واحدة.",
    cta: "تسجيل الدخول",
  },
  en: {
    toggle: "العربية",
    back: "Back to website",
    eyebrow: "DAY NIGHT DELIVERY SERVICES",
    title: "Admin Portal",
    body: "Secure access for orders, operations, tracking, and collections from one workspace.",
    cta: "Sign in",
  },
} as const;

export default function AuthIntroScreen({ language, onEnter, onToggleLanguage, onBackToSite }: AuthIntroScreenProps) {
  const isArabic = language === "ar";
  const t = text[language];

  return (
    <section className="auth-clean auth-clean--intro" dir={isArabic ? "rtl" : "ltr"}>
      <div className="auth-clean__top-actions">
        <button type="button" className="auth-clean__home" onClick={onBackToSite}>{t.back}</button>
        <button type="button" className="auth-clean__language" onClick={onToggleLanguage}>{t.toggle}</button>
      </div>
      <main className="auth-clean__panel auth-clean__panel--intro">
        <p className="auth-clean__eyebrow">{t.eyebrow}</p>
        <h1 className="auth-clean__title">{t.title}</h1>
        <p className="auth-clean__body">{t.body}</p>
        <button type="button" className="auth-clean__submit auth-clean__intro-cta" onClick={onEnter}>{t.cta}</button>
      </main>
    </section>
  );
}
