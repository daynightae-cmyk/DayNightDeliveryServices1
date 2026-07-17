import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, MapPin, Navigation, RefreshCw, Radar, Store, Truck } from "lucide-react";
import { fetchPublicLiveOperationsMap } from "../../supabase";
import localAssets, { withRemoteFallback } from "../../data/localAssets";

const MAP_IMAGE_URL = localAssets.uaeMap;

type MapRow = {
  tracking_ref?: string | null;
  status?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
};

type CityPoint = { ar: string; en: string; x: number; y: number };
type RouteItem = { id: string; code: string; status: string; fromName: string; toName: string; from: CityPoint; to: CityPoint; selected: boolean; point: { x: number; y: number } };

const CITIES: Record<string, CityPoint> = {
  abudhabi: { ar: "أبوظبي", en: "Abu Dhabi", x: 46, y: 66 },
  dubai: { ar: "دبي", en: "Dubai", x: 64, y: 43 },
  sharjah: { ar: "الشارقة", en: "Sharjah", x: 69, y: 31 },
  ajman: { ar: "عجمان", en: "Ajman", x: 66, y: 26 },
  rak: { ar: "رأس الخيمة", en: "Ras Al Khaimah", x: 75, y: 13 },
  fujairah: { ar: "الفجيرة", en: "Fujairah", x: 88, y: 35 },
  alain: { ar: "العين", en: "Al Ain", x: 78, y: 79 },
  western: { ar: "المنطقة الغربية", en: "Western Region", x: 19, y: 72 },
};

function clean(value?: unknown) {
  return String(value || "").trim();
}

function resolveCity(name?: string | null): CityPoint {
  const value = clean(name).toLowerCase();
  if (value.includes("dubai") || value.includes("دبي")) return CITIES.dubai;
  if (value.includes("sharjah") || value.includes("الشارقة")) return CITIES.sharjah;
  if (value.includes("ajman") || value.includes("عجمان")) return CITIES.ajman;
  if (value.includes("khaimah") || value.includes("الخيمة")) return CITIES.rak;
  if (value.includes("fujairah") || value.includes("الفجيرة")) return CITIES.fujairah;
  if (value.includes("ain") || value.includes("العين")) return CITIES.alain;
  if (value.includes("western") || value.includes("الغربية") || value.includes("dhafra") || value.includes("الظفرة")) return CITIES.western;
  return CITIES.abudhabi;
}

function routePath(from: CityPoint, to: CityPoint) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 15;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function routePoint(from: CityPoint, to: CityPoint, t: number) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 15;
  return {
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y,
  };
}

function progressFromStatus(status?: string | null) {
  const value = clean(status).toLowerCase();
  if (value.includes("deliver")) return 0.82;
  if (value.includes("transit") || value.includes("route")) return 0.58;
  if (value.includes("pickup") || value.includes("picked")) return 0.34;
  if (value.includes("assign")) return 0.18;
  return 0.24;
}

function statusLabel(status?: string | null) {
  const value = clean(status).toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    pending: "بانتظار التشغيل",
    confirmed: "مؤكد",
    assigned: "مع المندوب",
    accepted: "تم قبول المهمة",
    picked_up: "تم الاستلام",
    in_transit: "في الطريق",
    out_for_delivery: "خارج للتسليم",
    delivered: "تم التسليم",
    returned: "راجع",
    cancelled: "ملغي",
  };
  return labels[value] || clean(status) || "قيد المتابعة";
}

