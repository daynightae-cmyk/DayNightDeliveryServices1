/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Menu, PhoneCall, X } from "lucide-react";
import { useAppContext } from "./lib/AppContext";
import { translations } from "./data/translations";
import companyMeta from "./data/companyMeta";
import localAssets, { withRemoteFallback } from "./data/localAssets";
import { trackPageLoad } from "./lib/monitoring";
import usePageSEO from "./hooks/usePageSEO";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import SmartChat from "./components/SmartChat";
import FloatingWhatsApp from "./components/FloatingWhatsApp";
import StickyMobileBar from "./components/StickyMobileBar";
import NotFound from "./components/NotFound";
import Auth from "./components/Auth";
import ThemeToggle from "./components/ThemeToggle";
import Splash from "./components/Splash";
import Footer from "./components/Footer";

const Home = lazy(() => import("./components/Home"));
const AboutUs = lazy(() => import("./components/AboutUs"));
const Services = lazy(() => import("./components/Services"));
const DeliveryUAE = lazy(() => import("./components/DeliveryUAE"));
const DeliveryInternational = lazy(() => import("./components/DeliveryInternational"));
const InternationalShippingAdvanced = lazy(() => import("./components/InternationalShippingAdvanced"));
const ECommerce = lazy(() => import("./components/ECommerce"));
const CorporateSolutions = lazy(() => import("./components/CorporateSolutions"));
const Pricing = lazy(() => import("./components/Pricing"));
const RequestDelivery = lazy(() => import("./components/RequestDelivery"));
const Tracking = lazy(() => import("./components/Tracking"));
const Faqs = lazy(() => import("./components/Faqs"));
const ContactUs = lazy(() => import("./components/ContactUs"));
const Policy = lazy(() => import("./components/Policy"));
const Privacy = lazy(() => import("./components/Privacy"));
const QR = lazy(() => import("./components/QR"));
const DriverPortal = lazy(() => import("./components/driver/DriverPortal"));
const UltimateGalleryV2 = lazy(() => import("./components/Gallery/UltimateGalleryV2"));
const AdminPanel = lazy(() => import("./components/AdminPanelLuxury"));
const CustomerDashboard = lazy(() => import("./components/customer/CustomerDashboardLuxury"));

const LOGO_IMAGE_URL = localAssets.logo;

