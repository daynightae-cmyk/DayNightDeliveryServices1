import { Bell, Globe2, Home, Languages, Moon, Plus, Sun, Truck } from "lucide-react";
import companyMeta from "../../data/companyMeta";
import { internationalTrackingAssets } from "../../data/internationalTrackingAssets";
import type { TrackingLanguage } from "./i18n";
import { trackingCopy } from "./i18n";

type Props = {
  language: TrackingLanguage;
  theme: "dark" | "light";
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onAddTracking: () => void;
};

export default function TrackingTopbar({ language, theme, onToggleLanguage, onToggleTheme, onAddTracking }: Props) {
  const t = trackingCopy(language);
  const isArabic = language === "ar";
  return (
    <header className="dn-it-topbar">
      <a href="/" className="dn-it-brand" aria-label={companyMeta.name}>
        <img
          src={internationalTrackingAssets.masterLogo}
          data-fallback={internationalTrackingAssets.masterLogoFallback}
          onError={(event) => {
            const image = event.currentTarget;
            if (image.src.endsWith(internationalTrackingAssets.masterLogoFallback)) return;
            image.src = internationalTrackingAssets.masterLogoFallback;
          }}
          alt="DAY NIGHT DELIVERY SERVICES"
        />
        <span className="dn-it-brand-copy"><b>DAY NIGHT</b><small>{isArabic ? "داي نايت لخدمات التوصيل والشحن" : "DELIVERY SERVICES"}</small></span>
      </a>
      <div className="dn-it-title-lockup"><Globe2 aria-hidden="true" /><span><strong>{t.title}</strong><small>{t.subtitle}</small></span></div>
      <nav className="dn-it-top-actions" aria-label={isArabic ? "أدوات الصفحة" : "Page actions"}>
        <a href="/tracking" title={t.localTracking}><Truck aria-hidden="true" /><span>{t.localTracking}</span></a>
        <a href="/" title={t.home}><Home aria-hidden="true" /><span>{t.home}</span></a>
        <button type="button" onClick={onToggleLanguage} title={t.language}><Languages aria-hidden="true" /><span>{t.language}</span></button>
        <button type="button" onClick={onToggleTheme} title={t.theme} aria-label={t.theme}>{theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>
        <button type="button" className="dn-it-notification-button" title={isArabic ? "الإشعارات" : "Notifications"} aria-label={isArabic ? "الإشعارات" : "Notifications"}><Bell aria-hidden="true" /><i aria-hidden="true" /></button>
        <button type="button" className="dn-it-add-button" onClick={onAddTracking}><Plus aria-hidden="true" /><span>{t.addTracking}</span></button>
      </nav>
    </header>
  );
}
