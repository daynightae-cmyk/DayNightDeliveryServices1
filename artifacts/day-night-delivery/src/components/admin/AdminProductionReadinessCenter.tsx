import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Copy,
  Database,
  FileCode2,
  Printer,
  RefreshCw,
} from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { AdminIconBadge, AdminStateChip } from "./adminIconSystem";
import { addAdminNotification } from "../../lib/adminAudio";
import {
  fetchAdminProductionReadiness,
  type AdminProductionReadinessItem,
  type AdminProductionReadinessReport,
} from "../../lib/adminData";
import { fetchFinanceHardeningHealth } from "../../lib/adminFinanceLedger";

type Props = { isArabic: boolean; onNavigate?: (id: string) => void };
type FinanceHealth = Record<string, unknown> & { ok?: boolean; reason?: string };

const statusText = {
  ready: { ar: "جاهز", en: "Ready" },
  needs_review: { ar: "يحتاج مراجعة", en: "Needs review" },
  blocked: { ar: "مانع للإنتاج", en: "Blocked" },
  unknown: { ar: "غير معروف", en: "Unknown" },
};
const riskText = {
  low: { ar: "منخفض", en: "Low" },
  medium: { ar: "متوسط", en: "Medium" },
  high: { ar: "مرتفع", en: "High" },
  critical: { ar: "حرج", en: "Critical" },
};

const requiredSqlFiles = [
  "supabase/migrations/20260711010000_admin_production_foundation.sql",
  "supabase/migrations/20260719210000_order_financial_ledger.sql",
  "supabase/migrations/20260720010000_admin_finance_budget_expenses_hardening.sql",
];

