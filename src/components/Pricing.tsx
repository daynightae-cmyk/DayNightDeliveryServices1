/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgePercent, Calculator, Check, MessageSquare, PackageCheck, Search, Truck } from "lucide-react";
import { coverageAreas } from "../data/coverage";
import { domesticPricing, internationalDestinations, internationalPricing } from "../data/pricingData";
import { calculateDomesticPrice, calculateInternationalPrice, formatAED } from "../lib/pricing";
import companyMeta from "../data/companyMeta";

export default function Pricing() {
  const [pickupCity, setPickupCity] = useState("Abu Dhabi");
  const [deliveryCity, setDeliveryCity] = useState("Dubai");
  const [serviceType, setServiceType] = useState<"standard" | "express">("standard");
  const [countryCode, setCountryCode] = useState("SA");
  const [weight, setWeight] = useState(1);

  const domestic = useMemo(() => {
    return calculateDomesticPrice({ pickupCity, deliveryCity, serviceType, weight });
  }, [pickupCity, deliveryCity, serviceType, weight]);

  const international = useMemo(() => {
    return calculateInternationalPrice({ countryCode, weight });
  }, [countryCode, weight]);

  const cityOptions = coverageAreas.map((area) => ({
    value: area.nameEn,
    label: `${area.nameAr} / ${area.nameEn}`,
    zone: area.zoneType
  }));

  return (
    <div className="space-y-10 text-right">
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Pricing Blueprint • الأسعار والتعرفة الرسمية
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          أسعار واضحة من DAY NIGHT DELIVERY SERVICES
        </h2>
        <p className="text-white/60 text-sm leading-relaxed">
          أسعار نهائية واضحة للتوصيل المحلي والشحن الدولي إلى الخليج وأوروبا وأمريكا وكندا والوجهات العالمية.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          ["UAE Main Areas", "المناطق الرئيسية", domesticPricing.main.total, "Final Price"],
          ["UAE Extended Areas", "المناطق الممتدة", domesticPricing.extended.total, "Final Price"],
          ["Express Surcharge", "الخدمة السريعة", domesticPricing.expressSurcharge.amount, "Additional"],
          ["GCC First Kg", "أول كيلو خليجي", internationalPricing.gcc.firstKg, "then 45 AED/kg"],
          ["Worldwide First Kg", "أول كيلو عالمي", internationalPricing.worldwide.firstKg, "then 90 AED/kg"]
        ].map(([title, subtitle, amount, note]) => (
          <div key={String(title)} className="bg-brand-cool/30 rounded-2xl p-5 border border-white/10 space-y-3">
            <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex items-center justify-center">
              <BadgePercent className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-sm">{title}</h3>
              <p className="text-white/45 text-xs">{subtitle}</p>
            </div>
            <p className="text-2xl font-black text-brand-gold font-mono" dir="ltr">
              {formatAED(Number(amount))}
            </p>
            <p className="text-[11px] text-white/45">{note}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-brand-cool/35 rounded-3xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <Truck className="w-8 h-8 text-brand-gold" />
            <div>
              <h3 className="text-xl font-extrabold text-white">حاسبة التوصيل داخل الإمارات</h3>
              <p className="text-white/45 text-xs">Main areas: 30 AED • Extended: 50 AED</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-white/60 font-bold">مدينة الاستلام</span>
              <select value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} className="w-full bg-brand-deep border border-white/10 rounded-xl p-3 text-white text-sm">
                {cityOptions.map((city) => <option key={city.value} value={city.value}>{city.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60 font-bold">مدينة التسليم</span>
              <select value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} className="w-full bg-brand-deep border border-white/10 rounded-xl p-3 text-white text-sm">
                {cityOptions.map((city) => <option key={city.value} value={city.value}>{city.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60 font-bold">الخدمة</span>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value as "standard" | "express")} className="w-full bg-brand-deep border border-white/10 rounded-xl p-3 text-white text-sm">
                <option value="standard">Standard / عادي</option>
                <option value="express">Express +15 AED / سريع</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60 font-bold">الوزن</span>
              <input type="number" min="1" value={weight} onChange={(e) => setWeight(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-brand-deep border border-white/10 rounded-xl p-3 text-white text-sm font-mono" />
            </label>
          </div>

          <div className="bg-brand-deep rounded-2xl p-5 border border-white/10 space-y-3">
            {domestic.breakdown.map((line) => (
              <div key={line} className="flex items-center justify-between text-xs text-white/65">
                <Check className="w-4 h-4 text-emerald-400" />
                <span dir="ltr">{line}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-white font-bold">Total Price</span>
              <span className="text-3xl text-brand-gold font-black font-mono" dir="ltr">{formatAED(domestic.total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-brand-cool/35 rounded-3xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <PackageCheck className="w-8 h-8 text-brand-gold" />
            <div>
              <h3 className="text-xl font-extrabold text-white">حاسبة الشحن الدولي</h3>
              <p className="text-white/45 text-xs">GCC: 95 + 45/kg • Worldwide: 190 + 90/kg</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-white/60 font-bold">الوجهة</span>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full bg-brand-deep border border-white/10 rounded-xl p-3 text-white text-sm">
                {internationalDestinations.map((destination) => (
                  <option key={destination.countryCode} value={destination.countryCode}>
                    {destination.countryNameAr} / {destination.countryNameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/60 font-bold">الوزن</span>
              <input type="number" min="1" value={weight} onChange={(e) => setWeight(Math.max(1, Number(e.target.value) || 1))} className="w-full bg-brand-deep border border-white/10 rounded-xl p-3 text-white text-sm font-mono" />
            </label>
          </div>

          <div className="bg-brand-deep rounded-2xl p-5 border border-white/10 space-y-3">
            {international.breakdown.map((line) => (
              <div key={line} className="flex items-center justify-between text-xs text-white/65">
                <Check className="w-4 h-4 text-emerald-400" />
                <span dir="ltr">{line}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-white font-bold">Total Price</span>
              <span className="text-3xl text-brand-gold font-black font-mono" dir="ltr">{formatAED(international.total)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="text-right">
          <h3 className="text-white font-extrabold text-lg">جاهز لإرسال طلبك؟</h3>
          <p className="text-white/55 text-xs">اختر قناة التواصل أو أنشئ الطلب مباشرة مع رقم تتبع حقيقي.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/request" className="px-5 py-3 bg-brand-gold text-brand-deep font-extrabold rounded-xl text-xs flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Request Delivery
          </Link>
          <Link to="/tracking" className="px-5 py-3 bg-white/5 border border-white/10 text-white font-extrabold rounded-xl text-xs flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-gold" />
            Track Shipment
          </Link>
          <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-emerald-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Contact WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}
