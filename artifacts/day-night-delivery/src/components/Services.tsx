/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Gift,
  Globe2,
  HeartPulse,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Timer,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";

interface ServicesProps {
  onNavigate: (tab: string) => void;
}

const services = [
  {
    icon: MapPin,
    titleAr: "التوصيل المحلي داخل الإمارات",
    titleEn: "Local UAE Delivery",
    descAr: "استلام وتسليم الطرود والطلبات اليومية بين مدن الإمارات بتسعير واضح وتجربة متابعة منظمة.",
    descEn: "Pickup and delivery across UAE cities with clear pricing and organized shipment follow-up.",
    badgeAr: "محلي",
    badgeEn: "Local",
  },
  {
    icon: Zap,
    titleAr: "التوصيل السريع",
    titleEn: "Express Delivery",
    descAr: "مسار مخصص للطلبات العاجلة والمستندات الحساسة للوقت حسب توفر التشغيل والمسار.",
    descEn: "A focused path for urgent orders and time-sensitive documents based on route availability.",
    badgeAr: "سريع",
    badgeEn: "Express",
  },
  {
    icon: Timer,
    titleAr: "تشغيل على مدار الساعة",
    titleEn: "24/7 Dispatch",
    descAr: "قنوات استقبال ومتابعة مستمرة لدعم المتاجر والشركات في أوقات الذروة والطلبات المتتابعة.",
    descEn: "Continuous intake and follow-up channels for merchants and companies during peak operations.",
    badgeAr: "24/7",
    badgeEn: "24/7",
  },
  {
    icon: ShoppingBag,
    titleAr: "توصيل المتاجر الإلكترونية",
    titleEn: "E-Commerce Logistics",
    descAr: "ربط عملي للطلبات، التحصيل، التتبع، وحالة التسليم لتقليل الضغط التشغيلي على المتجر.",
    descEn: "Order, collection, tracking, and delivery-status workflows built for online merchants.",
    badgeAr: "متاجر",
    badgeEn: "Commerce",
  },
  {
    icon: Building2,
    titleAr: "حلول الشركات والعقود",
    titleEn: "Corporate Solutions",
    descAr: "خدمة موجهة للفرق والفروع والجهات التي تحتاج انتظاماً في الاستلام والتسليم والتقارير.",
    descEn: "Structured pickup, delivery, and reporting support for teams, branches, and organizations.",
    badgeAr: "شركات",
    badgeEn: "Business",
  },
  {
    icon: FileText,
    titleAr: "المستندات والوثائق",
    titleEn: "Documents & Files",
    descAr: "نقل مستندات وعقود وأوراق رسمية بعناية عالية مع متابعة حالة الطلب حتى التسليم.",
    descEn: "Careful handling for documents, contracts, and official files with status visibility.",
    badgeAr: "وثائق",
    badgeEn: "Docs",
  },
  {
    icon: Gift,
    titleAr: "الهدايا والطلبات الخاصة",
    titleEn: "Gifts & Special Orders",
    descAr: "تنسيق تسليم الهدايا والطلبات الحساسة للتوقيت بطريقة مرتبة ومناسبة لطبيعة الطلب.",
    descEn: "Coordinated delivery for gifts and time-sensitive special orders with careful handling.",
    badgeAr: "خاص",
    badgeEn: "Special",
  },
  {
    icon: UtensilsCrossed,
    titleAr: "المطاعم والمقاهي",
    titleEn: "F&B Dispatch",
    descAr: "دعم تشغيل المطاعم والمقاهي في الطلبات الخارجية حسب المسار والتوفر التشغيلي.",
    descEn: "Delivery support for restaurants and cafes based on route and operational availability.",
    badgeAr: "مطاعم",
    badgeEn: "F&B",
  },
  {
    icon: HeartPulse,
    titleAr: "الصيدليات ومنتجات العناية",
    titleEn: "Pharmacy & Care Products",
    descAr: "تسليم منتجات العناية والمستلزمات المسموح بها مع عناية في الاستلام والتسليم.",
    descEn: "Delivery for approved care products and pharmacy-related items with careful handling.",
    badgeAr: "عناية",
    badgeEn: "Care",
  },
  {
    icon: DollarSign,
    titleAr: "الدفع عند الاستلام",
    titleEn: "Cash on Delivery",
    descAr: "تحصيل مبالغ الطلبات وتسوية بياناتها ضمن مسار واضح للمتجر والعمليات.",
    descEn: "COD collection and settlement visibility for merchant and operations workflows.",
    badgeAr: "تحصيل",
    badgeEn: "COD",
  },
  {
    icon: Globe2,
    titleAr: "الشحن الدولي",
    titleEn: "International Shipping",
    descAr: "خيارات شحن خارج الإمارات حسب الوجهة والوزن ومتطلبات التشغيل المتاحة.",
    descEn: "International shipping options based on destination, weight, and available service requirements.",
    badgeAr: "دولي",
    badgeEn: "Global",
  },
];

