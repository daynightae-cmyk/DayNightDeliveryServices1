import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { defaultLocations } from "../../data/defaultLocations";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import type { Order } from "../../types";
import { MapPin, Navigation, Radio, Route } from "lucide-react";

type LatLngTuple = [number, number];

type TrackingMapProps = {
  order?: Order | null;
};

type CityPoint = {
  labelEn: string;
  labelAr: string;
  lat: number;
  lng: number;
};

const cityPoints: Record<string, CityPoint> = {
  "abu dhabi": defaultLocations.abuDhabi,
  "أبوظبي": defaultLocations.abuDhabi,
  "abudhabi": defaultLocations.abuDhabi,
  "mussafah": defaultLocations.mussafah,
  "مصفح": defaultLocations.mussafah,
  "dubai": defaultLocations.dubai,
  "دبي": defaultLocations.dubai,
  "sharjah": defaultLocations.sharjah,
  "الشارقة": defaultLocations.sharjah,
  "ajman": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136 },
  "عجمان": { labelEn: "Ajman", labelAr: "عجمان", lat: 25.4052, lng: 55.5136 },
  "umm al quwain": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552 },
  "أم القيوين": { labelEn: "Umm Al Quwain", labelAr: "أم القيوين", lat: 25.5647, lng: 55.5552 },
  "ras al khaimah": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762 },
  "رأس الخيمة": { labelEn: "Ras Al Khaimah", labelAr: "رأس الخيمة", lat: 25.8007, lng: 55.9762 },
  "fujairah": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265 },
  "الفجيرة": { labelEn: "Fujairah", labelAr: "الفجيرة", lat: 25.1288, lng: 56.3265 },
  "khorfakkan": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410 },
  "خورفكان": { labelEn: "Khorfakkan", labelAr: "خورفكان", lat: 25.3313, lng: 56.3410 },
  "al ain": defaultLocations.alAin,
  "العين": defaultLocations.alAin,
  "al dhafra": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052 },
  "الظفرة": { labelEn: "Al Dhafra", labelAr: "الظفرة", lat: 23.6574, lng: 53.7052 },
  "liwa": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726 },
  "ليوا": { labelEn: "Liwa", labelAr: "ليوا", lat: 23.1336, lng: 53.7726 },
  "ruwais": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306 },
  "الرويس": { labelEn: "Al Ruwais", labelAr: "الرويس", lat: 24.1103, lng: 52.7306 },
};

const pickupIcon = L.divIcon({
  className: "dn-live-map-marker dn-live-map-marker-pickup",
  html: `<div class="dn-marker-core"><span></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: "dn-live-map-marker dn-live-map-marker-dest",
  html: `<div class="dn-marker-core"><span></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const driverIcon = L.divIcon({
  className: "dn-live-map-driver",
  html: `<div class="dn-driver-pulse"><span>DN</span></div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function resolvePoint(city?: string | null, fallback?: CityPoint): CityPoint {
  const raw = normalizeKey(city);
  if (cityPoints[raw]) return cityPoints[raw];
  const loose = Object.entries(cityPoints).find(([key]) => raw.includes(key) || key.includes(raw));
  return loose?.[1] || fallback || defaultLocations.abuDhabi;
}

function getNumeric(order: Order | null | undefined, keys: string[]) {
  const source = order as unknown as Record<string, unknown> | null | undefined;
  if (!source) return null;
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function midpoint(a: LatLngTuple, b: LatLngTuple): LatLngTuple {
  return [Number(((a[0] + b[0]) / 2).toFixed(6)), Number(((a[1] + b[1]) / 2).toFixed(6))];
}

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points, { padding: [34, 34], maxZoom: 11, animate: true });
  }, [map, points]);
  return null;
}

export default function TrackingMap({ order }: TrackingMapProps) {
  const { language, theme } = useAppContext();
  const t = translations[language].trackingMap;
  const [isMounted, setIsMounted] = useState(false);
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const isArabic = language === "ar";
  const isLight = theme === "light";

  useEffect(() => setIsMounted(true), []);

  const pickup = resolvePoint(order?.sender_city, defaultLocations.mussafah);
  const destination = resolvePoint(order?.receiver_city, defaultLocations.abuDhabi);

  const pickupLat = getNumeric(order, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat;
  const pickupLng = getNumeric(order, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng;
  const destLat = getNumeric(order, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat;
  const destLng = getNumeric(order, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng;
  const driverLat = getNumeric(order, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getNumeric(order, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);

  const pickupPos: LatLngTuple = [pickupLat, pickupLng];
  const destPos: LatLngTuple = [destLat, destLng];
  const driverPos: LatLngTuple = driverLat && driverLng ? [driverLat, driverLng] : midpoint(pickupPos, destPos);
  const fitPoints = [pickupPos, driverPos, destPos];

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function fetchRoadRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupPos[1]},${pickupPos[0]};${destPos[1]},${destPos[0]}?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!cancelled && Array.isArray(coords) && coords.length > 1) {
          setRoutePoints(coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple));
          return;
        }
      } catch {
        // use fallback line if route service is unavailable
      }
      if (!cancelled) setRoutePoints([pickupPos, driverPos, destPos]);
    }
    fetchRoadRoute();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pickupPos[0], pickupPos[1], destPos[0], destPos[1]]);

  if (!isMounted) return <div className="h-full min-h-72 bg-brand-deep rounded-2xl animate-pulse" />;

  const tileUrl = isLight
    ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="dn-live-map-shell h-full w-full overflow-hidden rounded-2xl border border-brand-gold/20 relative">
      <div className="absolute left-3 right-3 top-3 z-[410] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/85 px-3 py-2 backdrop-blur-xl shadow-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {isArabic ? "خريطة طريق فعلية" : "Live road map"}
          </p>
          <p className="mt-0.5 text-[10px] font-bold text-white/55">
            {isArabic ? "مرتبطة ببيانات الطلب والمدن" : "Linked to order and route data"}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/80 px-3 py-2 text-[10px] font-black text-white/65 backdrop-blur-xl">
          {order?.status || (isArabic ? "قيد المعالجة" : "Processing")}
        </div>
      </div>

      <MapContainer center={driverPos} zoom={9} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl>
        <TileLayer url={tileUrl} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        <FitBounds points={fitPoints} />
        <Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 5, opacity: 0.88 }} />
        <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2, opacity: 0.72, dashArray: "10 12" }} />

        <Marker position={pickupPos} icon={pickupIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-blue uppercase">{t.pickupPoint}</p>
              <p>{order?.sender_address || (isArabic ? pickup.labelAr : pickup.labelEn)}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={driverPos} icon={driverIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">DAY NIGHT</p>
              <p>{isArabic ? "موقع المندوب التقريبي حسب حالة الطلب" : "Approximate courier position by order status"}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={destPos} icon={destinationIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">{t.destinationPoint}</p>
              <p>{order?.receiver_address || (isArabic ? destination.labelAr : destination.labelEn)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[410] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-bold text-white/60 backdrop-blur-xl">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار الطرق" : "Road route"}</span>
        <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}
