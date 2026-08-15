import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Gauge,
  HeartPulse,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { fetchAdminOrders, fetchMerchants } from "../../lib/adminData";
import {
  buildNexusPhase4Snapshot,
  type NexusMerchantPromise,
  type NexusPhase4Snapshot,
  type NexusRecoveryRisk,
} from "../../lib/nexusPhase4Engine";
import { supabase } from "../../supabase";
import "../../styles/dn-nexus-phase4.css";

function findVisibleNexusContent() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".dn-nexus-content"));
  return nodes.find((node) => node.getClientRects().length > 0) || null;
}

function openAdminSection(labels: string[]) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button, .dncc-navigation button"));
  const button = buttons.find((item) => {
    const copy = String(item.textContent || "").trim();
    return labels.some((label) => copy.includes(label));
  });
  button?.click();
  return Boolean(button);
}

function formatHours(value: number | null, isArabic: boolean) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 24) return `${value.toFixed(value >= 10 ? 0 : 1)}${isArabic ? "س" : "h"}`;
  return `${(value / 24).toFixed(value >= 72 ? 1 : 2)}${isArabic ? "ي" : "d"}`;
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDue(value: string | null, isArabic: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(date);
}

function recoveryLabel(item: NexusRecoveryRisk, isArabic: boolean) {
  if (item.severity === "critical") return isArabic ? "تدخل الآن" : "Act now";
  if (item.severity === "warning") return isArabic ? "خطر مرتفع" : "Elevated risk";
  return isArabic ? "مراقبة" : "Watch";
}

function merchantTier(item: NexusMerchantPromise, isArabic: boolean) {
  if (item.tier === "excellent") return isArabic ? "ممتاز" : "Excellent";
  if (item.tier === "healthy") return isArabic ? "صحي" : "Healthy";
  if (item.tier === "watch") return isArabic ? "مراقبة" : "Watch";
  return isArabic ? "خطر" : "Risk";
}

function MerchantPromiseRow({ item, isArabic }: { item: NexusMerchantPromise; isArabic: boolean }) {
  return (
    <article className={`dn-nexus4-merchant-row tier-${item.tier}`}>
      <div className="dn-nexus4-score"><strong>{item.score}</strong><small>/100</small></div>
      <div className="dn-nexus4-merchant-main">
        <div><h4>{item.merchantName}</h4><span>{item.merchantCode || merchantTier(item, isArabic)}</span></div>
        <p>{isArabic ? item.signalAr : item.signalEn}</p>
        <div className="dn-nexus4-mini-stats">
          <span>{isArabic ? "طلبات 30ي" : "30d orders"}: <b>{item.orders30}</b></span>
          <span>{isArabic ? "نجاح التسليم" : "Delivery success"}: <b>{Math.round(item.deliverySuccessRate * 100)}%</b></span>
          <span>{isArabic ? "احتكاك" : "Friction"}: <b>{Math.round(item.frictionRate * 100)}%</b></span>
          <span>{isArabic ? "وسيط الزمن" : "Median cycle"}: <b>{formatHours(item.medianDeliveryHours, isArabic)}</b></span>
        </div>
      </div>
      <div className="dn-nexus4-confidence"><small>{isArabic ? "ثقة العينة" : "Sample confidence"}</small><b>{item.confidence}</b></div>
    </article>
  );
}

