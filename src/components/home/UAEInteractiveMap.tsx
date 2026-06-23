import { useMemo, useState } from "react";
import { Activity, BadgeCheck, Clock3, MapPin, Route, Satellite, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { coverageAreas } from "../../data/coverage";
import { useAppContext } from "../../lib/AppContext";

type MapPoint = {
  id: string;
  nameEn: string;
  nameAr: string;
  emirate: string;
  zoneType: "main" | "extended";
  deliveryTimeEn: string;
  deliveryTimeAr: string;
  cx: number;
  cy: number;
};

const mapPoints: MapPoint[] = [
  { id: "abu-dhabi", nameEn: "Abu Dhabi Hub", nameAr: "مركز أبوظبي", emirate: "Abu Dhabi", zoneType: "main", deliveryTimeEn: "Same day / next day", deliveryTimeAr: "نفس اليوم / اليوم التالي", cx: 120, cy: 196 },
  { id: "mussafah", nameEn: "Mussafah 40", nameAr: "مصفح 40", emirate: "Abu Dhabi", zoneType: "main", deliveryTimeEn: "Daily pickup", deliveryTimeAr: "استلام يومي", cx: 107, cy: 211 },
  { id: "dubai", nameEn: "Dubai", nameAr: "دبي", emirate: "Dubai", zoneType: "main", deliveryTimeEn: "24 - 48 hours", deliveryTimeAr: "24 - 48 ساعة", cx: 169, cy: 119 },
  { id: "sharjah", nameEn: "Sharjah", nameAr: "الشارقة", emirate: "Sharjah", zoneType: "main", deliveryTimeEn: "24 - 48 hours", deliveryTimeAr: "24 - 48 ساعة", cx: 179, cy: 99 },
  { id: "ajman", nameEn: "Ajman", nameAr: "عجمان", emirate: "Ajman", zoneType: "main", deliveryTimeEn: "24 - 48 hours", deliveryTimeAr: "24 - 48 ساعة", cx: 187, cy: 82 },
  { id: "rak", nameEn: "Ras Al Khaimah", nameAr: "رأس الخيمة", emirate: "Ras Al Khaimah", zoneType: "main", deliveryTimeEn: "24 - 48 hours", deliveryTimeAr: "24 - 48 ساعة", cx: 201, cy: 49 },
  { id: "fujairah", nameEn: "Fujairah", nameAr: "الفجيرة", emirate: "Fujairah", zoneType: "main", deliveryTimeEn: "24 - 48 hours", deliveryTimeAr: "24 - 48 ساعة", cx: 229, cy: 109 },
  { id: "al-ain", nameEn: "Al Ain", nameAr: "العين", emirate: "Abu Dhabi", zoneType: "extended", deliveryTimeEn: "Scheduled route", deliveryTimeAr: "مسار مجدول", cx: 188, cy: 228 },
  { id: "al-dhafra", nameEn: "Al Dhafra / Western Region", nameAr: "الظفرة / المنطقة الغربية", emirate: "Abu Dhabi", zoneType: "extended", deliveryTimeEn: "Scheduled route", deliveryTimeAr: "مسار مجدول", cx: 49, cy: 227 }
];

const UAE_OUTLINE =
  "M 24 228 L 38 210 L 52 218 L 68 205 L 88 215 L 98 200 L 118 195 L 138 175 L 158 145 L 172 118 L 188 95 L 200 72 L 212 58 L 228 72 L 238 95 L 242 118 L 248 138 L 252 118 L 258 98 L 268 88 L 278 102 L 282 128 L 276 148 L 262 162 L 248 178 L 232 195 L 218 210 L 198 228 L 178 238 L 148 242 L 118 238 L 88 232 L 58 235 L 34 238 Z";

function priceLabel(zoneType: "main" | "extended", isArabic: boolean) {
  if (zoneType === "extended") return isArabic ? "50 درهم" : "50 AED";
  return isArabic ? "30 درهم" : "30 AED";
}

export default function UAEInteractiveMap() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [selectedId, setSelectedId] = useState("abu-dhabi");

  const selectedPoint = mapPoints.find((point) => point.id === selectedId) || mapPoints[0];
  const coveredAreas = useMemo(() => coverageAreas.filter((area) => area.active).length, []);

  const trustItems = [
    { icon: ShieldCheck, ar: "تغطية موثوقة", en: "Trusted coverage" },
    { icon: Zap, ar: "تسعير لحظي", en: "Instant pricing" },
    { icon: Clock3, ar: "خدمة 24/7", en: "24/7 service" },
    { icon: Satellite, ar: "تتبع مباشر", en: "Live tracking" }
  ];

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(16,35,63,0.88),rgba(6,18,37,0.72))] p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(30,144,255,0.12)] backdrop-blur-[22px]" dir={isArabic ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(30,144,255,0.18),transparent_34%),radial-gradient(circle_at_16%_80%,rgba(212,175,55,0.14),transparent_30%)] pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[0.88fr_1.12fr] gap-6 items-stretch">
        <aside className="rounded-[28px] border border-brand-gold/25 bg-brand-deep/70 p-5 sm:p-6 shadow-[0_0_32px_rgba(246,201,74,0.12)] space-y-5">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-xs font-black text-brand-gold">
              <MapPin className="w-4 h-4" />
              <span>{isArabic ? "خريطة التغطية — الإمارات" : "Coverage Map — UAE"}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {isArabic ? "نقاط تشغيل نشطة عبر الإمارات" : "Active Operating Points Across The UAE"}
            </h2>
            <p className="text-white/65 text-sm leading-relaxed">
              {isArabic
                ? "اختر مدينة أو منطقة لمعرفة فئة التسعير والسعر النهائي المعروض للعميل."
                : "Select a city or area to view service category and the final customer-facing price."}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-brand-gold text-xs font-black uppercase">{selectedPoint.emirate}</p>
                <h3 className="text-2xl font-black text-white">{isArabic ? selectedPoint.nameAr : selectedPoint.nameEn}</h3>
                <p className="text-white/45 text-xs mt-1">{isArabic ? selectedPoint.nameEn : selectedPoint.nameAr}</p>
              </div>
              <span className="h-12 w-12 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
                <Activity className="w-6 h-6 text-brand-gold" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl bg-brand-cool/60 border border-white/10 p-3">
                <p className="text-white/45">{isArabic ? "نوع المنطقة" : "Zone type"}</p>
                <p className="text-brand-gold font-black">{selectedPoint.zoneType === "extended" ? (isArabic ? "ممتدة" : "Extended") : (isArabic ? "رئيسية" : "Main")}</p>
              </div>
              <div className="rounded-2xl bg-brand-cool/60 border border-white/10 p-3">
                <p className="text-white/45">{isArabic ? "السعر الابتدائي" : "Starting price"}</p>
                <p className="text-brand-gold font-black" dir="ltr">{priceLabel(selectedPoint.zoneType, isArabic)}</p>
              </div>
              <div className="rounded-2xl bg-brand-cool/60 border border-white/10 p-3">
                <p className="text-white/45">{isArabic ? "مدة التوصيل" : "Delivery time"}</p>
                <p className="text-white font-bold">{isArabic ? selectedPoint.deliveryTimeAr : selectedPoint.deliveryTimeEn}</p>
              </div>
              <div className="rounded-2xl bg-brand-cool/60 border border-white/10 p-3">
                <p className="text-white/45">{isArabic ? "حالة التغطية" : "Coverage status"}</p>
                <p className="text-emerald-300 font-black">{isArabic ? "نشطة" : "Active"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-3xl font-black text-brand-gold font-mono">50+</p>
              <p className="text-xs text-white/55">{isArabic ? "مسارات يومية نشطة" : "Active daily routes"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-3xl font-black text-brand-gold font-mono">{coveredAreas}</p>
              <p className="text-xs text-white/55">{isArabic ? "منطقة تغطية" : "Coverage areas"}</p>
            </div>
          </div>

          <ul className="space-y-2 max-h-40 overflow-y-auto text-xs text-white/60 no-scrollbar">
            {mapPoints.map((point) => (
              <li key={point.id}>
                <button type="button" onClick={() => setSelectedId(point.id)} className={`w-full flex items-center justify-between gap-2 py-2 px-3 rounded-xl border transition-all ${selectedId === point.id ? "text-brand-gold border-brand-gold/35 bg-brand-gold/10" : "border-white/5 hover:border-brand-gold/25 hover:bg-white/5"}`}>
                  <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{isArabic ? point.nameAr : point.nameEn}</span>
                  <span dir="ltr">{point.zoneType === "extended" ? "50" : "30"} AED</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="relative min-h-[390px] sm:min-h-[500px] rounded-[30px] border border-blue-400/20 bg-[linear-gradient(145deg,#020817,#061225_48%,#0A1C3A)] overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_30%,rgba(43,184,255,0.16),transparent_32%),radial-gradient(circle_at_38%_70%,rgba(246,201,74,0.11),transparent_34%)]" />
          <svg viewBox="0 0 300 260" className="absolute inset-0 h-full w-full" aria-label={isArabic ? "خريطة الإمارات التفاعلية" : "Interactive UAE map"}>
            <defs>
              <linearGradient id="uaeDepth" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E90FF" stopOpacity="0.42" />
                <stop offset="55%" stopColor="#10233F" stopOpacity="0.86" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.16" />
              </linearGradient>
              <filter id="premiumGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <path d={UAE_OUTLINE} transform="translate(5 8)" fill="rgba(0,0,0,0.28)" />
            <path d={UAE_OUTLINE} fill="url(#uaeDepth)" stroke="rgba(91,203,255,0.7)" strokeWidth="2" filter="url(#premiumGlow)" />
            <path d={UAE_OUTLINE} fill="none" stroke="rgba(246,201,74,0.24)" strokeWidth="8" opacity="0.22" />

            {mapPoints.filter((point) => point.id !== "abu-dhabi").map((point) => (
              <path
                key={`route-${point.id}`}
                d={`M 120 196 Q ${(120 + point.cx) / 2} ${Math.min(80, point.cy - 38)} ${point.cx} ${point.cy}`}
                fill="none"
                stroke={point.id === selectedId ? "rgba(246,201,74,0.95)" : "rgba(246,201,74,0.26)"}
                strokeWidth={point.id === selectedId ? 1.8 : 1}
                strokeDasharray="4 4"
              />
            ))}

            {mapPoints.map((point) => {
              const active = point.id === selectedId;
              const hub = point.id === "abu-dhabi";
              return (
                <g key={point.id} onClick={() => setSelectedId(point.id)} className="cursor-pointer">
                  {(active || hub) && <circle cx={point.cx} cy={point.cy} r={hub ? 18 : 14} fill="rgba(246,201,74,0.20)" className="animate-pulse" />}
                  <circle cx={point.cx} cy={point.cy} r={hub ? 8 : active ? 7 : 5} fill={hub || active ? "#F6C94A" : "#5BCBFF"} stroke="#fff" strokeWidth="1.3" />
                  <circle cx={point.cx} cy={point.cy} r="2" fill="#020817" />
                </g>
              );
            })}
          </svg>

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
            <div className="rounded-full border border-brand-gold/30 bg-brand-deep/80 px-3 py-1 text-[11px] font-black text-brand-gold backdrop-blur-xl">
              {isArabic ? "أبوظبي Hub رئيسي" : "Abu Dhabi Primary Hub"}
            </div>
            <div className="rounded-full border border-blue-300/25 bg-brand-deep/80 px-3 py-1 text-[11px] font-black text-blue-100 backdrop-blur-xl">
              {isArabic ? "شبكة ذكية" : "Smart Network"}
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {trustItems.map(({ icon: Icon, ar, en }) => (
              <div key={en} className="rounded-2xl border border-white/10 bg-brand-deep/75 px-3 py-2 backdrop-blur-xl flex items-center gap-2">
                <Icon className="w-4 h-4 text-brand-gold shrink-0" />
                <span className="text-[11px] font-bold text-white/75">{isArabic ? ar : en}</span>
              </div>
            ))}
          </div>

          <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden sm:flex flex-col gap-2">
            {[0, 1, 2].map((item) => (
              <span key={item} className="h-2 w-2 rounded-full bg-brand-gold shadow-[0_0_16px_rgba(246,201,74,0.9)] animate-pulse" style={{ animationDelay: `${item * 240}ms` }} />
            ))}
          </div>

          <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:flex flex-col gap-2">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className="h-1.5 w-1.5 rounded-full bg-blue-300 shadow-[0_0_14px_rgba(91,203,255,0.9)] animate-pulse" style={{ animationDelay: `${item * 180}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
