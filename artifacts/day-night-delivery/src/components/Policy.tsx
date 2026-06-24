import { ShieldCheck, ShieldAlert, BadgeInfo, Scale, Ban, RefreshCcw } from "lucide-react";
import { useAppContext } from "../lib/AppContext";

export default function Policy() {
  const { theme, language } = useAppContext();
  const isLight = theme === "light";
  const isArabic = language === "ar";

  const headingColor  = isLight ? "text-[#071A33]"     : "text-white";
  const bodyColor     = isLight ? "text-[#071A33]/80"  : "text-white/75";
  const mutedColor    = isLight ? "text-[#071A33]/55"  : "text-white/50";
  const cardBg        = isLight ? "bg-white border-[#071A33]/10 shadow-sm" : "bg-brand-cool/30 border-white/10";
  const iconBg        = isLight ? "bg-[#071A33]/5 border-[#071A33]/10"    : "bg-white/5 border-white/10";
  const bottomBg      = isLight ? "bg-[#EDF3FF] border-[#071A33]/10"      : "bg-brand-cool/25 border-white/10";

  const policies = [
    {
      icon: <Scale className="w-6 h-6 text-brand-gold" />,
      title_ar: "أوزان الشحنات والقياسات المعتمدة",
      title_en: "Weight & Dimensions Regulations",
      desc_ar: "تشمل التعريفة القياسية الشحنات بوزن يصل إلى 5 كجم. يتم حساب وزن إضافي على الكيلوغرامات الزائدة بمقدار متناسق مع التعريفة اللوجستية العامة لتجنب إجهاد أسطول التوصيل.",
      desc_en: "Standard delivery rates cover up to 5kg. Excess weight incurs structured incremental shipping fees.",
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-brand-gold" />,
      title_ar: "التعبئة السليمة والمسؤولية اللوجستية",
      title_en: "Safe Packaging & Liability Policy",
      desc_ar: "يتوجب على المرسل تغليف المنتجات الثمينة أو الزجاجية بشكل كافٍ ومقفل ومحمي من الاهتزازات. نلتزم بتوصيل الطرد بحالته المستلمة دون فتحه أو التعرض لمحتوياته، مع توقيع إثبات من المستلم.",
      desc_en: "The sender is responsible for proper packing of fragile elements. Day Night ensures secure sealed handling.",
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-brand-gold" />,
      title_ar: "قوانين توريد الصيدليات وخدمات التوصيل الدوائي الحساس",
      title_en: "Pharmacy & Sensitive Delivery Regulations",
      desc_ar: "نقوم بتوصيل المستلزمات الطبية والمنتجات الورقية وأدوات العناية الصحية والصيدلانية المغلقة فقط تماشياً مع القوانين الاتحادية بدولة الإمارات. لا نقدم استشارات طبية ولا ننقل مواد دوائية خاضعة للرقابة إلا بمستندات ترخيص رسمية.",
      desc_en: "We transport sealed healthcare tools and cosmetic packages. Day Night does not dispense or handle strictly regulated drugs.",
    },
    {
      icon: <Ban className="w-6 h-6 text-rose-500" />,
      title_ar: "المنتجات والمواد المحظورة تماماً",
      title_en: "Strictly Prohibited Items",
      desc_ar: "يمنع منعاً باتاً شحن أو التعامل مع المواد القابلة للاشتعال، الكيماويات غير المصرحة، السجائر الإلكترونية غير المعفاة، العملات النقدية السائلة والمجوهرات فائقة القيمة، والأسلحة أو المواد المخالفة للأمن والآداب العامة.",
      desc_en: "Liquids of explosive nature, hazardous chemicals, liquid money, and custom prohibited goods are entirely rejected.",
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-brand-gold" />,
      title_ar: "سياسة الإرجاع والمرتجعات والتسليم المرفوض",
      title_en: "Returns, Failed Attempt & Cancellation Policy",
      desc_ar: "في حال رفض المستلم استلام الطرد، يتم إخطار المرسل وإعادة توجيهه لمستودعات الفرز للعودة للراسل في زمن أقصاه 48 ساعة. يتم احتساب قيمة تذكرة العودة حسب الاتفاق المبرم.",
      desc_en: "Failed deliveries are systematically flagged and returned securely according to standard returns scheduling agreements.",
    },
  ];

  return (
    <div
      className={`max-w-4xl mx-auto space-y-12 ${isArabic ? "text-right" : "text-left"}`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Official Terms & Policy • سياسة الخدمة والشحن
        </span>
        <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight ${headingColor}`}>
          {isArabic ? "شروط وسياسات داي نايت الرسمية للتوصيل" : "Day Night Delivery — Official Terms & Policies"}
        </h2>
        <p className={`text-sm leading-relaxed ${mutedColor}`}>
          {isArabic
            ? "تضمن سياساتنا تجربة لوجستية عادلة ومحمية تحمي حقوق أصحاب المتاجر والمستهلكين والمناديب وتطابق لوائح النقل البري في دولة الإمارات."
            : "Our policies ensure a fair and protected logistics experience aligned with UAE road transport regulations."}
        </p>
      </section>

      <section className="space-y-6">
        {policies.map((p, idx) => (
          <div
            id={`policy_box_${idx}`}
            key={idx}
            className={`p-6 sm:p-8 rounded-2xl border flex flex-col md:flex-row gap-6 md:items-start transition-all hover:border-brand-gold/40 ${cardBg}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${iconBg}`}>
              {p.icon}
            </div>
            <div className="space-y-2 flex-1">
              <h3 className={`text-lg font-bold leading-snug ${headingColor}`}>
                {isArabic ? p.title_ar : p.title_en}
              </h3>
              <p className={`text-[10px] font-mono uppercase tracking-wider text-brand-gold`}>
                {isArabic ? p.title_en : p.title_ar}
              </p>
              <p className={`text-sm leading-relaxed ${bodyColor}`}>
                {isArabic ? p.desc_ar : p.desc_en}
              </p>
              <p className={`text-xs italic leading-relaxed ${mutedColor}`}>
                {isArabic ? p.desc_en : p.desc_ar}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className={`border p-6 rounded-2xl text-center space-y-3 ${bottomBg}`}>
        <div className={`w-10 h-10 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto text-brand-gold border border-brand-gold/20`}>
          <BadgeInfo className="w-5 h-5" />
        </div>
        <h4 className={`font-bold text-base ${headingColor}`}>
          {isArabic ? "هل لديك استفسار عن مادة تحتاج شحنها؟" : "Have a question about shipping something specific?"}
        </h4>
        <p className={`text-sm max-w-xl mx-auto leading-relaxed ${bodyColor}`}>
          {isArabic
            ? "يقوم مستشارينا بالرد عليك وتوضيح قابلية الشحن واللوائح الجمركية فورياً للدول المجاورة والداخلية."
            : "Our advisors will clarify shipping eligibility and customs regulations for both local and international destinations."}
        </p>
        <div className="pt-2">
          <a
            href="https://wa.me/971568757331"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-lg text-xs transition-colors inline-block font-sans"
          >
            {isArabic ? "تواصل مع مدير الامتثال" : "Contact Compliance Manager"}
          </a>
        </div>
      </section>
    </div>
  );
}
