import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Clock3,
  Globe2,
  Loader2,
  MapPinned,
  PackageCheck,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Store,
  Truck,
  UserRoundCheck,
  UserRoundX,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { fetchAdminOrders, fetchFinanceSummary, fetchMerchants } from "../../lib/adminData";
import { formatAdminMoney } from "../../lib/adminLocale";
import {
  buildNexusSnapshot,
  type NexusAction,
  type NexusActionTarget,
  type NexusSeverity,
  type NexusSnapshot,
} from "../../lib/nexusRiskEngine";
import { supabase } from "../../supabase";
import type { Order } from "../../types";
import AdminNexusLiveCommandMap from "./AdminNexusLiveCommandMap";
import "../../styles/dn-nexus-control-tower.css";

const NAV_LABELS: Record<NexusActionTarget, string[]> = {
  all_orders: ["كافة الطلبات", "All Orders"],
  review: ["الطلبات قيد المراجعة", "Under Review"],
  postponed: ["الطلبات المؤجلة", "Postponed Orders"],
  returned: ["الطلبات الراجعة", "Returned Orders"],
  finance_dashboard: ["لوحة المالية", "Finance Dashboard"],
  live_drivers: ["المندوبون المباشرون", "Live Drivers"],
  external: ["الطلبات الدولية", "International Orders"],
};

const severityCopy: Record<NexusSeverity, { ar: string; en: string }> = {
  critical: { ar: "حرج", en: "Critical" },
  warning: { ar: "تنبيه", en: "Warning" },
  watch: { ar: "مراقبة", en: "Watch" },
};

function dataSourceCopy(source: NexusSnapshot["financeSource"], isArabic: boolean) {
  if (source === "rpc") return isArabic ? "RPC مالي مباشر" : "Direct finance RPC";
  if (source === "view") return isArabic ? "Finance View" : "Finance view";
  return isArabic ? "مشتق من جداول الإنتاج" : "Derived from production tables";
}

function formatSync(value: Date | null, isArabic: boolean) {
  if (!value) return "—";
  return value.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function findAdminButton(target: NexusActionTarget) {
  const labels = NAV_LABELS[target];
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button"),
  );
  return buttons.find((button) => {
    const copy = String(button.textContent || "").trim();
    return labels.some((label) => copy.includes(label));
  });
}

function metricIcon(id: string) {
  const map: Record<string, typeof Activity> = {
    today: PackageCheck,
    active: Activity,
    liveDrivers: Truck,
    unassigned: UserRoundX,
    international: Globe2,
    merchants: Store,
    cod: CircleDollarSign,
    net: Banknote,
    unposted: WalletCards,
    stale: Clock3,
  };
  return map[id] || Activity;
}