export default function UAEInteractiveMap() {
  const [rows, setRows] = useState<MapRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [signalCount, setSignalCount] = useState<number | string>(0);
  const [mode, setMode] = useState("بانتظار بيانات التشغيل");
  const [selected, setSelected] = useState("");
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [now, setNow] = useState(Date.now());

  const refreshMap = useCallback(async () => {
    setUpdatedAt(new Date());

    try {
      const payload = await fetchPublicLiveOperationsMap(18);

      if (!payload) {
        setRows([]);
        setActiveCount(0);
        setSignalCount(0);
        setMode("الخريطة بانتظار اتصال التشغيل");
        setSelected("");
        return;
      }

      const safeRows = Array.isArray(payload.orders) ? payload.orders : [];
      setRows(safeRows);
      setActiveCount(Number(payload.active_orders_count ?? safeRows.length) || 0);
      setSignalCount(Number(payload.driver_count ?? 0));
      setMode(safeRows.length ? "تشغيل متصل" : "لا توجد مسارات نشطة الآن");

      const firstIndex = safeRows.findIndex((row) => clean(row.tracking_ref) && clean(row.sender_city) && clean(row.receiver_city));
      setSelected(firstIndex >= 0 ? `${clean(safeRows[firstIndex].tracking_ref)}-${firstIndex}` : "");
    } catch (error) {
      console.error("[DAY NIGHT public operations map]", error);
      setRows([]);
      setActiveCount(0);
      setSignalCount(0);
      setMode("التحديث غير متاح مؤقتاً");
      setSelected("");
    }
  }, []);

  useEffect(() => {
    void refreshMap();
    const pulse = window.setInterval(() => setNow(Date.now()), 1000);
    const timer = window.setInterval(() => void refreshMap(), 30000);
    return () => {
      window.clearInterval(pulse);
      window.clearInterval(timer);
    };
  }, [refreshMap]);

  const routes = useMemo<RouteItem[]>(() => rows.slice(0, 10).flatMap((row, index) => {
    const code = clean(row.tracking_ref);
    const fromName = clean(row.sender_city);
    const toName = clean(row.receiver_city);
    if (!code || !fromName || !toName) return [];

    const id = `${code}-${index}`;
    const from = resolveCity(fromName);
    const to = resolveCity(toName);
    const movement = ((now / 1000 + index * 8) % 100) / 100;
    const progress = Math.min(0.96, Math.max(0.04, progressFromStatus(row.status) * 0.64 + movement * 0.36));
    return [{ id, code, status: statusLabel(row.status), fromName, toName, from, to, selected: id === selected, point: routePoint(from, to, progress) }];
  }), [rows, now, selected]);

  const cityLoad = useMemo(() => {
    const output = new Map<string, number>();
    rows.forEach((row) => {
      if (!clean(row.receiver_city)) return;
      const label = resolveCity(row.receiver_city).ar;
      output.set(label, (output.get(label) || 0) + 1);
    });
    return output;
  }, [rows]);

  const active = routes.find((route) => route.selected) || routes[0];
  const timeLabel = updatedAt.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });
  const hasRoutes = routes.length > 0;

  const linkedActions = [
    { href: "/tracking", label: "تتبع شحنة", icon: Radar },
    { href: "/merchant", label: "بوابة التاجر", icon: Store },
    { href: "/driver", label: "بوابة المندوب", icon: Navigation },
  ];

  return (
    <section className="relative w-full overflow-hidden px-3 py-14 text-white sm:px-6 lg:px-10" dir="rtl" style={{ background: "linear-gradient(135deg,#030a18,#071a33 48%,#01050f)" }}>
      <style>{`@keyframes dnRouteDash{to{stroke-dashoffset:-44}}@keyframes dnTruckFloat{50%{transform:translate(-50%,-62%) scale(1.08)}}`}</style>

      <div className="mx-auto mb-7 flex w-[min(1680px,100%)] flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <span className="mb-3 inline-flex rounded-full border border-[#f5b700]/25 bg-[#f5b700]/10 px-4 py-1.5 text-xs font-black tracking-[0.14em] text-[#f5b700]">DAY NIGHT CONNECTED OPERATIONS</span>
          <h2 className="m-0 text-[clamp(30px,4vw,58px)] font-black leading-[1.08]">خريطة التشغيل المتصلة</h2>
          <p className="mt-4 max-w-[860px] text-sm font-bold leading-8 text-white/70">تعرض المسارات المتاحة من منظومة الطلبات وتربط التتبع بتجربة التاجر والمندوب والإدارة.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {linkedActions.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black text-white/75 backdrop-blur transition hover:border-[#f5b700]/50 hover:text-[#f5b700]">
              <Icon size={15} /> {label}
            </a>
          ))}
          <button onClick={() => void refreshMap()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-[#f5b700] backdrop-blur transition hover:bg-[#f5b700] hover:text-[#071a33]">
            <RefreshCw size={16} /> تحديث الآن
          </button>
        </div>
      </div>

      <div className="mx-auto grid w-[min(1680px,100%)] grid-cols-1 gap-4 rounded-[36px] border border-[#18a8e8]/20 bg-[#061225]/90 p-3 shadow-2xl sm:p-4 lg:grid-cols-[1fr_360px]">
        <div className="relative min-h-[560px] overflow-hidden rounded-[30px] bg-[#030a18] lg:min-h-[640px]">
          <img src={MAP_IMAGE_URL} alt="DAY NIGHT UAE operations map" className="absolute inset-0 h-full w-full object-cover brightness-90" onError={(event) => withRemoteFallback(event, localAssets.remote.uaeMap)} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.22)_65%,rgba(0,0,0,.55)_100%)]" />

          <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {routes.map((route) => (
              <path key={route.id} d={routePath(route.from, route.to)} fill="none" stroke={route.selected ? "rgba(245,183,0,.95)" : "rgba(24,168,232,.58)"} strokeWidth={route.selected ? 0.72 : 0.38} strokeLinecap="round" strokeDasharray="2 2.7" style={{ animation: "dnRouteDash 2.4s linear infinite", filter: route.selected ? "drop-shadow(0 0 8px rgba(245,183,0,.8))" : "drop-shadow(0 0 5px rgba(24,168,232,.55))" }} />
            ))}
          </svg>

          {Object.values(CITIES).map((city) => (
            <button key={city.ar} className="absolute z-[8] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5b700]/45 bg-[#071a33]/75 p-2 text-[#f5b700] shadow-[0_0_22px_rgba(245,183,0,.28)] backdrop-blur" style={{ left: `${city.x}%`, top: `${city.y}%` }} title={city.ar} type="button">
              <MapPin size={15} />
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#f5b700] px-1 text-[10px] font-black text-[#071a33]">{cityLoad.get(city.ar) || 0}</span>
            </button>
          ))}

          {routes.map((route) => (
            <button key={`${route.id}-vehicle`} onClick={() => setSelected(route.id)} className={`absolute z-[9] grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border ${route.selected ? "border-[#f5b700] bg-[#f5b700] text-[#071a33]" : "border-[#18a8e8]/50 bg-[#071a33]/80 text-[#18a8e8]"} shadow-[0_0_24px_rgba(24,168,232,.45)] backdrop-blur`} style={{ left: `${route.point.x}%`, top: `${route.point.y}%`, animation: "dnTruckFloat 2.2s ease-in-out infinite" }} title={route.code} type="button">
              <Truck size={18} />
            </button>
          ))}

          {!hasRoutes && (
            <div className="absolute inset-0 z-[12] grid place-items-center p-5">
              <div className="max-w-md rounded-[28px] border border-white/10 bg-[#061225]/82 p-6 text-center shadow-2xl shadow-black/35 backdrop-blur-xl">
                <Radar className="mx-auto mb-4 h-10 w-10 text-[#f5b700]" />
                <h3 className="text-2xl font-black text-white">لا توجد مسارات نشطة الآن</h3>
                <p className="mt-3 text-sm font-bold leading-7 text-white/62">عند توفر طلبات مرتبطة بالتتبع ستظهر الحركة على الخريطة مباشرة.</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 z-[13] grid grid-cols-3 gap-2 max-md:grid-cols-1">
            {[{ label: "طلبات نشطة", value: activeCount }, { label: "مندوبي التشغيل", value: signalCount }, { label: "آخر تحديث", value: timeLabel }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur"><strong className="block text-xl font-black" dir="ltr">{item.value}</strong><span className="text-xs font-bold text-white/60">{item.label}</span></div>)}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-[#f5b700]"><Radar size={18} /><strong>{mode}</strong></div>
            <p className="text-xs font-bold leading-6 text-white/60">تحديث تلقائي كل 30 ثانية، مع إظهار المسارات المتاحة فقط من بيانات التشغيل.</p>
          </div>
          {active ? (
            <div className="rounded-[24px] border border-[#f5b700]/25 bg-[#f5b700]/10 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-[#f5b700]"><Activity size={17} /><strong className="text-sm">المسار المحدد</strong></div>
              <strong className="block text-xl font-black text-white" dir="ltr">{active.code}</strong>
              <span className="mt-2 block text-xs font-bold text-white/60" dir="ltr">{active.fromName} → {active.toName}</span>
              <span className="mt-1 block text-xs font-black text-[#18a8e8]">{active.status}</span>
            </div>
          ) : (
            <div className="rounded-[24px] border border-[#18a8e8]/20 bg-[#18a8e8]/10 p-4 backdrop-blur">
              <strong className="text-sm text-[#18a8e8]">جاهزة للتتبع</strong>
              <p className="mt-2 text-xs font-bold leading-6 text-white/60">لا تظهر أي مسارات إلا عند وجود بيانات طلبات فعلية.</p>
            </div>
          )}
          {routes.length > 0 ? routes.slice(0, 7).map((route) => <button key={route.id} onClick={() => setSelected(route.id)} className={`w-full rounded-2xl border p-3 text-right transition ${route.selected ? "border-[#f5b700]/60 bg-[#f5b700]/10" : "border-white/10 bg-white/[0.04] hover:border-[#18a8e8]/45"}`} type="button"><span className="block text-xs font-black text-white" dir="ltr">{route.code}</span><span className="mt-1 block text-[11px] font-bold text-white/50" dir="ltr">{route.status} • {route.fromName} → {route.toName}</span></button>) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-7 text-white/56">ستظهر قائمة المسارات هنا عند وصول بيانات تتبع مرتبطة بطلبات نشطة.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
