import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Crosshair, Flag, Layers, Loader2, Navigation, Radio, Route, X } from "lucide-react";
import { defaultLocations } from "../../data/defaultLocations";
import { translations } from "../../data/translations";
import { useAppContext } from "../../lib/AppContext";
import {
  fetchRealDrivingRoute,
  geocodeUaeAddress,
  isValidNavigationPoint,
  readCoordinatePair,
  snapPointToRoadRoute,
  type NavigationPoint,
  type RoadRoute,
} from "../../services/realDriverNavigationService";
import { supabase } from "../../supabase";
import type { Order } from "../../types";
import DayNightVehicleMarker from "../maps/DayNightVehicleMarker";
import { calculateBearing } from "../maps/VehicleAnimations";
import "../../styles/dn-real-driver-navigation.css";

type LatLngTuple = NavigationPoint;
type MapMode = "standard" | "satellite" | "terrain";
type RouteState = "idle" | "loading" | "ready" | "missing" | "error";
type DevicePosition = { latitude: number; longitude: number; heading?: number | null; speed?: number | null; accuracy?: number | null };
type TrackingMapProps = { order?: Order | null; navigationMode?: boolean; devicePosition?: DevicePosition | null; onExitNavigation?: () => void };
type LiveDriverLocation = {
  driver_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};
type CityPoint = { labelEn: string; labelAr: string; lat: number; lng: number };

type GeocodedPoints = {
  pickup: LatLngTuple | null;
  destination: LatLngTuple | null;
};

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
  "al ain": defaultLocations.alAin,
  "العين": defaultLocations.alAin,
};

const pickupIcon = L.divIcon({ className: "dn-live-map-marker dn-live-map-marker-pickup", html: '<div class="dn-marker-core"><span></span></div>', iconSize: [34, 34], iconAnchor: [17, 17] });
const destinationIcon = L.divIcon({ className: "dn-live-map-marker dn-live-map-marker-dest", html: '<div class="dn-marker-core"><span></span></div>', iconSize: [34, 34], iconAnchor: [17, 17] });

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

function resolvePoint(city: string, fallback: CityPoint) {
  const key = city.trim().toLowerCase();
  if (cityPoints[key]) return cityPoints[key];
  return Object.entries(cityPoints).find(([candidate]) => key.includes(candidate) || candidate.includes(key))?.[1] || fallback;
}

function toPosition(location: LiveDriverLocation | null): LatLngTuple | null {
  if (!location) return null;
  const point: LatLngTuple = [Number(location.lat ?? location.latitude), Number(location.lng ?? location.longitude)];
  return isValidNavigationPoint(point) ? point : null;
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
  return `${Math.max(1, Math.round(seconds / 60))} ${isArabic ? "دقيقة" : "min"}`;
}

function addressQuery(order: Order | null, side: "pickup" | "destination") {
  if (!order) return "";
  const values = side === "pickup"
    ? [getString(order, ["sender_address", "pickup_address"]), getString(order, ["sender_city", "pickup_city", "origin_city"])]
    : [getString(order, ["receiver_address", "delivery_address"]), getString(order, ["receiver_city", "delivery_city", "destination_city"])];
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.length ? `${unique.join(", ")}, United Arab Emirates` : "";
}

function routeRequestKey(start: LatLngTuple | null, destination: LatLngTuple | null) {
  if (!start || !destination) return "";
  return [...start, ...destination].map((value) => Number(value).toFixed(4)).join(":");
}

function MapViewport({ points, currentPosition, follow }: { points: LatLngTuple[]; currentPosition: LatLngTuple | null; follow: boolean }) {
  const map = useMap();
  const signature = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("|");

  useEffect(() => {
    const refresh = () => map.invalidateSize({ pan: false });
    const timers = [0, 150, 500, 1200].map((delay) => window.setTimeout(refresh, delay));
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
      map.setView(currentPosition, Math.max(17, map.getZoom()), { animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [52, 52], maxZoom: 17, animate: true });
    }
  }, [currentPosition?.[0], currentPosition?.[1], follow, map, signature]);

  return null;
}

