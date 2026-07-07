import type { AuthLanguage } from "./AuthIntroScreen";

interface AuthLoadingScreenProps {
  language?: AuthLanguage;
  percent?: number;
}

const text = {
  ar: { title: "جاري تجهيز لوحة الإدارة", body: "سيتم تحويلك الآن إلى مركز التحكم." },
  en: { title: "Preparing admin dashboard", body: "You will be redirected to the command center." },
} as const;

export default function AuthLoadingScreen({ language = "ar", percent = 75 }: AuthLoadingScreenProps) {
  const isArabic = language === "ar";
  const safePercent = Math.max(0, Math.min(100, percent));
  const t = text[language];

  return (
    <section className="auth-clean auth-clean--loading" dir={isArabic ? "rtl" : "ltr"}>
      <main className="auth-clean__panel auth-clean__panel--loading">
        <p className="auth-clean__eyebrow">DAY NIGHT DELIVERY SERVICES</p>
        <h1 className="auth-clean__title">{t.title}</h1>
        <p className="auth-clean__body">{t.body}</p>
        <div className="auth-clean__progress" aria-label={`${safePercent}%`}>
          <span style={{ width: `${safePercent}%` }} />
        </div>
      </main>
    </section>
  );
}
