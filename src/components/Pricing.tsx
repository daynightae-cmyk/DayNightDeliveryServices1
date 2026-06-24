/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Calculator, BadgePercent, ChevronRight, Check } from "lucide-react";

export default function Pricing() {
  const [calcTab, setCalcTab] = useState<"local" | "intl">("local");
  const [localZone, setLocalZone] = useState<"main" | "suburbs">("main");
  const [intlCountry, setIntlCountry] = useState<"gcc" | "global">("gcc");
  const [calcWeight, setWeight] = useState(1);

  const mainCities = ["أبوظبي", "دبي", "الشارقة", "عجمان", "أم القيوين", "رأس الخيمة", "الفجيرة", "خورفكان"];
  const farZones = ["ضواحي العين (Al Ain Suburbs)", "منطقة الظفرة والمنطقة الغربية (Western Region)"];

  function getLocalPrice() {
    const subtotal = localZone === "main" ? 30 : 50;
    const vat = parseFloat((subtotal * 0.05).toFixed(2));
    const total = parseFloat((subtotal + vat).toFixed(2));
    return { subtotal, vat, total };
  }

  function getIntlPrice() {
    const isGcc = intlCountry === "gcc";
    const firstKg = isGcc ? 95 : 190;
    const addKg = isGcc ? 45 : 90;
    const subtotal = firstKg + (Math.max(1, calcWeight) - 1) * addKg;
    const vat = parseFloat((subtotal * 0.05).toFixed(2));
    const total = parseFloat((subtotal + vat).toFixed(2));
    return { subtotal, vat, total };
  }

  return (
    <div className="space-y-12 text-right">
      {/* Page Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Pricing Blueprint • الأسعار والتعرفة الرسمية
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          تعرفة واضحة ومدروسة بدون رسوم خفية
        </h2>
        <p className="text-white/60 text-sm">
          نحن ملتزمون بالشفافية المطلقة. نعرض أسعارنا الأساسية بكل وضوح للأفراد والشركات في الإمارات ودولياً مع حاسبة ذكية تقديرية.
        </p>
      </section>

      {/* Main Pricing Tables */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Main UAE Cities Card */}
        <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 hover:border-brand-gold/50 hover:shadow-xl transition-all flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">المدن والمحافظات الرئيسية</h3>
              <p className="text-xs text-white/40 uppercase font-mono tracking-wide">Main Emirates Cities</p>
            </div>
            
            <div className="text-center bg-brand-deep p-4 rounded-xl border border-white/5">
              <p className="text-xs text-white/40 font-sans">السعر الأساسي الموحد</p>
              <p className="text-3xl font-extrabold text-brand-gold font-mono mt-1">30 AED</p>
            </div>

            <p className="text-xs text-white/45 leading-relaxed font-bold">تشمل المدن التالية:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
              {mainCities.map((c, i) => (
                <div key={i} className="flex items-center gap-1 justify-end text-right">
                  <span>{c}</span>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-[11px] text-white/40 italic bg-brand-deep/80 p-3 rounded-lg border border-white/5">
            * السعر موحد ومباشر للطرود الصغيرة والمستندات بوزن عادي.
          </div>
        </div>

        {/* Far UAE Suburbs Card */}
        <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 hover:border-brand-gold/50 hover:shadow-xl transition-all flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">المناطق البعيدة والضواحي</h3>
              <p className="text-xs text-white/40 uppercase font-mono tracking-wide">Al Ain & Western region Outskirts</p>
            </div>
            
            <div className="text-center bg-brand-deep p-4 rounded-xl border border-white/5">
              <p className="text-xs text-white/40">سعر التوصيل للمناطق البعيدة</p>
              <p className="text-3xl font-extrabold text-brand-gold font-mono mt-1">50 AED</p>
            </div>

            <p className="text-xs text-white/45 leading-relaxed font-bold">المحاور المعتمدة:</p>
            <div className="space-y-2 text-xs text-white/80">
              {farZones.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 justify-end text-right">
                  <span>{c}</span>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-white/40 italic bg-brand-deep/80 p-3 rounded-lg border border-white/5">
            * تشمل كافة ضواحي العين المذكورة والظفرة ومصفح البعيد والسلع وغياثي وحميم ليوا. (الرويس سعر مخفض 30 درهم).
          </div>
        </div>

        {/* International Rates Card */}
        <div className="bg-brand-cool/30 rounded-3xl p-6 border border-white/10 hover:border-brand-gold/50 hover:shadow-xl transition-all flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">الشحن الخارجي والدولي</h3>
              <p className="text-xs text-white/40 uppercase font-mono tracking-wide">Middle East & Global Shipping</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-brand-deep p-3 rounded-xl border border-white/5">
                <p className="text-white/40 font-sans uppercase">دول الخليج GCC</p>
                <p className="text-sm font-bold text-white font-sans mt-1">أول كجم: 95 AED</p>
                <p className="text-[10px] text-brand-gold font-medium">إضافي: 45 AED</p>
              </div>
              <div className="bg-brand-deep p-3 rounded-xl border border-white/5">
                <p className="text-white/40 font-sans uppercase">عالمي Global</p>
                <p className="text-sm font-bold text-white font-sans mt-1">أول كجم: 190 AED</p>
                <p className="text-[10px] text-brand-gold font-medium">إضافي: 90 AED</p>
              </div>
            </div>

            <p className="text-white/70 text-sm leading-relaxed">
              نوصل للسعودية، قطر، الكويت، عمان، البحرين، بالإضافة إلى دول الاتحاد الأوروبي، الولايات المتحدة وكندا وغيرها.
            </p>
          </div>

          <div className="p-3 bg-brand-gold/10 text-[11px] text-brand-gold rounded-xl border border-brand-gold/20 leading-relaxed font-sans font-bold">
            يرجى تعبئة الوزن والبيانات عبر الحاسبة أدناه للحصول على تفاصيل تكلفة التسليم فورياً.
          </div>
        </div>
      </section>

      {/* Embedded Live Interactive Calculator */}
      <section className="bg-brand-cool/40 text-white rounded-3xl p-8 border border-white/10 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-blue/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex bg-brand-deep border border-white/10 rounded-xl p-1 shrink-0 self-start sm:self-auto font-sans">
            <button
              id="calc_tab_local"
              onClick={() => { setCalcTab("local"); setWeight(1); }}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${calcTab === "local" ? "bg-brand-gold text-brand-deep" : "text-white/40 hover:text-white"}`}
            >
              شحن محلي داخل الدولة
            </button>
            <button
              id="calc_tab_intl"
              onClick={() => { setCalcTab("intl"); setWeight(1); }}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${calcTab === "intl" ? "bg-brand-gold text-brand-deep" : "text-white/40 hover:text-white"}`}
            >
              شحن دولي خارجي
            </button>
          </div>

          <div className="space-y-1 text-right">
            <h3 className="text-xl font-bold flex items-center gap-2 justify-end">
              <span>الحاسبة المالية لأسعار النقل والشحن</span>
              <Calculator className="w-5 h-5 text-brand-gold" />
            </h3>
            <p className="text-white/40 text-xs text-right">اختر نوع الخدمة وقدر السعر والآلية الإجمالية فورياً دون عناء.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-12 lg:lg-col-span-7 lg:col-span-7 space-y-6">
            {calcTab === "local" ? (
              <div className="space-y-4">
                <p className="text-white/80 text-xs font-bold">اختر نوع الوجهة المحلية للطلب:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    id="local_zone_select_main"
                    onClick={() => setLocalZone("main")}
                    className={`p-4 rounded-xl border cursor-pointer text-right transition-all bg-brand-deep/30 hover:bg-brand-deep/60 ${localZone === "main" ? "bg-brand-deep border-brand-gold/80 shadow-md" : "border-white/10"}`}
                  >
                    <h5 className="font-bold text-white text-sm">المدن والمحافظات الرئيسية</h5>
                    <p className="text-white/40 text-[11px] mt-1 leading-normal font-sans">أبوظبي، دبي، الشارقة، عجمان وغيرها من المحاور الموحدة.</p>
                  </div>
                  <div
                    id="local_zone_select_suburbs"
                    onClick={() => setLocalZone("suburbs")}
                    className={`p-4 rounded-xl border cursor-pointer text-right transition-all bg-brand-deep/30 hover:bg-brand-deep/60 ${localZone === "suburbs" ? "bg-brand-deep border-brand-gold/80 shadow-md" : "border-white/10"}`}
                  >
                    <h5 className="font-bold text-white text-sm">ضواحي العين والمنطقة الغربية</h5>
                    <p className="text-white/40 text-[11px] mt-1 leading-normal">مدينة زايد، الرويس، السلع، غياثي والمناطق البعيدة التابعة.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/80 text-xs font-bold">حدد نطاق وجهة الشحن الدولي:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    id="intl_zone_gcc"
                    onClick={() => setIntlCountry("gcc")}
                    className={`p-4 rounded-xl border cursor-pointer text-right transition-all bg-brand-deep/30 hover:bg-brand-deep/60 ${intlCountry === "gcc" ? "bg-brand-deep border-brand-gold/80 shadow-md" : "border-white/10"}`}
                  >
                    <h5 className="font-bold text-white text-sm">دول مجلس التعاون الخليجي</h5>
                    <p className="text-white/40 text-[11px] mt-1 leading-normal">السعودية، قطر، الكويت، عمان، البحرين بأسعار خليجية مخفضة.</p>
                  </div>
                  <div
                    id="intl_zone_global"
                    onClick={() => setIntlCountry("global")}
                    className={`p-4 rounded-xl border cursor-pointer text-right transition-all bg-brand-deep/30 hover:bg-brand-deep/60 ${intlCountry === "global" ? "bg-brand-deep border-brand-gold/80 shadow-md" : "border-white/10"}`}
                  >
                    <h5 className="font-bold text-white text-sm">دول الاتحاد الأوروبي، كندا وأمريكا</h5>
                    <p className="text-white/40 text-[11px] mt-1 leading-normal font-sans">وجهات عالمية رئيسية بوزن فوري وجودة توصيل فائقة.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-white/80 text-xs font-bold flex justify-between font-sans leading-relaxed">
                    <span className="text-brand-gold font-mono font-bold">{calcWeight} كجم</span>
                    <span>الوزن التقريبي للشحنة (كيلو جرام)</span>
                  </label>
                  <input
                    id="main_weight_slider"
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={calcWeight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full h-2 bg-brand-deep rounded-lg appearance-none cursor-pointer accent-brand-gold border border-white/10"
                  />
                  <div className="flex justify-between text-[11px] text-white/30 font-mono">
                    <span>50 كجم</span>
                    <span>25 كجم</span>
                    <span>10 كجم</span>
                    <span>1 كجم</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-brand-deep border border-white/10 p-6 rounded-2xl flex flex-col justify-between text-center lg:text-right space-y-4">
            <div className="space-y-3 text-right">
              <span className="text-white/40 text-xs font-bold tracking-wider font-sans">بيان القيمة التقديرية</span>
              <div className="space-y-1.5 border-t border-b border-white/5 py-3">
                <div className="flex justify-between items-center text-xs text-white/50">
                  <span className="font-mono">{(calcTab === "local" ? getLocalPrice().subtotal : getIntlPrice().subtotal).toFixed(2)} AED</span>
                  <span>السعر الأساسي:</span>
                </div>
                <div className="flex justify-between items-center text-xs text-white/50">
                  <span className="font-mono">{(calcTab === "local" ? getLocalPrice().vat : getIntlPrice().vat).toFixed(2)} AED</span>
                  <span>ضريبة القيمة المضافة (5%):</span>
                </div>
              </div>
              <div>
                <span className="text-white/40 text-xs font-bold tracking-wider font-sans block mb-1">المبلغ الإجمالي شامل الضريبة</span>
                <div id="calculator_result_text" className="text-3xl sm:text-4xl font-extrabold text-brand-gold font-mono">
                  {(calcTab === "local" ? getLocalPrice().total : getIntlPrice().total).toFixed(2)} AED
                </div>
              </div>
              <p className="text-[11px] text-white/40 italic leading-relaxed text-right mt-1">
                {calcTab === "local" 
                  ? "* السعر نهائي وموحد للتوصيل العادي." 
                  : `* يشمل أول كيلو بـ ${intlCountry === "gcc" ? "95" : "190"} درهم، وكل كيلوجرام إضافي بـ ${intlCountry === "gcc" ? "45" : "90"} درهم.`}
              </p>
            </div>

            <div className="bg-brand-deep/50 p-3.5 rounded-xl border border-white/5 text-[11px] text-white/50 text-right leading-relaxed font-sans">
              يتم تأكيد البيانات النهائية، الحجم الفعلي والوزن من فريق التشغيل قبل الاستلام وإصدار الفواتير للتوصيل.
            </div>

            <div className="space-y-2">
              <a
                id="calculate_inquiry_wa"
                href="https://wa.me/971568757331"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-block py-3.5 bg-brand-gold hover:bg-brand-blue text-brand-deep hover:text-white font-extrabold rounded-xl text-xs hover:scale-103 transition-transform text-center cursor-pointer shadow-lg shadow-brand-gold/10"
              >
                تأكيد السعر المباشر والطلب الآن
              </a>
              <a
                id="pricing_whatsapp_catalog"
                href="https://wa.me/c/971568757331"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-block py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs hover:scale-103 transition-transform text-center cursor-pointer shadow-md"
              >
                عرض كتالوج واتساب / View WhatsApp Catalog
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Official Visual Guideline Sheets */}
      <section className="bg-brand-cool/30 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
        <div className="text-center sm:text-right space-y-2">
          <h3 className="text-xl font-bold text-white">بطاقات وجداول التسعير الرسمية</h3>
          <p className="text-xs text-white/55">تعرفة الشحن المحلي والدولي الموثقة والمعتمدة لعملاء داي نايت</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-brand-deep/50 p-4 rounded-2xl border border-white/5 space-y-3">
            <h4 className="text-sm font-bold text-brand-gold text-right border-r-2 border-brand-gold pr-2">جدول الأسعار المحلي</h4>
            <div className="overflow-hidden rounded-xl border border-white/10 aspect-video bg-black/40 flex items-center justify-center">
              <img 
                src="https://i.postimg.cc/Gtk2Hp2n/Chat-GPT-Image-Jun-12-2026-02-57-02-PM.png" 
                alt="Local Price Guideline Table"
                className="w-full h-full object-contain hover:scale-110 transition-transform duration-300" 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="bg-brand-deep/50 p-4 rounded-2xl border border-white/5 space-y-3">
            <h4 className="text-sm font-bold text-brand-gold text-right border-r-2 border-brand-gold pr-2">جدول الشحن الدولي</h4>
            <div className="overflow-hidden rounded-xl border border-white/10 aspect-video bg-black/40 flex items-center justify-center">
              <img 
                src="https://i.postimg.cc/qqdBVdL7/Chat-GPT-Image-Jun-12-2026-03-35-51-PM.png" 
                alt="International Price Guideline Table"
                className="w-full h-full object-contain hover:scale-110 transition-transform duration-300" 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
