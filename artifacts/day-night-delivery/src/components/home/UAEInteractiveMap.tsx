import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, Box, Clock3, Globe2, MapPin, PackageCheck, Radar, RefreshCw, ShieldCheck, Truck, Zap } from "lucide-react";
import { supabase } from "../../supabase";
import type { Order } from "../../types";
import "../../styles/dn-dashboard-map.css";

const MAP_IMAGE_URL = "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png";

type CityPoint = { ar: string; en: string; x: number; y: number };
type LiveOrder = Partial<Order> & { id: string; status: string; sender_city?: string; receiver_city?: string; updated_at?: string; created_at?: string };
type MapMode = "live" | "demo" | "empty" | "offline";

const CITY_POINTS: Record<string, CityPoint> = {
  abudhabi: { ar: "أبوظبي", en: "Abu Dhabi", x: 45, y: 64 },
  dubai: { ar: "دبي", en: "Dubai", x: 64, y: 39 },
  sharjah: { ar: "الشارقة", en: "Sharjah", x: 69, y: 29 },
  ajman: { ar: "عجمان", en: "Ajman", x: 65, y: 24 },
  rak: { ar: "رأس الخيمة", en: "Ras Al Khaimah", x: 73, y: 11 },
  fujairah: { ar: "الفجيرة", en: "Fujairah", x: 87, y: 33 },
  alain: { ar: "العين", en: "Al Ain", x: 76, y: 78 },
  western: { ar: "المنطقة الغربية", en: "Western Region", x: 19, y: 69 },
};

const DEMO_ORDERS: LiveOrder[] = [
  { id: "DN-LIVE-001", tracking_code: "DN-LIVE-001", status: "Out for Delivery", sender_city: "Abu Dhabi", receiver_city: "Dubai", created_at: new Date().toISOString() },
  { id: "DN-LIVE-002", tracking_code: "DN-LIVE-002", status: "Picked Up", sender_city: "Abu Dhabi", receiver_city: "Sharjah", created_at: new Date().toISOString() },
  { id: "DN-LIVE-003", tracking_code: "DN-LIVE-003", status: "In Transit", sender_city: "Dubai", receiver_city: "Ras Al Khaimah", created_at: new Date().toISOString() },
  { id: "DN-LIVE-004", tracking_code: "DN-LIVE-004", status: "Assigned", sender_city: "Abu Dhabi", receiver_city: "Al Ain", created_at: new Date().toISOString() },
];

const bottomFeatures = [
  { icon: ShieldCheck, title: "تغطية موثوقة", description: "في جميع أنحاء الدولة", tone: "blue" },
  { icon: Zap, title: "تسعير لحظي", description: "حسب المسافة والوقت", tone: "gold" },
  { icon: Clock3, title: "خدمة 24 / 7", description: "نهاراً وليلاً", tone: "gold" },
  { icon: Box, title: "تتبع مباشر", description: "لحظة بلحظة", tone: "blue" },
];

const glassStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.13)",
  background: "linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.045))",
  backdropFilter: "blur(24px)",
  boxShadow: "0 28px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.14)",
};

function resolveCity(city?: string | null): CityPoint {
  const value = String(city || "").toLowerCase();
  if (value.includes("dubai") || value.includes("دبي")) return CITY_POINTS.dubai;
  if (value.includes("sharjah") || value.includes("الشارقة")) return CITY_POINTS.sharjah;
  if (value.includes("ajman") || value.includes("عجمان")) return CITY_POINTS.ajman;
  if (value.includes("quwain") || value.includes("القيوين")) return CITY_POINTS.ajman;
  if (value.includes("khaimah") || value.includes("الخيمة")) return CITY_POINTS.rak;
  if (value.includes("fujairah") || value.includes("الفجيرة")) return CITY_POINTS.fujairah;
  if (value.includes("ain") || value.includes("العين")) return CITY_POINTS.alain;
  if (value.includes("western") || value.includes("الغربية") || value.includes("dhafra") || value.includes("الظفرة")) return CITY_POINTS.western;
  return CITY_POINTS.abudhabi;
}

