/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { FAQItem } from "../types";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function Faqs() {
  const [activeIdx, setActiveIdx] = useState<number | null>(0);

  const faqList: FAQItem[] = [
    {
      question: "كم تكلفة خدمة التوصيل العادي داخل المدن الرئيسية في الإمارات؟",
      answer: "تبدأ التعرفة الموحدة التنافسية لجميع المدن والمناطق الرئيسية من 30 درهم إماراتي فقط (31.50 درهم شامل الضريبة) للطرود متوسطة الحجم والمستندات بوزن عادي."
    },
    {
      question: "كم يستغرق وقت التوصيل العادي (Standard Delivery)؟",
      answer: "يستغرق وقت النقل والتوزيع الاعتيادي من 24 إلى 48 ساعة كحد أقصى من لحظة استلام الطرد من مخزن أو مقر العميل المرسل."
    },
    {
      question: "هل تتوفر خدمة توصيل سريعة في نفس اليوم وجداول طارئة؟",
      answer: "نعم بالطبع، تتوفر تفضيلات التوصيل السريع (Express Courier) لاستلام وتسليم الطرود والمستندات العاجلة في غضون ساعات قليلة من نفس اليوم، مع رسوم إضافية تبلغ 15 درهم فقط على السعر الأساسي."
    },
    {
      question: "ما هي تعرفة التوصيل للمناطق البعيدة والقرى والضواحي؟",
      answer: "تبدأ رسوم التوصيل للمناطق البعيدة وبلديات العين الخارجية ومناطق الظفرة والغربية (مثل الظهيرة والسلع وغياثي وحميم ليوا) من 50 درهم إماراتي (52.50 درهم شامل الضريبة) نظراً لقيمة التنقل والفرز اللوجستي الخاص بها، فيما تبلغ تعرفة الرويس 30 درهم فقط كعرض خاص."
    },
    {
      question: "ما هي سياسة تحصيل وتوصية الأموال (COD) لأصحاب ومتاجر التجزئة؟",
      answer: "يقدم المندوب خدمة تحصيل قيمة البضاعة والطرود نقداً من المشتري عند عملية التسليم بنجاح، ويتم إجراء تصفية مالية، تسوية دورية وكشف كشوفات حساب منظم أسبوعياً وبكل أمانة لضمان توفير سيولة نقدية جيدة للمتاجر."
    },
    {
      question: "هل يتوفر لديكم الشحن الدولي، وما هي آليات احتساب قيمته؟",
      answer: "نعم بالتأكيد، نوفر شحناً متميزاً وسريعاً لدول الخليج (GCC) بـ 95 درهم لأول كيلو و 45 درهم لكل كيلو إضافي (شامل الضريبة والرسوم اللوجستية)، وللمحاور والوجهات العالمية الأخرى (الاتحاد الأوروبي، كندا وأمريكا وأستراليا) بـ 190 درهم لأول كيلو و 90 درهم لكل كيلو جرام إضافي."
    }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-12 text-right">
      {/* Page Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block">
          Frequently Asked Questions • الأسئلة المتكررة
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          كل ما تود معرفته عن خدمات التوصيل والشحن
        </h2>
        <p className="text-white/60 text-sm">
          جمعنا لكم تفاصيل الأسئلة المتداولة من شركائنا وعملائنا لتسهيل تجربة النقل والخدمات اللوجستية لكم.
        </p>
      </section>

      {/* Accordion List */}
      <section className="space-y-4">
        {faqList.map((faq, index) => {
          const isOpen = activeIdx === index;

          return (
            <div
              id={`faq_accordion_${index}`}
              key={index}
              className="bg-brand-cool/30 rounded-2xl border border-white/10 overflow-hidden hover:border-brand-gold/60 transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setActiveIdx(isOpen ? null : index)}
                className="w-full p-5 flex items-center justify-between text-right gap-4 cursor-pointer focus:outline-none"
              >
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-white/40 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/40 shrink-0" />
                )}
                <div className="flex items-center gap-3 text-white flex-row-reverse">
                  <span className="font-bold text-sm sm:text-base text-right leading-snug">{faq.question}</span>
                  <HelpCircle className="w-5 h-5 text-brand-gold shrink-0" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-white/70 text-sm border-t border-white/5 leading-relaxed font-sans pr-11 text-right">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Embedded Slogan Help banner */}
      <section className="bg-brand-cool/40 text-white rounded-2xl p-6 text-center border border-white/10">
        <p className="text-sm text-white/80">
          لديك استفسار آخر لم يتم توضيحه هنا؟ تواصل فورياً مع خدمة عملاء داي نايت عبر الهاتف أو بريد الدعم.
        </p>
        <div className="pt-4">
          <a
            href="mailto:Admin@daynight.ae"
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-lg text-xs transition-colors inline-block cursor-pointer font-sans"
          >
            راسلنا: Admin@daynight.ae
          </a>
        </div>
      </section>
    </div>
  );
}