export default function AdminNexusPhase4ServiceAssurance() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isArabic, setIsArabic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<NexusPhase4Snapshot | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const sync = () => {
      const content = findVisibleNexusContent();
      setHost(content);
      const overlay = content?.closest<HTMLElement>(".dn-nexus-overlay");
      setIsArabic(overlay?.getAttribute("dir") !== "ltr");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "dir"] });
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!host) return;
    if (!silent) setLoading(true);
    setError("");
    try {
      const [orders, merchants] = await Promise.all([fetchAdminOrders(), fetchMerchants()]);
      const now = new Date();
      setSnapshot(buildNexusPhase4Snapshot(orders, merchants, now));
      setLastSync(now);
    } catch (cause) {
      console.warn("NEXUS Phase 4 Service Assurance refresh failed safely.", cause);
      setError(isArabic
        ? "تعذر تحديث Service Assurance الآن. لم يتم اختلاق SLA أو درجات بديلة ولم يتم تعديل أي طلب."
        : "Service Assurance could not refresh. No SLA, substitute score, or order mutation was fabricated.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [host, isArabic]);

  useEffect(() => {
    if (!host) { setSnapshot(null); setError(""); return; }
    void load(false);
    const interval = window.setInterval(() => void load(true), 60_000);
    let timer: number | null = null;
    const refreshSoon = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 900);
    };
    const channel = supabase
      ? supabase.channel(`dn-nexus-phase4-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshSoon)
        .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, refreshSoon)
        .subscribe()
      : null;
    return () => {
      window.clearInterval(interval);
      if (timer) window.clearTimeout(timer);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [host, load]);

  const recovery = useMemo(() => snapshot?.recoveryQueue.slice(0, 8) || [], [snapshot]);
  const merchants = useMemo(() => snapshot?.merchantPromise.slice(0, 7) || [], [snapshot]);
  const baselines = useMemo(() => snapshot?.baselines.slice(0, 6) || [], [snapshot]);

  if (!host) return null;

  return createPortal(
    <section className="dn-nexus4" aria-label={isArabic ? "NEXUS AI المرحلة الرابعة ضمان الخدمة وتجربة العميل" : "NEXUS AI Phase 4 Service Assurance and Customer Experience"}>
      <header className="dn-nexus4-header">
        <div>
          <span><HeartPulse size={16} /> NEXUS SERVICE ASSURANCE · PHASE 4</span>
          <h3>{isArabic ? "اعرف أين نخسر الوعد قبل أن نخسر العميل" : "See where the service promise is slipping before the customer is lost"}</h3>
          <p>{isArabic
            ? "خط أساس مرصود من التسليمات الحقيقية، قائمة إنقاذ للعملاء، جودة الخدمة لكل تاجر، وولاء/احتكاك رحلة العميل — بدون SLA مختلق."
            : "Observed delivery baselines, a customer-recovery queue, merchant service quality, and loyalty/friction signals — without invented SLA targets."}</p>
        </div>
        <div className="dn-nexus4-actions">
          <span><ShieldCheck size={14} /> {isArabic ? "Read-only · لا تعديل طلبات ولا SLA وهمي" : "Read-only · no order writes · no fake SLA"}</span>
          <button type="button" onClick={() => void load(false)} disabled={loading}>{loading ? <Loader2 className="dn-nexus-spin" size={15} /> : <RefreshCw size={15} />}{isArabic ? "تحديث" : "Refresh"}</button>
        </div>
      </header>

      {error && <div className="dn-nexus4-error"><AlertTriangle size={15} />{error}</div>}

      {!snapshot && loading ? <div className="dn-nexus4-loading"><Loader2 className="dn-nexus-spin" /><b>{isArabic ? "تحليل رحلة الخدمة من بيانات الإنتاج…" : "Analyzing the service journey from production data…"}</b></div> : snapshot ? <>
        <div className="dn-nexus4-kpis">
          <article><Clock3 /><span>{isArabic ? "وسيط التسليم 30 يوم" : "30d median delivery"}</span><b>{formatHours(snapshot.counters.medianDeliveryHours30, isArabic)}</b><small className={snapshot.counters.medianTrendPct !== null && snapshot.counters.medianTrendPct > 0 ? "is-down" : "is-up"}>{snapshot.counters.medianTrendPct === null ? "—" : `${snapshot.counters.medianTrendPct > 0 ? "+" : ""}${snapshot.counters.medianTrendPct}%`}</small></article>
          <article className={snapshot.counters.criticalActive ? "is-critical" : ""}><AlertTriangle /><span>{isArabic ? "طلبات تحتاج إنقاذ" : "Recovery queue"}</span><b>{snapshot.counters.atRiskActive}</b><small>{snapshot.counters.criticalActive} {isArabic ? "حرج" : "critical"}</small></article>
          <article><RotateCcw /><span>{isArabic ? "مرتجع/إلغاء 30 يوم" : "30d return/cancel"}</span><b>{formatPct(snapshot.counters.returnCancelRate30)}</b><small>{isArabic ? "من الطلبات المغلقة" : "of terminal orders"}</small></article>
          <article><UsersRound /><span>{isArabic ? "عملاء متكررون 90 يوم" : "90d repeat customers"}</span><b>{formatPct(snapshot.counters.repeatCustomerRate90)}</b><small>{snapshot.counters.repeatCustomers90}/{snapshot.counters.uniqueCustomers90}</small></article>
          <article><UserRoundCheck /><span>{isArabic ? "الالتزام بالموعد المسجل" : "Recorded promise adherence"}</span><b>{formatPct(snapshot.counters.scheduledAdherenceRate30)}</b><small>{isArabic ? `عينة ${snapshot.counters.scheduledAdherenceSample30}` : `sample ${snapshot.counters.scheduledAdherenceSample30}`}</small></article>
        </div>

        <section className="dn-nexus4-baselines">
          <div className="dn-nexus4-title"><Gauge size={17} /><div><b>OBSERVED SERVICE BASELINES</b><span>{isArabic ? "Median / P75 / P90 من آخر 90 يوم — معيار تشغيلي مرصود وليس SLA تعاقديًا" : "Median / P75 / P90 from the last 90 days — observed operational benchmark, not a contractual SLA"}</span></div></div>
          <div className="dn-nexus4-baseline-grid">{baselines.length ? baselines.map((item) => <article key={item.key}><div><strong>{item.shippingScope.toUpperCase()}</strong><span>{item.serviceType}</span></div><b>{formatHours(item.medianHours, isArabic)}</b><footer><span>P75 <em>{formatHours(item.p75Hours, isArabic)}</em></span><span>P90 <em>{formatHours(item.p90Hours, isArabic)}</em></span><span>N <em>{item.sampleSize}</em></span></footer></article>) : <em>{isArabic ? "لا توجد بعد عينة تسليم كافية لبناء خط أساس موثوق." : "There is not yet enough delivered history for a reliable observed baseline."}</em>}</div>
        </section>

        <div className="dn-nexus4-grid">
          <section className="dn-nexus4-panel dn-nexus4-recovery">
            <div className="dn-nexus4-title"><AlertTriangle size={17} /><div><b>CUSTOMER RECOVERY QUEUE</b><span>{isArabic ? "أعلى الطلبات التي تحتاج تدخل بشري قبل تصاعد تجربة العميل" : "Highest-priority orders for human intervention before customer friction escalates"}</span></div></div>
            <div className="dn-nexus4-recovery-list">{recovery.length ? recovery.map((item) => <article key={item.orderId} className={`severity-${item.severity}`}><div className="dn-nexus4-recovery-head"><div><strong>{item.reference}</strong><small>{item.merchantName} · {item.destination}</small></div><span>{item.score}<small>/100</small></span></div><div className="dn-nexus4-recovery-meta"><b>{recoveryLabel(item, isArabic)}</b><span>{isArabic ? "العمر" : "Age"}: {formatHours(item.ageHours, isArabic)}</span><span>{isArabic ? "آخر تحديث" : "Last update"}: {formatHours(item.lastUpdateHours, isArabic)}</span>{item.scheduledDueAt && <span>{isArabic ? "الموعد" : "Due"}: {formatDue(item.scheduledDueAt, isArabic)}</span>}</div><p>{(isArabic ? item.reasonsAr : item.reasonsEn).slice(0, 2).join(" • ")}</p><footer><span>{item.receiverName}</span><span dir="ltr">{item.receiverPhone}</span></footer></article>) : <div className="dn-nexus4-empty"><ShieldCheck size={24} /><b>{isArabic ? "لا توجد طلبات مرتفعة المخاطر وفق البيانات الحالية" : "No high-risk recovery items in the current data"}</b></div>}</div>
            <button type="button" className="dn-nexus4-open-section" onClick={() => openAdminSection(["جميع الطلبات", "All Orders", "الطلبات"])}><ArrowUpRight size={15} />{isArabic ? "فتح جميع الطلبات" : "Open all orders"}</button>
          </section>

          <section className="dn-nexus4-panel dn-nexus4-friction">
            <div className="dn-nexus4-title"><Activity size={17} /><div><b>CUSTOMER JOURNEY SIGNALS</b><span>{isArabic ? "لا نسميها رضا عميل لأننا لا نملك Survey؛ هذه إشارات رحلة قابلة للتدقيق" : "Not labeled satisfaction because there is no survey; these are auditable journey signals"}</span></div></div>
            <div className="dn-nexus4-loyalty-card"><Sparkles /><div><small>{isArabic ? "إشارة الولاء" : "Loyalty signal"}</small><strong>{formatPct(snapshot.counters.repeatCustomerRate90)}</strong><p>{isArabic ? `${snapshot.counters.repeatCustomers90} عملاء عادوا للطلب من أصل ${snapshot.counters.uniqueCustomers90} عميل معروف بالهاتف.` : `${snapshot.counters.repeatCustomers90} customers ordered again out of ${snapshot.counters.uniqueCustomers90} phone-identified customers.`}</p></div></div>
            <div className="dn-nexus4-friction-list">{snapshot.friction.map((item) => <article key={item.key}><span>{isArabic ? item.labelAr : item.labelEn}</span><b>{item.count}</b></article>)}</div>
            <div className="dn-nexus4-trend"><div>{snapshot.counters.medianTrendPct !== null && snapshot.counters.medianTrendPct <= 0 ? <TrendingUp /> : <TrendingDown />}</div><p><b>{isArabic ? "اتجاه سرعة الخدمة" : "Service speed trend"}</b><span>{snapshot.counters.medianTrendPct === null ? (isArabic ? "لا توجد عينة سابقة كافية للمقارنة." : "No sufficient prior sample for comparison.") : snapshot.counters.medianTrendPct <= 0 ? (isArabic ? `تحسن الوسيط ${Math.abs(snapshot.counters.medianTrendPct)}% مقابل الـ30 يوم السابقة.` : `Median cycle improved ${Math.abs(snapshot.counters.medianTrendPct)}% vs prior 30 days.`) : (isArabic ? `الوسيط أبطأ ${snapshot.counters.medianTrendPct}% مقابل الـ30 يوم السابقة.` : `Median cycle is ${snapshot.counters.medianTrendPct}% slower vs prior 30 days.`)}</span></p></div>
          </section>
        </div>

        <section className="dn-nexus4-merchants">
          <div className="dn-nexus4-title"><Store size={17} /><div><b>MERCHANT SERVICE PROMISE</b><span>{isArabic ? "درجة خدمة مركبة من نجاح التسليم، الاحتكاك، سرعة الدورة، وتكرار العملاء — مع إظهار ثقة العينة" : "Composite service score from delivery success, friction, cycle speed, and repeat customers — with sample confidence"}</span></div></div>
          <div className="dn-nexus4-merchant-list">{merchants.length ? merchants.map((item) => <MerchantPromiseRow key={item.merchantId} item={item} isArabic={isArabic} />) : <div className="dn-nexus4-empty"><Store size={24} /><b>{isArabic ? "لا توجد بيانات تجار كافية للـ30 يوم الأخيرة" : "No merchant sample is available for the last 30 days"}</b></div>}</div>
        </section>

        <footer className="dn-nexus4-foot"><ShieldCheck size={13} /><span>{isArabic ? `مصدر الحقيقة: الطلبات والتجار الفعليون · نافذة الأساس ${snapshot.historicalWindowDays} يوم · لا يوجد حفظ أو تعديل من هذه الطبقة.` : `Source of truth: production orders and merchants · ${snapshot.historicalWindowDays}-day observed window · this layer performs no saves or mutations.`}</span>{lastSync && <time>{lastSync.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" })}</time>}</footer>
      </> : null}
    </section>,
    host,
  );
}
