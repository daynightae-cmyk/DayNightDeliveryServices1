import { ShieldCheck, ShieldAlert, BadgeInfo, Scale, Ban, RefreshCcw, Download, FileText, UserCheck } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";

type LegalDocType = "service" | "customer" | "shipping" | "refund";

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

  async function downloadLegalPdf(type: LegalDocType) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const titleMap = {
      service: isArabic ? "سياسة الخدمة الرسمية" : "Official Service Policy",
      customer: isArabic ? "حقوق العميل" : "Customer Rights Charter",
      shipping: isArabic ? "سياسة الشحن والتسليم" : "Shipping & Delivery Policy",
      refund: isArabic ? "سياسة الإلغاء والمرتجعات" : "Cancellation & Returns Policy",
    };
    const title = titleMap[type];
    const maybe = doc as unknown as { processArabic?: (input: string) => string };
    const tx = (value: string) => isArabic && typeof maybe.processArabic === "function" ? maybe.processArabic(value) : value;
    const rows = legalDocs.find((item) => item.type === type)?.points || [];

    doc.setFillColor(7, 26, 51);
    doc.rect(0, 0, 210, 42, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("DAY NIGHT DELIVERY SERVICES", 105, 14, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(tx(title), 105, 25, { align: "center" });
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(7);
    doc.text(`${companyMeta.displayWebsite} | ${companyMeta.email} | ${companyMeta.phone}`, 105, 34, { align: "center" });

    let y = 56;
    rows.forEach((point, index) => {
      if (y > 265) return;
      doc.setFillColor(index % 2 === 0 ? 245 : 255, 247, 252);
      doc.rect(14, y - 5, 182, 10, "F");
      doc.setTextColor(30, 40, 60);
      doc.setFontSize(8);
      doc.text(tx(point), isArabic ? 192 : 18, y, { align: isArabic ? "right" : "left", maxWidth: 170 });
      y += 12;
    });

    doc.setFillColor(7, 26, 51);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(7);
    doc.text("DAY NIGHT DELIVERY SERVICES", 105, 291, { align: "center" });
    doc.save(`DayNight_${type}_${isArabic ? "AR" : "EN"}.pdf`);
  }

  const policies = [
    {
      icon: <Scale className="w-6 h-6 text-brand-gold" />,
      title_ar: "أوزان الشحنات والقياسات المعتمدة",
      title_en: "Weight & Dimensions Regulations",
      desc_ar: "تشمل التعريفة القياسية الشحنات بوزن يصل إلى 5 كجم. الشحنات الكبيرة أو غير القياسية تحتاج تأكيداً تشغيلياً قبل الاستلام.",
      desc_en: "Standard delivery rates cover normal shipments. Large or non-standard shipments require operational confirmation before pickup.",
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-brand-gold" />,
      title_ar: "التعبئة السليمة والمسؤولية اللوجستية",
      title_en: "Safe Packaging & Liability Policy",
      desc_ar: "يتوجب على المرسل تغليف المنتجات الثمينة أو الزجاجية بشكل كافٍ ومقفل ومحمي. نلتزم بتوصيل الطرد بحالته المستلمة دون فتحه.",
      desc_en: "The sender is responsible for proper packaging of fragile items. Day Night handles sealed shipments without opening contents.",
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-brand-gold" />,
      title_ar: "خدمات الصيدليات والشحنات الحساسة",
      title_en: "Pharmacy & Sensitive Delivery Regulations",
      desc_ar: "نقوم بتوصيل المنتجات المغلقة والمصرح بها فقط. لا نقدم استشارات طبية ولا ننقل مواد خاضعة للرقابة إلا بمستندات رسمية عند الحاجة.",
      desc_en: "We transport sealed and permitted items only. We do not provide medical advice or handle controlled goods without required documents.",
    },
    {
      icon: <Ban className="w-6 h-6 text-rose-500" />,
      title_ar: "المنتجات والمواد المحظورة",
      title_en: "Strictly Prohibited Items",
      desc_ar: "يُمنع شحن المواد الخطرة، القابلة للاشتعال، الأسلحة، المواد المخالفة، أو أي منتج محظور وفق قوانين دولة الإمارات أو دولة الوجهة.",
      desc_en: "Dangerous, flammable, weapon-related, illegal, or destination-prohibited items are not accepted.",
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-brand-gold" />,
      title_ar: "سياسة الإرجاع والتسليم المرفوض",
      title_en: "Returns, Failed Attempt & Cancellation Policy",
      desc_ar: "في حال رفض الاستلام أو تعذر التواصل، يتم تحديث حالة الشحنة وإبلاغ المرسل للتصرف حسب السياسة أو الاتفاق التجاري.",
      desc_en: "If delivery is refused or the receiver is unreachable, shipment status is updated and the sender is contacted for next action.",
    },
    {
      icon: <UserCheck className="w-6 h-6 text-brand-gold" />,
      title_ar: "حقوق العميل",
      title_en: "Customer Rights",
      desc_ar: "للعميل حق معرفة السعر قبل الطلب، استلام رقم تتبع، طلب إثبات التسليم، التواصل مع الدعم، وطلب مراجعة أي مشكلة تشغيلية.",
      desc_en: "Customers have the right to clear pricing, tracking number, proof of delivery, support access, and operational review for issues.",
    },
  ];

  const legalDocs = [
    {
      type: "service" as const,
      titleAr: "سياسة الخدمة",
      titleEn: "Service Policy",
      points: isArabic
        ? ["توضيح السعر قبل إنشاء الطلب.", "تسجيل بيانات الاستلام والتسليم بدقة.", "تحديث حالة الطلب داخل نظام التتبع.", "التعامل مع الشحنة كطرد مغلق دون فتح المحتوى.", "التواصل مع العميل عند وجود عائق تشغيلي."]
        : ["Price is clarified before order creation.", "Pickup and delivery data must be accurate.", "Order status is updated in the tracking system.", "Shipments are handled as sealed packages.", "Customer is contacted for operational exceptions."],
    },
    {
      type: "customer" as const,
      titleAr: "حقوق العميل",
      titleEn: "Customer Rights",
      points: isArabic
        ? ["الحصول على رقم تتبع بعد إنشاء الطلب.", "معرفة الرسوم الأساسية قبل الإرسال.", "طلب نسخة من الفاتورة أو ملخص الطلب.", "طلب تصحيح بيانات التواصل أو العنوان قبل الاستلام.", "طلب مراجعة أي تأخير أو محاولة تسليم فاشلة."]
        : ["Receive a tracking number after order creation.", "Know basic fees before submission.", "Request invoice or order summary.", "Request correction of contact/address before pickup.", "Request review of delays or failed delivery attempts."],
    },
    {
      type: "shipping" as const,
      titleAr: "الشحن والتسليم",
      titleEn: "Shipping & Delivery",
      points: isArabic
        ? ["التوصيل داخل الإمارات حسب المنطقة ووقت الاستلام.", "المناطق الممتدة لها تعرفة تشغيلية مختلفة.", "الشحن الدولي يخضع للوجهة والوزن والقيود الجمركية.", "الشحنات الكبيرة تحتاج عرض سعر خاص.", "العميل مسؤول عن صحة بيانات المستلم."]
        : ["UAE delivery depends on area and pickup time.", "Extended areas have a different operational rate.", "International shipping depends on destination, weight, and customs limits.", "Large shipments require a custom quote.", "Customer is responsible for receiver data accuracy."],
    },
    {
      type: "refund" as const,
      titleAr: "الإلغاء والمرتجعات",
      titleEn: "Cancellation & Returns",
      points: isArabic
        ? ["يمكن طلب الإلغاء قبل الاستلام التشغيلي.", "بعد الاستلام تخضع الرسوم للمراجعة التشغيلية.", "رفض الاستلام قد يؤدي إلى رسوم عودة حسب الاتفاق.", "أي مطالبة يجب أن تتضمن رقم التتبع.", "يتم حل النزاعات عبر الدعم الرسمي للشركة."]
        : ["Cancellation can be requested before operational pickup.", "After pickup, fees are reviewed operationally.", "Refused delivery may cause return fees per agreement.", "Claims must include the tracking number.", "Disputes are handled through official support."],
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
          {isArabic ? "المركز القانوني وحقوق العميل" : "Legal Center & Customer Rights"}
        </h2>
        <p className={`text-sm leading-relaxed ${mutedColor}`}>
          {isArabic
            ? "صفحة موحدة للسياسات، حقوق العميل، الخصوصية التشغيلية، الشحن، الإلغاء، وتحميل الوثائق بصيغة PDF."
            : "A unified center for policies, customer rights, operational privacy, shipping, cancellation, and PDF document downloads."}
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {legalDocs.map((doc) => (
          <button
            key={doc.type}
            onClick={() => void downloadLegalPdf(doc.type)}
            className={`p-4 rounded-2xl border text-start hover:border-brand-gold/50 transition-all ${cardBg}`}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brand-gold" />
              <div>
                <p className={`font-black ${headingColor}`}>{isArabic ? doc.titleAr : doc.titleEn}</p>
                <p className={`text-xs ${mutedColor}`}>{isArabic ? "تحميل PDF رسمي" : "Download official PDF"}</p>
              </div>
              <Download className="w-4 h-4 text-brand-gold ms-auto" />
            </div>
          </button>
        ))}
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
              <p className="text-[10px] font-mono uppercase tracking-wider text-brand-gold">
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
        <div className="w-10 h-10 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto text-brand-gold border border-brand-gold/20">
          <BadgeInfo className="w-5 h-5" />
        </div>
        <h4 className={`font-bold text-base ${headingColor}`}>
          {isArabic ? "هل لديك استفسار عن مادة تحتاج شحنها؟" : "Have a question about shipping something specific?"}
        </h4>
        <p className={`text-sm max-w-xl mx-auto leading-relaxed ${bodyColor}`}>
          {isArabic
            ? "يقوم فريق الدعم بتوضيح قابلية الشحن والقيود التشغيلية قبل إنشاء الطلب."
            : "Support can clarify shipping eligibility and operational restrictions before order creation."}
        </p>
        <a
          href={companyMeta.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-bold rounded-lg text-xs transition-colors inline-block font-sans"
        >
          {isArabic ? "تواصل مع مدير الامتثال" : "Contact Compliance Manager"}
        </a>
      </section>
    </div>
  );
}
