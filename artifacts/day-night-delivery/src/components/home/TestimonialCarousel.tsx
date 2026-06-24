import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { testimonials } from "../../data/testimonials";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";

export default function TestimonialCarousel() {
  const { language } = useAppContext();
  const t = translations[language].testimonials;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  const current = testimonials[currentIndex];

  return (
    <section className="py-12 px-6 sm:px-12 relative overflow-hidden bg-brand-deep border-y border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-cool/20 via-brand-deep/0 to-brand-deep/0 -z-10"></div>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className={`text-center space-y-3 ${language === 'ar' ? 'font-sans' : ''}`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{t.title}</h2>
          <p className="text-white/60 text-sm">{t.subtitle}</p>
        </div>

        <div className="relative">
          <div className="flex justify-center items-center">
            <button 
              onClick={language === 'ar' ? next : prev} 
              aria-label={t.previous}
              className="absolute left-0 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-brand-cool/50 hover:bg-brand-blue text-white transition-colors border border-white/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="w-full max-w-2xl px-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className={`bg-brand-cool/30 rounded-2xl p-8 sm:p-10 border border-brand-gold/20 shadow-xl shadow-brand-gold/5 relative ${language === 'ar' ? 'text-right' : 'text-left'}`}
                >
                  <Quote className={`absolute ${language === 'ar' ? 'right-6' : 'left-6'} top-6 w-10 h-10 text-white/5 rotate-180`} />
                  <div className="flex gap-1 mb-4">
                    {[...Array(current.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-brand-gold fill-brand-gold" />
                    ))}
                  </div>
                  <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6 italic relative z-10">
                    "{language === 'ar' ? current.quoteAr : current.quoteEn}"
                  </p>
                  <div className={`flex items-center gap-3 ${language === 'ar' ? 'flex-row-reverse justify-end' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-brand-blue/20 border border-brand-gold/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-gold font-bold text-sm">{(language === 'ar' ? current.nameAr : current.nameEn)[0]}</span>
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{language === 'ar' ? current.nameAr : current.nameEn}</h4>
                      <p className="text-brand-gold text-xs">{language === 'ar' ? current.companyAr : current.companyEn}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <button 
              onClick={language === 'ar' ? prev : next} 
              aria-label={t.next}
              className="absolute right-0 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-brand-cool/50 hover:bg-brand-blue text-white transition-colors border border-white/10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? "bg-brand-gold w-6" : "bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
