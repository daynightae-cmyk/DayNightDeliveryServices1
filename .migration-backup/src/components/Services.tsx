/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { 
  Building2, 
  ChevronRight, 
  MapPin, 
  Zap, 
  Timer, 
  ShoppingBag, 
  FileText, 
  Gift, 
  UtensilsCrossed, 
  HeartPulse, 
  DollarSign, 
  Globe2 
} from "lucide-react";

interface ServicesProps {
  onNavigate: (tab: string) => void;
}

export default function Services({ onNavigate }: ServicesProps) {
  const serviceItems = [
    {
      icon: <MapPin className="w-8 h-8 text-blue-600" />,
      title_ar: "التوصيل المحلي داخل الإمارات",
      title_en: "Local UAE Delivery",
      desc_ar: "استلام الطرود الصغيرة والمتوسطة والطلبات الشخصية والهدايا من الباب إلى الباب مع تغطية شاملة لكافة المدن.",
      desc_en: "Reliable small, medium, and personal cargo solutions from door to door in any city or suburb.",
      badge: "دائم"
    },
    {
      icon: <Zap className="w-8 h-8 text-amber-500" />,
      title_ar: "التوصيل السريع (Express)",
      title_en: "Express Core Delivery",
      desc_ar: "خدمة توصيل سريعة ومضمونة في نفس اليوم أو خلال ساعات للمستندات والطلبات والسلع العاجلة.",
      desc_en: "Rapid same-day and time-sensitive cargo and files courier for ultimate time-critical operations.",
      badge: "سريع"
    },
    {
      icon: <Timer className="w-8 h-8 text-amber-600" />,
      title_ar: "التوصيل على مدار الساعة 24/7",
      title_en: "24/7 Dispatch Hub",
      desc_ar: "خدمة مرنة تتواصل طوال النهار والليل للشركات والمتاجر الإلكترونية للرد وتلبية الاحتياجات في أي وقت.",
      desc_en: "Flexible uninterrupted logistics operating seamlessly day and night to keep your supply chain active.",
      badge: "نشط"
    },
    {
      icon: <ShoppingBag className="w-8 h-8 text-blue-600" />,
      title_ar: "توصيل المتاجر الإلكترونية",
      title_en: "E-Commerce Logistics",
      desc_ar: "حلول مخصصة لمتاجر Shopify وInstagram وTikTok لتنظيم عمليات الشحن للمشترين وزيادة المبيعات.",
      desc_en: "Order pick-and-pack, sorting, and flawless final transits for independent and corporate retailers.",
      badge: "توفير"
    },
    {
      icon: <Building2 className="w-8 h-8 text-blue-800" />,
      title_ar: "خدمات الشركات والمؤسسات",
      title_en: "Corporate Enterprise Solutions",
      desc_ar: "عقود شهرية مخصصة، توصيل متبادل بين الفروع، نقل الأوراق والطرود للجهات الحكومية والخاصة مع دعم حصري.",
      desc_en: "Bespoke contracts, inter-branch courier, invoice transits, and tailored rates based on consistent volumes.",
      badge: "احترافي"
    },
    {
      icon: <FileText className="w-8 h-8 text-blue-600" />,
      title_ar: "توصيل المستندات والوثائق الرسمية",
      title_en: "Confidential Legal Documents",
      desc_ar: "نقل آمن وعاجل للعقود، الفواتير، والأوراق الرسمية لمكاتب المحاماة والشركات بعناية وحرية خصوصية مطلقة.",
      desc_en: "Highly secured transit for legal paper, certificates, and state authority files with strict confidentiality.",
      badge: "آمن"
    },
    {
      icon: <Gift className="w-8 h-8 text-red-500" />,
      title_ar: "توصيل الهدايا والطلبات الخاصة",
      title_en: "Bespoke Gift Transits",
      desc_ar: "إرسال الباقات، الهدايا والمنتجات الشخصية بطريقة منسقة ولطيفة تناسب المناسبات والاتفاق المفاجئ للعميل.",
      desc_en: "Premium, carefully handled presentation and carriage of celebratory gifts and surprises directly to receivers.",
      badge: "مناسبات"
    },
    {
      icon: <UtensilsCrossed className="w-8 h-8 text-amber-600" />,
      title_ar: "خدمات المطاعم والمقاهي",
      title_en: "F&B Delivery Dispatch",
      desc_ar: "إيصال الوجبات والمشروبات للزبائن بسلاسة وسرعة لتخفيف الضغط ودعم أوقات الذروة باحترافية تامة.",
      desc_en: "Reliable food-grade carriage supporting cloud kitchens, restaurants, and cafes during rush times.",
      badge: "طعام"
    },
    {
      icon: <HeartPulse className="w-8 h-8 text-emerald-500" />,
      title_ar: "خدمات الصيدليات والمنتجات الطبية",
      title_en: "Healthcare & Pharmacies",
      desc_ar: "توصيل آمن للمستلزمات الصحية ومستحضرات العناية بالبشرة والخدمات ومتابعة دقيقة لبيانات المرضى والمراكز الطبية.",
      desc_en: "Time-aware healthcare and pharmacy deliveries for personal care products under stable requirements.",
      badge: "صحة"
    },
    {
      icon: <DollarSign className="w-8 h-8 text-emerald-600" />,
      title_ar: "الدفع عند الاستلام (COD)",
      title_en: "Cash on Delivery",
      desc_ar: "تحصيل مستحقات الطلبات وتسوية مالية دورية شفافة وسريعة لتيسير التجارة وتحسين الثقة مع المشترين.",
      desc_en: "Secure payment generation and timely ledger reconciliations to amplify customer trust and growth.",
      badge: "مالي"
    },
    {
      icon: <Globe2 className="w-8 h-8 text-indigo-600" />,
      title_ar: "الشحن الدولي",
      title_en: "International Freight Services",
      desc_ar: "خيارات ممتازة لشحن طرودك إلى دول مجلس التعاون الخليجي والشرق الأوسط والعالم بأسعار شفافة واضحة.",
      desc_en: "Air and land logistics solutions covering GCC, EU, USA, Canada, Australia, and key international transits.",
      badge: "دولي"
    }
  ];

  return (
    <div className="space-y-12 text-right">
      {/* Services Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Logistic Services • حلول النقل الكاملة
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          خدماتنا المتنوعة والدقيقة
        </h2>
        <p className="text-white/60 text-sm sm:text-base">
          نقدم باقة واسعة من خدمات النقل الخفيف والبريد والكورير السريع لتناسب احتياجاتكم الشخصية والتجارية بدقة تامة.
        </p>
      </section>

      {/* Services Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {serviceItems.map((item, index) => (
          <motion.div
            id={`full_service_card_${index}`}
            key={index}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (index % 3) * 0.1, duration: 0.5 }}
            className="bg-brand-cool/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:border-brand-gold/50 hover:shadow-2xl hover:shadow-brand-gold/5 transition-all duration-300 group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-brand-gold/25 transition-colors">
                  <span className="text-brand-gold">
                    {item.icon}
                  </span>
                </div>
                <span className="bg-white/5 text-brand-gold text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/10">
                  {item.badge}
                </span>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white group-hover:text-brand-gold transition-colors">
                  {item.title_ar}
                </h3>
                <p className="text-xs text-white/40 font-bold font-mono uppercase tracking-wide">
                  {item.title_en}
                </p>
                <p className="text-white/70 text-sm leading-relaxed">
                  {item.desc_ar}
                </p>
                <p className="text-white/40 text-xs leading-relaxed italic">
                  {item.desc_en}
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex justify-end">
              <button
                id={`hire_btn_${index}`}
                onClick={() => onNavigate("request")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gold hover:text-white transition-colors font-sans cursor-pointer"
              >
                <span>اطلب هذه الخدمة الآن</span>
                <ChevronRight className="w-4 h-4 text-brand-gold" />
              </button>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Dynamic Trust Strip */}
      <section className="bg-brand-cool/50 backdrop-blur-md text-white rounded-2xl p-6 sm:p-10 text-center border border-white/10">
        <div className="max-w-xl mx-auto space-y-4">
          <p className="text-brand-gold font-mono tracking-widest text-xs uppercase font-bold">Standard SLA & Handling</p>
          <h3 className="text-xl font-bold">هل تبحث عن حلول خاصة وحصرية لشحناتك الكبيرة؟</h3>
          <p className="text-white/70 text-xs sm:text-sm">
            نحن جاهزون لتلبية المتطلبات الخاصة من فواتير مخصصة، تغليف احترافي، نقل طرود حساسة للكسر، وتأكيد فوري للوجهات غير المدرجة بلمح البصر.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onNavigate("contact")}
              className="px-6 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-lg text-xs transition-colors cursor-pointer"
            >
              اتصل بنا لمناقشة التفاصيل
            </button>
            <a
              id="services_whatsapp_catalog"
              href="https://wa.me/c/971568757331"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-lg text-xs transition-colors cursor-pointer text-center"
            >
              عرض كتالوج واتساب / View WhatsApp Catalog
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
