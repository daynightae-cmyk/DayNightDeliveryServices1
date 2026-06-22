import React, { useEffect, useState, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const testimonials = [
  {
    id: 1,
    rating: 5,
    nameEn: 'Operations Manager',
    nameAr: 'مدير العمليات',
    companyEn: 'Abu Dhabi Trading Company',
    companyAr: 'شركة تجارية في أبوظبي',
    quoteEn: 'DAY NIGHT has helped us manage urgent document and parcel deliveries across Abu Dhabi with consistent timing and professional communication.',
    quoteAr: 'ساعدتنا DAY NIGHT في إدارة توصيل المستندات والطرود العاجلة داخل أبوظبي بمواعيد ثابتة وتواصل احترافي.'
  },
  {
    id: 2,
    rating: 5,
    nameEn: 'E-Commerce Partner',
    nameAr: 'شريك تجارة إلكترونية',
    companyEn: 'Dubai Online Store',
    companyAr: 'متجر إلكتروني في دبي',
    quoteEn: 'Their delivery support is reliable for our online orders, especially when customers need fast updates and clear tracking.',
    quoteAr: 'خدمة التوصيل مناسبة جدًا لطلبات متجرنا الإلكتروني، خصوصًا مع التحديثات السريعة والتتبع الواضح للعملاء.'
  },
  {
    id: 3,
    rating: 5,
    nameEn: 'Clinic Administrator',
    nameAr: 'مسؤول إدارة عيادة',
    companyEn: 'Sharjah Business Client',
    companyAr: 'عميل أعمال في الشارقة',
    quoteEn: 'We appreciate the clear coordination, careful handling, and responsive service for our daily delivery requirements.',
    quoteAr: 'نقدر مستوى التنسيق، والعناية في التعامل مع الطلبات، وسرعة الاستجابة لاحتياجاتنا اليومية.'
  },
  {
    id: 4,
    rating: 5,
    nameEn: 'Procurement Team',
    nameAr: 'فريق المشتريات',
    companyEn: 'UAE Corporate Client',
    companyAr: 'عميل شركات داخل الإمارات',
    quoteEn: 'DAY NIGHT gives our team a dependable delivery option for business documents, small parcels, and scheduled shipments.',
    quoteAr: 'توفر DAY NIGHT خيار توصيل موثوق لفريقنا في المستندات التجارية والطرود الصغيرة والشحنات المجدولة.'
  }
];

export default function TestimonialCarousel() {
  const { lang } = useLanguage();
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setInterval(() => setIndex(i => (i + 1) % testimonials.length), 4500);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  function prev() { setIndex(i => (i - 1 + testimonials.length) % testimonials.length); }
  function next() { setIndex(i => (i + 1) % testimonials.length); }

  const t = testimonials[index];

  return (
    <section className="bg-white/5 rounded-3xl p-6 border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold">{lang === 'ar' ? 'موثوقون لدى شركاء الأعمال في الإمارات' : 'Trusted by UAE Business Partners'}</h3>
          <p className="text-xs text-white/60">{lang === 'ar' ? 'دعم توصيل احترافي للشركات، العيادات، المتاجر، وفرق التجارة الإلكترونية.' : 'Professional delivery support for companies, clinics, stores, and e-commerce teams.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="prev" onClick={prev} className="p-2 rounded-md bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
          <button aria-label="next" onClick={next} className="p-2 rounded-md bg-white/5"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex-none w-full sm:w-28 h-28 rounded-xl bg-white/5 flex items-center justify-center">
          <Quote className="w-8 h-8 text-white/60" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400" />)}
          </div>
          <p className="mt-2 text-sm">{lang === 'ar' ? t.quoteAr : t.quoteEn}</p>
          <p className="mt-3 text-xs text-white/60 font-bold">{lang === 'ar' ? `${t.nameAr} — ${t.companyAr}` : `${t.nameEn} — ${t.companyEn}`}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 justify-center">
        {testimonials.map((_, i) => (
          <button key={i} aria-label={`go-to-${i}`} onClick={() => setIndex(i)} className={`w-2 h-2 rounded-full ${i === index ? 'bg-brand-gold' : 'bg-white/10'}`}></button>
        ))}
      </div>
    </section>
  );
}
