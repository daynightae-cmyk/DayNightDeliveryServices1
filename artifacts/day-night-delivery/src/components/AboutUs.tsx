import { motion } from "motion/react";
import { BadgeCheck, Target, Heart, Eye, MapPin, ShieldCheck } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import localAssets, { withRemoteFallback } from "../data/localAssets";
import companyMeta from "../data/companyMeta";

export default function AboutUs() {
  const { language } = useAppContext();
  const t = translations[language].aboutUs;
  const isArabic = language === "ar";

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
  ];

  return (
    <div className={`space-y-10 ${isArabic ? "text-right" : "text-left"}`} dir={isArabic ? "rtl" : "ltr"}>
      <section className="dn-finish-surface rounded-[2.6rem] p-6 sm:p-10 lg:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-brand-gold/40 bg-white shadow-xl shadow-brand-gold/10">
                <img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT DELIVERY SERVICES" className="h-full w-full object-contain p-1" />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-brand-gold">
                <BadgeCheck className="h-4 w-4 shrink-0" />
                <span>{t.title}</span>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">{t.companyName}</h1>
              <p className="mt-5 max-w-3xl text-sm font-bold leading-8 text-white/68 sm:text-base">{t.introDesc}</p>
            </div>

            <p className={`max-w-3xl border-brand-gold text-sm font-bold leading-8 text-white/58 ${isArabic ? "border-r-4 pr-4" : "border-l-4 pl-4"}`}>
              {t.quote}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="dn-finish-card rounded-2xl p-4"><MapPin className="mb-3 h-5 w-5 text-brand-gold" /><strong className="block text-white">{isArabic ? companyMeta.addressAr : companyMeta.addressEn}</strong></div>
              <div className="dn-finish-card rounded-2xl p-4"><ShieldCheck className="mb-3 h-5 w-5 text-brand-sky" /><strong className="block text-white">{isArabic ? "تشغيل موثوق داخل الإمارات وخارجها" : "Trusted UAE and international operations"}</strong></div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-brand-cool/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
            <h2 className={`border-b border-white/10 pb-3 text-lg font-black text-brand-gold ${language === "en" ? "text-left" : "text-right"}`}>
              {t.officialCard.title}
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 text-sm font-sans sm:grid-cols-2">
              {[
                [t.officialCard.legalName, t.officialCard.legalNameValue],
                [t.officialCard.arabicName, t.officialCard.arabicNameValue],
                [t.officialCard.hq, t.officialCard.hqValue],
                [t.officialCard.coverage, t.officialCard.coverageValue],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl border border-white/10 bg-brand-deep/55 p-4 ${language === "en" ? "text-left" : "text-right"}`}>
                  <p className="text-[11px] font-black uppercase tracking-wider text-white/42">{label}</p>
                  <p className="mt-2 font-black text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4 text-center">
              <p className="text-xs font-black tracking-[0.22em] text-brand-gold">DELIVERY SERVICE 24/7</p>
              <p className="mt-2 text-sm font-bold text-white/78">Swift • Secure • Exceptional | سرعة • أمان • تميز</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {sections.map((sec, idx) => (
          <motion.article
            id={`about_sec_${idx}`}
            key={sec.title_en}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className="dn-finish-card rounded-[1.8rem] p-6"
          >
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/15">
                <span className="text-brand-gold">{sec.icon}</span>
              </div>

              <div className={`space-y-2 ${isArabic ? "text-right" : "text-left"}`}>
                <h3 className="text-xl font-black text-white">{isArabic ? sec.title_ar : sec.title_en}</h3>
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-gold">{isArabic ? sec.title_en : sec.title_ar}</h4>
                <p className="text-sm font-bold leading-7 text-white/68">{isArabic ? sec.desc_ar : sec.desc_en}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      <section className="dn-finish-surface rounded-[2.2rem] p-6 sm:p-8">
        <h2 className={`text-2xl font-black text-white ${isArabic ? "text-right" : "text-left"}`}>{t.valuesTitle}</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.values.map((v: { title: string; desc: string }) => (
            <article key={v.title} className={`dn-finish-card rounded-2xl p-5 ${isArabic ? "text-right" : "text-left"}`}>
              <h3 className="mb-2 text-lg font-black text-brand-gold">{v.title}</h3>
              <p className="text-xs font-bold leading-6 text-white/68">{v.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
