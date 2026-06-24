import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Truck, Package, Clock, Navigation, Zap } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";

type ZoneType = "main" | "extended";
type City = {
  id: string; nameAr: string; nameEn: string;
  emirateAr: string; emirateEn: string;
  lat: number; lng: number;
  isHub?: boolean; zoneType: ZoneType;
  price: number; coverage: number;
};

const UAE_CITIES: City[] = [
  { id:"abudhabi",  nameAr:"أبوظبي",           nameEn:"Abu Dhabi",       emirateAr:"إمارة أبوظبي",    emirateEn:"Abu Dhabi",       lat:24.4539, lng:54.3773, isHub:true, zoneType:"main",     price:30, coverage:23 },
  { id:"mussafah",  nameAr:"مصفح",              nameEn:"Mussafah",        emirateAr:"إمارة أبوظبي",    emirateEn:"Abu Dhabi",       lat:24.3682, lng:54.4907, zoneType:"main",     price:30, coverage:8  },
  { id:"dubai",     nameAr:"دبي",               nameEn:"Dubai",           emirateAr:"إمارة دبي",        emirateEn:"Dubai",           lat:25.2048, lng:55.2708, zoneType:"main",     price:30, coverage:35 },
  { id:"sharjah",   nameAr:"الشارقة",           nameEn:"Sharjah",         emirateAr:"إمارة الشارقة",    emirateEn:"Sharjah",         lat:25.3463, lng:55.4209, zoneType:"main",     price:30, coverage:12 },
  { id:"ajman",     nameAr:"عجمان",             nameEn:"Ajman",           emirateAr:"إمارة عجمان",      emirateEn:"Ajman",           lat:25.4052, lng:55.5136, zoneType:"main",     price:30, coverage:6  },
  { id:"uaq",       nameAr:"أم القيوين",        nameEn:"Umm Al Quwain",   emirateAr:"أم القيوين",       emirateEn:"Umm Al Quwain",   lat:25.5647, lng:55.5553, zoneType:"main",     price:30, coverage:5  },
  { id:"rak",       nameAr:"رأس الخيمة",        nameEn:"Ras Al Khaimah",  emirateAr:"رأس الخيمة",       emirateEn:"Ras Al Khaimah",  lat:25.7895, lng:55.9432, zoneType:"main",     price:30, coverage:15 },
  { id:"fujairah",  nameAr:"الفجيرة",           nameEn:"Fujairah",        emirateAr:"إمارة الفجيرة",    emirateEn:"Fujairah",        lat:25.1288, lng:56.3265, zoneType:"main",     price:30, coverage:10 },
  { id:"alain",     nameAr:"العين",             nameEn:"Al Ain",          emirateAr:"إمارة أبوظبي",    emirateEn:"Abu Dhabi",       lat:24.2075, lng:55.7447, zoneType:"extended", price:50, coverage:18 },
  { id:"western",   nameAr:"المنطقة الغربية",   nameEn:"Western Region",  emirateAr:"إمارة أبوظبي",    emirateEn:"Abu Dhabi",       lat:23.7,    lng:51.6,    zoneType:"extended", price:50, coverage:12 },
];

const HUB = UAE_CITIES[0];

function MapController({ city }: { city: City }) {
  const map = useMap();
  useEffect(() => {
    const zoom = city.id === "western" ? 7 : city.id === "abudhabi" ? 8 : 10;
    map.flyTo([city.lat, city.lng], zoom, { duration: 1.2, easeLinearity: 0.5 });
  }, [city.id]);
  return null;
}

function getMarkerColor(city: City): string {
  if (city.isHub) return "#F6C94A";
  if (city.zoneType === "extended") return "#00CFFF";
  return "#2196F3";
}

