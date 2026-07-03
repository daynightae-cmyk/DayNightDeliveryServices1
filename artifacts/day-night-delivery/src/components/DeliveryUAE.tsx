/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, BadgeCheck, CheckCircle, Calculator, PackageCheck, Truck, MessageSquare } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { pageCopy } from "../data/pageCopy";
import companyMeta from "../data/companyMeta";

const MAIN_ORDER_PRICE = 30;
const EXTENDED_ORDER_PRICE = 50;

type LocalZone = "main" | "extended";

export default function DeliveryUAE() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const lp = pageCopy[language].localDeliveryPage;
  const [searchQuery, setSearchTerm] = useState("");
  const [pickupCity, setPickupCity] = useState("Abu Dhabi");
  const [deliveryCity, setDeliveryCity] = useState("Dubai");
  const [deliveryZone, setDeliveryZone] = useState<LocalZone>("main");
  const [orderCount, setOrderCount] = useState<number | string>(1);

  const mainCities = [
    { name: "Abu Dhabi", ar: "أبوظبي", price: MAIN_ORDER_PRICE },
    { name: "Dubai", ar: "دبي", price: MAIN_ORDER_PRICE },
    { name: "Sharjah", ar: "الشارقة", price: MAIN_ORDER_PRICE },
    { name: "Ajman", ar: "عجمان", price: MAIN_ORDER_PRICE },
    { name: "Umm Al Quwain", ar: "أم القيوين", price: MAIN_ORDER_PRICE },
    { name: "Ras Al Khaimah", ar: "رأس الخيمة", price: MAIN_ORDER_PRICE },
    { name: "Fujairah", ar: "الفجيرة", price: MAIN_ORDER_PRICE },
    { name: "Khorfakkan", ar: "خورفكان", price: MAIN_ORDER_PRICE }
  ];

  const alAinRegions = [
    "Al Ain - Abu Samra (العين - أبو سمرة)", "Al Ain - Al Khatm (العين - الختم)", "Al Ain - Al Khazna (العين - الخزنة)", "Al Ain - Al Saad (العين - السد)",
    "Al Ain - Al Thahira (العين - الظاهرة/الزينة)", "Al Ain - Al Arrad (العين - العراد/مزيد)", "Al Ain - Al Quaa (العين - القوع)", "Al Ain - Al Waqan (العين - الهير)",
    "Al Ain - Bu Kariya (العين - بوكرية)", "Al Ain - Rmah (العين - رماح)", "Al Ain - Swihan (العين - سويحان)", "Al Ain - Seeh Allahma (العين - سيح اللحمة)",
    "Al Ain - Seeh Sabra (العين - سماح)", "Al Ain - Trucks Road (العين - طريق الشاحنات)", "Al Ain - Nahil (العين - ناهل)"
  ];

  const westernRegions = [
    "Western Region - Al Ruwais (الغربية - الرويس)", "Western Region - Sila (الغربية - السلع)", "Western Region - Shuweihat (الغربية - الشويهات)",
    "Western Region - Al Dhanna (الغربية - الظنة)", "Western Region - Al Marfaa (الغربية - المرفأ)", "Western Region - Madinat Zayed (الغربية - مدينة زايد)",
    "Western Region - Bada' Mutawa (الغربية - بدع مطاوعة)", "Western Region - Baynouna (الغربية - بينونة)", "Western Region - Habshan (الغربية - حبشان)",
    "Western Region - Hamim (الغربية - حميم)", "Western Region - Assab (الغربية - عصب)", "Western Region - Ghayathi (الغربية - غياثي)",
    "Western Region - Liwa (الغربية - ليوا)"
  ];

  const allCityOptions = [...mainCities.map((city) => city.name), "Al Ain", "Western Region"];
  const normalizedOrderCount = Math.max(1, Math.ceil(Number(orderCount) || 1));
  const unitPrice = deliveryZone === "extended" ? EXTENDED_ORDER_PRICE : MAIN_ORDER_PRICE;
  const totalPrice = unitPrice * normalizedOrderCount;

  const examples = useMemo(() => [
    { count: 1, total: unitPrice * 1 },
    { count: 2, total: unitPrice * 2 },
    { count: 3, total: unitPrice * 3 },
    { count: 5, total: unitPrice * 5 },
  ], [unitPrice]);

  const filteredAlAin = alAinRegions.filter(region =>
    region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWestern = westernRegions.filter(region =>
    region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12" dir={isArabic ? "rtl" : "ltr"}>
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="bg-brand-blue/15 border border-brand-blue/35 text-brand-blue text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-widest inline-block">
          {lp.title}
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {isArabic ? "التوصيل المحلي داخل الإمارات بالطلبية وليس بالكيلو" : "UAE local delivery priced by order count, not kilograms"}
        </h2>
        <p className="text-white/60 text-sm leading-7">
          {isArabic
            ? "بيانات واضحة مثل صفحة الشحن الدولي: اختر عدد الطلبيات والمنطقة وسيظهر الإجمالي فوراً. المناطق الرئيسية 30 درهم للطلبية، والمناطق الممتدة 50 درهم للطلبية."
            : "Clear local pricing data: choose the order count and zone to see the final total instantly. Main areas are 30 AED per order; extended areas are 50 AED per order."}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-brand-gold/20 bg-brand-cool/35 p-5 sm:p-6 shadow-2xl shadow-brand-gold/5">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className={`flex items-center gap-3 ${isArabic ? "flex-row-reverse text-right" : "text-left"}`}>
              <Calculator className="h-8 w-8 text-brand-gold" />
              <div>
                <h3 className="text-xl font-black text-white">{isArabic ? "حاسبة التوصيل المحلي" : "Local delivery calculator"}</h3>
                <p className="text-xs font-bold text-white/45">{isArabic ? "عدد الطلبيات × سعر المنطقة" : "Order count × zone price"}</p>
              </div>
            </div>
            <span className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-[10px] font-black text-brand-gold">NO KG</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "مدينة الاستلام" : "Pickup city"}</span><select value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} className="dn-input">{allCityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
            <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "مدينة التسليم" : "Delivery city"}</span><select value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} className="dn-input">{allCityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
            <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "نوع المنطقة" : "Zone type"}</span><select value={deliveryZone} onChange={(e) => setDeliveryZone(e.target.value as LocalZone)} className="dn-input"><option value="main">{isArabic ? "منطقة رئيسية — 30 درهم" : "Main area — 30 AED"}</option><option value="extended">{isArabic ? "منطقة ممتدة — 50 درهم" : "Extended area — 50 AED"}</option></select></label>
            <label className="space-y-1.5"><span className="text-xs font-black text-white/50">{isArabic ? "عدد الطلبيات" : "Order count"}</span><input value={orderCount} onChange={(e) => setOrderCount(e.target.value)} className="dn-input" type="number" min="1" step="1" dir="ltr" /></label>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-gold/25 bg-brand-deep/75 p-5 text-center">
            <p className="text-xs font-black text-white/50">{isArabic ? "الإجمالي المحلي النهائي" : "Final local total"}</p>
            <p className="mt-2 text-4xl font-black text-brand-gold" dir="ltr">{totalPrice.toFixed(2)} AED</p>
            <p className="mt-2 text-xs font-bold text-white/45" dir={isArabic ? "rtl" : "ltr"}>{isArabic ? `${normalizedOrderCount} طلبية × ${unitPrice} درهم` : `${normalizedOrderCount} order(s) × ${unitPrice} AED`}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {examples.map((item) => <div key={item.count} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-center"><p className="text-xs font-bold text-white/55">{isArabic ? `${item.count} طلبية` : `${item.count} order(s)`}</p><p className="mt-1 font-mono text-lg font-black text-brand-gold">{item.total} AED</p></div>)}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/request" className="dn-btn dn-btn-primary dn-btn-md flex-1"><Truck className="h-4 w-4" />{isArabic ? "اطلب توصيل" : "Request delivery"}</Link>
            <a href={companyMeta.whatsappUrl} target="_blank" rel="noopener noreferrer" className="dn-btn dn-btn-whatsapp dn-btn-md flex-1"><MessageSquare className="h-4 w-4" />WhatsApp</a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-brand-cool/30 p-5">
            <PackageCheck className="h-8 w-8 text-brand-gold" />
            <p className="mt-4 text-3xl font-black text-brand-gold" dir="ltr">30 AED</p>
            <h3 className="mt-2 font-black text-white">{isArabic ? "المناطق الرئيسية" : "Main areas"}</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "للطلبية الواحدة داخل المدن الرئيسية." : "Per order inside main UAE cities."}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-brand-cool/30 p-5">
            <MapPin className="h-8 w-8 text-brand-sky" />
            <p className="mt-4 text-3xl font-black text-brand-gold" dir="ltr">50 AED</p>
            <h3 className="mt-2 font-black text-white">{isArabic ? "المناطق الممتدة" : "Extended areas"}</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "للطلبية الواحدة في العين والظفرة والمناطق الخاصة." : "Per order for Al Ain, Al Dhafra, and special areas."}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-brand-cool/30 p-5">
            <CheckCircle className="h-8 w-8 text-emerald-300" />
            <p className="mt-4 text-3xl font-black text-brand-gold" dir="ltr">NO KG</p>
            <h3 className="mt-2 font-black text-white">{isArabic ? "لا كيلو محلي" : "No local kg"}</h3>
            <p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "الكيلو والزيادة بالكيلو للشحن الدولي فقط." : "Kilograms and extra-kg pricing are international only."}</p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 justify-end">
          <span>{isArabic ? "المدن والمناطق الرئيسية — 30 درهم للطلبية" : "Main cities and areas — 30 AED per order"}</span>
          <CheckCircle className="w-5 h-5 text-brand-gold" />
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {mainCities.map((city, idx) => (
            <div id={`main_city_${idx}`} key={idx} className="bg-brand-cool/30 p-5 rounded-xl border border-white/10 flex flex-col justify-between hover:border-brand-gold/50 hover:shadow-lg transition-all">
              <div className="space-y-1">
                <p className="text-white/40 text-xs font-mono font-bold tracking-wider">{city.name}</p>
                <h4 className="text-xl font-extrabold text-white">{isArabic ? city.ar : city.name}</h4>
              </div>
              <p className="text-brand-gold font-extrabold text-sm mt-3 pt-3 border-t border-white/5">30 AED <span className="text-[10px] text-white/50 block font-normal">{isArabic ? "لكل طلبية" : "per order"}</span></p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-cool/40 p-6 sm:p-10 rounded-3xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input id="region_search_input" type="text" placeholder={isArabic ? "ابحث عن العين أو الظفرة أو المنطقة البعيدة..." : "Search Al Ain, Al Dhafra, or extended area..."} value={searchQuery} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-brand-deep text-right border border-white/10 rounded-xl px-4 py-2.5 pl-9 text-white text-sm focus:outline-none focus:border-brand-gold/50" />
          </div>
          <div className="space-y-1 text-right">
            <h3 className="text-lg font-bold text-white">{isArabic ? "المناطق الممتدة وتوصيلات الطواقم الخاصة — 50 درهم للطلبية" : "Extended and special operations areas — 50 AED per order"}</h3>
            <p className="text-white/50 text-xs">{isArabic ? "ابحث عن منطقتك للتحقق من التغطية المناسبة في العين والمنطقة الغربية/الظفرة." : "Search your area to confirm coverage in Al Ain and Western/Al Dhafra areas."}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-4 text-right">
            <h4 className="text-white font-bold border-r-4 border-brand-gold pr-3 text-base flex justify-between items-center"><span className="text-xs bg-brand-deep px-2 py-0.5 rounded-sm font-mono font-bold text-brand-gold border border-white/5">50 AED</span><span>{isArabic ? "مناطق وضواحي العين" : "Al Ain suburbs"}</span></h4>
            <div className="bg-brand-deep/50 rounded-xl border border-white/10 p-4 max-h-60 overflow-y-auto space-y-2.5">
              {filteredAlAin.length > 0 ? filteredAlAin.map((r, i) => <div id={`al_ain_r_${i}`} key={i} className="text-sm text-white/85 font-sans flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0"><span className="text-white/30 font-mono text-xs">#{i+1}</span><div className="flex items-center gap-2"><span>{r}</span><MapPin className="w-3.5 h-3.5 text-white/30" /></div></div>) : <p className="text-white/40 text-xs text-center py-4">{isArabic ? "لا توجد نتائج مطابقة لمنطقة العين" : "No matching Al Ain results"}</p>}
            </div>
          </div>

          <div className="space-y-4 text-right">
            <h4 className="text-white font-bold border-r-4 border-brand-gold pr-3 text-base flex justify-between items-center"><span className="text-xs bg-brand-deep px-2 py-0.5 rounded-sm font-mono font-bold text-brand-gold border border-white/5">50 AED</span><span>{isArabic ? "مناطق المنطقة الغربية والظفرة" : "Western / Al Dhafra areas"}</span></h4>
            <div className="bg-brand-deep/50 rounded-xl border border-white/10 p-4 max-h-60 overflow-y-auto space-y-2.5">
              {filteredWestern.length > 0 ? filteredWestern.map((r, i) => <div id={`west_r_${i}`} key={i} className="text-sm text-white/85 font-sans flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0"><span className="text-white/30 font-mono text-xs">#{i+1}</span><div className="flex items-center gap-2"><span>{r}</span><MapPin className="w-3.5 h-3.5 text-white/30" /></div></div>) : <p className="text-white/40 text-xs text-center py-4">{isArabic ? "لا توجد نتائج مطابقة للمنطقة الغربية" : "No matching western area results"}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-cool/30 border border-white/10 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
        <a href="https://wa.me/971568757331" target="_blank" referrerPolicy="no-referrer" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all text-center cursor-pointer shrink-0">{isArabic ? "تحقق سريع عبر واتساب" : "Quick WhatsApp check"}</a>
        <div className="flex items-center gap-4 text-right">
          <div>
            <h4 className="font-bold text-white text-lg font-sans">{isArabic ? "لم تجد منطقتك ضمن قوائم المدن؟" : "Can’t find your area?"}</h4>
            <p className="text-white/60 text-sm mt-0.5">{isArabic ? "تواصل فوراً مع داي نايت عبر الهاتف أو واتساب للتحقق ومساعدتك مباشرة." : "Contact DAY NIGHT by phone or WhatsApp for immediate coverage confirmation."}</p>
          </div>
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center shrink-0 border border-white/10"><BadgeCheck className="w-6 h-6 text-brand-gold" /></div>
        </div>
      </section>
    </div>
  );
}