function text(isArabic: boolean, ar: string, en: string) {
  return isArabic ? ar : en;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemRows(items: AdminProductionReadinessItem[], isArabic: boolean) {
  return items.map((item) => ({
    category: text(isArabic, item.categoryAr, item.categoryEn),
    score: `${item.score}%`,
    status: statusText[item.status][isArabic ? "ar" : "en"],
    risk: riskText[item.risk][isArabic ? "ar" : "en"],
    action: (isArabic ? item.actionsAr : item.actionsEn).join(" | "),
  }));
}

function financeReadinessItem(health: FinanceHealth): AdminProductionReadinessItem {
  const migrationMissing = health.reason === "migration_required";
  const unposted = numberValue(health.unposted_delivered_orders);
  const duplicates = numberValue(health.duplicate_settlements);
  const ready = health.ok === true && unposted === 0 && duplicates === 0;
  const status = migrationMissing || duplicates > 0 ? "blocked" : ready ? "ready" : "needs_review";
  const risk = migrationMissing || duplicates > 0 ? "critical" : unposted > 0 ? "high" : ready ? "low" : "medium";
  const score = migrationMissing ? 0 : duplicates > 0 ? 20 : unposted > 0 ? 62 : ready ? 100 : 55;

  return {
    id: "finance_hardening",
    categoryAr: "المالية والميزانية والمصروفات",
    categoryEn: "Finance, budget, and expenses",
    status,
    risk,
    score,
    titleAr: "الدفتر المالي التشغيلي",
    titleEn: "Operational finance ledger",
    messageAr: migrationMissing
      ? "Migration المالية الجديدة غير مطبقة؛ المصروفات والميزانية والإغلاق اليومي لن تعمل بوضع الإنتاج الكامل."
      : duplicates > 0
        ? `تم اكتشاف ${duplicates} ترحيل مالي مكرر ويجب إيقاف التسليم حتى المراجعة.`
        : unposted > 0
          ? `يوجد ${unposted} طلب مُسلّم لم يُرحّل للحسابات بعد.`
          : ready
            ? "الدفتر المالي والمصروفات والتسويات والميزانية والإغلاق اليومي جاهزة ومتصلة."
            : "حزمة المالية موجودة لكن تحتاج مراجعة صلاحيات الأدمن أو تشغيل أول عملية حقيقية.",
    messageEn: migrationMissing
      ? "The new finance migration is not applied; expenses, budgets, and daily closing cannot run in full production mode."
      : duplicates > 0
        ? `${duplicates} duplicate finance postings were detected and delivery operations should pause for review.`
        : unposted > 0
          ? `${unposted} delivered orders have not been posted to the ledger.`
          : ready
            ? "Ledger, expenses, adjustments, budget, and daily closing are connected and ready."
            : "The finance stack exists but admin permissions or the first real operation still needs review.",
    evidenceAr: [
      `ok=${health.ok === true}`,
      `expenses=${numberValue(health.expenses_total)}`,
      `approved_expenses=${numberValue(health.expenses_approved)}`,
      `adjustments=${numberValue(health.adjustments_total)}`,
      `budgets=${numberValue(health.budgets_total)}`,
      `daily_closings=${numberValue(health.daily_closings_total)}`,
      `unposted=${unposted}`,
      `duplicates=${duplicates}`,
    ],
    evidenceEn: [
      `ok=${health.ok === true}`,
      `expenses=${numberValue(health.expenses_total)}`,
      `approved_expenses=${numberValue(health.expenses_approved)}`,
      `adjustments=${numberValue(health.adjustments_total)}`,
      `budgets=${numberValue(health.budgets_total)}`,
      `daily_closings=${numberValue(health.daily_closings_total)}`,
      `unposted=${unposted}`,
      `duplicates=${duplicates}`,
    ],
    actionsAr: migrationMissing
      ? ["شغّل ملف 20260720010000_admin_finance_budget_expenses_hardening.sql مرة واحدة ثم أعد الفحص."]
      : duplicates > 0
        ? ["أوقف أي ترحيل يدوي، راجع order_financial_settlements، ثم أصلح السجلات المكررة قبل الاستمرار."]
        : unposted > 0
          ? ["افتح الطلبات المسلّمة غير المُرحّلة وراجع سبب فشل trigger/RPC قبل الإغلاق اليومي."]
          : ["نفّذ اختبار مصروف صغير، اعتماد/إلغاء، ميزانية، ثم إغلاق يومي حقيقي."],
    actionsEn: migrationMissing
      ? ["Run 20260720010000_admin_finance_budget_expenses_hardening.sql once, then re-run readiness."]
      : duplicates > 0
        ? ["Stop manual posting, review order_financial_settlements, and repair duplicate rows before continuing."]
        : unposted > 0
          ? ["Open delivered-but-unposted orders and inspect the trigger/RPC failure before daily closing."]
          : ["Test a small expense, approve/void it, create a budget, then save a real daily closing."],
  };
}

function normalizeReport(
  report: AdminProductionReadinessReport,
  financeItem: AdminProductionReadinessItem,
): AdminProductionReadinessReport {
  const items = [
    ...report.items.filter((item) => item.id !== "finance_hardening" && item.id !== "global"),
    financeItem,
  ];
  const blockers = items.filter((item) => item.status === "blocked").length;
  const warnings = items.filter((item) => item.status === "needs_review" || item.status === "unknown").length;
  const overallScore = Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, items.length));
  const risk = items.some((item) => item.risk === "critical")
    ? "critical"
    : items.some((item) => item.risk === "high")
      ? "high"
      : items.some((item) => item.risk === "medium")
        ? "medium"
        : "low";
  const status = blockers > 0 ? "blocked" : overallScore >= 90 && warnings === 0 ? "ready" : "needs_review";
  const globalItem: AdminProductionReadinessItem = {
    id: "global",
    categoryAr: "الجاهزية العامة",
    categoryEn: "Overall readiness",
    status,
    risk,
    score: overallScore,
    titleAr: "قرار التسليم لصاحب الشركة",
    titleEn: "Company handoff decision",
    messageAr: blockers > 0
      ? `يوجد ${blockers} مانع إنتاج. لا يتم تسليم النظام نهائياً قبل إغلاقها.`
      : warnings > 0
        ? `لا توجد موانع حرجة، لكن يتبقى ${warnings} اختبارات تشغيل موثقة.`
        : "النظام اجتاز فحوصات الكود وقاعدة البيانات والمالية وأصبح جاهزاً للتسليم التشغيلي.",
    messageEn: blockers > 0
      ? `${blockers} production blockers remain. Do not complete company handoff until they are closed.`
      : warnings > 0
        ? `No critical blockers remain, but ${warnings} documented operational tests are pending.`
        : "Code, database, and finance checks passed; the system is ready for operational handoff.",
    evidenceAr: [`blockers=${blockers}`, `warnings=${warnings}`, `score=${overallScore}`],
    evidenceEn: [`blockers=${blockers}`, `warnings=${warnings}`, `score=${overallScore}`],
    actionsAr: blockers > 0 ? ["نفّذ إجراءات العناصر المحجوبة ثم أعد الفحص."] : warnings > 0 ? ["أكمل الاختبارات التشغيلية الحقيقية وسجّل نتائجها."] : ["أنشئ نسخة احتياطية ثم نفّذ تسليم التشغيل."],
    actionsEn: blockers > 0 ? ["Complete blocked-item actions, then re-run readiness."] : warnings > 0 ? ["Complete and document the remaining real operational tests."] : ["Create a backup, then complete operational handoff."],
  };

  return {
    ...report,
    generatedAt: new Date().toISOString(),
    items: [globalItem, ...items],
    blockers,
    warnings,
    overallScore,
    risk,
    status,
  };
}

