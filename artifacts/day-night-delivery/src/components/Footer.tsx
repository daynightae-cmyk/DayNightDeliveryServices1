import { motion } from "motion/react";
import {
  Mail,
  MapPin,
  Phone,
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
import { getCompanySocialLinks } from "./ui/SocialLinks";
import "../styles/dn-day-mode.css";

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

  const socialLinks = getCompanySocialLinks(isArabic);
  const Arrow = isArabic ? ChevronLeft : ChevronRight;

  const linkClass = `group flex items-center gap-2 text-sm transition-colors duration-200 ${
    isArabic ? "flex-row-reverse" : ""
  } ${isLight ? "text-brand-deep/70 hover:text-brand-gold" : "text-white/60 hover:text-brand-gold"}`;

  const headingClass = `text-sm font-bold uppercase tracking-wider mb-5 ${
    isLight ? "text-brand-deep" : "text-white/90"
  }`;

  const columnTitle = (label: string) => <h3 className={headingClass}>{label}</h3>;

  return (
    <footer className={`${isLight ? "bg-white/55 border-brand-deep/10" : "bg-brand-deep/80 border-white/10"} border-t mt-16`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="mx-auto h-16 w-16 rounded-full border border-brand-gold/40 object-contain" />
          <h2 className={`mt-4 text-2xl font-black ${isLight ? "text-brand-deep" : "text-white"}`}>DAY NIGHT DELIVERY SERVICES</h2>
          <p className="text-brand-gold font-bold mt-1">{tf.company}</p>
          <p className={`max-w-3xl mx-auto mt-4 text-sm leading-7 ${isLight ? "text-brand-deep/65" : "text-white/55"}`}>{tf.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            {columnTitle(tf.companyLinks)}
            <div className="space-y-3">{companyLinks.map((item) => <Link key={item.key} to={item.path} className={linkClass}><Arrow className="w-3 h-3 text-brand-gold" />{item.label}</Link>)}</div>
          </div>
          <div>
            {columnTitle(tf.services)}
            <div className="space-y-3">{serviceLinks.map((item) => <Link key={item.key} to={item.path} className={linkClass}><Arrow className="w-3 h-3 text-brand-gold" />{item.label}</Link>)}</div>
          </div>
          <div>
            {columnTitle(tf.support)}
            <div className="space-y-3">{supportLinks.map((item) => item.isRoute ? <Link key={item.key} to={item.path} className={linkClass}><Arrow className="w-3 h-3 text-brand-gold" />{item.label}</Link> : <a key={item.key} href={item.path} target={item.key === "whatsapp" ? "_blank" : undefined} rel={item.key === "whatsapp" ? "noopener noreferrer" : undefined} className={linkClass}><Arrow className="w-3 h-3 text-brand-gold" />{item.label}</a>)}</div>
          </div>
          <div>
            {columnTitle(tf.contact)}
            <div className="space-y-3">
              <a href={`tel:${companyMeta.phone}`} className={linkClass}><Phone className="w-4 h-4 text-brand-gold" />{companyMeta.phone}</a>
              <a href={`mailto:${companyMeta.email}`} className={linkClass}><Mail className="w-4 h-4 text-brand-gold" />{companyMeta.email}</a>
              <p className={linkClass}><MapPin className="w-4 h-4 text-brand-gold" />{companyMeta.address}</p>
            </div>

            <div className="mt-6">
              <h4 className={`mb-3 text-xs font-black uppercase tracking-[0.22em] ${isLight ? "text-brand-deep/70" : "text-white/55"}`}>{isArabic ? "تابعنا" : "Follow us"}</h4>
              <div className="grid grid-cols-2 gap-2.5">
                {socialLinks.map(({ key, Icon, href, label, handle, color }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} ${handle}`}
                    className={`group rounded-2xl border p-3 transition-all duration-300 hover:-translate-y-0.5 ${
                      isLight
                        ? "border-brand-deep/10 bg-white/65 hover:border-brand-gold/45 hover:bg-white"
                        : "border-white/10 bg-white/[0.045] hover:border-brand-gold/45 hover:bg-white/[0.075]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-brand-deep/80 shadow-[0_0_22px_rgba(245,183,0,0.12)]" style={{ color }}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-black ${isLight ? "text-brand-deep" : "text-white"}`}>{label}</span>
                        <span className={`block truncate text-[10px] ${isLight ? "text-brand-deep/45" : "text-white/35"}`}>{handle}</span>
                      </span>
                      <ExternalLink className="ms-auto h-3.5 w-3.5 text-brand-gold/70 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${isLight ? "border-brand-deep/10 text-brand-deep/50" : "border-white/10 text-white/40"}`}>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-brand-gold" />{tf.rights}</div>
          <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-brand-gold font-black"><Code2 className="w-4 h-4" />Creating by Eng Sadek Elgazar</motion.div>
        </div>
      </div>
    </footer>
  );
}
