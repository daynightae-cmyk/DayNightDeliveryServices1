import { useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Calculator, ClipboardCheck, MapPin, MessageCircle, Navigation, Package, ShieldCheck, Store, Truck, Zap } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import { cities, getQuickEstimate } from "../data/pricingEstimate";
import TestimonialCarousel from "./home/TestimonialCarousel";
import UAEInteractiveMap from "./home/UAEInteractiveMap";
import WorldClock from "./home/WorldClock";
import Premium3DIcon from "./ui/Premium3DIcon";
import { DNBadge, DNButton, DNCard, DNInput, DNSelect } from "./ui/DNDesignSystem";
import companyMeta from "../data/companyMeta";
import localAssets, { withRemoteFallback } from "../data/localAssets";

type HomePremiumProps = { onNavigate: (tab: string) => void };

const heroPosterUrl = localAssets.hero;

export default function HomePremium({ onNavigate }: HomePremiumProps) {
  const { language } = useAppContext();
  const t = translations[language];
  const isArabic = language === "ar";
  const [estimateFrom, setEstimateFrom] = useState(cities[1]);
  const [estimateTo, setEstimateTo] = useState(cities[0]);
  const [orderCount, setOrderCount] = useState<number | string>("1");

  const baseEstimate = getQuickEstimate(estimateFrom, estimateTo);
  const normalizedOrderCount = Math.max(1, Math.ceil(Number(orderCount) || 1));
  const totalEstimate = baseEstimate
    ? { min: baseEstimate.min * normalizedOrderCount, max: baseEstimate.max * normalizedOrderCount }
    : null;

  function formatAedRange(min: number, max: number) {
    if (language === "ar") return min === max ? `${min} درهم` : `${min}-${max} درهم`;
    return min === max ? `${min} AED` : `${min}-${max} AED`;
  }

  const stats = [
    { icon: Zap, value: "24/7", title: isArabic ? "خدمة على مدار الساعة" : "Around the clock", body: isArabic ? "طوال أيام الأسبوع" : "Every day of the week" },
    { icon: Calculator, value: "30 AED", title: isArabic ? "سعر الطلبيات المحلية" : "Local order pricing", body: isArabic ? "تسعير واضح ومباشر" : "Clear and direct pricing" },
    { icon: MapPin, value: "7+", title: isArabic ? "إمارات مغطاة" : "Emirates covered", body: isArabic ? "تغطية شاملة" : "Full UAE coverage" },
    { icon: ShieldCheck, value: "100%", title: isArabic ? "أمان وثقة" : "Safe and trusted", body: isArabic ? "فريق محترف" : "Professional team" },
  ];

  const officialServices = [
    {
      key: "request",
      icon: Truck,
      code: "01",
      title: isArabic ? "طلب توصيل" : "Request Delivery",
      body: isArabic ? "افتح طلباً جديداً بخطوات واضحة." : "Create a new delivery request with a clear flow.",
      tab: "request",
      tone: "gold",
    },
    {
      key: "tracking",
      icon: Package,
      code: "02",
      title: isArabic ? "التتبع" : "Tracking",
      body: isArabic ? "تابع الشحنة برقم التتبع أو الهاتف." : "Track by shipment code or phone number.",
      tab: "tracking",
      tone: "sky",
    },
    {
      key: "pricing",
      icon: Calculator,
      code: "03",
      title: isArabic ? "الأسعار" : "Pricing",
      body: isArabic ? "حاسبات محلية ودولية منظمة." : "Organized local and international calculators.",
      tab: "pricing",
      tone: "gold",
    },
    {
      key: "merchant",
      icon: Store,
      code: "04",
      title: isArabic ? "التاجر" : "Merchant",
      body: isArabic ? "طلبات، تحصيل، وخريطة مرتبطة بالحساب." : "Orders, COD, and account-linked map.",
      tab: "merchant",
      tone: "gold",
    },
    {
      key: "driver",
      icon: Navigation,
      code: "05",
      title: isArabic ? "المندوب" : "Driver",
      body: isArabic ? "وردية، مهام، وتحديث موقع." : "Shift, jobs, and location updates.",
      tab: "driver",
      tone: "sky",
    },
    {
      key: "support",
      icon: MessageCircle,
      code: "06",
      title: isArabic ? "الدعم" : "Support",
      body: isArabic ? "تواصل مباشر للمتابعة والتنسيق." : "Direct contact for follow-up and coordination.",
      tab: "contact",
      tone: "sky",
    },
  ];

  const portalCards = [
    {
      key: "merchant",
      icon: Store,
      label: isArabic ? "بوابة التاجر" : "Merchant portal",
      title: isArabic ? "إدارة الطلبات والتحصيل" : "Orders and collections",
      body: isArabic
        ? "دخول آمن يعرض حساب التاجر وطلبياته والتحصيل والخريطة حسب صلاحية الحساب."
        : "Secure merchant access for account details, orders, COD, and account-linked map activity.",
      cta: isArabic ? "فتح بوابة التاجر" : "Open merchant portal",
      tab: "merchant",
      tone: "gold",
    },
    {
      key: "driver",
      icon: Navigation,
      label: isArabic ? "بوابة المندوب" : "Driver portal",
      title: isArabic ? "الوردية والموقع والمهام" : "Shift, location, and jobs",
      body: isArabic
        ? "لوحة تشغيل للمندوب لبدء الوردية، تحديث الموقع، وإدارة الطلبات المسندة له."
        : "Driver portal for shifts, location updates, and assigned order operations.",
      cta: isArabic ? "فتح بوابة المندوب" : "Open driver portal",
      tab: "driver",
      tone: "blue",
    },
    {
      key: "customer",
      icon: Package,
      label: isArabic ? "حساب العميل" : "Customer account",
      title: isArabic ? "طلبات العميل والتتبع" : "Customer orders and tracking",
      body: isArabic
        ? "لوحة العميل لمراجعة الطلبات ومتابعة الشحنات المرتبطة بالحساب."
        : "Customer portal for order review and account-linked shipment tracking.",
      cta: isArabic ? "فتح حسابي" : "Open my account",
      tab: "customer",
      tone: "blue",
    },
    {
      key: "admin",
      icon: ShieldCheck,
      label: isArabic ? "لوحة الإدارة" : "Admin portal",
      title: isArabic ? "مركز التحكم التشغيلي" : "Operations command center",
      body: isArabic
        ? "دخول الإدارة لمتابعة الطلبات، الإسناد، التتبع، والتحكم في التشغيل."
        : "Admin access for orders, assignment, tracking, and operations control.",
      cta: isArabic ? "فتح لوحة الإدارة" : "Open admin portal",
      tab: "auth",
      tone: "gold",
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-14" dir={isArabic ? "rtl" : "ltr"}>
      <section className="dn-poster-hero dn-official-hero relative overflow-hidden rounded-[2.3rem] border px-5 pb-7 pt-10 sm:px-8 lg:px-10 lg:pt-12">
        <img src={heroPosterUrl} onError={(event) => withRemoteFallback(event, localAssets.remote.hero)} alt="" aria-hidden="true" className="dn-hero-poster-img pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,18,38,0.92),rgba(3,18,38,0.78),rgba(3,18,38,0.92))]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(25,167,255,0.22),transparent_62%)]" />

        <div className="dn-official-hero-kicker relative z-10 mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={`flex items-center gap-3 ${isArabic ? "sm:flex-row-reverse" : ""}`}>
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-brand-gold/35 bg-white shadow-lg shadow-brand-gold/10">
              <img src={localAssets.logo} onError={(event) => withRemoteFallback(event, localAssets.remote.logo)} alt="DAY NIGHT" className="h-full w-full object-contain p-1" />
            </span>
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-brand-gold">DAY NIGHT OFFICIAL SERVICES</p>
              <p className="text-xs font-bold text-white/58">{isArabic ? "توصيل محلي، دولي، متاجر، ومتابعة تشغيلية" : "Local, global, merchant, and operations services"}</p>
            </div>
          </div>
          <div className="rounded-full border border-brand-sky/25 bg-brand-sky/10 px-4 py-2 text-[11px] font-black text-brand-sky">
            {isArabic ? "بوابة موحدة للخدمات والتتبع" : "Unified portal for services and tracking"}
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.92fr_1.18fr_0.9fr] lg:items-center">
          <motion.div initial={{ opacity: 0, x: isArabic ? 24 : -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }} className="order-2 lg:order-1">
            <div className="relative mx-auto aspect-[1.18/1] max-w-[520px] overflow-hidden rounded-[2rem] border border-brand-sky/20 bg-brand-deep/45 shadow-2xl shadow-brand-sky/10 lg:mx-0">
              <img src={heroPosterUrl} onError={(event) => withRemoteFallback(event, localAssets.remote.hero)} alt="DAY NIGHT UAE delivery coverage" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#031226] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-brand-gold/25 bg-[#031226]/76 p-3 text-center text-xs font-black text-brand-gold backdrop-blur-xl">
                {isArabic ? "نصل إليك في كل وقت" : "Fast • Reliable • Every Time"}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className={`order-1 text-center lg:order-2 ${isArabic ? "lg:text-right" : "lg:text-left"}`}>
            <DNBadge tone="gold" className="mx-auto mb-5 lg:mx-0"><BadgeCheck className="h-4 w-4" /> {isArabic ? "خدمة احترافية على مدار الساعة" : "Premium 24/7 logistics"}</DNBadge>
            <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:mx-0">
              {isArabic ? "منصة DAY NIGHT للتوصيل الذكي" : "DAY NIGHT Smart Delivery"}
              <span className="mt-2 block text-brand-gold">{isArabic ? "طلبك، متجرك، ومندوبك في مسار واحد" : "Orders, merchants, and drivers in one flow"}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-bold leading-8 text-white/68 sm:text-base lg:mx-0">
              {t.home.heroSubtitle}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <DNButton id="cta_request_delivery" onClick={() => onNavigate("request")} size="lg"><Truck className="h-4 w-4" /> {t.home.bookDelivery}</DNButton>
              <DNButton id="cta_view_pricing" onClick={() => onNavigate("pricing")} variant="secondary" size="lg"><ClipboardCheck className="h-4 w-4 text-brand-gold" /> {t.home.getEstimate}</DNButton>
              <a id="cta_whatsapp_home" href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-lg"><MessageCircle className="h-4 w-4" /> {isArabic ? "واتساب" : "WhatsApp"}</a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: isArabic ? -24 : 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.58, delay: 0.08 }} className="order-3">
            <DNCard premium className="mx-auto max-w-[470px] p-5 sm:p-6 lg:mx-0">
              <div className="flex items-center justify-between gap-4">
                <div className={isArabic ? "text-right" : "text-left"}>
                  <DNBadge tone="blue"><Calculator className="h-3.5 w-3.5" /> {isArabic ? "احسب توصيلك المحلي" : "Local UAE estimate"}</DNBadge>
                  <p className="mt-3 text-sm font-bold leading-7 text-white/55">
                    {isArabic
                      ? "احسب تكلفة التوصيل داخل الإمارات خلال ثوانٍ حسب مدينة الاستلام ومدينة التسليم وعدد الطلبيات."
                      : "Estimate UAE delivery in seconds by pickup city, delivery city, and order count."}
                  </p>
                </div>
                <Premium3DIcon icon={Package} color="gold" size="md" animate />
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1"><span className="text-xs font-black text-white/50">{isArabic ? "من" : "From"}</span><DNSelect value={estimateFrom} onChange={(e) => setEstimateFrom(e.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</DNSelect></label>
                <label className="space-y-1"><span className="text-xs font-black text-white/50">{isArabic ? "إلى" : "To"}</span><DNSelect value={estimateTo} onChange={(e) => setEstimateTo(e.target.value)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</DNSelect></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-black text-white/50">{isArabic ? "عدد الطلبيات" : "Number of orders"}</span><DNInput type="number" value={orderCount} min="1" step="1" onChange={(e) => setOrderCount(e.target.value)} dir="ltr" /></label>
              </div>
              <div className="mt-5 rounded-2xl border border-brand-gold/35 bg-[#020914]/62 p-5 text-center">
                <p className="text-xs font-black text-white/52">{isArabic ? "إجمالي السعر التقديري" : "Estimated total"}</p>
                <p className="mt-2 text-4xl font-black text-brand-gold" dir="ltr">{totalEstimate ? formatAedRange(totalEstimate.min, totalEstimate.max) : "---"}</p>
                <p className="mt-2 text-[11px] font-bold text-white/38">
                  {baseEstimate
                    ? (isArabic ? `${normalizedOrderCount} طلبية × ${baseEstimate.base} درهم` : `${normalizedOrderCount} order(s) × ${baseEstimate.base} AED`)
                    : (isArabic ? "اختر مدينة الاستلام والتسليم." : "Select pickup and delivery cities.")}
                </p>
              </div>
              <button onClick={() => onNavigate("pricing")} className="dn-btn dn-btn-primary dn-btn-lg mt-4 w-full">{isArabic ? "احسب السعر بالتفصيل" : "Calculate full price"}</button>
            </DNCard>
          </motion.div>
        </div>

        <div className="dn-official-service-dock relative z-10 mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {officialServices.map(({ key, icon: Icon, code, title, body, tab, tone }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(tab)}
              className={`dn-official-service-card ${tone === "gold" ? "dn-official-service-card--gold" : "dn-official-service-card--sky"} ${isArabic ? "text-right" : "text-left"}`}
            >
              <span className="dn-official-service-card__top">
                <span className="dn-official-service-card__code">{code}</span>
                <Icon className="h-5 w-5" />
              </span>
              <span className="dn-official-service-card__title">{title}</span>
              <span className="dn-official-service-card__body">{body}</span>
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-7 grid grid-cols-1 gap-3 rounded-[1.5rem] border border-brand-sky/20 bg-[#020914]/58 p-3 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, title, body }) => (
            <div key={value} className={`flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 ${isArabic ? "flex-row-reverse text-right" : "text-left"}`}>
              <Icon className="h-9 w-9 shrink-0 text-brand-gold" />
              <div><p className="text-2xl font-black text-brand-gold" dir="ltr">{value}</p><p className="text-sm font-black text-white">{title}</p><p className="text-xs font-bold text-white/48">{body}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="dn-finish-surface rounded-[2.1rem] p-5 sm:p-7 lg:p-8">
        <div className="relative z-10 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <DNBadge tone="gold"><ShieldCheck className="h-3.5 w-3.5" /> {isArabic ? "بوابات التشغيل" : "Operations portals"}</DNBadge>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">{isArabic ? "كل البوابات من الواجهة الرئيسية" : "Every portal from the main site"}</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-white/58">
              {isArabic
                ? "وصول واضح للتاجر والمندوب والعميل والإدارة، مع بقاء كل مساحة مرتبطة بالطلبات والتتبع حسب الصلاحية والبيانات المتاحة."
                : "Clear access for merchant, driver, customer, and admin workspaces, each connected to orders and tracking according to account permissions and available data."}
            </p>
          </div>
          <img src={companyMeta.logoUrl} alt="DAY NIGHT" className="h-16 w-16 rounded-2xl border border-brand-gold/40 bg-white object-contain p-1" />
        </div>
        <div className="relative z-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {portalCards.map(({ key, icon: Icon, label, title, body, cta, tab, tone }) => (
            <article key={key} className={`group flex min-h-full flex-col justify-between overflow-hidden rounded-[1.8rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-2xl ${tone === "gold" ? "border-brand-gold/25 bg-brand-gold/[0.07] hover:shadow-brand-gold/10" : "border-brand-sky/25 bg-brand-sky/[0.07] hover:shadow-brand-sky/10"}`}>
              <div>
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tone === "gold" ? "bg-brand-gold text-brand-deep" : "bg-brand-sky text-brand-deep"}`}><Icon className="h-7 w-7" /></span>
                <p className={`mt-4 text-xs font-black uppercase tracking-[0.22em] ${tone === "gold" ? "text-brand-gold" : "text-brand-sky"}`}>{label}</p>
                <h3 className="mt-2 text-xl font-black text-white">{title}</h3>
                <p className="mt-3 text-sm font-bold leading-7 text-white/58">{body}</p>
              </div>
              <button type="button" onClick={() => onNavigate(tab)} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${tone === "gold" ? "bg-brand-gold text-brand-deep hover:brightness-110" : "bg-brand-sky text-brand-deep hover:brightness-110"}`}>
                {cta}
              </button>
            </article>
          ))}
        </div>
      </section>

      <WorldClock />
      <UAEInteractiveMap />
      <TestimonialCarousel />
    </div>
  );
}
