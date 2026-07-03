/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, BadgeCheck, CheckCircle, Calculator, PackageCheck, Truck, MessageSquare, Navigation } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import { coverageAreas } from "../data/coverage";
import companyMeta from "../data/companyMeta";

const CITY_ROUTE_PRICE = 30;
const SPECIAL_ROUTE_PRICE = 50;

function areaPrice(zoneType: string) {
  return zoneType === "extended" ? SPECIAL_ROUTE_PRICE : CITY_ROUTE_PRICE;
}

function areaLabel(area: { nameAr: string; nameEn: string; zoneType: string }, isArabic: boolean) {
  const price = areaPrice(area.zoneType);
  return isArabic ? `${area.nameAr} — ${price} درهم` : `${area.nameEn} — ${price} AED`;
}

export default function DeliveryUAE() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const lp = pageCopy[language].localDeliveryPage;
  const [searchQuery, setSearchTerm] = useState("");
  const [pickupArea, setPickupArea] = useState("Abu Dhabi");
  const [deliveryArea, setDeliveryArea] = useState("Dubai");
  const [orderCount, setOrderCount] = useState<number | string>(1);

  const cityRoutes = coverageAreas.filter((area) => area.zoneType !== "extended");
  const specialRoutes = coverageAreas.filter((area) => area.zoneType === "extended");
  const allRoutes = [...cityRoutes, ...specialRoutes];
  const pickup = allRoutes.find((area) => area.nameEn === pickupArea) || cityRoutes[0];
  const delivery = allRoutes.find((area) => area.nameEn === deliveryArea) || cityRoutes[1] || cityRoutes[0];
  const normalizedOrderCount = Math.max(1, Math.ceil(Number(orderCount) || 1));
  const unitPrice = Math.max(areaPrice(pickup.zoneType), areaPrice(delivery.zoneType));
  const totalPrice = unitPrice * normalizedOrderCount;

  const examples = useMemo(() => [1, 2, 3, 5].map((count) => ({ count, total: count * unitPrice })), [unitPrice]);

  const filteredRoutes = allRoutes.filter((area) => {
    const q = searchQuery.toLowerCase();
    return area.nameEn.toLowerCase().includes(q) || area.nameAr.includes(searchQuery) || area.emirate.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-12" dir={isArabic ? "rtl" : "ltr"}>
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="bg-brand-blue/15 border border-brand-blue/35 text-brand-blue text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-widest inline-block">{lp.title}</span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">{isArabic ? "الشحن المحلي داخل الإمارات" : "Local Shipping Across the UAE"}</h2>
        <p className="text-white/60 text-sm leading-7">{isArabic ? "اختر منطقة الاستلام ومنطقة التسليم وعدد الطلبات ليظهر السعر فوراً. المسارات الأساسية 30 درهم للطلب، والمسارات الخاصة 50 درهم للطلب." : "Choose pickup area, delivery area, and order count to see the total instantly. Standard routes are 30 AED per order; special routes are 50 AED per order."}</p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="dn-card-premium rounded-3xl p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse text-right" : "text-left"}`}><Calculator className="h-8 w-8 text-brand-gold" /><div><h3 className="text-xl font-black text-white">{isArabic ? "حاسبة الشحن المحلي" : "Local shipping calculator"}</h3><p className="text-xs font-bold text-white/45">{isArabic ? "مناطق واضحة + عدد الطلبات" : "Clear areas + order count"}</p></div></div>
            <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[10px] font-black text-brand-gold">DAY NIGHT</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "منطقة الاستلام" : "Pickup area"}</span><select value={pickupArea} onChange={(e) => setPickupArea(e.target.value)} className="dn-input"><optgroup label={isArabic ? "المسارات الأساسية — 30 درهم" : "Standard routes — 30 AED"}>{cityRoutes.map((area) => <option key={area.id} value={area.nameEn}>{areaLabel(area, isArabic)}</option>)}</optgroup><optgroup label={isArabic ? "المسارات الخاصة — 50 درهم" : "Special routes — 50 AED"}>{specialRoutes.map((area) => <option key={area.id} value={area.nameEn}>{areaLabel(area, isArabic)}</option>)}</optgroup></select></label>
            <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "منطقة التسليم" : "Delivery area"}</span><select value={deliveryArea} onChange={(e) => setDeliveryArea(e.target.value)} className="dn-input"><optgroup label={isArabic ? "المسارات الأساسية — 30 درهم" : "Standard routes — 30 AED"}>{cityRoutes.map((area) => <option key={area.id} value={area.nameEn}>{areaLabel(area, isArabic)}</option>)}</optgroup><optgroup label={isArabic ? "المسارات الخاصة — 50 درهم" : "Special routes — 50 AED"}>{specialRoutes.map((area) => <option key={area.id} value={area.nameEn}>{areaLabel(area, isArabic)}</option>)}</optgroup></select></label>
            <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-black text-white/50">{isArabic ? "عدد الطلبات" : "Order count"}</span><input value={orderCount} onChange={(e) => setOrderCount(e.target.value)} className="dn-input" type="number" min="1" step="1" dir="ltr" /></label>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gold/25 bg-brand-deep/75 p-5 text-center"><p className="text-xs font-black text-white/50">{isArabic ? "الإجمالي المحلي" : "Local total"}</p><p className="mt-2 text-4xl font-black text-brand-gold" dir="ltr">{totalPrice.toFixed(2)} AED</p><p className="mt-2 text-xs font-bold text-white/45">{isArabic ? `${normalizedOrderCount} طلب × ${unitPrice} درهم` : `${normalizedOrderCount} order(s) × ${unitPrice} AED`}</p></div>
          <div className="mt-4 grid grid-cols-2 gap-2">{examples.map((item) => <div key={item.count} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-center"><p className="text-xs font-bold text-white/55">{isArabic ? `${item.count} طلب` : `${item.count} order(s)`}</p><p className="mt-1 font-mono text-lg font-black text-brand-gold">{item.total} AED</p></div>)}</div>
          <div className="mt-5 flex flex-wrap gap-2"><Link to="/request" className="dn-btn dn-btn-primary dn-btn-md flex-1"><Truck className="h-4 w-4" />{isArabic ? "اطلب توصيل" : "Request delivery"}</Link><a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md flex-1"><MessageSquare className="h-4 w-4" />WhatsApp</a></div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <div className="dn-card rounded-3xl p-5"><PackageCheck className="h-8 w-8 text-brand-gold" /><p className="mt-4 text-3xl font-black text-brand-gold" dir="ltr">30 AED</p><h3 className="mt-2 font-black text-white">{isArabic ? "المسارات الأساسية" : "Standard routes"}</h3><p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "مدن ومناطق داخلية رئيسية ضمن تغطية داي نايت." : "Key cities and internal areas covered by DAY NIGHT."}</p></div>
          <div className="dn-card rounded-3xl p-5"><Navigation className="h-8 w-8 text-brand-sky" /><p className="mt-4 text-3xl font-black text-brand-gold" dir="ltr">50 AED</p><h3 className="mt-2 font-black text-white">{isArabic ? "المسارات الخاصة" : "Special routes"}</h3><p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "مسارات تشغيل خاصة يتم تسعيرها بوضوح داخل القائمة." : "Special operations routes shown clearly in the list."}</p></div>
          <div className="dn-card rounded-3xl p-5"><CheckCircle className="h-8 w-8 text-emerald-300" /><p className="mt-4 text-3xl font-black text-brand-gold" dir="ltr">24/7</p><h3 className="mt-2 font-black text-white">{isArabic ? "متابعة مباشرة" : "Direct support"}</h3><p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "عند عدم ظهور منطقتك، تواصل معنا لتأكيد المسار وسعر التشغيل." : "If your area is not listed, contact us to confirm route and price."}</p></div>
        </div>
      </section>

      <section className="dn-card-premium rounded-3xl p-6 sm:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="relative max-w-sm w-full"><Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" /><input id="region_search_input" type="text" placeholder={isArabic ? "ابحث عن مدينة أو مسار..." : "Search city or route..."} value={searchQuery} onChange={(e) => setSearchTerm(e.target.value)} className="dn-input w-full pl-9" /></div><div className="space-y-1 text-right"><h3 className="text-lg font-bold text-white">{isArabic ? "قائمة المناطق والمسارات" : "Areas and route directory"}</h3><p className="text-white/50 text-xs">{isArabic ? "كل منطقة تظهر بسعرها التشغيلي مباشرة." : "Every area is shown with its operations price directly."}</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">{filteredRoutes.map((area, i) => <div key={area.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span className="text-xs bg-brand-deep px-2 py-0.5 rounded-sm font-mono font-bold text-brand-gold border border-white/5" dir="ltr">{areaPrice(area.zoneType)} AED</span><div className="flex items-center gap-2 text-right"><div><p className="text-sm font-black text-white">{isArabic ? area.nameAr : area.nameEn}</p><p className="text-[10px] font-bold text-white/40">{area.emirate} • #{i + 1}</p></div><MapPin className="w-4 h-4 text-white/30" /></div></div>)}</div>
      </section>

      <section className="dn-card rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6"><a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all text-center cursor-pointer shrink-0">{isArabic ? "تحقق سريع عبر واتساب" : "Quick WhatsApp check"}</a><div className="flex items-center gap-4 text-right"><div><h4 className="font-bold text-white text-lg font-sans">{isArabic ? "لم تجد منطقتك؟" : "Can’t find your area?"}</h4><p className="text-white/60 text-sm mt-0.5">{isArabic ? "تواصل فوراً مع داي نايت لتأكيد المسار وسعر التشغيل." : "Contact DAY NIGHT for route and price confirmation."}</p></div><div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center shrink-0 border border-white/10"><BadgeCheck className="w-6 h-6 text-brand-gold" /></div></div></section>
    </div>
  );
}
