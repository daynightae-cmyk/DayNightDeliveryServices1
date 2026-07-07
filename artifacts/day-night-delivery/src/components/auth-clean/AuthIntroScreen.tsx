export type AuthLanguage = "ar" | "en";

interface AuthIntroScreenProps {
  language: AuthLanguage;
  onEnter: () => void;
  onToggleLanguage: () => void;
}

const text = {
  ar: { toggle: "English", eyebrow: "DAY NIGHT DELIVERY SERVICES", title: "بوابة الإدارة", body: "دخول آمن وبسيط لإدارة عمليات التوصيل ومتابعة الطلبات.", cta: "تسجيل الدخول" },
  en: { toggle: "العربية", eyebrow: "DAY NIGHT DELIVERY SERVICES", title: "Admin Portal", body: "A secure, simple entry point for managing deliveries and tracking orders.", cta: "Sign in" },
} as const;

export default function AuthIntroScreen({ language, onEnter, onToggleLanguage }: AuthIntroScreenProps) {
  const isArabic = language === "ar";
  const t = text[language];

  return (
    <section className="auth-clean auth-clean--intro" dir={isArabic ? "rtl" : "ltr"}>
      <button type="button" className="auth-clean__language" onClick={onToggleLanguage}>{t.toggle}</button>
      <main className="auth-clean__panel auth-clean__panel--intro">
        <p className="auth-clean__eyebrow">{t.eyebrow}</p>
        <h1 className="auth-clean__title">{t.title}</h1>
        <p className="auth-clean__body">{t.body}</p>
        <button type="button" className="auth-clean__submit auth-clean__intro-cta" onClick={onEnter}>{t.cta}</button>
      </main>
    </section>
  );
}
