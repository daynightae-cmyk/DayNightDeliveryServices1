import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Clock, MapPin, Navigation, Package, Truck, Zap } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";

type ZoneType = "main" | "extended";
type City = {
  id: string;
  nameAr: string;
  nameEn: string;
  emirateAr: string;
  emirateEn: string;
  lat: number;
  lng: number;
  isHub?: boolean;
  zoneType: ZoneType;
  price: number;
  coverage: number;
};

const UAE_CITIES: City[] = [
  { id: "abudhabi", nameAr: "أبوظبي", nameEn: "Abu Dhabi", emirateAr: "إمارة أبوظبي", emirateEn: "Abu Dhabi", lat: 24.4539, lng: 54.3773, isHub: true, zoneType: "main", price: 30, coverage: 23 },
  { id: "mussafah", nameAr: "مصفح", nameEn: "Mussafah", emirateAr: "إمارة أبوظبي", emirateEn: "Abu Dhabi", lat: 24.3682, lng: 54.4907, zoneType: "main", price: 30, coverage: 8 },
  { id: "dubai", nameAr: "دبي", nameEn: "Dubai", emirateAr: "إمارة دبي", emirateEn: "Dubai", lat: 25.2048, lng: 55.2708, zoneType: "main", price: 30, coverage: 35 },
  { id: "sharjah", nameAr: "الشارقة", nameEn: "Sharjah", emirateAr: "إمارة الشارقة", emirateEn: "Sharjah", lat: 25.3463, lng: 55.4209, zoneType: "main", price: 30, coverage: 12 },
  { id: "ajman", nameAr: "عجمان", nameEn: "Ajman", emirateAr: "إمارة عجمان", emirateEn: "Ajman", lat: 25.4052, lng: 55.5136, zoneType: "main", price: 30, coverage: 6 },
  { id: "uaq", nameAr: "أم القيوين", nameEn: "Umm Al Quwain", emirateAr: "أم القيوين", emirateEn: "Umm Al Quwain", lat: 25.5647, lng: 55.5553, zoneType: "main", price: 30, coverage: 5 },
  { id: "rak", nameAr: "رأس الخيمة", nameEn: "Ras Al Khaimah", emirateAr: "رأس الخيمة", emirateEn: "Ras Al Khaimah", lat: 25.7895, lng: 55.9432, zoneType: "main", price: 30, coverage: 15 },
  { id: "fujairah", nameAr: "الفجيرة", nameEn: "Fujairah", emirateAr: "إمارة الفجيرة", emirateEn: "Fujairah", lat: 25.1288, lng: 56.3265, zoneType: "main", price: 30, coverage: 10 },
  { id: "alain", nameAr: "العين", nameEn: "Al Ain", emirateAr: "إمارة أبوظبي", emirateEn: "Abu Dhabi", lat: 24.2075, lng: 55.7447, zoneType: "extended", price: 50, coverage: 18 },
  { id: "western", nameAr: "المنطقة الغربية", nameEn: "Western Region", emirateAr: "إمارة أبوظبي", emirateEn: "Abu Dhabi", lat: 23.7, lng: 51.6, zoneType: "extended", price: 50, coverage: 12 },
];

const HUB = UAE_CITIES[0];

function MapController({ city }: { city: City }) {
  const map = useMap();
  useEffect(() => {
    const zoom = city.id === "western" ? 7 : city.id === "abudhabi" ? 8 : 10;
    map.flyTo([city.lat, city.lng], zoom, { duration: 1.15, easeLinearity: 0.5 });
  }, [city.id, city.lat, city.lng, map]);
  return null;
}

function getMarkerColor(city: City) {
  if (city.isHub) return "#F6C94A";
  if (city.zoneType === "extended") return "#00CFFF";
  return "#2196F3";
}

