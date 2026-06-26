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
import "../styles/dn-day-mode.css";

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
            <div className="flex gap-2 mt-5 justify-center md:justify-start">
              {socialLinks.map(({ key, icon: Icon, href, label }) => <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="w-9 h-9 rounded-xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold flex items-center justify-center hover:bg-brand-gold hover:text-brand-deep transition-all"><Icon className="w-4 h-4" /></a>)}
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
