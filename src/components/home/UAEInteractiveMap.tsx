import { useMemo, useState } from "react";
import { MapPin, Navigation, Route, Truck, Globe2 } from "lucide-react";
import { coverageAreas } from "../../data/coverage";
import { useAppContext } from "../../lib/AppContext";

type MapPoint = {
  id: string;
  nameEn: string;
  nameAr: string;
  emirate: string;
  zoneType: "main" | "extended";
  cx: number;
  cy: number;
};

const mapPoints: MapPoint[] = [
  { id: "abu-dhabi", nameEn: "Abu Dhabi", nameAr: "أبوظبي", emirate: "Abu Dhabi", zoneType: "main", cx: 118, cy: 198 },
  { id: "mussafah", nameEn: "Mussafah", nameAr: "مصفح", emirate: "Abu Dhabi", zoneType: "main", cx: 108, cy: 210 },
  { id: "al-dhafra", nameEn: "Al Dhafra / Western Region", nameAr: "الظفرة / المنطقة الغربية", emirate: "Abu Dhabi", zoneType: "extended", cx: 48, cy: 228 },
  { id: "al-ruwais", nameEn: "Al Ruwais", nameAr: "الرويس", emirate: "Abu Dhabi", zoneType: "main", cx: 28, cy: 218 },
  { id: "al-ain", nameEn: "Al Ain", nameAr: "العين", emirate: "Abu Dhabi", zoneType: "extended", cx: 188, cy: 228 },
  { id: "dubai", nameEn: "Dubai", nameAr: "دبي", emirate: "Dubai", zoneType: "main", cx: 168, cy: 118 },
  { id: "sharjah", nameEn: "Sharjah", nameAr: "الشارقة", emirate: "Sharjah", zoneType: "main", cx: 178, cy: 98 },
  { id: "ajman", nameEn: "Ajman", nameAr: "عجمان", emirate: "Ajman", zoneType: "main", cx: 186, cy: 82 },
  { id: "uaq", nameEn: "Umm Al Quwain", nameAr: "أم القيوين", emirate: "Umm Al Quwain", zoneType: "main", cx: 192, cy: 68 },
  { id: "rak", nameEn: "Ras Al Khaimah", nameAr: "رأس الخيمة", emirate: "Ras Al Khaimah", zoneType: "main", cx: 200, cy: 48 },
  { id: "fujairah", nameEn: "Fujairah", nameAr: "الفجيرة", emirate: "Fujairah", zoneType: "main", cx: 228, cy: 108 },
  { id: "khorfakkan", nameEn: "Khorfakkan", nameAr: "خورفكان", emirate: "Sharjah", zoneType: "extended", cx: 238, cy: 92 }
];

const UAE_OUTLINE =
  "M 24 228 L 38 210 L 52 218 L 68 205 L 88 215 L 98 200 L 118 195 L 138 175 L 158 145 L 172 118 L 188 95 L 200 72 L 212 58 L 228 72 L 238 95 L 242 118 L 248 138 L 252 118 L 258 98 L 268 88 L 278 102 L 282 128 L 276 148 L 262 162 L 248 178 L 232 195 L 218 210 L 198 228 L 178 238 L 148 242 L 118 238 L 88 232 L 58 235 L 34 238 Z";

function priceLabel(zoneType: "main" | "extended", isArabic: boolean) {
  if (zoneType === "extended") {
    return isArabic ? "50 درهم" : "50 AED";
  }
  return isArabic ? "30 درهم" : "30 AED";
}

export default function UAEInteractiveMap() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [selectedId, setSelectedId] = useState("abu-dhabi");

  const selectedPoint = mapPoints.find((p) => p.id === selectedId) || mapPoints[0];
  const coveredAreas = useMemo(() => coverageAreas.filter((a) => a.active).length, []);

  return (
    <section className="glass-premium rounded-[28px] p-5 sm:p-7 border border-white/10 overflow-hidden relative" dir={isArabic ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(24,168,232,0.16),transparent_38%),radial-gradient(circle_at_75%_70%,rgba(212,175,55,0.14),transparent_42%)] pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch">
        <div className="relative min-h-[340px] sm:min-h-[400px] rounded-3xl border border-white/10 bg-gradient-to-br from-[#071A33] via-[#0A1C3A] to-[#071A33] overflow-hidden shadow-2xl">
          <svg viewBox="0 0 300 260" className="absolute inset-0 w-full h-full" aria-label={isArabic ? "خريطة الإمارات" : "UAE map"}>
            <defs>
              <linearGradient id="uaeFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0057B8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#18A8E8" stopOpacity="0.15" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d={UAE_OUTLINE} fill="url(#uaeFill)" stroke="rgba(212,175,55,0.45)" strokeWidth="1.5" />
            <path d="M 118 198 L 168 118" stroke="rgba(24,168,232,0.55)" strokeWidth="1.2" strokeDasharray="4 3" filter="url(#glow)" />
            <path d="M 108 210 L 178 98" stroke="rgba(212,175,55,0.45)" strokeWidth="1" strokeDasharray="3 3" />
            <path d="M 118 198 L 188 228" stroke="rgba(24,168,232,0.4)" strokeWidth="1" strokeDasharray="3 3" />
            <path d="M 178 98 L 228 108" stroke="rgba(212,175,55,0.35)" strokeWidth="1" strokeDasharray="3 3" />
            {mapPoints.map((point) => {
              const active = point.id === selectedId;
              return (
                <g key={point.id} onClick={() => setSelectedId(point.id)} className="cursor-pointer">
                  {active && <circle cx={point.cx} cy={point.cy} r="14" fill="rgba(212,175,55,0.25)" className="animate-pulse" />}
                  <circle cx={point.cx} cy={point.cy} r={active ? 7 : 5} fill={active ? "#D4AF37" : "#18A8E8"} stroke="#fff" strokeWidth="1.2" />
                </g>
              );
            })}
          </svg>
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
            {mapPoints.slice(0, 6).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${selectedId === p.id ? "bg-brand-gold text-brand-deep border-brand-gold" : "bg-brand-deep/80 text-white/70 border-white/15 hover:border-brand-gold/40"}`}
              >
                {isArabic ? p.nameAr : p.nameEn}
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-5 border border-white/10 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-xs font-bold text-brand-gold">
              <Globe2 className="w-4 h-4" />
              <span>{isArabic ? "خريطة التغطية — الإمارات" : "UAE Coverage Map"}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {isArabic ? "نقاط تشغيل نشطة عبر الإمارات" : "Active Operating Points Across the UAE"}
            </h2>
            <p className="text-white/65 text-sm leading-relaxed">
              {isArabic
                ? "اختر مدينة أو منطقة لمعرفة فئة التسعير والسعر النهائي المعروض للعميل."
                : "Select a city or area to view the pricing category and final customer price."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-brand-deep/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Truck className="w-8 h-8 text-brand-gold shrink-0" />
              <div className={isArabic ? "text-right flex-1" : "text-left flex-1"}>
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
                <p className="text-brand-gold font-black text-sm" dir="ltr">{priceLabel(selectedPoint.zoneType, isArabic)}</p>
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

          <ul className="space-y-2 max-h-32 overflow-y-auto text-xs text-white/60">
            {mapPoints.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelectedId(p.id)} className={`w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 ${selectedId === p.id ? "text-brand-gold" : ""}`}>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{isArabic ? p.nameAr : p.nameEn}</span>
                  <span dir="ltr">{p.zoneType === "extended" ? "50" : "30"} AED</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
