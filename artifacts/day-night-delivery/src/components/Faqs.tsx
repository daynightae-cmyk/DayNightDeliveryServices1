import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useAppContext } from "../lib/AppContext";

type FaqEntry = {
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
};

const faqList: FaqEntry[] = [
  {
    questionEn: "How much does standard UAE delivery cost?",
    questionAr: "كم تكلفة التوصيل العادي داخل الإمارات؟",
    answerEn: "Main UAE areas are served at a final price of 25 AED. Extended UAE areas are served at a final price of 50 AED.",
    answerAr: "المناطق الرئيسية داخل الإمارات بسعر نهائي 25 درهم. المناطق الممتدة داخل الإمارات بسعر نهائي 50 درهم."
  },
  {
    questionEn: "Is express delivery available?",
    questionAr: "هل تتوفر خدمة التوصيل السريع؟",
    answerEn: "Yes. Express delivery adds a fixed 15 AED surcharge to the selected UAE delivery price.",
    answerAr: "نعم. خدمة التوصيل السريع تضيف 15 درهم فقط إلى سعر التوصيل داخل الإمارات."
  },
  {
    questionEn: "How long does standard delivery take?",
    questionAr: "كم يستغرق التوصيل العادي؟",
    answerEn: "Most standard UAE deliveries are handled within 24 to 48 hours after pickup confirmation.",
    answerAr: "غالباً يتم تنفيذ التوصيل العادي داخل الإمارات خلال 24 إلى 48 ساعة بعد تأكيد الاستلام."
  },
  {
    questionEn: "Do you support COD collection?",
    questionAr: "هل تدعمون التحصيل عند الاستلام COD؟",
    answerEn: "Yes. COD collection is available for stores and business clients, with the amount confirmed before order submission.",
    answerAr: "نعم. خدمة التحصيل عند الاستلام متاحة للمتاجر والعملاء التجاريين، ويتم تأكيد مبلغ التحصيل قبل إرسال الطلب."
  },
  {
    questionEn: "Do you provide international shipping?",
    questionAr: "هل توفرون الشحن الدولي؟",
    answerEn: "Yes. GCC shipping starts from 95 AED for the first kg and 45 AED for each additional kg. Worldwide shipping starts from 190 AED for the first kg and 90 AED for each additional kg.",
    answerAr: "نعم. الشحن إلى دول الخليج يبدأ من 95 درهم لأول كيلو و45 درهم لكل كيلو إضافي. الشحن العالمي يبدأ من 190 درهم لأول كيلو و90 درهم لكل كيلو إضافي."
  },
  {
    questionEn: "How can I track a shipment?",
    questionAr: "كيف يمكنني تتبع الشحنة؟",
    answerEn: "Open the tracking page, enter your tracking code, and the system will show the latest available shipment status.",
    answerAr: "افتح صفحة التتبع، أدخل رقم التتبع، وسيعرض النظام آخر حالة متاحة للشحنة."
  }
];

export default function Faqs() {
  const { language } = useAppContext();
  const [activeIdx, setActiveIdx] = useState<number | null>(0);
  const isArabic = language === "ar";

  return (
    <div className="max-w-3xl mx-auto space-y-12" dir={isArabic ? "rtl" : "ltr"}>
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block border border-brand-gold/20">
          {isArabic ? "الأسئلة المتكررة" : "Frequently Asked Questions"}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {isArabic ? "كل ما تحتاج معرفته عن خدمات داي نايت" : "Everything You Need To Know About Day Night"}
        </h2>
        <p className="text-white/60 text-sm">
          {isArabic
            ? "إجابات مباشرة حول الأسعار النهائية، التوصيل المحلي، الشحن الدولي، التحصيل، والتتبع."
            : "Clear answers about final prices, UAE delivery, international shipping, COD, and tracking."}
        </p>
      </section>

      <section className="space-y-4">
        {faqList.map((faq, index) => {
          const isOpen = activeIdx === index;

          return (
            <div
              id={`faq_accordion_${index}`}
              key={faq.questionEn}
              className="glass rounded-2xl border border-white/10 overflow-hidden hover:border-brand-gold/60 transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setActiveIdx(isOpen ? null : index)}
                className="w-full p-5 flex items-center justify-between text-start gap-4 cursor-pointer focus:outline-none"
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-white/40 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/40 shrink-0" />
                )}
                <div className="flex items-center gap-3 text-white">
                  <HelpCircle className="w-5 h-5 text-brand-gold shrink-0" />
                  <span className="font-bold text-sm sm:text-base leading-snug">
                    {isArabic ? faq.questionAr : faq.questionEn}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-white/70 text-sm border-t border-white/5 leading-relaxed font-sans">
                  {isArabic ? faq.answerAr : faq.answerEn}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="glass text-white rounded-2xl p-6 text-center border border-white/10">
        <p className="text-sm text-white/80">
          {isArabic
            ? "لأي استفسار إضافي، تواصل معنا مباشرة عبر واتساب أو البريد الرسمي."
            : "For any additional question, contact us directly via WhatsApp or official email."}
        </p>
        <div className="pt-4 flex flex-wrap justify-center gap-3">
          <a
            href="https://wa.me/971568757331"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors inline-block cursor-pointer font-sans"
          >
            WhatsApp
          </a>
          <a
            href="mailto:Admin@daynightae.com"
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-lg text-xs transition-colors inline-block cursor-pointer font-sans"
          >
            Admin@daynightae.com
          </a>
        </div>
      </section>
    </div>
  );
}
