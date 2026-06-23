/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, Suspense, lazy } from "react";
import { useAppContext } from "./lib/AppContext";
import { translations } from "./data/translations";
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

const Home = lazy(() => import("./components/Home"));
const AboutUs = lazy(() => import("./components/AboutUs"));
const Services = lazy(() => import("./components/Services"));
const DeliveryUAE = lazy(() => import("./components/DeliveryUAE"));
const DeliveryInternational = lazy(() => import("./components/DeliveryInternational"));
const ECommerce = lazy(() => import("./components/ECommerce"));
const CorporateSolutions = lazy(() => import("./components/CorporateSolutions"));
const Pricing = lazy(() => import("./components/Pricing"));
const RequestDelivery = lazy(() => import("./components/RequestDelivery"));
const Tracking = lazy(() => import("./components/Tracking"));
const Faqs = lazy(() => import("./components/Faqs"));
const ContactUs = lazy(() => import("./components/ContactUs"));
const Policy = lazy(() => import("./components/Policy"));
const QR = lazy(() => import("./components/QR"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const InternationalShippingAdvanced = lazy(() => import("./components/InternationalShippingAdvanced"));
const DriverMobileView = lazy(() => import("./components/driver/DriverMobileView"));
const CustomerDashboard = lazy(() => import("./components/customer/CustomerDashboard"));
const UltimateGalleryV2 = lazy(() => import("./components/Gallery/UltimateGalleryV2"));
import SmartChat from "./components/SmartChat";
import NotFound from "./components/NotFound";
import Auth from "./components/Auth";
import ThemeToggle from "./components/ThemeToggle";
import Splash from "./components/Splash";
import Footer from "./components/Footer";

import { 
  Menu, 
  X, 
  PhoneCall
} from "lucide-react";
import companyMeta from "./data/companyMeta";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { trackPageLoad } from "./lib/monitoring";

const LOGO_IMAGE_URL = "https://i.postimg.cc/tC3sSs24/178129358239a5-modified.png";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { language, toggleLanguage } = useAppContext();

  const t = translations[language];

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
    else if (tab === "gallery") navigate("/gallery");
    else if (tab === "auth") navigate("/auth");
    else if (tab === "admin") navigate("/admin");
  }

  const currentPath = location.pathname;

  useEffect(() => {
    trackPageLoad(location.pathname || "/");
  }, [location.pathname]);

  const navLinks = [
    { key: "home", path: "/", label: t.nav.home },
    { key: "about", path: "/about", label: t.nav.about },
    { key: "services", path: "/services", label: t.nav.services },
    { key: "suburbs", path: "/uae-delivery", label: t.nav.suburbs },
    { key: "international", path: "/international-shipping", label: t.nav.international },
    { key: "ecommerce", path: "/ecommerce", label: t.nav.ecommerce },
    { key: "corporate", path: "/corporate", label: t.nav.corporate },
    { key: "pricing", path: "/pricing", label: t.nav.pricing },
    { key: "request", path: "/request", label: t.nav.booking },
    { key: "tracking", path: "/tracking", label: t.nav.tracking },
    { key: "faqs", path: "/faq", label: t.nav.faqs },
    { key: "gallery", path: "/gallery", label: t.nav.gallery },
    { key: "contact", path: "/contact", label: t.nav.contact }
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
          <ThemeToggle />
          <span className="text-white/20">|</span>
          <button onClick={toggleLanguage} className="hover:text-brand-gold transition-colors font-mono cursor-pointer uppercase tracking-wider px-2 py-0.5 rounded border border-white/20 hover:border-brand-gold/50 text-xs font-bold">
            {language === 'ar' ? 'EN' : 'عربي'}
          </button>
          <span className="text-white/20">|</span>
          <a href={`tel:${companyMeta.phone}`} className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <PhoneCall className="w-3.5 h-3.5 text-brand-gold" />
            <span>{companyMeta.phone}</span>
          </a>
          <span className="text-white/20 hidden md:inline">|</span>
          <p className="text-white/60 hidden md:block">{t.footer.support}</p>
        </div>
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
              <p className="text-[10px] text-white/50 font-bold tracking-tight">{t.footer.company}</p>
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
                  <p className="leading-tight">{link.label}</p>
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
              {t.header.requestBtn}
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
                  <span>{link.label}</span>
                </Link>
              );
            })}
            
            <Link
              id="mobile_cta_book"
              to="/request"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full block py-3 bg-brand-gold text-brand-deep font-extrabold rounded-xl text-center text-xs mt-3 cursor-pointer hover:bg-brand-blue hover:text-white transition-all duration-200"
            >
              {t.header.bookNowMobile}
            </Link>
            <a
              id="mobile_whatsapp_catalog"
              href="https://wa.me/c/971568757331"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full block py-3 bg-amber-600 text-white font-extrabold rounded-xl text-center text-xs mt-2 cursor-pointer hover:bg-amber-500 transition-all duration-200"
            >
              {t.header.whatsappCatalog}
            </a>
          </div>
        )}
      </header>

      {/* Main Page Area Wrapper */}
      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto relative z-10">
        <Suspense fallback={<div className="text-center text-white/70 py-10">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home onNavigate={handleNavigate} />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/services" element={<Services onNavigate={handleNavigate} />} />
            <Route path="/uae-delivery" element={<DeliveryUAE />} />
            <Route path="/international-shipping" element={<DeliveryInternational />} />
            <Route path="/international-advanced" element={<InternationalShippingAdvanced />} />
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
            <Route path="/gallery" element={<UltimateGalleryV2 />} />
            <Route path="/auth" element={<Auth onAuthSuccess={() => navigate("/admin")} />} />
            <Route path="/driver" element={<DriverMobileView orders={[]} onStatusChange={() => {}} />} />
            <Route path="/customer" element={<CustomerDashboard customerPhone="" orders={[]} onReorder={() => {}} />} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminPanel /></ProtectedAdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {/* Smart Chat Floating Agent Widget */}
      <SmartChat />

      {/* Premium Footer Component */}
      <Footer />
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <BrowserRouter>
      {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      <AppContent />
    </BrowserRouter>
  );
}

