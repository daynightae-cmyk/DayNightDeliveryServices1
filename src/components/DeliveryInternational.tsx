/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Truck, Globe2, Calculator, Info } from "lucide-react";

export default function DeliveryInternational() {
  const [targetWeight, setWeight] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState("sa");

  const rates = [
    { code: "sa", name_en: "Saudi Arabia", name_ar: "المملكة العربية السعودية", first_kg: 95, additional_kg: 45, type: "gcc" },
    { code: "qa", name_en: "Qatar", name_ar: "قطر", first_kg: 95, additional_kg: 45, type: "gcc" },
    { code: "kw", name_en: "Kuwait", name_ar: "الكويت", first_kg: 95, additional_kg: 45, type: "gcc" },
    { code: "om", name_en: "Oman", name_ar: "سلطنة عمان", first_kg: 95, additional_kg: 45, type: "gcc" },
    { code: "bh", name_en: "Bahrain", name_ar: "البحرين", first_kg: 95, additional_kg: 45, type: "gcc" },
    { code: "eu", name_en: "European Union", name_ar: "دول الاتحاد الأوروبي", first_kg: 190, additional_kg: 90, type: "global" },
    { code: "us", name_en: "United States", name_ar: "الولايات المتحدة الأمريكية", first_kg: 190, additional_kg: 90, type: "global" },
    { code: "ca", name_en: "Canada", name_ar: "كندا", first_kg: 190, additional_kg: 90, type: "global" },
    { code: "au", name_en: "Australia", name_ar: "أستراليا", first_kg: 190, additional_kg: 90, type: "global" }
  ];

  const currentCountry = rates.find(c => c.code === selectedCountry) || rates[0];

  function calculatePrice() {
    const w = Math.max(1, targetWeight);
    const subtotal = currentCountry.first_kg + (w - 1) * currentCountry.additional_kg;
    const vat = parseFloat((subtotal * 0.05).toFixed(2));
    const total = parseFloat((subtotal + vat).toFixed(2));
    return { subtotal, vat, total };
  }

  const { subtotal, vat, total } = calculatePrice();

  return (
    <div className="space-y-12 text-right">
      {/* Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Worldwide Freight • الشحن الدولى السريع
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          شحن جوي وبري موثوق خارج الإمارات
        </h2>
        <p className="text-white/60 text-sm">
          تغطي DAY NIGHT خدمات الشحن الخفيف إلى جميع دول مجلس التعاون الخليجي والعديد من الوجهات العالمية المعتمدة بأسعار واضحة ودعم كامل في المعاملات وبثقة تامة.
        </p>
      </section>

      {/* Interactive Shipping Calculator */}
      <section className="bg-brand-cool/40 text-white p-8 rounded-3xl border border-white/10 grid grid-cols-1 lg:grid-cols-2 gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl"></div>
        
        <div className="space-y-6 relative z-10 text-right">
          <div className="inline-flex items-center gap-2 bg-brand-deep border border-white/10 rounded-lg px-3.5 py-1 text-brand-gold text-xs font-mono font-bold uppercase">
            <span>حاسبة الشحن الدولي التقديرية</span>
            <Calculator className="w-4 h-4 text-brand-gold" />
          </div>
          
          <div className="space-y-4">
            {/* Country Selector */}
            <div className="space-y-2">
              <label className="text-white/80 text-xs font-bold font-sans">وجهة الشحن المغادرة من الدولة</label>
              <select
                id="intl_calculator_country"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full bg-brand-deep hover:bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold/50 text-right font-sans"
              >
                {rates.map((c) => (
                  <option key={c.code} value={c.code} className="bg-brand-deep text-white">
                    {c.name_ar} ({c.name_en})
                  </option>
                ))}
              </select>
            </div>

            {/* Weight inputs */}
            <div className="space-y-2">
              <label className="text-white/80 text-xs font-bold leading-normal flex justify-between">
                <span className="text-brand-gold font-mono font-bold">{targetWeight} كجم</span>
                <span>الوزن التقريبي للشحنة (كيلو جرام)</span>
              </label>
              <input
                id="intl_calculator_weight"
                type="range"
                min="1"
                max="50"
                step="1"
                value={targetWeight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-2 bg-brand-deep rounded-lg appearance-none cursor-pointer accent-brand-gold border border-white/10"
              />
              <div className="flex justify-between text-[11px] text-white/40 font-mono font-medium">
                <span>50 كجم</span>
                <span>25 كجم</span>
                <span>10 كجم</span>
                <span>1 كجم</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Result */}
        <div className="bg-brand-deep/85 rounded-2xl p-6 border border-white/10 flex flex-col justify-between relative z-10 text-center lg:text-right space-y-6">
          <div className="space-y-4 text-right">
            <div>
              <p className="text-white/40 text-xs font-bold mb-1">السعر الأساسي لطلب الشحن</p>
              <p className="text-lg font-bold text-white font-mono">{subtotal.toFixed(2)} AED</p>
            </div>
            <div className="flex justify-between items-center text-xs text-white/50 border-t border-white/5 pt-2">
              <span className="font-mono">{vat.toFixed(2)} AED</span>
              <span>ضريبة القيمة المضافة (5%):</span>
            </div>
            <div className="flex justify-between items-center text-sm text-brand-gold border-t border-white/10 pt-2 font-bold">
              <span className="text-2xl font-black font-mono">{total.toFixed(2)} AED</span>
              <span>الإجمالي شامل الضريبة:</span>
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed font-sans mt-2">
              * احتساب التكلفة: أول كيلو بـ <span className="text-white font-bold">{currentCountry.first_kg} درهم</span>، وكل كيلو إضافي بـ <span className="text-white font-bold">{currentCountry.additional_kg} درهم</span>.
            </p>
          </div>

          <div className="bg-brand-deep/60 p-3 rounded-xl border border-white/5 text-[11px] text-white/70 space-y-1 text-right leading-relaxed font-sans">
            <p className="font-bold text-brand-gold flex items-center justify-end gap-1">
              <span>مستندات وتخليصات جمركية</span>
              <Info className="w-3.5 h-3.5" />
            </p>
            <p>يخضع الشحن الدولي لقوانين وأنظمة ومعايير الدولتين المرسلة والمستقبلة. قد تختلف مدة التسليم الفعلي حسب شركة وسائط النقل والمدينة ومراجعات الجمارك.</p>
          </div>

          <div>
            <a
              id="intl_inquiry_wa"
              href={`https://wa.me/971568757331?text=${encodeURIComponent(`السلام عليكم، أود حجز خدمة شحن دولي إلى ${currentCountry.name_ar} بوزن تقريبي ${targetWeight} كجم`)}`}
              target="_blank"
              referrerPolicy="no-referrer"
              className="w-full inline-block px-6 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs hover:scale-103 transition-transform text-center cursor-pointer"
            >
              احجز شحن إلى {currentCountry.name_ar} الآن
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Grid Lists */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* GCC Card */}
        <div className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="text-right">
              <h3 className="font-bold text-white text-lg">شحن دول الخليج العربي (GCC)</h3>
              <p className="text-white/40 text-xs uppercase font-mono font-bold tracking-wide">Middle East Regional land & air</p>
            </div>
            <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6 text-brand-gold" />
            </div>
          </div>
          
          <div className="divide-y divide-white/5 font-sans text-sm">
            {rates.filter(r => r.type === "gcc").map((r, i) => (
              <div id={`gcc_rate_${i}`} key={i} className="py-2.5 flex justify-between items-center">
                <div className="text-white/50 font-mono text-xs text-left">
                  <p>أول كيلو: <span className="font-bold text-brand-gold font-mono">{r.first_kg} AED</span></p>
                  <p className="text-[10px] text-white/30">إضافي: <span className="font-semibold font-mono">{r.additional_kg} AED</span></p>
                </div>
                <span className="text-white font-bold">{r.name_ar}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Global Card */}
        <div className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="text-right">
              <h3 className="font-bold text-white text-lg">الشحن الدولي والوجهات العالمية</h3>
              <p className="text-white/40 text-xs uppercase font-mono font-bold tracking-wide">Elite global carriers network</p>
            </div>
            <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex items-center justify-center shrink-0">
              <Globe2 className="w-6 h-6 text-brand-gold" />
            </div>
          </div>
          
          <div className="divide-y divide-white/5 font-sans text-sm">
            {rates.filter(r => r.type === "global").map((r, i) => (
              <div id={`global_rate_${i}`} key={i} className="py-2.5 flex justify-between items-center">
                <div className="text-white/50 font-mono text-xs text-left">
                  <p>أول كيلو: <span className="font-bold text-brand-gold font-mono">{r.first_kg} AED</span></p>
                  <p className="text-[10px] text-white/30">إضافي: <span className="font-semibold font-mono">{r.additional_kg} AED</span></p>
                </div>
                <span className="text-white font-bold">{r.name_ar}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
