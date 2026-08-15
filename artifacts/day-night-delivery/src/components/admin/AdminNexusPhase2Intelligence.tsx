import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Building2,
  CircleDollarSign,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  UsersRound,
} from "lucide-react";
import { fetchAdminOrders, fetchFinanceSummary, fetchMerchants } from "../../lib/adminData";
import { formatAdminMoney } from "../../lib/adminLocale";
import { buildNexusSnapshot } from "../../lib/nexusRiskEngine";
import {
  buildNexusPhase2Snapshot,
  type NexusDispatchRecommendation,
  type NexusMerchantHealth,
  type NexusPhase2Snapshot,
} from "../../lib/nexusPhase2Engine";
import { supabase } from "../../supabase";
import type { DriverLocation, DriverProfile } from "../../types/driver";
import "../../styles/dn-nexus-phase2.css";

function findVisibleNexusContent() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".dn-nexus-content"));
  return nodes.find((node) => node.getClientRects().length > 0) || null;
}

function openAdminSection(labels: string[]) {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".dn-admin-side-nav button, .dncc-navigation button"),
  );
  const button = buttons.find((item) => {
    const copy = String(item.textContent || "").trim();
    return labels.some((label) => copy.includes(label));
  });
  button?.click();
  return Boolean(button);
}

function confidenceLabel(value: NexusDispatchRecommendation["confidence"], isArabic: boolean) {
  if (value === "high") return isArabic ? "ثقة عالية" : "High confidence";
  if (value === "medium") return isArabic ? "ثقة متوسطة" : "Medium confidence";
  return isArabic ? "ثقة محدودة" : "Limited confidence";
}

function healthTierLabel(item: NexusMerchantHealth, isArabic: boolean) {
  if (item.tier === "excellent") return isArabic ? "ممتاز" : "Excellent";
  if (item.tier === "healthy") return isArabic ? "صحي" : "Healthy";
  if (item.tier === "watch") return isArabic ? "مراقبة" : "Watch";
  return isArabic ? "خطر" : "Risk";
}

