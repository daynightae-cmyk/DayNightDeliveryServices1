import { useAppContext } from "../lib/AppContext";
import { ShieldCheck, Eye, Share2, Lock, Clock, UserCheck, Mail, Phone } from "lucide-react";
import companyMeta from "../data/companyMeta";

export default function Privacy() {
  const { theme, language } = useAppContext();
  const isLight = theme === "light";
  const isArabic = language === "ar";

  const base = isLight
    ? "bg-white border-brand-deep/10"
    : "bg-brand-cool/30 border-white/10";

  const headingColor = isLight ? "text-brand-deep" : "text-white";
  const bodyColor = isLight ? "text-brand-deep/80" : "text-white/75";
  const mutedColor = isLight ? "text-brand-deep/55" : "text-white/50";

  const sections = [
    {
      icon: <Eye className="w-5 h-5 text-brand-gold" />,
      titleAr: "البيانات التي نجمعها",
      titleEn: "Information We Collect",
      contentAr: [
        "الاسم الكامل للمرسل والمستلم",
        "أرقام الهواتف للتنسيق مع المندوب",
        "عناوين الاستلام والتسليم",
        "تفاصيل الشحنة: النوع، الوزن، عدد القطع",
        "رقم التتبع الخاص بكل طلب",
        "مبلغ COD إن كانت طريقة الدفع عند الاستلام",
        "بيانات التسجيل في النظام (للمسؤولين والسائقين فقط)",
      ],
      contentEn: [
        "Full name of sender and receiver",
        "Phone numbers for driver coordination",
        "Pickup and delivery addresses",
        "Shipment details: type, weight, pieces count",
        "Unique tracking number per order",
        "COD amount if payment is cash on delivery",
        "Account credentials (admin/driver only)",
      ],
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-brand-gold" />,
      titleAr: "لماذا نستخدم بياناتك",
      titleEn: "Why We Use Your Data",
      contentAr: [
        "تنفيذ طلب التوصيل بشكل صحيح وآمن",
        "التواصل مع المرسل والمستلم أثناء التوصيل",
        "تتبع الشحنة وتحديث الحالة في الوقت الفعلي",
        "إصدار الفواتير والوثائق الرسمية",
        "خدمة العملاء وحل أي مشكلة في التوصيل",
        "تحسين جودة خدماتنا اللوجستية",
      ],
      contentEn: [
        "Execute your delivery order accurately and securely",
        "Communicate with sender and receiver during delivery",
        "Track shipment and update status in real time",
        "Issue official invoices and shipping documents",
        "Customer support and delivery issue resolution",
        "Improve our logistics service quality",
      ],
    },
    {
      icon: <Share2 className="w-5 h-5 text-brand-gold" />,
      titleAr: "مشاركة البيانات",
      titleEn: "Data Sharing",
      contentAr: [
        "نشارك بيانات التوصيل مع السائق المعين للطلب فقط",
        "قد نشارك مع شركاء التشغيل اللوجستي عند الضرورة",
        "لا نبيع أو نؤجر بياناتك لأي جهة ثالثة",
        "لا نشارك البيانات لأغراض تسويقية دون موافقتك",
        "نلتزم بلوائح حماية البيانات في دولة الإمارات العربية المتحدة",
      ],
      contentEn: [
        "Delivery data shared only with the assigned driver",
        "May share with logistics partners when operationally necessary",
        "We do not sell or rent your data to third parties",
        "No data shared for marketing without your consent",
        "We comply with UAE data protection regulations",
      ],
    },
    {
      icon: <Lock className="w-5 h-5 text-brand-gold" />,
      titleAr: "حماية البيانات",
      titleEn: "Data Security",
      contentAr: [
        "نستخدم قنوات آمنة (HTTPS/TLS) لجميع البيانات",
        "الوصول إلى البيانات مقيد بالمسؤولين المعتمدين فقط",
        "لا يتم تخزين بيانات بطاقات الائتمان أو بيانات الدفع الحساسة",
        "نراجع إجراءات الأمن بشكل دوري",
      ],
      contentEn: [
        "All data transmitted over secure HTTPS/TLS channels",
        "Data access restricted to authorized personnel only",
        "No credit card or sensitive payment data is stored",
        "Security procedures reviewed periodically",
      ],
    },
    {
      icon: <Clock className="w-5 h-5 text-brand-gold" />,
      titleAr: "الاحتفاظ بالبيانات",
      titleEn: "Data Retention",
      contentAr: [
        "بيانات الطلبات تُحفظ لمدة لا تتجاوز 24 شهراً",
        "بيانات التتبع متاحة للمرسل طوال فترة الطلب",
        "بيانات الحسابات المؤسسية تُحفظ طوال فترة العقد + 12 شهراً",
        "يمكنك طلب حذف بياناتك في أي وقت",
      ],
      contentEn: [
        "Order data retained for no more than 24 months",
        "Tracking data available to sender during active order",
        "Corporate account data retained for contract duration + 12 months",
        "You may request deletion of your data at any time",
      ],
    },
    {
      icon: <UserCheck className="w-5 h-5 text-brand-gold" />,
      titleAr: "حقوقك كعميل",
      titleEn: "Your Rights as a Customer",
      contentAr: [
        "الحق في الاطلاع على بياناتك التي نحتفظ بها",
        "الحق في تصحيح أي بيانات غير دقيقة",
        "الحق في طلب حذف بياناتك",
        "الحق في الاعتراض على معالجة بياناتك",
        "الحق في تقديم شكوى لهيئة حماية البيانات",
      ],
      contentEn: [
        "Right to access your personal data",
        "Right to correct inaccurate information",
        "Right to request deletion of your data",
        "Right to object to data processing",
        "Right to lodge a complaint with UAE data authority",
      ],
    },
  ];

  return (
    <div
      className={`max-w-4xl mx-auto space-y-10 ${isArabic ? "text-right" : "text-left"}`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* Header */}
      <section className="text-center space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-widest inline-block font-mono">
          Privacy Policy • سياسة الخصوصية
        </span>
        <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight ${headingColor}`}>
          {isArabic ? "سياسة الخصوصية وحماية البيانات" : "Privacy Policy & Data Protection"}
        </h2>
        <p className={`text-sm leading-relaxed max-w-2xl mx-auto ${mutedColor}`}>
          {isArabic
            ? "نحن في داي نايت لخدمات التوصيل نولي أهمية قصوى لخصوصيتك وحماية بياناتك الشخصية. توضح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها."
            : "At Day Night Delivery Services, we take your privacy seriously. This policy explains how we collect, use, and protect your personal data."}
        </p>
        <p className={`text-xs ${mutedColor}`}>
          {isArabic ? "آخر تحديث: يونيو 2026" : "Last updated: June 2026"}
        </p>
      </section>

      {/* Sections */}
      <div className="space-y-5">
        {sections.map((sec, idx) => (
          <div key={idx} className={`rounded-2xl p-6 border space-y-4 ${base}`}>
            <div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
              <div className="w-10 h-10 bg-brand-gold/10 border border-brand-gold/20 rounded-xl flex items-center justify-center shrink-0">
                {sec.icon}
              </div>
              <div>
                <h3 className={`font-extrabold text-base leading-tight ${headingColor}`}>
                  {isArabic ? sec.titleAr : sec.titleEn}
                </h3>
                <p className={`text-[10px] font-mono uppercase tracking-wider ${mutedColor}`}>
                  {isArabic ? sec.titleEn : sec.titleAr}
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {(isArabic ? sec.contentAr : sec.contentEn).map((item, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${bodyColor} ${isArabic ? "flex-row-reverse" : ""}`}>
                  <span className="text-brand-gold shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Contact for privacy */}
      <div className={`rounded-2xl p-6 border space-y-4 ${base}`}>
        <h3 className={`font-extrabold text-base ${headingColor}`}>
          {isArabic ? "التواصل بشأن الخصوصية" : "Privacy Contact"}
        </h3>
        <p className={`text-sm ${bodyColor}`}>
          {isArabic
            ? "إذا كان لديك أي استفسار بشأن هذه السياسة أو بيانات شخصية، تواصل معنا:"
            : "For any privacy or data questions, contact us:"}
        </p>
        <div className={`flex flex-col sm:flex-row gap-3 ${isArabic ? "sm:flex-row-reverse" : ""}`}>
          <a
            href={`mailto:${companyMeta.email}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold rounded-xl text-sm font-bold hover:bg-brand-gold/20 transition-colors"
          >
            <Mail className="w-4 h-4" />
            {companyMeta.email}
          </a>
          <a
            href={`tel:${companyMeta.phone}`}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-bold transition-colors ${
              isLight
                ? "border-brand-deep/10 text-brand-deep hover:bg-brand-deep/5"
                : "border-white/10 text-white/80 hover:bg-white/5"
            }`}
            dir="ltr"
          >
            <Phone className="w-4 h-4" />
            {companyMeta.phone}
          </a>
        </div>
      </div>

      {/* Disclaimer */}
      <p className={`text-xs text-center ${mutedColor} max-w-2xl mx-auto leading-relaxed`}>
        {isArabic
          ? "تخضع هذه السياسة لقوانين دولة الإمارات العربية المتحدة. نحتفظ بالحق في تحديثها عند الحاجة مع إخطار العملاء المتأثرين."
          : "This policy is governed by UAE law. We reserve the right to update it as needed and will notify affected customers of material changes."}
      </p>
    </div>
  );
}
