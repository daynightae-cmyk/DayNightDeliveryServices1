import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layers, MapPin, Navigation, Radio, Route, Satellite, Truck } from "lucide-react";
import { defaultLocations } from "../../data/defaultLocations";
import { translations } from "../../data/translations";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";
import type { Order } from "../../types";

type LatLngTuple = [number, number];
type MapMode = "standard" | "satellite" | "terrain";

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
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function asRecord(order: Order | null | undefined) {
  return (order || {}) as Record<string, unknown>;
}

function getString(order: Order | null | undefined, keys: string[]) {
  const source = asRecord(order);
  for (const key of keys) {
    const raw = source[key];
    if (raw !== null && raw !== undefined && String(raw).trim()) return String(raw).trim();
  }
  return "";
}

function getNumeric(order: Order | null | undefined, keys: string[]) {
  const source = asRecord(order);
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolvePoint(city?: string | null, fallback?: CityPoint): CityPoint {
  const raw = normalizeKey(city);
  if (cityPoints[raw]) return cityPoints[raw];
  const loose = Object.entries(cityPoints).find(([key]) => raw.includes(key) || (raw.length > 2 && key.includes(raw)));
  return loose?.[1] || fallback || defaultLocations.abuDhabi;
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
    map.fitBounds(validPoints, { padding: [42, 42], maxZoom: 13, animate: true });
  }, [map, points]);
  return null;
}

