import { motion } from "motion/react";
import { BadgeCheck, Target, Heart, Eye } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";

export default function AboutUs() {
  const { language } = useAppContext();
  const t = translations[language].aboutUs;

  const sections = [
    {
      icon: <Eye className="w-8 h-8 text-amber-500" />,
      title_ar: translations.ar.aboutUs.visionTitle,
      title_en: translations.en.aboutUs.visionTitle,
      desc_ar: translations.ar.aboutUs.visionDesc,
      desc_en: translations.en.aboutUs.visionDesc
    },
    {
      icon: <Target className="w-8 h-8 text-amber-500" />,
      title_ar: translations.ar.aboutUs.missionTitle,
      title_en: translations.en.aboutUs.missionTitle,
      desc_ar: translations.ar.aboutUs.missionDesc,
      desc_en: translations.en.aboutUs.missionDesc
    },
    {
      icon: <Heart className="w-8 h-8 text-amber-500" />,
      title_ar: translations.ar.aboutUs.goalTitle,
      title_en: translations.en.aboutUs.goalTitle,
      desc_ar: translations.ar.aboutUs.goalDesc,
      desc_en: translations.en.aboutUs.goalDesc
    }
  };

  return (
    <div className={`space-y-12 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Intro section */}
      <section className="bg-brand-cool/40 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-white/10 flex flex-col lg:flex-row items-center gap-12">
        <div className="space-y-6 lg:w-1/2">
          <div className="inline-flex items-center gap-1.5 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-3 py-1 text-xs text-brand-gold font-bold uppercase">
            <BadgeCheck className="w-4 h-4 text-brand-gold shrink-0" />
            <span>{t.title}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {t.companyName}
          </h2>
          <p className="text-white/70 leading-relaxed text-sm sm:text-base">
            {t.introDesc}
          </p>
          <p className={`text-white/50 text-sm leading-relaxed italic ${language === 'ar' ? 'border-r-4 pr-4' : 'border-l-4 pl-4'} border-brand-gold`}>
            {t.quote}
          </p>
        </div>
        <div className="lg:w-1/2 w-full">
          {/* Aesthetic grid presenting operational layout */}
          <div className="bg-brand-cool rounded-2xl p-8 border border-white/10 space-y-6">
            <h3 className={`text-brand-gold font-bold text-lg border-b border-white/10 pb-3 ${language === 'en' ? 'text-left' : 'text-right'}`}>{t.officialCard.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-sans">
              <div className={`p-3 bg-brand-deep/55 rounded-lg border border-white/10 ${language === 'en' ? 'text-left' : 'text-right'}`}>
                <p className="text-white/40 text-[11px] uppercase tracking-wider">{t.officialCard.legalName}</p>
                <p className="font-bold text-white mt-1 uppercase">{t.officialCard.legalNameValue}</p>
              </div>
              <div className={`p-3 bg-brand-deep/55 rounded-lg border border-white/10 ${language === 'en' ? 'text-left' : 'text-right'}`}>
                <p className="text-white/40 text-[11px] uppercase tracking-wider">{t.officialCard.arabicName}</p>
                <p className="font-bold text-white mt-1">{t.officialCard.arabicNameValue}</p>
              </div>
              <div className={`p-3 bg-brand-deep/55 rounded-lg border border-white/10 ${language === 'en' ? 'text-left' : 'text-right'}`}>
                <p className="text-white/40 text-[11px] uppercase tracking-wider">{t.officialCard.hq}</p>
                <p className="font-bold text-white mt-1">{t.officialCard.hqValue}</p>
              </div>
              <div className={`p-3 bg-brand-deep/55 rounded-lg border border-white/10 ${language === 'en' ? 'text-left' : 'text-right'}`}>
                <p className="text-white/40 text-[11px] uppercase tracking-wider">{t.officialCard.coverage}</p>
                <p className="font-bold text-white mt-1">{t.officialCard.coverageValue}</p>
              </div>
            </div>
            <div className="bg-brand-deep/85 p-4 rounded-xl border border-white/10 text-center">
              <p className="text-brand-gold text-xs font-mono tracking-wider font-bold">SLOGANS</p>
              <p className="text-white text-base font-bold mt-1 uppercase">DELIVERY SERVICE 24/7</p>
              <p className="text-white/75 text-xs italic mt-0.5">Swift â€¢ Secure â€¢ Exceptional | Ø³Ø±Ø¹Ø© â€¢ Ø£Ù…Ø§Ù† â€¢ ØªÙ…ÙŠØ²</p>
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
              <div className={`space-y-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <h3 className="text-xl font-bold text-white">{language === 'ar' ? sec.title_ar : sec.title_en}</h3>
                <h4 className="text-xs text-brand-gold font-bold font-mono uppercase tracking-wider">{language === 'ar' ? sec.title_en : sec.title_ar}</h4>
                <p className="text-white/70 text-sm leading-relaxed">{language === 'ar' ? sec.desc_ar : sec.desc_en}</p>
                <p className="text-white/40 text-xs leading-relaxed italic">{language === 'ar' ? sec.desc_en : sec.desc_ar}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Corporate Values */}
      <section className="space-y-8 pt-8 border-t border-white/10">
        <h3 className={`text-2xl font-bold text-white ${language === 'ar' ? 'text-right' : 'text-left'}`}>{t.valuesTitle}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {t.values.map((v: {title: string, desc: string}, i: number) => (
            <div key={i} className={`p-5 bg-brand-deep/30 rounded-xl border border-white/10 hover:border-brand-gold/50 transition-colors ${language === 'ar' ? 'text-right' : 'text-left'}`}>
               <h4 className="font-bold text-brand-gold mb-2 text-lg">{v.title}</h4>
               <p className="text-white/70 text-xs leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Corporate Values */}
      <section className="space-y-8 pt-8 border-t border-white/10">
        <h3 className={`text-2xl font-bold text-white ${language === 'ar' ? 'text-right' : 'text-left'}`}>{t.valuesTitle}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {t.values.map((v: {title: string, desc: string}, i: number) => (
            <div key={i} className={`p-5 bg-brand-deep/30 rounded-xl border border-white/10 hover:border-brand-gold/50 transition-colors ${language === 'ar' ? 'text-right' : 'text-left'}`}>
               <h4 className="font-bold text-brand-gold mb-2 text-lg">{v.title}</h4>
               <p className="text-white/70 text-xs leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
