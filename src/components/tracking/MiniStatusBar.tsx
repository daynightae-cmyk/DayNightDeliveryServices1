import React, { useEffect, useState } from 'react';
import { shipmentStatuses } from '../../data/shipmentStatusMap';
import translations from '../../data/translations';
import { useLanguage } from '../../context/LanguageContext';
import { RefreshCw } from 'lucide-react';

interface Props {
  trackingNo?: string;
  initialStatusKey?: string;
}

export default function MiniStatusBar({ trackingNo, initialStatusKey }: Props) {
  const { lang } = useLanguage();
  const t = translations[lang].tracking;
  const [statusKey, setStatusKey] = useState(initialStatusKey || 'order_created');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(new Date());

  useEffect(() => {
    setUpdatedAt(new Date());
  }, []);

  function handleRefresh() {
    // simulate status rotation for demo; in future connect to Supabase
    const keys = Object.keys(shipmentStatuses);
    const idx = keys.indexOf(statusKey);
    const next = keys[(idx + 1) % keys.length];
    setStatusKey(next);
    setUpdatedAt(new Date());
  }

  const statusText = shipmentStatuses[statusKey] ? (lang === 'ar' ? shipmentStatuses[statusKey].ar : shipmentStatuses[statusKey].en) : '';

  return (
    <div className="w-full rounded-b-xl border-b border-white/5 mb-6">
      <div className="max-w-7xl mx-auto bg-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></div>
          <div className="text-xs text-white/80">
            {trackingNo ? (
              <div className="space-y-0.5">
                <div className="font-mono font-bold text-[12px]">{t.trackingNo}: <span className="text-brand-gold">{trackingNo}</span></div>
                <div className="text-[13px] font-extrabold">{t.latestStatus}: <span className="text-white/90">{statusText}</span></div>
                <div className="text-[11px] text-white/50">{t.updated}: {updatedAt ? `${Math.floor((Date.now() - updatedAt.getTime())/60000)} minutes ago` : '-'}</div>
              </div>
            ) : (
              <div className="text-xs text-white/60">{t.emptyStatus}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-bold flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> {t.refreshStatus}
          </button>
        </div>
      </div>
    </div>
  );
}
