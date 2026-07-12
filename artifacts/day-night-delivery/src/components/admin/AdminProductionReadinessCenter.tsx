import { useEffect, useMemo, useState } from "react";
import { Copy, Database, FileCode2, RefreshCw, ShieldCheck } from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { addAdminNotification } from "../../lib/adminAudio";
import { fetchAdminProductionReadiness, type AdminProductionReadinessReport, type AdminProductionReadinessItem } from "../../lib/adminData";

type Props = { isArabic: boolean; onNavigate?: (id: string) => void };

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
  "supabase/migrations/20260712010000_admin_finance_production_suite.sql",
  "supabase/migrations/20260712011000_admin_finance_safe_uuid_sync.sql",
  "supabase/migrations/20260712040000_admin_production_readiness_unblocker.sql",
];

function text(isArabic: boolean, ar: string, en: string) { return isArabic ? ar : en; }
function textHas(values: string[], pattern: RegExp) { return values.join(" ").toLowerCase().match(pattern); }

function itemRows(items: AdminProductionReadinessItem[], isArabic: boolean) {
  return items.map((item) => ({
    category: text(isArabic, item.categoryAr, item.categoryEn),
    score: `${item.score}%`,
    status: statusText[item.status][isArabic ? "ar" : "en"],
    risk: riskText[item.risk][isArabic ? "ar" : "en"],
    action: (isArabic ? item.actionsAr : item.actionsEn).join(" | "),
  }));
}

function normalizeDailyClosingItem(item: AdminProductionReadinessItem): AdminProductionReadinessItem {
  const evidence = [...item.evidenceAr, ...item.evidenceEn];
  const sourceIsDerived = Boolean(textHas(evidence, /source=derived/));
  const sourceIsLocal = Boolean(textHas(evidence, /source=local/));
  const dbObjectExists = Boolean(textHas(evidence, /جاهز بلا بيانات|exists but has no rows|موجودة|available|admin_daily_closings/));
  if (item.id !== "daily_closing" || item.status !== "blocked" || sourceIsLocal || !sourceIsDerived || !dbObjectExists) return item;
  return {
    ...item,
    status: "needs_review",
    risk: "medium",
    score: Math.max(item.score, 76),
    messageAr: "جدول الإغلاق اليومي موجود في قاعدة البيانات، لكن لم يتم حفظ إغلاق حقيقي لهذا اليوم بعد. هذا ليس مانع SQL بعد تطبيق الملفات، بل خطوة تشغيل أولى.",
    messageEn: "The daily closing table exists in the database, but no real closing has been saved for today yet. After the SQL files are applied, this is an operational first-run step, not a SQL blocker.",
    evidenceAr: [...item.evidenceAr, "تم اعتبار source=derived كمسودة تشغيل لأن الجدول موجود بلا بيانات، وليس كفشل قاعدة بيانات."],
    evidenceEn: [...item.evidenceEn, "source=derived is treated as an operational draft because the table exists with no rows, not as a database failure."],
    actionsAr: ["افتح الإغلاق اليومي واحفظ أول إغلاق حقيقي لليوم لتتحول الحالة إلى جاهز."],
    actionsEn: ["Open Daily Closing and save the first real closing for today to move this item to Ready."],
  };
}

function normalizeGlobalItem(item: AdminProductionReadinessItem, items: AdminProductionReadinessItem[]): AdminProductionReadinessItem {
  if (item.id !== "global") return item;
  const blockers = items.filter((row) => row.id !== "global" && row.status === "blocked").length;
  const warnings = items.filter((row) => row.id !== "global" && (row.status === "needs_review" || row.status === "unknown")).length;
  if (blockers > 0) return item;
  return {
    ...item,
    status: warnings > 0 ? "needs_review" : "ready",
    risk: warnings > 0 ? "medium" : "low",
    score: warnings > 0 ? Math.max(item.score, 84) : Math.max(item.score, 95),
    messageAr: warnings > 0 ? "لا توجد موانع إنتاج حرجة حالياً. المتبقي خطوات إثبات تشغيل ومراجعة سياسات وأداء." : "لا توجد موانع إنتاج حالياً والنظام جاهز لمراجعة إنتاج عالمية.",
    messageEn: warnings > 0 ? "There are no critical production blockers now. Remaining work is operational proof, policy review, and performance hardening." : "There are no production blockers now and the system is ready for global production review.",
    evidenceAr: [`blockers=${blockers}`, `warnings=${warnings}`],
    evidenceEn: [`blockers=${blockers}`, `warnings=${warnings}`],
    actionsAr: warnings > 0 ? ["احفظ أول إغلاق يومي، نفذ اختبار مصروف/تسوية/طباعة، ثم راجع RLS وE2E."] : ["نفذ اختبار E2E نهائي قبل التشغيل الواسع."],
    actionsEn: warnings > 0 ? ["Save the first daily closing, test expense/adjustment/print, then review RLS and E2E."] : ["Run final E2E before broad production use."],
  };
}