function TrackingRouteWrapper() {
  const [searchParams] = useSearchParams();
  const { code } = useParams();
  return <Tracking initialTrackingId={code || searchParams.get("code") || ""} />;
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const { language, toggleLanguage, theme } = useAppContext();
  const isLight = theme === "light";
  const isArabic = language === "ar";
  const t = translations[language];

  usePageSEO();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current + 6 && y > 80) setHeaderHidden(true);
      else if (y < lastScrollY.current - 6) setHeaderHidden(false);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    trackPageLoad(location.pathname || "/");
  }, [location.pathname]);

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
    else if (tab === "tracking") navigate(trackingId ? `/tracking?code=${trackingId}` : "/tracking");
    else if (tab === "faqs" || tab === "faq") navigate("/faq");
    else if (tab === "contact") navigate("/contact");
    else if (tab === "policy") navigate("/policy");
    else if (tab === "qr") navigate("/qr");
    else if (tab === "gallery") navigate("/gallery");
    else if (tab === "auth") navigate("/auth");
    else if (tab === "admin") navigate("/admin");
    else if (tab === "customer") navigate("/customer");
  }

  const navLinks = [
    { key: "home", path: "/", label: t.nav.home },
    { key: "about", path: "/about", label: t.nav.about },
    { key: "services", path: "/services", label: t.nav.services },
    { key: "suburbs", path: "/uae-delivery", label: t.nav.suburbs },
    { key: "international", path: "/international-shipping", label: t.nav.international },
    { key: "ecommerce", path: "/ecommerce", label: t.nav.ecommerce },
    { key: "corporate", path: "/corporate", label: t.nav.corporate },
    { key: "pricing", path: "/pricing", label: t.nav.pricing },
    { key: "gallery", path: "/gallery", label: t.nav.gallery },
    { key: "tracking", path: "/tracking", label: t.nav.tracking },
    { key: "qr", path: "/qr", label: t.nav.qr },
    { key: "faqs", path: "/faq", label: t.nav.faqs },
    { key: "contact", path: "/contact", label: t.nav.contact },
  ];

  const adminLabel = isArabic ? "لوحة الإدارة" : "Admin Portal";
  const customerLabel = isArabic ? "حسابي" : "My Account";
  const currentPath = location.pathname;

  return (
    <div
      className={`min-h-screen flex flex-col justify-between antialiased leading-normal selection:bg-brand-gold/30 ${isLight ? "text-[#071A33]" : "text-white"}`}
      style={{ backgroundColor: isLight ? "#EDF3FF" : "#071A33", transition: "background-color 0.45s ease" }}
    >
      <div className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${headerHidden ? "-translate-y-full" : "translate-y-0"}`}>
        <div className={`text-[11px] py-2 px-4 sm:px-8 border-b flex flex-col sm:flex-row items-center justify-between gap-2 font-bold ${isLight ? "bg-[#E0EAFA]/80 border-[#071A33]/10 text-[#071A33]/80" : "bg-brand-cool/90 border-white/10 text-white"}`}>
          <div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
            <span className="text-brand-gold font-mono tracking-wider">{companyMeta.sloganEn}</span>
            <span className={isLight ? "text-[#071A33]/20" : "text-white/20"}>|</span>
            <span className={isLight ? "text-[#071A33]/70" : "text-white/70"}>{companyMeta.sloganAr}</span>
          </div>
          <div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse" : ""}`}>
            <ThemeToggle />
            <button onClick={toggleLanguage} className={`cursor-pointer uppercase tracking-wider px-2 py-0.5 rounded border text-xs font-bold transition-all ${isLight ? "border-[#071A33]/20 text-[#071A33]/70 hover:text-[#9A6F00]" : "border-white/20 text-white/80 hover:text-brand-gold"}`}>
              {language === "ar" ? "EN" : "عربي"}
            </button>
            <a href={`tel:${companyMeta.phone}`} className="flex items-center gap-1 hover:text-brand-gold" dir="ltr"><PhoneCall className="w-3.5 h-3.5 text-brand-gold" />{companyMeta.phone}</a>
            <Link id="top_admin_portal_link" to="/auth" className="hidden md:inline text-[10px] font-black text-white/55 hover:text-brand-gold transition-colors">{adminLabel}</Link>
            <Link id="top_customer_portal_link" to="/customer" className="hidden md:inline text-[10px] font-black text-brand-gold hover:text-white transition-colors">{customerLabel}</Link>
          </div>
        </div>

        <header className={`backdrop-blur-xl border-b transition-all duration-200 ${isLight ? "bg-white/90 border-[#071A33]/10 shadow-sm" : "bg-[#071A33]/90 border-white/10"}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5 cursor-pointer shrink-0 select-none" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <div className="w-11 h-11 rounded-full overflow-hidden border border-brand-gold/40 shadow-sm shrink-0"><img src={LOGO_IMAGE_URL} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT DELIVERY SERVICES" className="w-full h-full object-contain" /></div>
              <div>
                <h1 className={`text-sm sm:text-base font-extrabold leading-none uppercase tracking-tight ${isLight ? "text-[#071A33]" : "text-white"}`}>DAY NIGHT <span className="text-brand-gold text-[10px] font-semibold">DELIVERY</span></h1>
                <p className={`text-[10px] font-bold tracking-tight ${isLight ? "text-[#071A33]/50" : "text-white/50"}`}>{t.footer.company}</p>
              </div>
            </Link>

            <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-start gap-0.5 xl:gap-1 text-[10px] xl:text-[11px] font-semibold max-w-none mx-2 overflow-x-auto no-scrollbar scroll-smooth">
              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return <Link id={`nav_link_${link.key}`} key={link.key} to={link.path} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={`px-2 xl:px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${isActive ? "bg-brand-blue text-white font-extrabold shadow-md shadow-brand-blue/25" : isLight ? "text-[#071A33]/70 hover:text-[#071A33] hover:bg-[#071A33]/5" : "text-white/70 hover:text-white hover:bg-white/5"}`}>{link.label}</Link>;
              })}
            </nav>

            <div className="hidden md:flex items-center gap-2 shrink-0">
              <Link id="desktop_admin_portal_link" to="/auth" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={`px-3 py-2 border font-bold rounded-lg text-[11px] transition-all ${isLight ? "border-[#071A33]/20 text-[#071A33]/70 hover:border-brand-gold/60" : "border-white/20 text-white/80 hover:border-brand-gold/50"}`}>{adminLabel}</Link>
              <Link id="desktop_customer_portal_link" to="/customer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="px-3 py-2 border border-brand-gold/50 bg-brand-gold/10 text-brand-gold font-bold rounded-lg text-[11px] transition-all hover:bg-brand-gold hover:text-brand-deep">{customerLabel}</Link>
              <Link to="/tracking" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={`px-3 py-2 border font-bold rounded-lg text-[11px] transition-all ${isLight ? "border-[#071A33]/20 text-[#071A33]/70 hover:border-brand-gold/60" : "border-white/20 text-white/80 hover:border-brand-gold/50"}`}>{t.header.trackBtn}</Link>
              <Link id="header_cta_btn" to="/request" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn-gold px-4 py-2.5 rounded-lg text-[11px] leading-none cursor-pointer">{t.header.requestBtn}</Link>
            </div>

            <button id="mobile_menu_trigger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`lg:hidden p-2 transition-colors ${isLight ? "text-[#071A33]/80 hover:text-[#071A33]" : "text-white/80 hover:text-white"}`} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}>{mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
          </div>

          {mobileMenuOpen && (
            <div className={`lg:hidden border-t py-4 px-4 space-y-1 max-h-[72vh] overflow-y-auto ${isLight ? "bg-white/95 border-[#071A33]/10" : "bg-brand-cool/95 border-white/10"}`}>
              {navLinks.map((link) => {
                const isActive = currentPath === link.path;
                return <Link id={`mobile_nav_link_${link.key}`} key={link.key} to={link.path} onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`w-full block p-3 rounded-xl text-xs font-bold transition-all ${isArabic ? "text-right" : "text-left"} ${isActive ? "bg-brand-blue text-white" : isLight ? "text-[#071A33]/75 hover:bg-[#071A33]/5" : "text-white/75 hover:bg-white/5"}`}>{link.label}</Link>;
              })}
              <div className="pt-2 space-y-2">
                <Link id="mobile_customer_portal_link" to="/customer" onClick={() => setMobileMenuOpen(false)} className="w-full block py-3 border border-brand-gold/50 bg-brand-gold/10 text-brand-gold font-extrabold rounded-xl text-center text-xs transition-all">{customerLabel}</Link>
                <Link id="mobile_admin_portal_link" to="/auth" onClick={() => setMobileMenuOpen(false)} className="w-full block py-3 border border-brand-gold/50 text-brand-gold bg-brand-gold/10 font-extrabold rounded-xl text-center text-xs transition-all">{adminLabel}</Link>
                <Link to="/tracking" onClick={() => setMobileMenuOpen(false)} className={`w-full block py-3 border font-bold rounded-xl text-center text-xs transition-all ${isLight ? "border-[#071A33]/20 text-[#071A33]/75" : "border-white/20 text-white"}`}>{t.header.trackBtn}</Link>
                <Link id="mobile_cta_book" to="/request" onClick={() => setMobileMenuOpen(false)} className="w-full block py-3 btn-gold rounded-xl text-center text-xs font-extrabold">{t.header.bookNowMobile}</Link>
                <a id="mobile_whatsapp_catalog" href={companyMeta.whatsappCatalog} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="w-full block py-3 btn-whatsapp rounded-xl text-center text-xs font-extrabold">{t.header.whatsappCatalog}</a>
              </div>
            </div>
          )}
        </header>
      </div>

      <div className="h-[96px] sm:h-[108px]" aria-hidden="true" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto relative z-10">
        <Suspense fallback={<div className={`text-center py-16 ${isLight ? "text-[#071A33]/50" : "text-white/50"}`}><div className="inline-block w-8 h-8 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" /></div>}>
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
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Policy />} />
            <Route path="/shipping-policy" element={<Policy />} />
            <Route path="/refund-policy" element={<Policy />} />
            <Route path="/trust" element={<Policy />} />
            <Route path="/qr" element={<QR onNavigate={handleNavigate} />} />
            <Route path="/gallery" element={<UltimateGalleryV2 />} />
            <Route path="/auth" element={<Auth onAuthSuccess={() => navigate("/admin")} />} />
            <Route path="/driver" element={<DriverPortal />} />
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/update-password" element={<CustomerDashboard />} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminPanel /></ProtectedAdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {!mobileMenuOpen && <FloatingWhatsApp />}
      {!mobileMenuOpen && <SmartChat />}
      {!mobileMenuOpen && <StickyMobileBar />}
      <Footer />
    </div>
  );
}

export default function App() {
  const skipSplash = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nosplash");
  const [showSplash, setShowSplash] = useState(!skipSplash);

  return (
    <BrowserRouter>
      {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      <AppContent />
    </BrowserRouter>
  );
}
