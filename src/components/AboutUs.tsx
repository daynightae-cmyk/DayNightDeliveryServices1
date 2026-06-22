import { motion } from "motion/react";
import { BadgeCheck, Target, Heart, Eye } from "lucide-react";
import companyMeta from '../data/companyMeta';
import { useLanguage } from '../context/LanguageContext';

export default function AboutUs() {
  const { lang } = useLanguage();

  const content = {
    intro: {
      en: {
        title: 'DAY NIGHT DELIVERY SERVICES',
        subtitle: 'Professional delivery and shipping solutions across the UAE and international routes.',
        paragraph: `DAY NIGHT DELIVERY SERVICES is a UAE-based logistics and courier company offering 24/7 delivery, express services, e-commerce solutions, corporate contracts, and international shipping. We focus on speed, security, transparency, and outstanding customer support.`
      },
      ar: {
        title: 'داي نايت لخدمات التوصيل والشحن',
        subtitle: 'حلول توصيل وشحن احترافية داخل الإمارات وخارجها.',
        paragraph: `داي نايت شركة إماراتية تقدم خدمات توصيل وشحن على مدار الساعة، حلول توصيل سريع، خدمات المتاجر الإلكترونية، عقود شركات، وشحن دولي. نركز على السرعة، الأمان، الشفافية، وتجربة عميل ممتازة.`
      }
    },
    mission: {
      en: 'To provide fast, secure, and transparent delivery services that empower individuals, e-commerce stores and businesses with reliable logistics solutions available day and night.',
      ar: 'تقديم خدمات توصيل سريعة وآمنة وشفافة تمكّن الأفراد والمتاجر والشركات من حلول لوجستية موثوقة متاحة في النهار والليل.'
    },
    vision: {
      en: 'To be the most trusted and widely used delivery partner across the UAE, recognized for reliability, rapid response and premium service.',
      ar: 'أن نكون شريك التوصيل الأكثر موثوقية وانتشاراً داخل دولة الإمارات، معروفين بالسرعة والاعتمادية وجودة الخدمة.'
    },
    services: {
      en: [
        'Local deliveries across all Emirates',
        'Express same-day delivery',
        'E-commerce fulfillment and COD support',
        'Corporate contracts and scheduled logistics',
        'International shipping to GCC and selected global destinations'
      ],
      ar: [
        'التوصيل المحلي داخل جميع الإمارات',
        'خدمة التوصيل السريع في نفس اليوم',
        'حلول المتاجر الإلكترونية ودعم الدفع عند الاستلام',
        'عقود شركات وخدمات لوجستية مجدولة',
        'الشحن الدولي إلى دول الخليج وبعض الوجهات العالمية'
      ]
    },
    why: {
      en: [
        '24/7 operation and responsive customer support',
        'Clear and honest pricing',
        'Professional trained drivers and secure handling',
        'Ready integrations for e-commerce and business accounts',
        'Future-ready for realtime tracking and notifications'
      ],
      ar: [
        'خدمة 24/7 ودعم عملاء سريع',
        'أسعار واضحة وعادلة',
        'سائقون محترفون وتعامل آمن مع الشحنات',
        'تكامل جاهز مع المتاجر الإلكترونية وحسابات الشركات',
        'جاهزية مستقبلية للتتبع اللحظي والإشعارات'
      ]
    }
  };

  return (
    <div className="space-y-12">
      {/* Intro */}
      <section className="bg-brand-cool/40 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-white/10">
        <div className="max-w-5xl mx-auto text-right">
          <div className="inline-flex items-center gap-2 mb-4">
            <BadgeCheck className="w-5 h-5 text-brand-gold" />
            <h3 className="text-brand-gold font-bold text-sm">{lang === 'ar' ? companyMeta.shortTagAr : companyMeta.shortTagEn}</h3>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">{lang === 'ar' ? content.intro.ar.title : content.intro.en.title}</h1>
          <p className="text-white/70 leading-relaxed mb-4">{lang === 'ar' ? content.intro.ar.paragraph : content.intro.en.paragraph}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-brand-deep/60 border border-white/10">
              <h4 className="text-brand-gold font-bold mb-1">{lang === 'ar' ? 'المهمة' : 'Mission'}</h4>
              <p className="text-white/70 text-sm">{lang === 'ar' ? content.mission.ar ?? content.mission : content.mission.en ?? content.mission}</p>
            </div>
            <div className="p-4 rounded-xl bg-brand-deep/60 border border-white/10">
              <h4 className="text-brand-gold font-bold mb-1">{lang === 'ar' ? 'الرؤية' : 'Vision'}</h4>
              <p className="text-white/70 text-sm">{lang === 'ar' ? content.vision.ar ?? content.vision : content.vision.en ?? content.vision}</p>
            </div>
            <div className="p-4 rounded-xl bg-brand-deep/60 border border-white/10">
              <h4 className="text-brand-gold font-bold mb-1">{lang === 'ar' ? 'المقر' : 'Headquarters'}</h4>
              <p className="text-white/70 text-sm">{lang === 'ar' ? companyMeta.addressAr : companyMeta.addressEn}</p>
              <a href={`tel:${companyMeta.phone}`} className="text-white/80 font-bold block mt-2">{companyMeta.phone}</a>
            </div>
          </div>
        </div>
      </section>

      {/* Services and Why Choose */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white">{lang === 'ar' ? 'خدماتنا' : 'Our Services'}</h3>
            <p className="text-white/60 mt-2 mb-4">{lang === 'ar' ? 'نقدّم مجموعة متكاملة من الخدمات المناسبة للأفراد والمتاجر والشركات:' : 'We provide a comprehensive range of services tailored for individuals, e-commerce and corporate clients:'}</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-white/70 list-inside">
              {(lang === 'ar' ? content.services.ar : content.services.en).map((s, i) => (
                <li key={i} className="py-2 px-3 rounded-lg bg-brand-deep/50 border border-white/5">{s}</li>
              ))}
            </ul>
          </div>

          <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 mt-4">
            <h3 className="text-xl font-bold text-white">{lang === 'ar' ? 'التغطية المحلية والدولية' : 'Domestic & International'}</h3>
            <p className="text-white/60 mt-2">{lang === 'ar' ? 'نغطي جميع إمارات الدولة ونقدم خدمات شحن إلى دول الخليج وعدد من الوجهات العالمية.' : 'We operate across all Emirates and offer shipping to GCC countries and selected global destinations.'}</p>
            <div className="mt-3 text-sm text-white/70">
              <strong className="text-white">{lang === 'ar' ? 'المناطق الأساسية:' : 'Key areas:'}</strong>
              <div className="mt-2 flex flex-wrap gap-2">
                {companyMeta.serviceAreas.map((c) => (
                  <span key={c} className="px-3 py-1 rounded-full bg-white/5 text-white/80 text-xs">{lang === 'ar' ? c : c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-brand-deep/70 rounded-2xl p-4 border border-white/10">
            <h4 className="text-brand-gold font-bold">{lang === 'ar' ? 'لماذا تختارنا؟' : 'Why Choose Us'}</h4>
            <ul className="mt-3 text-white/70 text-sm space-y-2">
              {(lang === 'ar' ? content.why.ar : content.why.en).map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </div>

          <div className="bg-brand-cool/30 rounded-2xl p-4 border border-white/10">
            <h4 className="text-brand-gold font-bold">{lang === 'ar' ? 'اتصل بنا' : 'Contact'}</h4>
            <p className="text-white/70 text-sm mt-2">{companyMeta.addressAr}</p>
            <a href={`tel:${companyMeta.phone}`} className="block text-white font-bold mt-2">{companyMeta.phone}</a>
            <a href={`mailto:${companyMeta.email}`} className="block text-white/70 mt-1">{companyMeta.email}</a>
            <a href={companyMeta.mapUrl} target="_blank" rel="noreferrer" className="text-brand-gold font-bold mt-3 inline-block">{lang === 'ar' ? 'افتح الموقع' : 'Open location'}</a>
          </div>
        </aside>
      </section>

      {/* Closing brand statement */}
      <section className="bg-brand-deep/85 rounded-2xl p-6 border border-white/10 text-center">
        <h4 className="text-brand-gold font-extrabold">{lang === 'ar' ? companyMeta.sloganAr : companyMeta.sloganEn}</h4>
        <p className="text-white/70 mt-2">{lang === 'ar' ? 'راحتكم أولويتنا — نوصلها لك بأمان وفي الوقت المحدد.' : 'Your Comfort.. Our Priority — Fast, reliable delivery every time.'}</p>
      </section>
        </div>
      );
    }
