import React from "react";

export type AuthLanguage = "ar" | "en";
export interface AuthIntroScreenProps { language: AuthLanguage; onEnter: () => void; onToggleLanguage: () => void; }

const text = {
  ar: { toggle: "English", hello: "مرحباً بك في", title: "بوابة الإدارة", sub: "لخدمات توصيل موثوقة وسريعة", body: "نمنحك تجربة إدارة متكاملة للتحكم أكثر سهولة وأداء أفضل لخدماتك", cta: "تسجيل الدخول إلى البوابة" },
  en: { toggle: "العربية", hello: "Welcome to", title: "Admin Portal", sub: "Reliable and fast delivery services", body: "A complete management experience for easier control and better service performance", cta: "Enter Admin Portal" },
} as const;

export default function AuthIntroScreen({ language, onEnter, onToggleLanguage }: AuthIntroScreenProps) {
  const isArabic = language === "ar";
  const t = text[language];
  return (
    <section className="dn-auth-v3 dn-auth-v3--intro" dir={isArabic ? "rtl" : "ltr"}>
      <button type="button" className="dn-auth-v3__language" onClick={onToggleLanguage}>{t.toggle}</button>
      <div className="dn-auth-v3__grid" />
      <div className="dn-auth-v3__intro-layout">
        <div className="dn-auth-v3__intro-copy">
          <span className="dn-auth-v3__pill">{t.hello}</span>
          <h1 className="dn-auth-v3__intro-title">{t.title}</h1>
          <p className="dn-auth-v3__intro-subtitle">{t.sub}</p>
          <p className="dn-auth-v3__intro-description">{t.body}</p>
          <div className="dn-auth-v3__features"><div>دعم 24/7</div><div>تتبع لحظي</div><div>سريع وفعال</div><div>آمن وموثوق</div></div>
          <button type="button" className="dn-auth-v3__primary-cta" onClick={onEnter}>{t.cta}</button>
        </div>
        <div className="dn-auth-v3__visual" aria-hidden="true">
          <img src="/assets/daynight/admin-auth-v3/logo-glass.png" alt="DAY NIGHT" className="dn-auth-v3__hero-logo" draggable="false" />
          <img src="/assets/daynight/admin-auth-v3/khalifa-card-reference.png" alt="Khalifa" className="dn-auth-v3__khalifa" draggable="false" />
        </div>
      </div>
    </section>
  );
}