export default function TrackingMap({ order }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const isArabic = language === "ar";
  const [isMounted, setIsMounted] = useState(false);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    setLiveOrder(null);
    setLastLiveAt(null);
    setTileFailed(false);
    if (!supabase || !order?.id) return;
    const supabaseClient = supabase;
    const orderChannel = supabaseClient
      .channel(`dn-live-order-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        setLiveOrder(payload.new as Order);
        setLastLiveAt(new Date());
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(orderChannel);
    };
  }, [order?.id]);

  const activeOrder = liveOrder || order || null;
  const driverId = getString(activeOrder, ["driver_id", "assigned_driver_id", "courier_id"]);

  useEffect(() => {
    if (!supabase || !driverId) return;
    const supabaseClient = supabase;
    const driverChannel = supabaseClient
      .channel(`dn-live-driver-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` }, (payload) => {
        const location = payload.new as Record<string, unknown>;
        setLiveOrder((current) => ({
          ...((current || activeOrder || {}) as Order),
          driver_lat: location.lat ?? location.latitude ?? location.driver_lat,
          driver_lng: location.lng ?? location.longitude ?? location.driver_lng,
        } as Order));
        setLastLiveAt(new Date());
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(driverChannel);
    };
  }, [driverId]);

  const pickupCity = getString(activeOrder, ["sender_city", "pickup_city", "origin_city", "from_city"]) || "Mussafah";
  const destinationCity = getString(activeOrder, ["receiver_city", "delivery_city", "destination_city", "to_city"]) || "Abu Dhabi";
  const pickup = resolvePoint(pickupCity, defaultLocations.mussafah);
  const destination = resolvePoint(destinationCity, defaultLocations.abuDhabi);

  const pickupPos: LatLngTuple = [
    getNumeric(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat,
    getNumeric(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng,
  ];
  const destPos: LatLngTuple = [
    getNumeric(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat,
    getNumeric(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng,
  ];

  const driverLat = getNumeric(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getNumeric(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);
  const hasLiveDriver = driverLat !== null && driverLng !== null;
  const driverPos: LatLngTuple = hasLiveDriver && driverLat !== null && driverLng !== null ? [driverLat, driverLng] : interpolate(pickupPos, destPos, progressFromStatus(getString(activeOrder, ["status"])));
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
        // Use a real map with straight-line route fallback if OSRM is temporarily unavailable.
      }
      if (!cancelled) setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]);
    }

    fetchRoadRoute();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeWaypoints, hasLiveDriver]);

  if (!isMounted) return <div className="h-full min-h-72 rounded-2xl bg-brand-deep animate-pulse" />;

  const status = getString(activeOrder, ["status"]) || (isArabic ? "قيد المعالجة" : "Processing");
  const reference = getString(activeOrder, ["tracking_code", "tracking_number", "invoice_number", "coupon_number", "id"]) || "DAY NIGHT";
  const liveLabel = hasLiveDriver ? (isArabic ? "خريطة حقيقية — موقع المندوب مباشر" : "Real map — live courier position") : (isArabic ? "خريطة حقيقية — مسار الإمارات" : "Real map — UAE shipment route");
  const lastLiveLabel = lastLiveAt ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : "—";

  const mapModes: { mode: MapMode; label: string; labelAr: string }[] = [
    { mode: "standard", label: "Standard", labelAr: "عادي" },
    { mode: "satellite", label: "Satellite", labelAr: "ساتلايت" },
    { mode: "terrain", label: "Terrain", labelAr: "تضاريس" },
  ];

  const tileHandlers = {
    tileerror: () => setTileFailed(true),
  };

  const renderBaseLayers = () => {
    if (tileFailed || mapMode === "standard") {
      return <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} />;
    }

    if (mapMode === "terrain") {
      return <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap" eventHandlers={tileHandlers} />;
    }

    return (
      <>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" eventHandlers={tileHandlers} />
      </>
    );
  };

  return (
    <div className="dn-live-map-shell dn-satellite-map relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-brand-gold/20 bg-[#020812]">
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[650] flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 shadow-xl backdrop-blur-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {liveLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/60">
            <Satellite className="h-3 w-3 text-brand-sky" />
            {tileFailed ? (isArabic ? "خريطة طرق احتياطية" : "Fallback road map") : (isArabic ? "طبقات خرائط حقيقية + توجيه طرق" : "Real map layers + road routing")}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-black text-white/70 backdrop-blur-xl" dir="ltr">
          {status} • {String(reference).slice(0, 22)} • {lastLiveLabel}
        </div>
      </div>

      <div className="absolute right-3 top-24 z-[650] flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-[#071A33]/86 p-1 text-[10px] font-black text-white/70 backdrop-blur-xl" dir={isArabic ? "rtl" : "ltr"}>
        <Layers className="mx-1 h-3.5 w-3.5 text-brand-gold" />
        {mapModes.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => {
              setTileFailed(false);
              setMapMode(item.mode);
            }}
            className={`rounded-full px-2.5 py-1 transition ${mapMode === item.mode ? "bg-brand-gold text-brand-deep" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          >
            {isArabic ? item.labelAr : item.label}
          </button>
        ))}
      </div>

      <MapContainer key={mapMode} center={driverPos} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl>
        {renderBaseLayers()}
        <FitBounds points={fitPoints} />
        <Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.92 }} />
        <Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2.4, opacity: 0.76, dashArray: "10 12" }} />
        {(routePoints.length ? routePoints : [pickupPos, driverPos, destPos]).filter((_, index) => index % Math.max(1, Math.floor((routePoints.length || 3) / 10)) === 0).map((point, index) => (
          <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />
        ))}

        <Marker position={pickupPos} icon={pickupIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-blue uppercase">{t.pickupPoint}</p>
              <p>{getString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn)}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={driverPos} icon={driverIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">DAY NIGHT</p>
              <p>{hasLiveDriver ? (isArabic ? "موقع المندوب المباشر" : "Live courier location") : (isArabic ? "موقع الشحنة التقديري" : "Estimated shipment position")}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={destPos} icon={destinationIcon}>
          <Popup>
            <div className={`text-xs font-bold font-sans ${isArabic ? "text-right" : "text-left"}`}>
              <p className="text-brand-gold uppercase">{t.destinationPoint}</p>
              <p>{getString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) || (isArabic ? destination.labelAr : destination.labelEn)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[650] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[10px] font-bold text-white/65 backdrop-blur-xl">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار خرائط حقيقي" : "Real map route"}</span>
        <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-brand-sky" />{hasLiveDriver ? (isArabic ? "مباشر" : "Live") : (isArabic ? "تقديري" : "Estimated")}</span>
        <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}
