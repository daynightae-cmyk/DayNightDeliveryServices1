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
  BadgeCheck 
} from "lucide-react";

import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import { cities, getQuickEstimate, getWeightSurcharge } from "../data/pricingEstimate";
import { useState } from "react";
import TestimonialCarousel from "./home/TestimonialCarousel";

interface HomeProps {
  onNavigate: (tab: string) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const { language } = useAppContext();
  const t = translations[language];
  const tP = t.pricingWeight;
  const [estimateFrom, setEstimateFrom] = useState(cities[1]);
  const [estimateTo, setEstimateTo] = useState(cities[0]);
  const [weight, setWeight] = useState<number | string>("");

  const baseEstimate = getQuickEstimate(estimateFrom, estimateTo);
  const surcharge = getWeightSurcharge(weight);

  const totalEstimate = baseEstimate ? {
    min: baseEstimate.min + surcharge.min,
    max: baseEstimate.max + surcharge.max,
  } : null;

  function formatAedRange(min: number, max: number) {
    if (language === "ar") {
      return min === max ? `${min} درهم` : `من ${min} إلى ${max} درهم`;
    }
    return min === max ? `${min} AED` : `${min} to ${max} AED`;
  }

  const strengths = [
    {
      icon: <Clock className="w-6 h-6 text-amber-500" />,
      title_ar: "على مدار 24 ساعة",
      title_en: "24/7 Service",
      desc_ar: "اسم DAY NIGHT يعبر عن مفهوم الخدمة المستمرة في النهار والليل لتلبية احتياجاتك.",
      desc_en: "Operating continuously day and night, ready to handle regular or urgent logistics."
    },
    {
      icon: <MapPin className="w-6 h-6 text-amber-500" />,
      title_ar: "تغطية شاملة داخل الدولة",
      title_en: "Wide Coverage",
      desc_ar: "نغطي جميع إمارات الدولة والمدن الرئيسية بالإضافة لمناطق العين والمنطقة الغربية.",
      desc_en: "Serving Abu Dhabi, Dubai, Sharjah, RAK, Ajman, Fujairah, Al Ain, and Western Region."
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title_ar: "توصيل سريع وآمن",
      title_en: "Swift & Secure",
      desc_ar: "شحنتك بأمان واحترافية من الباب إلى الباب مع أسرع زمن استجابة وأمان تام.",
      desc_en: "Pristine door-to-door delivery with the highest care for documents and packages."
    },
    {
      icon: <Store className="w-6 h-6 text-amber-500" />,
      title_ar: "دعم المتاجر الإلكترونية",
      title_en: "E-Commerce Solutions",
      desc_ar: "شريكك اللوجستي الموثوق مع دعم كامل للدفع عند الاستلام COD وتأكيد سريع للبيانات.",
      desc_en: "Full support for Shopify, Instagram, and TikTok shops with Cash on Delivery options."
    }
  ];