export default function UAEInteractiveMap() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [selectedCity, setSelectedCity] = useState<City>(HUB);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const style = document.createElement("style");
    style.id = "dn-map-styles";
    style.innerHTML = `
      .leaflet-dn-tooltip {
        background: rgba(7,26,51,0.95) !important;
        border: 1px solid rgba(212,175,55,0.4) !important;
        border-radius: 8px !important;
        padding: 4px 10px !important;
        color: #fff !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
        white-space: nowrap !important;
      }
      .leaflet-dn-tooltip::before { display: none !important; }
      .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.12) !important; border-radius: 10px !important; overflow: hidden !important; }
      .leaflet-control-zoom a { background: rgba(7,26,51,0.9) !important; color: rgba(255,255,255,0.7) !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
      .leaflet-control-zoom a:hover { background: rgba(212,175,55,0.2) !important; color: #F6C94A !important; }
      .leaflet-container { outline: none; }
    `;
    if (!document.getElementById("dn-map-styles")) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById("dn-map-styles");
      if (el) el.remove();
    };
  }, []);

  const selectedColor = getMarkerColor(selectedCity);

  const infoPanel = (
    <div
      style={{
        position: "absolute",
        top: 16,
        [isArabic ? "right" : "left"]: 16,
        zIndex: 1000,
        width: 220,
        background: "rgba(5,20,40,0.94)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${selectedColor}40`,
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        transition: "border-color 0.3s ease",
      }}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:selectedColor, boxShadow:`0 0 8px ${selectedColor}` }} />
        <span style={{ fontSize:10, fontWeight:700, color:"#D4AF37", letterSpacing:"0.08em", textTransform:"uppercase" }}>
          {isArabic ? selectedCity.emirateAr : selectedCity.emirateEn}
        </span>
      </div>

      <h3 style={{ fontSize:22, fontWeight:900, color:"#FFFFFF", marginBottom:4, lineHeight:1.1 }}>
        {isArabic ? selectedCity.nameAr : selectedCity.nameEn}
      </h3>
      <p style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:14 }}>
        {selectedCity.isHub
          ? (isArabic ? "• المقر الرئيسي" : "• HQ & Dispatch Hub")
          : selectedCity.zoneType === "main"
            ? (isArabic ? "• منطقة رئيسية" : "• Main Zone")
            : (isArabic ? "• منطقة موسعة" : "• Extended Zone")}
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <div style={{ textAlign:"center", padding:"10px 6px", background:"rgba(255,255,255,0.05)", borderRadius:10, border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#F6C94A", lineHeight:1 }}>{selectedCity.price}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:3, letterSpacing:"0.06em" }}>
            {isArabic ? "درهم شهري" : "AED FLAT"}
          </div>
        </div>
        <div style={{ textAlign:"center", padding:"10px 6px", background:"rgba(255,255,255,0.05)", borderRadius:10, border:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#2196F3", lineHeight:1 }}>{selectedCity.coverage}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:3, letterSpacing:"0.06em" }}>
            {isArabic ? "منطقة تغطية" : "ZONES"}
          </div>
        </div>
      </div>

      <div style={{ padding:"8px 10px", background:`${selectedColor}0D`, borderRadius:8, border:`1px solid ${selectedColor}25`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>
          {isArabic ? "نوع المنطقة" : "Zone type"}
        </span>
        <span style={{ fontSize:10, fontWeight:700, color:selectedColor }}>
          {selectedCity.zoneType === "main" ? (isArabic ? "رئيسية" : "Main") : (isArabic ? "موسعة" : "Extended")}
        </span>
      </div>

      {selectedCity.isHub && (
        <div style={{ padding:"8px 10px", borderRadius:8, background:"rgba(33,150,243,0.08)", border:"1px solid rgba(33,150,243,0.2)", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>
            {isArabic ? "مسارات يومية" : "Daily routes"}
          </span>
          <span style={{ fontSize:10, fontWeight:700, color:"#2196F3" }}>23+</span>
        </div>
      )}
    </div>
  );

  const liveBadge = (
    <div
      style={{
        position: "absolute",
        top: 16,
        [isArabic ? "left" : "right"]: 16,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        background: "rgba(5,20,40,0.9)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
      }}
    >
      <div style={{ width:7, height:7, borderRadius:"50%", background:"#25D366", boxShadow:"0 0 6px #25D366", animation:"none" }} />
      <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.8)", letterSpacing:"0.1em" }}>
        {isArabic ? "مباشر" : "LIVE"}
      </span>
    </div>
  );

  if (!mounted) {
    return (
      <section className="relative py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl border border-white/10 flex items-center justify-center" style={{ height:520, background:"rgba(5,20,40,0.8)" }}>
            <div className="text-white/40 text-sm">{isArabic ? "جاري تحميل الخريطة..." : "Loading map..."}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-16 px-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="text-center mb-10 max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold text-xs font-bold uppercase tracking-widest mb-4">
          <Navigation className="w-3.5 h-3.5" />
          {isArabic ? "خريطة التغطية – الإمارات" : "Coverage Map – UAE"}
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
          {isArabic ? "نقاط تشغيل نشطة عبر الإمارات" : "Active Operations Across UAE"}
        </h2>
        <p className="text-white/60 max-w-xl mx-auto text-sm">
          {isArabic
            ? "اختر أي مدينة أو منطقة لمعرفة التسعير والتغطية الفعلية."
            : "Select any city or area to see live pricing and coverage details."}
        </p>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden" style={{ height:520, border:"1px solid rgba(255,255,255,0.1)" }}>
          <MapContainer
            center={[24.5, 54.5]}
            zoom={7}
            className="w-full h-full"
            zoomControl={true}
            attributionControl={false}
            style={{ background:"#050f1a" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />

            <MapController city={selectedCity} />

            {UAE_CITIES.filter(c => !c.isHub).map(city => (
              <Polyline
                key={`route-${city.id}`}
                positions={[[HUB.lat, HUB.lng], [city.lat, city.lng]]}
                pathOptions={{
                  color: city.id === selectedCity.id ? "#F6C94A" : (city.zoneType === "extended" ? "#00CFFF" : "#2196F3"),
                  weight: city.id === selectedCity.id ? 2 : 1,
                  opacity: city.id === selectedCity.id ? 0.75 : 0.25,
                  dashArray: "5 8",
                }}
              />
            ))}

            {UAE_CITIES.map(city => {
              const isSelected = city.id === selectedCity.id;
              const color = getMarkerColor(city);
              const radius = city.isHub ? 11 : isSelected ? 9 : 6;
              return (
                <CircleMarker
                  key={city.id}
                  center={[city.lat, city.lng]}
                  radius={radius}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.95,
                    color: (isSelected || city.isHub) ? "rgba(255,255,255,0.9)" : "transparent",
                    weight: 2,
                  }}
                  eventHandlers={{ click: () => setSelectedCity(city) }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -(radius + 3)]}
                    opacity={1}
                    className="leaflet-dn-tooltip"
                    permanent={city.isHub}
                  >
                    {isArabic ? city.nameAr : city.nameEn}
                  </Tooltip>
                </CircleMarker>
              );
            })}

            <CircleMarker
              center={[HUB.lat, HUB.lng]}
              radius={20}
              pathOptions={{ fillColor:"transparent", color:"#F6C94A", weight:1, opacity:0.2, dashArray:"3 7" }}
              interactive={false}
            />
          </MapContainer>

          {infoPanel}
          {liveBadge}
        </div>

        <div className="overflow-x-auto mt-3 pb-1" style={{ scrollbarWidth:"none" }}>
          <div className="flex gap-2 px-0.5" style={{ minWidth:"max-content" }}>
            {UAE_CITIES.map(city => {
              const isActive = city.id === selectedCity.id;
              const color = getMarkerColor(city);
              return (
                <button
                  key={city.id}
                  onClick={() => setSelectedCity(city)}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"7px 14px", borderRadius:12,
                    fontSize:12, fontWeight: isActive ? 700 : 500,
                    cursor:"pointer", whiteSpace:"nowrap",
                    border:`1px solid ${isActive ? color : "rgba(255,255,255,0.1)"}`,
                    background: isActive ? `${color}1A` : "rgba(255,255,255,0.04)",
                    color: isActive ? color : "rgba(255,255,255,0.5)",
                    transition:"all 0.2s ease",
                  }}
                >
                  <span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }} />
                  {isArabic ? city.nameAr : city.nameEn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { icon: MapPin,    labelAr:"إمارات مغطاة",        labelEn:"Emirates covered",   value:"7+" },
            { icon: Truck,     labelAr:"توصيل يومي",           labelEn:"Daily deliveries",   value:"23+" },
            { icon: Package,   labelAr:"سعر المدن الرئيسية",   labelEn:"Main city flat rate", value:"30 AED" },
            { icon: Clock,     labelAr:"خدمة مستمرة",          labelEn:"Non-stop service",   value:"24/7" },
          ].map(({ icon:Icon, labelAr, labelEn, value }) => (
            <div
              key={labelEn}
              className="flex items-center gap-3"
              style={{ padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}
            >
              <Icon className="w-4 h-4 text-brand-gold shrink-0" />
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"#F6C94A" }}>{value}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{isArabic ? labelAr : labelEn}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#F6C94A", boxShadow:"0 0 6px #F6C94A" }} />
            <span className="text-xs text-white/50">{isArabic ? "مركز التوزيع" : "Dispatch Hub"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#2196F3", boxShadow:"0 0 6px #2196F3" }} />
            <span className="text-xs text-white/50">{isArabic ? "منطقة رئيسية – 30 درهم" : "Main zone – 30 AED"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#00CFFF", boxShadow:"0 0 6px #00CFFF" }} />
            <span className="text-xs text-white/50">{isArabic ? "منطقة موسعة – 50 درهم" : "Extended zone – 50 AED"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-brand-gold" />
            <span className="text-xs text-white/50">{isArabic ? "انقر على أي مدينة" : "Click any city"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
