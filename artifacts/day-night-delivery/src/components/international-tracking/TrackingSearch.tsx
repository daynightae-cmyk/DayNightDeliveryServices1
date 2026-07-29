import { QrCode, Search, X } from "lucide-react";
import type { TrackingLanguage } from "./i18n";
import { trackingCopy } from "./i18n";

type Props = {
  language: TrackingLanguage;
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onScan: () => void;
  compact?: boolean;
};

export default function TrackingSearch({ language, value, loading, onChange, onSubmit, onScan, compact = false }: Props) {
  const t = trackingCopy(language);
  return (
    <form className={`dn-it-search ${compact ? "is-compact" : ""}`} onSubmit={(event) => { event.preventDefault(); onSubmit(); }} role="search">
      <label htmlFor="dn-international-tracking-input"><Search aria-hidden="true" /><span><strong>{t.searchLabel}</strong><small>DAY NIGHT / ORDER / ARAMEX AWB</small></span></label>
      <div className="dn-it-search-field">
        <Search aria-hidden="true" />
        <input id="dn-international-tracking-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t.searchPlaceholder} dir="ltr" inputMode="text" autoComplete="off" spellCheck={false} aria-label={t.searchLabel} />
        {value && <button type="button" className="dn-it-clear-query" onClick={() => onChange("")} aria-label={language === "ar" ? "مسح الرقم" : "Clear reference"}><X /></button>}
      </div>
      <button type="button" className="dn-it-qr-button" onClick={onScan} title={t.scanQr} aria-label={t.scanQr}><QrCode /></button>
      <button type="submit" className="dn-it-track-button" disabled={loading || !value.trim()}>{loading ? <span className="dn-it-button-spinner" aria-hidden="true" /> : <Search aria-hidden="true" />}<span>{t.trackNow}</span></button>
    </form>
  );
}
