/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useSearchParams, 
  useLocation, 
  useParams 
} from "react-router-dom";

import Home from "./components/Home";
import AboutUs from "./components/AboutUs";
import Services from "./components/Services";
import DeliveryUAE from "./components/DeliveryUAE";
import DeliveryInternational from "./components/DeliveryInternational";
import ECommerce from "./components/ECommerce";
import CorporateSolutions from "./components/CorporateSolutions";
import Pricing from "./components/Pricing";
import RequestDelivery from "./components/RequestDelivery";
import Tracking from "./components/Tracking";
import Faqs from "./components/Faqs";
import ContactUs from "./components/ContactUs";
import Policy from "./components/Policy";
import QR from "./components/QR";
import AdminPanel from "./components/AdminPanel";
import SmartChat from "./components/SmartChat";
import NotFound from "./components/NotFound";
import Auth from "./components/Auth";

import { 
  Menu, 
  X, 
  PhoneCall, 
  ShieldAlert, 
  Moon, 
  Sun,
  MapPin,
  Globe2,
  HelpCircle
} from "lucide-react";
import { useLanguage } from './context/LanguageContext';
import companyMeta from './data/companyMeta';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import UtilityBar from './components/common/UtilityBar';

// Official Logo Image URL
const LOGO_IMAGE_URL = "https://i.postimg.cc/tC3sSs24/178129358239a5-modified.png";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
    const { lang } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Synchronize legacy key actions with real production URLs
  function handleNavigate(tab: string, trackingId?: string) {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (tab === "home") navigate("/");
    else if (tab === "about") navigate("/about");
    else if (tab === "services") navigate("/services");
    else if (tab === "suburbs" || tab === "uae-delivery") navigate("/uae-delivery");
    else if (tab === "international" || tab === "international-shipping") navigate("/international-shipping");
    else if (tab === "ecommerce") navigate("/ecommerce");
    else if (tab === "corporate") navigate("/corporate");
    else if (tab === "pricing") navigate("/pricing");
    else if (tab === "request") navigate("/request");
    else if (tab === "tracking") {
      if (trackingId) {
        navigate(`/tracking?code=${trackingId}`);
      } else {
        navigate("/tracking");
      }
    }
    else if (tab === "faqs" || tab === "faq") navigate("/faq");
    else if (tab === "contact") navigate("/contact");
    else if (tab === "policy") navigate("/policy");
    else if (tab === "qr") navigate("/qr");
    else if (tab === "auth") navigate("/auth");
    else if (tab === "admin") navigate("/admin");
  }

  const currentPath = location.pathname;

  const navLinks = [
    { key: "home", path: "/", labelAr: "الرئيسية", labelEn: "Home" },
    { key: "about", path: "/about", labelAr: "من نحن", labelEn: "About" },
    { key: "services", path: "/services", labelAr: "خدماتنا", labelEn: "Services" },
    { key: "suburbs", path: "/uae-delivery", labelAr: "التوصيل الإماراتي", labelEn: "UAE Delivery" },
    { key: "international", path: "/international-shipping", labelAr: "الشحن الدولي", labelEn: "Global" },
    { key: "ecommerce", path: "/ecommerce", labelAr: "حلول المتاجر", labelEn: "E-Commerce" },
    { key: "corporate", path: "/corporate", labelAr: "الشركات والعقود", labelEn: "Corporate" },
    { key: "pricing", path: "/pricing", labelAr: "الأسعار والحاسبة", labelEn: "Rates & Calc" },
    { key: "request", path: "/request", labelAr: "احجز توصيل", labelEn: "Book Ship" },
    { key: "tracking", path: "/tracking", labelAr: "تتبع شحنتك", labelEn: "Track" },
    { key: "faqs", path: "/faq", labelAr: "الأسئلة المتكررة", labelEn: "FAQs" },
    { key: "contact", path: "/contact", labelAr: "اتصل بنا", labelEn: "Contact Us" }
  ];

  // Helper tracking parameter parser
  function TrackingRouteWrapper() {
    const [searchParams] = useSearchParams();
    const { code } = useParams();
    const tCode = code || searchParams.get("code") || "";
    return <Tracking initialTrackingId={tCode} />;
  }

  return (
    <div className="min-h-screen bg-brand-deep flex flex-col justify-between text-white antialiased selection:bg-brand-gold/30 selection:text-white leading-normal">
      {/* Upper Slogan / Utility Bar */}
      <div className="bg-brand-cool text-white text-[11px] font-sans py-2.5 px-4 sm:px-8 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5 font-bold">
        <div className="flex items-center gap-3">
          <span className="text-brand-gold font-mono tracking-wider">{companyMeta.sloganEn}</span>
          <span className="text-white/20 font-sans">|</span>
          <span className="text-white/80">{companyMeta.sloganAr}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href={`tel:${companyMeta.phone}`} className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <PhoneCall className="w-3.5 h-3.5 text-brand-gold" />
            <span>{companyMeta.phone}</span>
          </a>
          <span className="text-white/20">|</span>
          <p className="text-white/60">{lang === 'ar' ? 'نعمل على مدار الساعة' : '24/7 Delivery Support'}</p>
        </div>
        <UtilityBar />
      </div>

      {/* Main Glassmorphic Header */}
      <header className="sticky top-0 bg-brand-deep/80 backdrop-blur-md border-b border-white/10 z-40 transition-all font-sans duration-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo Brand with Official Logo */}
          <Link 
            to="/" 
            className="flex items-center gap-2.5 cursor-pointer shrink-0 select-none text-right"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-11 h-11 bg-brand-cool rounded-xl flex items-center justify-center border border-brand-gold/30 overflow-hidden">
              <img 
                src={LOGO_IMAGE_URL} 
                alt="Day Night Official Logo" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-110" 
              />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-extrabold text-white leading-none uppercase font-sans tracking-tight">
                DAY NIGHT <span className="text-brand-gold font-semibold font-sans text-xs">DELIVERY</span>
              </h1>
              <p className="text-[10px] text-white/50 font-bold tracking-tight">داي نايت لخدمات التوصيل والشحن</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-1.5 text-xs font-semibold">
            {navLinks.map((link) => {
              const isActive = currentPath === link.path;
              return (
                <Link
                  id={`nav_link_${link.key}`}
                  key={link.key}
                  to={link.path}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className={`px-3 py-1.5 rounded-lg transition-all text-right cursor-pointer ${
                    isActive 
                      ? "bg-brand-blue text-white font-extrabold shadow-md shadow-brand-blue/20" 
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <p className="leading-tight">{link.labelAr}</p>
                  <p className="text-[9px] uppercase tracking-wide opacity-55 mt-0.5 font-mono">{link.labelEn}</p>
                </Link>
              );
            })}
          </nav>

          {/* Call to action book Button */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              id="header_cta_btn"
              to="/request"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-5 py-2.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-lg text-xs leading-none transition-all duration-300 cursor-pointer border border-brand-gold/10 hover:border-brand-blue shadow-lg shadow-brand-gold/5 hover:shadow-brand-blue/20"
            >
              اطلب مندوب فوري
            </Link>
          </div>

          {/* Mobile hamburger toggle */}
          <div className="xl:hidden flex items-center">
            <button
              id="mobile_menu_trigger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white/80 hover:text-white focus:outline-none cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation overlay drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-brand-cool border-t border-white/10 text-right py-4 px-4 space-y-2 animate-in slide-in-from-top-4 duration-200">
            {navLinks.map((link) => {
              const isActive = currentPath === link.path;
              return (
                <Link
                  id={`mobile_nav_link_${link.key}`}
                  key={link.key}
                  to={link.path}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full text-right p-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${
                    isActive 
                      ? "bg-brand-blue text-white" 
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <span>{link.labelAr}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">({link.labelEn})</span>
                </Link>
              );
            })}
            
            <Link
              id="mobile_cta_book"
              to="/request"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full block py-3 bg-brand-gold text-brand-deep font-extrabold rounded-xl text-center text-xs mt-3 cursor-pointer hover:bg-brand-blue hover:text-white transition-all duration-200"
            >
              احجز توصيل طرد الحين
            </Link>
            <a
              id="mobile_whatsapp_catalog"
              href="https://wa.me/c/971568757331"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full block py-3 bg-amber-600 text-white font-extrabold rounded-xl text-center text-xs mt-2 cursor-pointer hover:bg-amber-500 transition-all duration-200"
            >
              عرض كتالوج واتساب / View Catalog
            </a>
          </div>
        )}
      </header>

      {/* Main Page Area Wrapper */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto relative z-10">
        <Routes>
          <Route path="/" element={<Home onNavigate={handleNavigate} />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/services" element={<Services onNavigate={handleNavigate} />} />
          <Route path="/uae-delivery" element={<DeliveryUAE />} />
          <Route path="/international-shipping" element={<DeliveryInternational />} />
          <Route path="/ecommerce" element={<ECommerce onNavigate={handleNavigate} />} />
          <Route path="/corporate" element={<CorporateSolutions />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/request" element={<RequestDelivery onNavigate={handleNavigate} />} />
          <Route path="/tracking" element={<TrackingRouteWrapper />} />
          <Route path="/tracking/:code" element={<TrackingRouteWrapper />} />
          <Route path="/faq" element={<Faqs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/qr" element={<QR onNavigate={handleNavigate} />} />
          <Route path="/auth" element={<Auth onAuthSuccess={() => navigate("/admin")} />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Smart Chat Floating Agent Widget */}
      <SmartChat />

      {/* Premium Dark Slogan Footer */}
      <footer className="bg-brand-cool text-white border-t border-white/10 pt-16 pb-8 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 border-b border-white/10 pb-12 mb-10">
          
          {/* Logo & Slogan Column */}
          <div className="md:col-span-4 space-y-4 text-right">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-brand-deep rounded-xl flex items-center justify-center border border-brand-gold/20 overflow-hidden">
                <img 
                  src={LOGO_IMAGE_URL} 
                  alt="Day Night Footer Logo" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover scale-110" 
                />
              </div>
              <h3 className="text-base font-extrabold tracking-tight uppercase">
                DAY NIGHT <span className="text-brand-gold font-semibold text-[11px] font-sans">DELIVERY</span>
              </h3>
            </div>
            <p className="text-xs text-white/55 leading-relaxed">
              داي نايت لخدمات التوصيل والشحن - شركة خدمات لوجستية ونقل بري رائدة في دولة الإمارات العربية المتحدة. نوفر توصيلاً آمناً وسريعاً للمتاجر والشركات والمستندات على مدار الساعة 24/7.
            </p>
            <p className="text-xs font-mono font-bold text-brand-gold">
              Mussafah 40, Abu Dhabi, UAE
            </p>
          </div>

          {/* Quick Navigator Tabs Links */}
          <div className="md:col-span-4 space-y-4 text-right">
            <h4 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider font-sans border-r-4 border-brand-gold pr-2.5">روابط سريعة للتصفح</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
              <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">الصفحة الرئيسية</Link>
              <Link to="/about" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">من نحن وبروفايلنا</Link>
              <Link to="/services" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">جميع الخدمات</Link>
              <Link to="/uae-delivery" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">التوصيل الإماراتي</Link>
              <Link to="/international-shipping" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">الشحن الدولي</Link>
              <Link to="/ecommerce" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">حلول المتاجر</Link>
              <Link to="/corporate" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">الشركات والعقود</Link>
              <Link to="/pricing" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">الحاسبة والأسعار</Link>
              <Link to="/tracking" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">تتبع حركي مباشر</Link>
              <Link to="/policy" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">سياسات النقل</Link>
              <Link to="/qr" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">روابط QR السريعة</Link>
              <Link to="/contact" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-right hover:text-white transition-colors cursor-pointer text-xs">تواصل معنا</Link>
            </div>
          </div>

          {/* Contact Details Foot block */}
          <div className="md:col-span-4 space-y-4 text-right sm:border-r sm:border-white/10 sm:pr-6 md:border-r-0 md:pr-0">
            <h4 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider font-sans border-r-4 border-brand-gold pr-2.5">اتصال سريع ومباشر</h4>
            <div className="text-xs text-white/60 space-y-2.5">
              <p>مكتب خدمة العملاء وتوجيه المندوبين متاح طوال ساعات الليل والنهار لتلبية رغباتكم.</p>
              <p className="text-sm font-extrabold text-white font-sans">هاتف: +971 56 875 7331</p>
              <p className="text-[11px] font-mono text-white/40">البريد: Admin@daynight.ae</p>
              <a
                id="footer_whatsapp_catalog"
                href="https://wa.me/c/971568757331"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 text-[10px] sm:text-xs font-black block transition-colors mt-2 cursor-pointer bg-amber-950/20 border border-amber-500/25 px-3 py-2 rounded-xl text-center"
              >
                عرض كتالوج واتساب / View WhatsApp Catalog 🖥️
              </a>
              <Link 
                to="/admin" 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="text-rose-400/80 hover:text-rose-400 text-[10px] font-bold block transition-colors mt-2 cursor-pointer bg-red-950/10 border border-red-500/10 px-2 py-1 rounded w-full md:w-auto text-center"
              >
                بوابة الكباتن والفرز اللوجستي
              </Link>
            </div>
          </div>
        </div>

        {/* Legal copy strip */}
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/40 text-[11px] font-sans font-bold text-center">
          <p>© {new Date().getFullYear()} {companyMeta.nameAr}. جميع الحقوق محفوظة لـ {companyMeta.name}.</p>
          <div className="flex gap-4">
            <span className="text-white/10">|</span>
            <p>{companyMeta.sloganAr}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