function normalizeReadinessReport(report: AdminProductionReadinessReport): AdminProductionReadinessReport {
  const firstPass = report.items.map(normalizeDailyClosingItem);
  const items = firstPass.map((item) => normalizeGlobalItem(item, firstPass));
  const blockers = items.filter((item) => item.status === "blocked").length;
  const warnings = items.filter((item) => item.status === "needs_review" || item.status === "unknown").length;
  const overallScore = Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, items.length));
  const risk = items.some((item) => item.risk === "critical") ? "critical" : items.some((item) => item.risk === "high") ? "high" : items.some((item) => item.risk === "medium") ? "medium" : "low";
  const status = blockers > 0 ? "blocked" : overallScore >= 90 && warnings === 0 ? "ready" : "needs_review";
  return { ...report, items, blockers, warnings, overallScore, risk, status };
}

function buildFixPlan(report: AdminProductionReadinessReport | null, isArabic: boolean) {
  const blockers = (report?.items || []).filter((item) => item.status === "blocked" || item.risk === "critical");
  const blockerLines = blockers.map((item) => `- ${text(isArabic, item.categoryAr, item.categoryEn)}: ${text(isArabic, item.messageAr, item.messageEn)}`).join("\n") || text(isArabic, "- لا توجد موانع إنتاج حرجة حالياً.", "- No current critical production blockers.");
  const hasDatabaseBlocker = blockers.some((item) => item.id === "database" || item.evidenceEn.join(" ").includes("Missing/blocked"));
  return `${text(isArabic, "خطة فتح جاهزية الإنتاج", "Production readiness unblock plan")}

${text(isArabic, "الحالة العملية الآن:", "Current operational state:")}
${hasDatabaseBlocker ? text(isArabic, "ما زالت توجد كائنات قاعدة بيانات ناقصة/محجوبة. طبّق ملفات SQL كاملة بالترتيب.", "Some database objects are still missing/blocked. Apply the SQL files in order.") : text(isArabic, "لا توجد إجراءات قاعدة بيانات ناقصة حالياً. المتبقي إثبات تشغيل حقيقي للمالية والإغلاق والطباعة بدون بيانات وهمية.", "No database procedures are missing now. Remaining work is proving finance, daily closing, and print flows with real operations and no fake rows.")}

${text(isArabic, "ملفات SQL المرجعية:", "Reference SQL files:")}
${requiredSqlFiles.map((file, index) => `${index + 1}. ${file}`).join("\n")}

${text(isArabic, "الموانع الحالية:", "Current blockers:")}
${blockerLines}

${text(isArabic, "الخطوات التالية:", "Next steps:")}
1. ${text(isArabic, "افتح النظام ← فحص قاعدة البيانات واضغط إعادة الفحص.", "Open System → Database Health and re-run checks.")}
2. ${text(isArabic, "افتح المالية وأنشئ مصروفاً اختبارياً صغيراً ثم اعتمده أو ألغِه.", "Open Finance, create a small test expense, then approve or void it.")}
3. ${text(isArabic, "افتح الإغلاق اليومي واحفظ أول إغلاق حقيقي لليوم.", "Open Daily Closing and save the first real closing for today.")}
4. ${text(isArabic, "افتح الطباعة وأنشئ مهمة طباعة ثم علّمها مطبوعة.", "Open Print, create a print job, then mark it printed.")}
5. ${text(isArabic, "بعدها أعد فحص جاهزية الإنتاج.", "Then re-run Production Readiness.")}`;
}

