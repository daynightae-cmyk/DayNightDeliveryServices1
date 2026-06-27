import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, Box, Clock, MapPin, Navigation, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import "../../styles/dn-dashboard-map.css";

type ZoneType = "main" | "extended";

type MapNode = {
  id: string;
  nameAr: string;
  nameEn: string;
  zoneAr: string;
  zoneEn: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  curve: number;
  isHub?: boolean;
  zoneType: ZoneType;
  price: number;
  coverage: number;
};

const UAE_SHAPE = "M82 426 C130 356 215 372 292 344 C374 315 425 250 517 205 C615 157 698 96 790 48 C852 74 918 154 920 240 C912 306 846 330 772 346 C708 360 673 420 608 457 C516 511 384 506 285 482 C205 464 133 462 82 426 Z";
const UAE_INNER = "M132 414 C188 372 259 374 326 344 C403 310 453 262 531 226 C618 186 698 126 777 84 C827 110 878 169 882 235 C873 279 815 299 755 315 C688 333 658 385 598 421 C514 472 397 468 308 448 C238 432 175 440 132 414 Z";

const NODES: MapNode[] = [
  { id: "abudhabi", nameAr: "أبوظبي", nameEn: "Abu Dhabi", zoneAr: "المركز الرئيسي", zoneEn: "Main hub", x: 492, y: 388, labelX: 510, labelY: 366, curve: -15, isHub: true, zoneType: "main", price: 30, coverage: 23 },
  { id: "dubai", nameAr: "دبي", nameEn: "Dubai", zoneAr: "منطقة رئيسية", zoneEn: "Main zone", x: 646, y: 253, labelX: 616, labelY: 231, curve: -72, zoneType: "main", price: 30, coverage: 35 },
  { id: "sharjah", nameAr: "الشارقة", nameEn: "Sharjah", zoneAr: "منطقة رئيسية", zoneEn: "Main zone", x: 688, y: 210, labelX: 634, labelY: 182, curve: -88, zoneType: "main", price: 30, coverage: 12 },
  { id: "ajman", nameAr: "عجمان", nameEn: "Ajman", zoneAr: "منطقة رئيسية", zoneEn: "Main zone", x: 724, y: 178, labelX: 667, labelY: 155, curve: -106, zoneType: "main", price: 30, coverage: 6 },
  { id: "uaq", nameAr: "أم القيوين", nameEn: "Umm Al Quwain", zoneAr: "منطقة رئيسية", zoneEn: "Main zone", x: 758, y: 145, labelX: 662, labelY: 116, curve: -126, zoneType: "main", price: 30, coverage: 5 },
  { id: "rak", nameAr: "رأس الخيمة", nameEn: "Ras Al Khaimah", zoneAr: "منطقة رئيسية", zoneEn: "Main zone", x: 796, y: 82, labelX: 700, labelY: 58, curve: -154, zoneType: "main", price: 30, coverage: 15 },
  { id: "fujairah", nameAr: "الفجيرة", nameEn: "Fujairah", zoneAr: "منطقة رئيسية", zoneEn: "Main zone", x: 895, y: 250, labelX: 828, labelY: 230, curve: -58, zoneType: "main", price: 30, coverage: 10 },
  { id: "alain", nameAr: "العين", nameEn: "Al Ain", zoneAr: "منطقة موسعة", zoneEn: "Extended zone", x: 660, y: 461, labelX: 638, labelY: 437, curve: 58, zoneType: "extended", price: 50, coverage: 18 },
  { id: "western", nameAr: "المنطقة الغربية", nameEn: "Western Region", zoneAr: "منطقة موسعة", zoneEn: "Extended zone", x: 180, y: 448, labelX: 108, labelY: 426, curve: 78, zoneType: "extended", price: 50, coverage: 12 },
];

const HUB = NODES[0];
const ROUTES = NODES.filter((node) => !node.isHub);

function routePath(node: MapNode) {
  const midX = (HUB.x + node.x) / 2 + node.curve;
  const midY = (HUB.y + node.y) / 2 - Math.abs(node.curve) * 0.28;
  return `M ${HUB.x} ${HUB.y} Q ${midX} ${midY} ${node.x} ${node.y}`;
}

function nodeLabel(node: MapNode, isArabic: boolean) {
  return isArabic ? node.nameAr : node.nameEn;
}