function NexusMetricCard({
  id,
  label,
  value,
  hint,
  tone = "blue",
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone?: "blue" | "gold" | "green" | "red" | "cyan";
}) {
  const Icon = metricIcon(id);
  return (
    <article className={`dn-nexus-metric dn-nexus-tone-${tone}`}>
      <span className="dn-nexus-metric-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function ActionRow({
  item,
  isArabic,
  onOpen,
}: {
  item: NexusAction;
  isArabic: boolean;
  onOpen: (target: NexusActionTarget) => void;
}) {
  return (
    <article className={`dn-nexus-action is-${item.severity}`}>
      <div className="dn-nexus-action-severity">
        <span>{severityCopy[item.severity][isArabic ? "ar" : "en"]}</span>
        <strong>{item.count}</strong>
      </div>
      <div className="dn-nexus-action-copy">
        <h4>{isArabic ? item.titleAr : item.titleEn}</h4>
        <p>{isArabic ? item.detailAr : item.detailEn}</p>
        {item.refs.length > 0 && (
          <div className="dn-nexus-ref-list" aria-label={isArabic ? "أمثلة الطلبات" : "Example orders"}>
            {item.refs.map((ref) => (
              <code key={ref}>{ref}</code>
            ))}
          </div>
        )}
        {typeof item.amount === "number" && item.amount > 0 && (
          <b className="dn-nexus-action-amount">{formatAdminMoney(item.amount, isArabic)}</b>
        )}
      </div>
      <button type="button" onClick={() => onOpen(item.target)}>
        {isArabic ? item.actionAr : item.actionEn}
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function AdminNexusControlTower() {
  const [shellReady, setShellReady] = useState(false);
  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [isArabic, setIsArabic] = useState(true);
  const [isLight, setIsLight] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [snapshot, setSnapshot] = useState<NexusSnapshot | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  useEffect(() => {
    let host: HTMLElement | null = null;
    const syncShell = () => {
      const shell = document.querySelector<HTMLElement>(".dn-admin-fullscreen");
      const ready = Boolean(shell);
      setShellReady(ready);
      if (shell) {
        setIsArabic(shell.getAttribute("dir") !== "ltr");
        setIsLight(shell.classList.contains("is-light"));
      }

      const nav = document.querySelector<HTMLElement>(".dn-admin-side-nav");
      if (nav) {
        host = document.getElementById("dn-nexus-sidebar-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "dn-nexus-sidebar-host";
          host.className = "dn-nexus-sidebar-slot";
          nav.prepend(host);
        }
        setSidebarHost(host);
      } else {
        setSidebarHost(null);
      }
    };

    syncShell();
    const observer = new MutationObserver(syncShell);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "dir"],
    });
    return () => {
      observer.disconnect();
      host?.remove();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [loadedOrders, merchants, financeResult] = await Promise.all([
        fetchAdminOrders(),
        fetchMerchants(),
        fetchFinanceSummary(),
      ]);
      const next = buildNexusSnapshot(
        loadedOrders,
        merchants,
        financeResult.summary,
        financeResult.source,
        new Date(),
      );
      setOrders(loadedOrders);
      setSnapshot(next);
      setLastSyncAt(new Date());
    } catch (cause) {
      console.warn("NEXUS Phase 1 refresh failed without exposing backend details.", cause);
      setError(
        isArabic
          ? "تعذر تحديث برج التحكم الآن. لم يتم عرض أرقام بديلة أو وهمية."
          : "The control tower could not refresh. No substitute or fake values were shown.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    if (!open) return;
    void load(false);
    const interval = window.setInterval(() => void load(true), 30_000);

    let realtimeTimer: number | null = null;
    const scheduleRealtimeRefresh = () => {
      if (realtimeTimer) window.clearTimeout(realtimeTimer);
      realtimeTimer = window.setTimeout(() => void load(true), 650);
    };

    const channel = supabase
      ? supabase
          .channel(`dn-nexus-phase1-${Date.now()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "orders" },
            scheduleRealtimeRefresh,
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "cod_collections" },
            scheduleRealtimeRefresh,
          )
          .subscribe()
      : null;

    return () => {
      window.clearInterval(interval);
      if (realtimeTimer) window.clearTimeout(realtimeTimer);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [open, load]);

  const navigateTo = useCallback((target: NexusActionTarget) => {
    const button = findAdminButton(target);
    if (button) {
      button.click();
      setOpen(false);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
      return;
    }
    setError(
      isArabic
        ? "القسم المطلوب غير ظاهر حاليًا في قائمة الإدارة."
        : "The requested admin section is not currently visible in the navigation.",
    );
  }, [isArabic]);

  const launcher = (
    <button
      type="button"
      className="dn-nexus-launcher"
      onClick={() => setOpen(true)}
      aria-label={isArabic ? "فتح NEXUS AI مركز الذكاء والتحكم" : "Open NEXUS AI control tower"}
    >
      <span className="dn-nexus-launcher-icon"><Radar size={19} /></span>
      <span className="dn-nexus-launcher-copy">
        <b>NEXUS AI</b>
        <small>{isArabic ? "مركز الذكاء والتحكم" : "Control Tower"}</small>
      </span>
      <span className="dn-nexus-live-dot">LIVE</span>
    </button>
  );

  const metrics = snapshot?.metrics;
  const topSignals = useMemo(() => snapshot?.signals.slice(0, 7) || [], [snapshot]);
  const actions = useMemo(() => snapshot?.actions.slice(0, 8) || [], [snapshot]);

  const overlay = open && typeof document !== "undefined"
    ? createPortal(
        <div className={`dn-nexus-overlay ${isLight ? "is-light" : "is-dark"}`} dir={isArabic ? "rtl" : "ltr"}>
          <section className="dn-nexus-shell" role="dialog" aria-modal="true" aria-label="DAY NIGHT NEXUS AI">
            <header className="dn-nexus-header">
              <div className="dn-nexus-brand">
                <span className="dn-nexus-brand-mark"><Sparkles size={20} /></span>
                <div>
                  <div className="dn-nexus-kicker">DAY NIGHT NEXUS™</div>
                  <h2>{isArabic ? "برج التحكم الذكي للعمليات" : "AI Logistics Control Tower"}</h2>
                  <p>
                    {isArabic
                      ? "الآن: ما الذي يحتاج تدخلًا؟ أين الخطر؟ وما أول إجراء يجب تنفيذه؟"
                      : "Now: what needs attention, where is the risk, and what should happen first?"}
                  </p>
                </div>
              </div>
              <div className="dn-nexus-header-actions">
                <div className="dn-nexus-live-status">
                  <span />
                  <div>
                    <b>{isArabic ? "بيانات إنتاج حية" : "Live production data"}</b>
                    <small>
                      {isArabic ? "آخر مزامنة" : "Last sync"}: {formatSync(lastSyncAt, isArabic)}
                    </small>
                  </div>
                </div>
                <button type="button" className="dn-nexus-refresh" onClick={() => void load(false)} disabled={loading}>
                  {loading ? <Loader2 size={17} className="dn-nexus-spin" /> : <RefreshCw size={17} />}
                  {isArabic ? "تحديث" : "Refresh"}
                </button>
                <button type="button" className="dn-nexus-close" onClick={() => setOpen(false)} aria-label={isArabic ? "إغلاق" : "Close"}>
                  <X size={19} />
                </button>
              </div>
            </header>

            {error && (
              <div className="dn-nexus-error" role="alert">
                <AlertTriangle size={17} />
                {error}
              </div>
            )}

            {!snapshot && loading ? (
              <div className="dn-nexus-loading">
                <Loader2 size={34} className="dn-nexus-spin" />
                <strong>{isArabic ? "تحميل صورة العمليات الحقيقية…" : "Loading the real operations picture…"}</strong>
                <span>{isArabic ? "لا يتم استخدام بيانات تجريبية." : "No demo data is used."}</span>
              </div>
            ) : snapshot && metrics ? (
              <div className="dn-nexus-content">
                <section className="dn-nexus-metrics" aria-label={isArabic ? "مؤشرات العمليات" : "Operations KPIs"}>
                  <NexusMetricCard id="today" label={isArabic ? "طلبات اليوم" : "Orders today"} value={String(metrics.ordersToday)} hint={`${isArabic ? "تم التسليم اليوم" : "Delivered today"}: ${metrics.deliveredToday}`} tone="blue" />
                  <NexusMetricCard id="active" label={isArabic ? "طلبات نشطة" : "Active orders"} value={String(metrics.activeOrders)} hint={`${isArabic ? "بدون تحديث 8س+" : "Stale 8h+"}: ${metrics.staleActive}`} tone="cyan" />
                  <NexusMetricCard id="liveDrivers" label={isArabic ? "مندوبون Live" : "Live drivers"} value={String(metrics.liveDrivers)} hint={`${isArabic ? "معينون على مهام" : "Assigned on missions"}: ${metrics.activeDrivers}`} tone="green" />
                  <NexusMetricCard id="unassigned" label={isArabic ? "بدون مندوب" : "Unassigned"} value={String(metrics.unassignedActive)} hint={isArabic ? "طلبات نشطة تحتاج توزيع" : "Active orders needing dispatch"} tone={metrics.unassignedActive ? "red" : "green"} />
                  <NexusMetricCard id="international" label={isArabic ? "دولي نشط" : "International active"} value={String(metrics.internationalActive)} hint={isArabic ? "ضمن العمليات الحالية" : "Within current operations"} tone="gold" />
                  <NexusMetricCard id="merchants" label={isArabic ? "تجار نشطون" : "Active merchants"} value={String(metrics.activeMerchants)} hint={isArabic ? "من قاعدة التجار" : "From merchant registry"} tone="blue" />
                  <NexusMetricCard id="cod" label={isArabic ? "COD معلق" : "Pending COD"} value={formatAdminMoney(metrics.codPending, isArabic)} hint={`${isArabic ? "محصل" : "Collected"}: ${formatAdminMoney(metrics.codCollected, isArabic)}`} tone={metrics.codPending > 0 ? "gold" : "green"} />
                  <NexusMetricCard id="net" label={isArabic ? "صافي التشغيل" : "Net estimate"} value={formatAdminMoney(metrics.netEstimate, isArabic)} hint={`${isArabic ? "مصدر المالية" : "Finance source"}: ${dataSourceCopy(snapshot.financeSource, isArabic)}`} tone="green" />
                </section>

                <section className="dn-nexus-main-grid">
                  <article className="dn-nexus-map-card">
                    <div className="dn-nexus-section-head">
                      <div>
                        <span><MapPinned size={16} /> {isArabic ? "LIVE CONTROL TOWER" : "LIVE CONTROL TOWER"}</span>
                        <h3>{isArabic ? "الخريطة التشغيلية الحية" : "Live operational map"}</h3>
                        <p>{isArabic ? "الطلبات والمسارات وآخر مواقع المندوب المتاحة من بيانات النظام." : "Orders, routes, and the latest available driver positions from system data."}</p>
                      </div>
                      <div className="dn-nexus-map-badges">
                        <span><Activity size={14} /> {metrics.activeOrders} {isArabic ? "نشط" : "active"}</span>
                        <span><Truck size={14} /> {metrics.liveDrivers} LIVE</span>
                      </div>
                    </div>
                    <div className="dn-nexus-map-host">
                      <AdminNexusLiveCommandMap isArabic={isArabic} orders={orders} />
                    </div>
                  </article>

                  <aside className="dn-nexus-radar-card">
                    <div className="dn-nexus-section-head compact">
                      <div>
                        <span><Radar size={16} /> RISK RADAR</span>
                        <h3>{isArabic ? "رادار المخاطر الآن" : "Risk radar now"}</h3>
                      </div>
                    </div>
                    <div className="dn-nexus-risk-totals">
                      <div className="is-critical"><b>{snapshot.criticalOrders}</b><span>{isArabic ? "طلبات حرجة" : "Critical orders"}</span><small>{snapshot.criticalSignals} {isArabic ? "إشارة" : "signals"}</small></div>
                      <div className="is-warning"><b>{snapshot.warningOrders}</b><span>{isArabic ? "تحتاج انتباه" : "Need attention"}</span><small>{snapshot.warningSignals} {isArabic ? "إشارة" : "signals"}</small></div>
                      <div className="is-watch"><b>{snapshot.watchOrders}</b><span>{isArabic ? "تحت المراقبة" : "Under watch"}</span><small>{snapshot.watchSignals} {isArabic ? "إشارة" : "signals"}</small></div>
                    </div>
                    <div className="dn-nexus-signal-list">
                      {topSignals.length ? topSignals.map((item) => (
                        <button key={item.id} type="button" className={`dn-nexus-signal is-${item.severity}`} onClick={() => navigateTo(item.target)}>
                          <span className="dn-nexus-signal-icon">{item.severity === "critical" ? <ShieldAlert size={15} /> : item.severity === "warning" ? <AlertTriangle size={15} /> : <Activity size={15} />}</span>
                          <span>
                            <b>{isArabic ? item.titleAr : item.titleEn}</b>
                            <small>{isArabic ? item.detailAr : item.detailEn}</small>
                          </span>
                          <ArrowUpRight size={14} />
                        </button>
                      )) : (
                        <div className="dn-nexus-clear-state"><UserRoundCheck size={24} /><b>{isArabic ? "لا توجد إشارات تشغيلية عاجلة" : "No urgent operational signals"}</b><span>{isArabic ? "استمر بالمراقبة الحية." : "Continue live monitoring."}</span></div>
                      )}
                    </div>
                  </aside>
                </section>

                <section className="dn-nexus-lower-grid">
                  <article className="dn-nexus-actions-card">
                    <div className="dn-nexus-section-head">
                      <div>
                        <span><Zap size={16} /> ACTION QUEUE</span>
                        <h3>{isArabic ? "ماذا يجب أن نفعل الآن؟" : "What should we do now?"}</h3>
                        <p>{isArabic ? "مرتبة حسب الخطورة والعدد، وتفتح القسم التشغيلي الصحيح مباشرة." : "Prioritized by severity and volume, with direct navigation to the right operational section."}</p>
                      </div>
                      <strong className="dn-nexus-action-count">{actions.length}</strong>
                    </div>
                    <div className="dn-nexus-actions-list">
                      {actions.length ? actions.map((item) => <ActionRow key={item.id} item={item} isArabic={isArabic} onOpen={navigateTo} />) : (
                        <div className="dn-nexus-clear-state horizontal"><UserRoundCheck size={24} /><div><b>{isArabic ? "قائمة الإجراءات خالية" : "Action queue is clear"}</b><span>{isArabic ? "لا يوجد تدخل عاجل مشتق من البيانات الحالية." : "No urgent intervention is derived from current data."}</span></div></div>
                      )}
                    </div>
                  </article>

                  <aside className="dn-nexus-finance-card">
                    <div className="dn-nexus-section-head compact">
                      <div>
                        <span><WalletCards size={16} /> REAL FINANCIAL SIGNALS</span>
                        <h3>{isArabic ? "نبض المالية" : "Financial pulse"}</h3>
                      </div>
                    </div>
                    <dl>
                      <div><dt>{isArabic ? "دخل التوصيل" : "Delivery income"}</dt><dd>{formatAdminMoney(metrics.totalIncome, isArabic)}</dd></div>
                      <div><dt>{isArabic ? "المصروفات" : "Expenses"}</dt><dd>{formatAdminMoney(metrics.totalExpenses, isArabic)}</dd></div>
                      <div><dt>{isArabic ? "مستحق التجار" : "Merchant payable"}</dt><dd>{formatAdminMoney(metrics.merchantPayable, isArabic)}</dd></div>
                      <div><dt>{isArabic ? "مسلّم غير مُرحّل" : "Delivered unposted"}</dt><dd>{metrics.deliveredUnposted}</dd></div>
                      <div className="is-net"><dt>{isArabic ? "صافي التشغيل" : "Net estimate"}</dt><dd>{formatAdminMoney(metrics.netEstimate, isArabic)}</dd></div>
                    </dl>
                    <button type="button" onClick={() => navigateTo("finance_dashboard")}>
                      <Banknote size={16} />
                      {isArabic ? "فتح مركز المالية" : "Open finance center"}
                    </button>
                    <div className="dn-nexus-source-proof">
                      <ShieldAlert size={15} />
                      <span>
                        <b>{isArabic ? "مصدر حقيقي فقط" : "Real source only"}</b>
                        <small>{dataSourceCopy(snapshot.financeSource, isArabic)}</small>
                      </span>
                    </div>
                  </aside>
                </section>

                <footer className="dn-nexus-method-note">
                  <span><ShieldAlert size={14} /> {isArabic ? "قواعد Phase 1 شفافة:" : "Phase 1 rules are explicit:"}</span>
                  <span>{isArabic ? "Stale = لا تحديث 8 ساعات أو أكثر" : "Stale = no update for 8h+"}</span>
                  <span>{isArabic ? "Live driver = موقع حديث خلال 30 دقيقة" : "Live driver = location fresh within 30m"}</span>
                  <span>{isArabic ? "لا يوجد تنبؤ ETA أو بيانات Mock في هذه المرحلة" : "No predictive ETA or mock data in this phase"}</span>
                </footer>
              </div>
            ) : (
              <div className="dn-nexus-loading is-error">
                <ShieldAlert size={34} />
                <strong>{isArabic ? "لا توجد صورة تشغيلية موثوقة لعرضها" : "No trustworthy operational snapshot is available"}</strong>
                <button type="button" onClick={() => void load(false)}>{isArabic ? "إعادة المحاولة" : "Retry"}</button>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )
    : null;

  if (!shellReady) return null;

  return (
    <>
      {sidebarHost ? createPortal(launcher, sidebarHost) : <div className="dn-nexus-launcher-fallback">{launcher}</div>}
      {overlay}
    </>
  );
}
