/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import {
  Truck,
  ShieldCheck,
  Clock,
  MapPin,
  ExternalLink,
  PhoneCall,
  Zap,
  Store,
  ClipboardCheck,
  BadgeCheck,
  MessageCircle,
  Star,
  Package,
  Globe,
} from "lucide-react";

import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import { cities, getQuickEstimate, getWeightSurcharge } from "../data/pricingEstimate";
import { useState } from "react";
import TestimonialCarousel from "./home/TestimonialCarousel";
import UAEInteractiveMap from "./home/UAEInteractiveMap";
import WorldClock from "./home/WorldClock";
import Premium3DIcon from "./ui/Premium3DIcon";
import companyMeta from "../data/companyMeta";

interface HomeProps {
  onNavigate: (tab: string) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const tP = t.pricingWeight;
  const isLight = theme === "light";
  const isArabic = language === "ar";
  const [estimateFrom, setEstimateFrom] = useState(cities[1]);
  const [estimateTo, setEstimateTo] = useState(cities[0]);
  const [weight, setWeight] = useState<number | string>("");

  const baseEstimate = getQuickEstimate(estimateFrom, estimateTo);
  const surcharge = getWeightSurcharge(weight);

  const totalEstimate = baseEstimate
    ? { min: baseEstimate.min + surcharge.min, max: baseEstimate.max + surcharge.max }
    : null;

  function formatAedRange(min: number, max: number) {
    if (language === "ar") {
      return min === max ? `${min} درهم` : `من ${min} إلى ${max} درهم`;
    }
    return min === max ? `${min} AED` : `${min}–${max} AED`;
  }

  const strengths = [
    {
      icon: Clock,
      color: "gold" as const,
      title_ar: "على مدار 24 ساعة",
      title_en: "24/7 Service",
      desc_ar: "نعمل ليل نهار لتلبية احتياجاتك في التوصيل بأسرع وقت ممكن.",
      desc_en: "Operating continuously day and night, handling regular or urgent logistics.",
    },
    {
      icon: MapPin,
      color: "blue" as const,
      title_ar: "تغطية شاملة داخل الدولة",
      title_en: "Wide UAE Coverage",
      desc_ar: "نغطي جميع إمارات الدولة والمدن الرئيسية بالإضافة لمناطق العين والمنطقة الغربية.",
      desc_en: "Serving Abu Dhabi, Dubai, Sharjah, RAK, Ajman, Fujairah, Al Ain & Western Region.",
    },
    {
      icon: Zap,
      color: "sky" as const,
      title_ar: "توصيل سريع وآمن",
      title_en: "Swift & Secure",
      desc_ar: "شحنتك بأمان واحترافية من الباب إلى الباب مع أسرع زمن استجابة وأمان تام.",
      desc_en: "Pristine door-to-door delivery with the highest care for documents and packages.",
    },
    {
      icon: Store,
      color: "green" as const,
      title_ar: "دعم المتاجر الإلكترونية",
      title_en: "E-Commerce Solutions",
      desc_ar: "شريكك اللوجستي مع دعم كامل للدفع عند الاستلام COD وتأكيد سريع للبيانات.",
      desc_en: "Full support for Shopify, Instagram, TikTok shops with Cash on Delivery.",
    },
  ];

  const stats = [
    { value: "24/7", label_ar: "توصيل ليل نهار", label_en: "Non-stop Delivery" },
    { value: "30 AED", label_ar: "سعر موحد للمدن الرئيسية", label_en: "Main Cities Flat Rate" },
    { value: "7+", label_ar: "إمارات مغطاة", label_en: "Emirates Covered" },
    { value: "100%", label_ar: "أمان مضمون", label_en: "Guaranteed Safety" },
  ];

  const valueAesthetics = [
    { title: "السرعة", subtitle: "Speed", desc: "نصل في الموعد بكل أمان." },
    { title: "الأمان", subtitle: "Security", desc: "كل شحنة هي أمانة نلتزم بصونها." },
    { title: "الشفافية", subtitle: "Transparency", desc: "أسعار واضحة ومدروسة بدون تعقيد." },
    { title: "الالتزام", subtitle: "Commitment", desc: "خدمتكم هي غايتنا ومحور عملنا اليومي." },
  ];

  const txt = isLight ? "text-[#071A33]" : "text-white";
  const txtMuted = isLight ? "text-[#071A33]/60" : "text-white/60";
  const txtFaint = isLight ? "text-[#071A33]/40" : "text-white/40";
  const borderFaint = isLight ? "border-[#071A33]/10" : "border-white/10";
  const cardBg = isLight ? "bg-white/60 border-[#071A33]/10" : "bg-white/5 border-white/10";

