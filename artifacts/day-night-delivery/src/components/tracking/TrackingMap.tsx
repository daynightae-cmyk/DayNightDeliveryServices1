import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Crosshair, Flag, Layers, Navigation, Radio, X } from "lucide-react";
import { defaultLocations } from "../../data/defaultLocations";
import { translations } from "../../data/translations";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";
import type { Order } from "../../types";
import DayNightVehicleMarker from "../maps/DayNightVehicleMarker";
import { calculateBearing } from "../maps/VehicleAnimations";

type LatLngTuple = [number, number];
type MapMode = "standard" | "satellite" | "terrain";

type DevicePosition = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
};

type TrackingMapProps = {
  order?: Order | null;
  navigationMode?: boolean;
  devicePosition?: DevicePosition | null;
  onExitNavigation?: () => void;
};

type LiveDriverLocation = {
  driver_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  last_seen_at?: string | null;
  updated_at?: string | null;
};

type CityPoint = { labelEn: string; labelAr: string; lat: number; lng: number };
type RouteSummary = { distanceMeters: number; durationSeconds: number };

const cityPoints: Record<string, CityPoint> = {
  "abu dhabi": defaultLocations.abuDhabi,
  "أبوظبي": defaultLocations.abuDhabi,
  "ابوظبي": defaultLocations.abuDhabi,
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
  "al ain": defaultLocations.alAin,
  "العين": defaultLocations.alAin,
};

