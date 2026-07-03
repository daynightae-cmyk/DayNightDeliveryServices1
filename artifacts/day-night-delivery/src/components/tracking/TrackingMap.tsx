import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { defaultLocations } from "../../data/defaultLocations";
import { useAppContext } from "../../lib/AppContext";
import { translations } from "../../data/translations";
import type { Order } from "../../types";
import { MapPin, Navigation, Radio, Route, Satellite, Truck } from "lucide-react";
import { supabase } from "../../supabase";

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
  "ابوظبي": defaultLocations.abuDhabi,
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
  iconSize: [44, 44],
  iconAnchor: [22, 22],
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
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function interpolate(a: LatLngTuple, b: LatLngTuple, t: number): LatLngTuple {
  return [Number((a[0] + (b[0] - a[0]) * t).toFixed(6)), Number((a[1] + (b[1] - a[1]) * t).toFixed(6))];
}

function progressFromStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value.includes("deliver")) return 0.92;
  if (value.includes("out")) return 0.74;
  if (value.includes("transit") || value.includes("route")) return 0.58;
  if (value.includes("pickup") || value.includes("picked")) return 0.34;
  if (value.includes("assign") || value.includes("confirm")) return 0.18;
  return 0.12;
}

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (validPoints.length < 2) return;
    map.fitBounds(validPoints, { padding: [36, 36], maxZoom: 12, animate: true });
  }, [map, points]);
  return null;
}

export default function TrackingMap({ order }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const [isMounted, setIsMounted] = useState(false);
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const isArabic = language === "ar";

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    setLiveOrder(null);
    setLastLiveAt(null);
    if (!supabase || !order?.id) return;

    const channel = supabase
      .channel(`dn-live-order-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          setLiveOrder(payload.new as Order);
          setLastLiveAt(new Date());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id]);

  const activeOrder = liveOrder || order || null;
  const pickup = resolvePoint(activeOrder?.sender_city, defaultLocations.mussafah);
  const destination = resolvePoint(activeOrder?.receiver_city, defaultLocations.abuDhabi);

  const pickupLat = getNumeric(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat;
  const pickupLng = getNumeric(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng;
  const destLat = getNumeric(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat;
  const destLng = getNumeric(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng;
  const driverLat = getNumeric(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getNumeric(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);

  const pickupPos: LatLngTuple = [pickupLat, pickupLng];
  const destPos: LatLngTuple = [destLat, destLng];
  const hasLiveDriver = driverLat !== null && driverLng !== null;
  const driverPos: LatLngTuple = hasLiveDriver ? [driverLat, driverLng] : interpolate(pickupPos, destPos, progressFromStatus(activeOrder?.status));
  const fitPoints = [pickupPos, driverPos, destPos];

  const routeWaypoints = useMemo(() => {
    const points = hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos];
    return points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  }, [hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1]]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function fetchRoadRoute() {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`;
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
      if (!cancelled) setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
    }
    fetchRoadRoute();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeWaypoints, hasLiveDriver]);

  if (!isMounted) return <div className="h-full min-h-72 bg-brand-deep rounded-2xl animate-pulse" />;

  const liveLabel = hasLiveDriver
    ? (isArabic ? "إحداثيات المندوب مباشرة" : "Live courier coordinates")
    : (isArabic ? "مسار فعلي حسب بيانات الطلب" : "Road route from order data");
  const lastLiveLabel = lastLiveAt
    ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="dn-live-map-shell dn-satellite-map h-full w-full overflow-hidden rounded-2xl border border-brand-gold/20 relative">
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[410] flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 backdrop-blur-xl shadow-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {liveLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/60">
            <Satellite className="h-3 w-3 text-brand-sky" />
            {isArabic ? "خريطة طرق وساتلايت" : "Satellite + road routing"}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-black text-white/70 backdrop-blur-xl">
          {activeOrder?.status || (isArabic ? "قيد المعالجة" : "Processing")} • {lastLiveLabel}
        </div>
      </div>

      <MapContainer center={driverPos} zoom={9} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        <FitBounds points={fitPoints} />
        <Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.92 }} />
        <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2.4, opacity: 0.76, dashArray: "10 12" }} />
        {routePoints.length > 2 && routePoints.filter((_, index) => index % Math.max(1, Math.floor(routePoints.length / 12)) === 0).map((point, index) => (
          <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />
        ))}

        <Marker position={pickupPos} icon={pickupIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-blue uppercase">{t.pickupPoint}</p>
              <p>{activeOrder?.sender_address || (isArabic ? pickup.labelAr : pickup.labelEn)}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={driverPos} icon={driverIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">DAY NIGHT</p>
              <p>{hasLiveDriver ? (isArabic ? "موقع المندوب المباشر" : "Live courier location") : (isArabic ? "مؤشر تشغيلي حسب حالة الطلب" : "Operational route indicator by status")}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={destPos} icon={destinationIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">{t.destinationPoint}</p>
              <p>{activeOrder?.receiver_address || (isArabic ? destination.labelAr : destination.labelEn)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[410] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[10px] font-bold text-white/65 backdrop-blur-xl">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار طرق فعلي" : "Real road route"}</span>
        <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-brand-sky" />{hasLiveDriver ? (isArabic ? "مباشر" : "Live") : (isArabic ? "تشغيلي" : "Ops")}</span>
        <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}