  return (
    <div className="space-y-14 sm:space-y-20">

      {/* ═══════════════════════════════════════════════
          HERO SECTION
         ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl border py-14 sm:py-20 px-6 sm:px-12 bg-grid-pattern"
        style={{
          background: isLight
            ? "linear-gradient(145deg, rgba(232,242,255,0.9) 0%, rgba(245,250,255,0.95) 100%)"
            : "linear-gradient(145deg, rgba(10,28,58,0.85) 0%, rgba(7,26,51,0.95) 100%)",
          borderColor: isLight ? "rgba(7,26,51,0.10)" : "rgba(255,255,255,0.08)",
        }}
      >
        {/* Floating glows */}
        <div className="glow-orb w-[380px] h-[380px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ background: "rgba(0,123,255,0.12)" }} />
        <div className="glow-orb w-64 h-64 top-0 right-0 opacity-60"
          style={{ background: "rgba(212,175,55,0.08)", animationDelay: "2s" }} />
        <div className="glow-orb w-48 h-48 bottom-0 left-10 opacity-40"
          style={{ background: "rgba(24,168,232,0.10)", animationDelay: "4s" }} />

        {/* Top background grid overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none rounded-3xl" />

        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-8">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/25 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
          >
            <BadgeCheck className="w-4 h-4 text-brand-gold" />
            <span className="text-brand-gold">UAE Certified Delivery • داي نايت لخدمات التوصيل</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight ${txt}`}
          >
            {t.home.heroTitle}
            <br />
            <span className="text-brand-blue">
              {isArabic ? "داخل الإمارات وخارجها" : "Across the UAE & Beyond"}
            </span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`text-lg max-w-2xl mx-auto leading-relaxed font-light ${txtMuted}`}
          >
            {t.home.heroSubtitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3"
          >
            <button
              id="cta_request_delivery"
              onClick={() => onNavigate("request")}
              className="btn-gold px-6 py-3.5 rounded-xl font-extrabold flex items-center gap-2 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>{t.home.bookDelivery}</span>
            </button>

            <button
              id="cta_view_pricing"
              onClick={() => onNavigate("pricing")}
              className={`btn-glass px-6 py-3.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer ${
                isLight ? "text-[#071A33] border-[#071A33]/20" : "text-brand-gold"
              }`}
            >
              <ClipboardCheck className="w-4 h-4 text-brand-gold" />
              <span>{t.home.getEstimate}</span>
            </button>

            <a
              id="cta_whatsapp_home"
              href={companyMeta.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp px-6 py-3.5 rounded-xl font-bold flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{isArabic ? "تواصل عبر واتساب" : "Chat WhatsApp"}</span>
            </a>

            <a
              id="cta_whatsapp_catalog_home"
              href={companyMeta.whatsappCatalog}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(245,183,0,0.15) 0%, rgba(212,175,55,0.08) 100%)",
                border: "1px solid rgba(212,175,55,0.30)",
                color: "#D4AF37",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">{isArabic ? "كتالوج واتساب" : "WhatsApp Catalog"}</span>
            </a>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className={`pt-8 border-t grid grid-cols-2 sm:grid-cols-4 gap-6 text-center ${borderFaint}`}
          >
            {stats.map((s, i) => (
              <div key={i} className="space-y-1">
                <p className="text-2xl sm:text-3xl font-black text-brand-gold font-mono stat-number" dir="ltr">
                  {s.value}
                </p>
                <p className={`text-[11px] font-medium ${txtFaint}`}>
                  {isArabic ? s.label_ar : s.label_en}
                </p>
              </div>
            ))}
          </motion.div>

          {/* Quick estimate widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className={`rounded-2xl border p-5 max-w-2xl mx-auto text-left overflow-hidden relative group transition-colors ${
              isLight
                ? "bg-white/75 border-[#071A33]/10 hover:border-brand-gold/40"
                : "bg-brand-deep/80 border-white/10 hover:border-brand-gold/30"
            }`}
          >
            {/* Gold accent strip */}
            <div className={`absolute top-0 ${isArabic ? "right-0" : "left-0"} w-1 h-full bg-brand-gold rounded-full`} />

            <div className={`flex items-center gap-2 mb-3 ${isArabic ? "flex-row-reverse text-right" : ""}`}>
              <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
              <p className={`font-bold text-sm ${txt}`}>{t.pricingWidget.title}</p>
            </div>
            <p className={`text-xs mb-4 ${isArabic ? "text-right" : ""} ${txtFaint}`}>
              {t.pricingWidget.description}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full flex gap-2">
                <select
                  value={estimateFrom}
                  onChange={(e) => setEstimateFrom(e.target.value)}
                  className={`w-full border rounded-lg p-2.5 text-xs outline-none transition-colors focus:border-brand-gold ${
                    isLight
                      ? "bg-white/80 border-[#071A33]/10 text-[#071A33]"
                      : "bg-brand-cool/50 border-white/10 text-white"
                  }`}
                >
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={estimateTo}
                  onChange={(e) => setEstimateTo(e.target.value)}
                  className={`w-full border rounded-lg p-2.5 text-xs outline-none transition-colors focus:border-brand-gold ${
                    isLight
                      ? "bg-white/80 border-[#071A33]/10 text-[#071A33]"
                      : "bg-brand-cool/50 border-white/10 text-white"
                  }`}
                >
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-1/3 shrink-0">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={tP?.enterWeight || "Weight (kg)"}
                  className={`w-full border rounded-lg p-2.5 text-xs outline-none transition-colors focus:border-brand-gold ${
                    isLight
                      ? "bg-white/80 border-[#071A33]/10 text-[#071A33] placeholder:text-[#071A33]/40"
                      : "bg-brand-cool/50 border-white/10 text-white placeholder:text-white/30"
                  }`}
                  min="0.5"
                  step="0.5"
                />
              </div>
            </div>

            <div className={`mt-4 pt-4 border-t space-y-2 ${borderFaint}`}>
              <div className={`flex justify-between text-xs ${txtMuted}`}>
                <span>{tP?.baseRange || "Base estimate:"}</span>
                <span className="font-mono" dir="ltr">
                  {baseEstimate ? formatAedRange(baseEstimate.min, baseEstimate.max) : "---"}
                </span>
              </div>
              <div className={`flex justify-between text-xs ${txtMuted}`}>
                <span>{tP?.surchargeRange || "Weight surcharge:"}</span>
                <span className="font-mono text-brand-gold" dir="ltr">
                  {surcharge.min === 0 && surcharge.max === 0
                    ? isArabic ? "0 درهم" : "0 AED"
                    : formatAedRange(surcharge.min, surcharge.max)}
                </span>
              </div>
            </div>

            <div className={`mt-4 rounded-xl px-5 py-3 flex justify-between items-center border ${
              isLight
                ? "bg-brand-gold/5 border-brand-gold/20"
                : "bg-brand-cool border-brand-gold/20"
            }`}>
              <p className={`text-xs uppercase font-bold ${txtFaint}`}>
                {tP?.totalRange || "Estimated total:"}
              </p>
              <p className="text-brand-gold font-black font-mono text-lg" dir="ltr">
                {totalEstimate ? formatAedRange(totalEstimate.min, totalEstimate.max) : "---"}
              </p>
            </div>

            {surcharge.needsCustomQuote && (
              <p className={`mt-3 text-brand-gold text-xs italic ${isArabic ? "text-right" : ""}`}>
                {tP?.customQuote}
              </p>
            )}
            <p className={`mt-2 text-[10px] ${isArabic ? "text-right" : ""} ${txtFaint}`}>
              {tP?.disclaimer}
            </p>
            <div className={`mt-4 ${isArabic ? "text-left" : "text-right"}`}>
              <button
                onClick={() => onNavigate("pricing")}
                className="text-xs text-brand-blue hover:text-brand-gold underline font-bold transition-colors"
              >
                {t.pricingWidget.continueBooking} →
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* World Clock */}
      <WorldClock />