const pickupIcon = L.divIcon({
  className: "dn-live-map-marker dn-live-map-marker-pickup",
  html: '<div class="dn-marker-core"><span></span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: "dn-live-map-marker dn-live-map-marker-dest",
  html: '<div class="dn-marker-core"><span></span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function normalizeStatus(value?: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function recordOf(order?: Order | null) {
  return (order || {}) as Order & Record<string, unknown>;
}

function getString(order: Order | null | undefined, keys: string[]) {
  const row = recordOf(order);
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function getNumeric(order: Order | null | undefined, keys: string[]) {
  const row = recordOf(order);
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolvePoint(city: string, fallback: CityPoint) {
  const key = city.trim().toLowerCase();
  if (cityPoints[key]) return cityPoints[key];
  const match = Object.entries(cityPoints).find(([candidate]) => key.includes(candidate) || candidate.includes(key));
  return match?.[1] || fallback;
}

function locationPosition(location: LiveDriverLocation | null): LatLngTuple | null {
  if (!location) return null;
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function isNativeDriverShell() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("nativeShell") === "driver" || document.documentElement.dataset.nativeShell === "driver";
}

function formatDistance(meters: number, isArabic: boolean) {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  return meters < 1000 ? `${Math.round(meters)} ${isArabic ? "م" : "m"}` : `${(meters / 1000).toFixed(1)} ${isArabic ? "كم" : "km"}`;
}

function formatDuration(seconds: number, isArabic: boolean) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} ${isArabic ? "دقيقة" : "min"}`;
}

function MapViewport({ points, currentPosition, follow }: { points: LatLngTuple[]; currentPosition: LatLngTuple | null; follow: boolean }) {
  const map = useMap();
  const signature = points.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");

  useEffect(() => {
    const refresh = () => map.invalidateSize({ pan: false });
    const timers = [0, 120, 420, 1000].map((delay) => window.setTimeout(refresh, delay));
    const container = map.getContainer();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refresh) : null;
    observer?.observe(container);
    if (container.parentElement) observer?.observe(container.parentElement);
    window.addEventListener("resize", refresh, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      window.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [map]);

  useEffect(() => {
    map.invalidateSize({ pan: false });
    if (follow && currentPosition) {
      map.setView(currentPosition, Math.max(16, map.getZoom()), { animate: true });
      return;
    }
    if (points.length === 1) map.setView(points[0], 15, { animate: true });
    else if (points.length > 1) map.fitBounds(points, { padding: [42, 42], maxZoom: 16, animate: true });
  }, [currentPosition?.[0], currentPosition?.[1], follow, map, signature]);

  return null;
}

export default function TrackingMap({ order, navigationMode = false, devicePosition, onExitNavigation }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const isArabic = language === "ar";
  const nativeDriver = isNativeDriverShell();
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [liveLocation, setLiveLocation] = useState<LiveDriverLocation | null>(null);
  const [nativePosition, setNativePosition] = useState<DevicePosition | null>(null);
  const [nativeGpsError, setNativeGpsError] = useState("");
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>(nativeDriver ? "standard" : "satellite");
  const [tileFailed, setTileFailed] = useState(false);
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [followDriver, setFollowDriver] = useState(navigationMode || nativeDriver);
  const routeRequestRef = useRef(0);

  useEffect(() => setFollowDriver(navigationMode || nativeDriver), [nativeDriver, navigationMode]);

  useEffect(() => {
    if (!nativeDriver || devicePosition || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setNativePosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
        });
        setLastLiveAt(new Date());
        setNativeGpsError("");
      },
      (error) => setNativeGpsError(error.message || (isArabic ? "تعذر قراءة موقع الهاتف" : "Unable to read phone location")),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 25_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [devicePosition, isArabic, nativeDriver]);

  const activeOrder = liveOrder || order || null;
  const orderId = getString(activeOrder, ["id"]);
  const driverId = getString(activeOrder, ["driver_id", "assigned_driver_id", "courier_id"]);
  const status = normalizeStatus(getString(activeOrder, ["status"]));
  const isOutForDelivery = ["in_transit", "out_for_delivery"].includes(status);

  useEffect(() => {
    setLiveOrder(null);
    if (!supabase || !orderId) return;
    const channel = supabase
      .channel(`tracking-order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => {
        setLiveOrder(payload.new as Order);
      })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !orderId || (!isOutForDelivery && !navigationMode && !nativeDriver)) return;
    const loadLocation = async () => {
      const { data, error } = await supabase.rpc("tracking_live_driver_location", { p_order_id: orderId });
      if (cancelled || error || !data) return;
      const payload = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
      const location = (payload.location || payload) as LiveDriverLocation;
      if (locationPosition(location)) {
        setLiveLocation(location);
        setLastLiveAt(new Date());
      }
    };
    void loadLocation();
    const timer = window.setInterval(() => void loadLocation(), 12_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isOutForDelivery, nativeDriver, navigationMode, orderId]);

  useEffect(() => {
    if (!supabase || !driverId || (!isOutForDelivery && !navigationMode && !nativeDriver)) return;
    const channel = supabase
      .channel(`tracking-driver-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` }, (payload) => {
        const location = payload.new as LiveDriverLocation;
        if (locationPosition(location)) {
          setLiveLocation(location);
          setLastLiveAt(new Date());
        }
      })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [driverId, isOutForDelivery, nativeDriver, navigationMode]);

  const pickupCity = getString(activeOrder, ["sender_city", "pickup_city", "origin_city"]) || "Mussafah";
  const destinationCity = getString(activeOrder, ["receiver_city", "delivery_city", "destination_city"]) || "Abu Dhabi";
  const pickup = resolvePoint(pickupCity, defaultLocations.mussafah);
  const destination = resolvePoint(destinationCity, defaultLocations.abuDhabi);
  const pickupPos: LatLngTuple = [
    getNumeric(activeOrder, ["pickup_lat", "sender_lat", "origin_lat"]) ?? pickup.lat,
    getNumeric(activeOrder, ["pickup_lng", "sender_lng", "origin_lng"]) ?? pickup.lng,
  ];
  const destinationPos: LatLngTuple = [
    getNumeric(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat"]) ?? destination.lat,
    getNumeric(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng"]) ?? destination.lng,
  ];

  const resolvedDevicePosition = devicePosition || nativePosition;
  const deviceLat = Number(resolvedDevicePosition?.latitude);
  const deviceLng = Number(resolvedDevicePosition?.longitude);
  const devicePos: LatLngTuple | null = Number.isFinite(deviceLat) && Number.isFinite(deviceLng) ? [deviceLat, deviceLng] : null;
  const databaseDriverPos = locationPosition(liveLocation);
  const driverPos = devicePos || databaseDriverPos;
  const hasOrder = Boolean(activeOrder && (orderId || pickupCity || destinationCity));
  const headingToPickup = !["picked_up", "in_transit", "out_for_delivery", "delivered", "returned", "cancelled"].includes(status);
  const routeTarget = headingToPickup ? pickupPos : destinationPos;
  const routeStart = driverPos || pickupPos;

  const routeWaypoints = useMemo(() => {
    if (!hasOrder) return "";
    return [routeStart, routeTarget].map(([lat, lng]) => `${lng},${lat}`).join(";");
  }, [hasOrder, routeStart[0], routeStart[1], routeTarget[0], routeTarget[1]]);

  useEffect(() => {
    const requestId = routeRequestRef.current + 1;
    routeRequestRef.current = requestId;
    if (!routeWaypoints) {
      setRoutePoints([]);
      setRouteSummary(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    const loadRoute = async () => {
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`, { signal: controller.signal });
        if (!response.ok) throw new Error(`route_${response.status}`);
        const payload = await response.json();
        const route = payload?.routes?.[0];
        const coordinates = route?.geometry?.coordinates;
        if (requestId === routeRequestRef.current && Array.isArray(coordinates) && coordinates.length > 1) {
          setRoutePoints(coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple));
          setRouteSummary({ distanceMeters: Number(route.distance || 0), durationSeconds: Number(route.duration || 0) });
          return;
        }
      } catch {
        // A real straight-line fallback keeps the mission usable if OSRM is temporarily unavailable.
      } finally {
        window.clearTimeout(timeout);
      }
      if (requestId === routeRequestRef.current) {
        setRoutePoints([routeStart, routeTarget]);
        setRouteSummary(null);
      }
    };
    void loadRoute();
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [routeWaypoints, routeStart[0], routeStart[1], routeTarget[0], routeTarget[1]]);

  const mapPoints = hasOrder
    ? [routeStart, routeTarget, ...(driverPos ? [driverPos] : [])]
    : [driverPos || defaultLocations.abuDhabi].map((point) => Array.isArray(point) ? point as LatLngTuple : [point.lat, point.lng] as LatLngTuple);
  const center = driverPos || pickupPos;
  const suppliedHeading = Number(resolvedDevicePosition?.heading ?? liveLocation?.heading);
  const bearing = Number.isFinite(suppliedHeading) && suppliedHeading >= 0 ? suppliedHeading : calculateBearing(routeStart, routeTarget);
  const reference = getString(activeOrder, ["tracking_code", "tracking_number", "invoice_number", "id"]) || "DAY NIGHT";
  const lastLiveLabel = lastLiveAt ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : "—";

  const tileHandlers = { tileerror: () => { setTileFailed(true); setMapMode("standard"); } };
  const renderBaseLayer = () => {
    if (tileFailed || mapMode === "standard") return <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} />;
    if (mapMode === "terrain") return <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data &copy; OpenStreetMap contributors, SRTM" eventHandlers={tileHandlers} />;
    return <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} />;
  };

  return (
    <div className={`dn-live-map-shell dn-satellite-map relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-brand-gold/20 bg-[#020812] ${navigationMode ? "dn-live-map-navigation" : ""}`} data-driver-map-ready={driverPos ? "live" : "waiting"}>
      <div className="absolute left-3 right-3 top-3 z-[650] flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 shadow-xl backdrop-blur-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            {navigationMode ? <Navigation className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
            {driverPos
              ? (isArabic ? "موقع المندوب مباشر داخل التطبيق" : "Live driver position inside the app")
              : (isArabic ? "بانتظار أول قراءة GPS" : "Waiting for the first GPS reading")}
          </p>
          <p className="mt-1 text-[10px] font-bold text-white/60">
            {reference} · {lastLiveLabel}{routeSummary ? ` · ${formatDistance(routeSummary.distanceMeters, isArabic)} · ${formatDuration(routeSummary.durationSeconds, isArabic)}` : ""}
          </p>
          {nativeGpsError && <p className="mt-1 text-[10px] font-bold text-red-200">{nativeGpsError}</p>}
        </div>
        {navigationMode && (
          <div className="flex items-center gap-2">
            <button type="button" className={followDriver ? "is-active" : ""} onClick={() => setFollowDriver((value) => !value)} title={isArabic ? "تتبع السيارة" : "Follow vehicle"}><Crosshair /></button>
            {onExitNavigation && <button type="button" onClick={onExitNavigation} title={isArabic ? "إغلاق الملاحة" : "Close navigation"}><X /></button>}
          </div>
        )}
      </div>

      <div className={`absolute right-3 z-[650] flex items-center gap-1 rounded-2xl border border-white/10 bg-[#071A33]/86 p-1 text-[10px] font-black text-white/70 backdrop-blur-xl ${navigationMode ? "top-28" : "top-24"}`} dir={isArabic ? "rtl" : "ltr"}>
        <Layers className="mx-1 h-3.5 w-3.5 text-brand-gold" />
        {([[
          "standard", isArabic ? "عادي" : "Standard",
        ], ["satellite", isArabic ? "ساتلايت" : "Satellite"], ["terrain", isArabic ? "تضاريس" : "Terrain"]] as [MapMode, string][]).map(([mode, label]) => (
          <button key={mode} type="button" onClick={() => { setTileFailed(false); setMapMode(mode); }} className={`rounded-full px-2.5 py-1 ${mapMode === mode ? "bg-brand-gold text-brand-deep" : "hover:bg-white/10"}`}>{label}</button>
        ))}
      </div>

      <MapContainer key={mapMode} center={center} zoom={navigationMode ? 16 : 13} style={{ height: "100%", minHeight: 360, width: "100%" }} scrollWheelZoom={navigationMode} zoomControl preferCanvas>
        {renderBaseLayer()}
        <MapViewport points={mapPoints} currentPosition={driverPos} follow={followDriver && Boolean(driverPos)} />
        {hasOrder && <Polyline positions={routePoints.length ? routePoints : [routeStart, routeTarget]} pathOptions={{ color: "#D4AF37", weight: navigationMode ? 8 : 6, opacity: 0.94 }} />}
        {hasOrder && <Marker position={pickupPos} icon={pickupIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-blue uppercase">{t.pickupPoint}</p><p>{getString(activeOrder, ["sender_address", "pickup_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn)}</p></div></Popup></Marker>}
        {driverPos && <DayNightVehicleMarker position={driverPos} bearing={bearing} state="driving" navigationMode={navigationMode} label={isArabic ? "الموقع الحالي للمندوب" : "Current driver location"}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-gold">DAY NIGHT</p><p>{isArabic ? "موقع الهاتف الحالي متصل بمركز العمليات" : "The phone's current position is connected to operations"}</p></div></Popup></DayNightVehicleMarker>}
        {hasOrder && <Marker position={destinationPos} icon={destinationIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-gold uppercase"><Flag className="mr-1 inline h-3 w-3" />{t.destinationPoint}</p><p>{getString(activeOrder, ["receiver_address", "delivery_address"]) || (isArabic ? destination.labelAr : destination.labelEn)}</p></div></Popup></Marker>}
      </MapContainer>
    </div>
  );
}