  const valueAesthetics = [
    { title: "السرعة", subtitle: "Speed", desc: "نصل في الموعد بكل أمان." },
    { title: "الأمان", subtitle: "Security", desc: "كل شحنة هي أمانة نلتزم بصونها." },
    { title: "الشفافية", subtitle: "Transparency", desc: "أسعار واضحة ومدروسة بدون تعقيد." },
    { title: "الالتزام", subtitle: "Commitment", desc: "خدمتكم هي غايتنا ومحور عملنا اليومي." }
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-cool/40 backdrop-blur-md text-white py-16 px-6 sm:px-12 border border-white/10">
        {/* Decorative Background Glows from Design */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-blue opacity-15 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-xs text-brand-gold font-bold uppercase tracking-widest mb-2"
          >
            <BadgeCheck className="w-4 h-4 text-brand-gold" />
            <span>UAE Certified Delivery • داي نايت لخدمات التوصيل</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight"
          >
            {t.home.heroTitle} <br />
            <span className="text-brand-blue font-black tracking-normal">
              {language === 'ar' ? "داخل الإمارات وخارجها" : "Across the UAE & Beyond"}
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/70 text-lg max-w-2xl mx-auto leading-relaxed font-light"
          >
            {t.home.heroSubtitle}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3 pt-4"
          >
            <button 
              id="cta_request_delivery"
              onClick={() => onNavigate("request")}
              className="px-6 py-3.5 bg-brand-gold text-brand-deep font-extrabold rounded-xl shadow-lg shadow-brand-gold/10 hover:shadow-brand-gold/20 hover:scale-105 hover:bg-brand-blue hover:text-white transition-all cursor-pointer flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              <span>{t.home.bookDelivery}</span>
            </button>
            <button 
              id="cta_view_pricing"
              onClick={() => onNavigate("pricing")}
              className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-brand-gold font-bold rounded-xl border border-white/10 hover:border-brand-gold/50 hover:scale-105 transition-all cursor-pointer flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4 text-brand-gold" />
              <span>{t.home.trackShipment}</span>
            </button>
            <a 
              id="cta_whatsapp_home"
              href="https://wa.me/971568757331" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4 text-white" />
              <span>تواصل عبر واتساب</span>
            </a>
            <a 
              id="cta_whatsapp_catalog_home"
              href="https://wa.me/c/971568757331" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-white" />
              <span>عرض كتالوج واتساب / View WhatsApp Catalog</span>
            </a>
          </motion.div>

          <div className="pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-6 text-center max-w-3xl mx-auto">
            <div>
              <p className="text-3xl font-black text-brand-gold font-mono">24/7</p>
              <p className="text-xs text-white/50 font-medium">توصيل مستمر ليل نهار</p>
            </div>
            <div>
              <p className="text-3xl font-black text-brand-gold font-mono">30 AED</p>
              <p className="text-xs text-white/50 font-medium font-sans">سعر موحد للمدن الرئيسية</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-3xl font-black text-brand-gold font-mono">100%</p>
              <p className="text-xs text-white/50 font-medium">أمان في التعامل والضمان</p>
            </div>
          </div>
          
          {/* Real-time quick price estimator widget */}
          <div className="mt-8 bg-brand-deep/80 rounded-2xl border border-white/10 p-5 max-w-2xl mx-auto rtl:text-right ltr:text-left hover:border-brand-gold/30 transition-colors shadow-2xl relative overflow-hidden group">
             <div className={`absolute top-0 ${language === 'ar' ? 'right-0' : 'left-0'} w-2 h-full bg-brand-gold`}></div>
             <p className={`text-white font-bold mb-3 flex items-center gap-2 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
               {language === 'en' && <MapPin className="w-4 h-4 text-brand-gold" />}
               {t.pricingWidget.title}
               {language === 'ar' && <MapPin className="w-4 h-4 text-brand-gold" />}
             </p>
             <p className="text-white/60 text-xs mb-4">{t.pricingWidget.description}</p>
             <div className="flex flex-col sm:flex-row items-center gap-3">
               <div className="w-full flex gap-2">
                 <select value={estimateFrom} onChange={(e) => setEstimateFrom(e.target.value)} className="w-full bg-brand-cool/50 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:border-brand-gold outline-none">
                   <option value="" disabled>{t.pricingWidget.pickupCity}</option>
                   {cities.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 <select value={estimateTo} onChange={(e) => setEstimateTo(e.target.value)} className="w-full bg-brand-cool/50 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:border-brand-gold outline-none">
                   <option value="" disabled>{t.pricingWidget.deliveryCity}</option>
                   {cities.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
               
               <div className="w-full sm:w-1/3 shrink-0">
                 <input 
                   type="number" 
                   value={weight}
                   onChange={(e) => setWeight(e.target.value)}
                   placeholder={tP?.enterWeight || "Enter weight in kg"}
                   className="w-full bg-brand-cool/50 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:border-brand-gold outline-none"
                   min="0.5"
                   step="0.5"
                 />
               </div>
             </div>

             {/* Dynamic Cost Info */}
             <div className={`mt-4 pt-4 border-t border-white/10 flex flex-col space-y-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
               <div className="flex justify-between items-center text-xs text-white/70">
                 <span>{tP?.baseRange || "Base estimated range:"}</span>
                 <span className="font-mono" dir="ltr">{baseEstimate ? formatAedRange(baseEstimate.min, baseEstimate.max) : "---"}</span>
               </div>
               <div className="flex justify-between items-center text-xs text-white/70">
                 <span>{tP?.surchargeRange || "Weight surcharge estimate:"}</span>
                 <span className="font-mono text-brand-gold" dir="ltr">{surcharge.min === 0 && surcharge.max === 0 ? (language === "ar" ? "0 درهم" : "0 AED") : formatAedRange(surcharge.min, surcharge.max)}</span>
               </div>
             </div>

             <div className="mt-4 bg-brand-cool border border-brand-gold/20 rounded-lg px-6 py-3 flex justify-between items-center">
                 <p className="text-xs text-white/50 uppercase">{tP?.totalRange || "Estimated total range:"}</p>
                 <p className="text-brand-gold font-bold font-mono text-base">
                   {totalEstimate ? formatAedRange(totalEstimate.min, totalEstimate.max) : "---"}
                 </p>
             </div>
             
             {surcharge.needsCustomQuote && (
               <p className={`mt-3 text-brand-gold text-xs italic ${language === 'ar' ? 'text-right' : 'text-left'}`}>{tP?.customQuote}</p>
             )}
             
             <p className={`mt-2 text-white/40 text-[10px] ${language === 'ar' ? 'text-right' : 'text-left'}`}>{tP?.disclaimer}</p>

             <div className={`mt-4 ${language === 'ar' ? 'text-left' : 'text-right'}`}>
                <button onClick={() => onNavigate("pricing")} className="text-xs text-brand-blue hover:text-brand-gold underline font-bold transition-colors">{t.pricingWidget.continueBooking} &rarr;</button>
             </div>
          </div>
        </div>
      </section>

      {/* Main Pitch & Strengths */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-block bg-brand-blue/15 text-brand-blue text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider border border-brand-blue/35">
            ميزات ريادية • Dynamic Benefits
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">راحة بالك وأولويتك هي نجاحنا</h2>
          <p className="text-white/60">
            DAY NIGHT هي رفيقتك في تيسير أعمالك اليومية، نعتني بكل شحنة من لحظة الاستلام وتوثيقها وحتى التسليم النهائي للزبون بأرفع معايير الخدمة.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {strengths.map((s, index) => (
            <motion.div
              id={`strength_card_${index}`}
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl hover:border-brand-gold/50 hover:shadow-2xl hover:shadow-brand-gold/5 transition-all duration-300 group flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-brand-gold/25 transition-colors">
                  {/* Map Pin or Icon color fix */}
                  <span className="text-brand-gold">
                    {s.icon}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-brand-gold transition-colors">{s.title_ar}</h3>
                  <p className="text-xs text-white/40 font-bold font-mono uppercase">{s.title_en}</p>
                  <p className="text-white/70 text-sm leading-relaxed">{s.desc_ar}</p>
                  <p className="text-white/40 text-xs leading-relaxed italic">{s.desc_en}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Brand Values Grid */}
      <section className="bg-brand-cool/30 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-white/10 space-y-10">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">القيم الأساسية التي تميز داي نايت</h2>
          <p className="text-white/60">
            لا يقتصر عملنا على نقل الطرود، بل نسعى لإنشاء تجربة متكاملة تتسم بالأمان، والدقة، والشفافية لصاحب المتجر والعميل النهائي.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {valueAesthetics.map((v, idx) => (
            <div id={`value_card_${idx}`} key={idx} className="bg-white/5 p-6 rounded-xl border border-white/10 shadow-lg space-y-2 hover:border-brand-blue/50 transition-all duration-300">
              <span className="text-brand-gold font-mono font-black text-lg">0{idx + 1}</span>
              <h4 className="text-lg font-bold text-white">{v.title}</h4>
              <p className="text-xs text-white/40 font-mono tracking-wider">{v.subtitle}</p>
              <p className="text-white/70 text-sm">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial Carousel */}
      <TestimonialCarousel />

      {/* Visual Campaign Banner */}
      <section className="bg-gradient-to-br from-brand-cool via-brand-deep to-brand-cool rounded-3xl p-8 border border-white/10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-brand-blue opacity-10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="space-y-4 relative z-10 max-w-xl text-right">
          <span className="text-brand-gold font-mono uppercase font-bold tracking-widest text-xs">Official Delivery Fleet</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">أسطولنا يغطي جميع أحياء مصفح وأبوظبي وجميع الإمارات</h2>
          <p className="text-white/70 text-sm leading-relaxed">
            تم تجهيز أسطول داي نايت الحديث (Toyota Rush وسيارات النقل الأبيض المعتمد) لضمان تسليم الشحنات الحساسة والأوراق والمستندات الرسمية بسلامة وضبط تامين.
          </p>
          <div className="flex justify-end gap-4">
            <button 
              id="cta_explore_uae"
              onClick={() => onNavigate("suburbs")}
              className="text-brand-gold font-semibold text-sm hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>بيان مناطق التغطية بالتفصيل</span>
              <ExternalLink className="w-4 h-4 text-brand-gold" />
            </button>
          </div>
        </div>
        <div className="w-full md:w-auto relative flex justify-center z-10">
          <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 max-w-sm shrink-0">
            <h4 className="text-brand-gold font-bold mb-2 text-sm border-b border-white/10 pb-2 text-right">سريع • موثوق • في كل مرة</h4>
            <p className="text-white/80 text-xs italic leading-relaxed text-right">
              "لقد تغير أداء متجري الإلكتروني بشكل مذهل بعد تعاقدي مع داي نايت للتوصيل. نسبة تسليم الطرود والـ Cash on Delivery ممتازة وسريعة للغاية."
            </p>
            <p className="text-brand-gold text-[10px] font-mono mt-3 text-left">— متجر ياسمين عطور، الإمارات</p>
          </div>
        </div>
      </section>
    </div>
  );
}