function DispatchRecommendationCard({
  item,
  isArabic,
}: {
  item: NexusDispatchRecommendation;
  isArabic: boolean;
}) {
  const top = item.candidates[0];
  return (
    <article className={`dn-nexus2-dispatch-card confidence-${item.confidence}`}>
      <div className="dn-nexus2-card-head">
        <div>
          <span><Route size={14} /> {item.reference}</span>
          <h4>{item.destination}</h4>
        </div>
        <b>{confidenceLabel(item.confidence, isArabic)}</b>
      </div>
      {top ? (
        <>
          <div className="dn-nexus2-best-driver">
            <span className="dn-nexus2-score">{top.score}%</span>
            <div>
              <small>{isArabic ? "أفضل مندوب مقترح" : "Best recommended driver"}</small>
              <strong>{top.driverName}</strong>
              <p>{isArabic ? top.reasonsAr.slice(0, 3).join(" • ") : top.reasonsEn.slice(0, 3).join(" • ")}</p>
            </div>
          </div>
          <div className="dn-nexus2-driver-alternatives">
            {item.candidates.slice(1).map((candidate) => (
              <span key={candidate.driverId}>
                <Truck size={13} /> {candidate.driverName} <b>{candidate.score}%</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="dn-nexus2-empty-inline">
          {isArabic ? "لا يوجد مندوب مؤهل يمكن تقييمه من البيانات الحالية." : "No eligible driver can be scored from current data."}
        </div>
      )}
      <footer>
        <span><Activity size={13} /> {Math.round(item.createdAgeHours)}h</span>
        <span><MapPin size={13} /> {item.pickupCoordinatesAvailable ? (isArabic ? "الموقع متاح" : "Pickup located") : (isArabic ? "بدون إحداثيات" : "No coordinates")}</span>
      </footer>
    </article>
  );
}

function MerchantHealthRow({ item, isArabic }: { item: NexusMerchantHealth; isArabic: boolean }) {
  return (
    <article className={`dn-nexus2-merchant-row tier-${item.tier}`}>
      <div className="dn-nexus2-health-score">
        <strong>{item.score}</strong>
        <small>/100</small>
      </div>
      <div className="dn-nexus2-merchant-copy">
        <div>
          <h4>{item.merchantName}</h4>
          <span>{item.merchantCode || healthTierLabel(item, isArabic)}</span>
        </div>
        <p>{isArabic ? item.signalAr : item.signalEn}</p>
        <div className="dn-nexus2-mini-stats">
          <span>{isArabic ? "30 يوم" : "30d"}: <b>{item.orders30}</b></span>
          <span>{isArabic ? "تسليم" : "Delivery"}: <b>{Math.round(item.deliveryRate * 100)}%</b></span>
          <span className={item.growthPct >= 0 ? "is-up" : "is-down"}>
            {item.growthPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {item.growthPct}%
          </span>
        </div>
      </div>
      <div className="dn-nexus2-merchant-value">
        <small>{isArabic ? "مساهمة 30 يوم" : "30d contribution"}</small>
        <b>{formatAdminMoney(item.contribution30, isArabic)}</b>
      </div>
    </article>
  );
}

export default function AdminNexusPhase2Intelligence() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isArabic, setIsArabic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<NexusPhase2Snapshot | null>(null);
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
      if (!supabase) throw new Error("Supabase unavailable");
      const [orders, merchants, financeResult, profilesResult, locationsResult] = await Promise.all([
        fetchAdminOrders(),
        fetchMerchants(),
        fetchFinanceSummary(),
        supabase.from("driver_profiles").select("*"),
        supabase.from("driver_locations").select("*").order("last_seen_at", { ascending: false }),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (locationsResult.error) throw locationsResult.error;
      const now = new Date();
      const phase1 = buildNexusSnapshot(orders, merchants, financeResult.summary, financeResult.source, now);
      const next = buildNexusPhase2Snapshot(
        orders,
        merchants,
        financeResult.summary,
        (profilesResult.data || []) as DriverProfile[],
        (locationsResult.data || []) as DriverLocation[],
        phase1,
        now,
      );
      setSnapshot(next);
      setLastSync(now);
    } catch (cause) {
      console.warn("NEXUS Phase 2 intelligence refresh failed safely.", cause);
      setError(
        isArabic
          ? "تعذر تحديث Intelligence Layer. لم يتم استخدام بيانات بديلة أو تنفيذ أي إجراء تلقائي."
          : "The intelligence layer could not refresh. No substitute data or automatic action was used.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [host, isArabic]);

  useEffect(() => {
    if (!host) {
      setSnapshot(null);
      setError("");
      return;
    }
    void load(false);
    const interval = window.setInterval(() => void load(true), 45_000);
    let timer: number | null = null;
    const refreshSoon = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 900);
    };
    const channel = supabase
      ? supabase
          .channel(`dn-nexus-phase2-${Date.now()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshSoon)
          .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles" }, refreshSoon)
          .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, refreshSoon)
          .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, refreshSoon)
          .on("postgres_changes", { event: "*", schema: "public", table: "cod_collections" }, refreshSoon)
          .subscribe()
      : null;
    return () => {
      window.clearInterval(interval);
      if (timer) window.clearTimeout(timer);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [host, load]);

  const dispatch = useMemo(() => snapshot?.dispatch.slice(0, 5) || [], [snapshot]);
  const health = useMemo(() => {
    if (!snapshot) return [];
    const combined = [...snapshot.merchantOpportunities, ...snapshot.merchantAttention, ...snapshot.merchantHealth];
    return Array.from(new Map(combined.map((item) => [item.merchantId, item])).values()).slice(0, 6);
  }, [snapshot]);

  if (!host) return null;

  return createPortal(
    <section className="dn-nexus2" aria-label={isArabic ? "NEXUS AI المرحلة الثانية" : "NEXUS AI Phase 2"}>
      <header className="dn-nexus2-header">
        <div>
          <span><BrainCircuit size={17} /> NEXUS INTELLIGENCE · PHASE 2</span>
          <h3>{isArabic ? "القرار التالي قبل أن تسأل عنه" : "The next decision before you have to ask"}</h3>
          <p>
            {isArabic
              ? "توصيات توزيع قابلة للتفسير، صحة التجار، ذكاء المساهمة التشغيلية، وملخص تنفيذي مبني فقط على بيانات DAY NIGHT الحقيقية."
              : "Explainable dispatch recommendations, merchant health, contribution intelligence, and an executive brief built only from real DAY NIGHT data."}
          </p>
        </div>
        <div className="dn-nexus2-header-actions">
          <span><ShieldCheck size={14} /> {isArabic ? "Recommendation Only · بدون تنفيذ تلقائي" : "Recommendation only · no automatic writes"}</span>
          <button type="button" onClick={() => void load(false)} disabled={loading}>
            {loading ? <Loader2 size={15} className="dn-nexus-spin" /> : <RefreshCw size={15} />}
            {isArabic ? "تحديث الذكاء" : "Refresh intelligence"}
          </button>
        </div>
      </header>

      {error && <div className="dn-nexus2-error">{error}</div>}

      {!snapshot && loading ? (
        <div className="dn-nexus2-loading"><Loader2 className="dn-nexus-spin" /><b>{isArabic ? "بناء التوصيات من بيانات الإنتاج…" : "Building recommendations from production data…"}</b></div>
      ) : snapshot ? (
        <>
          <section className="dn-nexus2-brief-card">
            <div className="dn-nexus2-section-title">
              <span><Sparkles size={15} /> AI OPERATIONS BRIEF</span>
              <h3>{isArabic ? "ملخص الإدارة الآن" : "Executive brief now"}</h3>
              <small>{isArabic ? "قابل للتفسير · بلا LLM خارجي · بلا بيانات مختلقة" : "Explainable · no external LLM · no fabricated data"}</small>
            </div>
            <div className="dn-nexus2-brief-list">
              {snapshot.brief.map((item) => (
                <article key={item.id} className={`tone-${item.tone}`}>
                  <b>{isArabic ? item.titleAr : item.titleEn}</b>
                  <p>{isArabic ? item.bodyAr : item.bodyEn}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="dn-nexus2-grid">
            <section className="dn-nexus2-panel dn-nexus2-dispatch">
              <div className="dn-nexus2-section-title">
                <span><Target size={15} /> SMART DISPATCH</span>
                <h3>{isArabic ? "من الأنسب لهذا الطلب؟" : "Who is the best fit for this order?"}</h3>
                <p>{isArabic ? "Score يوازن الموقع والحضور والحمل التشغيلي ومنطقة العمل. لا يوجد تعيين تلقائي." : "Score balances location, presence, workload, and work-area match. No automatic assignment."}</p>
              </div>
              <div className="dn-nexus2-dispatch-list">
                {dispatch.length ? dispatch.map((item) => <DispatchRecommendationCard key={item.orderId} item={item} isArabic={isArabic} />) : (
                  <div className="dn-nexus2-empty"><Truck size={24} /><b>{isArabic ? "لا توجد طلبات غير معيّنة تحتاج توصية الآن" : "No unassigned orders need a recommendation now"}</b></div>
                )}
              </div>
              <button className="dn-nexus2-open-section" type="button" onClick={() => openAdminSection(["المندوبون المباشرون", "Live Drivers"])}>
                <Truck size={15} /> {isArabic ? "فتح مركز المندوبين والتوزيع" : "Open driver dispatch center"} <ArrowUpRight size={14} />
              </button>
            </section>

            <section className="dn-nexus2-panel dn-nexus2-merchants">
              <div className="dn-nexus2-section-title">
                <span><UsersRound size={15} /> MERCHANT HEALTH</span>
                <h3>{isArabic ? "صحة ونمو التجار" : "Merchant health & growth"}</h3>
                <p>{isArabic ? "مؤشر 0–100 من التسليم والمرتجعات والإلغاءات والحجم والنمو الحديث." : "0–100 score from delivery, returns, cancellations, volume, and recent growth."}</p>
              </div>
              <div className="dn-nexus2-merchant-list">
                {health.length ? health.map((item) => <MerchantHealthRow key={item.merchantId} item={item} isArabic={isArabic} />) : (
                  <div className="dn-nexus2-empty"><Store size={24} /><b>{isArabic ? "لا توجد بيانات تاجر كافية" : "Not enough merchant data"}</b></div>
                )}
              </div>
              <button className="dn-nexus2-open-section" type="button" onClick={() => openAdminSection(["التجار", "Merchants"])}>
                <Building2 size={15} /> {isArabic ? "فتح إدارة التجار" : "Open merchant management"} <ArrowUpRight size={14} />
              </button>
            </section>
          </div>

          <section className="dn-nexus2-profit-card">
            <div className="dn-nexus2-section-title">
              <span><CircleDollarSign size={15} /> PROFIT INTELLIGENCE</span>
              <h3>{isArabic ? "أين تأتي المساهمة التشغيلية؟" : "Where is operational contribution coming from?"}</h3>
              <p>{isArabic ? "المساهمة هنا قبل توزيع المصروفات المشتركة. صافي التشغيل الموثوق يبقى من مركز المالية." : "Contribution is shown before shared-expense allocation. Authoritative net remains sourced from Finance."}</p>
            </div>
            <div className="dn-nexus2-profit-kpis">
              <div><small>{isArabic ? "مسلّم خلال 30 يوم" : "Delivered · 30d"}</small><b>{snapshot.profit.deliveredOrders}</b></div>
              <div><small>{isArabic ? "مساهمة قبل المصروفات المشتركة" : "Contribution before shared expenses"}</small><b>{formatAdminMoney(snapshot.profit.contributionBeforeSharedExpenses, isArabic)}</b></div>
              <div><small>{isArabic ? "متوسط لكل طلب مسلّم" : "Average per delivered order"}</small><b>{formatAdminMoney(snapshot.profit.averageContributionPerDelivered, isArabic)}</b></div>
              <div className="is-authoritative"><small>{isArabic ? "صافي التشغيل الموثوق" : "Authoritative net estimate"}</small><b>{formatAdminMoney(snapshot.profit.authoritativeNetEstimate, isArabic)}</b></div>
            </div>
            <div className="dn-nexus2-profit-rankings">
              <div>
                <h4>{isArabic ? "أعلى التجار مساهمة" : "Top merchant contribution"}</h4>
                {snapshot.profit.topMerchants.slice(0, 5).map((item, index) => (
                  <p key={item.key}><span>{index + 1}. {item.label}</span><b>{formatAdminMoney(item.contribution, isArabic)}</b></p>
                ))}
              </div>
              <div>
                <h4>{isArabic ? "أعلى المناطق مساهمة" : "Top destination contribution"}</h4>
                {snapshot.profit.topRegions.slice(0, 5).map((item, index) => (
                  <p key={item.key}><span>{index + 1}. {item.label}</span><b>{formatAdminMoney(item.contribution, isArabic)}</b></p>
                ))}
              </div>
            </div>
            <button className="dn-nexus2-open-section" type="button" onClick={() => openAdminSection(["لوحة المالية", "Finance Dashboard"])}>
              <CircleDollarSign size={15} /> {isArabic ? "فتح مركز المالية" : "Open finance center"} <ArrowUpRight size={14} />
            </button>
          </section>

          <footer className="dn-nexus2-proof">
            <ShieldCheck size={15} />
            <span>{isArabic ? "كل النتائج توصيات تحليلية فقط. لا يوجد Assign/Reassign/Status Update/Financial Write من هذه الطبقة." : "All results are analytical recommendations only. This layer performs no assign/reassign/status/financial writes."}</span>
            <small>{lastSync ? lastSync.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE") : "—"}</small>
          </footer>
        </>
      ) : null}
    </section>,
    host,
  );
}
