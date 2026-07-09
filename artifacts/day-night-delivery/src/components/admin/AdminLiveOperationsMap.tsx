import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Crosshair, Layers, LocateFixed, MapPin, Navigation, Radio, RefreshCw, Route, Satellite, Truck } from "lucide-react";
import { defaultLocations } from "../../data/defaultLocations";
import { getOrderNumber, getOrderReference, getOrderRouteCities, getOrderString, interpolatePoint, progressFromStatus, resolveUaePoint, type LatLngTuple } from "../../lib/mapUtils";

type MapMode = "standard" | "satellite" | "terrain";
type FocusCommand = { type: "fit" | "driver"; nonce: number } | null;

export type AdminLiveOperationsMapProps = { isArabic: boolean; orders: any[]; selectedOrder?: any | null };

const pickupIcon = L.divIcon({ className: "dn-live-map-marker dn-live-map-marker-pickup", html: `<div class="dn-marker-core"><span></span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const destinationIcon = L.divIcon({ className: "dn-live-map-marker dn-live-map-marker-dest", html: `<div class="dn-marker-core"><span></span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const driverIcon = L.divIcon({ className: "dn-live-map-driver", html: `<div class="dn-driver-pulse"><span>DN</span></div>`, iconSize: [48, 48], iconAnchor: [24, 24] });

function isActiveOrder(order: any) { const status = String(order?.status || "").toLowerCase(); return !status.includes("deliver") && !status.includes("cancel") && !status.includes("return"); }
function statusText(status: unknown, isArabic: boolean) { const raw = String(status || "pending").toLowerCase().replace(/[_-]/g, " "); if (raw.includes("deliver")) return isArabic ? "تم التسليم" : "Delivered"; if (raw.includes("transit")) return isArabic ? "جاري التوصيل" : "In Transit"; if (raw.includes("assign")) return isArabic ? "تم التعيين" : "Assigned"; if (raw.includes("pick")) return isArabic ? "قيد الإحضار" : "Pickup"; if (raw.includes("review")) return isArabic ? "قيد المراجعة" : "Under Review"; if (raw.includes("cancel")) return isArabic ? "ملغي" : "Cancelled"; return raw.includes("pending") ? (isArabic ? "قيد الانتظار" : "Pending") : raw; }
function km(meters: number | null, isArabic: boolean) { if (!meters) return isArabic ? "غير متاح" : "Not available"; return `${(meters / 1000).toFixed(1)} km`; }

function MapController({ points, driver, command }: { points: LatLngTuple[]; driver: LatLngTuple; command: FocusCommand }) {
  const map = useMap();
  useEffect(() => { const valid = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)); if (valid.length > 1) map.fitBounds(valid, { padding: [56, 56], maxZoom: 12, animate: true }); }, [map, points]);
  useEffect(() => { if (!command) return; if (command.type === "fit") map.fitBounds(points, { padding: [64, 64], maxZoom: 13, animate: true }); if (command.type === "driver") map.flyTo(driver, 13, { animate: true }); }, [command, driver, map, points]);
  return null;
}

