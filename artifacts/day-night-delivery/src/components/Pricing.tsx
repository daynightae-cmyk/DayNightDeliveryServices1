import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgePercent, Check, FileText, MessageSquare, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { coverageAreas } from "../data/coverage";
import { domesticPricing, internationalDestinations, internationalPricing } from "../data/pricingData";
import { calculateDomesticPrice, calculateInternationalPrice, formatAED } from "../lib/pricing";
import { exportDomesticQuotePDF, exportIntlQuotePDF, exportQuoteTXT } from "../lib/exportUtils";
import { exportArabicDomesticQuotePdf, exportArabicInternationalQuotePdf } from "../lib/arabicQuotePdf";
import { useAppContext } from "../lib/AppContext";
import { translations } from "../data/translations";
import companyMeta from "../data/companyMeta";
import { DNBadge, DNButton, DNCard, DNPageShell, DNSelect, DNStat } from "./ui/DNDesignSystem";

const LOCAL_SERVICE = "standard" as const;
const LOCAL_WEIGHT = 1;

export default function Pricing() {
  const { language } = useAppContext();
  const tp = translations[language].pricingPage;
  const isArabic = language === "ar";
  const [domesticPickupCity, setDomesticPickupCity] = useState("Abu Dhabi");
  const [domesticDeliveryCity, setDomesticDeliveryCity] = useState("Dubai");
  const [localOrderCount, setLocalOrderCount] = useState(1);
  const [internationalDestination, setInternationalDestination] = useState("SA");
  const [internationalWeight, setInternationalWeight] = useState(1);
  const cityRoutes = coverageAreas.filter((a) => a.zoneType !== "extended");
  const specialRoutes = coverageAreas.filter((a) => a.zoneType === "extended");
  const domestic = useMemo(() => calculateDomesticPrice({ pickupCity: domesticPickupCity, deliveryCity: domesticDeliveryCity, serviceType: LOCAL_SERVICE, weight: LOCAL_WEIGHT, pieces: localOrderCount }), [domesticPickupCity, domesticDeliveryCity, localOrderCount]);
  const international = useMemo(() => calculateInternationalPrice({ countryCode: internationalDestination, weight: internationalWeight }), [internationalDestination, internationalWeight]);
  const statCards = [
    [isArabic ? "طلب واحد" : "1 local order", domesticPricing.main.total, isArabic ? "مسار أساسي" : "standard route", "gold"],
    [isArabic ? "طلبان" : "2 local orders", domesticPricing.main.total * 2, isArabic ? "2 × 30 درهم" : "2 × 30 AED", "blue"],
    [isArabic ? "3 طلبات" : "3 local orders", domesticPricing.main.total * 3, isArabic ? "3 × 30 درهم" : "3 × 30 AED", "neutral"],
    [isArabic ? "مسار خاص" : "Special route", domesticPricing.extended.total, isArabic ? "50 درهم للطلب" : "50 AED per order", "green"],
    [tp.gccFirstKg, internationalPricing.gcc.firstKg, tp.thenPerKg.replace("{rate}", String(internationalPricing.gcc.additionalKg)), "gold"],
  ] as const;
  const dest = internationalDestinations.find((d) => d.countryCode === internationalDestination) || internationalDestinations[0];

  const resetDomestic = () => { setDomesticPickupCity("Abu Dhabi"); setDomesticDeliveryCity("Dubai"); setLocalOrderCount(1); };
  const resetInternational = () => { setInternationalDestination("SA"); setInternationalWeight(1); };
  const domesticPdf = () => {
    const quote = { pickupCity: domesticPickupCity, deliveryCity: domesticDeliveryCity, service: LOCAL_SERVICE, weight: LOCAL_WEIGHT, pieces: localOrderCount, basePrice: domestic.total, expressCharge: 0, extraPiecesCharge: 0, total: domestic.total };
    if (isArabic) { void exportArabicDomesticQuotePdf(quote); return; }
    exportDomesticQuotePDF(quote, "en");
  };
  const intlPdf = () => {
    const quote = { destination: dest ? dest.countryNameEn : internationalDestination, weight: internationalWeight, firstKgPrice: dest ? dest.firstKg : 0, additionalKgPrice: dest ? dest.additionalKg : 0, total: international.total, zone: international.pricingCategory };
    if (isArabic) { void exportArabicInternationalQuotePdf({ ...quote, destination: dest ? dest.countryNameAr : internationalDestination }); return; }
    exportIntlQuotePDF(quote, "en");
  };
  const domesticTxt = () => exportQuoteTXT("domestic", { "Pickup Area": domesticPickupCity, "Delivery Area": domesticDeliveryCity, "Order Count": localOrderCount, Service: LOCAL_SERVICE, Total: formatAED(domestic.total) });
  const intlTxt = () => exportQuoteTXT("international", { Destination: dest ? (isArabic ? dest.countryNameAr : dest.countryNameEn) : internationalDestination, Weight: `${internationalWeight} kg`, Zone: international.pricingCategory, Total: formatAED(international.total) });

  const renderAreaOptions = () => <>
    <optgroup label={isArabic ? "المسارات الأساسية — 30 درهم" : "Standard routes — 30 AED"}>{cityRoutes.map((c) => <option key={c.id} value={c.nameEn}>{isArabic ? `${c.nameAr} — 30 درهم` : `${c.nameEn} — 30 AED`}</option>)}</optgroup>
    <optgroup label={isArabic ? "المسارات الخاصة — 50 درهم" : "Special routes — 50 AED"}>{specialRoutes.map((c) => <option key={c.id} value={c.nameEn}>{isArabic ? `${c.nameAr} — 50 درهم` : `${c.nameEn} — 50 AED`}</option>)}</optgroup>
  </>;

  return <div className={`space-y-8 ${isArabic ? "text-right" : "text-left"}`} dir={isArabic ? "rtl" : "ltr"}>
    <DNPageShell kicker={<><BadgePercent className="h-4 w-4" /> {tp.badge}</>} title={tp.title} subtitle={isArabic ? "الشحن المحلي حسب عدد الطلبات والمسار، والشحن الدولي حسب الوزن والوجهة." : "Local shipping is by order count and route; international shipping is by weight and destination."} actions={<><Link to="/request" className="dn-btn dn-btn-primary dn-btn-md"><Truck className="h-4 w-4" />{tp.requestDelivery}</Link><a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md"><MessageSquare className="h-4 w-4" />WhatsApp</a></>}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">{statCards.map(([label, value, hint, tone]) => <DNStat key={label} label={label} value={formatAED(Number(value))} hint={hint} tone={tone} />)}</div>
    </DNPageShell>

    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <DNCard premium className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4"><div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse" : ""}`}><Truck className="h-8 w-8 text-brand-gold" /><div><h3 className="text-xl font-black text-white">{isArabic ? "حاسبة الشحن المحلي" : "Local shipping calculator"}</h3><p className="text-xs font-bold text-white/45">{isArabic ? "المسارات الأساسية 30 درهم للطلب، والمسارات الخاصة 50 درهم للطلب." : "Standard routes are 30 AED per order; special routes are 50 AED per order."}</p></div></div><button onClick={resetDomestic} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/45 hover:text-brand-gold"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "منطقة الاستلام" : "Pickup area"}</span><DNSelect value={domesticPickupCity} onChange={(e) => setDomesticPickupCity(e.target.value)}>{renderAreaOptions()}</DNSelect></label>
          <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "منطقة التسليم" : "Delivery area"}</span><DNSelect value={domesticDeliveryCity} onChange={(e) => setDomesticDeliveryCity(e.target.value)}>{renderAreaOptions()}</DNSelect></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-black text-white/50">{isArabic ? "عدد الطلبات" : "Order count"}</span><input className="dn-input" type="number" min="1" step="1" value={localOrderCount} onChange={(e) => setLocalOrderCount(Math.max(1, Math.round(Number(e.target.value) || 1)))} dir="ltr" /></label>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-brand-deep/70 p-5">{domestic.breakdown.map((line) => <div key={line} className={`mb-2 flex items-center justify-between gap-3 text-xs font-bold text-white/65 ${isArabic ? "flex-row-reverse" : ""}`}><Check className="h-4 w-4 text-emerald-300" /><span dir="ltr">{line}</span></div>)}<p className="mt-3 text-xs font-bold text-white/45">{isArabic ? "عدد الطلبات هو عنصر الحساب المحلي. الوزن يظهر في الشحن الدولي فقط." : "Order count is the local multiplier. Weight is shown only for international shipping."}</p><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4"><span className="font-black text-white">{tp.totalPrice}</span><span className="font-mono text-3xl font-black text-brand-gold" dir="ltr">{formatAED(domestic.total)}</span></div></div>
        <div className="mt-5 flex flex-wrap gap-2"><Link to="/request" className="dn-btn dn-btn-primary dn-btn-md flex-1">{tp.requestDelivery}</Link><a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md flex-1">WhatsApp</a><DNButton variant="secondary" size="sm" onClick={domesticPdf}><FileText className="h-3.5 w-3.5" />PDF</DNButton><DNButton variant="ghost" size="sm" onClick={domesticTxt}>TXT</DNButton></div>
      </DNCard>

      <DNCard premium className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4"><div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse" : ""}`}><PackageCheck className="h-8 w-8 text-brand-gold" /><div><h3 className="text-xl font-black text-white">{tp.internationalCalculator}</h3><p className="text-xs font-bold text-white/45">{tp.internationalHint}</p></div></div><button onClick={resetInternational} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/45 hover:text-brand-gold"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-black text-white/50">{tp.destination}</span><DNSelect value={internationalDestination} onChange={(e) => setInternationalDestination(e.target.value)}>{internationalDestinations.map((d) => <option key={d.countryCode} value={d.countryCode}>{isArabic ? d.countryNameAr : d.countryNameEn}</option>)}</DNSelect></label><label className="space-y-1.5"><span className="text-xs font-black text-white/50">{tp.weight}</span><input className="dn-input" type="number" min="0.1" step="0.1" value={internationalWeight} onChange={(e) => setInternationalWeight(Math.max(0.1, Number(e.target.value) || 1))} dir="ltr" /></label></div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-brand-deep/70 p-5">{international.breakdown.map((line) => <div key={line} className={`mb-2 flex items-center justify-between gap-3 text-xs font-bold text-white/65 ${isArabic ? "flex-row-reverse" : ""}`}><Check className="h-4 w-4 text-emerald-300" /><span dir="ltr">{line}</span></div>)}{international.requiresCustomQuote && <p className="text-xs font-bold text-amber-300">{isArabic ? "⚠️ وزن كبير جداً — يتطلب عرض سعر خاص." : "⚠️ Very heavy shipment — requires custom quote."}</p>}<div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4"><span className="font-black text-white">{tp.totalPrice}</span><span className="font-mono text-3xl font-black text-brand-gold" dir="ltr">{formatAED(international.total)}</span></div><p className="mt-3 text-[11px] font-bold text-white/35" dir="ltr">{international.notes}</p></div>
        <div className="mt-5 flex flex-wrap gap-2"><Link to="/tracking" className="dn-btn dn-btn-secondary dn-btn-md flex-1"><Search className="h-4 w-4 text-brand-gold" />{tp.trackShipment}</Link><a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md flex-1">WhatsApp</a><DNButton variant="secondary" size="sm" onClick={intlPdf}><FileText className="h-3.5 w-3.5" />PDF</DNButton><DNButton variant="ghost" size="sm" onClick={intlTxt}>TXT</DNButton></div>
      </DNCard>
    </section>

    <DNCard premium className="p-5 sm:p-6"><div className="flex flex-col items-center justify-between gap-4 lg:flex-row"><div><DNBadge>{tp.readyTitle}</DNBadge><p className="mt-3 text-sm font-bold leading-7 text-white/55">{tp.readySubtitle}</p></div><div className="flex flex-wrap justify-center gap-3"><Link to="/request" className="dn-btn dn-btn-primary dn-btn-md"><Truck className="h-4 w-4" />{tp.requestDelivery}</Link><Link to="/tracking" className="dn-btn dn-btn-secondary dn-btn-md"><Search className="h-4 w-4 text-brand-gold" />{tp.trackShipment}</Link><a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md"><MessageSquare className="h-4 w-4" />{tp.contactWhatsApp}</a></div></div></DNCard>
  </div>;
}