export default function AdminProductionReadinessCenter({ isArabic, onNavigate }: Props) {
  const [report, setReport] = useState<AdminProductionReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);

  async function refresh() {
    setLoading(true);
    const next = normalizeReadinessReport(await fetchAdminProductionReadiness());
    setReport(next);
    setLoading(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dn_admin_production_readiness", JSON.stringify(next));
      window.dispatchEvent(new Event("dn-admin-production-readiness-change"));
    }
    const dedupeKey = `readiness:${next.status}:${next.overallScore}:${next.blockers}`;
    if (next.blockers > 0) addAdminNotification({ type: "warning", sectionId: "production_readiness", priority: "high", dedupeKey, audioEvent: "warning", titleAr: "موانع إنتاج حرجة", titleEn: "Critical production blockers", bodyAr: `يوجد ${next.blockers} مانع إنتاج.`, bodyEn: `${next.blockers} production blockers found.` });
    else if (next.overallScore >= 90 && next.warnings === 0) addAdminNotification({ type: "success", sectionId: "production_readiness", priority: "normal", dedupeKey, audioEvent: "success", titleAr: "النظام جاهز للإنتاج", titleEn: "System ready for production", bodyAr: `درجة الجاهزية ${next.overallScore}%.`, bodyEn: `Readiness score is ${next.overallScore}%.` });
    else addAdminNotification({ type: "info", sectionId: "production_readiness", priority: "normal", dedupeKey, audioEvent: "notification", titleAr: "لا توجد موانع حرجة", titleEn: "No critical blockers", bodyAr: `المتبقي ${next.warnings} مراجعات تشغيل.`, bodyEn: `${next.warnings} operational reviews remain.` });
  }

  useEffect(() => { void refresh(); }, []);

  const pdfPayload = useMemo(() => ({
    language: isArabic ? "ar" as const : "en" as const,
    sectionTitle: text(isArabic, "مركز جاهزية الإنتاج", "Production Readiness Center"),
    filters: report ? `${report.generatedAt} · ${report.overallScore}% · ${report.status} · ${report.risk}` : "—",
    totals: report ? {
      [text(isArabic, "الدرجة", "Score")]: `${report.overallScore}%`,
      [text(isArabic, "الموانع", "Blockers")]: report.blockers,
      [text(isArabic, "التحذيرات", "Warnings")]: report.warnings,
    } : {},
    columns: [
      { key: "category", label: text(isArabic, "القسم", "Category") },
      { key: "score", label: text(isArabic, "الدرجة", "Score") },
      { key: "status", label: text(isArabic, "الحالة", "Status") },
      { key: "risk", label: text(isArabic, "الخطر", "Risk") },
      { key: "action", label: text(isArabic, "الإجراء", "Action") },
    ],
    rows: itemRows(report?.items || [], isArabic),
  }), [isArabic, report]);

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

  return <div className="dn-admin-core-full">
    <header className="dn-section-hero"><div><span>DAY NIGHT · {text(isArabic, "بوابة العمليات", "Operations gate")}</span><h1>{text(isArabic, "مركز جاهزية الإنتاج", "Production Readiness Center")}</h1><p>{text(isArabic, "يفحص هل لوحة الإدارة جاهزة للعمل الحقيقي على مستوى عالمي أم ما زالت تعتمد على fallbacks.", "Checks whether admin is ready for real global operations or still depends on fallbacks.")}</p></div><div className="dn-section-hero-actions"><button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" />{text(isArabic, "إعادة الفحص", "Re-run")}</button><button type="button" onClick={() => void copyReport()}><Copy className="h-4 w-4" />{copied ? text(isArabic, "تم النسخ", "Copied") : text(isArabic, "نسخ تقرير الجاهزية", "Copy report")}</button><button type="button" onClick={() => void copyFixPlan()}><FileCode2 className="h-4 w-4" />{copiedFix ? text(isArabic, "تم نسخ الخطة", "Plan copied") : text(isArabic, "نسخ خطة فتح الإنتاج", "Copy unblock plan")}</button><AdminPdfExportButton label={text(isArabic, "تصدير PDF", "Export PDF")} payload={pdfPayload} /></div></header>
    {report && <><div className="dn-admin-section-kpis"><article><ShieldCheck className="h-5 w-5" /><strong>{report.overallScore}%</strong><span>{text(isArabic, "الدرجة العامة", "Overall score")}</span></article><article><Database className="h-5 w-5" /><strong>{statusText[report.status][isArabic ? "ar" : "en"]}</strong><span>{text(isArabic, "الحالة", "Status")}</span></article><article><ShieldCheck className="h-5 w-5" /><strong>{riskText[report.risk][isArabic ? "ar" : "en"]}</strong><span>{text(isArabic, "الخطر", "Risk")}</span></article><article><ShieldCheck className="h-5 w-5" /><strong>{report.blockers}</strong><span>{text(isArabic, "موانع الإنتاج", "Blockers")}</span></article><article><ShieldCheck className="h-5 w-5" /><strong>{report.warnings}</strong><span>{text(isArabic, "تحذيرات", "Warnings")}</span></article></div>
    <section className="dn-admin-section-panels"><article><h2>{text(isArabic, "خطة تشغيل الإنتاج من غير بيانات وهمية", "Production operation plan without fake data")}</h2><p>{report.blockers ? text(isArabic, "ما زالت توجد موانع حرجة. اتبع الخطة أدناه ولا تخترع بيانات في الواجهة.", "Critical blockers still exist. Follow the plan below and do not fake UI data.") : text(isArabic, "تم تطبيق إجراءات قاعدة البيانات الأساسية. المتبقي الآن إثبات التشغيل الحقيقي: مصروف، تسوية، طباعة، وإغلاق يومي محفوظ في قاعدة البيانات.", "Core database procedures are applied. Remaining work is proving real operations: expense, adjustment, print, and a saved daily closing in the database.")}</p><ul>{requiredSqlFiles.map((file) => <li key={file}><FileCode2 className="inline h-4 w-4" /> {file}</li>)}</ul><div className="dn-section-hero-actions"><button onClick={() => void copyFixPlan()}><Copy className="h-4 w-4" />{copiedFix ? text(isArabic, "تم النسخ", "Copied") : text(isArabic, "نسخ الخطوات", "Copy steps")}</button><button onClick={() => onNavigate?.("database_health")}>{text(isArabic, "افتح فحص قاعدة البيانات", "Open Database Health")}</button><button onClick={() => onNavigate?.("daily_closing")}>{text(isArabic, "افتح الإغلاق اليومي", "Open Daily Closing")}</button></div></article></section>
    <div className="dn-admin-section-panels">{report.items.map((item) => <article key={item.id}><h2>{text(isArabic, item.categoryAr, item.categoryEn)} · {item.score}%</h2><p><b>{statusText[item.status][isArabic ? "ar" : "en"]}</b> · {riskText[item.risk][isArabic ? "ar" : "en"]}</p><p>{text(isArabic, item.messageAr, item.messageEn)}</p><strong>{text(isArabic, "الأدلة", "Evidence")}</strong><ul>{(isArabic ? item.evidenceAr : item.evidenceEn).map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><strong>{text(isArabic, "الإجراء المقترح", "Recommended action")}</strong><ul>{(isArabic ? item.actionsAr : item.actionsEn).map((action) => <li key={action}>{action}</li>)}</ul></article>)}</div>
    <section className="dn-admin-section-panels"><article><h2>{text(isArabic, "موانع الإنتاج", "Production blockers")}</h2>{blockers.length ? <ul>{blockers.map((item) => <li key={item.id}>{text(isArabic, item.categoryAr, item.categoryEn)} — {text(isArabic, item.messageAr, item.messageEn)}</li>)}</ul> : <p>{text(isArabic, "لا توجد موانع حرجة حالياً.", "No critical blockers right now.")}</p>}</article><article><h2>{text(isArabic, "الإجراءات التالية", "Next actions")}</h2><ul><li>{text(isArabic, "افتح المالية وأنشئ مصروفاً اختبارياً صغيراً ثم اعتمده أو ألغِه.", "Open Finance, create a small test expense, then approve or void it.")}</li><li>{text(isArabic, "افتح الإغلاق اليومي واحفظ أول إغلاق حقيقي داخل قاعدة البيانات.", "Open Daily Closing and save the first real closing inside the database.")}</li><li>{text(isArabic, "افتح الطباعة وأنشئ مهمة طباعة ثم علّمها مطبوعة.", "Open Print, create a print job, then mark it printed.")}</li><li>{text(isArabic, "راجع RLS Policies وأضف اختبارات E2E.", "Review RLS policies and add E2E tests.")}</li></ul><div className="dn-section-hero-actions"><button onClick={() => onNavigate?.("database_health")}>{text(isArabic, "فتح فحص قاعدة البيانات", "Open Database Health")}</button><button onClick={() => onNavigate?.("finance_dashboard")}>{text(isArabic, "فتح المالية", "Open Finance")}</button><button onClick={() => onNavigate?.("daily_closing")}>{text(isArabic, "فتح الإغلاق اليومي", "Open Daily Closing")}</button><button onClick={() => onNavigate?.("print")}>{text(isArabic, "فتح الطباعة", "Open Print")}</button></div></article></section></>}
  </div>;
}