      {/* UAE Interactive Map */}
      <UAEInteractiveMap />

      {/* ═══════════════════════════════════════════════
          STRENGTHS — 4-column icon cards
         ═══════════════════════════════════════════════ */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${
            isLight
              ? "bg-brand-blue/10 text-brand-blue border-brand-blue/25"
              : "bg-brand-blue/15 text-brand-blue border-brand-blue/35"
          }`}>
            ميزات ريادية • Dynamic Benefits
          </div>
          <h2 className={`text-3xl font-bold tracking-tight ${txt}`}>
            راحة بالك وأولويتك هي نجاحنا
          </h2>
          <p className={`text-sm leading-relaxed ${txtMuted}`}>
            DAY NIGHT هي رفيقتك في تيسير أعمالك اليومية، نعتني بكل شحنة من لحظة الاستلام وتوثيقها وحتى التسليم النهائي.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {strengths.map((s, index) => (
            <motion.div
              id={`strength_card_${index}`}
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`card-shine glass glass-hover p-6 rounded-2xl flex flex-col gap-4 ${isArabic ? "text-right" : "text-left"}`}
            >
              <Premium3DIcon icon={s.icon} color={s.color} size="md" animate />
              <div className="space-y-1.5">
                <h3 className={`text-base font-bold leading-tight ${txt}`}>
                  {isArabic ? s.title_ar : s.title_en}
                </h3>
                <p className={`text-[10px] font-mono uppercase tracking-wider ${txtFaint}`}>
                  {isArabic ? s.title_en : s.title_ar}
                </p>
                <p className={`text-sm leading-relaxed ${txtMuted}`}>
                  {isArabic ? s.desc_ar : s.desc_en}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          BRAND VALUES
         ═══════════════════════════════════════════════ */}
      <section
        className={`rounded-3xl p-8 sm:p-12 border space-y-10 ${
          isLight
            ? "bg-white/50 border-[#071A33]/10"
            : "bg-brand-cool/30 border-white/10"
        }`}
      >
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <h2 className={`text-3xl font-bold tracking-tight ${txt}`}>
            القيم الأساسية التي تميز داي نايت
          </h2>
          <p className={`text-sm leading-relaxed ${txtMuted}`}>
            لا يقتصر عملنا على نقل الطرود، بل نسعى لإنشاء تجربة متكاملة تتسم بالأمان والدقة والشفافية.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {valueAesthetics.map((v, idx) => (
            <div
              id={`value_card_${idx}`}
              key={idx}
              className={`p-6 rounded-2xl border space-y-2 transition-all duration-300 hover:shadow-xl ${
                isArabic ? "text-right" : "text-left"
              } ${
                isLight
                  ? "bg-white/70 border-[#071A33]/10 hover:border-brand-blue/30"
                  : "bg-white/5 border-white/10 hover:border-brand-blue/50"
              }`}
            >
              <span className="text-brand-gold font-mono font-black text-lg">0{idx + 1}</span>
              <h4 className={`text-lg font-bold ${txt}`}>{v.title}</h4>
              <p className={`text-[10px] font-mono tracking-wider uppercase ${txtFaint}`}>{v.subtitle}</p>
              <p className={`text-sm leading-relaxed ${txtMuted}`}>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial Carousel */}
      <TestimonialCarousel />

      {/* ═══════════════════════════════════════════════
          CAMPAIGN BANNER
         ═══════════════════════════════════════════════ */}
      <section
        className={`rounded-3xl p-8 border relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 ${
          isLight
            ? "bg-gradient-to-br from-[#E8F2FF] via-[#EEF5FF] to-[#E0EAFA] border-[#071A33]/10"
            : "bg-gradient-to-br from-brand-cool via-brand-deep to-brand-cool border-white/10"
        }`}
      >
        <div
          className="glow-orb w-72 h-72 -right-20 -bottom-20 opacity-60"
          style={{ background: "rgba(0,123,255,0.08)" }}
        />

        <div className={`space-y-4 relative z-10 max-w-xl ${isArabic ? "text-right" : "text-left"}`}>
          <span className="text-brand-gold font-mono uppercase font-bold tracking-widest text-xs">
            Official Delivery Fleet
          </span>
          <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${txt}`}>
            أسطولنا يغطي جميع أحياء مصفح وأبوظبي وجميع الإمارات
          </h2>
          <p className={`text-sm leading-relaxed ${txtMuted}`}>
            تم تجهيز أسطول داي نايت الحديث (Toyota Rush وسيارات النقل الأبيض المعتمد) لضمان تسليم الشحنات الحساسة والأوراق والمستندات الرسمية بسلامة وضبط تامين.
          </p>
          <div className={`flex gap-4 ${isArabic ? "justify-end" : ""}`}>
            <button
              id="cta_explore_uae"
              onClick={() => onNavigate("suburbs")}
              className="text-brand-gold font-semibold text-sm hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>بيان مناطق التغطية بالتفصيل</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative flex justify-center z-10 shrink-0">
          <div
            className={`p-6 rounded-2xl border max-w-sm ${
              isLight
                ? "bg-white/70 border-[#071A33]/10"
                : "bg-white/5 backdrop-blur-md border-white/10"
            }`}
          >
            <div className="flex items-center gap-3 mb-3 border-b pb-3 border-brand-gold/20">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-3 h-3 text-brand-gold fill-brand-gold" />
                ))}
              </div>
              <span className={`text-[10px] font-bold ${txtFaint}`}>5/5 عملاء راضون</span>
            </div>
            <p className={`text-xs leading-relaxed italic ${txtMuted}`} dir="rtl">
              "لقد تغير أداء متجري الإلكتروني بشكل مذهل بعد تعاقدي مع داي نايت للتوصيل. نسبة تسليم الطرود والـ Cash on Delivery ممتازة وسريعة للغاية."
            </p>
            <p className="text-brand-gold text-[10px] font-mono mt-3 text-right">
              — متجر ياسمين عطور، الإمارات
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
