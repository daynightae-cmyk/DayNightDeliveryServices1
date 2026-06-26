import { motion } from "motion/react";
import {
  Mail,
  MapPin,
  Phone,
  Facebook,
  Instagram,
  MessageSquare,
  Heart,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Shield,
  Code2,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import companyMeta from "../data/companyMeta";
import { Link } from "react-router-dom";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export default function Footer() {
  const { language, theme } = useAppContext();
  const t = translations[language];
  const tf = t.footer;
  const isArabic = language === "ar";
  const isLight = theme === "light";

  const companyLinks = [
    { key: "home", label: isArabic ? "الرئيسية" : "Home", path: "/" },
    { key: "about", label: isArabic ? "من نحن" : "About Us", path: "/about" },
    { key: "services", label: isArabic ? "خدماتنا" : "Services", path: "/services" },
    { key: "gallery", label: isArabic ? "المعرض" : "Gallery", path: "/gallery" },
    { key: "faq", label: isArabic ? "الأسئلة الشائعة" : "FAQs", path: "/faq" },
    { key: "contact", label: isArabic ? "تواصل معنا" : "Contact", path: "/contact" },
  ];

  const serviceLinks = [
    { key: "uae", label: isArabic ? "توصيل داخل الإمارات" : "UAE Local Delivery", path: "/uae-delivery" },
    { key: "global", label: isArabic ? "الشحن الدولي" : "International Shipping", path: "/international-shipping" },
    { key: "ecommerce", label: isArabic ? "حلول التجارة الإلكترونية" : "E-Commerce Solutions", path: "/ecommerce" },
    { key: "corporate", label: isArabic ? "الشركات والعقود" : "Corporate & Contracts", path: "/corporate" },
    { key: "request", label: isArabic ? "اطلب توصيل" : "Request Delivery", path: "/request" },
    { key: "tracking", label: isArabic ? "تتبع شحنتك" : "Track Shipment", path: "/tracking" },
    { key: "qr", label: isArabic ? "خدمات QR الذكية" : "QR Services", path: "/qr" },
  ];

  const supportLinks = [
    { key: "pricing", label: isArabic ? "الأسعار والحاسبة" : "Pricing & Calculator", path: "/pricing", isRoute: true },
    { key: "policy", label: isArabic ? "سياسة الخدمة" : "Service Policy", path: "/policy", isRoute: true },
    { key: "privacy", label: isArabic ? "سياسة الخصوصية" : "Privacy Policy", path: "/privacy", isRoute: true },
    { key: "terms", label: isArabic ? "الشروط والأحكام" : "Terms & Conditions", path: "/terms", isRoute: true },
    { key: "admin", label: isArabic ? "لوحة الإدارة" : "Admin Portal", path: "/auth", isRoute: true },
    { key: "whatsapp", label: "WhatsApp", path: companyMeta.whatsappUrl, isRoute: false },
    { key: "email", label: companyMeta.email, path: `mailto:${companyMeta.email}`, isRoute: false },
  ];

  const socialLinks = [
    { key: "facebook", icon: Facebook, href: companyMeta.socials.facebook, label: "Facebook" },
    { key: "instagram", icon: Instagram, href: companyMeta.socials.instagram, label: "Instagram" },
    { key: "tiktok", icon: TikTokIcon, href: companyMeta.socials.tiktok, label: "TikTok" },
  ];

  const Arrow = isArabic ? ChevronLeft : ChevronRight;

  const linkClass = `group flex items-center gap-2 text-sm transition-colors duration-200 ${
    isArabic ? "flex-row-reverse" : ""
  } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`;

  const headingClass = `text-sm font-bold uppercase tracking-wider mb-5 ${
    isLight ? "text-brand-deep" : "text-white/90"
  }`;

  return (
    <footer
      className={`relative overflow-hidden border-t backdrop-blur-md ${
        isLight
          ? "bg-gradient-to-b from-white/60 to-[#DDE7F5]/80 border-brand-deep/10"
          : "bg-gradient-to-b from-brand-deep/60 to-brand-cool/80 border-white/10"
      }`}
    >
      <div
        className={`absolute top-0 ${isArabic ? "left-0" : "right-0"} w-96 h-96 rounded-full blur-[120px] pointer-events-none ${
          isLight ? "bg-brand-gold/10" : "bg-brand-gold/5"
        }`}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`flex flex-col md:flex-row items-center md:items-start gap-6 pb-12 border-b ${
            isLight ? "border-brand-deep/10" : "border-white/10"
          }`}
        >
          <div className="w-16 h-16 rounded-full shrink-0 overflow-hidden border-2 border-brand-gold/40 shadow-md">
            <img src={companyMeta.logoUrl} alt={companyMeta.name} className="w-full h-full object-contain" loading="lazy" />
          </div>
          <div className={`text-center md:${isArabic ? "text-right" : "text-left"} flex-1`}>
            <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${isLight ? "text-brand-deep" : "text-white"}`}>
              {companyMeta.name}
            </h3>
            <p className="text-brand-gold font-bold text-sm mb-1">
              {isArabic ? companyMeta.legalNameAr : tf.slogan}
            </p>
            <a href={companyMeta.website} target="_blank" rel="noopener noreferrer" className={`text-xs hover:text-brand-gold font-mono ${isLight ? "text-brand-deep/50" : "text-white/50"}`} dir="ltr">
              {companyMeta.displayWebsite}
            </a>
            <p className={`max-w-2xl text-sm leading-relaxed mt-2 ${isLight ? "text-brand-deep/70" : "text-white/70"}`}>
              {tf.description}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 py-12"
        >
          <div className={isArabic ? "text-right" : "text-left"}>
            <h4 className={headingClass}>{isArabic ? "الشركة" : "Company"}</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.key}>
                  <Link to={link.path} className={linkClass}>
                    <Arrow className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={isArabic ? "text-right" : "text-left"}>
            <h4 className={headingClass}>{isArabic ? "الخدمات" : "Services"}</h4>
            <ul className="space-y-3">
              {serviceLinks.map((link) => (
                <li key={link.key}>
                  <Link to={link.path} className={linkClass}>
                    <Arrow className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={isArabic ? "text-right" : "text-left"}>
            <h4 className={headingClass}>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-brand-gold" />
                {isArabic ? "الدعم" : "Support"}
              </span>
            </h4>
            <ul className="space-y-3">
              {supportLinks.map((link) => (
                <li key={link.key}>
                  {link.isRoute ? (
                    <Link to={link.path} className={linkClass}>
                      <Arrow className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      <span>{link.label}</span>
                    </Link>
                  ) : (
                    <a
                      href={link.path}
                      target={link.key === "whatsapp" ? "_blank" : undefined}
                      rel={link.key === "whatsapp" ? "noopener noreferrer" : undefined}
                      className={linkClass}
                    >
                      <Arrow className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      <span className="break-all">{link.label}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className={isArabic ? "text-right" : "text-left"}>
            <h4 className={headingClass}>{isArabic ? "التواصل" : "Contact"}</h4>
            <ul className="space-y-4">
              <li>
                <a href={`tel:${companyMeta.phone}`} className={linkClass} dir="ltr">
                  <Phone className="w-4 h-4 text-brand-gold shrink-0" />
                  <span>{companyMeta.phone}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${companyMeta.email}`} className={linkClass}>
                  <Mail className="w-4 h-4 text-brand-gold shrink-0" />
                  <span className="break-all">{companyMeta.email}</span>
                </a>
              </li>
              <li>
                <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <MessageSquare className="w-4 h-4 text-brand-gold shrink-0" />
                  <span>WhatsApp</span>
                </a>
              </li>
              <li>
                <a href={companyMeta.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <ExternalLink className="w-4 h-4 text-brand-gold shrink-0" />
                  <span dir="ltr">{companyMeta.displayWebsite}</span>
                </a>
              </li>
              <li>
                <a href={companyMeta.mapUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
                  <span>{isArabic ? companyMeta.addressAr : companyMeta.addressEn}</span>
                </a>
              </li>
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`flex flex-col sm:flex-row items-center justify-between gap-6 py-8 border-t ${
            isLight ? "border-brand-deep/10" : "border-white/10"
          }`}
        >
          <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-brand-deep/60" : "text-white/60"}`}>
              {tf.followUs}
            </span>
            <div className={`flex gap-2 ${isArabic ? "mr-2" : "ml-2"}`}>
              {socialLinks.map(
                (social) =>
                  social.href && (
                    <a
                      key={social.key}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className={`p-2.5 rounded-xl transition-all duration-300 border ${
                        isLight
                          ? "bg-white/50 text-brand-deep/70 border-brand-deep/10 hover:bg-brand-gold hover:text-brand-deep hover:border-brand-gold"
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-brand-gold hover:border-brand-gold/30"
                      }`}
                    >
                      <social.icon className="w-4 h-4" />
                    </a>
                  )
              )}
            </div>
          </div>
          <p className="text-brand-gold/90 font-bold text-sm text-center">{tf.motto}</p>
        </motion.div>

        <div className={`pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${isLight ? "border-brand-deep/10" : "border-white/10"}`}>
          <p className={`text-xs text-center md:text-start ${isLight ? "text-brand-deep/50" : "text-white/50"}`}>
            {tf.allRights}
          </p>
          <div className="flex flex-col items-center gap-1">
            <p
              id="footer_creator_credit"
              className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-[12px] sm:text-sm font-black shadow-[0_0_25px_rgba(212,175,55,0.18)]"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                backgroundImage: "linear-gradient(90deg, #D4AF37, #F5B700, #FFFFFF, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "0.055em",
              }}
              aria-label="Creating by Eng Sadek Elgazar"
            >
              <Code2 className="w-3.5 h-3.5 text-brand-gold" />
              Creating by Eng Sadek Elgazar
            </p>
            <p className={`text-xs flex items-center gap-1 ${isLight ? "text-brand-deep/40" : "text-white/40"}`}>
              {isArabic ? "صُمم بـ" : "Crafted with"}
              <Heart className="w-3 h-3 text-brand-gold fill-brand-gold" />
              {isArabic ? "لخدمتك" : "for you"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link to="/policy" className={`text-xs transition-colors ${isLight ? "text-brand-deep/50 hover:text-brand-deep" : "text-white/50 hover:text-white/80"}`}>
              {tf.policy}
            </Link>
            <span className={isLight ? "text-brand-deep/20" : "text-white/20"}>•</span>
            <Link to="/privacy" className={`text-xs transition-colors ${isLight ? "text-brand-deep/50 hover:text-brand-deep" : "text-white/50 hover:text-white/80"}`}>
              Privacy
            </Link>
            <span className={isLight ? "text-brand-deep/20" : "text-white/20"}>•</span>
            <Link to="/contact" className={`text-xs transition-colors ${isLight ? "text-brand-deep/50 hover:text-brand-deep" : "text-white/50 hover:text-white/80"}`}>
              {t.nav.contact}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
