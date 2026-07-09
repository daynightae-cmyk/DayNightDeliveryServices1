import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Clock3, Radio, RotateCcw, Truck, Wallet, X } from "lucide-react";
import type { Merchant } from "../../types";
import type { FinanceSummary } from "../../lib/adminData";
import khalifaAssets from "./khalifaAssets";

type Props = { isArabic: boolean; orders: any[]; merchants: Merchant[]; financeSummary?: FinanceSummary | null; lastSyncAt?: Date | null; hasFallbackFinance?: boolean };
function amount(value: unknown) { return `${Number(value || 0).toFixed(2)} AED`; }
function norm(value: unknown) { return String(value || "").toLowerCase().replace(/[_-]/g, " "); }

export default function KhalifaAssistantPanel({ isArabic, orders, merchants, financeSummary, lastSyncAt, hasFallbackFinance }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const metrics = useMemo(() => {
    const active = orders.filter((o) => !/deliver|cancel|return/.test(norm(o.status))).length;
    const pending = orders.filter((o) => /pending|review|confirm|verification/.test(norm(o.status))).length;
    const unassigned = orders.filter((o) => !o.driver_id && !o.assigned_driver_id && !o.driver_name && !/deliver|cancel|return/.test(norm(o.status))).length;
    const returned = orders.filter((o) => norm(o.status).includes("return")).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter((o) => String(o.created_at || "").slice(0, 10) === today).length;
    const codPending = financeSummary?.cod_pending ?? orders.reduce((sum, o) => /pending|assigned|transit|pickup/.test(norm(o.status)) ? sum + Number(o.cod_amount || 0) : sum, 0);
    return { active, pending, unassigned, returned, todayOrders, codPending };
  }, [orders, financeSummary]);

  useEffect(() => setDismissed(false), [metrics.pending, metrics.unassigned, metrics.codPending, metrics.returned, hasFallbackFinance]);

  const notices = [
    metrics.pending > 0 && { icon: AlertTriangle, severity: isArabic ? "عاجل" : "Urgent", tone: "gold", title: isArabic ? "مراجعة قبل التوزيع" : "Review before dispatch", message: isArabic ? `يوجد ${metrics.pending} طلب يحتاج مراجعة قبل التوزيع.` : `${metrics.pending} orders need review before dispatch.` },
    metrics.unassigned > 0 && { icon: Truck, severity: isArabic ? "متابعة" : "Follow-up", tone: "gold", title: isArabic ? "طلبات بدون مندوب" : "Unassigned active orders", message: isArabic ? `يوجد ${metrics.unassigned} طلب نشط بدون مندوب.` : `${metrics.unassigned} active orders have no assigned driver.` },
    Number(metrics.codPending) > 0 && { icon: Wallet, severity: isArabic ? "متابعة" : "Follow-up", tone: "gold", title: isArabic ? "تحصيل COD معلق" : "Pending COD", message: isArabic ? `تحصيل COD معلق بقيمة ${amount(metrics.codPending)}.` : `Pending COD amount is ${amount(metrics.codPending)}.` },
    metrics.returned > 0 && { icon: RotateCcw, severity: isArabic ? "متابعة" : "Follow-up", tone: "gold", title: isArabic ? "إغلاق الراجع" : "Return closure", message: isArabic ? `يوجد ${metrics.returned} طلب راجع يحتاج إغلاق سبب الراجع.` : `${metrics.returned} returned orders need return reason closure.` },
    { icon: Clock3, severity: isArabic ? "معلومة" : "Info", tone: "blue", title: isArabic ? "أداء اليوم" : "Today performance", message: isArabic ? `تم تسجيل ${metrics.todayOrders} طلب اليوم.` : `${metrics.todayOrders} orders were created today.` },
    hasFallbackFinance && { icon: AlertTriangle, severity: isArabic ? "تنبيه نظام" : "System", tone: "rose", title: isArabic ? "ملخص محسوب" : "Calculated summary", message: isArabic ? "تنبيه نظام: بعض الجداول التفصيلية غير مفعلة، ويتم استخدام الملخص المحسوب." : "System notice: some detail tables are not enabled; calculated summaries are being used." },
  ].filter(Boolean) as { icon: typeof AlertTriangle; severity: string; tone: string; title: string; message: string }[];
  const criticalCount = notices.filter((n) => n.tone === "gold" || n.tone === "rose").length;
  const sync = lastSyncAt ? lastSyncAt.toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" }) : "—";

  return <>
    <section className="dn-khalifa-connected-card">
      <img src={khalifaAssets.bot} alt={isArabic ? "خليفة" : "Khalifa"} />
      <div><h2>{isArabic ? "خليفة" : "Khalifa"}</h2><p>{isArabic ? "مساعد العمليات الذكي" : "Smart Operations Assistant"}</p><small><Radio className="h-3 w-3" />{isArabic ? "متصل بالبيانات الحية" : "Connected to live data"} • {sync}</small></div>
      <dl><div><dt>{isArabic ? "تنبيهات" : "Alerts"}</dt><dd>{criticalCount}</dd></div><div><dt>{isArabic ? "نشطة" : "Active"}</dt><dd>{metrics.active}</dd></div><div><dt>COD</dt><dd>{amount(metrics.codPending)}</dd></div><div><dt>{isArabic ? "بدون مندوب" : "Unassigned"}</dt><dd>{metrics.unassigned}</dd></div></dl>
    </section>
    {criticalCount > 0 && !dismissed && <div className="dn-khalifa-toast"><BellRing className="h-4 w-4" /><span>{isArabic ? `خليفة وجد ${criticalCount} تنبيه تشغيلي يحتاج متابعة.` : `Khalifa found ${criticalCount} operational alerts to review.`}</span><button type="button" onClick={() => setDismissed(true)}><X className="h-3.5 w-3.5" /></button></div>}
    <section className="dn-khalifa-feed" aria-label={isArabic ? "تغذية خليفة" : "Khalifa Feed"}><header><span>{isArabic ? "تغذية خليفة" : "Khalifa Feed"}</span><strong>{isArabic ? "تنبيهات وإرشادات" : "Notifications & Guidance"}</strong></header><div className="dn-khalifa-feed-list">{(notices.length ? notices : [{ icon: CheckCircle2, severity: isArabic ? "معلومة" : "Info", tone: "blue", title: isArabic ? "العمليات مستقرة" : "Operations stable", message: isArabic ? "لا توجد تنبيهات عاجلة الآن. كل شيء مستقر." : "No urgent alerts right now. Operations look stable." }]).map((notice, index) => { const Icon = notice.icon; return <article key={`${notice.title}-${index}`} className={`is-${notice.tone}`}><div className="dn-khalifa-feed-icon"><Icon className="h-4 w-4" /></div><div><strong>{notice.title}</strong><p>{notice.message}</p></div><span>{notice.severity}</span></article>; })}</div></section>
  </>;
}