function zoneLabel(node: MapNode, isArabic: boolean) {
  if (node.isHub) return isArabic ? "مركز توزيع" : "Dispatch hub";
  return node.zoneType === "main" ? (isArabic ? "سعر رئيسي" : "Main rate") : (isArabic ? "منطقة موسعة" : "Extended");
}

export default function UAEInteractiveMap() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [selectedId, setSelectedId] = useState(HUB.id);
  const [paused, setPaused] = useState(false);
  const selected = NODES.find((node) => node.id === selectedId) || HUB;

  const mapLights = useMemo(() => Array.from({ length: 92 }, (_, index) => {
    const x = 120 + ((index * 73) % 760);
    const y = 95 + ((index * 41) % 390);
    const opacity = 0.24 + ((index * 17) % 50) / 100;
    const radius = 1 + ((index * 7) % 3);
    return { id: index, x, y, opacity, radius };
  }), []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setSelectedId((current) => {
        const currentIndex = NODES.findIndex((node) => node.id === current);
        return NODES[(currentIndex + 1) % NODES.length].id;
      });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [paused]);

  const features = [
    { icon: ShieldCheck, value: isArabic ? "تغطية موثوقة" : "Trusted coverage", caption: isArabic ? "في جميع أنحاء الدولة" : "Across UAE" },
    { icon: Zap, value: isArabic ? "تسعير لحظي" : "Live pricing", caption: isArabic ? "حسب المسافة والوقت" : "By route and timing" },
    { icon: Clock, value: "24 / 7", caption: isArabic ? "نهاراً وليلاً" : "Day and night" },
    { icon: Box, value: isArabic ? "تتبع مباشر" : "Live tracking", caption: isArabic ? "لحظة بلحظة" : "Step by step" },
  ];

  return (
    <section className="relative py-14 sm:py-16" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mx-auto mb-9 max-w-4xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-gold">
          <Navigation className="h-3.5 w-3.5" /> {isArabic ? "خريطة تشغيل حيوية" : "Live Operations Map"}
        </div>
        <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">{isArabic ? "خريطة تغطية الإمارات بتأثير حي" : "UAE coverage map with live motion"}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-7 text-white/58">{isArabic ? "اضغط على أي مدينة لمشاهدة التغطية، السعر، ونوع المنطقة مع خطوط تشغيل متحركة من مركز أبوظبي." : "Click any city to see coverage, price, and zone type with animated routes from Abu Dhabi hub."}</p>
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="dn-uae-map-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="dn-map-chip p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-brand-gold/35 bg-brand-gold/10">
                <Activity className="h-5 w-5 text-brand-sky" />
              </div>
              <div>
                <p className="text-sm font-black text-white">{isArabic ? "تحديث لحظي" : "Live refresh"}</p>
                <p className="mt-1 text-[11px] font-bold text-white/52">{isArabic ? "حركة الشحن والمناطق تحدث كل 30 ثانية" : "Routes and zones refresh every 30 seconds"}</p>
              </div>
              <span className="ms-auto h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            </div>
          </div>

          <svg className="dn-uae-map-svg" viewBox="0 0 1000 620" role="img" aria-label={isArabic ? "خريطة تغطية الإمارات" : "UAE coverage map"}>
            <defs>
              <linearGradient id="dnMapLand" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#123D78" />
                <stop offset="0.48" stopColor="#0A2B5A" />
                <stop offset="1" stopColor="#061A36" />
              </linearGradient>
              <linearGradient id="dnMapEdge" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#1D9CFF" />
                <stop offset="0.55" stopColor="#4FD7FF" />
                <stop offset="1" stopColor="#F6C94A" />
              </linearGradient>
              <radialGradient id="dnMapHubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="rgba(246,201,74,0.92)" />
                <stop offset="0.42" stopColor="rgba(246,201,74,0.34)" />
                <stop offset="1" stopColor="rgba(246,201,74,0)" />
              </radialGradient>
              <filter id="dnMapShadow" x="-20%" y="-20%" width="140%" height="160%">
                <feDropShadow dx="0" dy="22" stdDeviation="16" floodColor="#000" floodOpacity="0.45" />
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#1E90FF" floodOpacity="0.25" />
              </filter>
            </defs>

            <rect x="0" y="0" width="1000" height="620" fill="transparent" />
            <path d={UAE_SHAPE} transform="translate(0 28)" fill="#031226" opacity="0.72" />
            <path d={UAE_SHAPE} transform="translate(0 16)" fill="#063267" opacity="0.52" />
            <motion.path d={UAE_SHAPE} fill="url(#dnMapLand)" stroke="url(#dnMapEdge)" strokeWidth="4" filter="url(#dnMapShadow)" initial={{ pathLength: 0, opacity: 0.65 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: "easeOut" }} />
            <path d={UAE_INNER} fill="none" stroke="rgba(79,215,255,0.18)" strokeWidth="1.2" strokeDasharray="8 12" />

            {mapLights.map((light) => <circle key={light.id} cx={light.x} cy={light.y} r={light.radius} fill="#F6C94A" opacity={light.opacity} />)}
            {mapLights.slice(0, 30).map((light) => <circle key={`blue-${light.id}`} cx={light.x + 8} cy={light.y - 12} r="1.3" fill="#4FD7FF" opacity="0.42" />)}

            {ROUTES.map((node) => {
              const active = node.id === selected.id || selected.isHub;
              return <path key={node.id} d={routePath(node)} className={`dn-map-route ${active ? "dn-map-route-gold" : "dn-map-route-blue"}`} strokeWidth={active ? 3.2 : 1.7} opacity={active ? 0.95 : 0.52} />;
            })}

            {NODES.map((node) => {
              const active = node.id === selected.id;
              return (
                <motion.g key={node.id} className={active ? "dn-map-node-selected" : ""} onClick={() => setSelectedId(node.id)} whileHover={{ scale: 1.08 }} style={{ cursor: "pointer" }}>
                  <circle cx={node.x} cy={node.y} r={node.isHub ? 45 : 30} fill="url(#dnMapHubGlow)" opacity={node.isHub || active ? 0.95 : 0.5} />
                  <circle className="dn-map-node-ring" cx={node.x} cy={node.y} r={node.isHub ? 28 : 21} />
                  <circle className="dn-map-node-core" cx={node.x} cy={node.y} r={node.isHub ? 13 : 10} />
                  <line x1={node.x} y1={node.y - 20} x2={node.labelX} y2={node.labelY + 8} stroke="rgba(246,201,74,0.55)" strokeWidth="1.2" />
                  <text x={node.labelX} y={node.labelY} textAnchor={node.labelX > node.x ? "start" : "end"} className={node.isHub ? "dn-map-label" : "dn-map-label-small"}>{nodeLabel(node, isArabic)}</text>
                </motion.g>
              );
            })}
          </svg>

          <div className="dn-map-feature-strip grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, value, caption }) => <div key={String(value)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><Icon className="h-5 w-5 shrink-0 text-brand-gold" /><div><p className="text-sm font-black text-white">{value}</p><p className="text-[11px] font-bold text-white/48">{caption}</p></div></div>)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-[1.7rem] border border-brand-gold/25 bg-brand-gold/10 p-5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-brand-gold" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-brand-gold">{isArabic ? selected.zoneAr : selected.zoneEn}</p>
                <h3 className="mt-2 text-3xl font-black text-white">{nodeLabel(selected, isArabic)}</h3>
                <p className="mt-2 text-sm font-bold text-white/55">{zoneLabel(selected, isArabic)} • {selected.coverage} {isArabic ? "منطقة تشغيل" : "active zones"}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-center"><p className="text-3xl font-black text-brand-gold" dir="ltr">{selected.price}</p><p className="text-xs font-bold text-white/45">{isArabic ? "درهم" : "AED"}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-center"><p className="text-3xl font-black text-brand-sky" dir="ltr">{selected.coverage}</p><p className="text-xs font-bold text-white/45">{isArabic ? "نقطة" : "points"}</p></div>
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black text-brand-gold"><Sparkles className="h-4 w-4" /> {isArabic ? "اختر مدينة" : "Choose a city"}</div>
            <div className="flex flex-wrap gap-2">
              {NODES.map((node) => <button key={node.id} onClick={() => setSelectedId(node.id)} className={`dn-map-city-button ${node.id === selected.id ? "dn-map-city-button-active" : ""} rounded-2xl px-4 py-2.5 text-xs font-black`}>{nodeLabel(node, isArabic)}</button>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
