import { motion } from "motion/react";
import { Mail, MapPin, Phone, ExternalLink, ChevronRight, ChevronLeft, Shield, Code2, Navigation, Store, UserRound, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import companyMeta from "../data/companyMeta";
import localAssets, { withRemoteFallback } from "../data/localAssets";
import { getCompanySocialLinks } from "./ui/SocialLinks";
import DeveloperSignature from "./DeveloperSignature";
import "../styles/dn-day-mode.css";

export default function Footer() {
  const { language } = useAppContext();
  const tf = translations[language].footer;
  const isArabic = language === "ar";
  const Arrow = isArabic ? ChevronLeft : ChevronRight;
  const socialLinks = getCompanySocialLinks(isArabic);
  const address = isArabic ? companyMeta.addressAr : companyMeta.addressEn;

  const companyLinks = [
    { label: isArabic ? "الرئيسية" : "Home", path: "/" },
    { label: isArabic ? "من نحن" : "About Us", path: "/about" },
    { label: isArabic ? "خدماتنا" : "Services", path: "/services" },
    { label: isArabic ? "المعرض" : "Gallery", path: "/gallery" },
    { label: isArabic ? "الأسئلة الشائعة" : "FAQs", path: "/faq" },
    { label: isArabic ? "تواصل معنا" : "Contact", path: "/contact" },
  ];

  const serviceLinks = [
    { label: isArabic ? "توصيل داخل الإمارات" : "UAE Local Delivery", path: "/uae-delivery" },
    { label: isArabic ? "الشحن الدولي" : "International Shipping", path: "/international-shipping" },
    { label: isArabic ? "حلول التجارة الإلكترونية" : "E-Commerce Solutions", path: "/ecommerce" },
    { label: isArabic ? "الشركات والعقود" : "Corporate & Contracts", path: "/corporate" },
    { label: isArabic ? "اطلب توصيل" : "Request Delivery", path: "/request" },
    { label: isArabic ? "تتبع شحنتك" : "Track Shipment", path: "/tracking" },
    { label: isArabic ? "الدفع والتحويل البنكي" : "Bank Transfer & Payment", path: "/payment" },
    { label: isArabic ? "خدمات QR الذكية" : "QR Services", path: "/qr" },
  ];

  const portalLinks = [
    { label: isArabic ? "بوابة التاجر" : "Merchant Portal", path: "/merchant", Icon: Store },
    { label: isArabic ? "بوابة المندوب" : "Driver Portal", path: "/driver", Icon: Navigation },
    { label: isArabic ? "حساب العميل" : "Customer Account", path: "/customer", Icon: UserRound },
    { label: isArabic ? "لوحة الإدارة" : "Admin Portal", path: "/auth", Icon: Settings },
  ];

  const supportLinks = [
    { label: isArabic ? "الأسعار والحاسبة" : "Pricing & Calculator", path: "/pricing", route: true },
    { label: isArabic ? "الدفع أونلاين وحسابات الشركة" : "Online Payment & Company Accounts", path: "/payment", route: true },
    { label: isArabic ? "سياسة الخدمة" : "Service Policy", path: "/policy", route: true },
    { label: isArabic ? "سياسة الخصوصية" : "Privacy Policy", path: "/privacy", route: true },
    { label: isArabic ? "الشروط والأحكام" : "Terms & Conditions", path: "/terms", route: true },
    { label: "WhatsApp", path: companyMeta.whatsappUrl, route: false },
    { label: companyMeta.email, path: `mailto:${companyMeta.email}`, route: false },
  ];

  const linkClass = `group flex items-center gap-2 text-sm font-semibold text-white/68 transition-all duration-200 hover:translate-x-0.5 hover:text-[#F4C84A] ${isArabic ? "flex-row-reverse hover:-translate-x-0.5" : ""}`;
  const headingClass = "mb-5 text-sm font-black uppercase tracking-[0.12em] text-white/95";
  const columnTitle = (label: string) => <h3 className={headingClass}>{label}</h3>;
  const footerText = tf as typeof tf & { companyLinks?: string; rights?: string };
  const companyLinksTitle = footerText.companyLinks ?? (isArabic ? "روابط الشركة" : "Company");
  const rightsText = footerText.rights ?? footerText.allRights;

  return (
    <footer
      className="dn-public-footer relative mt-16 overflow-hidden border-t border-[#74B9F6]/15 bg-[#020C19] text-white"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(37,145,236,.18),transparent_28rem),radial-gradient(circle_at_88%_12%,rgba(212,175,55,.09),transparent_24rem),linear-gradient(180deg,rgba(7,31,58,.98),rgba(2,10,22,1))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" />

      <div className="dn-public-footer-content relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-11 text-center">
          <div className="mx-auto grid h-[76px] w-[76px] place-items-center rounded-full border border-brand-gold/35 bg-white/[0.045] p-1 shadow-[0_18px_50px_rgba(0,0,0,.28),0_0_32px_rgba(212,175,55,.10)] ring-1 ring-white/[0.04]">
            <img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT" className="h-full w-full rounded-full object-contain" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-white sm:text-[28px]">DAY NIGHT DELIVERY SERVICES</h2>
          <p className="mt-1 font-black text-brand-gold">{tf.company}</p>
          <p className="mx-auto mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#B9CBDE]">{tf.description}</p>
          <div className="mx-auto mt-6 h-px w-40 bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-5">
          <div>{columnTitle(companyLinksTitle)}<div className="space-y-3">{companyLinks.map((item) => <Link key={item.path} to={item.path} className={linkClass}><Arrow className="h-3 w-3 text-brand-gold" />{item.label}</Link>)}</div></div>
          <div>{columnTitle(tf.services)}<div className="space-y-3">{serviceLinks.map((item) => <Link key={item.path} to={item.path} className={linkClass}><Arrow className="h-3 w-3 text-brand-gold" />{item.label}</Link>)}</div></div>
          <div>{columnTitle(isArabic ? "بوابات التشغيل" : "Operations Portals")}<div className="space-y-3">{portalLinks.map(({ path, label, Icon }) => <Link key={path} to={path} className={linkClass}><Icon className="h-4 w-4 text-brand-gold" />{label}</Link>)}</div></div>
          <div>{columnTitle(tf.support)}<div className="space-y-3">{supportLinks.map((item) => item.route ? <Link key={item.path} to={item.path} className={linkClass}><Arrow className="h-3 w-3 text-brand-gold" />{item.label}</Link> : <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" className={linkClass}><Arrow className="h-3 w-3 text-brand-gold" />{item.label}</a>)}</div></div>
          <div>
            {columnTitle(tf.contact)}
            <div className="space-y-3">
              <a href={`tel:${companyMeta.phone}`} className={linkClass}><Phone className="h-4 w-4 text-brand-gold" />{companyMeta.phone}</a>
              <a href={`mailto:${companyMeta.email}`} className={linkClass}><Mail className="h-4 w-4 text-brand-gold" />{companyMeta.email}</a>
              <p className={linkClass}><MapPin className="h-4 w-4 shrink-0 text-brand-gold" />{address}</p>
            </div>

            <div className="mt-6">
              <h4 className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-white/62">{isArabic ? "تابعنا" : "Follow us"}</h4>
              <div className="grid grid-cols-2 gap-2.5">
                {socialLinks.map(({ key, Icon, href, label, handle, color }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} ${handle}`}
                    className="group rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[inset_0_1px_rgba(255,255,255,.035)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold/40 hover:bg-white/[0.075]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#061A34] shadow-[0_0_22px_rgba(245,183,0,0.10)]" style={{ color }}><Icon className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0"><span className="block text-xs font-black text-white">{label}</span><span className="block truncate text-[10px] text-white/42">{handle}</span></span>
                      <ExternalLink className="ms-auto h-3.5 w-3.5 text-brand-gold/70 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/46 sm:flex-row">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-brand-gold" />{rightsText}</div>
          <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 font-black text-brand-gold"><Code2 className="h-4 w-4" />{isArabic ? "منصة تشغيل DAY NIGHT الرقمية" : "DAY NIGHT Digital Operations Platform"}</motion.div>
        </div>
      </div>

      <div className="relative z-10">
        <DeveloperSignature />
      </div>
    </footer>
  );
}
