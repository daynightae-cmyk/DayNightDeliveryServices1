import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Crosshair,
  Layers3,
  Loader2,
  LocateFixed,
  MapPinned,
  Navigation,
  PackageSearch,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  WifiOff,
  Zap,
} from "lucide-react";
import { useAdminDrivers } from "../../hooks/useAdminDrivers";
import { supabase } from "../../supabase";
import type { DriverOrder } from "../../types/driver";
import {
  buildOrderRouteWaypoints,
  driverLocationPoint,
  explicitOrderDestination,
  explicitOrderPickup,
  fetchMapboxTrafficMatrix,
  fetchMapboxTrafficRoutes,
  formatRouteDistance,
  formatRouteDuration,
  isValidNexusLngLat,
  routeCongestionLabel,
  type NexusLngLat,
  type NexusRoute,
} from "../../lib/nexusMapbox";
import "../../styles/dn-nexus-orbital-live.css";

export type AdminNexusLiveCommandMapProps = {
  isArabic: boolean;
  orders: any[];
};

type ViewFilter = "all" | "drivers" | "pending" | "active" | "offline";
type MapStyleMode = "satellite" | "streets";

type DispatchCandidate = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  status?: string | null;
  shift_status?: string | null;
  vehicle_plate?: string | null;
  active_orders?: number | null;
  is_online?: boolean | null;
  last_seen_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  current_order_id?: string | null;
  etaSeconds?: number | null;
  routeDistanceMeters?: number | null;
};

const CLOSED = /deliver|cancel|return|complete|failed/i;
const UAE_ORBIT_CENTER: NexusLngLat = [54.55, 24.42];

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function orderId(order: any) {
  return String(order?.id || order?.tracking_number || order?.invoice_number || order?.coupon_number || "");
}

function orderReference(order: any) {
  return String(order?.tracking_number || order?.coupon_number || order?.invoice_number || order?.id || "—");
}

function assignedDriverId(order: any) {
  return String(order?.assigned_driver_id || order?.driver_id || "");
}

function isDispatchOpen(order: any) {
  return !CLOSED.test(normalize(order?.status));
}

function isPendingDispatch(order: any) {
  return isDispatchOpen(order) && !assignedDriverId(order);
}

function lastSeenAge(lastSeen?: string | null) {
  if (!lastSeen) return null;
  const time = new Date(lastSeen).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Date.now() - time);
}