function routePath(from: CityPoint, to: CityPoint) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 16;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function routePoint(from: CityPoint, to: CityPoint, t: number) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 16;
  const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
  const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
  return { x, y };
}

function statusProgress(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s.includes("deliver")) return 0.86;
  if (s.includes("transit") || s.includes("route")) return 0.58;
  if (s.includes("pickup") || s.includes("picked")) return 0.34;
  if (s.includes("assign")) return 0.18;
  return 0.25;
}

function displayTracking(order: LiveOrder) {
  return order.tracking_code || order.tracking_number || order.id;
}

export default function UAEInteractiveMap() {
  const [orders, setOrders] = useState<LiveOrder[]>(DEMO_ORDERS);
  const [drivers, setDrivers] = useState(0);
  const [mode, setMode] = useState<MapMode>("demo");
  const [selectedId, setSelectedId] = useState(DEMO_ORDERS[0].id);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [now, setNow] = useState(Date.now());

  async function loadLiveOperations() {
    setLastUpdated(new Date());

    if (!supabase) {
      setMode("demo");
      setOrders(DEMO_ORDERS);
      setDrivers(4);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id,tracking_code,tracking_number,status,sender_city,receiver_city,driver_name,driver_phone,created_at,updated_at,delivery_price")
      .order("updated_at", { ascending: false })
      .limit(18);

    const { data: driverRows } = await supabase.from("driver_locations").select("*").limit(60);

    if (error) {
      setMode("offline");
      setOrders(DEMO_ORDERS);
      setDrivers(Array.isArray(driverRows) ? driverRows.length : 0);
      return;
    }

    const active = (data || []).filter((order: any) => !String(order.status || "").toLowerCase().includes("cancel")) as LiveOrder[];
    setOrders(active.length ? active : DEMO_ORDERS);
    setMode(active.length ? "live" : "empty");
    setDrivers(Array.isArray(driverRows) ? driverRows.length : 0);
    if (active[0]?.id) setSelectedId(active[0].id);
  }

  useEffect(() => {
    void loadLiveOperations();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => void loadLiveOperations(), 30000);

    const channel = supabase
      ?.channel("dn-live-uae-operations-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadLiveOperations())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => void loadLiveOperations())
      .subscribe();

    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  const routes = useMemo(() => orders.slice(0, 10).map((order, index) => {
    const from = resolveCity(order.sender_city);
    const to = resolveCity(order.receiver_city);
    const liveOffset = ((now / 1000 + index * 11) % 100) / 100;
    const base = statusProgress(order.status);
    const progress = Math.min(0.96, Math.max(0.04, base * 0.68 + liveOffset * 0.32));
    return { order, from, to, progress, point: routePoint(from, to, progress), selected: order.id === selectedId };
  }), [orders, now, selectedId]);

  const cityLoad = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((order) => {
      const city = resolveCity(order.receiver_city).ar;
      map.set(city, (map.get(city) || 0) + 1);
    });
    return map;
  }, [orders]);

  const selectedOrder = routes.find((route) => route.selected)?.order || routes[0]?.order;
  const formattedUpdateTime = useMemo(() => lastUpdated.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" }), [lastUpdated]);
  const modeLabel = mode === "live" ? "LIVE DATA" : mode === "offline" ? "FALLBACK" : mode === "empty" ? "NO ACTIVE ORDERS" : "DEMO MOTION";

  return (
    <section className="relative w-full overflow-hidden px-4 py-16 text-white sm:px-8 lg:px-12" dir="rtl" style={{ background: "radial-gradient(circle at 16% 18%,rgba(0,123,255,.24),transparent 34%),radial-gradient(circle at 84% 12%,rgba(245,183,0,.16),transparent 30%),linear-gradient(135deg,#030a18,#071a33 48%,#01050f)" }}>
      <style>{`@keyframes dnRouteDash{to{stroke-dashoffset:-42}}@keyframes dnTruckFloat{50%{transform:translate(-50%,-62%) scale(1.08)}}`}</style>
      <div className="pointer-events-none absolute right-[5%] top-[10%] h-60 w-60 rounded-full bg-blue-500/15 blur-2xl" />
      <div className="pointer-events-none absolute bottom-[16%] left-[9%] h-48 w-48 rounded-full bg-yellow-400/10 blur-2xl" />

      <div className="relative z-[3] mx-auto mb-7 flex w-[min(1180px,100%)] flex-col items-stretch justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-[780px]">
          <span className="mb-3 inline-flex rounded-full border border-[#f5b700]/25 bg-[#f5b700]/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#f5b700]">DAY NIGHT LIVE OPS</span>
          <h2 className="m-0 text-[clamp(30px,4vw,54px)] font-black leading-[1.08] text-white">خريطة تشغيل حية وعملية</h2>
          <p className="mt-4 max-w-[760px] text-[clamp(15px,1.5vw,18px)] font-bold leading-[1.95] text-white/70">تتحرك المسارات حسب الطلبات الحالية، وتستقبل تحديثات Supabase Realtime عند تغيّر الطلبات أو مواقع السائقين. عند عدم توفر صلاحيات القراءة يظهر وضع حركة تشغيلي احتياطي بوضوح.</p>
        </div>
        <div className="flex min-w-[265px] items-center gap-3 rounded-[22px] p-4" style={glassStyle}>
          <span className="grid h-[46px] w-[46px] place-items-center rounded-2xl border border-[#18a8e8]/20 bg-[#18a8e8]/15 text-[#18a8e8]"><Radar size={23} /></span>
          <div><strong className="block text-sm font-black text-white">{modeLabel}</strong><span className="mt-1 block text-xs font-bold text-white/60">آخر تحديث: {formattedUpdateTime}</span></div>
          <button onClick={() => void loadLiveOperations()} className="ms-auto grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-[#f5b700] hover:bg-[#f5b700] hover:text-[#071a33]"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="relative z-[3] mx-auto w-[min(1180px,100%)] overflow-hidden rounded-[36px] p-4" style={{ border: "1px solid rgba(24,168,232,.19)", background: "linear-gradient(145deg,rgba(4,17,39,.95),rgba(1,7,20,.99))", boxShadow: "0 44px 120px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.13)" }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_310px]">
          <div className="relative min-h-[520px] overflow-hidden rounded-[30px] bg-[#061225] max-md:min-h-[440px]">
            {imageLoaded ? <img className="absolute inset-0 h-full w-full object-cover object-center" src={MAP_IMAGE_URL} alt="DAY NIGHT UAE 3D live operations map" loading="eager" decoding="async" onError={() => setImageLoaded(false)} style={{ filter: "saturate(1.08) contrast(1.05) brightness(.9)" }} /> : <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-[#071a33] text-center"><Globe2 size={56} className="text-[#18a8e8]" /><strong className="text-xl font-black">تعذر تحميل صورة الخريطة</strong></div>}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.18)_58%,rgba(0,0,0,.45)_100%)]" />

            <svg className="pointer-events-none absolute inset-0 z-[6] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {routes.map(({ order, from, to, selected }) => <path key={order.id} d={routePath(from, to)} fill="none" stroke={selected ? "rgba(245,183,0,.95)" : "rgba(24,168,232,.54)"} strokeWidth={selected ? 0.7 : 0.36} strokeLinecap="round" strokeDasharray="2 2.8" style={{ animation: "dnRouteDash 2.4s linear infinite", filter: selected ? "drop-shadow(0 0 8px rgba(245,183,0,.9))" : "drop-shadow(0 0 5px rgba(24,168,232,.55))" }} />)}
            </svg>

            {Object.values(CITY_POINTS).map((city) => <button key={city.ar} className="absolute z-[9] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5b700]/45 bg-[#071a33]/70 p-2 text-[#f5b700] shadow-[0_0_22px_rgba(245,183,0,.28)] backdrop-blur" style={{ left: `${city.x}%`, top: `${city.y}%` }} title={city.ar}><MapPin size={16} /><span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#f5b700] px-1 text-[10px] font-black text-[#071a33]">{cityLoad.get(city.ar) || 0}</span></button>)}

            {routes.map(({ order, point, selected }) => <button key={`${order.id}-truck`} onClick={() => setSelectedId(order.id)} className={`absolute z-[10] grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border ${selected ? "border-[#f5b700] bg-[#f5b700] text-[#071a33]" : "border-[#18a8e8]/50 bg-[#071a33]/80 text-[#18a8e8]"} shadow-[0_0_24px_rgba(24,168,232,.45)] backdrop-blur`} style={{ left: `${point.x}%`, top: `${point.y}%`, animation: "dnTruckFloat 2.2s ease-in-out infinite" }} title={displayTracking(order)}><Truck size={18} /></button>)}

            <div className="absolute bottom-4 left-4 right-4 z-[12] grid grid-cols-3 gap-2 max-md:grid-cols-1">
              {[{ label: "طلبات نشطة", value: orders.length }, { label: "سائقون متصلون", value: drivers || "—" }, { label: "تحديث", value: "30s" }].map((item) => <div key={item.label} className="rounded-2xl p-3 text-center" style={glassStyle}><strong className="block text-xl font-black text-white" dir="ltr">{item.value}</strong><span className="text-xs font-bold text-white/55">{item.label}</span></div>)}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[24px] p-4" style={glassStyle}>
              <div className="mb-3 flex items-center gap-2 text-[#f5b700]"><Activity size={18} /><strong>لوحة التشغيل</strong></div>
              <p className="text-xs font-bold leading-6 text-white/60">المسارات المتحركة ليست صورة ثابتة: يتم حسابها من مدينة الإرسال والاستلام لكل طلب، وتتغير عند وصول تحديث جديد.</p>
            </div>

            {selectedOrder && <div className="rounded-[24px] p-4" style={glassStyle}>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#f5b700]">Selected Shipment</span>
              <h3 className="mt-2 text-2xl font-black text-white" dir="ltr">{displayTracking(selectedOrder)}</h3>
              <p className="mt-2 text-sm font-bold text-white/65">{selectedOrder.sender_city || "Abu Dhabi"} ← {selectedOrder.receiver_city || "Dubai"}</p>
              <p className="mt-1 text-xs font-black text-[#18a8e8]">{selectedOrder.status}</p>
            </div>}

            <div className="rounded-[24px] p-3" style={glassStyle}>
              <div className="mb-2 flex items-center justify-between"><strong className="text-sm text-white">آخر الحركة</strong><span className="text-[11px] text-white/45">نبضة #{Math.floor(now / 1000) % 999}</span></div>
              <div className="space-y-2">
                {orders.slice(0, 6).map((order) => <button key={order.id} onClick={() => setSelectedId(order.id)} className={`w-full rounded-2xl border p-3 text-right transition ${order.id === selectedId ? "border-[#f5b700]/60 bg-[#f5b700]/10" : "border-white/10 bg-white/[0.035] hover:border-[#18a8e8]/45"}`}><span className="block text-xs font-black text-white" dir="ltr">{displayTracking(order)}</span><span className="mt-1 block text-[11px] font-bold text-white/50">{order.status} • {order.receiver_city || "UAE"}</span></button>)}
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {bottomFeatures.map((feature) => { const Icon = feature.icon; return <div key={feature.title} className="flex items-center gap-3 rounded-2xl p-4" style={glassStyle}><Icon size={24} className={feature.tone === "blue" ? "text-[#18a8e8]" : "text-[#f5b700]"} /><div><strong className="block text-sm font-black text-white">{feature.title}</strong><span className="text-xs font-bold text-white/55">{feature.description}</span></div></div>; })}
        </div>
      </div>
    </section>
  );
}
