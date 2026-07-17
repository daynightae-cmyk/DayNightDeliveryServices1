/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { Calculator, Globe2, Info, Truck } from "lucide-react";
import { internationalDestinations } from "../data/pricingData";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { calculateInternationalPrice, formatAED } from "../lib/pricing";

const regionLabels: Record<string, { ar: string; en: string }> = {
  GCC: { ar: "دول الخليج", en: "GCC" },
  Europe: { ar: "أوروبا", en: "Europe" },
  "North America": { ar: "أمريكا وكندا", en: "America & Canada" },
  Worldwide: { ar: "وجهات عالمية", en: "Worldwide" }
};

function regionName(region: string, isArabic: boolean) {
  const label = regionLabels[region] || { ar: region, en: region };
  return isArabic ? label.ar : label.en;
}

export default function DeliveryInternational() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
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

  const currentCountryName = isArabic ? currentCountry.countryNameAr : currentCountry.countryNameEn;
  const whatsappMessage = encodeURIComponent(
    isArabic
      ? `السلام عليكم، أود حجز خدمة شحن دولي إلى ${currentCountry.countryNameAr} بوزن تقريبي ${targetWeight} كجم`
      : `Hello, I would like to book international shipping to ${currentCountry.countryNameEn} for an estimated weight of ${targetWeight} kg`
  );

  return (
    <div className={`space-y-12 ${isArabic ? "text-right" : "text-left"}`} dir={isArabic ? "rtl" : "ltr"}>
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Worldwide Freight • {isArabic ? "الشحن الدولي السريع" : "International Shipping"}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {isArabic ? "شحن موثوق إلى الخليج وأوروبا وأمريكا وكندا" : "Reliable shipping to GCC, Europe, America, and Canada"}
        </h2>
        <p className="text-white/60 text-sm sm:text-base leading-relaxed">
          {isArabic
            ? "أسعار دولية واضحة حسب الوجهة والوزن، مع متابعة مباشرة عبر فريق داي نايت من الحجز حتى التسليم."
            : "Clear international rates by destination and weight, with DAY NIGHT follow-up from booking to delivery."}
        </p>
      </section>

      <section className="bg-brand-cool/40 text-white p-6 sm:p-8 rounded-3xl border border-white/10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-brand-deep border border-white/10 rounded-lg px-3.5 py-1 text-brand-gold text-xs font-mono font-bold uppercase">
            <Calculator className="w-4 h-4 text-brand-gold" />
            <span>{isArabic ? "حاسبة الشحن الدولي" : "International Rate Calculator"}</span>
          </div>

          <label className="space-y-2 block">
            <span className="text-white/80 text-xs font-bold font-sans">{isArabic ? "وجهة الشحن" : "Shipping Destination"}</span>
            <select
              id="intl_calculator_country"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className={`w-full bg-brand-deep hover:bg-brand-deep/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-gold/50 font-sans ${isArabic ? "text-right" : "text-left"}`}
            >
              {internationalDestinations.map((destination) => (
                <option key={destination.countryCode} value={destination.countryCode} className="bg-brand-deep text-white">
                  {isArabic ? destination.countryNameAr : destination.countryNameEn} ({regionName(destination.region, isArabic)})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 block">
            <span className="text-white/80 text-xs font-bold leading-normal flex justify-between gap-3">
              <span>{isArabic ? "الوزن التقريبي للشحنة" : "Estimated Shipment Weight"}</span>
              <span className="text-brand-gold font-mono font-bold" dir="ltr">{targetWeight} kg</span>
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

        <div className="bg-brand-deep/85 rounded-2xl p-6 border border-white/10 flex flex-col justify-between text-center sm:text-start space-y-6">
          <div className="space-y-4">
            <p className="text-white/40 text-xs font-bold">
              {regionName(currentCountry.region, isArabic)} • {currentCountry.estimatedDays}
            </p>
            <h3 className="text-xl text-white font-extrabold">{currentCountryName}</h3>
            <div className="space-y-2 border-y border-white/10 py-4">
              <p className="flex justify-between gap-4 text-xs text-white/60">
                <span>{isArabic ? "أول كيلو" : "First kg"}</span>
                <span className="font-mono" dir="ltr">{formatAED(currentCountry.firstKg)}</span>
              </p>
              <p className="flex justify-between gap-4 text-xs text-white/60">
                <span>{isArabic ? "كل كيلو إضافي" : "Each additional kg"}</span>
                <span className="font-mono" dir="ltr">{formatAED(currentCountry.additionalKg)}</span>
              </p>
            </div>
            <div className="flex justify-between items-center gap-4 text-sm text-brand-gold font-bold">
              <span>{isArabic ? "الإجمالي النهائي" : "Estimated Total"}</span>
              <span className="text-2xl font-black font-mono" dir="ltr">{formatAED(price.total)}</span>
            </div>
          </div>

          <div className="bg-brand-deep/60 p-3 rounded-xl border border-white/5 text-[11px] text-white/70 space-y-1 leading-relaxed font-sans">
            <p className="font-bold text-brand-gold flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>{isArabic ? "مستندات وتخليصات جمركية" : "Documents & Customs Clearance"}</span>
            </p>
            <p>
              {isArabic
                ? "تخضع مدة التسليم لمراجعات الجمارك وشركة النقل والمدينة المستقبلة."
                : "Delivery time depends on customs review, carrier processing, and the destination city."}
            </p>
          </div>

          <a
            id="intl_inquiry_wa"
            href={`https://wa.me/${companyMeta.whatsappNumber}?text=${whatsappMessage}`}
            target="_blank"
            referrerPolicy="no-referrer"
            className="w-full inline-block px-6 py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs transition-transform text-center cursor-pointer"
          >
            {isArabic ? `احجز شحن إلى ${currentCountry.countryNameAr} الآن` : `Book shipping to ${currentCountry.countryNameEn}`}
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(grouped).map(([region, destinations]) => (
          <div key={region} className="bg-brand-cool/30 rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-white text-lg">{regionName(region, isArabic)}</h3>
                <p className="text-white/40 text-xs uppercase font-mono font-bold tracking-wide">
                  {isArabic ? "وجهات الشحن الدولية" : "International destinations"}
                </p>
              </div>
              <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex items-center justify-center shrink-0">
                {region === "GCC" ? <Truck className="w-6 h-6 text-brand-gold" /> : <Globe2 className="w-6 h-6 text-brand-gold" />}
              </div>
            </div>

            <div className="divide-y divide-white/5 font-sans text-sm">
              {destinations.map((destination) => (
                <div key={destination.countryCode} className="py-2.5 flex justify-between gap-4 items-center">
                  <div className="text-white/50 font-mono text-xs" dir="ltr">
                    <p>{isArabic ? "First" : "First"}: <span className="font-bold text-brand-gold font-mono">{formatAED(destination.firstKg)}</span></p>
                    <p className="text-[10px] text-white/30">{isArabic ? "Extra" : "Additional"}: <span className="font-semibold font-mono">{formatAED(destination.additionalKg)}</span></p>
                  </div>
                  <span className="text-white font-bold">{isArabic ? destination.countryNameAr : destination.countryNameEn}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
