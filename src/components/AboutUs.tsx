/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { BadgeCheck, Target, Heart, Eye } from "lucide-react";

export default function AboutUs() {
  const sections = [
    {
      icon: <Eye className="w-8 h-8 text-amber-500" />,
      title_ar: "رؤيتنا",
      title_en: "Our Vision",
      desc_ar: "أن تصبح DAY NIGHT لخدمات التوصيل والشحن واحدة من أكثر شركات اللوجستيات ثقة وانتشاراً في دولة الإمارات، والبديل الأسرع والأكثر شفافية للأفراد والمتاجر والشركات.",
      desc_en: "To emerge as the premier, elite courier and shipping authority in the UAE, known for absolute trust, rapid response, smart dispatch, and flawless customer focus."
    },
    {
      icon: <Target className="w-8 h-8 text-amber-500" />,
      title_ar: "رسالتنا",
      title_en: "Our Mission",
      desc_ar: "تقديم خدمات شحن وتوصيل محلية ودولية بأساليب مرنة ومبتكرة تضع في صميمها الأمان والسرعة والتواصل السلس والدقيق على مدار الساعة.",
      desc_en: "To unify shipping, packaging, courier, and direct storage workflows into an impeccable 24/7 client-centric framework with unmatched transit speeds and security."
    },
    {
      icon: <Heart className="w-8 h-8 text-amber-500" />,
      title_ar: "أهدافنا",
      title_en: "Our Objectives",
      desc_ar: "أن نوفر لكل شخص ومؤسسة شريك توصيل متكامل يمكن الاعتماد عليه في كل وقت وفي كل مكان، مع تقديم أسعار عادلة وحلول مدفوعة بالتكنولوجيا الفعالة.",
      desc_en: "To bridge the gap between businesses and end consumers by providing secure transits, guaranteed COD turnarounds, and instant direct updates."
    }
  ];

  return (
    <div className="space-y-12 text-right">
      {/* Intro section */}
      <section className="bg-brand-cool/40 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-white/10 flex flex-col lg:flex-row items-center gap-12">
        <div className="space-y-6 lg:w-1/2">
          <div className="inline-flex items-center gap-1.5 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-3 py-1 text-xs text-brand-gold font-bold uppercase">
            <BadgeCheck className="w-4 h-4 text-brand-gold" />
            <span>نبذة عن الشركة • Corporate Story</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            داي نايت لخدمات التوصيل والشحن
          </h2>
          <p className="text-white/70 leading-relaxed text-sm sm:text-base">
            شركة إماراتية متميزة متخصصة في خدمات التوصيل، الشحن، النقل والكورير داخل دولة الإمارات وخارجها. نقدم حلولاً لوجستية مرنة تخدم الأفراد والشركات والمتاجر الإلكترونية على حد سواء. نعمل بجد وإخلاص طوال ساعات الليل والنهار لتوفير تجربة توصيل فريدة ومنظمة تبدأ من استلام الطلب، تدوينه، تأكيد البيانات والسعر، ثم المتابعة حتى التسليم النهائي بكل أمان وبأسعار نموذجية واضحة.
          </p>
          <p className="text-white/50 text-sm leading-relaxed italic border-r-4 border-brand-gold pr-4">
            "نحن نؤمن بأن كل طرد أو مستند أو هدية لها قيمة معنوية أو تجارية بالغة عند صاحبها، لذا فإننا نتعامل مع كل طلب بعناية فائقة واحترافية من اللحظة الأولى للاتصال الهاتفي أو رسالة الواتساب وحتى توقيع الإغلاق النهائي."
          </p>
        </div>
        <div className="lg:w-1/2 w-full">
          {/* Aesthetic grid presenting operational layout */}
          <div className="bg-brand-cool rounded-2xl p-8 border border-white/10 space-y-6">
            <h3 className="text-brand-gold font-bold text-lg border-b border-white/10 pb-3">البطاقة الرسمية للنشاط</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-sans">
              <div className="p-3 bg-brand-deep/55 rounded-lg border border-white/10">
                <p className="text-white/40 text-xs">الاسم الرسمي</p>
                <p className="font-bold text-white mt-1">DAY NIGHT DELIVERY SERVICES</p>
              </div>
              <div className="p-3 bg-brand-deep/55 rounded-lg border border-white/10">
                <p className="text-white/40 text-xs font-mono">الاسم التجاري العربي</p>
                <p className="font-bold text-white mt-1">داي نايت لخدمات التوصيل</p>
              </div>
              <div className="p-3 bg-brand-deep/55 rounded-lg border border-white/10">
                <p className="text-white/40 text-xs font-sans">المقر الرئيسي</p>
                <p className="font-bold text-white mt-1">الإمارات • أبوظبي • مصفح 40</p>
              </div>
              <div className="p-3 bg-brand-deep/55 rounded-lg border border-white/10">
                <p className="text-white/40 text-xs">نطاق التغطية</p>
                <p className="font-bold text-white mt-1">كافة إمارات الدولة والشحن الدولي</p>
              </div>
            </div>
            <div className="bg-brand-deep/85 p-4 rounded-xl border border-white/10 text-center">
              <p className="text-brand-gold text-xs font-mono tracking-wider font-bold">SLOGANS</p>
              <p className="text-white text-base font-bold mt-1">DELIVERY SERVICE 24/7</p>
              <p className="text-white/75 text-xs italic mt-0.5">Swift • Secure • Exceptional | سرعة • أمان • تميز</p>
            </div>
          </div>
        </div>
      </section>

      {/* Rationale & Vision cards with motion */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((sec, idx) => (
          <motion.div
            id={`about_sec_${idx}`}
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="bg-brand-cool/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col justify-between hover:scale-103 hover:border-brand-gold/40 hover:shadow-xl transition-all"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-lg bg-brand-gold/15 flex items-center justify-center">
                <span className="text-brand-gold">
                  {sec.icon}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">{sec.title_ar}</h3>
                <h4 className="text-xs text-brand-gold font-bold font-mono uppercase tracking-wider">{sec.title_en}</h4>
                <p className="text-white/70 text-sm leading-relaxed">{sec.desc_ar}</p>
                <p className="text-white/40 text-xs leading-relaxed italic">{sec.desc_en}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
