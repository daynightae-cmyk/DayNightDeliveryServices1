/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShieldCheck, ShieldAlert, BadgeInfo, Scale, Ban, RefreshCcw } from "lucide-react";

export default function Policy() {
  const policies = [
    {
      icon: <Scale className="w-6 h-6 text-brand-gold" />,
      title_ar: "أوزان الشحنات والقياسات المعتمدة",
      title_en: "Weight & Dimensions Regulations",
      desc_ar: "تشمل التعريفة القياسية الشحنات بوزن يصل إلى 5 كجم. يتم حساب وزن إضافي على الكيلوغرامات الزائدة بمقدار متناسق مع التعريفة اللوجستية العامة لتجنب إجهاد أسطول التوصيل.",
      desc_en: "Standard delivery rates cover up to 5kg. Excess weight incurs structured incremental shipping fees."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-brand-gold" />,
      title_ar: "التعبئة السليمة والمسؤولية اللوجستية",
      title_en: "Safe Packaging & Liability Policy",
      desc_ar: "يتوجب على المرسل تغليف المنتجات الثمينة أو الزجاجية بشكل كاف ومقفل ومحمي من الاهتزازات. نحن نلتزم بتوصيل الطرد بحالته المستلمة دون فتحه أو التعرض لمحتوياته بتاتاً وتوقيع كاشف للمستلم.",
      desc_en: "The sender is responsible for proper packing of fragile elements. Day Night ensures secure sealed handling."
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-brand-gold" />,
      title_ar: "قوانين توريد الصيدليات وخدمات التوصيل الدوائي الحساس",
      title_en: "Pharmacy & Sensitive Delivery Regulations",
      desc_ar: "نقوم بتوصيل المستلزمات الطبية والمنتجات الورقية وأدوات العناية الصحية والصيدلانية المغلقة فقط تماشياً مع القوانين الاتحادية بدولة الإمارات. لا نقدم استشارات طبية ولا ننقل مواد دوائية خاضعة للرقابة المركبة إلا بمستندات ترخيص رسمية مصاحبة من السلطات المختصة.",
      desc_en: "We transport sealed healthcare tools and cosmetic packages. Day Night does not dispense or handle strictly regulated drugs."
    },
    {
      icon: <Ban className="w-6 h-6 text-rose-400" />,
      title_ar: "المنتجات والمواد المحظورة تماماً",
      title_en: "Strictly Prohibited Items",
      desc_ar: "يمنع منعاً باتاً شحن أو التعامل مع المواد القابلة للاشتعال، الكيماويات غير المصرحة، السجائر الإلكترونية غير المعفاة، العملات النقدية السائلة والمجوهرات الثمينة فائقة القيمة، والأسلحة أو المواد المخالفة للأمن والآداب العامة.",
      desc_en: "Liquids of explosive nature, hazardous chemicals, liquid money, and custom prohibited goods are entirely rejected."
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-brand-gold" />,
      title_ar: "سياسة الإرجاع المرتجعات والتسليم المرفوض",
      title_en: "Returns, Failed Attempt & Cancellation Policy",
      desc_ar: "في حال رفض المستلم استلام الطرد، يتم إخطار المرسل وإعادة توجيهه لمستودعات الفرز للعودة للراسل في زمن أقصاه 48 ساعة. يتم احتساب قيمة تذكرة العودة حسب الاتفاق المبرم في حساب التاجر لتغطية الوقود والجهد التشغيلي للمندوب.",
      desc_en: "Failed deliveries are systematically flagged and returned securely according to standard returns scheduling agreements."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 text-right">
      {/* Page Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-sans tracking-widest inline-block">
          Official Terms & Policy • سياسة الخدمة والشحن
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          شروط وسياسات داي نايت الرسمية للتوصيل
        </h2>
        <p className="text-white/60 text-sm">
          تضمن سياساتنا تجربة لوجستية عادلة ومحمية تحمي حقوق أصحاب المتاجر والمستهلكين والمناديب وتطابق لوائح النقل البري في دولة الإمارات العربية المتحدة.
        </p>
      </section>

      {/* Policies List */}
      <section className="space-y-6">
        {policies.map((p, idx) => (
          <div 
            id={`policy_box_${idx}`} 
            key={idx} 
            className="bg-brand-cool/30 p-6 sm:p-8 rounded-2xl border border-white/10 flex flex-col md:flex-row gap-6 md:items-start transition-all hover:border-brand-gold/40"
          >
            {/* Icon Column (left/right aligned) */}
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shrink-0">
              {p.icon}
            </div>

            {/* Details Column */}
            <div className="space-y-2 flex-1">
              <h3 className="text-lg font-bold text-white leading-snug">{p.title_ar}</h3>
              <p className="text-[10px] text-brand-gold font-mono font-bold uppercase tracking-wider">{p.title_en}</p>
              <p className="text-white/75 text-sm leading-relaxed">{p.desc_ar}</p>
              <p className="text-white/40 text-xs italic leading-relaxed">{p.desc_en}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Slogan Alert stamp */}
      <section className="bg-brand-cool/25 border border-white/10 p-6 rounded-2xl text-center space-y-3">
        <div className="w-10 h-10 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto text-brand-gold">
          <BadgeInfo className="w-5 h-5" />
        </div>
        <h4 className="font-bold text-white text-md">هل لديك أي استفسار آخر بخصوص مادة تحتاج شحنها؟</h4>
        <p className="text-white/50 text-xs sm:text-sm max-w-xl mx-auto">
          يقوم مستشارينا وممثلي خدمة العملاء بالرد عليك وتوضيح قابلية الشحن اللوائح الجمركية فورياً للدول المجاورة والداخلية.
        </p>
        <div className="pt-2">
          <a 
            href="https://wa.me/971568757331" 
            target="_blank" 
            referrerPolicy="no-referrer"
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-lg text-xs transition-colors inline-block cursor-pointer font-sans"
          >
            تواصل مع مدير الامتثال بالشركة
          </a>
        </div>
      </section>
    </div>
  );
}
