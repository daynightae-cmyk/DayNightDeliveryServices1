/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgePercent, Check, MessageSquare, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { coverageAreas } from "../data/coverage";
import { domesticPricing, internationalDestinations, internationalPricing } from "../data/pricingData";
import { calculateDomesticPrice, calculateInternationalPrice, formatAED } from "../lib/pricing";
import companyMeta from "../data/companyMeta";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";

export default function Pricing() {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const tp = t.pricingPage;
  const isLight = theme === "light";
  const isArabic = language === "ar";

  /* ── Domestic calculator state (fully isolated) ── */
  const [domesticPickupCity, setDomesticPickupCity] = useState("Abu Dhabi");
  const [domesticDeliveryCity, setDomesticDeliveryCity] = useState("Dubai");
  const [domesticService, setDomesticService] = useState<"standard" | "express">("standard");
  const [domesticWeight, setDomesticWeight] = useState(1);
  const [domesticPieces, setDomesticPieces] = useState(1);

  /* ── International calculator state (fully isolated) ── */
  const [internationalDestination, setInternationalDestination] = useState("SA");
  const [internationalWeight, setInternationalWeight] = useState(1);

  /* ── Computed results ── */
  const domestic = useMemo(() => {
    return calculateDomesticPrice({
      pickupCity: domesticPickupCity,
      deliveryCity: domesticDeliveryCity,
      serviceType: domesticService,
      weight: domesticWeight,
      pieces: domesticPieces,
    });
  }, [domesticPickupCity, domesticDeliveryCity, domesticService, domesticWeight, domesticPieces]);

  const international = useMemo(() => {
    return calculateInternationalPrice({ countryCode: internationalDestination, weight: internationalWeight });
  }, [internationalDestination, internationalWeight]);

  const cityOptions = coverageAreas.map((area) => ({
    value: area.nameEn,
    label: isArabic ? area.nameAr : area.nameEn,
    zone: area.zoneType,
  }));

  function resetDomestic() {
    setDomesticPickupCity("Abu Dhabi");
    setDomesticDeliveryCity("Dubai");
    setDomesticService("standard");
    setDomesticWeight(1);
    setDomesticPieces(1);
  }

  function resetInternational() {
    setInternationalDestination("SA");
    setInternationalWeight(1);
  }

  const priceCards = [
    {
      title: tp.uaeMain,
      subtitle: domesticPricing.main.labelAr,
      amount: domesticPricing.main.total,
      note: tp.finalPrice,
    },
    {
      title: tp.uaeExtended,
      subtitle: domesticPricing.extended.labelAr,
      amount: domesticPricing.extended.total,
      note: tp.finalPrice,
    },
    {
      title: tp.expressSurcharge,
      subtitle: domesticPricing.expressSurcharge.labelAr,
      amount: domesticPricing.expressSurcharge.amount,
      note: tp.additional,
    },
    {
      title: tp.gccFirstKg,
      subtitle: internationalPricing.gcc.labelAr,
      amount: internationalPricing.gcc.firstKg,
      note: tp.thenPerKg.replace("{rate}", String(internationalPricing.gcc.additionalKg)),
    },
    {
      title: tp.worldwideFirstKg,
      subtitle: internationalPricing.worldwide.labelAr,
      amount: internationalPricing.worldwide.firstKg,
      note: tp.thenPerKg.replace("{rate}", String(internationalPricing.worldwide.additionalKg)),
    },
  ];

  const cardBase = isLight
    ? "bg-white/60 border-brand-deep/10"
    : "bg-brand-cool/30 border-white/10";

  const calculatorBase = isLight
    ? "bg-white/60 border-brand-deep/10"
    : "bg-brand-cool/35 border-white/10";

  const inputBase = isLight
    ? "bg-white/80 border-brand-deep/10 text-brand-deep"
    : "bg-brand-deep border-white/10 text-white";

  return (
    <div className={`space-y-10 ${isArabic ? "text-right" : "text-left"}`}>
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          {tp.badge}
        </span>
        <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight ${isLight ? "text-brand-deep" : "text-white"}`}>
          {tp.title}
        </h2>
        <p className={`text-sm leading-relaxed ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
          {tp.subtitle}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {priceCards.map((card) => (
          <div
            key={card.title}
            className={`rounded-2xl p-5 border space-y-3 transition-colors ${cardBase}`}
          >
            <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-lg flex items-center justify-center">
              <BadgePercent className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h3 className={`font-extrabold text-sm ${isLight ? "text-brand-deep" : "text-white"}`}>
                {card.title}
              </h3>
              <p className={`text-xs ${isLight ? "text-brand-deep/45" : "text-white/45"}`}>
                {card.subtitle}
              </p>
            </div>
            <p className="text-2xl font-black text-brand-gold font-mono" dir="ltr">
              {formatAED(Number(card.amount))}
            </p>
            <p className={`text-[11px] ${isLight ? "text-brand-deep/45" : "text-white/45"}`}>
              {card.note}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Domestic Calculator (isolated state) ── */}
        <div className={`rounded-3xl p-6 border space-y-6 ${calculatorBase}`}>
          <div className={`flex items-center justify-between border-b pb-4 ${isLight ? "border-brand-deep/10" : "border-white/10"}`}>
            <div className={`flex items-center gap-4 ${isArabic ? "flex-row-reverse" : ""}`}>
              <Truck className="w-8 h-8 text-brand-gold shrink-0" />
              <div>
                <h3 className={`text-xl font-extrabold ${isLight ? "text-brand-deep" : "text-white"}`}>
                  {tp.domesticCalculator}
                </h3>
                <p className={`text-xs ${isLight ? "text-brand-deep/45" : "text-white/45"}`}>
                  {tp.domesticHint}
                </p>
              </div>
            </div>
            <button
              onClick={resetDomestic}
              title="Reset"
              className={`p-2 rounded-lg transition-colors ${isLight ? "text-brand-deep/40 hover:text-brand-deep hover:bg-brand-deep/5" : "text-white/30 hover:text-white hover:bg-white/5"}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {tp.pickupCity}
              </span>
              <select
                value={domesticPickupCity}
                onChange={(e) => setDomesticPickupCity(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm ${inputBase}`}
              >
                {cityOptions.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {tp.deliveryCity}
              </span>
              <select
                value={domesticDeliveryCity}
                onChange={(e) => setDomesticDeliveryCity(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm ${inputBase}`}
              >
                {cityOptions.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {tp.service}
              </span>
              <select
                value={domesticService}
                onChange={(e) => setDomesticService(e.target.value as "standard" | "express")}
                className={`w-full border rounded-xl p-3 text-sm ${inputBase}`}
              >
                <option value="standard">{tp.standard}</option>
                <option value="express">{tp.express}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {tp.weight}
              </span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={domesticWeight}
                onChange={(e) => setDomesticWeight(Math.max(0.1, Number(e.target.value) || 1))}
                className={`w-full border rounded-xl p-3 text-sm font-mono ${inputBase}`}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {isArabic ? "عدد القطع" : "Number of Pieces"}
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={domesticPieces}
                onChange={(e) => setDomesticPieces(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                className={`w-full border rounded-xl p-3 text-sm font-mono ${inputBase}`}
              />
            </label>
          </div>

          <div className={`rounded-2xl p-5 border space-y-3 ${isLight ? "bg-white/80 border-brand-deep/10" : "bg-brand-deep border-white/10"}`}>
            {domestic.breakdown.map((line) => (
              <div key={line} className={`flex items-center justify-between text-xs ${isArabic ? "flex-row-reverse" : ""} ${isLight ? "text-brand-deep/65" : "text-white/65"}`}>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span dir="ltr">{line}</span>
              </div>
            ))}
            {domestic.requiresCustomQuote && (
              <p className="text-xs text-amber-400 font-bold">
                {isArabic ? "⚠️ الشحنة كبيرة — يتطلب تأكيداً تشغيلياً." : "⚠️ Large shipment — requires operational confirmation."}
              </p>
            )}
            <div className={`border-t pt-3 flex items-center justify-between ${isLight ? "border-brand-deep/10" : "border-white/10"}`}>
              <span className={`font-bold ${isLight ? "text-brand-deep" : "text-white"}`}>
                {tp.totalPrice}
              </span>
              <span className="text-3xl text-brand-gold font-black font-mono" dir="ltr">
                {formatAED(domestic.total)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link to="/request" className="flex-1 text-center px-4 py-2.5 bg-brand-gold text-brand-deep font-extrabold rounded-xl text-xs hover:bg-brand-blue hover:text-white transition-all">
              {tp.requestDelivery}
            </Link>
            <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-4 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl text-xs hover:bg-emerald-500 transition-all">
              WhatsApp
            </a>
          </div>
        </div>

        {/* ── International Calculator (isolated state) ── */}
        <div className={`rounded-3xl p-6 border space-y-6 ${calculatorBase}`}>
          <div className={`flex items-center justify-between border-b pb-4 ${isLight ? "border-brand-deep/10" : "border-white/10"}`}>
            <div className={`flex items-center gap-4 ${isArabic ? "flex-row-reverse" : ""}`}>
              <PackageCheck className="w-8 h-8 text-brand-gold shrink-0" />
              <div>
                <h3 className={`text-xl font-extrabold ${isLight ? "text-brand-deep" : "text-white"}`}>
                  {tp.internationalCalculator}
                </h3>
                <p className={`text-xs ${isLight ? "text-brand-deep/45" : "text-white/45"}`}>
                  {tp.internationalHint}
                </p>
              </div>
            </div>
            <button
              onClick={resetInternational}
              title="Reset"
              className={`p-2 rounded-lg transition-colors ${isLight ? "text-brand-deep/40 hover:text-brand-deep hover:bg-brand-deep/5" : "text-white/30 hover:text-white hover:bg-white/5"}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {tp.destination}
              </span>
              <select
                value={internationalDestination}
                onChange={(e) => setInternationalDestination(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm ${inputBase}`}
              >
                {internationalDestinations.map((destination) => (
                  <option key={destination.countryCode} value={destination.countryCode}>
                    {isArabic ? destination.countryNameAr : destination.countryNameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={`text-xs font-bold ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
                {tp.weight}
              </span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={internationalWeight}
                onChange={(e) => setInternationalWeight(Math.max(0.1, Number(e.target.value) || 1))}
                className={`w-full border rounded-xl p-3 text-sm font-mono ${inputBase}`}
              />
            </label>
          </div>

          <div className={`rounded-2xl p-5 border space-y-3 ${isLight ? "bg-white/80 border-brand-deep/10" : "bg-brand-deep border-white/10"}`}>
            {international.breakdown.map((line) => (
              <div key={line} className={`flex items-center justify-between text-xs ${isArabic ? "flex-row-reverse" : ""} ${isLight ? "text-brand-deep/65" : "text-white/65"}`}>
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span dir="ltr">{line}</span>
              </div>
            ))}
            {international.requiresCustomQuote && (
              <p className="text-xs text-amber-400 font-bold">
                {isArabic ? "⚠️ وزن كبير جداً — يتطلب عرض سعر خاص." : "⚠️ Very heavy shipment — requires custom quote."}
              </p>
            )}
            <div className={`border-t pt-3 flex items-center justify-between ${isLight ? "border-brand-deep/10" : "border-white/10"}`}>
              <span className={`font-bold ${isLight ? "text-brand-deep" : "text-white"}`}>
                {tp.totalPrice}
              </span>
              <span className="text-3xl text-brand-gold font-black font-mono" dir="ltr">
                {formatAED(international.total)}
              </span>
            </div>
            <p className={`text-[11px] italic ${isLight ? "text-brand-deep/40" : "text-white/40"}`} dir="ltr">
              {international.notes}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link to="/tracking" className={`flex-1 text-center px-4 py-2.5 border font-extrabold rounded-xl text-xs transition-all ${isLight ? "bg-white/50 border-brand-deep/10 text-brand-deep hover:border-brand-gold/50" : "bg-white/5 border-white/10 text-white hover:border-brand-gold/50"}`}>
              <Search className="w-3.5 h-3.5 inline mr-1" />
              {tp.trackShipment}
            </Link>
            <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-4 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl text-xs hover:bg-emerald-500 transition-all">
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className={`rounded-3xl p-6 border flex flex-col lg:flex-row items-center justify-between gap-4 ${isLight ? "bg-white/60 border-brand-deep/10" : "bg-brand-cool/30 border-white/10"}`}>
        <div className={isArabic ? "text-right" : "text-left"}>
          <h3 className={`font-extrabold text-lg ${isLight ? "text-brand-deep" : "text-white"}`}>
            {tp.readyTitle}
          </h3>
          <p className={`text-xs ${isLight ? "text-brand-deep/55" : "text-white/55"}`}>
            {tp.readySubtitle}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/request"
            className="px-5 py-3 bg-brand-gold text-brand-deep font-extrabold rounded-xl text-xs flex items-center gap-2 hover:bg-brand-blue hover:text-white transition-all"
          >
            <Truck className="w-4 h-4" />
            {tp.requestDelivery}
          </Link>
          <Link
            to="/tracking"
            className={`px-5 py-3 border font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all ${
              isLight
                ? "bg-white/50 border-brand-deep/10 text-brand-deep hover:border-brand-gold/50"
                : "bg-white/5 border-white/10 text-white hover:border-brand-gold/50"
            }`}
          >
            <Search className="w-4 h-4 text-brand-gold" />
            {tp.trackShipment}
          </Link>
          <a
            href={companyMeta.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-emerald-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 hover:bg-emerald-500 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            {tp.contactWhatsApp}
          </a>
        </div>
      </section>
    </div>
  );
}
