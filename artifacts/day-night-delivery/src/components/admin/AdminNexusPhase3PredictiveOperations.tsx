import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Camera, Clock3, Globe2, Loader2, RefreshCw, ShieldCheck, Sparkles, TimerReset } from "lucide-react";
import { fetchAdminOrders } from "../../lib/adminData";
import { buildNexusPhase3Snapshot, type InternationalShipment, type NexusPhase3Snapshot } from "../../lib/nexusPhase3Engine";
import { supabase } from "../../supabase";
import "../../styles/dn-nexus-phase3.css";

function findVisibleNexusContent() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(".dn-nexus-content"));
  return nodes.find((node) => node.getClientRects().length > 0) || null;
}

function formatEta(value: string | null, isArabic: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(date);
}

export default function AdminNexusPhase3PredictiveOperations() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isArabic, setIsArabic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<NexusPhase3Snapshot | null>(null);

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
      const [orders, shipmentResult] = await Promise.all([
        fetchAdminOrders(),
        supabase.from("international_shipments").select("id,order_id,tracking_number,public_tracking_number,carrier_name,normalized_status,latest_description,latest_location,destination_city,destination_country,estimated_delivery_at,latest_update_at,last_synced_at,last_webhook_at,delivered_at").order("latest_update_at", { ascending: false }),
      ]);
      if (shipmentResult.error) throw shipmentResult.error;
      setSnapshot(buildNexusPhase3Snapshot(orders, (shipmentResult.data || []) as InternationalShipment[], new Date()));
    } catch (cause) {
      console.warn("NEXUS Phase 3 refresh failed safely.", cause);
      setError(isArabic ? "تعذر تحديث الطبقة التنبؤية الآن. لم يتم اختلاق أي ETA أو حالة ناقل." : "Predictive operations could not refresh. No ETA or carrier state was fabricated.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [host, isArabic]);

  useEffect(() => {
    if (!host) { setSnapshot(null); return; }
    void load(false);
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [host, load]);

  const etas = useMemo(() => snapshot?.predictiveEta.slice(0, 6) || [], [snapshot]);
  const proofs = useMemo(() => snapshot?.proofIntegrity.slice(0, 6) || [], [snapshot]);
  const anomalies = useMemo(() => snapshot?.anomalies.slice(0, 8) || [], [snapshot]);
  const carriers = useMemo(() => snapshot?.carrierWatch.slice(0, 6) || [], [snapshot]);

  if (!host) return null;
  return createPortal(
    <section className="dn-nexus3" aria-label={isArabic ? "NEXUS AI المرحلة الثالثة" : "NEXUS AI Phase 3"}>
      <header className="dn-nexus3-header">
        <div>
          <span><Sparkles size={16}/> NEXUS PREDICTIVE OPERATIONS · PHASE 3</span>
          <h3>{isArabic ? "توقّع المخاطر قبل أن تتحول إلى مشكلة" : "See operational risk before it becomes a problem"}</h3>
          <p>{isArabic ? "ETA مفسَّر، سلامة إثبات التسليم، كشف شذوذ، ومراقبة Aramex/17TRACK من بيانات الإنتاج فقط." : "Explainable ETA, delivery-proof integrity, anomaly detection, and Aramex/17TRACK watch using production data only."}</p>
        </div>
        <div className="dn-nexus3-actions">
          <span><ShieldCheck size={14}/>{isArabic ? "Read-only · لا تنفيذ تلقائي" : "Read-only · no automatic writes"}</span>
          <button type="button" onClick={() => void load(false)} disabled={loading}>{loading ? <Loader2 className="dn-nexus-spin" size={15}/> : <RefreshCw size={15}/>} {isArabic ? "تحديث" : "Refresh"}</button>
        </div>
      </header>

      {error && <div className="dn-nexus3-error"><AlertTriangle size={15}/>{error}</div>}
      {!snapshot && loading ? <div className="dn-nexus3-loading"><Loader2 className="dn-nexus-spin"/><b>{isArabic ? "بناء صورة Predictive Operations…" : "Building predictive operations…"}</b></div> : snapshot ? <>
        <div className="dn-nexus3-kpis">
          <article><TimerReset/><span>{isArabic ? "ETA عالي الثقة" : "High-confidence ETA"}</span><b>{snapshot.counters.etaHighConfidence}</b></article>
          <article><Camera/><span>{isArabic ? "إثبات مكتمل" : "Complete proof"}</span><b>{snapshot.counters.proofComplete}</b></article>
          <article><AlertTriangle/><span>{isArabic ? "شذوذ حرج" : "Critical anomalies"}</span><b>{snapshot.counters.anomaliesCritical}</b></article>
          <article><Globe2/><span>{isArabic ? "شحنات دولية متأخرة" : "Stale international"}</span><b>{snapshot.counters.carriersStale}</b></article>
        </div>

        <div className="dn-nexus3-grid">
          <section className="dn-nexus3-panel">
            <div className="dn-nexus3-title"><TimerReset size={16}/><div><b>PREDICTIVE ETA</b><span>{isArabic ? "موعد ناقل حقيقي أولًا، ثم تقدير تشغيلي محافظ" : "Carrier ETA first, then conservative operational estimate"}</span></div></div>
            <div className="dn-nexus3-list">{etas.length ? etas.map((item) => <article key={item.orderId} className={`eta-${item.confidence}`}><div><strong>{item.reference}</strong><small>{item.labelAr && (isArabic ? item.labelAr : item.labelEn)}</small></div><b>{formatEta(item.etaAt, isArabic)}</b><p>{isArabic ? item.reasonAr : item.reasonEn}</p></article>) : <em>{isArabic ? "لا توجد طلبات تحتاج ETA الآن." : "No active orders need ETA now."}</em>}</div>
          </section>

          <section className="dn-nexus3-panel">
            <div className="dn-nexus3-title"><Camera size={16}/><div><b>PROOF INTEGRITY</b><span>{isArabic ? "سلامة الإثبات الموجود فعلًا — لا ادعاء Computer Vision" : "Integrity of existing proof — no fake computer-vision claim"}</span></div></div>
            <div className="dn-nexus3-list">{proofs.length ? proofs.map((item) => <article key={item.orderId} className={`proof-${item.tier}`}><div><strong>{item.reference}</strong><small>{isArabic ? `موجود: ${item.present.join(" · ") || "لا شيء"}` : `Present: ${item.present.join(" · ") || "none"}`}</small></div><b>{item.score}%</b><p>{isArabic ? `ناقص: ${item.missing.join(" · ") || "لا شيء"}` : `Missing: ${item.missing.join(" · ") || "none"}`}</p></article>) : <em>{isArabic ? "لا توجد طلبات مسلّمة لفحص الإثبات." : "No delivered orders to inspect."}</em>}</div>
          </section>

          <section className="dn-nexus3-panel">
            <div className="dn-nexus3-title"><AlertTriangle size={16}/><div><b>ANOMALY DETECTION</b><span>{isArabic ? "تناقضات تشغيلية يجب رؤيتها فورًا" : "Operational inconsistencies that deserve immediate attention"}</span></div></div>
            <div className="dn-nexus3-list">{anomalies.length ? anomalies.map((item) => <article key={item.id} className={`anomaly-${item.severity}`}><div><strong>{item.reference}</strong><small>{isArabic ? item.titleAr : item.titleEn}</small></div><p>{isArabic ? item.detailAr : item.detailEn}</p></article>) : <em>{isArabic ? "لا يوجد شذوذ مكتشف ضمن القواعد الحالية." : "No anomalies detected by current rules."}</em>}</div>
          </section>

          <section className="dn-nexus3-panel">
            <div className="dn-nexus3-title"><Globe2 size={16}/><div><b>INTERNATIONAL ORCHESTRATION</b><span>{isArabic ? "Aramex / 17TRACK freshness + ETA + sync watch" : "Aramex / 17TRACK freshness + ETA + sync watch"}</span></div></div>
            <div className="dn-nexus3-list">{carriers.length ? carriers.map((item) => <article key={item.shipmentId} className={`carrier-${item.state}`}><div><strong>{item.tracking}</strong><small>{item.carrier} · {item.status} · {item.destination}</small></div><b>{item.etaAt ? formatEta(item.etaAt, isArabic) : "—"}</b><p>{isArabic ? item.noteAr : item.noteEn}{item.freshnessHours !== null ? ` · ${Math.round(item.freshnessHours)}h` : ""}</p></article>) : <em>{isArabic ? "لا توجد شحنات دولية مسجلة حاليًا." : "No international shipments are currently registered."}</em>}</div>
          </section>
        </div>

        <footer className="dn-nexus3-foot"><Clock3 size={13}/>{isArabic ? "التقديرات ليست وعود تسليم، ولا يتم تعديل أي طلب أو شحنة من هذه الطبقة." : "Estimates are not delivery promises, and this layer never modifies an order or shipment."}</footer>
      </> : null}
    </section>, host
  );
}
