import { motion } from "motion/react";
import {
  Mail,
  MapPin,
  Phone,
  Facebook,
  Instagram,
  Globe,
  Zap,
  Heart,
  Clock,
  Shield,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import companyMeta from "../data/companyMeta";
import { Link } from "react-router-dom";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
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

  const navLinks = [
    { key: "home", label: tf.home, path: "/" },
    { key: "about", label: tf.about, path: "/about" },
    { key: "services", label: t.nav.services, path: "/services" },
    { key: "pricing", label: tf.pricing, path: "/pricing" },
    { key: "tracking", label: tf.tracking, path: "/tracking" },
    { key: "contact", label: t.nav.contact, path: "/contact" },
  ];

  const serviceLinks = [
    { key: "uae", label: tf.uaeDelivery, path: "/uae-delivery" },
    { key: "global", label: tf.globalShipping, path: "/international-shipping" },
    { key: "ecommerce", label: tf.ecommerce, path: "/ecommerce" },
    { key: "corporate", label: tf.corporate, path: "/corporate" },
  ];

  const socialLinks = [
    { key: "facebook", icon: Facebook, href: companyMeta.socials.facebook, label: "Facebook" },
    { key: "instagram", icon: Instagram, href: companyMeta.socials.instagram, label: "Instagram" },
    { key: "tiktok", icon: TikTokIcon, href: companyMeta.socials.tiktok, label: "TikTok" },
  ];

  const Arrow = isArabic ? ChevronLeft : ChevronRight;

  return (
    <footer
      className={`relative overflow-hidden border-t backdrop-blur-md ${
        isLight
          ? "bg-gradient-to-b from-white/60 to-[#DDE7F5]/80 border-brand-deep/10"
          : "bg-gradient-to-b from-brand-deep/60 to-brand-cool/80 border-white/10"
      }`}
    >
      {/* Background glow */}
      <div
        className={`absolute top-0 ${
          isArabic ? "left-0" : "right-0"
        } w-96 h-96 rounded-full blur-[120px] pointer-events-none ${
          isLight ? "bg-brand-gold/10" : "bg-brand-gold/5"
        }`}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top Section: Brand + Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`flex flex-col md:flex-row items-center md:items-start gap-6 pb-12 border-b ${
            isLight ? "border-brand-deep/10" : "border-white/10"
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border ${
              isLight
                ? "bg-gradient-to-br from-brand-gold to-brand-gold/70 border-brand-gold/30"
                : "bg-gradient-to-br from-brand-gold to-brand-gold/60 border-brand-gold/20"
            }`}
          >
            <Zap className="w-8 h-8 text-brand-deep" />
          </div>
          <div className={`text-center md:${isArabic ? "text-right" : "text-left"}`}>
            <h3
              className={`text-2xl font-black tracking-tight ${
                isLight ? "text-brand-deep" : "text-white"
              }`}
            >
              {companyMeta.name}
            </h3>
            <p className="text-brand-gold font-bold text-sm mb-2">{tf.slogan}</p>
            <p
              className={`max-w-2xl text-sm leading-relaxed ${
                isLight ? "text-brand-deep/70" : "text-white/70"
              }`}
            >
              {tf.description}
            </p>
          </div>
        </motion.div>

        {/* Middle Section: Links Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 py-12"
        >
          {/* Navigation */}
          <div className={isArabic ? "text-right" : "text-left"}>
            <h4
              className={`text-sm font-bold uppercase tracking-wider mb-5 ${
                isLight ? "text-brand-deep" : "text-white/90"
              }`}
            >
              {tf.navigation}
            </h4>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    to={link.path}
                    className={`group flex items-center gap-2 text-sm transition-colors duration-200 ${
                      isArabic ? "flex-row-reverse" : ""
                    } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`}
                  >
                    <Arrow className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className={isArabic ? "text-right" : "text-left"}>
            <h4
              className={`text-sm font-bold uppercase tracking-wider mb-5 ${
                isLight ? "text-brand-deep" : "text-white/90"
              }`}
            >
              {tf.services}
            </h4>
            <ul className="space-y-3">
              {serviceLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    to={link.path}
                    className={`group flex items-center gap-2 text-sm transition-colors duration-200 ${
                      isArabic ? "flex-row-reverse" : ""
                    } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`}
                  >
                    <Arrow className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className={`${isArabic ? "text-right" : "text-left"} lg:col-span-2`}>
            <h4
              className={`text-sm font-bold uppercase tracking-wider mb-5 ${
                isLight ? "text-brand-deep" : "text-white/90"
              }`}
            >
              {tf.contact}
            </h4>
            <ul className="space-y-4">
              <li>
                <a
                  href={`tel:${companyMeta.phone}`}
                  className={`flex items-center gap-3 text-sm transition-colors duration-200 ${
                    isArabic ? "flex-row-reverse" : ""
                  } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`}
                >
                  <Phone className="w-4 h-4 text-brand-gold shrink-0" />
                  <span>{companyMeta.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${companyMeta.email}`}
                  className={`flex items-center gap-3 text-sm transition-colors duration-200 ${
                    isArabic ? "flex-row-reverse" : ""
                  } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`}
                >
                  <Mail className="w-4 h-4 text-brand-gold shrink-0" />
                  <span className="break-all">{companyMeta.email}</span>
                </a>
              </li>
              <li>
                <a
                  href={companyMeta.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 text-sm transition-colors duration-200 ${
                    isArabic ? "flex-row-reverse" : ""
                  } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`}
                >
                  <Globe className="w-4 h-4 text-brand-gold shrink-0" />
                  <span>{tf.whatsapp}</span>
                </a>
              </li>
              <li>
                <div
                  className={`flex items-center gap-3 text-sm ${
                    isArabic ? "flex-row-reverse" : ""
                  } ${isLight ? "text-brand-deep/70" : "text-white/60"}`}
                >
                  <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
                  <span>{isArabic ? companyMeta.addressAr : companyMeta.addressEn}</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Why Us */}
          <div className={isArabic ? "text-right" : "text-left"}>
            <h4
              className={`text-sm font-bold uppercase tracking-wider mb-5 ${
                isLight ? "text-brand-deep" : "text-white/90"
              }`}
            >
              {tf.whyUs}
            </h4>
            <div className="space-y-4">
              <div className={`flex items-start gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                <Clock className="w-5 h-5 text-brand-gold mt-0.5 shrink-0" />
                <div>
                  <p className={`text-sm font-semibold ${isLight ? "text-brand-deep" : "text-white/80"}`}>
                    {tf.service24_7}
                  </p>
                  <p className={`text-xs ${isLight ? "text-brand-deep/50" : "text-white/50"}`}>
                    {tf.roundTheClock}
                  </p>
                </div>
              </div>
              <div className={`flex items-start gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                <Shield className="w-5 h-5 text-brand-gold mt-0.5 shrink-0" />
                <div>
                  <p className={`text-sm font-semibold ${isLight ? "text-brand-deep" : "text-white/80"}`}>
                    {tf.premiumCare}
                  </p>
                  <p className={`text-xs ${isLight ? "text-brand-deep/50" : "text-white/50"}`}>
                    {tf.safetyFirst}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Social Strip */}
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
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? "text-brand-deep/60" : "text-white/60"
              }`}
            >
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

        {/* Bottom Bar */}
        <div
          className={`pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 ${
            isLight ? "border-brand-deep/10" : "border-white/10"
          }`}
        >
          <p className={`text-xs text-center md:text-left ${isLight ? "text-brand-deep/50" : "text-white/50"}`}>
            {tf.allRights}
          </p>
          <p className={`text-xs flex items-center gap-1 ${isLight ? "text-brand-deep/40" : "text-white/40"}`}>
            {isArabic ? "صُمم بـ" : "Crafted with"}
            <Heart className="w-3 h-3 text-brand-gold fill-brand-gold" />
            {isArabic ? "لخدمتك" : "for you"}
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/policy"
              className={`text-xs transition-colors ${
                isLight ? "text-brand-deep/50 hover:text-brand-deep" : "text-white/50 hover:text-white/80"
              }`}
            >
              {tf.policy}
            </Link>
            <span className={isLight ? "text-brand-deep/20" : "text-white/20"}>•</span>
            <Link
              to="/contact"
              className={`text-xs transition-colors ${
                isLight ? "text-brand-deep/50 hover:text-brand-deep" : "text-white/50 hover:text-white/80"
              }`}
            >
              {t.nav.contact}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
