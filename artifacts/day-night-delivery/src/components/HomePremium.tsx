import { useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Calculator, ClipboardCheck, MapPin, MessageCircle, Package, ShieldCheck, Truck, Zap } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import { cities, getQuickEstimate, getWeightSurcharge } from "../data/pricingEstimate";
import TestimonialCarousel from "./home/TestimonialCarousel";
import UAEInteractiveMap from "./home/UAEInteractiveMap";
import WorldClock from "./home/WorldClock";
import Premium3DIcon from "./ui/Premium3DIcon";
import { DNBadge, DNButton, DNCard, DNInput, DNSelect } from "./ui/DNDesignSystem";
import companyMeta from "../data/companyMeta";

type HomePremiumProps = { onNavigate: (tab: string) => void };

const heroPosterUrl = "https://i.postimg.cc/cJ7MbD6R/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(10).png";

export default function HomePremium({ onNavigate }: HomePremiumProps) {
  const { language } = useAppContext();
  const t = translations[language];
  const tP = t.pricingWeight;
  const isArabic = language === "ar";
  const [estimateFrom, setEstimateFrom] = useState(cities[1]);
  const [estimateTo, setEstimateTo] = useState(cities[0]);
  const [weight, setWeight] = useState<number | string>("1");

  const baseEstimate = getQuickEstimate(estimateFrom, estimateTo);
  const surcharge = getWeightSurcharge(weight);
  const totalEstimate = baseEstimate ? { min: baseEstimate.min + surcharge.min, max: baseEstimate.max + surcharge.max } : null;

  function formatAedRange(min: number, max: number) {
    if (language === "ar") return min === max ? `${min} درهم` : `${min}-${max} درهم`;
    return min === max ? `${min} AED` : `${min}-${max} AED`;
  }

  const stats = [
    { icon: Zap, value: "24/7", title: isArabic ? "خدمة على مدار الساعة" : "Around the clock", body: isArabic ? "طوال أيام الأسبوع" : "Every day of the week" },
    { icon: Calculator, value: "30 AED", title: isArabic ? "تبدأ الأسعار من" : "Prices start from", body: isArabic ? "للمدن الرئيسية" : "Main UAE cities" },
    { icon: MapPin, value: "7+", title: isArabic ? "إمارات مغطاة" : "Emirates covered", body: isArabic ? "تغطية شاملة" : "Full UAE coverage" },
    { icon: ShieldCheck, value: "100%", title: isArabic ? "أمان وثقة" : "Safe and trusted", body: isArabic ? "فريق محترف" : "Professional team" },
  ];

  return (
    <div className="space-y-10 sm:space-y-14" dir={isArabic ? "rtl" : "ltr"}>
      <section className="dn-poster-hero relative overflow-hidden rounded-[2.3rem] border px-5 pb-7 pt-10 sm:px-8 lg:px-10 lg:pt-12">
        <img src={heroPosterUrl} alt="" aria-hidden="true" className="dn-hero-poster-img pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,18,38,0.92),rgba(3,18,38,0.78),rgba(3,18,38,0.92))]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(25,167,255,0.22),transparent_62%)]" />

        <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.92fr_1.18fr_0.9fr] lg:items-center">
          <motion.div initial={{ opacity: 0, x: isArabic ? 24 : -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }} className="order-2 lg:order-1">
            <div className="relative mx-auto aspect-[1.18/1] max-w-[520px] overflow-hidden rounded-[2rem] border border-brand-sky/20 bg-brand-deep/45 shadow-2xl shadow-brand-sky/10 lg:mx-0">
              <img src={heroPosterUrl} alt="DAY NIGHT UAE delivery coverage" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#031226] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-brand-gold/25 bg-[#031226]/76 p-3 text-center text-xs font-black text-brand-gold backdrop-blur-xl">
                {isArabic ? "نصل إليك في كل وقت" : "Fast • Reliable • Every Time"}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className={`order-1 text-center lg:order-2 ${isArabic ? "lg:text-right" : "lg:text-left"}`}>
            <DNBadge tone="gold" className="mx-auto mb-5 lg:mx-0"><BadgeCheck className="h-4 w-4" /> {isArabic ? "خدمة احترافية على مدار الساعة" : "Premium 24/7 logistics"}</DNBadge>
            <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:mx-0">
              {isArabic ? "توصيل سريع وموثوق" : "Fast, reliable delivery"}
              <span className="mt-2 block text-brand-gold">{isArabic ? "داخل الإمارات والعالم" : "Across UAE & Beyond"}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-bold leading-8 text-white/68 sm:text-base lg:mx-0">
              {t.home.heroSubtitle}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <DNButton id="cta_request_delivery" onClick={() => onNavigate("request")} size="lg"><Truck className="h-4 w-4" /> {t.home.bookDelivery}</DNButton>
              <DNButton id="cta_view_pricing" onClick={() => onNavigate("pricing")} variant="secondary" size="lg"><ClipboardCheck className="h-4 w-4 text-brand-gold" /> {t.home.getEstimate}</DNButton>
              <a id="cta_whatsapp_home" href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-lg"><MessageCircle className="h-4 w-4" /> {isArabic ? "واتساب" : "WhatsApp"}</a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: isArabic ? -24 : 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.58, delay: 0.08 }} className="order-3">
            <DNCard premium className="mx-auto max-w-[470px] p-5 sm:p-6 lg:mx-0">
              <div className="flex items-center justify-between gap-4">
                <div className={isArabic ? "text-right" : "text-left"}>
                  <DNBadge tone="blue"><Calculator className="h-3.5 w-3.5" /> {isArabic ? "احسب سعر شحنتك" : "Estimate your shipment"}</DNBadge>
                  <p className="mt-3 text-sm font-bold leading-7 text-white/55">{t.pricingWidget.description}</p>
                </div>
                <Premium3DIcon icon={Package} color="gold" size="md" animate />
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1"><span className="text-xs font-black text-white/50">{isArabic ? "من" : "From"}</span><DNSelect value={estimateFrom} onChange={(e) => setEstimateFrom(e.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</DNSelect></label>
                <label className="space-y-1"><span className="text-xs font-black text-white/50">{isArabic ? "إلى" : "To"}</span><DNSelect value={estimateTo} onChange={(e) => setEstimateTo(e.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</DNSelect></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-black text-white/50">{tP?.enterWeight || (isArabic ? "الوزن بالكجم" : "Weight in kg")}</span><DNInput type="number" value={weight} min="0.5" step="0.5" onChange={(e) => setWeight(e.target.value)} dir="ltr" /></label>
              </div>
              <div className="mt-5 rounded-2xl border border-brand-gold/35 bg-[#020914]/62 p-5 text-center">
                <p className="text-xs font-black text-white/52">{tP?.totalRange || (isArabic ? "السعر التقديري" : "Estimated total")}</p>
                <p className="mt-2 text-4xl font-black text-brand-gold" dir="ltr">{totalEstimate ? formatAedRange(totalEstimate.min, totalEstimate.max) : "---"}</p>
                <p className="mt-2 text-[11px] font-bold text-white/38">{tP?.disclaimer}</p>
              </div>
              <button onClick={() => onNavigate("pricing")} className="dn-btn dn-btn-primary dn-btn-lg mt-4 w-full">{isArabic ? "احسب السعر بالتفصيل" : "Calculate full price"}</button>
            </DNCard>
          </motion.div>
        </div>

        <div className="relative z-10 mt-7 grid grid-cols-1 gap-3 rounded-[1.5rem] border border-brand-sky/20 bg-[#020914]/58 p-3 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, title, body }) => (
            <div key={value} className={`flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 ${isArabic ? "flex-row-reverse text-right" : "text-left"}`}>
              <Icon className="h-9 w-9 shrink-0 text-brand-gold" />
              <div><p className="text-2xl font-black text-brand-gold" dir="ltr">{value}</p><p className="text-sm font-black text-white">{title}</p><p className="text-xs font-bold text-white/48">{body}</p></div>
            </div>
          ))}
        </div>
      </section>
      <WorldClock />
      <UAEInteractiveMap />
      <TestimonialCarousel />
    </div>
  );
}