export default function TrackingMap({ order, navigationMode = false, devicePosition, onExitNavigation }: TrackingMapProps) {
  const { language } = useAppContext();
  const t = translations[language].trackingMap;
  const isArabic = language === "ar";
  const nativeDriver = isNativeDriverShell();
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [databaseLocation, setDatabaseLocation] = useState<LiveDriverLocation | null>(null);
  const [nativePosition, setNativePosition] = useState<DevicePosition | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("standard");
  const [tileFailed, setTileFailed] = useState(false);
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [routeState, setRouteState] = useState<RouteState>("idle");
  const [routeError, setRouteError] = useState("");
  const [geocoded, setGeocoded] = useState<GeocodedPoints>({ pickup: null, destination: null });
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
        setLastLiveAt(new Date(position.timestamp || Date.now()));
        setGpsError("");
      },
      (error) => setGpsError(error.message || (isArabic ? "تعذر قراءة موقع الهاتف" : "Unable to read phone location")),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 25_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [devicePosition, isArabic, nativeDriver]);

  const activeOrder = liveOrder || order || null;
  const orderRow = recordOf(activeOrder);
  const orderId = getString(activeOrder, ["id"]);
  const driverId = getString(activeOrder, ["driver_id", "assigned_driver_id", "courier_id"]);
  const status = normalizeStatus(getString(activeOrder, ["status"]));
  const isOutForDelivery = status === "out_for_delivery";
  const isTrackingStatus = ["picked_up", "in_transit"].includes(status) || isOutForDelivery;

  useEffect(() => {
    const client = supabase;
    if (!client || !orderId) return;
    const channel = client
      .channel(`tracking-order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (payload) => setLiveOrder(payload.new as Order))
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [orderId]);

  useEffect(() => {
    const client = supabase;
    let cancelled = false;
    if (!client || !orderId || (!isTrackingStatus && !navigationMode && !nativeDriver)) return;
    const load = async () => {
      const { data, error } = await client.rpc("tracking_live_driver_location", { p_order_id: orderId });
      if (cancelled || error || !data) return;
      const payload = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
      const location = (payload.location || payload) as LiveDriverLocation;
      if (toPosition(location)) {
        setDatabaseLocation(location);
        const timestamp = Date.parse(String(location.updated_at || location.created_at || ""));
        setLastLiveAt(new Date(Number.isFinite(timestamp) ? timestamp : Date.now()));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 12_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isTrackingStatus, nativeDriver, navigationMode, orderId]);

  useEffect(() => {
    const client = supabase;
    if (!client || !driverId || (!isTrackingStatus && !navigationMode && !nativeDriver)) return;
    const channel = client
      .channel(`tracking-driver-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` }, (payload) => {
        const location = payload.new as LiveDriverLocation;
        if (toPosition(location)) {
          setDatabaseLocation(location);
          const timestamp = Date.parse(String(location.updated_at || location.created_at || ""));
          setLastLiveAt(new Date(Number.isFinite(timestamp) ? timestamp : Date.now()));
        }
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [driverId, isTrackingStatus, nativeDriver, navigationMode]);

  const pickupCity = getString(activeOrder, ["sender_city", "pickup_city", "origin_city"]);
  const destinationCity = getString(activeOrder, ["receiver_city", "delivery_city", "destination_city"]);
  const pickupLabel = resolvePoint(pickupCity || "Mussafah", defaultLocations.mussafah);
  const destinationLabel = resolvePoint(destinationCity || "Abu Dhabi", defaultLocations.abuDhabi);
  const storedPickup = readCoordinatePair(orderRow, [
    ["pickup_lat", "pickup_lng"],
    ["sender_lat", "sender_lng"],
    ["origin_lat", "origin_lng"],
    ["pickup_latitude", "pickup_longitude"],
  ]);
  const storedDestination = readCoordinatePair(orderRow, [
    ["delivery_lat", "delivery_lng"],
    ["receiver_lat", "receiver_lng"],
    ["destination_lat", "destination_lng"],
    ["delivery_latitude", "delivery_longitude"],
    ["receiver_latitude", "receiver_longitude"],
  ]);
  const pickupQuery = addressQuery(activeOrder, "pickup");
  const destinationQuery = addressQuery(activeOrder, "destination");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setGeocoded({ pickup: null, destination: null });
    const resolve = async () => {
      const [pickupResult, destinationResult] = await Promise.all([
        storedPickup || !pickupQuery ? Promise.resolve(null) : geocodeUaeAddress(pickupQuery, controller.signal).catch(() => null),
        storedDestination || !destinationQuery ? Promise.resolve(null) : geocodeUaeAddress(destinationQuery, controller.signal).catch(() => null),
      ]);
      if (!cancelled) setGeocoded({ pickup: pickupResult, destination: destinationResult });
    };
    void resolve();
    return () => { cancelled = true; controller.abort(); };
  }, [orderId, pickupQuery, destinationQuery, storedPickup?.[0], storedPickup?.[1], storedDestination?.[0], storedDestination?.[1]]);

  const pickupPos = storedPickup || geocoded.pickup;
  const destinationPos = storedDestination || geocoded.destination;
  const resolvedDevice = devicePosition || nativePosition;
  const devicePoint: LatLngTuple = [Number(resolvedDevice?.latitude), Number(resolvedDevice?.longitude)];
  const devicePos = isValidNavigationPoint(devicePoint) ? devicePoint : null;
  const driverPos = devicePos || toPosition(databaseLocation);
  const headingToPickup = !["picked_up", "in_transit", "out_for_delivery", "delivered", "returned", "cancelled"].includes(status);
  const routeTarget = headingToPickup ? pickupPos : destinationPos;
  const currentRouteKey = routeRequestKey(driverPos, routeTarget);

  useEffect(() => {
    const requestId = routeRequestRef.current + 1;
    routeRequestRef.current = requestId;
    if (!driverPos || !routeTarget) {
      setRoadRoute(null);
      setRouteState("missing");
      setRouteError(!driverPos
        ? (isArabic ? "بانتظار موقع GPS الحقيقي للمندوب." : "Waiting for the driver's real GPS position.")
        : (isArabic ? "عنوان الطلب لا يحتوي إحداثيات دقيقة، وجارٍ محاولة تحديده من العنوان." : "The order has no precise coordinates; resolving the written address."));
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setRouteState("loading");
    setRouteError("");
    const load = async () => {
      try {
        const result = await fetchRealDrivingRoute(driverPos, routeTarget, controller.signal);
        if (requestId !== routeRequestRef.current) return;
        setRoadRoute(result);
        setRouteState("ready");
      } catch (cause) {
        if (requestId !== routeRequestRef.current) return;
        console.warn("Real road route unavailable", cause);
        setRoadRoute(null);
        setRouteState("error");
        setRouteError(isArabic
          ? "تعذر تحميل مسار الطرق الحقيقي الآن؛ لن يعرض النظام خطًا مستقيمًا وهميًا."
          : "The real road route is unavailable; no fake straight line will be displayed.");
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void load();
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [currentRouteKey, isArabic]);

  const routePoints = roadRoute?.points || [];
  const snappedDriver = useMemo(
    () => driverPos && routePoints.length > 1 ? snapPointToRoadRoute(driverPos, routePoints, 55) : null,
    [driverPos?.[0], driverPos?.[1], routePoints],
  );
  const displayDriverPos = snappedDriver?.point || driverPos;
  const routeSegmentIndex = snappedDriver?.segmentIndex ?? -1;
  const suppliedHeading = Number(resolvedDevice?.heading ?? databaseLocation?.heading);
  const routeBearing = routeSegmentIndex >= 0 && routePoints[routeSegmentIndex + 1]
    ? calculateBearing(routePoints[routeSegmentIndex], routePoints[routeSegmentIndex + 1])
    : null;
  const bearing = Number.isFinite(suppliedHeading) && suppliedHeading >= 0
    ? suppliedHeading
    : routeBearing ?? (displayDriverPos && routeTarget ? calculateBearing(displayDriverPos, routeTarget) : 0);

  const defaultCenter: LatLngTuple = [defaultLocations.abuDhabi.lat, defaultLocations.abuDhabi.lng];
  const mapPoints = [displayDriverPos, routeTarget].filter(isValidNavigationPoint);
  const center = displayDriverPos || pickupPos || destinationPos || defaultCenter;
  const reference = getString(activeOrder, ["tracking_code", "tracking_number", "invoice_number", "id"]) || "DAY NIGHT";
  const lastLiveLabel = lastLiveAt ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : "—";
  const accuracy = Number(resolvedDevice?.accuracy ?? databaseLocation?.accuracy);
  const tileHandlers = { tileerror: () => { setTileFailed(true); setMapMode("standard"); } };

  const baseLayer = tileFailed
    ? <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} />
    : mapMode === "terrain"
      ? <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data &copy; OpenStreetMap contributors, SRTM" eventHandlers={tileHandlers} />
      : mapMode === "satellite"
        ? <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} />
        : <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors &copy; CARTO" eventHandlers={tileHandlers} />;

  const routeStatusText = routeState === "ready"
    ? (isArabic ? "مسار طرق حقيقي ومزامن مع GPS" : "Real road route synced with GPS")
    : routeState === "loading"
      ? (isArabic ? "جارٍ حساب أفضل مسار على الطرق…" : "Calculating the road route…")
      : routeError || (isArabic ? "بانتظار بيانات الملاحة" : "Waiting for navigation data");

  return (
    <div
      className={`dn-live-map-shell dn-real-road-navigation relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-brand-gold/20 bg-[#dce5ee] ${navigationMode ? "dn-live-map-navigation" : ""}`}
      data-driver-map-ready={displayDriverPos ? "live" : "waiting"}
      data-route-engine={routeState}
    >
      <div className="absolute left-3 right-3 top-3 z-[650] flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/92 px-3 py-2 shadow-xl backdrop-blur-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold">
            {navigationMode ? <Navigation className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
            {displayDriverPos ? (isArabic ? "ملاحة المندوب المباشرة داخل التطبيق" : "Live driver navigation inside the app") : (isArabic ? "بانتظار أول تحديث GPS من المندوب" : "Waiting for the driver's first GPS update")}
          </p>
          <p className="mt-1 text-[10px] font-bold text-white/60">
            {reference} · {lastLiveLabel}
            {roadRoute ? ` · ${formatDistance(roadRoute.distanceMeters, isArabic)} · ${formatDuration(roadRoute.durationSeconds, isArabic)}` : ""}
            {Number.isFinite(accuracy) && accuracy > 0 ? ` · ±${Math.round(accuracy)}m` : ""}
          </p>
          <span className={`dn-real-route-status is-${routeState}`}>
            {routeState === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
            {routeState === "ready" && <Route className="h-3 w-3" />}
            {routeStatusText}
          </span>
          {gpsError && <p className="mt-1 text-[10px] font-bold text-red-200">{gpsError}</p>}
        </div>
        {navigationMode && (
          <div className="flex items-center gap-2">
            <button type="button" className={followDriver ? "is-active" : ""} onClick={() => setFollowDriver((value) => !value)} title={isArabic ? "تتبع السهم" : "Follow arrow"}><Crosshair /></button>
            {onExitNavigation && <button type="button" onClick={onExitNavigation} title={isArabic ? "إغلاق الملاحة" : "Close navigation"}><X /></button>}
          </div>
        )}
      </div>

      <div className={`absolute right-3 z-[650] flex items-center gap-1 rounded-2xl border border-white/10 bg-[#071A33]/90 p-1 text-[10px] font-black text-white/70 backdrop-blur-xl ${navigationMode ? "top-32" : "top-28"}`} dir={isArabic ? "rtl" : "ltr"}>
        <Layers className="mx-1 h-3.5 w-3.5 text-brand-gold" />
        {([['standard', isArabic ? 'طرق' : 'Roads'], ['satellite', isArabic ? 'ساتلايت' : 'Satellite'], ['terrain', isArabic ? 'تضاريس' : 'Terrain']] as [MapMode, string][]).map(([mode, label]) => (
          <button key={mode} type="button" onClick={() => { setTileFailed(false); setMapMode(mode); }} className={`rounded-full px-2.5 py-1 ${mapMode === mode ? "bg-brand-gold text-brand-deep" : "hover:bg-white/10"}`}>{label}</button>
        ))}
      </div>

      <MapContainer key={mapMode} center={center} zoom={navigationMode ? 17 : 14} style={{ height: "100%", minHeight: 360, width: "100%" }} scrollWheelZoom={navigationMode} zoomControl preferCanvas>
        {baseLayer}
        <MapViewport points={mapPoints.length ? mapPoints : [center]} currentPosition={displayDriverPos} follow={followDriver && Boolean(displayDriverPos)} />
        {routePoints.length > 1 && (
          <>
            <Polyline className="dn-real-road-route-casing" positions={routePoints} pathOptions={{ color: "#FFFFFF", weight: navigationMode ? 11 : 9, opacity: 0.98, lineCap: "round", lineJoin: "round" }} />
            <Polyline positions={routePoints} pathOptions={{ color: "#1A73E8", weight: navigationMode ? 7 : 6, opacity: 1, lineCap: "round", lineJoin: "round" }} />
          </>
        )}
        {pickupPos && <Marker position={pickupPos} icon={pickupIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-blue uppercase">{t.pickupPoint}</p><p>{getString(activeOrder, ["sender_address", "pickup_address"]) || (isArabic ? pickupLabel.labelAr : pickupLabel.labelEn)}</p></div></Popup></Marker>}
        {displayDriverPos && (
          <DayNightVehicleMarker
            position={displayDriverPos}
            bearing={bearing}
            state="driving"
            navigationMode={navigationMode || nativeDriver}
            appearance={navigationMode || nativeDriver ? "navigation-arrow" : "vehicle"}
            label={isArabic ? "السهم الأزرق للموقع الحقيقي للمندوب" : "Blue arrow at the driver's real GPS position"}
          >
            <Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-[#1A73E8]">DAY NIGHT GPS</p><p>{isArabic ? "هذا السهم يتحرك من GPS الحقيقي ويُحاذى مع مسار الطريق عند دقة مناسبة." : "This arrow moves from real GPS and snaps to the road route only within a safe accuracy threshold."}</p></div></Popup>
          </DayNightVehicleMarker>
        )}
        {destinationPos && <Marker position={destinationPos} icon={destinationIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-gold uppercase"><Flag className="mr-1 inline h-3 w-3" />{t.destinationPoint}</p><p>{getString(activeOrder, ["receiver_address", "delivery_address"]) || (isArabic ? destinationLabel.labelAr : destinationLabel.labelEn)}</p></div></Popup></Marker>}
      </MapContainer>
    </div>
  );
}