export default function UAEInteractiveMap() {
  const { language, theme } = useAppContext();
  const isArabic = language === "ar";
  const isLight = theme === "light";
  const [selectedCity, setSelectedCity] = useState<City>(HUB);
  const [mounted, setMounted] = useState(false);
  const selectedColor = getMarkerColor(selectedCity);

  useEffect(() => {
    setMounted(true);
    const style = document.createElement("style");
    style.id = "dn-map-styles";
    style.innerHTML = `
      .leaflet-dn-tooltip { background: rgba(7,26,51,0.94) !important; border: 1px solid rgba(212,175,55,0.42) !important; border-radius: 9px !important; padding: 5px 11px !important; color: #fff !important; font-size: 11px !important; font-weight: 800 !important; box-shadow: 0 6px 20px rgba(0,0,0,0.35) !important; white-space: nowrap !important; }
      .leaflet-dn-tooltip::before { display: none !important; }
      .leaflet-control-zoom { border: 1px solid rgba(212,175,55,0.25) !important; border-radius: 12px !important; overflow: hidden !important; }
      .leaflet-control-zoom a { background: rgba(7,26,51,0.92) !important; color: #F6C94A !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
      .leaflet-container { outline: none; font-family: inherit; }
    `;
    if (!document.getElementById("dn-map-styles")) document.head.appendChild(style);
    return () => document.getElementById("dn-map-styles")?.remove();
  }, []);

  const tileUrl = isLight
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  const panelBg = isLight ? "rgba(255,255,255,0.94)" : "rgba(5,20,40,0.94)";
  const panelText = isLight ? "#071A33" : "#FFFFFF";
  const mutedText = isLight ? "rgba(7,26,51,0.55)" : "rgba(255,255,255,0.50)";

  const infoPanel = (
    <div style={{ position: "absolute", top: 16, [isArabic ? "right" : "left"]: 16, zIndex: 1000, width: 230, background: panelBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${selectedColor}55`, borderRadius: 20, padding: 18, boxShadow: isLight ? "0 12px 34px rgba(7,26,51,0.16)" : "0 8px 32px rgba(0,0,0,0.50)" }} dir={isArabic ? "rtl" : "ltr"}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: selectedColor, boxShadow: `0 0 10px ${selectedColor}` }} /><span style={{ fontSize: 10, fontWeight: 900, color: "#B58900", letterSpacing: "0.08em", textTransform: "uppercase" }}>{isArabic ? selectedCity.emirateAr : selectedCity.emirateEn}</span></div>
      <h3 style={{ fontSize: 24, fontWeight: 950, color: panelText, marginBottom: 4, lineHeight: 1.1 }}>{isArabic ? selectedCity.nameAr : selectedCity.nameEn}</h3>
      <p style={{ fontSize: 11, color: mutedText, marginBottom: 14 }}>{selectedCity.isHub ? (isArabic ? "• المقر الرئيسي" : "• HQ & Dispatch Hub") : selectedCity.zoneType === "main" ? (isArabic ? "• منطقة رئيسية" : "• Main Zone") : (isArabic ? "• منطقة موسعة" : "• Extended Zone")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: "center", padding: "11px 6px", background: isLight ? "rgba(7,26,51,0.045)" : "rgba(255,255,255,0.055)", borderRadius: 12, border: isLight ? "1px solid rgba(7,26,51,0.08)" : "1px solid rgba(255,255,255,0.08)" }}><div style={{ fontSize: 24, fontWeight: 900, color: "#B58900", lineHeight: 1 }}>{selectedCity.price}</div><div style={{ fontSize: 9, color: mutedText, marginTop: 3 }}>{isArabic ? "درهم" : "AED FLAT"}</div></div>
        <div style={{ textAlign: "center", padding: "11px 6px", background: isLight ? "rgba(7,26,51,0.045)" : "rgba(255,255,255,0.055)", borderRadius: 12, border: isLight ? "1px solid rgba(7,26,51,0.08)" : "1px solid rgba(255,255,255,0.08)" }}><div style={{ fontSize: 24, fontWeight: 900, color: "#1E90FF", lineHeight: 1 }}>{selectedCity.coverage}</div><div style={{ fontSize: 9, color: mutedText, marginTop: 3 }}>{isArabic ? "منطقة" : "ZONES"}</div></div>
      </div>
      <div style={{ padding: "9px 10px", background: `${selectedColor}12`, borderRadius: 10, border: `1px solid ${selectedColor}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 10, color: mutedText }}>{isArabic ? "نوع المنطقة" : "Zone type"}</span><span style={{ fontSize: 10, fontWeight: 900, color: selectedColor }}>{selectedCity.zoneType === "main" ? (isArabic ? "رئيسية" : "Main") : (isArabic ? "موسعة" : "Extended")}</span></div>
    </div>
  );

  const liveBadge = (
    <div style={{ position: "absolute", top: 16, [isArabic ? "left" : "right"]: 16, zIndex: 1000, display: "flex", alignItems: "center", gap: 6, padding: "7px 15px", background: panelBg, backdropFilter: "blur(12px)", border: isLight ? "1px solid rgba(7,26,51,0.10)" : "1px solid rgba(255,255,255,0.10)", borderRadius: 999 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#25D366", boxShadow: "0 0 8px #25D366" }} />
      <span style={{ fontSize: 10, fontWeight: 900, color: panelText, letterSpacing: "0.1em" }}>{isArabic ? "مباشر" : "LIVE"}</span>
    </div>
  );

  if (!mounted) {
    return <section className="relative py-16 px-4"><div className="mx-auto max-w-7xl"><div className="rounded-3xl border border-white/10 flex items-center justify-center" style={{ height: 520, background: isLight ? "rgba(255,255,255,0.85)" : "rgba(5,20,40,0.80)" }}><div className={isLight ? "text-brand-deep/50 text-sm" : "text-white/40 text-sm"}>{isArabic ? "جاري تحميل الخريطة..." : "Loading map..."}</div></div></div></section>;
  }

  return (
    <section className="relative py-16 px-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="text-center mb-10 mx-auto max-w-4xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold text-xs font-black uppercase tracking-widest mb-4"><Navigation className="w-3.5 h-3.5" />{isArabic ? "خريطة التغطية – الإمارات" : "Coverage Map – UAE"}</div>
        <h2 className={isLight ? "text-3xl sm:text-4xl font-black text-brand-deep mb-3" : "text-3xl sm:text-4xl font-black text-white mb-3"}>{isArabic ? "نقاط تشغيل نشطة عبر الإمارات" : "Active Operations Across UAE"}</h2>
        <p className={isLight ? "text-brand-deep/65 max-w-xl mx-auto text-sm font-bold" : "text-white/60 max-w-xl mx-auto text-sm font-bold"}>{isArabic ? "اختر أي مدينة أو منطقة لمعرفة التسعير والتغطية الفعلية." : "Select any city or area to see live pricing and coverage details."}</p>
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[1.75rem]" style={{ height: 560, border: isLight ? "1px solid rgba(7,26,51,0.12)" : "1px solid rgba(255,255,255,0.10)", boxShadow: isLight ? "0 28px 80px rgba(7,26,51,0.13)" : "0 28px 80px rgba(0,0,0,0.35)" }}>
          <MapContainer center={[24.5, 54.5]} zoom={7} className="w-full h-full" zoomControl attributionControl={false} style={{ background: isLight ? "#EAF2FF" : "#050f1a" }}>
            <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' subdomains="abcd" maxZoom={20} />
            <MapController city={selectedCity} />
            {UAE_CITIES.filter((city) => !city.isHub).map((city) => <Polyline key={`route-${city.id}`} positions={[[HUB.lat, HUB.lng], [city.lat, city.lng]]} pathOptions={{ color: city.id === selectedCity.id ? "#F6C94A" : city.zoneType === "extended" ? "#00CFFF" : "#2196F3", weight: city.id === selectedCity.id ? 2.5 : 1.25, opacity: city.id === selectedCity.id ? 0.82 : 0.32, dashArray: "5 8" }} />)}
            {UAE_CITIES.map((city) => {
              const isSelected = city.id === selectedCity.id;
              const color = getMarkerColor(city);
              const radius = city.isHub ? 12 : isSelected ? 10 : 6.5;
              return <CircleMarker key={city.id} center={[city.lat, city.lng]} radius={radius} pathOptions={{ fillColor: color, fillOpacity: 0.95, color: isSelected || city.isHub ? "rgba(255,255,255,0.95)" : "transparent", weight: 2 }} eventHandlers={{ click: () => setSelectedCity(city) }}><Tooltip direction="top" offset={[0, -(radius + 3)]} opacity={1} className="leaflet-dn-tooltip" permanent={city.isHub}>{isArabic ? city.nameAr : city.nameEn}</Tooltip></CircleMarker>;
            })}
            <CircleMarker center={[HUB.lat, HUB.lng]} radius={21} pathOptions={{ fillColor: "transparent", color: "#F6C94A", weight: 1, opacity: 0.24, dashArray: "3 7" }} interactive={false} />
          </MapContainer>
          {infoPanel}
          {liveBadge}
        </div>

        <div className="mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}><div className="flex gap-2 px-0.5" style={{ minWidth: "max-content" }}>{UAE_CITIES.map((city) => { const isActive = city.id === selectedCity.id; const color = getMarkerColor(city); return <button key={city.id} onClick={() => setSelectedCity(city)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 14, fontSize: 12, fontWeight: isActive ? 900 : 700, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${isActive ? color : isLight ? "rgba(7,26,51,0.12)" : "rgba(255,255,255,0.12)"}`, background: isActive ? `${color}1F` : isLight ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.05)", color: isActive ? color : isLight ? "rgba(7,26,51,0.58)" : "rgba(255,255,255,0.55)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />{isArabic ? city.nameAr : city.nameEn}</button>; })}</div></div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { icon: MapPin, labelAr: "إمارات مغطاة", labelEn: "Emirates covered", value: "7+" },
            { icon: Truck, labelAr: "توصيل يومي", labelEn: "Daily deliveries", value: "23+" },
            { icon: Package, labelAr: "سعر المدن الرئيسية", labelEn: "Main city flat rate", value: "30 AED" },
            { icon: Clock, labelAr: "خدمة مستمرة", labelEn: "Non-stop service", value: "24/7" },
          ].map(({ icon: Icon, labelAr, labelEn, value }) => <div key={labelEn} className="flex items-center gap-3 rounded-2xl border p-4" style={{ background: isLight ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.05)", borderColor: isLight ? "rgba(7,26,51,0.10)" : "rgba(255,255,255,0.08)" }}><Icon className="w-4 h-4 text-brand-gold shrink-0" /><div><div style={{ fontSize: 14, fontWeight: 900, color: "#B58900" }}>{value}</div><div style={{ fontSize: 10, color: isLight ? "rgba(7,26,51,0.55)" : "rgba(255,255,255,0.45)" }}>{isArabic ? labelAr : labelEn}</div></div></div>)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4"><Legend color="#F6C94A" label={isArabic ? "مركز التوزيع" : "Dispatch Hub"} isLight={isLight} /><Legend color="#2196F3" label={isArabic ? "منطقة رئيسية – 30 درهم" : "Main zone – 30 AED"} isLight={isLight} /><Legend color="#00CFFF" label={isArabic ? "منطقة موسعة – 50 درهم" : "Extended zone – 50 AED"} isLight={isLight} /><div className="flex items-center gap-2"><Zap className="w-3 h-3 text-brand-gold" /><span className={isLight ? "text-xs text-brand-deep/55" : "text-xs text-white/50"}>{isArabic ? "انقر على أي مدينة" : "Click any city"}</span></div></div>
      </div>
    </section>
  );
}

function Legend({ color, label, isLight }: { color: string; label: string; isLight: boolean }) {
  return <div className="flex items-center gap-2"><span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} /><span className={isLight ? "text-xs text-brand-deep/55" : "text-xs text-white/50"}>{label}</span></div>;
}
