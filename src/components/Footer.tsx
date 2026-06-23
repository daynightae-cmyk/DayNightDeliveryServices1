import { Mail, MapPin, Phone, Facebook, Instagram, Linkedin, Twitter, Zap, Globe, Heart } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import companyMeta from "../data/companyMeta";

export default function Footer() {
  const { language } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";

  return (
    <footer className="bg-gradient-to-b from-brand-deep/60 to-brand-cool/80 backdrop-blur-sm border-t border-white/10 font-sans">
      {/* Premium Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-6 mb-12">
          {/* Brand Block */}
          <div className={isArabic ? "md:col-span-1 md:text-right" : "md:col-span-1"}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold/60 flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-deep" />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-wide">DAY NIGHT</h3>
                <p className="text-xs text-brand-gold font-bold">DELIVERY</p>
              </div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              {language === "en"
                ? "Professional logistics & shipping solutions for UAE and worldwide."
                : "حلول لوجستية وشحن احترافية داخل وخارج الإمارات العربية المتحدة."}
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {companyMeta.socials
                .filter((s) => ["facebook", "instagram", "linkedin", "twitter"].includes(s.id))
                .map((social) => {
                  const IconComponent =
                    social.id === "facebook"
                      ? Facebook
                      : social.id === "instagram"
                        ? Instagram
                        : social.id === "linkedin"
                          ? Linkedin
                          : Twitter;
                  return (
                    <a
                      key={social.id}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-brand-gold transition-all duration-300 border border-white/10 hover:border-brand-gold/30"
                      aria-label={social.nameEn}
                    >
                      <IconComponent className="w-4 h-4" />
                    </a>
                  );
                })}
            </div>
          </div>

          {/* Quick Links */}
          <div className={isArabic ? "md:text-right" : ""}>
            <h4 className="text-sm font-bold text-white/90 mb-4 uppercase tracking-wider">
              {language === "en" ? "Navigation" : "التصفح"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { en: "Home", ar: "الرئيسية", path: "/" },
                { en: "Pricing", ar: "الأسعار", path: "/pricing" },
                { en: "Services", ar: "الخدمات", path: "/services" },
                { en: "Tracking", ar: "التتبع", path: "/tracking" },
              ].map((link) => (
                <li key={link.path}>
                  <a
                    href={link.path}
                    className="text-white/60 hover:text-brand-gold text-sm transition-colors duration-200"
                  >
                    {language === "ar" ? link.ar : link.en}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className={isArabic ? "md:text-right" : ""}>
            <h4 className="text-sm font-bold text-white/90 mb-4 uppercase tracking-wider">
              {language === "en" ? "Services" : "الخدمات"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { en: "UAE Delivery", ar: "التوصيل الإماراتي", path: "/uae-delivery" },
                { en: "Global Shipping", ar: "الشحن الدولي", path: "/international-shipping" },
                { en: "E-Commerce", ar: "حلول المتاجر", path: "/ecommerce" },
                { en: "Corporate", ar: "حلول الشركات", path: "/corporate" },
              ].map((link) => (
                <li key={link.path}>
                  <a
                    href={link.path}
                    className="text-white/60 hover:text-brand-gold text-sm transition-colors duration-200"
                  >
                    {language === "ar" ? link.ar : link.en}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className={isArabic ? "md:text-right" : ""}>
            <h4 className="text-sm font-bold text-white/90 mb-4 uppercase tracking-wider">
              {language === "en" ? "Support" : "الدعم"}
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={`tel:${companyMeta.phone}`}
                  className="flex items-center gap-2 text-white/60 hover:text-brand-gold text-sm transition-colors duration-200"
                >
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span>{companyMeta.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${companyMeta.email}`}
                  className="flex items-center gap-2 text-white/60 hover:text-brand-gold text-sm transition-colors duration-200"
                >
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="break-all">{companyMeta.email}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/971568757331"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/60 hover:text-brand-gold text-sm transition-colors duration-200"
                >
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <span>{language === "en" ? "WhatsApp" : "واتساب"}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Stats / Trust */}
          <div className={isArabic ? "md:text-right" : ""}>
            <h4 className="text-sm font-bold text-white/90 mb-4 uppercase tracking-wider">
              {language === "en" ? "Why Us" : "لماذا نحن"}
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-brand-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-white/80 font-semibold">
                    {language === "en" ? "24/7 Service" : "خدمة 24/7"}
                  </p>
                  <p className="text-xs text-white/50">{language === "en" ? "Round-the-clock" : "على مدار الساعة"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Heart className="w-4 h-4 text-brand-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-white/80 font-semibold">
                    {language === "en" ? "Premium Care" : "رعاية متميزة"}
                  </p>
                  <p className="text-xs text-white/50">{language === "en" ? "Safety first" : "الأمان أولاً"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8">
          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/50 text-center md:text-left">
              © 2024-2026 {companyMeta.companyName}. {language === "en" ? "All rights reserved." : "جميع الحقوق محفوظة."}
            </p>
            <p className="text-xs text-brand-gold/80 font-semibold text-center">
              {language === "en"
                ? "Fast • Reliable • Professional • 24/7"
                : "سريع • موثوق • احترافي • 24/7"}
            </p>
            <div className="flex items-center gap-2">
              <a href="/policy" className="text-xs text-white/50 hover:text-white/80 transition-colors">
                {language === "en" ? "Policy" : "السياسة"}
              </a>
              <span className="text-white/20">•</span>
              <a href="/contact" className="text-xs text-white/50 hover:text-white/80 transition-colors">
                {language === "en" ? "Contact" : "اتصل"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
