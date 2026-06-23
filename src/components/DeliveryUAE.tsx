/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Search, MapPin, BadgeCheck, CheckCircle } from "lucide-react";

export default function DeliveryUAE() {
  const [searchQuery, setSearchTerm] = useState("");

  const mainCities = [
    { name: "Abu Dhabi", ar: "أبوظبي", price: 30 },
    { name: "Dubai", ar: "دبي", price: 30 },
    { name: "Sharjah", ar: "الشارقة", price: 30 },
    { name: "Ajman", ar: "عجمان", price: 30 },
    { name: "Umm Al Quwain", ar: "أم القيوين", price: 30 },
    { name: "Ras Al Khaimah", ar: "رأس الخيمة", price: 30 },
    { name: "Fujairah", ar: "الفجيرة", price: 30 },
    { name: "Khorfakkan", ar: "خورفكان", price: 30 }
  ];

  const alAinRegions = [
    "Al Ain - Abu Samra (العين - أبو سمرة)", "Al Ain - Al Khatm (العين - الختم)", "Al Ain - Al Khazna (العين - الخزنة)", "Al Ain - Al Saad (العين - السد)",
    "Al Ain - Al Thahira (العين - الظاهرة/الزينة)", "Al Ain - Al Arrad (العين - العراد/مزيد)", "Al Ain - Al Quaa (العين - القوع)", "Al Ain - Al Waqan (العين - الهير)",
    "Al Ain - Bu Kariya (العين - بوكرية)", "Al Ain - Rmah (العين - رماح)", "Al Ain - Swihan (العين - سويحان)", "Al Ain - Seeh Allahma (العين - سيح اللحمة)",
    "Al Ain - Seeh Sabra (العين - سماح)", "Al Ain - Trucks Road (العين - طريق الشاحنات)", "Al Ain - Nahil (العين - ناهل)"
  ];

  const westernRegions = [
    "Western Region - Al Ruwais (الغربية - الرويس - 30 AED)", "Western Region - Sila (الغربية - السلع)", "Western Region - Shuweihat (الغربية - الشويهات)",
    "Western Region - Al Dhanna (الغربية - الظنة)", "Western Region - Al Marfaa (الغربية - المرفأ)", "Western Region - Madinat Zayed (الغربية - بدع زايد)",
    "Western Region - Bada' Mutawa (الغربية - بدع مطاوعة)", "Western Region - Baynouna (الغربية - بينونة)", "Western Region - Habshan (الغربية - حبشان)",
    "Western Region - Hamim (الغربية - حميم)", "Western Region - Assab (الغربية - عصب)", "Western Region - Ghayathi (الغربية - غياثي)",
    "Western Region - Liwa (الغربية - ليوا)"
  ];

  const filteredAlAin = alAinRegions.filter(region =>
    region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWestern = westernRegions.filter(region =>
    region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 text-right">
      {/* Page Header */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <span className="bg-brand-blue/15 border border-brand-blue/35 text-brand-blue text-xs px-3.5 py-1 rounded-full font-bold uppercase font-mono tracking-widest inline-block">
          Local Dispatching • التوصيل المحلى الشامل
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          تغطية شاملة لكافة إمارات الدولة بأسعار واضحة
        </h2>
        <p className="text-white/60 text-sm">
          نغطي المدن والبلديات الرئيسية بـ 30 درهم فقط، وهناك خدمات مخصصة للمناطق الممتدة في العين والمنطقة الغربية بـ 50 درهم، لضمان أعلى مستويات الالتزام والتغطية.
        </p>
      </section>

      {/* Main Cities List */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 justify-end">
          <span>المدن والمناطق الرئيسية (السعر النهائي: 30 درهم)</span>
          <CheckCircle className="w-5 h-5 text-brand-gold" />
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {mainCities.map((city, idx) => (
            <div id={`main_city_${idx}`} key={idx} className="bg-brand-cool/30 p-5 rounded-xl border border-white/10 flex flex-col justify-between hover:border-brand-gold/50 hover:shadow-lg transition-all">
              <div className="space-y-1">
                <p className="text-white/40 text-xs font-mono font-bold tracking-wider">{city.name}</p>
                <h4 className="text-xl font-extrabold text-white">{city.ar}</h4>
              </div>
              <p className="text-brand-gold font-extrabold text-sm mt-3 pt-3 border-t border-white/5">30 AED <span className="text-[10px] text-white/50 block font-normal">سعر نهائي</span></p>
            </div>
          ))}
        </div>
      </section>

      {/* Specialized Regions Search */}
      <section className="bg-brand-cool/40 p-6 sm:p-10 rounded-3xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="region_search_input"
              type="text"
              placeholder="ابحث عن المحور أو المدينة البعيدة..."
              value={searchQuery}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-brand-deep text-right border border-white/10 rounded-xl px-4 py-2.5 pl-9 text-white text-sm focus:outline-none focus:border-brand-gold/50"
            />
          </div>

          <div className="space-y-1 text-right">
            <h3 className="text-lg font-bold text-white">المناطق الممتدة وتوصيلات الطواقم الخاصة (50 درهم نهائي)</h3>
            <p className="text-white/50 text-xs">ابحث عن منطقتك للتحقق من التغطية المناسبة في العين والمنطقة الغربية.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {/* Al Ain Suburbs */}
          <div className="space-y-4 text-right">
            <h4 className="text-white font-bold border-r-4 border-brand-gold pr-3 text-base flex justify-between items-center">
              <span className="text-xs bg-brand-deep px-2 py-0.5 rounded-sm font-mono font-bold text-brand-gold border border-white/5">50 AED</span>
              <span>مناطق وضواحي منطقة العين</span>
            </h4>
            
            <div className="bg-brand-deep/50 rounded-xl border border-white/10 p-4 max-h-60 overflow-y-auto space-y-2.5">
              {filteredAlAin.length > 0 ? (
                filteredAlAin.map((r, i) => (
                  <div id={`al_ain_r_${i}`} key={i} className="text-sm text-white/85 font-sans flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-white/30 font-mono text-xs">#{i+1}</span>
                    <div className="flex items-center gap-2">
                      <span>{r}</span>
                      <MapPin className="w-3.5 h-3.5 text-white/30" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-xs text-center py-4">لا توجد نتائج مطابقة لمنطقة العين</p>
              )}
            </div>
          </div>

          {/* Western Suburbs */}
          <div className="space-y-4 text-right">
            <h4 className="text-white font-bold border-r-4 border-brand-gold pr-3 text-base flex justify-between items-center">
              <span className="text-xs bg-brand-deep px-2 py-0.5 rounded-sm font-mono font-bold text-brand-gold border border-white/5">50 AED</span>
              <span>مناطق المنطقة الغربية والظفرة</span>
            </h4>
            
            <div className="bg-brand-deep/50 rounded-xl border border-white/10 p-4 max-h-60 overflow-y-auto space-y-2.5">
              {filteredWestern.length > 0 ? (
                filteredWestern.map((r, i) => (
                  <div id={`west_r_${i}`} key={i} className="text-sm text-white/85 font-sans flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-white/30 font-mono text-xs">#{i+1}</span>
                    <div className="flex items-center gap-2">
                      <span>{r}</span>
                      <MapPin className="w-3.5 h-3.5 text-white/30" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-white/40 text-xs text-center py-4">لا توجد نتائج مطابقة للمنطقة الغربية</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Slogan Info */}
      <section className="bg-brand-cool/30 border border-white/10 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
        <a 
          href="https://wa.me/971568757331" 
          target="_blank" 
          referrerPolicy="no-referrer"
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all text-center cursor-pointer shrink-0"
        >
          تحقق سريع عبر واتساب
        </a>

        <div className="flex items-center gap-4 text-right">
          <div>
            <h4 className="font-bold text-white text-lg font-sans">لم تجد منطقتك ضمن قوائم المدن؟</h4>
            <p className="text-white/60 text-sm mt-0.5">يمكنك التواصل الفوري مع داي نايت عبر الهاتف أو الواتساب للتحقق ومساعدتك فوراً.</p>
          </div>
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center shrink-0 border border-white/10">
            <BadgeCheck className="w-6 h-6 text-brand-gold" />
          </div>
        </div>
      </section>
    </div>
  );
}
