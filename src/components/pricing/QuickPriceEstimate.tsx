import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import translations from '../../data/translations';
import { cities } from '../../data/pricingEstimate';
import { calculateLocalPrice } from '../../lib/pricing';
import getWeightSurcharge from '../../utils/pricing/getWeightSurcharge';
import { Calculator, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QuickPriceEstimate() {
  const { lang } = useLanguage();
  const { theme } = useTheme();
  const t = translations[lang].pricingWidget;
  const [open, setOpen] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [weight, setWeight] = useState<string | number>('1');
  const surcharge = useMemo(() => getWeightSurcharge(weight), [weight]);
  const deliveryEstimate = useMemo(() => {
    if (!from || !to) return null;
    const pricing = calculateLocalPrice(to, Number(weight) || 1);
    return {
      min: pricing.total,
      max: pricing.total,
      category: pricing.pricingCategory,
      notes: pricing.notes
    };
  }, [from, to, weight]);

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

            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="text-xs text-white/60">{t.weightLabel}</label>
              <div className="flex gap-2">
                <select value={String(weight)} onChange={(e) => setWeight(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border">
                  <option value="0.5">0.5 {t.weightUnit}</option>
                  <option value="1">1 {t.weightUnit}</option>
                  <option value="2">2 {t.weightUnit}</option>
                  <option value="3">3 {t.weightUnit}</option>
                  <option value="5">5 {t.weightUnit}</option>
                  <option value="10">10 {t.weightUnit}</option>
                  <option value="15">15 {t.weightUnit}</option>
                  <option value="20">20 {t.weightUnit}</option>
                  <option value="other">Other</option>
                </select>
                {String(weight) === 'other' ? (
                  <input type="number" min="0.1" step="0.1" placeholder={t.weightPlaceholder} value={''} onChange={(e) => setWeight(Number(e.target.value))} className="w-28 px-3 py-2 rounded-lg border" />
                ) : (
                  <div className="w-28 px-3 py-2 rounded-lg border bg-white/5 text-center">{String(weight)} {t.weightUnit}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => {}} className={`flex-1 px-3 py-2 rounded-lg font-bold ${theme === 'night' ? 'bg-brand-gold text-brand-deep' : 'bg-blue-600 text-white'}`}>{t.estimateButton}</button>
                <Link to="/pricing" className="text-xs text-slate-500 hover:underline flex items-center gap-1"><span>{t.continueBooking}</span> <ArrowRight className="w-3 h-3"/></Link>
              </div>

              <div className="mt-3 text-sm">
                {(!from || !to) ? (
                  <div className="text-rose-500">{t.missingFields}</div>
                ) : deliveryEstimate ? (
                  <div className="space-y-2">
                    <div className="font-extrabold">{t.estimatedRange}: AED {deliveryEstimate.min.toFixed(2)}</div>
                    <div className="text-white/90 text-sm">{lang === 'ar' ? 'فئة التسعير' : 'Pricing category'}: {deliveryEstimate.category}</div>
                    <div className="text-white/90 text-sm">{lang === 'ar' ? 'ملاحظات' : 'Notes'}: {deliveryEstimate.notes}</div>
                    {surcharge && !surcharge.needsCustomQuote ? (
                      <div className="text-white/90 text-sm">{lang === 'ar' ? 'تقدير رسوم الوزن الإضافية' : 'Weight surcharge estimate'}: AED {surcharge.min} – AED {surcharge.max}</div>
                    ) : surcharge && surcharge.needsCustomQuote ? (
                      <div className="text-yellow-300 text-sm">{lang === 'ar' ? 'للشحنات التي تزيد عن 20 كجم، يرجى المتابعة إلى الحجز الكامل للحصول على سعر مخصص.' : 'For shipments above 20 kg, please continue to full booking for a custom quote.'}</div>
                    ) : null}

                    {surcharge && !surcharge.needsCustomQuote && (
                      <div className="font-extrabold">{lang === 'ar' ? 'النطاق الإجمالي المتوقع' : 'Estimated total range'}: AED {(deliveryEstimate.min + surcharge.min).toFixed(2)}</div>
                    )}

                    <div className="text-xs text-white/50 mt-2">{lang === 'ar' ? 'هذا تقدير قائم على فئة الأسعار الرسمية ورسوم الوزن. السعر النهائي قد يختلف حسب حجم الشحنة ونوع الخدمة ووقت التسليم.' : 'This estimate is based on official pricing categories and weight surcharge. Final price may vary based on package size, service type, and delivery timing.'}</div>
                  </div>
                ) : (
                  <div className="text-white/60">—</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