export default function Services({ onNavigate }: ServicesProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const Arrow = isArabic ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-10" dir={isArabic ? "rtl" : "ltr"}>
      <section className="dn-finish-surface rounded-[2.6rem] p-6 text-center sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-brand-gold">
          <ShieldCheck className="h-4 w-4" />
          {isArabic ? "حلول تشغيل متكاملة" : "Integrated Operations Services"}
        </span>
        <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-black leading-tight text-white sm:text-5xl">
          {isArabic ? "خدمات توصيل وشحن مصممة للتشغيل اليومي" : "Delivery and shipping services built for daily operations"}
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm font-bold leading-8 text-white/64">
          {isArabic
            ? "اختر الخدمة المناسبة، أو افتح طلب توصيل مباشرة. كل مسار مرتبط بالتتبع والدعم وبوابات التاجر والمندوب عند توفر الحسابات."
            : "Choose the right service or create a delivery request directly. Every path connects to tracking, support, and merchant or driver portals when accounts are available."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => onNavigate("request")} className="dn-btn dn-btn-primary dn-btn-lg">
            {isArabic ? "اطلب توصيل الآن" : "Request delivery"}
          </button>
          <button type="button" onClick={() => onNavigate("pricing")} className="dn-btn dn-btn-secondary dn-btn-lg">
            {isArabic ? "افتح الأسعار والحاسبة" : "Open pricing calculator"}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {services.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.article
              id={`full_service_card_${index}`}
              key={item.titleEn}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (index % 3) * 0.08, duration: 0.42 }}
              className="dn-finish-card flex flex-col justify-between rounded-[1.8rem] p-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-brand-gold">
                    {isArabic ? item.badgeAr : item.badgeEn}
                  </span>
                </div>

                <div className={isArabic ? "text-right" : "text-left"}>
                  <h2 className="text-xl font-black text-white">{isArabic ? item.titleAr : item.titleEn}</h2>
                  <p className="mt-1 text-xs font-black uppercase tracking-wider text-brand-gold">{isArabic ? item.titleEn : item.titleAr}</p>
                  <p className="mt-3 text-sm font-bold leading-7 text-white/66">{isArabic ? item.descAr : item.descEn}</p>
                </div>
              </div>

              <button
                id={`service_request_btn_${index}`}
                type="button"
                onClick={() => onNavigate("request")}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold transition hover:bg-brand-gold hover:text-brand-deep"
              >
                <span>{isArabic ? "طلب هذه الخدمة" : "Request this service"}</span>
                <Arrow className="h-4 w-4" />
              </button>
            </motion.article>
          );
        })}
      </section>

      <section className="dn-finish-surface rounded-[2.2rem] p-6 text-center sm:p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-gold">DAY NIGHT SERVICE STANDARD</p>
          <h2 className="text-2xl font-black text-white">{isArabic ? "تحتاج مساراً خاصاً؟" : "Need a custom route?"}</h2>
          <p className="text-sm font-bold leading-8 text-white/66">
            {isArabic
              ? "للطلبات الكبيرة، الجداول المتكررة، الفروع، أو الوجهات غير المدرجة، تواصل معنا لتحديد المسار والسعر قبل التشغيل."
              : "For large orders, recurring schedules, branches, or unlisted destinations, contact us to confirm the route and quote before dispatch."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button onClick={() => onNavigate("contact")} className="dn-btn dn-btn-primary dn-btn-md" type="button">
              {isArabic ? "تواصل معنا" : "Contact us"}
            </button>
            <a id="services_whatsapp_catalog" href="https://wa.me/c/971568757331" target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md">
              {isArabic ? "كتالوج واتساب" : "WhatsApp catalog"}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