export default function AdminLiveOperationsMap({ isArabic, orders, selectedOrder }: AdminLiveOperationsMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const [tileFailed, setTileFailed] = useState(false);
  const [routePoints, setRoutePoints] = useState<LatLngTuple[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeEstimated, setRouteEstimated] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [focusCommand, setFocusCommand] = useState<FocusCommand>(null);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => setIsMounted(true), []);

  const selectableOrders = useMemo(() => [...(orders || [])].sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()).filter((o, i) => i < 80 && (isActiveOrder(o) || i < 20)), [orders]);
  useEffect(() => { if (selectedOrder?.id) setSelectedId(String(selectedOrder.id)); else if (!selectableOrders.some((o) => String(o.id || getOrderReference(o)) === selectedId)) setSelectedId(String((selectableOrders.find(isActiveOrder) || selectableOrders[0])?.id || "")); }, [selectableOrders, selectedOrder?.id, selectedId]);
  const activeOrder = useMemo(() => selectedOrder || selectableOrders.find((o) => String(o.id || getOrderReference(o)) === selectedId) || selectableOrders.find(isActiveOrder) || selectableOrders[0] || null, [selectableOrders, selectedId, selectedOrder]);

  const { pickupCity, deliveryCity } = getOrderRouteCities(activeOrder);
  const pickup = resolveUaePoint(pickupCity, defaultLocations.mussafah);
  const destination = resolveUaePoint(deliveryCity, defaultLocations.abuDhabi);
  const pickupPos: LatLngTuple = [getOrderNumber(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]) ?? pickup.lat, getOrderNumber(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]) ?? pickup.lng];
  const destPos: LatLngTuple = [getOrderNumber(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]) ?? destination.lat, getOrderNumber(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]) ?? destination.lng];
  const driverLat = getOrderNumber(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getOrderNumber(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);
  const hasLiveDriver = driverLat !== null && driverLng !== null;
  const driverPos: LatLngTuple = hasLiveDriver && driverLat !== null && driverLng !== null ? [driverLat, driverLng] : interpolatePoint(pickupPos, destPos, progressFromStatus(getOrderString(activeOrder, ["status"])));
  const fitPoints = [pickupPos, driverPos, destPos];
  const routeWaypoints = useMemo(() => (hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]).map(([lat, lng]) => `${lng},${lat}`).join(";"), [hasLiveDriver, pickupPos[0], pickupPos[1], driverPos[0], driverPos[1], destPos[0], destPos[1]]);

  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    async function fetchRoute() {
      setRouteEstimated(false); setRouteDistance(null);
      try { const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${routeWaypoints}?overview=full&geometries=geojson&alternatives=false&steps=false`, { signal: controller.signal }); const data = await res.json(); const route = data?.routes?.[0]; const coords = route?.geometry?.coordinates; if (!cancelled && Array.isArray(coords) && coords.length > 1) { setRoutePoints(coords.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple)); setRouteDistance(Number(route.distance || 0)); return; } } catch { /* real-map fallback below */ }
      if (!cancelled) { setRouteEstimated(true); setRoutePoints(hasLiveDriver ? [pickupPos, driverPos, destPos] : [pickupPos, destPos]); }
    }
    void fetchRoute(); return () => { cancelled = true; controller.abort(); };
  }, [routeWaypoints, hasLiveDriver, refreshNonce]);

  if (!isMounted) return <div className="dn-live-map-shell dn-admin-live-ops-map min-h-[380px] animate-pulse" />;
  const modes = [{ mode: "standard" as const, ar: "عادي", en: "Standard" }, { mode: "satellite" as const, ar: "ساتلايت", en: "Satellite" }, { mode: "terrain" as const, ar: "تضاريس", en: "Terrain" }];
  const currentMode = modes.find((m) => m.mode === mapMode) || modes[0];
  const reference = getOrderReference(activeOrder);
  const liveLabel = hasLiveDriver ? (isArabic ? "مباشر" : "Live") : (isArabic ? "تقديري" : "Estimated");
  const driverName = getOrderString(activeOrder, ["driver_name", "assigned_driver_name", "courier_name"]) || (isArabic ? "غير معين" : "Unassigned");
  const tileHandlers = { tileerror: () => setTileFailed(true) };
  const layerKey = `${mapMode}-${refreshNonce}`;
  const layers = mapMode === "standard" ? <TileLayer key={layerKey} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={tileHandlers} /> : mapMode === "terrain" ? <TileLayer key={layerKey} url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution="Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap" eventHandlers={tileHandlers} /> : <><TileLayer key={`${layerKey}-imagery`} url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" eventHandlers={tileHandlers} /><TileLayer key={`${layerKey}-labels`} url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" attribution="Labels &copy; Esri" eventHandlers={tileHandlers} /></>;

  return <div className={`dn-live-map-shell dn-admin-live-ops-map is-${mapMode} relative h-[520px] w-full overflow-hidden rounded-[28px] border border-brand-gold/25 bg-[#020812]`} dir={isArabic ? "rtl" : "ltr"}>
    <div className="dn-admin-map-control-panel">
      <div className="dn-admin-map-title"><Radio className="h-4 w-4 animate-pulse" /><div><strong>{isArabic ? "خريطة العمليات الحية" : "Live Operations Map"}</strong><span>{isArabic ? `الوضع الحالي: ${currentMode.ar}` : `Current mode: ${currentMode.en}`}</span></div></div>
      <label><span>{isArabic ? "اختيار الشحنة" : "Select shipment"}</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} dir={isArabic ? "rtl" : "ltr"}>{selectableOrders.map((order) => { const route = getOrderRouteCities(order); const id = String(order.id || getOrderReference(order)); return <option key={id} value={id}>{`${getOrderReference(order)} — ${route.pickupCity} → ${route.deliveryCity} — ${statusText(order.status, isArabic)}`}</option>; })}</select></label>
      <div className="dn-admin-map-modes"><Layers className="h-3.5 w-3.5 text-brand-gold" />{modes.map((item) => <button key={item.mode} type="button" onClick={() => { setTileFailed(false); setMapMode(item.mode); setRefreshNonce((n) => n + 1); }} className={mapMode === item.mode ? "is-active" : ""}>{isArabic ? item.ar : item.en}</button>)}</div>
    </div>
    <div className="dn-admin-map-route-card"><b dir="ltr">{String(reference).slice(0, 24)}</b><span>{pickupCity} → {deliveryCity}</span><span>{isArabic ? "الموقع" : "Point"}: {liveLabel}</span><span>{isArabic ? "المسافة" : "Distance"}: {routeEstimated ? (isArabic ? "تقديرية" : "Estimated") : km(routeDistance, isArabic)}</span><span>{isArabic ? "المندوب" : "Driver"}: {driverName}</span><span>{isArabic ? "الحالة" : "Status"}: {statusText(activeOrder?.status, isArabic)}</span></div>
    <div className="dn-admin-map-actions"><button type="button" onClick={() => setFocusCommand({ type: "fit", nonce: Date.now() })}><Crosshair className="h-3.5 w-3.5" />{isArabic ? "ضبط المسار" : "Fit route"}</button><button type="button" onClick={() => setFocusCommand({ type: "driver", nonce: Date.now() })}><LocateFixed className="h-3.5 w-3.5" />{isArabic ? "تتبع المندوب" : "Center driver"}</button><button type="button" onClick={() => { setTileFailed(false); setRefreshNonce((n) => n + 1); }}><RefreshCw className="h-3.5 w-3.5" />{isArabic ? "تحديث المسار" : "Refresh route"}</button></div>
    {tileFailed && <div className="dn-admin-map-tile-warning">{isArabic ? "تعذر تحميل طبقة الخريطة مؤقتاً" : "Map tile layer could not be loaded temporarily"}</div>}
    <MapContainer key={`map-${mapMode}`} center={driverPos} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl>{layers}<MapController points={fitPoints} driver={driverPos} command={focusCommand} /><Polyline positions={routePoints.length ? routePoints : [pickupPos, destPos]} pathOptions={{ color: "#D4AF37", weight: 6, opacity: 0.94 }} /><Polyline positions={[pickupPos, driverPos, destPos]} pathOptions={{ color: "#18A8E8", weight: 2.5, opacity: 0.78, dashArray: "10 12" }} />{(routePoints.length ? routePoints : [pickupPos, driverPos, destPos]).filter((_, index) => index % Math.max(1, Math.floor((routePoints.length || 3) / 12)) === 0).map((point, index) => <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={2.8} pathOptions={{ color: "#F5B700", fillColor: "#F5B700", fillOpacity: 0.75, opacity: 0.55 }} />)}<Marker position={pickupPos} icon={pickupIcon}><Popup><b>{isArabic ? "نقطة الاستلام" : "Pickup Point"}</b><br />{getOrderString(activeOrder, ["sender_address", "pickup_address", "origin_address"]) || (isArabic ? pickup.labelAr : pickup.labelEn)}</Popup></Marker><Marker position={driverPos} icon={driverIcon}><Popup><b>DAY NIGHT</b><br />{hasLiveDriver ? (isArabic ? "الموقع الحالي" : "Current Location") : (isArabic ? "الموقع الحالي / تقديري" : "Current Location / Estimated")}</Popup></Marker><Marker position={destPos} icon={destinationIcon}><Popup><b>{isArabic ? "نقطة التسليم" : "Delivery Point"}</b><br />{getOrderString(activeOrder, ["receiver_address", "delivery_address", "destination_address"]) || (isArabic ? destination.labelAr : destination.labelEn)}</Popup></Marker></MapContainer>
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[650] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#071A33]/80 px-3 py-2 text-[10px] font-bold text-white/70 backdrop-blur-md"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span><span className="flex items-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{routeEstimated ? (isArabic ? "مسار تقديري" : "Estimated route") : (isArabic ? "مسار طرق حقيقي" : "Real road route")}</span><span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-brand-sky" />{liveLabel}</span><span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span></div>
  </div>;
}