function buildFixPlan(report: AdminProductionReadinessReport | null, isArabic: boolean) {
  const blockers = (report?.items || []).filter((item) => item.status === "blocked" || item.risk === "critical");
  const blockerLines = blockers.map((item) => `- ${text(isArabic, item.categoryAr, item.categoryEn)}: ${text(isArabic, item.messageAr, item.messageEn)}`).join("\n") || text(isArabic, "- لا توجد موانع إنتاج حرجة.", "- No critical production blockers.");
  return `${text(isArabic, "DAY NIGHT — خطة إغلاق مراجعة الإنتاج", "DAY NIGHT — Production review closure plan")}

${text(isArabic, "ملفات SQL المرجعية — لا تشغّل ملفاً إلا إذا ظهر أنه ناقص:", "Reference SQL files — only run a file when reported missing:")}
${requiredSqlFiles.map((file, index) => `${index + 1}. ${file}`).join("\n")}

${text(isArabic, "الموانع الحالية:", "Current blockers:")}
${blockerLines}

${text(isArabic, "الترتيب النهائي:", "Final sequence:")}
1. ${text(isArabic, "أعد فحص قاعدة البيانات وتأكد أن admin_finance_hardening_health يعيد ok=true.", "Re-run Database Health and confirm admin_finance_hardening_health returns ok=true.")}
2. ${text(isArabic, "أنشئ مصروفاً صغيراً، اعتمده، ثم ألغِه للتأكد من القيد العكسي وسجل التدقيق.", "Create a small expense, approve it, then void it to verify reversal and audit trail.")}
3. ${text(isArabic, "أنشئ ميزانية تشغيلية وتأكد من المصروف الفعلي والمتبقي ونسبة الاستخدام.", "Create an operating budget and verify actual spend, remaining amount, and utilization.")}
4. ${text(isArabic, "أنشئ طلباً مالياً، سلّمه، وتأكد أن الترحيل تم مرة واحدة فقط.", "Create and deliver a financial order, then verify it posts exactly once.")}
5. ${text(isArabic, "احفظ الإغلاق اليومي، أغلق اليوم، حدّث الصفحة، وتأكد أن حالة مغلق محفوظة.", "Save daily closing, close the day, refresh, and confirm Closed remains persisted.")}
6. ${text(isArabic, "أنشئ نسخة احتياطية من Supabase قبل التسليم النهائي.", "Create a Supabase backup before final handoff.")}`;
}

