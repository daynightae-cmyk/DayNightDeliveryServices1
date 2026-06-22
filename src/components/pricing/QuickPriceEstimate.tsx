import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import translations from '../../data/translations';
import { cities, getQuickEstimate } from '../../data/pricingEstimate';
import { Calculator, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QuickPriceEstimate() {
  const { lang } = useLanguage();
  const { theme } = useTheme();
  const t = translations[lang].pricingWidget;
  const [open, setOpen] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const result = useMemo(() => getQuickEstimate(from, to), [from, to]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const positionClass = dir === 'rtl' ? 'left-4' : 'right-4';

  return (
    <div className={`fixed bottom-6 ${positionClass} z-50 transition-all`} style={{ direction: dir }}>
      <div className={`w-80 sm:w-96 rounded-2xl border ${theme === 'night' ? 'bg-brand-deep/90 border-brand-gold/20' : 'bg-white/95 border-gray-200'} shadow-lg overflow-hidden`}>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${theme === 'night' ? 'bg-brand-blue/60 text-white' : 'bg-blue-50 text-blue-800'}`}><Calculator className="w-4 h-4" /></div>
            <div className="text-sm font-extrabold">
              <div className={theme === 'night' ? 'text-white' : 'text-slate-900'}>{t.title}</div>
              <div className="text-[11px] text-white/60">{t.description}</div>
            </div>
          </div>
          <button onClick={() => setOpen((s) => !s)} className="p-2 text-white/80">{open ? <ChevronUp/> : <ChevronDown/>}</button>
        </div>

        {open && (
          <div className="p-3 border-t border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border">
                <option value="">{t.pickupCity}</option>
                {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border">
                <option value="">{t.deliveryCity}</option>
                {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => {}} className={`flex-1 px-3 py-2 rounded-lg font-bold ${theme === 'night' ? 'bg-brand-gold text-brand-deep' : 'bg-blue-600 text-white'}`}>{t.estimateButton}</button>
              <Link to="/pricing" className="text-xs text-slate-500 hover:underline flex items-center gap-1"><span>{t.continueBooking}</span> <ArrowRight className="w-3 h-3"/></Link>
            </div>

            <div className="mt-3 text-sm">
              {(!from || !to) ? (
                <div className="text-rose-500">{t.missingFields}</div>
              ) : result ? (
                <div className="font-extrabold">{t.estimatedRange}: AED {result.min} – AED {result.max}</div>
              ) : (
                <div className="text-white/60">—</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
