import { useMemo, useState } from "react";
import { MapPin, Navigation, Route, Truck } from "lucide-react";
import { coverageAreas } from "../../data/coverage";
import { useAppContext } from "../../lib/AppContext";

type MapPoint = {
  id: string;
  nameEn: string;
  nameAr: string;
  emirate: string;
  zoneType: "main" | "extended";
  x: number;
  y: number;
};

const featuredPoints: MapPoint[] = [
  { id: "abu-dhabi", nameEn: "Abu Dhabi", nameAr: "أبوظبي", emirate: "Abu Dhabi", zoneType: "main", x: 36, y: 66 },
  { id: "mussafah", nameEn: "Mussafah", nameAr: "مصفح", emirate: "Abu Dhabi", zoneType: "main", x: 40, y: 70 },
  { id: "al-ain", nameEn: "Al Ain", nameAr: "العين", emirate: "Abu Dhabi", zoneType: "extended", x: 67, y: 78 },
  { id: "al-dhafra", nameEn: "Al Dhafra", nameAr: "الظفرة", emirate: "Abu Dhabi", zoneType: "extended", x: 18, y: 78 },
  { id: "dubai", nameEn: "Dubai", nameAr: "دبي", emirate: "Dubai", zoneType: "main", x: 61, y: 43 },
  { id: "sharjah", nameEn: "Sharjah", nameAr: "الشارقة", emirate: "Sharjah", zoneType: "main", x: 66, y: 37 },
  { id: "ajman", nameEn: "Ajman", nameAr: "عجمان", emirate: "Ajman", zoneType: "main", x: 69, y: 33 },
  { id: "rak", nameEn: "Ras Al Khaimah", nameAr: "رأس الخيمة", emirate: "Ras Al Khaimah", zoneType: "main", x: 73, y: 18 },
  { id: "fujairah", nameEn: "Fujairah", nameAr: "الفجيرة", emirate: "Fujairah", zoneType: "main", x: 84, y: 35 }
];

export default function UAEInteractiveMap() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [selectedId, setSelectedId] = useState("abu-dhabi");

  const selectedPoint = featuredPoints.find((point) => point.id === selectedId) || featuredPoints[0];
  const coveredAreas = useMemo(() => coverageAreas.filter((area) => area.active).length, []);

  return (
    <section className="glass-premium rounded-[28px] p-5 sm:p-7 border border-white/10 overflow-hidden relative" dir={isArabic ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(24,168,232,0.16),transparent_38%),radial-gradient(circle_at_75%_70%,rgba(212,175,55,0.14),transparent_42%)] pointer-events-none" />
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-stretch">
        <div className="relative min-h-[360px] rounded-3xl border border-white/10 bg-brand-deep/65 overflow-hidden shadow-2xl">
          <div className="absolute inset-6 rounded-[38%_62%_48%_52%/42%_40%_60%_58%] bg-gradient-to-br from-brand-blue/30 via-brand-cool/70 to-brand-gold/15 border border-brand-gold/20 shadow-[0_0_70px_rgba(24,168,232,0.2)] rotate-[-10deg]" />
          <div className="absolute inset-10 rounded-[44%_56%_50%_50%/54%_45%_55%_46%] border border-white/10 rotate-[-10deg]" />
          <div className="absolute left-[30%] top-[66%] right-[30%] h-px bg-brand-gold/50 shadow-[0_0_18px_rgba(212,175,55,0.7)] rotate-[-9deg]" />
          <div className="absolute left-[58%] top-[44%] right-[18%] h-px bg-sky-300/45 shadow-[0_0_18px_rgba(24,168,232,0.7)] rotate-[-23deg]" />

          {featuredPoints.map((point) => {
            const isSelected = point.id === selectedPoint.id;
            return (
              <button
                key={point.id}
                type="button"
                onClick={() => setSelectedId(point.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none ${isSelected ? "z-20" : "z-10"}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-label={isArabic ? point.nameAr : point.nameEn}
              >
                <span className={`absolute inset-0 -m-3 rounded-full ${point.zoneType === "extended" ? "bg-brand-gold/20" : "bg-sky-400/20"} animate-ping`} />
                <span className={`relative flex w-9 h-9 items-center justify-center rounded-full border ${isSelected ? "border-brand-gold bg-brand-gold text-brand-deep" : "border-white/25 bg-brand-cool/85 text-brand-gold"} shadow-lg transition-all group-hover:scale-110`}>
                  <MapPin className="w-4 h-4" />
                </span>
                <span className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-brand-deep/90 px-2 py-1 text-[10px] font-bold text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isArabic ? point.nameAr : point.nameEn}
                </span>
              </button>
            );
          })}
        </div>

        <div className="glass rounded-3xl p-5 border border-white/10 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-xs font-bold text-brand-gold">
              <Navigation className="w-4 h-4" />
              <span>{isArabic ? "خريطة التغطية التفاعلية" : "Interactive Coverage Map"}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {isArabic ? "نقاط تشغيل نشطة عبر الإمارات" : "Active Dispatch Points Across The UAE"}
            </h2>
            <p className="text-white/65 text-sm leading-relaxed">
              {isArabic
                ? "اضغط على أي مدينة لمعرفة نوع التغطية والسعر النهائي المرتبط بها. الخريطة تعرض المسارات الأساسية من أبوظبي ومصفح نحو باقي الإمارات."
                : "Select a city to view coverage type and final delivery price. The map highlights core routes from Abu Dhabi and Mussafah across the Emirates."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-brand-deep/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Truck className="w-8 h-8 text-brand-gold" />
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-white/45 text-xs font-bold uppercase">{selectedPoint.emirate}</p>
                <h3 className="text-xl font-extrabold text-white">{isArabic ? selectedPoint.nameAr : selectedPoint.nameEn}</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-white/45">{isArabic ? "نوع المنطقة" : "Zone type"}</p>
                <p className="text-brand-gold font-black">{selectedPoint.zoneType === "extended" ? (isArabic ? "ممتدة" : "Extended") : (isArabic ? "رئيسية" : "Main")}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-white/45">{isArabic ? "السعر النهائي" : "Final price"}</p>
                <p className="text-brand-gold font-black" dir="ltr">{selectedPoint.zoneType === "extended" ? "50 AED" : "30 AED"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-3xl font-black text-brand-gold font-mono">{coveredAreas}</p>
              <p className="text-xs text-white/55">{isArabic ? "منطقة تغطية" : "Coverage areas"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Route className="w-7 h-7 text-brand-gold mb-2" />
              <p className="text-xs text-white/55">{isArabic ? "مسارات يومية نشطة" : "Active daily routes"}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
