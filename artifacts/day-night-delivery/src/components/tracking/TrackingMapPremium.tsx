import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Radio, Route, Satellite, Truck } from "lucide-react";
import localAssets, { withRemoteFallback } from "../../data/localAssets";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";
import type { Order } from "../../types";

type TrackingMapProps = { order?: Order | null };
type Point = { x: number; y: number; labelAr: string; labelEn: string };

const UAE_BOUNDS = { minLat: 22.55, maxLat: 26.2, minLng: 51.6, maxLng: 56.7 };
const CITIES: Record<string, Point> = {
  abudhabi: { labelAr: "أبوظبي", labelEn: "Abu Dhabi", x: 46, y: 68 },
  mussafah: { labelAr: "مصفح", labelEn: "Mussafah", x: 41, y: 73 },
  dubai: { labelAr: "دبي", labelEn: "Dubai", x: 64, y: 45 },
  sharjah: { labelAr: "الشارقة", labelEn: "Sharjah", x: 70, y: 33 },
  ajman: { labelAr: "عجمان", labelEn: "Ajman", x: 67, y: 28 },
  rak: { labelAr: "رأس الخيمة", labelEn: "Ras Al Khaimah", x: 78, y: 13 },
  fujairah: { labelAr: "الفجيرة", labelEn: "Fujairah", x: 88, y: 36 },
  alain: { labelAr: "العين", labelEn: "Al Ain", x: 78, y: 80 },
  western: { labelAr: "الظفرة", labelEn: "Al Dhafra", x: 23, y: 77 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cityKey(value?: string | null) {
  const v = String(value || "").toLowerCase().replace(/\s+/g, "");
  if (v.includes("dubai") || v.includes("دبي")) return "dubai";
  if (v.includes("sharjah") || v.includes("الشارقة")) return "sharjah";
  if (v.includes("ajman") || v.includes("عجمان")) return "ajman";
  if (v.includes("khaimah") || v.includes("الخيمة")) return "rak";
  if (v.includes("fujairah") || v.includes("الفجيرة")) return "fujairah";
  if (v.includes("ain") || v.includes("العين")) return "alain";
  if (v.includes("mussafah") || v.includes("مصفح")) return "mussafah";
  if (v.includes("dhafra") || v.includes("western") || v.includes("الظفرة") || v.includes("الغربية")) return "western";
  return "abudhabi";
}

function getNum(order: Order | null | undefined, keys: string[]) {
  const source = order as unknown as Record<string, unknown> | null | undefined;
  if (!source) return null;
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function project(lat: number | null, lng: number | null, fallback: Point): Point {
  if (lat === null || lng === null) return fallback;
  const x = 14 + ((lng - UAE_BOUNDS.minLng) / (UAE_BOUNDS.maxLng - UAE_BOUNDS.minLng)) * 76;
  const y = 88 - ((lat - UAE_BOUNDS.minLat) / (UAE_BOUNDS.maxLat - UAE_BOUNDS.minLat)) * 76;
  return { ...fallback, x: clamp(x, 10, 92), y: clamp(y, 9, 88) };
}

function progress(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value.includes("deliver")) return 0.92;
  if (value.includes("out")) return 0.74;
  if (value.includes("transit") || value.includes("route")) return 0.58;
  if (value.includes("pickup") || value.includes("picked")) return 0.34;
  if (value.includes("assign") || value.includes("confirm")) return 0.2;
  return 0.16;
}

function arcPath(from: Point, to: Point) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 16;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function pointOnArc(from: Point, to: Point, t: number) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 16;
  return {
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y,
  };
}

export default function TrackingMapPremium({ order }: TrackingMapProps) {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [lastLiveAt, setLastLiveAt] = useState<Date | null>(null);

  useEffect(() => {
    setLiveOrder(null);
    setLastLiveAt(null);
    if (!supabase || !order?.id) return;
    const supabaseClient = supabase;
    const channel = supabaseClient
      .channel(`dn-premium-live-order-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        setLiveOrder(payload.new as Order);
        setLastLiveAt(new Date());
      })
      .subscribe();
    return () => { supabaseClient.removeChannel(channel); };
  }, [order?.id]);

  const activeOrder = liveOrder || order || null;
  const pickupBase = CITIES[cityKey(activeOrder?.sender_city)] || CITIES.abudhabi;
  const destinationBase = CITIES[cityKey(activeOrder?.receiver_city)] || CITIES.dubai;
  const pickup = project(getNum(activeOrder, ["pickup_lat", "sender_lat", "origin_lat", "from_lat"]), getNum(activeOrder, ["pickup_lng", "sender_lng", "origin_lng", "from_lng", "pickup_lon", "sender_lon"]), pickupBase);
  const destination = project(getNum(activeOrder, ["delivery_lat", "receiver_lat", "destination_lat", "to_lat"]), getNum(activeOrder, ["delivery_lng", "receiver_lng", "destination_lng", "to_lng", "delivery_lon", "receiver_lon"]), destinationBase);
  const driverLat = getNum(activeOrder, ["driver_lat", "current_lat", "live_lat", "courier_lat"]);
  const driverLng = getNum(activeOrder, ["driver_lng", "current_lng", "live_lng", "courier_lng", "driver_lon", "current_lon"]);
  const hasLiveDriver = driverLat !== null && driverLng !== null;
  const moving = hasLiveDriver ? project(driverLat, driverLng, pointOnArc(pickup, destination, 0.55) as Point) : pointOnArc(pickup, destination, progress(activeOrder?.status));
  const status = activeOrder?.status || (isArabic ? "قيد المعالجة" : "Processing");
  const ref = activeOrder?.tracking_code || activeOrder?.tracking_number || activeOrder?.invoice_number || activeOrder?.coupon_number || activeOrder?.id || "DAY NIGHT";
  const last = lastLiveAt ? lastLiveAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : "—";

  const visibleCities = useMemo(() => [pickup, destination, CITIES.dubai, CITIES.sharjah, CITIES.ajman, CITIES.rak, CITIES.fujairah, CITIES.alain]
    .filter((city, index, list) => list.findIndex((item) => item.labelEn === city.labelEn) === index), [pickup.labelEn, destination.labelEn]);

  return (
    <div className="dn-3d-tracking-map relative h-full min-h-[340px] overflow-hidden rounded-2xl border border-brand-gold/20 bg-[#020812]" dir={isArabic ? "rtl" : "ltr"}>
      <img src={localAssets.uaeMap} alt="DAY NIGHT UAE live tracking map" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" onError={(event) => withRemoteFallback(event, localAssets.remote.uaeMap)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.12)_55%,rgba(0,0,0,.70)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(24,168,232,.18),transparent_30%,rgba(245,183,0,.12)_55%,transparent_74%)]" />

      <svg className="pointer-events-none absolute inset-0 z-[4] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={arcPath(pickup, destination)} fill="none" stroke="rgba(5,20,42,.74)" strokeWidth="1.5" strokeLinecap="round" />
        <path className="dn-route-glow" d={arcPath(pickup, destination)} fill="none" stroke="rgba(245,183,0,.98)" strokeWidth=".92" strokeLinecap="round" strokeDasharray="2 2.4" />
        <path d={arcPath(pickup, destination)} fill="none" stroke="rgba(24,168,232,.78)" strokeWidth=".34" strokeLinecap="round" strokeDasharray=".8 2.4" />
      </svg>

      {visibleCities.map((city) => (
        <div key={city.labelEn} className="dn-3d-city-pin absolute z-[7] -translate-x-1/2 -translate-y-1/2" style={{ left: `${city.x}%`, top: `${city.y}%` }}>
          <span />
          <strong>{isArabic ? city.labelAr : city.labelEn}</strong>
        </div>
      ))}

      <div className="dn-3d-driver absolute z-[9] -translate-x-1/2 -translate-y-1/2" style={{ left: `${moving.x}%`, top: `${moving.y}%` }}><Truck className="h-5 w-5" /></div>

      <div className="absolute left-3 right-3 top-3 z-[12] flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-2xl border border-brand-gold/25 bg-[#071A33]/88 px-3 py-2 backdrop-blur-xl shadow-xl">
          <p className="flex items-center gap-2 text-[11px] font-black text-brand-gold"><Radio className="h-3.5 w-3.5 animate-pulse" />{hasLiveDriver ? (isArabic ? "موقع المندوب مباشر" : "Live courier position") : (isArabic ? "مسار الشحنة الحي" : "Live shipment route")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-white/70"><Satellite className="h-3 w-3 text-brand-sky" />{isArabic ? "خريطة DAY NIGHT ثلاثية الأبعاد" : "DAY NIGHT 3D operations map"}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-[#071A33]/82 px-3 py-2 text-[10px] font-black text-white/75 backdrop-blur-xl" dir="ltr">{status} • {String(ref).slice(0, 22)} • {last}</div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-[12] grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#071A33]/86 px-3 py-2 text-[10px] font-bold text-white/70 backdrop-blur-xl max-sm:grid-cols-1">
        <span className="flex items-center justify-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-gold" />{isArabic ? pickup.labelAr : pickup.labelEn}</span>
        <span className="flex items-center justify-center gap-1.5 text-brand-gold"><Route className="h-3.5 w-3.5" />{isArabic ? "مسار نشط" : "Active route"}</span>
        <span className="flex items-center justify-center gap-1.5"><Navigation className="h-3.5 w-3.5 text-brand-sky" />{isArabic ? destination.labelAr : destination.labelEn}</span>
      </div>
    </div>
  );
}
