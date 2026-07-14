import { useEffect, useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import { AlertTriangle, Bot, Landmark, Loader2, Navigation, Receipt, Send, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react";
import type { Merchant, Order } from "../../types";
import type { AdminDbHealthCheck, FinanceSummary } from "../../lib/adminData";
import { deriveCommandMetrics } from "../../data/adminCommandExpansion";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";
import { AdminIconBadge, AdminStateChip } from "./adminIconSystem";

type Props = { orders: Order[]; merchants: Merchant[]; financeSummary?: FinanceSummary | null; activeSection?: string; isArabic: boolean; dbHealthChecks?: AdminDbHealthCheck[] };
type ChatItem = { id: string; question: string; answer: string };
const money = (v: unknown) => `${Number(v || 0).toFixed(2)} AED`;
const norm = (v: unknown) => String(v || "").toLowerCase();
const revenue = (o: Order) => Number(o.delivery_price || o.price || o.base_price || 0);
const cod = (o: Order) => Number(o.cod_amount || 0);
const merchantName = (m?: Merchant) => m?.trade_name || m?.owner_name || m?.merchant_code || (m?.id ? `#${m.id}` : "—");

function loadedHealthChecks(props: Props): AdminDbHealthCheck[] {
  if (props.dbHealthChecks?.length) return props.dbHealthChecks;
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem("dn_admin_db_health") || "[]") as AdminDbHealthCheck[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readinessAnswer(isArabic: boolean, question: string) {
  const q = norm(question);
  const wants = /جاهز للإنتاج|النظام عالمي|يمنع العالمية|مالية db|finance db|الطباعة جاهزة|الإغلاق اليومي آمن|أول خطر|production ready|global|what blocks|print ready|daily closing safe|first risk/.test(q);
  if (!wants) return "";
  if (typeof window === "undefined") return isArabic ? "افتح مركز جاهزية الإنتاج واضغط إعادة الفحص." : "Open Production Readiness and press Re-run.";
  try {
    const report = JSON.parse(window.localStorage.getItem("dn_admin_production_readiness") || "null") as { overallScore?: number; status?: string; blockers?: number; items?: Array<{ id?: string; status?: string; risk?: string; messageAr?: string; messageEn?: string }> } | null;
    if (!report?.items?.length) return isArabic ? "افتح مركز جاهزية الإنتاج واضغط إعادة الفحص." : "Open Production Readiness and press Re-run.";
    const finance = report.items.find((item) => item.id === "finance");
    const print = report.items.find((item) => item.id === "print");
    const closing = report.items.find((item) => item.id === "daily_closing");
    const global = report.items.find((item) => item.id === "global");
    const firstRisk = report.items.find((item) => item.status === "blocked" || item.risk === "critical") || report.items.find((item) => item.risk === "high");
    if (/مالية db|finance db/.test(q)) return isArabic ? (finance?.messageAr || "راجع مركز جاهزية الإنتاج للمالية.") : (finance?.messageEn || "Check Production Readiness for finance.");
    if (/الطباعة جاهزة|print ready/.test(q)) return isArabic ? (print?.messageAr || "راجع جاهزية الطباعة.") : (print?.messageEn || "Check print readiness.");
    if (/الإغلاق اليومي آمن|daily closing safe/.test(q)) return isArabic ? (closing?.messageAr || "راجع إغلاق اليوم.") : (closing?.messageEn || "Check daily closing.");
    if (/يمنع العالمية|what blocks|أول خطر|first risk/.test(q)) return isArabic ? `أول خطر الآن: ${firstRisk?.messageAr || "لا توجد موانع حرجة ظاهرة"}.` : `First risk now: ${firstRisk?.messageEn || "No visible critical blockers"}.`;
    if (/النظام عالمي|global/.test(q)) return isArabic ? (global?.messageAr || "النظام يحتاج مراجعة عالمية.") : (global?.messageEn || "The system needs global-readiness review.");
    return isArabic ? `جاهزية الإنتاج ${report.overallScore || 0}%، الحالة ${report.status || "غير معروف"}، الموانع ${report.blockers || 0}.` : `Production readiness is ${report.overallScore || 0}%, status ${report.status || "unknown"}, blockers ${report.blockers || 0}.`;
  } catch {
    return isArabic ? "افتح مركز جاهزية الإنتاج واضغط إعادة الفحص." : "Open Production Readiness and press Re-run.";
  }
}

function healthAnswer(checks: AdminDbHealthCheck[], isArabic: boolean, question: string) {
  const q = norm(question);
  const wantsHealth = /database|supabase|finance_summary|daily closing|print queue|db-backed|قاعدة البيانات|شغال|إغلاق اليوم محفوظ|الطباعة|ماذا ينقص/.test(q);
  if (!wantsHealth) return "";
  if (!checks.length) return isArabic ? "افتح مركز فحص قاعدة البيانات واضغط إعادة الفحص." : "Open Database Health Center and press Re-run checks.";
  const byId = (id: string) => checks.find((check) => check.id === id);
  const missing = checks.filter((check) => check.status === "missing" || check.status === "error").map((check) => check.id);
  const permission = checks.filter((check) => check.status === "permission").map((check) => check.id);
  const summary = isArabic ? `جاهزية قاعدة البيانات: ${checks.filter((check) => check.status === "ok").length}/${checks.length} تعمل. ينقص Supabase: ${missing.join(", ") || "لا شيء أساسي"}. مشاكل الصلاحيات: ${permission.join(", ") || "لا توجد"}.` : `Database readiness: ${checks.filter((check) => check.status === "ok").length}/${checks.length} working. Missing in Supabase: ${missing.join(", ") || "nothing critical"}. Permission issues: ${permission.join(", ") || "none"}.`;
  if (/finance_summary|ملخص/.test(q)) { const check = byId("finance_summary") || byId("get_finance_summary"); return check ? (isArabic ? `finance_summary: ${check.messageAr}. ${summary}` : `finance_summary: ${check.messageEn}. ${summary}`) : summary; }
  if (/daily closing|إغلاق/.test(q)) { const check = byId("admin_daily_closings"); return check ? (isArabic ? `إغلاق اليوم DB-backed عبر admin_daily_closings: ${check.messageAr}.` : `Daily closing DB-backed via admin_daily_closings: ${check.messageEn}.`) : summary; }
  if (/print queue|print|الطباعة/.test(q)) { const check = byId("print_jobs"); return check ? (isArabic ? `الطباعة مرتبطة بجدول print_jobs: ${check.messageAr}.` : `Print queue connected through print_jobs: ${check.messageEn}.`) : summary; }
  return summary;
}

function financeRiskAnswer(props: Props, question: string) {
  const { isArabic, financeSummary, activeSection } = props;
  const q = norm(question);
  const wants = /هل أصرف للتجار|هل أصرف للمناديب|هل cod متسوي|هل المالية جاهزة|ما خطر المالية|ما أول إجراء مالي|ما صافي اليوم|هل أقدر أقفل اليوم|pay merchants|pay drivers|cod reconciled|finance ready|finance risk|first finance action|today'?s net|close today/i.test(q);
  if (!wants) return "";
  const pendingCod = Number(financeSummary?.cod_pending || 0);
  const reconciled = Number(financeSummary?.cod_reconciled || 0);
  const collected = Number(financeSummary?.cod_collected || 0);
  const net = Number(financeSummary?.net_estimate || 0);
  const sourceNote = /finance|مالية/i.test(activeSection || "") ? (isArabic ? "إن كان مصدر المالية Derived fallback فلا تعتبر الأرقام نهائية." : "If finance source is Derived fallback, numbers are not final.") : (isArabic ? "افتح مركز المالية للتأكد من مصدر البيانات." : "Open Finance Center to verify the data source.");
  const codNote = pendingCod > 0 || collected > reconciled ? (isArabic ? `COD غير مكتمل: معلق ${money(pendingCod)} وغير مسوى تقديرياً ${money(Math.max(0, collected - reconciled))}.` : `COD is not complete: pending ${money(pendingCod)} and estimated unreconciled ${money(Math.max(0, collected - reconciled))}.`) : (isArabic ? "COD لا يظهر عليه تعليق في الملخص الحالي." : "COD does not show a pending balance in the current summary.");
  if (/أصرف للتجار|pay merchants/i.test(q)) return pendingCod > 0 ? (isArabic ? `${codNote} لا تصرف للتجار قبل فتح مركز المالية ثم تسوية COD وكشوفات التجار.` : `${codNote} Do not pay merchants before opening Finance Center and reconciling COD/merchant statements.`) : (isArabic ? `يمكن التحضير للصرف لكن راجع كشوفات التجار أولاً. ${sourceNote}` : `You can prepare payout, but review merchant statements first. ${sourceNote}`);
  if (/أصرف للمناديب|pay drivers/i.test(q)) return pendingCod > 0 ? (isArabic ? `${codNote} صرف المناديب موقوف حتى لا يبقى COD على المندوب.` : `${codNote} Driver payout is blocked until assigned COD is cleared.`) : (isArabic ? `راجع كشوفات المناديب ثم صدّر التقرير. ${sourceNote}` : `Review driver statements then export the report. ${sourceNote}`);
  if (/cod متسوي|cod reconciled/i.test(q)) return `${codNote} ${isArabic ? "افتح التحصيل COD من مركز المالية." : "Open COD collections from Finance Center."}`;
  if (/خطر المالية|finance risk/i.test(q)) return pendingCod > 0 ? (isArabic ? `الخطر الأول ماليًا هو COD المعلق. ${codNote}` : `The first finance risk is pending COD. ${codNote}`) : (isArabic ? `الخطر الحالي هو الاعتماد على مصدر غير DB-backed إن كان ظاهراً كمشتق. ${sourceNote}` : `Current risk is relying on non DB-backed data if the source is derived. ${sourceNote}`);
  if (/أول إجراء مالي|first finance action/i.test(q)) return pendingCod > 0 ? (isArabic ? "أول إجراء: افتح مركز المالية ثم تسوية COD قبل الصرف أو إغلاق اليوم." : "First action: open Finance Center and reconcile COD before payout or daily closing.") : (isArabic ? "أول إجراء: راجع مصدر البيانات ثم صدّر كشوفات التجار والمناديب." : "First action: verify data source, then export merchant and driver statements.");
  if (/صافي اليوم|today'?s net/i.test(q)) return isArabic ? `صافي اليوم التقديري ${money(net)}. ${sourceNote}` : `Estimated net is ${money(net)}. ${sourceNote}`;
  return pendingCod > 0 ? (isArabic ? `المالية تحتاج مراجعة قبل الإغلاق أو الصرف. ${codNote}` : `Finance needs review before closing or payout. ${codNote}`) : (isArabic ? `المالية تبدو قابلة للمراجعة، لكن لا تعتبرها نهائية إذا كان المصدر مشتقاً. ${sourceNote}` : `Finance looks reviewable, but not final if source is derived. ${sourceNote}`);
}

function answer(question: string, props: Props): string {
  const { orders, merchants, financeSummary, isArabic, activeSection } = props;
  const q = norm(question);
  const readinessResponse = readinessAnswer(isArabic, question);
  if (readinessResponse) return readinessResponse;
  const healthResponse = healthAnswer(loadedHealthChecks(props), isArabic, question);
  if (healthResponse) return healthResponse;
  const financeResponse = financeRiskAnswer(props, question);
  if (financeResponse) return financeResponse;
  const metrics = deriveCommandMetrics(orders, merchants, financeSummary);
  const delivered = orders.filter((o) => /deliver|complete/.test(norm(o.status)));
  const unassigned = orders.filter((o) => !o.driver_code && !o.driver_name && !o.driver_phone);
  const pendingCod = orders.filter((o) => cod(o) > 0 && !/deliver|complete|reconcile|collect/.test(norm(o.status))).reduce((s, o) => s + cod(o), 0);
  const collectedCod = delivered.reduce((s, o) => s + cod(o), 0);
  const byMerchant = new Map<string, number>();
  orders.forEach((o) => byMerchant.set(o.merchant_id || o.merchant_name || "unknown", (byMerchant.get(o.merchant_id || o.merchant_name || "unknown") || 0) + 1));
  const [topMerchantId = "unknown", topMerchantCount = 0] = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const topMerchant = merchants.find((m) => m.id === topMerchantId || m.trade_name === topMerchantId);
  const byCity = new Map<string, number>();
  orders.forEach((o) => byCity.set(o.receiver_city || o.sender_city || "—", (byCity.get(o.receiver_city || o.sender_city || "—") || 0) + 1));
  const [topRoute = "—", topRouteCount = 0] = [...byCity.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const expenseTotal = Number(financeSummary?.total_expenses || 0);
  const adjustmentNet = 0;
  const grossRevenue = orders.reduce((s, o) => s + revenue(o), 0);
  const net = Number(financeSummary?.net_estimate ?? (grossRevenue - expenseTotal + adjustmentNet));
  const unreconciledCod = Math.max(0, collectedCod - Number(financeSummary?.cod_reconciled || 0));
  const pendingReviewOrders = orders.filter((o) => /review|confirm|hold|pending/.test(norm(o.status))).length;
  const expensesPending = expenseTotal > 0 ? 0 : 0;
  const closingStatus = net < 0 ? (isArabic ? "خطر مالي — لا تغلق اليوم بعد" : "Financial risk — do not close yet") : (pendingCod > 0 || unreconciledCod > 0 || pendingReviewOrders > 0 || expensesPending > 0 ? (isArabic ? "يحتاج مراجعة قبل الإغلاق" : "Needs review before close") : (isArabic ? "جاهز للإغلاق" : "Ready to close"));
  const nextAction = pendingCod > 0 || unreconciledCod > 0 ? (isArabic ? "افتح التحصيل وسوِّ COD قبل الإغلاق." : "Open COD reconciliation before closing.") : pendingReviewOrders > 0 ? (isArabic ? "افتح الطلبات قيد المراجعة." : "Open pending review orders.") : net < 0 ? (isArabic ? "راجع المصروفات والدخل قبل الإغلاق." : "Review expenses and income before closing.") : (isArabic ? "صدّر تقرير الإغلاق وعلّم اليوم كمراجع." : "Export the closing report and mark the day reviewed.");

  if (/close|closing|أقفل|اغلاق|إغلاق|سبب عدم|why should/.test(q)) return isArabic ? `حالة الإغلاق: ${closingStatus}. COD المتبقي ${money(pendingCod)}، COD غير مسوى ${money(unreconciledCod)}، مصروفات بانتظار الاعتماد ${expensesPending}، وطلبات تحتاج مراجعة ${pendingReviewOrders}. الإجراء المقترح: ${nextAction}` : `Closing status: ${closingStatus}. Pending COD ${money(pendingCod)}, unreconciled COD ${money(unreconciledCod)}, expenses pending approval ${expensesPending}, and pending review orders ${pendingReviewOrders}. Recommended next action: ${nextAction}`;
  if (/pending cod|cod المتبقي|كم cod|كم التحصيل/.test(q)) return isArabic ? `COD المتبقي ${money(pendingCod)} وCOD غير مسوى ${money(unreconciledCod)}. حالة الإغلاق: ${closingStatus}. الإجراء المقترح: ${nextAction}` : `Pending COD is ${money(pendingCod)} and unreconciled COD is ${money(unreconciledCod)}. Closing status: ${closingStatus}. Recommended next action: ${nextAction}`;

  if (/unreconciled|غير مسو|غير مسوّى|معلق|pending|تحصيل/.test(q)) return isArabic ? `إجمالي COD المعلق حالياً هو ${money(pendingCod)}. الأولوية: راجع كشوفات المناديب غير المسوية قبل إغلاق اليوم.` : `Unreconciled COD is ${money(pendingCod)} across related order rows. Review driver statements and COD collection first.`;
  if (/collected|محصل|محصّل/.test(q)) return isArabic ? `COD المحصّل تقديرياً من الطلبات المسلّمة هو ${money(collectedCod)}. راجع التسوية قبل اعتماد الإقفال.` : `Estimated collected COD from delivered orders is ${money(collectedCod)}. Reconcile before closing.`;
  if (/تاجر|merchant|top/.test(q)) return isArabic ? `أكثر تاجر نشاطاً هو ${merchantName(topMerchant) || topMerchantId} بعدد ${topMerchantCount} طلب. افتح كشوفات التجار لمراجعة الرصيد.` : `Top merchant is ${merchantName(topMerchant) || topMerchantId} with ${topMerchantCount} orders. Open merchant statements to review balance.`;
  if (/مندوب|driver|unassigned|بدون/.test(q)) return isArabic ? `يوجد ${unassigned.length} طلب بدون مندوب واضح. افتح التوزيع وكشوفات المناديب قبل ذروة التسليم.` : `${unassigned.length} orders have no clear driver. Open dispatch and driver statements before the delivery peak.`;
  if (/أبوظبي|abu dhabi/.test(q)) return isArabic ? `طلبات أبوظبي/المناطق المرتبطة: ${orders.filter((o) => /abu|dhabi|أبوظبي|العين|mussafah/i.test(`${o.sender_city} ${o.receiver_city}`)).length}. راقب التأخير وCOD حسب المنطقة.` : `Abu Dhabi related orders: ${orders.filter((o) => /abu|dhabi|al ain|mussafah/i.test(`${o.sender_city} ${o.receiver_city}`)).length}. Watch delays and COD by area.`;
  if (/expense|مصروف|adjust|تسوية/.test(q)) return isArabic ? `المصروفات ${money(expenseTotal)} وصافي التسويات ${money(adjustmentNet)}. لا تعتمد أي مصروف بدون مرجع وتاريخ.` : `Expenses are ${money(expenseTotal)} and net adjustments are ${money(adjustmentNet)}. Do not approve expenses without reference and date.`;
  if (/break|net|ربح|خسارة|صافي/.test(q)) return isArabic ? `صافي التشغيل التقديري ${money(net)} من دخل ${money(grossRevenue)} ناقص مصروفات ${money(expenseTotal)} مع التسويات. الحالة: ${net >= 0 ? "فوق نقطة التعادل" : "تحت نقطة التعادل"}.` : `Estimated net is ${money(net)} from ${money(grossRevenue)} revenue minus ${money(expenseTotal)} expenses plus adjustments. Status: ${net >= 0 ? "above break-even" : "below break-even"}.`;
  if (/route|area|منطقة|مسار/.test(q)) return isArabic ? `أعلى منطقة/مسار حالياً: ${topRoute} بعدد ${topRouteCount} طلب. استخدم فلتر المنطقة لتقليل زمن الرحلات.` : `Top route/area is ${topRoute} with ${topRouteCount} orders. Use the area filter to reduce route time.`;
  if (/print|import|audit|طباعة|استيراد|تدقيق/.test(q)) return isArabic ? `الأدوات التشغيلية تعمل كمعاينات آمنة عند غياب الجداول: الاستيراد لا ينشئ طلبات قبل التأكيد، والطباعة تنشئ طابور مهام، والتدقيق يعرض أحداثاً منسقة بدون JSON خام.` : `Operational tools use safe previews when tables are unavailable: imports do not create orders before confirmation, print creates queued jobs, and audit is formatted without raw JSON.`;
  return isArabic ? `ملخص ${activeSection || "الإدارة"}: ${metrics.orders} طلب، ${metrics.active} نشط، ${metrics.delivered} مسلّم، COD معلق ${money(metrics.codPending)}، والمخاطر الأهم هي التأخير والطلبات غير المعينة.` : `${activeSection || "Admin"} summary: ${metrics.orders} orders, ${metrics.active} active, ${metrics.delivered} delivered, pending COD ${money(metrics.codPending)}, with main risks in delays and unassigned work.`;
}

export default function KhalifaLiveAssistant(props: Props) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setHealthNonce] = useState(0);
  useEffect(() => { const handler = () => setHealthNonce((value) => value + 1); window.addEventListener("dn-admin-db-health-change", handler); return () => window.removeEventListener("dn-admin-db-health-change", handler); }, []);
  const latest = history[0]?.answer;
  const hint = props.isArabic ? "اسأل خليفة عن التحصيل، المناديب، المصروفات، التجار..." : "Ask Khalifa about COD, drivers, expenses, merchants...";
  const note = props.isArabic ? "الإجابة مبنية على البيانات المحملة حالياً" : "Answer is based on currently loaded data";
  const examples = useMemo(() => { const base = props.isArabic ? ["هل أقدر أقفل اليوم؟", "هل أصرف للتجار؟", "ما خطر المالية الآن؟", "ما صافي اليوم؟", "افتح التحصيل", "افتح المصروفات", "ما سبب عدم إغلاق اليوم؟", "هل قاعدة البيانات جاهزة؟", "هل finance_summary شغال؟"] : ["Can I close today?", "What is pending COD?", "What is today's net?", "Open COD reconciliation", "Open expenses", "Why should I not close today?", "Is the database ready?", "Is finance_summary working?", "Is the app production ready?", "What blocks global readiness?"]; const section = props.activeSection || ""; return /مصروف|expense/i.test(section) ? [base[5], base[4], base[1], ...base.slice(0,3)] : /تاجر|merchant/i.test(section) ? [base[2], base[0], base[4], ...base.slice(3,5)] : /مندوب|driver|pickup|إحضار/i.test(section) ? [base[3], base[0], base[1], ...base.slice(4)] : base; }, [props.isArabic, props.activeSection]);
  function askNow(text: string) { const trimmed = text.trim(); if (!trimmed) return; playAdminAudioEvent("click"); setLoading(true); window.setTimeout(() => { const nextAnswer = answer(trimmed, props); addAdminNotification({ type: "khalifa", sectionId: props.activeSection || "khalifa", priority: /لا تغلق|نقص|بدون مندوب|missing|unassigned|خطر/i.test(nextAnswer) ? "high" : "normal", dedupeKey: `khalifa:${trimmed.slice(0, 40)}`, audioEvent: "khalifa_insight", titleAr: "توصية خليفة", titleEn: "Khalifa recommendation", bodyAr: nextAnswer, bodyEn: nextAnswer }); setHistory((items) => [{ id: `${Date.now()}`, question: trimmed, answer: nextAnswer }, ...items].slice(0, 6)); setQuestion(""); setLoading(false); }, 120); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); askNow(question); }
  const iconForExample = (item: string) => {
    if (/أقفل|close/i.test(item)) return ShieldCheck;
    if (/تجار|merchants/i.test(item)) return Landmark;
    if (/خطر|risk|blocks/i.test(item)) return AlertTriangle;
    if (/cod|تحصيل/i.test(item)) return Receipt;
    if (/مصروف|expense|net|صافي/i.test(item)) return Wallet;
    if (/افتح|open|next|التالي/i.test(item)) return Navigation;
    return Sparkles;
  };
  return (
    <section
      className="dn-khalifa-live"
      aria-label={props.isArabic ? "اسأل خليفة" : "Ask Khalifa"}
    >
      <header className="dn-khalifa-live-header">
        <AdminIconBadge name="question" />
        <div>
          <strong>{props.isArabic ? "اسأل خليفة" : "Ask Khalifa"}</strong>
          <small>{note}</small>
        </div>
      </header>

      <form onSubmit={submit}>
        <label htmlFor="dn-khalifa-question">{hint}</label>
        <div className="dn-khalifa-question-field">
          <Bot className="h-4 w-4" aria-hidden="true" />
          <textarea
            id="dn-khalifa-question"
            value={question}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setQuestion(event.target.value)
            }
            placeholder={hint}
            rows={3}
          />
        </div>
        <div className="dn-khalifa-live-actions">
          <button type="submit" disabled={loading || !question.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {loading
              ? props.isArabic
                ? "يفكر..."
                : "Thinking..."
              : props.isArabic
                ? "إرسال"
                : "Send"}
          </button>
          <button
            type="button"
            onClick={() => setHistory([])}
            disabled={!history.length}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {props.isArabic ? "مسح" : "Clear"}
          </button>
        </div>
      </form>

      <AdminStateChip name="live-data" tone="success">
        {note}
      </AdminStateChip>

      <div className="dn-khalifa-examples">
        {examples.map((item) => {
          const ExampleIcon = iconForExample(item);
          return (
            <button
              type="button"
              className="dn-khalifa-question-chip"
              key={item}
              onClick={() => askNow(item)}
            >
              <ExampleIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {item}
            </button>
          );
        })}
      </div>

      {latest && (
        <article className="dn-khalifa-answer">
          <AdminIconBadge name="khalifa-insight" />
          <strong>{props.isArabic ? "إجابة خليفة" : "Khalifa answer"}</strong>
          <p>{latest}</p>
        </article>
      )}

      <ul>
        {history.slice(0, 4).map((item) => (
          <li key={item.id}>
            <AdminIconBadge name="question" />
            <b>{item.question}</b>
            <span>{item.answer}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