function freshnessLabel(lastSeen: string | null | undefined, isArabic: boolean) {
  const age = lastSeenAge(lastSeen);
  if (age === null) return isArabic ? "لا يوجد GPS" : "No GPS";
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) return isArabic ? `${seconds} ث` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return isArabic ? `${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return isArabic ? `${hours} س` : `${hours}h ago`;
}

function candidatePresence(candidate: DispatchCandidate) {
  const age = lastSeenAge(candidate.last_seen_at);
  if (candidate.is_online === false || age === null || age >= 600_000) return "offline";
  if (age < 120_000) return "online";
  return "idle";
}

function includesQuery(values: unknown[], query: string) {
  if (!query.trim()) return true;
  const needle = normalize(query).replace(/\s+/g, "");
  return values.some((value) => normalize(value).replace(/\s+/g, "").includes(needle));
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection" as const, features: [] as any[] };
}

function boundsFromPoints(points: NexusLngLat[]) {
  const valid = points.filter(isValidNexusLngLat);
  if (!valid.length) return null;
  let minLng = valid[0][0];
  let minLat = valid[0][1];
  let maxLng = valid[0][0];
  let maxLat = valid[0][1];
  for (const [lng, lat] of valid.slice(1)) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]];
}

function congestionCopy(value: ReturnType<typeof routeCongestionLabel>, isArabic: boolean) {
  if (value === "severe") return isArabic ? "ازدحام شديد" : "Severe traffic";
  if (value === "heavy") return isArabic ? "ازدحام مرتفع" : "Heavy traffic";
  if (value === "moderate") return isArabic ? "ازدحام متوسط" : "Moderate traffic";
  if (value === "low") return isArabic ? "حركة منخفضة" : "Low congestion";
  return isArabic ? "الازدحام غير متاح" : "Congestion unavailable";
}

function dubaiHour(date: Date) {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number(value);
}

function lightPresetForDubai(date: Date) {
  const hour = dubaiHour(date);
  if (hour >= 6 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}

function dubaiClock(date: Date, isArabic: boolean) {
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AdminNexusOrbitalLiveCommandMap({ isArabic, orders }: AdminNexusLiveCommandMapProps) {
  const { drivers, dispatchOrders, stats, loading, error, lastUpdatedAt, refresh } = useAdminDrivers();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const orbitTimerRef = useRef<number | null>(null);
  const [mapReadyNonce, setMapReadyNonce] = useState(0);
  const [mapError, setMapError] = useState("");
  const [styleMode, setStyleMode] = useState<MapStyleMode>("satellite");
  const [trafficVisible, setTrafficVisible] = useState(true);
  const [orbitalMode, setOrbitalMode] = useState(true);
  const [query, setQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [candidateDriverId, setCandidateDriverId] = useState("");
  const [candidates, setCandidates] = useState<DispatchCandidate[]>([]);
  const [candidatesBusy, setCandidatesBusy] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [routes, setRoutes] = useState<NexusRoute[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [now, setNow] = useState(() => new Date());

  const accessToken = String(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "").trim();
  const liveOrders = useMemo<DriverOrder[]>(() => {
    const source = dispatchOrders.length ? dispatchOrders : orders;
    return (source || []).filter(isDispatchOpen) as DriverOrder[];
  }, [dispatchOrders, orders]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedOrder = useMemo(
    () => liveOrders.find((order) => orderId(order) === selectedOrderId) || null,
    [liveOrders, selectedOrderId],
  );
  const assignedDriver = useMemo(() => {
    const id = assignedDriverId(selectedOrder);
    return id ? drivers.find((driver) => driver.id === id) || null : null;
  }, [drivers, selectedOrder]);
  const candidateDriver = useMemo(
    () => candidateDriverId ? drivers.find((driver) => driver.id === candidateDriverId) || null : null,
    [drivers, candidateDriverId],
  );
  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) || assignedDriver || candidateDriver || null,
    [drivers, selectedDriverId, assignedDriver, candidateDriver],
  );

  const filteredDrivers = useMemo(() => drivers.filter((driver) => {
    if (viewFilter === "pending") return false;
    if (viewFilter === "offline" && driver.presence !== "offline") return false;
    if (viewFilter === "active" && driver.active_orders <= 0) return false;
    return includesQuery([
      driver.id,
      driver.full_name,
      driver.name,
      driver.phone,
      driver.vehicle_plate,
      driver.work_area,
      driver.emirate,
    ], query) && Boolean(driverLocationPoint(driver.location));
  }), [drivers, query, viewFilter]);

  const filteredOrders = useMemo(() => liveOrders.filter((order) => {
    const pending = isPendingDispatch(order);
    if (viewFilter === "drivers" || viewFilter === "offline") return false;
    if (viewFilter === "pending" && !pending) return false;
    if (viewFilter === "active" && pending) return false;
    if (!includesQuery([
      order.id,
      order.tracking_number,
      order.invoice_number,
      order.coupon_number,
      order.receiver_name,
      order.receiver_phone,
      order.sender_name,
      order.sender_phone,
      order.merchant_name,
      order.merchant_code,
      order.receiver_city,
      order.sender_city,
    ], query)) return false;
    const point = pending ? explicitOrderPickup(order) : explicitOrderDestination(order) || explicitOrderPickup(order);
    return Boolean(point);
  }), [liveOrders, query, viewFilter]);

  const driverFeatures = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: filteredDrivers.flatMap((driver) => {
      const point = driverLocationPoint(driver.location);
      if (!point) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: point },
        properties: {
          id: driver.id,
          name: driver.full_name || driver.name || driver.id,
          presence: driver.presence,
          heading: Number.isFinite(Number(driver.location?.heading)) ? Number(driver.location?.heading) : 0,
          activeOrders: driver.active_orders,
        },
      }];
    }),
  }), [filteredDrivers]);

  const orderFeatures = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: filteredOrders.flatMap((order) => {
      const pending = isPendingDispatch(order);
      const point = pending ? explicitOrderPickup(order) : explicitOrderDestination(order) || explicitOrderPickup(order);
      if (!point) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: point },
        properties: {
          id: orderId(order),
          reference: orderReference(order),
          state: pending ? "pending" : "active",
          status: String(order.status || ""),
        },
      }];
    }),
  }), [filteredOrders]);

  useEffect(() => {
    if (!mapHostRef.current || !accessToken) return;
    let cancelled = false;
    let localMap: any = null;
    setMapError("");

    void (async () => {
      try {
        const [{ default: mapboxgl }] = await Promise.all([
          import("mapbox-gl"),
          import("mapbox-gl/dist/mapbox-gl.css"),
        ]);
        if (cancelled || !mapHostRef.current) return;
        mapboxgl.accessToken = accessToken;
        localMap = new mapboxgl.Map({
          container: mapHostRef.current,
          style: styleMode === "satellite"
            ? "mapbox://styles/mapbox/standard-satellite"
            : "mapbox://styles/mapbox/standard",
          center: UAE_ORBIT_CENTER,
          zoom: 6.35,
          pitch: 54,
          bearing: -24,
          projection: "globe",
          attributionControl: true,
          antialias: true,
        });
        mapRef.current = localMap;
        localMap.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
        localMap.addControl(new mapboxgl.FullscreenControl(), "bottom-right");
        localMap.on("dragstart", () => setOrbitalMode(false));
        localMap.on("rotatestart", () => setOrbitalMode(false));
        localMap.on("pitchstart", () => setOrbitalMode(false));
        localMap.on("error", (event: any) => {
          const status = Number(event?.error?.status || event?.error?.statusCode || 0);
          if (status === 401 || status === 403) {
            setMapError(isArabic ? "تعذر اعتماد Mapbox للمفتاح الحالي." : "Mapbox rejected the configured access token.");
          }
        });
        localMap.on("load", () => {
          try {
            localMap.setConfigProperty("basemap", "lightPreset", lightPresetForDubai(new Date()));
            localMap.setConfigProperty("basemap", "showRoadsAndTransit", true);
            localMap.setConfigProperty("basemap", "showRoadLabels", true);
            localMap.setConfigProperty("basemap", "showPlaceLabels", true);
          } catch {
            // Standard style config is best-effort; data truth does not depend on it.
          }
          try {
            localMap.setFog({
              range: [0.6, 8],
              color: "#10233f",
              "high-color": "#24588e",
              "space-color": "#020713",
              "star-intensity": 0.32,
            });
          } catch {
            // Atmosphere is visual only.
          }
          try {
            localMap.addSource("dn-nexus-terrain", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 14,
            });
            localMap.setTerrain({ source: "dn-nexus-terrain", exaggeration: 1.15 });
          } catch {
            // Terrain is visual only.
          }

          const topSlot = { slot: "top" } as any;
          localMap.addSource("dn-nexus-live-traffic", {
            type: "vector",
            url: "mapbox://mapbox.mapbox-traffic-v1",
          });
          localMap.addLayer({
            id: "dn-nexus-live-traffic-flow",
            type: "line",
            source: "dn-nexus-live-traffic",
            "source-layer": "traffic",
            minzoom: 6,
            layout: { visibility: "visible", "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": [
                "case",
                ["==", ["get", "closed"], "yes"], "#ff315a",
                ["match", ["get", "congestion"],
                  "low", "#31d6a3",
                  "moderate", "#f0c84b",
                  "heavy", "#ff8b3d",
                  "severe", "#ff3d64",
                  "#57b9ff"],
              ],
              "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.2, 10, 2.8, 14, 5.5],
              "line-opacity": 0.82,
              "line-blur": 0.25,
              "line-offset": 1.1,
            },
            ...topSlot,
          } as any);

          localMap.addSource("dn-nexus-drivers", {
            type: "geojson",
            data: emptyFeatureCollection(),
            cluster: true,
            clusterRadius: 46,
            clusterMaxZoom: 12,
          });
          localMap.addLayer({
            id: "dn-nexus-driver-clusters",
            type: "circle",
            source: "dn-nexus-drivers",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#0b56d8",
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#91dcff",
            },
            ...topSlot,
          } as any);
          localMap.addLayer({
            id: "dn-nexus-driver-cluster-count",
            type: "symbol",
            source: "dn-nexus-drivers",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
            paint: { "text-color": "#ffffff" },
            ...topSlot,
          } as any);
          localMap.addLayer({
            id: "dn-nexus-driver-pulse",
            type: "circle",
            source: "dn-nexus-drivers",
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "presence"], "online"]],
            paint: {
              "circle-radius": 17,
              "circle-color": "#31d6a3",
              "circle-opacity": 0.14,
              "circle-blur": 0.8,
            },
            ...topSlot,
          } as any);
          localMap.addLayer({
            id: "dn-nexus-driver-points",
            type: "circle",
            source: "dn-nexus-drivers",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": 8,
              "circle-color": [
                "match", ["get", "presence"],
                "online", "#31d6a3",
                "idle", "#d4af37",
                "problem", "#ff5a67",
                "#718096",
              ],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#071a33",
            },
            ...topSlot,
          } as any);
          localMap.addLayer({
            id: "dn-nexus-driver-heading",
            type: "symbol",
            source: "dn-nexus-drivers",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": "▲",
              "text-size": 11,
              "text-rotate": ["get", "heading"],
              "text-rotation-alignment": "map",
              "text-offset": [0, -1.7],
              "text-allow-overlap": true,
            },
            paint: { "text-color": "#ffffff", "text-halo-color": "#071a33", "text-halo-width": 1 },
            ...topSlot,
          } as any);

          localMap.addSource("dn-nexus-orders", { type: "geojson", data: emptyFeatureCollection() });
          localMap.addLayer({
            id: "dn-nexus-order-halo",
            type: "circle",
            source: "dn-nexus-orders",
            paint: {
              "circle-radius": ["match", ["get", "state"], "pending", 20, 16],
              "circle-color": ["match", ["get", "state"], "pending", "#d4af37", "#3a8dff"],
              "circle-opacity": 0.12,
              "circle-blur": 0.75,
            },
            ...topSlot,
          } as any);
          localMap.addLayer({
            id: "dn-nexus-order-points",
            type: "circle",
            source: "dn-nexus-orders",
            paint: {
              "circle-radius": ["match", ["get", "state"], "pending", 9, 7],
              "circle-color": ["match", ["get", "state"], "pending", "#d4af37", "#3a8dff"],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#081a31",
            },
            ...topSlot,
          } as any);

          localMap.addSource("dn-nexus-routes", { type: "geojson", data: emptyFeatureCollection() });
          localMap.addLayer({
            id: "dn-nexus-route-alternatives",
            type: "line",
            source: "dn-nexus-routes",
            filter: [">", ["get", "routeIndex"], 0],
            paint: { "line-color": "#9ccbff", "line-width": 4, "line-opacity": 0.48, "line-dasharray": [2, 2] },
            ...topSlot,
          } as any);
          localMap.addLayer({
            id: "dn-nexus-route-primary",
            type: "line",
            source: "dn-nexus-routes",
            filter: ["==", ["get", "routeIndex"], 0],
            paint: { "line-color": "#23a8ff", "line-width": 6, "line-opacity": 0.94 },
            ...topSlot,
          } as any);

          localMap.on("click", "dn-nexus-driver-points", (event: any) => {
            const feature = event.features?.[0];
            const id = String(feature?.properties?.id || "");
            if (!id) return;
            setOrbitalMode(false);
            setSelectedDriverId(id);
            if (selectedOrderId && !assignedDriverId(liveOrders.find((order) => orderId(order) === selectedOrderId))) {
              setCandidateDriverId(id);
            }
            const coordinates = feature.geometry?.coordinates;
            if (Array.isArray(coordinates)) localMap.easeTo({ center: coordinates, zoom: Math.max(localMap.getZoom(), 12.5), pitch: 63, duration: 850 });
          });
          localMap.on("click", "dn-nexus-order-points", (event: any) => {
            const id = String(event.features?.[0]?.properties?.id || "");
            if (!id) return;
            setOrbitalMode(false);
            setSelectedOrderId(id);
            setSelectedDriverId("");
          });
          localMap.on("click", "dn-nexus-driver-clusters", async (event: any) => {
            const feature = event.features?.[0];
            const clusterId = Number(feature?.properties?.cluster_id);
            const source = localMap.getSource("dn-nexus-drivers") as any;
            if (!Number.isFinite(clusterId) || !source?.getClusterExpansionZoom) return;
            const zoom = await source.getClusterExpansionZoom(clusterId);
            setOrbitalMode(false);
            localMap.easeTo({ center: feature.geometry.coordinates, zoom, pitch: 55 });
          });
          for (const id of ["dn-nexus-driver-points", "dn-nexus-order-points", "dn-nexus-driver-clusters"]) {
            localMap.on("mouseenter", id, () => { localMap.getCanvas().style.cursor = "pointer"; });
            localMap.on("mouseleave", id, () => { localMap.getCanvas().style.cursor = ""; });
          }
          setMapReadyNonce((value) => value + 1);
        });
      } catch (cause) {
        console.warn("NEXUS Mapbox initialization failed safely.", cause);
        setMapError(isArabic ? "تعذر تشغيل المشهد الفضائي. بقية مركز العمليات ما زال متاحًا." : "The orbital map could not initialize. The rest of the operations center remains available.");
      }
    })();

    return () => {
      cancelled = true;
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current);
      if (localMap) localMap.remove();
      if (mapRef.current === localMap) mapRef.current = null;
    };
  }, [accessToken, styleMode, isArabic]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const driverSource = map.getSource("dn-nexus-drivers") as any;
    const orderSource = map.getSource("dn-nexus-orders") as any;
    driverSource?.setData(driverFeatures);
    orderSource?.setData(orderFeatures);
  }, [driverFeatures, orderFeatures, mapReadyNonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("dn-nexus-live-traffic-flow")) return;
    map.setLayoutProperty("dn-nexus-live-traffic-flow", "visibility", trafficVisible ? "visible" : "none");
  }, [trafficVisible, mapReadyNonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      map.setConfigProperty("basemap", "lightPreset", lightPresetForDubai(now));
    } catch {
      // Visual synchronization only.
    }
  }, [Math.floor(now.getTime() / 300_000), mapReadyNonce]);

  useEffect(() => {
    if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current);
    orbitTimerRef.current = null;
    const map = mapRef.current;
    if (!map || !orbitalMode || selectedOrder || selectedDriver) return;
    orbitTimerRef.current = window.setInterval(() => {
      const current = mapRef.current;
      if (!current) return;
      current.easeTo({
        bearing: current.getBearing() + 9,
        pitch: 55,
        duration: 4500,
        easing: (value: number) => value,
        essential: false,
      });
    }, 4800);
    return () => {
      if (orbitTimerRef.current) window.clearInterval(orbitTimerRef.current);
      orbitTimerRef.current = null;
    };
  }, [orbitalMode, selectedOrderId, selectedDriverId, mapReadyNonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource("dn-nexus-routes") as any;
    source?.setData({
      type: "FeatureCollection",
      features: routes.map((route, routeIndex) => ({
        type: "Feature",
        geometry: route.geometry,
        properties: { routeIndex },
      })),
    });
    if (routes[0]?.geometry?.coordinates?.length) {
      const bounds = boundsFromPoints(routes[0].geometry.coordinates);
      if (bounds) map.fitBounds(bounds, { padding: 110, maxZoom: 14, duration: 850, pitch: 58 });
    }
  }, [routes, mapReadyNonce]);

  useEffect(() => {
    if (!selectedOrder) {
      setCandidates([]);
      setCandidateDriverId("");
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setCandidateError("");
    setCandidatesBusy(true);
    void (async () => {
      try {
        if (!supabase) throw new Error("supabase_unavailable");
        const { data, error: rpcError } = await supabase.rpc("admin_dispatch_candidates", {
          p_order_id: orderId(selectedOrder),
        });
        if (rpcError) throw rpcError;
        const raw = (Array.isArray(data) ? data : []) as DispatchCandidate[];
        const target = explicitOrderPickup(selectedOrder) || explicitOrderDestination(selectedOrder);
        let next: DispatchCandidate[] = raw.map((item) => ({ ...item, etaSeconds: null, routeDistanceMeters: null }));
        if (accessToken && target) {
          const routable = next.filter((item) => Boolean(driverLocationPoint(item))).slice(0, 9);
          if (routable.length) {
            const points = routable.map((item) => driverLocationPoint(item)!).filter(isValidNexusLngLat);
            const matrix = await fetchMapboxTrafficMatrix(accessToken, points, target, controller.signal);
            const matrixById = new Map(routable.map((item, index) => [item.id, matrix[index]]));
            next = next.map((item) => ({
              ...item,
              etaSeconds: matrixById.get(item.id)?.duration ?? null,
              routeDistanceMeters: matrixById.get(item.id)?.distance ?? null,
            }));
          }
        }
        next.sort((a, b) => {
          const aEta = a.etaSeconds ?? Number.POSITIVE_INFINITY;
          const bEta = b.etaSeconds ?? Number.POSITIVE_INFINITY;
          if (aEta !== bEta) return aEta - bEta;
          const score = (item: DispatchCandidate) => candidatePresence(item) === "online" ? 0 : candidatePresence(item) === "idle" ? 1 : 2;
          return score(a) - score(b) || Number(a.active_orders || 0) - Number(b.active_orders || 0);
        });
        if (!cancelled) {
          setCandidates(next);
          setCandidateDriverId(assignedDriverId(selectedOrder) || next[0]?.id || "");
        }
      } catch (cause: any) {
        if (cause?.name === "AbortError") return;
        console.warn("NEXUS dispatch candidate load failed safely.", cause);
        if (!cancelled) setCandidateError(isArabic ? "تعذر تحميل مرشحي الإسناد الآن." : "Dispatch candidates are unavailable right now.");
      } finally {
        if (!cancelled) setCandidatesBusy(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedOrder?.id, selectedOrder?.tracking_number, selectedOrder?.status, accessToken, isArabic]);

  const routeDriverRow = assignedDriver || candidateDriver || selectedDriver;
  useEffect(() => {
    const controller = new AbortController();
    if (!selectedOrder || !routeDriverRow || !accessToken) {
      setRoutes([]);
      setRouteError("");
      return () => controller.abort();
    }
    const driverPoint = driverLocationPoint(routeDriverRow.location);
    const waypoints = buildOrderRouteWaypoints(selectedOrder, driverPoint);
    if (waypoints.length < 2) {
      setRoutes([]);
      setRouteError(!driverPoint
        ? (isArabic ? "لا يوجد GPS حقيقي للمندوب المختار." : "The selected driver has no real GPS location.")
        : (isArabic ? "الطلب لا يحتوي إحداثيات كافية لمسار حقيقي." : "The order does not have enough explicit coordinates for a real route."));
      return () => controller.abort();
    }
    setRouteBusy(true);
    setRouteError("");
    void fetchMapboxTrafficRoutes(accessToken, waypoints, controller.signal)
      .then((next) => {
        setRoutes(next);
        if (!next.length) setRouteError(isArabic ? "لم يُرجع Mapbox مسارًا صالحًا." : "Mapbox returned no usable route.");
      })
      .catch((cause: any) => {
        if (cause?.name === "AbortError") return;
        console.warn("NEXUS traffic route failed safely.", cause);
        setRoutes([]);
        setRouteError(isArabic ? "تعذر حساب المسار المروري الآن." : "Traffic-aware routing is unavailable right now.");
      })
      .finally(() => setRouteBusy(false));
    return () => controller.abort();
  }, [selectedOrder?.id, selectedOrder?.status, routeDriverRow?.id, routeDriverRow?.location?.last_seen_at, accessToken, isArabic]);

  const assignSelected = useCallback(async () => {
    if (!selectedOrder || !candidateDriverId || !supabase) return;
    setDispatchBusy(true);
    setDispatchMessage("");
    try {
      const current = assignedDriverId(selectedOrder);
      const action = current && current !== candidateDriverId ? "reassign" : "assign";
      const { data, error: rpcError } = await supabase.rpc("admin_dispatch_order_runtime", {
        p_payload: {
          order_id: orderId(selectedOrder),
          driver_id: candidateDriverId,
          action,
          note: "DAY NIGHT NEXUS ORBITAL LIVE command center",
          force: false,
        },
      });
      if (rpcError) throw rpcError;
      if (data && typeof data === "object" && "ok" in data && data.ok === false) throw new Error("dispatch_not_confirmed");
      setDispatchMessage(isArabic ? "تم حفظ الإسناد وتسجيله في سجل التوزيع." : "Assignment saved and recorded in dispatch history.");
      setSelectedDriverId(candidateDriverId);
      await refresh();
    } catch (cause) {
      console.warn("NEXUS dispatch write failed safely.", cause);
      setDispatchMessage(isArabic ? "تعذر حفظ الإسناد. لم يتم عرض نجاح وهمي." : "Assignment could not be saved. No fake success was shown.");
    } finally {
      setDispatchBusy(false);
    }
  }, [selectedOrder, candidateDriverId, isArabic, refresh]);

  const resetOrbit = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedOrderId("");
    setSelectedDriverId("");
    setCandidateDriverId("");
    setRoutes([]);
    setOrbitalMode(true);
    map.easeTo({ center: UAE_ORBIT_CENTER, zoom: 6.35, pitch: 54, bearing: -24, duration: 1200 });
  }, []);

  const fitOperations = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: NexusLngLat[] = [
      ...driverFeatures.features.map((feature) => feature.geometry.coordinates as NexusLngLat),
      ...orderFeatures.features.map((feature) => feature.geometry.coordinates as NexusLngLat),
    ];
    const bounds = boundsFromPoints(points);
    setOrbitalMode(false);
    if (bounds) map.fitBounds(bounds, { padding: 100, maxZoom: 12.5, duration: 850, pitch: 55 });
    else map.easeTo({ center: UAE_ORBIT_CENTER, zoom: 7, pitch: 55, duration: 850 });
  }, [driverFeatures, orderFeatures]);

  const primaryRoute = routes[0] || null;
  const routeTraffic = routeCongestionLabel(primaryRoute);
  const pendingWithoutCoordinates = liveOrders.filter((order) => isPendingDispatch(order) && !explicitOrderPickup(order)).length;
  const driversWithoutGps = drivers.filter((driver) => !driverLocationPoint(driver.location)).length;
  const locatedObjects = driverFeatures.features.length + orderFeatures.features.length;
  const filterButtons: Array<{ id: ViewFilter; ar: string; en: string; value: number }> = [
    { id: "all", ar: "الكل", en: "All", value: locatedObjects },
    { id: "drivers", ar: "المندوبون", en: "Drivers", value: stats.total },
    { id: "pending", ar: "بانتظار", en: "Pending", value: stats.unassigned },
    { id: "active", ar: "نشطة", en: "Active", value: stats.inProgress },
    { id: "offline", ar: "Offline", en: "Offline", value: stats.offline },
  ];

  return (
    <section className="dn-nexus-command-map dn-nexus-command-map--orbital" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-nexus-command-map__stage">
        {!accessToken && (
          <div className="dn-nexus-command-map__configuration" role="alert">
            <AlertTriangle size={22} />
            <div><b>{isArabic ? "إعداد Mapbox غير موجود" : "Mapbox configuration is missing"}</b><span>VITE_MAPBOX_ACCESS_TOKEN</span></div>
          </div>
        )}
        {mapError && <div className="dn-nexus-command-map__map-error" role="alert"><AlertTriangle size={16} />{mapError}</div>}
        <div ref={mapHostRef} className="dn-nexus-command-map__canvas" aria-label={isArabic ? "NEXUS ORBITAL LIVE فوق الإمارات" : "NEXUS ORBITAL LIVE over the UAE"} />
        <div className="dn-nexus-command-map__scan" aria-hidden="true"><span /></div>
        <div className="dn-nexus-command-map__vignette" aria-hidden="true" />

        <header className="dn-nexus-command-map__hud">
          <div className="dn-nexus-command-map__identity">
            <span className="dn-nexus-command-map__radar"><Activity size={17} /></span>
            <div>
              <b>NEXUS ORBITAL LIVE · UAE</b>
              <small>{isArabic ? "قمر صناعي + حركة طرق حقيقية + عمليات DAY NIGHT" : "Satellite imagery + real traffic + DAY NIGHT operations"}</small>
            </div>
          </div>
          <div className="dn-nexus-command-map__live-clock">
            <span><span className="dn-nexus-command-map__live-dot" />LIVE</span>
            <b dir="ltr">{dubaiClock(now, isArabic)}</b>
            <small>GST · UAE</small>
          </div>
          <div className="dn-nexus-command-map__stats">
            <button type="button" onClick={() => setViewFilter("drivers")}><Truck size={14} /><span>GPS</span><b>{stats.online}</b></button>
            <button type="button" onClick={() => setViewFilter("pending")}><PackageSearch size={14} /><span>{isArabic ? "بانتظار" : "Pending"}</span><b>{stats.unassigned}</b></button>
            <button type="button" onClick={() => setViewFilter("active")}><Navigation size={14} /><span>{isArabic ? "نشطة" : "Active"}</span><b>{stats.inProgress}</b></button>
          </div>
        </header>

        <div className="dn-nexus-command-map__toolbar">
          <label className="dn-nexus-command-map__search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "طلب / كوبون / مندوب / هاتف / تاجر" : "Order / coupon / driver / phone / merchant"} />
          </label>
          <div className="dn-nexus-command-map__filters">
            {filterButtons.map((item) => (
              <button key={item.id} type="button" className={viewFilter === item.id ? "is-active" : ""} onClick={() => setViewFilter(item.id)}>
                {isArabic ? item.ar : item.en}<b>{item.value}</b>
              </button>
            ))}
          </div>
          <div className="dn-nexus-command-map__map-actions">
            <button type="button" className={orbitalMode ? "is-active" : ""} onClick={resetOrbit}><Activity size={15} /> ORBIT</button>
            <button type="button" className={trafficVisible ? "is-active" : ""} onClick={() => setTrafficVisible((value) => !value)}><Zap size={15} /> TRAFFIC</button>
            <button type="button" onClick={() => setStyleMode((mode) => mode === "satellite" ? "streets" : "satellite")}><Layers3 size={15} />{styleMode === "satellite" ? (isArabic ? "شوارع" : "Streets") : (isArabic ? "فضائي" : "Satellite")}</button>
            <button type="button" onClick={fitOperations}><Crosshair size={15} />{isArabic ? "العمليات" : "Ops"}</button>
            <button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "dn-nexus-spin" : ""} /></button>
          </div>
        </div>

        <div className="dn-nexus-command-map__ambient-status">
          <span><Activity size={12} /> SATELLITE IMAGERY</span>
          <span className={trafficVisible ? "is-live" : ""}><Zap size={12} /> TRAFFIC ~8 MIN</span>
          <span><Clock3 size={12} /> {lightPresetForDubai(now).toUpperCase()}</span>
          <span><LocateFixed size={12} /> {locatedObjects} {isArabic ? "عنصر GPS/طلب محدد" : "located ops objects"}</span>
        </div>

        <aside className="dn-nexus-command-map__side">
          <section className="dn-nexus-command-map__panel dn-nexus-command-map__panel--overview">
            <div className="dn-nexus-command-map__panel-title">
              <div><Activity size={16} /><span><b>{isArabic ? "المشهد الحي" : "Live scene"}</b><small>{isArabic ? "يظل حيًا حتى بدون طلبات أو مندوبين" : "Stays alive even with zero orders or drivers"}</small></span></div>
              <strong>{locatedObjects}</strong>
            </div>
            <div className="dn-nexus-command-map__scene-grid">
              <span><b>{trafficVisible ? (isArabic ? "مفعّل" : "ON") : (isArabic ? "متوقف" : "OFF")}</b><small>{isArabic ? "حركة الطرق" : "Road traffic"}</small></span>
              <span><b>{orbitalMode ? "ORBIT" : "MANUAL"}</b><small>{isArabic ? "الكاميرا" : "Camera"}</small></span>
              <span><b>{stats.online}</b><small>{isArabic ? "GPS مباشر" : "Live GPS"}</small></span>
              <span><b>{stats.unassigned}</b><small>{isArabic ? "بانتظار الإسناد" : "Pending dispatch"}</small></span>
            </div>
          </section>

          <section className="dn-nexus-command-map__panel">
            <div className="dn-nexus-command-map__panel-title">
              <div><PackageSearch size={16} /><span><b>Pending Dispatch</b><small>{isArabic ? "طلبات حقيقية غير مسندة" : "Real unassigned orders"}</small></span></div>
              <strong>{stats.unassigned}</strong>
            </div>
            <div className="dn-nexus-command-map__order-list">
              {liveOrders.filter(isPendingDispatch).slice(0, 6).map((order) => {
                const point = explicitOrderPickup(order);
                const selected = orderId(order) === selectedOrderId;
                return (
                  <button key={orderId(order)} type="button" className={selected ? "is-selected" : ""} onClick={() => { setOrbitalMode(false); setSelectedOrderId(orderId(order)); setSelectedDriverId(""); }}>
                    <span><b dir="ltr">{orderReference(order)}</b><small>{String(order.receiver_city || order.receiver_name || "—")}</small></span>
                    <em className={point ? "has-location" : "no-location"}>{point ? <LocateFixed size={13} /> : <AlertTriangle size={13} />}{point ? (isArabic ? "موقع" : "Located") : (isArabic ? "لا إحداثيات" : "No coordinates")}</em>
                  </button>
                );
              })}
              {!liveOrders.some(isPendingDispatch) && <div className="dn-nexus-command-map__empty"><UserRoundCheck size={22} /><span>{isArabic ? "لا توجد طلبات الآن — المشهد الفضائي والمرور الحي مستمران." : "No dispatch orders now — orbital view and live traffic remain active."}</span></div>}
            </div>
          </section>

          {selectedOrder && (
            <section className="dn-nexus-command-map__panel dn-nexus-command-map__dispatch">
              <div className="dn-nexus-command-map__panel-title">
                <div><Route size={16} /><span><b>{orderReference(selectedOrder)}</b><small>{String(selectedOrder.status || "—")}</small></span></div>
                {assignedDriverId(selectedOrder) ? <span className="is-assigned"><CheckCircle2 size={13} /> {isArabic ? "مسند" : "Assigned"}</span> : <span className="is-pending"><Clock3 size={13} /> {isArabic ? "بانتظار" : "Pending"}</span>}
              </div>
              {(routeBusy || primaryRoute || routeError) && (
                <div className="dn-nexus-command-map__route-card">
                  {routeBusy ? <span><Loader2 size={14} className="dn-nexus-spin" /> {isArabic ? "حساب المسار…" : "Calculating…"}</span> : primaryRoute ? (
                    <div className="dn-nexus-command-map__route-metrics">
                      <span><b>{formatRouteDuration(primaryRoute.duration, isArabic)}</b><small>ETA</small></span>
                      <span><b>{formatRouteDistance(primaryRoute.distance)}</b><small>{isArabic ? "مسافة" : "Distance"}</small></span>
                      <span className={`traffic-${routeTraffic}`}><b>{congestionCopy(routeTraffic, isArabic)}</b><small>{routes.length > 1 ? `${routes.length - 1} ALT` : "—"}</small></span>
                    </div>
                  ) : <span className="is-error"><AlertTriangle size={14} /> {routeError}</span>}
                </div>
              )}
              <div className="dn-nexus-command-map__candidate-head"><span><Truck size={14} /> {isArabic ? "مرشحو الإسناد" : "Dispatch candidates"}</span>{candidatesBusy && <Loader2 size={14} className="dn-nexus-spin" />}</div>
              {candidateError && <div className="dn-nexus-command-map__inline-error">{candidateError}</div>}
              <div className="dn-nexus-command-map__candidates">
                {candidates.slice(0, 5).map((candidate, index) => (
                  <button key={candidate.id} type="button" className={candidate.id === candidateDriverId ? "is-selected" : ""} onClick={() => { setOrbitalMode(false); setCandidateDriverId(candidate.id); setSelectedDriverId(candidate.id); }}>
                    <span className="dn-nexus-command-map__candidate-rank">#{index + 1}</span>
                    <span className="dn-nexus-command-map__candidate-copy"><b>{candidate.full_name || candidate.id}</b><small>{candidate.shift_status || candidate.status || "—"} · {Number(candidate.active_orders || 0)} {isArabic ? "مهام" : "jobs"}</small></span>
                    <span className="dn-nexus-command-map__candidate-route"><b>{formatRouteDuration(candidate.etaSeconds, isArabic)}</b><small>{candidate.routeDistanceMeters ? formatRouteDistance(candidate.routeDistanceMeters) : freshnessLabel(candidate.last_seen_at, isArabic)}</small></span>
                  </button>
                ))}
              </div>
              {candidateDriverId && (
                <div className="dn-nexus-command-map__assignment-review">
                  <div><ShieldCheck size={15} /><span><b>{isArabic ? "مراجعة الإسناد" : "Assignment review"}</b><small>{candidates.find((item) => item.id === candidateDriverId)?.full_name || candidateDriverId}</small></span></div>
                  <button type="button" onClick={() => void assignSelected()} disabled={dispatchBusy || assignedDriverId(selectedOrder) === candidateDriverId}>
                    {dispatchBusy ? <Loader2 size={14} className="dn-nexus-spin" /> : <CheckCircle2 size={14} />}
                    {assignedDriverId(selectedOrder) === candidateDriverId ? (isArabic ? "مسند حاليًا" : "Assigned") : (isArabic ? "تأكيد الإسناد" : "Confirm")}
                  </button>
                </div>
              )}
              {dispatchMessage && <div className="dn-nexus-command-map__dispatch-message">{dispatchMessage}</div>}
            </section>
          )}

          {selectedDriver && (
            <section className="dn-nexus-command-map__panel dn-nexus-command-map__driver-focus">
              <div className="dn-nexus-command-map__panel-title">
                <div><Truck size={16} /><span><b>{selectedDriver.full_name || selectedDriver.name || selectedDriver.id}</b><small>{selectedDriver.vehicle_plate || selectedDriver.phone || "—"}</small></span></div>
                <span className={`presence-${selectedDriver.presence}`}>{selectedDriver.presence.toUpperCase()}</span>
              </div>
              <dl>
                <div><dt>{isArabic ? "آخر GPS" : "Last GPS"}</dt><dd>{freshnessLabel(selectedDriver.location?.last_seen_at, isArabic)}</dd></div>
                <div><dt>{isArabic ? "مهام" : "Active"}</dt><dd>{selectedDriver.active_orders}</dd></div>
                <div><dt>{isArabic ? "السرعة" : "Speed"}</dt><dd>{Number.isFinite(Number(selectedDriver.location?.speed)) ? `${Math.round(Number(selectedDriver.location?.speed) * 3.6)} km/h` : "—"}</dd></div>
                <div><dt>{isArabic ? "الاتجاه" : "Heading"}</dt><dd>{Number.isFinite(Number(selectedDriver.location?.heading)) ? `${Math.round(Number(selectedDriver.location?.heading))}°` : "—"}</dd></div>
              </dl>
            </section>
          )}

          {(error || !accessToken) && (
            <section className="dn-nexus-command-map__truth-warning"><AlertTriangle size={15} /><span>{error || (isArabic ? "Mapbox غير مهيأ؛ لن يتم استبداله ببيانات وهمية." : "Mapbox is not configured; no fabricated map data will be substituted.")}</span></section>
          )}
        </aside>

        <div className="dn-nexus-command-map__truth-strip">
          <span className="is-live"><span /> {trafficVisible ? (isArabic ? "حركة طرق حقيقية" : "real traffic") : (isArabic ? "المرور مخفي" : "traffic hidden")}</span>
          <span><Activity size={12} /> {styleMode === "satellite" ? (isArabic ? "صور أقمار صناعية — ليست فيديو مباشر" : "satellite imagery — not live video") : (isArabic ? "خريطة 3D" : "3D map")}</span>
          <span><Truck size={12} /> {stats.online} {isArabic ? "GPS مباشر" : "live GPS"}</span>
          {driversWithoutGps > 0 && <span><WifiOff size={12} /> {driversWithoutGps} {isArabic ? "مندوب بدون GPS" : "drivers without GPS"}</span>}
          {pendingWithoutCoordinates > 0 && <span><MapPinned size={12} /> {pendingWithoutCoordinates} {isArabic ? "طلب بدون إحداثيات" : "orders without coordinates"}</span>}
          <span><Clock3 size={12} /> {lastUpdatedAt ? freshnessLabel(lastUpdatedAt, isArabic) : "—"}</span>
        </div>
      </div>
    </section>
  );
}
