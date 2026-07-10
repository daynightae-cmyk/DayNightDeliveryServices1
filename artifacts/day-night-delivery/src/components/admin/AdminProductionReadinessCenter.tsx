import { useEffect, useMemo, useState } from "react";
import { Copy, Database, RefreshCw, ShieldCheck } from "lucide-react";
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

function text(isArabic: boolean, ar: string, en: string) { return isArabic ? ar : en; }

function itemRows(items: AdminProductionReadinessItem[], isArabic: boolean) {
  return items.map((item) => ({
    category: text(isArabic, item.categoryAr, item.categoryEn),
    score: `${item.score}%`,
    status: statusText[item.status][isArabic ? "ar" : "en"],
    risk: riskText[item.risk][isArabic ? "ar" : "en"],
    action: (isArabic ? item.actionsAr : item.actionsEn).join(" | "),
  }));
}

export default function AdminProductionReadinessCenter({ isArabic, onNavigate }: Props) {
  const [report, setReport] = useState<AdminProductionReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setLoading(true);
    const next = await fetchAdminProductionReadiness();
    setReport(next);
    setLoading(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dn_admin_production_readiness", JSON.stringify(next));
      window.dispatchEvent(new Event("dn-admin-production-readiness-change"));
    }
    const dedupeKey = `readiness:${next.status}:${next.overallScore}:${next.blockers}`;
    if (next.blockers > 0) addAdminNotification({ type: "warning", sectionId: "production_readiness", priority: "high", dedupeKey, audioEvent: "warning", titleAr: "موانع إنتاج حرجة", titleEn: "Critical production blockers", bodyAr: `يوجد ${next.blockers} مانع إنتاج.`, bodyEn: `${next.blockers} production blockers found.` });
    else if (next.overallScore >= 90) addAdminNotification({ type: "success", sectionId: "production_readiness", priority: "normal", dedupeKey, audioEvent: "success", titleAr: "النظام جاهز للإنتاج", titleEn: "System ready for production", bodyAr: `درجة الجاهزية ${next.overallScore}%.`, bodyEn: `Readiness score is ${next.overallScore}%.` });
    else addAdminNotification({ type: "info", sectionId: "production_readiness", priority: "normal", dedupeKey, audioEvent: "notification", titleAr: "جاهزية الإنتاج تحتاج مراجعة", titleEn: "Production readiness needs review", bodyAr: `درجة الجاهزية ${next.overallScore}%.`, bodyEn: `Readiness score is ${next.overallScore}%.` });
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

  const blockers = (report?.items || []).filter((item) => item.status === "blocked" || item.risk === "critical");

  return <div className="dn-admin-core-full">
    <header className="dn-section-hero"><div><span>DAY NIGHT · {text(isArabic, "بوابة العمليات", "Operations gate")}</span><h1>{text(isArabic, "مركز جاهزية الإنتاج", "Production Readiness Center")}</h1><p>{text(isArabic, "يفحص هل لوحة الإدارة جاهزة للعمل الحقيقي على مستوى عالمي أم ما زالت تعتمد على fallbacks.", "Checks whether admin is ready for real global operations or still depends on fallbacks.")}</p></div><div className="dn-section-hero-actions"><button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" />{text(isArabic, "إعادة الفحص", "Re-run")}</button><button type="button" onClick={() => void copyReport()}><Copy className="h-4 w-4" />{copied ? text(isArabic, "تم النسخ", "Copied") : text(isArabic, "نسخ تقرير الجاهزية", "Copy report")}</button><AdminPdfExportButton label={text(isArabic, "تصدير PDF", "Export PDF")} payload={pdfPayload} /></div></header>
    {report && <><div className="dn-admin-section-kpis"><article><ShieldCheck className="h-5 w-5" /><strong>{report.overallScore}%</strong><span>{text(isArabic, "الدرجة العامة", "Overall score")}</span></article><article><Database className="h-5 w-5" /><strong>{statusText[report.status][isArabic ? "ar" : "en"]}</strong><span>{text(isArabic, "الحالة", "Status")}</span></article><article><ShieldCheck className="h-5 w-5" /><strong>{riskText[report.risk][isArabic ? "ar" : "en"]}</strong><span>{text(isArabic, "الخطر", "Risk")}</span></article><article><ShieldCheck className="h-5 w-5" /><strong>{report.blockers}</strong><span>{text(isArabic, "موانع الإنتاج", "Blockers")}</span></article><article><ShieldCheck className="h-5 w-5" /><strong>{report.warnings}</strong><span>{text(isArabic, "تحذيرات", "Warnings")}</span></article></div>
    <div className="dn-admin-section-panels">{report.items.map((item) => <article key={item.id}><h2>{text(isArabic, item.categoryAr, item.categoryEn)} · {item.score}%</h2><p><b>{statusText[item.status][isArabic ? "ar" : "en"]}</b> · {riskText[item.risk][isArabic ? "ar" : "en"]}</p><p>{text(isArabic, item.messageAr, item.messageEn)}</p><strong>{text(isArabic, "الأدلة", "Evidence")}</strong><ul>{(isArabic ? item.evidenceAr : item.evidenceEn).map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><strong>{text(isArabic, "الإجراء المقترح", "Recommended action")}</strong><ul>{(isArabic ? item.actionsAr : item.actionsEn).map((action) => <li key={action}>{action}</li>)}</ul></article>)}</div>
    <section className="dn-admin-section-panels"><article><h2>{text(isArabic, "موانع الإنتاج", "Production blockers")}</h2>{blockers.length ? <ul>{blockers.map((item) => <li key={item.id}>{text(isArabic, item.categoryAr, item.categoryEn)} — {text(isArabic, item.messageAr, item.messageEn)}</li>)}</ul> : <p>{text(isArabic, "لا توجد موانع حرجة حالياً.", "No critical blockers right now.")}</p>}</article><article><h2>{text(isArabic, "الإجراءات التالية", "Next actions")}</h2><ul><li>{text(isArabic, "طبّق migrations الناقصة في Supabase.", "Apply missing Supabase migrations.")}</li><li>{text(isArabic, "حوّل الملخص المالي إلى RPC فعلي.", "Move finance summary to a real RPC.")}</li><li>{text(isArabic, "فعّل إغلاق اليوم داخل قاعدة البيانات.", "Enable database-backed daily closing.")}</li><li>{text(isArabic, "اعتمد print_jobs للطباعة الرسمية.", "Use print_jobs for official printing.")}</li><li>{text(isArabic, "راجع RLS Policies وأضف اختبارات E2E.", "Review RLS policies and add E2E tests.")}</li></ul><div className="dn-section-hero-actions"><button onClick={() => onNavigate?.("database_health")}>{text(isArabic, "فتح فحص قاعدة البيانات", "Open Database Health")}</button><button onClick={() => onNavigate?.("finance_dashboard")}>{text(isArabic, "فتح المالية", "Open Finance")}</button><button onClick={() => onNavigate?.("settings")}>{text(isArabic, "فتح الإعدادات", "Open Settings")}</button><button onClick={() => onNavigate?.("print")}>{text(isArabic, "فتح الطباعة", "Open Print")}</button></div></article></section></>}
  </div>;
}
