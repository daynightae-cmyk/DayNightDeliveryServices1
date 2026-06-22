/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { Calculator, Globe2, Info, Truck } from "lucide-react";
import { internationalDestinations } from "../data/pricingData";
import { calculateInternationalPrice, formatAED } from "../lib/pricing";

export default function DeliveryInternational() {
  const [targetWeight, setWeight] = useState(3);
  const [selectedCountry, setSelectedCountry] = useState("SA");

  const currentCountry = internationalDestinations.find((c) => c.countryCode === selectedCountry) || internationalDestinations[0];
  const price = useMemo(() => {
    return calculateInternationalPrice({ countryCode: selectedCountry, weight: targetWeight });
  }, [selectedCountry, targetWeight]);

  const grouped = internationalDestinations.reduce<Record<string, typeof internationalDestinations>>((acc, destination) => {
    acc[destination.region] ||= [];
    acc[destination.region].push(destination);
    return acc;
  }, {});

  return (
    <div className="space-y-12 text-right">
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Worldwide Freight • الشحن الدولي السريع
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          شحن موثوق إلى الخليج وأوروبا وأمريكا وكندا
        </h2>
        <p className="text-white/60 text-sm">
          أسعار دولية واضحة: دول الخليج أول كيلو 95 درهم وكل كيلو إضافي 45 درهم، والوجهات العالمية أول كيلو 190 درهم وكل كيلو إضافي 90 درهم.
        </p>
      </section>

      <section className="bg-brand-cool/40 text-white p-8 rounded-3xl border border-white/10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6 text-right">
          <div className="inline-flex items-center gap-2 bg-brand-deep border border-white/10 rounded-lg px-3.5 py-1 text-brand-gold text-xs font-mono font-bold uppercase">
            <span>حاسبة الشحن الدولي</span>
            <Calculator className="w-4 h-4 text-brand-gold" />
          </div>

          <label className="space-y-2 block">
            <span className="text-white/80 text-xs font-bold font-sans">وجهة الشحن</span>
            <select
              id="intl_calculator_country"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full bg-brand-deep hover:bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold/50 text-right font-sans"
            >
              {internationalDestinations.map((destination) => (
                <option key={destination.countryCode} value={destination.countryCode} className="bg-brand-deep text-white">
                  {destination.countryNameAr} ({destination.countryNameEn})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 block">
            <span className="text-white/80 text-xs font-bold leading-normal flex justify-between">
              <span className="text-brand-gold font-mono font-bold" dir="ltr">{targetWeight} kg</span>
              <span>الوزن التقريبي للشحنة</span>
            </span>
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
          </label>
        </div>

        <div className="bg-brand-deep/85 rounded-2xl p-6 border border-white/10 flex flex-col justify-between text-center lg:text-right space-y-6">
          <div className="space-y-4 text-right">
            <p className="text-white/40 text-xs font-bold">{currentCountry.region} • {currentCountry.estimatedDays}</p>
            <h3 className="text-xl text-white font-extrabold">{currentCountry.countryNameAr}</h3>
            <div className="space-y-2 border-y border-white/10 py-4">
              <p className="flex justify-between text-xs text-white/60"><span dir="ltr">{formatAED(currentCountry.firstKg)}</span><span>أول كيلو:</span></p>
              <p className="flex justify-between text-xs text-white/60"><span dir="ltr">{formatAED(currentCountry.additionalKg)}</span><span>كل كيلو إضافي:</span></p>
              <p className="flex justify-between text-xs text-white/60"><span dir="ltr">{formatAED(price.vatAmount)}</span><span>VAT 5%:</span></p>
            </div>
            <div className="flex justify-between items-center text-sm text-brand-gold font-bold">
              <span className="text-2xl font-black font-mono" dir="ltr">{formatAED(price.total)}</span>
              <span>الإجمالي شامل الضريبة:</span>
            </div>
          </div>

          <div className="bg-brand-deep/60 p-3 rounded-xl border border-white/5 text-[11px] text-white/70 space-y-1 text-right leading-relaxed font-sans">
            <p className="font-bold text-brand-gold flex items-center justify-end gap-1">
              <span>مستندات وتخليصات جمركية</span>
              <Info className="w-3.5 h-3.5" />
            </p>
            <p>تخضع مدة التسليم لمراجعات الجمارك وشركة النقل والمدينة المستقبلة.</p>
          </div>

          <a
            id="intl_inquiry_wa"
            href={`https://wa.me/971568757331?text=${encodeURIComponent(`السلام عليكم، أود حجز خدمة شحن دولي إلى ${currentCountry.countryNameAr} بوزن تقريبي ${targetWeight} كجم`)}`}
            target="_blank"
            referrerPolicy="no-referrer"
            className="w-full inline-block px-6 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-transform text-center cursor-pointer"
          >
            احجز شحن إلى {currentCountry.countryNameAr} الآن
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(grouped).map(([region, destinations]) => (
          <div key={region} className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="text-right">
                <h3 className="font-bold text-white text-lg">{region}</h3>
                <p className="text-white/40 text-xs uppercase font-mono font-bold tracking-wide">International destinations</p>
              </div>
              <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex items-center justify-center shrink-0">
                {region === "GCC" ? <Truck className="w-6 h-6 text-brand-gold" /> : <Globe2 className="w-6 h-6 text-brand-gold" />}
              </div>
            </div>

            <div className="divide-y divide-white/5 font-sans text-sm">
              {destinations.map((destination) => (
                <div key={destination.countryCode} className="py-2.5 flex justify-between items-center">
                  <div className="text-white/50 font-mono text-xs text-left">
                    <p>First: <span className="font-bold text-brand-gold font-mono" dir="ltr">{formatAED(destination.firstKg)}</span></p>
                    <p className="text-[10px] text-white/30">Additional: <span className="font-semibold font-mono" dir="ltr">{formatAED(destination.additionalKg)}</span></p>
                  </div>
                  <span className="text-white font-bold">{destination.countryNameAr}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