export default function AdminProductionReadinessCenter({ isArabic, onNavigate }: Props) {
  const [report, setReport] = useState<AdminProductionReadinessReport | null>(null);
  const [financeHealth, setFinanceHealth] = useState<FinanceHealth>({ ok: false });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);

  async function refresh() {
    setLoading(true);
    const [baseReport, health] = await Promise.all([
      fetchAdminProductionReadiness(),
      fetchFinanceHardeningHealth(),
    ]);
    const next = normalizeReport(baseReport, financeReadinessItem(health));
    setFinanceHealth(health);
    setReport(next);
    setLoading(false);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("dn_admin_production_readiness", JSON.stringify(next));
      window.dispatchEvent(new Event("dn-admin-production-readiness-change"));
    }

    const dedupeKey = `readiness:${next.status}:${next.overallScore}:${next.blockers}`;
    if (next.blockers > 0) {
      addAdminNotification({ type: "warning", sectionId: "production_readiness", priority: "critical", dedupeKey, audioEvent: "critical_alert", titleAr: "موانع إنتاج حرجة", titleEn: "Critical production blockers", bodyAr: `يوجد ${next.blockers} مانع إنتاج.`, bodyEn: `${next.blockers} production blockers found.` });
    } else if (next.overallScore >= 90 && next.warnings === 0) {
      addAdminNotification({ type: "success", sectionId: "production_readiness", priority: "normal", dedupeKey, audioEvent: "success", titleAr: "النظام جاهز للإنتاج", titleEn: "System ready for production", bodyAr: `درجة الجاهزية ${next.overallScore}%.`, bodyEn: `Readiness score is ${next.overallScore}%.` });
    } else {
      addAdminNotification({ type: "info", sectionId: "production_readiness", priority: "normal", dedupeKey, audioEvent: "notification", titleAr: "لا توجد موانع حرجة", titleEn: "No critical blockers", bodyAr: `المتبقي ${next.warnings} مراجعات تشغيل.`, bodyEn: `${next.warnings} operational reviews remain.` });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const pdfPayload = useMemo(() => ({
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: text(isArabic, "مركز جاهزية الإنتاج", "Production Readiness Center"),
    filters: report ? `${report.generatedAt} · ${report.overallScore}% · ${report.status} · ${report.risk}` : "—",
    totals: report ? {
      [text(isArabic, "الدرجة", "Score")]: `${report.overallScore}%`,
      [text(isArabic, "الموانع", "Blockers")]: report.blockers,
      [text(isArabic, "التحذيرات", "Warnings")]: report.warnings,
      [text(isArabic, "سلامة المالية", "Finance health")]: financeHealth.ok === true ? "OK" : String(financeHealth.reason || "REVIEW"),
      [text(isArabic, "طلبات مُسلّمة غير مُرحّلة", "Unposted delivered")]: numberValue(financeHealth.unposted_delivered_orders),
    } : {},
    columns: [
      { key: "category", label: text(isArabic, "القسم", "Category") },
      { key: "score", label: text(isArabic, "الدرجة", "Score") },
      { key: "status", label: text(isArabic, "الحالة", "Status") },
      { key: "risk", label: text(isArabic, "الخطر", "Risk") },
      { key: "action", label: text(isArabic, "الإجراء", "Action") },
    ],
    rows: itemRows(report?.items || [], isArabic),
  }), [financeHealth, isArabic, report]);

  async function copyReport() {
    if (!report || typeof navigator === "undefined") return;
    const body = report.items.map((item) => `${text(isArabic, item.categoryAr, item.categoryEn)}: ${item.score}% / ${item.status} / ${item.risk}\n${text(isArabic, item.messageAr, item.messageEn)}\n${(isArabic ? item.actionsAr : item.actionsEn).join("; ")}`).join("\n\n");
    await navigator.clipboard.writeText(`${text(isArabic, "تقرير جاهزية الإنتاج", "Production readiness report")}\n${report.overallScore}%\n${body}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function copyFixPlan() {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(buildFixPlan(report, isArabic));
    setCopiedFix(true);
    window.setTimeout(() => setCopiedFix(false), 1600);
  }

  const blockers = (report?.items || []).filter((item) => item.status === "blocked" || item.risk === "critical");

  return (
    <div className="dn-admin-core-full">
      <header className="dn-section-hero">
        <div className="dn-section-hero-copy">
          <AdminIconBadge name="production-readiness" label={text(isArabic, "مركز جاهزية الإنتاج", "Production Readiness Center")} />
          <div>
            <span>DAY NIGHT · {text(isArabic, "بوابة التسليم", "Handoff gate")}</span>
            <h1>{text(isArabic, "مركز جاهزية الإنتاج", "Production Readiness Center")}</h1>
            <p>{text(isArabic, "قرار تسليم مبني على قاعدة البيانات والدفتر المالي والمصروفات والميزانية والإغلاق اليومي، وليس على نجاح البناء فقط.", "A handoff decision based on database, ledger, expenses, budget, and daily closing—not build success alone.")}</p>
          </div>
        </div>
        <div className="dn-section-hero-actions">
          <button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text(isArabic, "إعادة الفحص", "Re-run")}</button>
          <button type="button" onClick={() => void copyReport()}><Copy className="h-4 w-4" />{copied ? text(isArabic, "تم النسخ", "Copied") : text(isArabic, "نسخ التقرير", "Copy report")}</button>
          <button type="button" onClick={() => void copyFixPlan()}><FileCode2 className="h-4 w-4" />{copiedFix ? text(isArabic, "تم نسخ الخطة", "Plan copied") : text(isArabic, "خطة الإغلاق", "Closure plan")}</button>
          <AdminPdfExportButton label={text(isArabic, "تصدير PDF", "Export PDF")} payload={pdfPayload} />
        </div>
      </header>

      {report && (
        <>
          <div className="dn-admin-section-kpis">
            <article><AdminIconBadge name="production-readiness" className="dn-admin-kpi-icon" /><strong>{report.overallScore}%</strong><span>{text(isArabic, "الدرجة العامة", "Overall score")}</span></article>
            <article><AdminIconBadge name="database-health" className="dn-admin-kpi-icon" /><strong>{statusText[report.status][isArabic ? "ar" : "en"]}</strong><span>{text(isArabic, "الحالة", "Status")}</span></article>
            <article><AdminIconBadge name="priority" className="dn-admin-kpi-icon" /><strong>{riskText[report.risk][isArabic ? "ar" : "en"]}</strong><span>{text(isArabic, "الخطر", "Risk")}</span></article>
            <article><AdminIconBadge name="error" className="dn-admin-kpi-icon" /><strong>{report.blockers}</strong><span>{text(isArabic, "موانع الإنتاج", "Blockers")}</span></article>
            <article><AdminIconBadge name="warning" className="dn-admin-kpi-icon" /><strong>{report.warnings}</strong><span>{text(isArabic, "اختبارات متبقية", "Remaining tests")}</span></article>
          </div>

          <section className="dn-admin-section-panels">
            <article>
              <h2><AdminIconBadge name="production-readiness" />{text(isArabic, "خطة التسليم دون بيانات وهمية", "Handoff plan without fake data")}</h2>
              <p>{report.blockers ? text(isArabic, "يوجد مانع حقيقي. اتبع الإجراء الخاص به ولا تعتبر نجاح Vercel كافياً للتسليم.", "A real blocker remains. Follow its action; Vercel success alone is not sufficient for handoff.") : report.warnings ? text(isArabic, "لا توجد موانع حرجة، والمتبقي اختبارات تشغيل حقيقية موثقة.", "No critical blockers remain; documented real-operation tests are still pending.") : text(isArabic, "الشفرة وقاعدة البيانات والمالية اجتازت بوابة التسليم.", "Code, database, and finance passed the handoff gate.")}</p>
              <ul>{requiredSqlFiles.map((file) => <li key={file}><FileCode2 className="inline h-4 w-4" /> {file}</li>)}</ul>
              <div className="dn-section-hero-actions">
                <button onClick={() => void copyFixPlan()}><Copy className="h-4 w-4" />{copiedFix ? text(isArabic, "تم النسخ", "Copied") : text(isArabic, "نسخ الخطوات", "Copy steps")}</button>
                <button onClick={() => onNavigate?.("database_health")}><Database className="h-4 w-4" />{text(isArabic, "فحص قاعدة البيانات", "Database Health")}</button>
                <button onClick={() => onNavigate?.("daily_closing")}><CalendarClock className="h-4 w-4" />{text(isArabic, "الإغلاق اليومي", "Daily Closing")}</button>
              </div>
            </article>
          </section>

          <div className="dn-admin-section-panels">
            {report.items.map((item) => (
              <article key={item.id}>
                <h2><AdminIconBadge name={item.status === "blocked" ? "error" : item.status === "ready" ? "success" : "warning"} />{text(isArabic, item.categoryAr, item.categoryEn)} · {item.score}%</h2>
                <p><AdminStateChip name={item.status === "blocked" ? "error" : item.status === "ready" ? "success" : "warning"} tone={item.status === "blocked" ? "danger" : item.status === "ready" ? "success" : "warning"}>{statusText[item.status][isArabic ? "ar" : "en"]} · {riskText[item.risk][isArabic ? "ar" : "en"]}</AdminStateChip></p>
                <p>{text(isArabic, item.messageAr, item.messageEn)}</p>
                <strong>{text(isArabic, "الأدلة", "Evidence")}</strong>
                <ul>{(isArabic ? item.evidenceAr : item.evidenceEn).map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
                <strong>{text(isArabic, "الإجراء المطلوب", "Required action")}</strong>
                <ul>{(isArabic ? item.actionsAr : item.actionsEn).map((action) => <li key={action}>{action}</li>)}</ul>
              </article>
            ))}
          </div>

          <section className="dn-admin-section-panels">
            <article>
              <h2><AlertTriangle className="h-5 w-5" />{text(isArabic, "موانع الإنتاج", "Production blockers")}</h2>
              {blockers.length ? <ul>{blockers.map((item) => <li key={item.id}>{text(isArabic, item.categoryAr, item.categoryEn)} — {text(isArabic, item.messageAr, item.messageEn)}</li>)}</ul> : <p><CheckCircle2 className="inline h-4 w-4" /> {text(isArabic, "لا توجد موانع حرجة.", "No critical blockers.")}</p>}
            </article>
            <article>
              <h2><AdminIconBadge name="click" />{text(isArabic, "اختبار التسليم الأخير", "Final handoff test")}</h2>
              <ul>
                <li>{text(isArabic, "مصروف: إنشاء → اعتماد → إلغاء → قيد عكسي.", "Expense: create → approve → void → reversal entry.")}</li>
                <li>{text(isArabic, "ميزانية: معتمد → فعلي → متبقي → نسبة استخدام.", "Budget: allocated → actual → remaining → utilization.")}</li>
                <li>{text(isArabic, "طلب: بضاعة + توصيل − خصم → تسليم → ترحيل واحد.", "Order: goods + delivery − discount → delivery → one posting.")}</li>
                <li>{text(isArabic, "إغلاق يومي: حفظ → إغلاق → تحديث الصفحة → الحالة محفوظة.", "Daily closing: save → close → refresh → status persists.")}</li>
              </ul>
              <div className="dn-section-hero-actions">
                <button onClick={() => onNavigate?.("finance_dashboard")}><BarChart3 className="h-4 w-4" />{text(isArabic, "فتح المالية", "Open Finance")}</button>
                <button onClick={() => onNavigate?.("daily_closing")}><CalendarClock className="h-4 w-4" />{text(isArabic, "فتح الإغلاق", "Open Closing")}</button>
                <button onClick={() => onNavigate?.("print")}><Printer className="h-4 w-4" />{text(isArabic, "فتح الطباعة", "Open Print")}</button>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
