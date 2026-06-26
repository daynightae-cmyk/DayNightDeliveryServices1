import { useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, ClipboardCheck, MapPin, MessageCircle, Package, Truck } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import { cities, getQuickEstimate, getWeightSurcharge } from "../data/pricingEstimate";
import TestimonialCarousel from "./home/TestimonialCarousel";
import UAEInteractiveMap from "./home/UAEInteractiveMap";
import WorldClock from "./home/WorldClock";
import Premium3DIcon from "./ui/Premium3DIcon";
import { DNBadge, DNButton, DNCard, DNInput, DNSelect, DNStat } from "./ui/DNDesignSystem";
import companyMeta from "../data/companyMeta";

type HomePremiumProps = { onNavigate: (tab: string) => void };

export default function HomePremium({ onNavigate }: HomePremiumProps) {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const tP = t.pricingWeight;
  const isArabic = language === "ar";
  const isLight = theme === "light";
  const [estimateFrom, setEstimateFrom] = useState(cities[1]);
  const [estimateTo, setEstimateTo] = useState(cities[0]);
  const [weight, setWeight] = useState<number | string>("1");

  const baseEstimate = getQuickEstimate(estimateFrom, estimateTo);
  const surcharge = getWeightSurcharge(weight);
  const totalEstimate = baseEstimate ? { min: baseEstimate.min + surcharge.min, max: baseEstimate.max + surcharge.max } : null;

  function formatAedRange(min: number, max: number) {
    if (language === "ar") return min === max ? `${min} AED` : `${min}-${max} AED`;
    return min === max ? `${min} AED` : `${min}-${max} AED`;
  }

  const stats = [
    { value: "24/7", label: "Non-stop", tone: "gold" as const },
    { value: "30 AED", label: "Main cities", tone: "blue" as const },
    { value: "7+", label: "Emirates", tone: "green" as const },
    { value: "100%", label: "Safe", tone: "gold" as const },
  ];

  return (
    <div className="space-y-14 sm:space-y-20" dir={isArabic ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-grid-pattern px-5 py-12 shadow-2xl shadow-black/25 sm:px-10 sm:py-16">
        <div className="absolute inset-0 bg-brand-cool/30" />
        <div className="relative z-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className={isArabic ? "text-right" : "text-left"}>
            <DNBadge tone="gold" className="mb-5"><BadgeCheck className="h-4 w-4" /> DAY NIGHT DELIVERY</DNBadge>
            <h1 className={`max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl ${isLight ? "text-[#071A33]" : "text-white"}`}>{t.home.heroTitle}<span className="mt-2 block text-brand-gold">{language === "ar" ? "UAE & WORLD" : "Across UAE & Beyond"}</span></h1>
            <p className={`mt-6 max-w-2xl text-base font-bold leading-8 sm:text-lg ${isLight ? "text-[#071A33]/65" : "text-white/65"}`}>{t.home.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <DNButton id="cta_request_delivery" onClick={() => onNavigate("request")} size="lg"><Truck className="h-4 w-4" /> {t.home.bookDelivery}</DNButton>
              <DNButton id="cta_view_pricing" onClick={() => onNavigate("pricing")} variant="secondary" size="lg"><ClipboardCheck className="h-4 w-4 text-brand-gold" /> {t.home.getEstimate}</DNButton>
              <a id="cta_whatsapp_home" href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-lg"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map((stat) => <DNStat key={stat.value} value={stat.value} label={stat.label} tone={stat.tone} />)}</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <DNCard premium className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className={isArabic ? "text-right" : "text-left"}><DNBadge tone="blue"><MapPin className="h-3.5 w-3.5" /> {t.pricingWidget.title}</DNBadge><p className="mt-3 text-sm font-bold leading-7 text-white/55">{t.pricingWidget.description}</p></div>
                <Premium3DIcon icon={Package} color="gold" size="lg" animate />
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DNSelect value={estimateFrom} onChange={(e) => setEstimateFrom(e.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</DNSelect>
                <DNSelect value={estimateTo} onChange={(e) => setEstimateTo(e.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</DNSelect>
                <DNInput type="number" value={weight} min="0.5" step="0.5" onChange={(e) => setWeight(e.target.value)} dir="ltr" />
              </div>
              <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-brand-deep/55 p-4">
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-white/60"><span>{tP?.baseRange || "Base"}</span><span className="font-mono text-white" dir="ltr">{baseEstimate ? formatAedRange(baseEstimate.min, baseEstimate.max) : "---"}</span></div>
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-white/60"><span>{tP?.surchargeRange || "Weight"}</span><span className="font-mono text-brand-gold" dir="ltr">{surcharge.min === 0 && surcharge.max === 0 ? "0 AED" : formatAedRange(surcharge.min, surcharge.max)}</span></div>
                <div className="border-t border-white/10 pt-4"><div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3"><span className="text-xs font-black uppercase text-white/55">{tP?.totalRange || "Total"}</span><span className="text-xl font-black text-brand-gold" dir="ltr">{totalEstimate ? formatAedRange(totalEstimate.min, totalEstimate.max) : "---"}</span></div></div>
              </div>
            </DNCard>
          </motion.div>
        </div>
      </section>
      <WorldClock />
      <UAEInteractiveMap />
      <TestimonialCarousel />
    </div>
  );
}
