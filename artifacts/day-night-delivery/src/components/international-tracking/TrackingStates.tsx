import { AlertTriangle, Globe2, Headphones, RefreshCw, ShieldCheck } from "lucide-react";
import companyMeta from "../../data/companyMeta";
import { internationalTrackingAssets } from "../../lib/internationalTrackingAssets";
import type { TrackingLanguage } from "./i18n";
import { trackingCopy } from "./i18n";

export function InitialTrackingState({ language }: { language: TrackingLanguage }) {
  const t = trackingCopy(language);
  return (
    <section className="dn-it-initial-state">
      <div className="dn-it-initial-copy"><span className="dn-it-eyebrow"><Globe2 />{t.initialEyebrow}</span><h1>{t.initialTitle}</h1><p>{t.initialBody}</p><div className="dn-it-trust-strip"><span><ShieldCheck />{t.secure}</span><span><RefreshCw />{t.autoRefresh}</span><span><Globe2 />{t.carrierUpdates}</span></div></div>
      <div className="dn-it-initial-visual" aria-hidden="true"><div className="dn-it-global-orbit" /><img src={internationalTrackingAssets.aircraft.threeQuarterFront} alt="" /><span className="dn-it-initial-route" /><i className="dn-it-hub dn-it-hub-a" /><i className="dn-it-hub dn-it-hub-b" /><i className="dn-it-hub dn-it-hub-c" /></div>
    </section>
  );
}

export function TrackingLoadingState({ language }: { language: TrackingLanguage }) {
  const t = trackingCopy(language);
  return <section className="dn-it-loading-state" role="status" aria-live="polite"><div className="dn-it-loading-map"><div className="dn-it-route-shimmer" /></div><div className="dn-it-loading-grid"><span /><span /><span /><span /></div><div className="dn-it-loading-caption"><RefreshCw />{t.searching}</div></section>;
}

export function TrackingErrorState({ language, message, onRetry }: { language: TrackingLanguage; message: string; onRetry: () => void }) {
  const t = trackingCopy(language);
  return <section className="dn-it-error-state" role="alert"><span className="dn-it-error-icon"><AlertTriangle /></span><h2>{t.unavailable}</h2><p>{message}</p><div className="dn-it-error-actions"><button type="button" onClick={onRetry}><RefreshCw />{t.retry}</button><a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer"><Headphones />{t.support}</a></div></section>;
}
