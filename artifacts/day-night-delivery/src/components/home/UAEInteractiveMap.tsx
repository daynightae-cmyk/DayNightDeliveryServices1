import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Layers3, MapPin, Navigation, RefreshCw, Radar, Route, Store, Truck } from "lucide-react";
import { fetchPublicLiveOperationsMap } from "../../supabase";
import localAssets, { withRemoteFallback } from "../../data/localAssets";

const MAP_IMAGE_URL = localAssets.uaeMap;

type MapRow = {
  tracking_ref?: string | null;
  status?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type CityPoint = { key: string; ar: string; en: string; x: number; y: number };
type StatusTone = "gold" | "sky" | "emerald" | "rose";
type RouteItem = {
  id: string;
  code: string;
  status: string;
  statusKey: string;
  tone: StatusTone;
  fromName: string;
  toName: string;
  from: CityPoint;
  to: CityPoint;
  selected: boolean;
  point: { x: number; y: number };
  progress: number;
  updatedAt?: string | null;
  ageLabel: string;
};

const CITIES: Record<string, CityPoint> = {
  abudhabi: { key: "abudhabi", ar: "أبوظبي", en: "Abu Dhabi", x: 46, y: 66 },
  dubai: { key: "dubai", ar: "دبي", en: "Dubai", x: 64, y: 43 },
  sharjah: { key: "sharjah", ar: "الشارقة", en: "Sharjah", x: 69, y: 31 },
  ajman: { key: "ajman", ar: "عجمان", en: "Ajman", x: 66, y: 26 },
  rak: { key: "rak", ar: "رأس الخيمة", en: "Ras Al Khaimah", x: 75, y: 13 },
  fujairah: { key: "fujairah", ar: "الفجيرة", en: "Fujairah", x: 88, y: 35 },
  alain: { key: "alain", ar: "العين", en: "Al Ain", x: 78, y: 79 },
  western: { key: "western", ar: "المنطقة الغربية", en: "Western Region", x: 19, y: 72 },
};

const statusLabels: Record<string, string> = {
  pending: "بانتظار التشغيل",
  confirmed: "تم التأكيد",
  assigned: "مع المندوب",
  accepted: "تم قبول المهمة",
  picked_up: "تم الاستلام",
  in_transit: "في الطريق",
  out_for_delivery: "خارج للتسليم",
  delivered: "تم التسليم",
  returned: "راجع",
  cancelled: "ملغي",
};

const statusProgress: Record<string, number> = {
  pending: 0.12,
  confirmed: 0.2,
  assigned: 0.32,
  accepted: 0.38,
  picked_up: 0.52,
  in_transit: 0.68,
  out_for_delivery: 0.84,
  delivered: 0.96,
  returned: 0.28,
  cancelled: 0.08,
};

function clean(value?: unknown) {
  return String(value || "").trim();
}

function normalizeStatus(status?: string | null) {
  const value = clean(status).toLowerCase().replace(/[\s-]+/g, "_");
  if (value.includes("out") && value.includes("deliver")) return "out_for_delivery";
  if (value.includes("deliver")) return "delivered";
  if (value.includes("transit") || value.includes("route")) return "in_transit";
  if (value.includes("pickup") || value.includes("picked")) return "picked_up";
  if (value.includes("assign")) return "assigned";
  if (value.includes("accept")) return "accepted";
  if (value.includes("confirm")) return "confirmed";
  if (value.includes("return")) return "returned";
  if (value.includes("cancel")) return "cancelled";
  return value || "pending";
}

function statusLabel(status?: string | null) {
  const key = normalizeStatus(status);
  return statusLabels[key] || clean(status) || "قيد المتابعة";
}

function statusTone(status?: string | null): StatusTone {
  const key = normalizeStatus(status);
  if (key === "delivered") return "emerald";
  if (key === "cancelled" || key === "returned") return "rose";
  if (key === "in_transit" || key === "out_for_delivery" || key === "picked_up") return "sky";
  return "gold";
}

function toneColor(tone: StatusTone) {
  if (tone === "emerald") return "#34d399";
  if (tone === "rose") return "#fb7185";
  if (tone === "sky") return "#18a8e8";
  return "#f5b700";
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
  const cy = Math.min(from.y, to.y) - Math.max(10, Math.abs(from.x - to.x) * 0.18 + 10);
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function routePoint(from: CityPoint, to: CityPoint, t: number) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - Math.max(10, Math.abs(from.x - to.x) * 0.18 + 10);
  return {
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y,
  };
}

function formatAge(row?: MapRow) {
  const source = clean(row?.updated_at) || clean(row?.created_at);
  if (!source) return "آخر تحديث متاح";
  const timestamp = new Date(source).getTime();
  if (!Number.isFinite(timestamp)) return "آخر تحديث متاح";
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "الآن";
  if (diffMinutes < 60) return `قبل ${diffMinutes} د`;
  return `قبل ${Math.round(diffMinutes / 60)} س`;
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
      const payload = await fetchPublicLiveOperationsMap(24);

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
      setMode(clean(payload.mode) || (safeRows.length ? "تشغيل متصل" : "لا توجد مسارات نشطة الآن"));

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

  const routes = useMemo<RouteItem[]>(() => rows.slice(0, 14).flatMap((row, index) => {
    const code = clean(row.tracking_ref);
    const fromName = clean(row.sender_city);
    const toName = clean(row.receiver_city);
    if (!code || !fromName || !toName) return [];

    const id = `${code}-${index}`;
    const from = resolveCity(fromName);
    const to = resolveCity(toName);
    const key = normalizeStatus(row.status);
    const baseProgress = statusProgress[key] ?? 0.24;
    const movement = ((now / 1000 + index * 7) % 100) / 100;
    const progress = Math.min(0.96, Math.max(0.04, baseProgress * 0.72 + movement * 0.28));

    return [{
      id,
      code,
      status: statusLabel(row.status),
      statusKey: key,
      tone: statusTone(row.status),
      fromName,
      toName,
      from,
      to,
      selected: id === selected,
      point: routePoint(from, to, progress),
      progress,
      updatedAt: row.updated_at || row.created_at,
      ageLabel: formatAge(row),
    }];
  }), [rows, now, selected]);

  const active = routes.find((route) => route.selected) || routes[0];
  const hasRoutes = routes.length > 0;
  const timeLabel = updatedAt.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });

  const cityLoad = useMemo(() => {
    const output = new Map<string, number>();
    rows.forEach((row) => {
      if (!clean(row.receiver_city)) return;
      const city = resolveCity(row.receiver_city);
      output.set(city.key, (output.get(city.key) || 0) + 1);
    });
    return output;
  }, [rows]);

  const citySummary = useMemo(() => Object.values(CITIES)
    .map((city) => ({ city, count: cityLoad.get(city.key) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count), [cityLoad]);

  const statusSummary = useMemo(() => {
    const output = new Map<string, number>();
    routes.forEach((route) => output.set(route.status, (output.get(route.status) || 0) + 1));
    return Array.from(output.entries()).slice(0, 4);
  }, [routes]);

  const linkedActions = [
    { href: "/tracking", label: "تتبع شحنة", icon: Radar },
    { href: "/merchant", label: "بوابة التاجر", icon: Store },
    { href: "/driver", label: "بوابة المندوب", icon: Navigation },
  ];

  const kpis = [
    { label: "طلبات نشطة", value: activeCount, icon: Activity },
    { label: "مسارات مرئية", value: routes.length, icon: Route },
    { label: "مندوبي التشغيل", value: signalCount, icon: Truck },
    { label: "آخر تحديث", value: timeLabel, icon: Clock3 },
  ];

  return (
    <section className="relative w-full overflow-hidden px-3 py-16 text-white sm:px-6 lg:px-10" dir="rtl">
      <style>{`@keyframes dnRouteDash{to{stroke-dashoffset:-54}}@keyframes dnTruckFloat{50%{transform:translate(-50%,-62%) scale(1.08)}}@keyframes dnMapPulse{0%{transform:scale(.78);opacity:.65}100%{transform:scale(2.4);opacity:0}}@keyframes dnScan{0%{transform:translateX(115%)}100%{transform:translateX(-115%)}}`}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(24,168,232,.18),transparent_30rem),radial-gradient(circle_at_18%_75%,rgba(245,183,0,.14),transparent_28rem),linear-gradient(135deg,#020713,#071a33_48%,#01050f)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(79,215,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(79,215,255,.045)_1px,transparent_1px)] bg-[size:64px_64px] opacity-50" />

      <div className="relative z-10 mx-auto mb-8 flex w-[min(1680px,100%)] flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f5b700]/25 bg-[#f5b700]/10 px-4 py-1.5 text-xs font-black tracking-[0.14em] text-[#f5b700]"><Layers3 size={14} /> DAY NIGHT CONNECTED OPERATIONS</span>
          <h2 className="m-0 text-[clamp(32px,4vw,60px)] font-black leading-[1.08]">غرفة حركة DAY NIGHT</h2>
          <p className="mt-4 max-w-[900px] text-sm font-bold leading-8 text-white/70">خريطة عمليات تعرض الطلبات المتصلة من النظام، وتربط المسار بالتتبع وبوابات التاجر والمندوب في واجهة واحدة.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {linkedActions.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs font-black text-white/75 backdrop-blur transition hover:border-[#f5b700]/50 hover:text-[#f5b700]">
              <Icon size={15} /> {label}
            </a>
          ))}
          <button onClick={() => void refreshMap()} className="inline-flex items-center gap-2 rounded-2xl border border-[#f5b700]/30 bg-[#f5b700]/12 px-5 py-3 text-sm font-black text-[#f5b700] backdrop-blur transition hover:bg-[#f5b700] hover:text-[#071a33]">
            <RefreshCw size={16} /> تحديث الآن
          </button>
        </div>
      </div>

      <div className="relative z-10 mx-auto grid w-[min(1680px,100%)] grid-cols-1 gap-4 rounded-[38px] border border-[#18a8e8]/22 bg-[#061225]/88 p-3 shadow-[0_36px_90px_rgba(0,0,0,.42)] backdrop-blur-xl sm:p-4 xl:grid-cols-[1fr_390px]">
        <div className="relative min-h-[570px] overflow-hidden rounded-[32px] border border-white/8 bg-[#030a18] lg:min-h-[690px]">
          <img src={MAP_IMAGE_URL} alt="DAY NIGHT UAE operations map" className="absolute inset-0 h-full w-full object-cover brightness-[.78] saturate-[1.16]" onError={(event) => withRemoteFallback(event, localAssets.remote.uaeMap)} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_48%,transparent_0%,rgba(2,7,19,.12)_48%,rgba(0,0,0,.66)_100%),linear-gradient(180deg,rgba(1,5,15,.20),rgba(1,5,15,.08)_45%,rgba(1,5,15,.62))]" />
          <div className="absolute inset-x-0 top-0 z-[4] h-24 bg-gradient-to-b from-[#020713]/80 to-transparent" />
          <div className="absolute inset-y-0 right-0 z-[4] w-1/3 bg-gradient-to-l from-[#020713]/35 to-transparent" />
          <div className="pointer-events-none absolute inset-0 z-[6] opacity-45" style={{ background: "linear-gradient(90deg,transparent,rgba(24,168,232,.16),transparent)", animation: "dnScan 5s linear infinite" }} />

          <svg className="pointer-events-none absolute inset-0 z-[7] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="dn-route-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.9" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {routes.map((route) => {
              const color = toneColor(route.tone);
              return <g key={route.id} filter="url(#dn-route-glow)">
                <path d={routePath(route.from, route.to)} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth={route.selected ? 0.98 : 0.52} strokeLinecap="round" />
                <path d={routePath(route.from, route.to)} fill="none" stroke={route.selected ? color : `${color}aa`} strokeWidth={route.selected ? 0.68 : 0.38} strokeLinecap="round" strokeDasharray="2 2.8" style={{ animation: "dnRouteDash 2.2s linear infinite" }} />
              </g>;
            })}
          </svg>

          {Object.values(CITIES).map((city) => {
            const count = cityLoad.get(city.key) || 0;
            const activeCity = count > 0;
            return <button key={city.key} className={`absolute z-[9] -translate-x-1/2 -translate-y-1/2 rounded-full border p-2.5 backdrop-blur transition ${activeCity ? "border-[#f5b700]/65 bg-[#071a33]/82 text-[#f5b700] shadow-[0_0_30px_rgba(245,183,0,.35)]" : "border-white/10 bg-[#071a33]/42 text-white/38"}`} style={{ left: `${city.x}%`, top: `${city.y}%` }} title={city.ar} type="button">
              <span className="absolute inset-0 rounded-full border border-current" style={{ animation: activeCity ? "dnMapPulse 2.2s ease-out infinite" : undefined }} />
              <MapPin size={activeCity ? 18 : 14} />
              {activeCity && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#f5b700] px-1 text-[10px] font-black text-[#071a33]">{count}</span>}
            </button>;
          })}

          {routes.map((route) => {
            const color = toneColor(route.tone);
            return <button key={`${route.id}-vehicle`} onClick={() => setSelected(route.id)} className={`absolute z-[12] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border backdrop-blur transition ${route.selected ? "scale-110 bg-[#f5b700] text-[#071a33]" : "bg-[#071a33]/88 text-white"}`} style={{ left: `${route.point.x}%`, top: `${route.point.y}%`, borderColor: color, boxShadow: `0 0 30px ${color}66`, animation: "dnTruckFloat 2.2s ease-in-out infinite" }} title={route.code} type="button">
              <Truck size={19} />
            </button>;
          })}

          {!hasRoutes && (
            <div className="absolute inset-0 z-[15] grid place-items-center p-5">
              <div className="max-w-md rounded-[30px] border border-white/12 bg-[#061225]/82 p-7 text-center shadow-2xl shadow-black/35 backdrop-blur-xl">
                <Radar className="mx-auto mb-4 h-11 w-11 text-[#f5b700]" />
                <h3 className="text-2xl font-black text-white">الخريطة جاهزة لاستقبال الحركة</h3>
                <p className="mt-3 text-sm font-bold leading-7 text-white/62">عند توفر طلبات نشطة مرتبطة بالتتبع ستظهر المسارات والمركبات هنا تلقائياً.</p>
              </div>
            </div>
          )}

          {active && (
            <div className="absolute right-4 top-4 z-[16] w-[min(420px,calc(100%-2rem))] rounded-[26px] border border-[#f5b700]/25 bg-[#061225]/78 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black text-[#f5b700]">المسار المحدد</p>
                  <strong className="block text-xl font-black text-white" dir="ltr">{active.code}</strong>
                </div>
                <span className="rounded-full border px-3 py-1 text-[11px] font-black" style={{ borderColor: `${toneColor(active.tone)}77`, color: toneColor(active.tone), background: `${toneColor(active.tone)}18` }}>{active.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-bold text-white/65" dir="ltr">
                <span className="truncate text-right">{active.fromName}</span>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#f5b700]" style={{ width: `${Math.round(active.progress * 100)}%` }} /></span>
                <span className="truncate text-left">{active.toName}</span>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 z-[16] grid grid-cols-2 gap-2 md:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-[#061225]/72 p-3 text-center shadow-xl shadow-black/20 backdrop-blur"><Icon className="mx-auto mb-1 h-4 w-4 text-[#f5b700]" /><strong className="block text-xl font-black" dir="ltr">{value}</strong><span className="text-xs font-bold text-white/60">{label}</span></div>)}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.075] p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-[#f5b700]"><Radar size={18} /><strong>{mode}</strong></div>
            <p className="text-xs font-bold leading-6 text-white/60">البلوك يقرأ من بيانات الطلبات المتاحة ويعيد التحديث تلقائياً كل 30 ثانية.</p>
          </div>

          {active ? (
            <div className="rounded-[28px] border border-[#f5b700]/25 bg-[#f5b700]/10 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm text-[#f5b700]">تفاصيل الحركة</strong><span className="text-[11px] font-black text-white/50">{active.ageLabel}</span></div>
              <strong className="block text-2xl font-black text-white" dir="ltr">{active.code}</strong>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#061225]/65 p-3">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-white/62"><span>{active.from.ar}</span><span>{active.status}</span><span>{active.to.ar}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-[#f5b700] via-[#18a8e8] to-[#34d399]" style={{ width: `${Math.round(active.progress * 100)}%` }} /></div>
              </div>
            </div>
          ) : (
            <div className="rounded-[26px] border border-[#18a8e8]/20 bg-[#18a8e8]/10 p-4 backdrop-blur">
              <strong className="text-sm text-[#18a8e8]">جاهزة للتتبع</strong>
              <p className="mt-2 text-xs font-bold leading-6 text-white/60">لا توجد طلبات نشطة للعرض حالياً.</p>
            </div>
          )}

          <div className="rounded-[26px] border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-white"><MapPin className="h-4 w-4 text-[#f5b700]" /><strong className="text-sm">توزيع الوجهات</strong></div>
            {citySummary.length ? <div className="grid grid-cols-2 gap-2">{citySummary.slice(0, 6).map(({ city, count }) => <div key={city.key} className="rounded-2xl border border-white/10 bg-[#061225]/55 p-3"><strong className="block text-lg font-black text-[#f5b700]" dir="ltr">{count}</strong><span className="text-[11px] font-bold text-white/55">{city.ar}</span></div>)}</div> : <p className="text-xs font-bold leading-6 text-white/52">سيظهر توزيع الوجهات عند توفر طلبات نشطة.</p>}
          </div>

          {statusSummary.length > 0 && (
            <div className="rounded-[26px] border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-white"><Activity className="h-4 w-4 text-[#18a8e8]" /><strong className="text-sm">حالة المسارات</strong></div>
              <div className="space-y-2">{statusSummary.map(([label, count]) => <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#061225]/55 px-3 py-2 text-xs font-bold"><span>{label}</span><strong className="text-[#f5b700]" dir="ltr">{count}</strong></div>)}</div>
            </div>
          )}

          <div className="rounded-[26px] border border-white/10 bg-white/[0.055] p-3 backdrop-blur">
            <div className="mb-2 px-1 text-xs font-black text-white/70">آخر الطلبات المتصلة</div>
            {routes.length > 0 ? routes.slice(0, 8).map((route) => <button key={route.id} onClick={() => setSelected(route.id)} className={`w-full rounded-2xl border p-3 text-right transition ${route.selected ? "border-[#f5b700]/65 bg-[#f5b700]/12" : "border-white/10 bg-[#061225]/45 hover:border-[#18a8e8]/45"}`} type="button"><span className="block text-xs font-black text-white" dir="ltr">{route.code}</span><span className="mt-1 block text-[11px] font-bold text-white/50" dir="ltr">{route.status} • {route.fromName} → {route.toName}</span></button>) : <div className="rounded-2xl border border-white/10 bg-[#061225]/45 p-4 text-sm font-bold leading-7 text-white/56">ستظهر الطلبات هنا عند وصول بيانات تتبع نشطة.</div>}
          </div>
        </aside>
      </div>
    </section>
  );
}
