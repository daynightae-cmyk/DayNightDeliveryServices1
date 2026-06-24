/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { BadgeCheck, Sparkles, Instagram, Code, HeartHandshake, RefreshCw } from "lucide-react";
import { businessContent } from "../data/businessContent";

interface ECommerceProps {
  onNavigate: (tab: string) => void;
}

export default function ECommerce({ onNavigate }: ECommerceProps) {
  const platforms = [
    { name: "متاجر Instagram", icon: <Instagram className="w-5 h-5 text-pink-500" /> },
    { name: "متاجر TikTok", icon: <Sparkles className="w-5 h-5 text-indigo-400" /> },
    { name: "متاجر Shopify", icon: <Code className="w-5 h-5 text-emerald-500" /> },
    { name: "متاجر WooCommerce", icon: <Code className="w-5 h-5 text-purple-500" /> },
    { name: "المشاريع المنزلية والمحلية", icon: <HeartHandshake className="w-5 h-5 text-amber-500" /> }
  ];

  const packages = [
    {
      title_ar: "باقة البداية (Starter)",
      title_en: "Starter Plan",
      desc_ar: "مناسبة للمتاجر متناهية الصغر والطلبات غير اليومية والمشاريع المنزلية.",
      desc_en: "Perfect for nano outlets, remote projects, and occasional courier shipments.",
      features_ar: ["شحن مرن بدفع فوري", "المدن والمناطق الرئيسية 30 درهم", "دعم الدفع عند الاستلام COD", "متابعة الطلبات المباشرة"],
      price_ar: "حسب الاستخدام"
    },
    {
      title_ar: "باقة النمو (Growth)",
      title_en: "Growth Plan",
      desc_ar: "مناسبة للمتاجر النشطة التي تملك مبيعات أسبوعية أو طرود شبه يومية قيد التجهيز.",
      desc_en: "Designed for running retail platforms with multi-weekly requests.",
      features_ar: ["استلام مجاني من منزلك/مستودعك", "دعم مخصص عبر الواتساب والهاتف", "تسوية مالية سريعة وممنهجة", "أسعار موثوقة ومجدولة للعين والغربية"],
      price_ar: "أسعار تفضيلية"
    },
    {
      title_ar: "باقة الشركات (Corporate)",
      title_en: "Corporate Premium",
      desc_ar: "عقود شهرية، توصيلات يومية منتظمة وتسهيلات متكاملة للشركات الكبيرة والمستودعات.",
      desc_en: "Bulk handling, priority drivers, scheduled returns, and optimized accounts setup.",
      features_ar: ["دعم مخصص على مدار الساعة", "مدير حساب لوجستي حصري للمتجر", "توصيلات وعينات يومية منتظمة", "بوابة تتبع موحدة لكافة شحنات العمال"],
      price_ar: "عقود سنوية / شهرية"
    }
  ];

  const ecommerceFeatures = businessContent.ecommerce.features;

  return (
    <div className="space-y-12 text-right">
      {/* Intro section */}
      <section className="bg-brand-cool/50 backdrop-blur-md text-white p-8 sm:p-12 border border-white/10 rounded-3xl relative overflow-hidden text-center max-w-4xl mx-auto space-y-6">
        <span className="bg-brand-deep border border-white/10 rounded-full px-3 py-1 text-xs text-brand-gold font-mono tracking-wider inline-block">
          Merchant Accounts • حلول المتاجر الاحترافية
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-brand-gold to-white tracking-tight leading-tight">
          توصيل منظم يعزز ثقة عملاء متجرك الإلكتروني
        </h2>
        <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
          {businessContent.ecommerce.summaryAr}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ecommerceFeatures.map((feature) => (
          <div key={feature} className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 flex items-center justify-end gap-3">
            <span className="text-white/80 text-sm font-bold text-right">{feature}</span>
            <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>
        ))}
      </section>

      {/* Target Audiences */}
      <section className="space-y-6 text-center">
        <h3 className="text-xl font-bold text-white border-b border-white/10 pb-3">نخدم وندعم المتاجر والشركات المتخصصة</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {platforms.map((p, idx) => (
            <div id={`platform_${idx}`} key={idx} className="bg-brand-cool/30 border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-semibold text-white">
              {p.icon}
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended Pricing Packages */}
      <section className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold text-white">الباقات والحلول المقترحة للمتاجر والشركات</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {packages.map((pkg, idx) => (
            <motion.div
              id={`pkg_card_${idx}`}
              key={idx}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 flex flex-col justify-between hover:border-brand-gold/50 hover:shadow-2xl hover:shadow-brand-gold/5 transition-all"
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-bold text-white">{pkg.title_ar}</h4>
                  <p className="text-xs text-white/40 font-bold font-mono uppercase">{pkg.title_en}</p>
                </div>
                
                <div className="bg-brand-deep p-4 rounded-xl text-center border border-white/5">
                  <p className="text-xs text-white/40">التسعير الأساسي المتوقع</p>
                  <p className="text-lg font-extrabold text-brand-gold mt-1">{pkg.price_ar}</p>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-xs text-white/45 font-bold">وصف المخطط اللوجستي والمزايا:</p>
                  <ul className="space-y-2 text-sm text-white/80">
                    {pkg.features_ar.map((feat, f_idx) => (
                      <li key={f_idx} className="flex items-start gap-2 justify-end text-right">
                        <span>{feat}</span>
                        <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10">
                <button
                  id={`select_pkg_${idx}`}
                  onClick={() => onNavigate("contact")}
                  className="w-full py-2.5 bg-brand-gold hover:bg-brand-blue hover:text-white text-brand-deep font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  تواصل معنا للاشتراك
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Dynamic CTA */}
      <section className="bg-brand-cool/40 border border-white/10 p-8 rounded-3xl text-center space-y-4">
        <h3 className="text-xl font-bold text-white">هل تملك عدداً كبيراً من الطرود الأسبوعية؟</h3>
        <p className="text-white/70 text-sm max-w-xl mx-auto leading-relaxed">
          نحن نقدم أسعاراً خاصة وعقود خدمة لوجستية تنافسية لأصحاب المبيعات الكثيفة. تواصل معنا لمناقشة أرقام التكلفة المناسبة وحلول الاستلام الميسرة.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            id="merchant_cta_wa"
            href="https://wa.me/971568757331?text=السلام%20عليكم،%20أنا%20صاحب%20متجر%20إلكتروني%20وأريد%20التعاقد%2520على%2520أسعار%2520توصيل%2520خاصة"
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm hover:scale-103 transition-transform inline-block cursor-pointer"
          >
            اطلب عرض سعر مخصص عبر واتساب
          </a>
          <a
            id="ecommerce_whatsapp_catalog"
            href="https://wa.me/c/971568757331"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs sm:text-sm hover:scale-103 transition-transform inline-block cursor-pointer"
          >
            عرض كتالوج واتساب / View WhatsApp Catalog
          </a>
        </div>
      </section>
    </div>
  );
}
