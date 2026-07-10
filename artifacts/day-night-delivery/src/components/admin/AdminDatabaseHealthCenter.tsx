import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Settings, ShieldCheck, BarChart3, Copy } from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { fetchAdminDatabaseHealth, type AdminDbHealthCheck, type AdminDbHealthStatus } from "../../lib/adminData";
import { addAdminNotification } from "../../lib/adminAudio";

type Props = { isArabic: boolean; onNavigate?: (id: "settings" | "finance_dashboard") => void };

type SummaryKey = "total" | "ok" | "missing" | "permission" | "empty";

const statusText: Record<AdminDbHealthStatus, { ar: string; en: string }> = {
  ok: { ar: "يعمل", en: "Working" },
  missing: { ar: "غير موجود / يحتاج migration", en: "Missing / Migration required" },
  permission: { ar: "لا توجد صلاحية", en: "Permission issue" },
  empty: { ar: "لا توجد بيانات", en: "Empty" },
  error: { ar: "تحقق مطلوب", en: "Verification required" },
  unknown: { ar: "غير معروف", en: "Unknown" },
};

const kindText: Record<AdminDbHealthCheck["kind"], { ar: string; en: string }> = {
  table: { ar: "جدول", en: "Table" },
  view: { ar: "عرض", en: "View" },
  rpc: { ar: "دالة RPC", en: "RPC" },
};

function badgeClass(status: AdminDbHealthStatus) {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (status === "empty") return "bg-amber-500/15 text-amber-100 border-amber-400/30";
  if (status === "missing" || status === "error") return "bg-red-500/15 text-red-100 border-red-400/30";
  return "bg-sky-500/15 text-sky-100 border-sky-400/30";
}

function buildReport(checks: AdminDbHealthCheck[], isArabic: boolean) {
  return checks.map((check) => `${check.id}: ${isArabic ? statusText[check.status].ar : statusText[check.status].en} (${typeof check.rowCount === "number" ? check.rowCount : "—"})`).join("\n");
}

export default function AdminDatabaseHealthCenter({ isArabic, onNavigate }: Props) {
  const [checks, setChecks] = useState<AdminDbHealthCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const title = isArabic ? "مركز فحص قاعدة البيانات" : "Database Health Center";

  async function refresh() {
    setLoading(true);
    const next = await fetchAdminDatabaseHealth();
    setChecks(next);
    const problemObjects = next.filter((check) => check.status === "missing" || check.status === "error");
    const permissionObjects = next.filter((check) => check.status === "permission" || check.status === "unknown");
    if (problemObjects.length || permissionObjects.length) {
      const names = [...problemObjects, ...permissionObjects].map((check) => check.id).join(", ");
      addAdminNotification({ type: "database", sectionId: "database_health", priority: "high", dedupeKey: `db-health:${names}`, audioEvent: "database_health_warning", titleAr: "نقص في Supabase migrations", titleEn: "Supabase migration gaps", bodyAr: `يوجد ${problemObjects.length + permissionObjects.length} عنصر يحتاج مراجعة: ${names}.`, bodyEn: `${problemObjects.length + permissionObjects.length} database objects need review: ${names}.` });
    } else if (next.length) {
      addAdminNotification({ type: "success", sectionId: "database_health", priority: "normal", dedupeKey: `db-health-ok:${next.length}`, audioEvent: "database_health_ok", titleAr: "قاعدة البيانات جاهزة", titleEn: "Database is ready", bodyAr: "كل فحوصات قاعدة البيانات الأساسية جاهزة.", bodyEn: "All required database health checks are ready." });
    }
    setLoading(false);
    try {
      window.localStorage.setItem("dn_admin_db_health", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("dn-admin-db-health-change", { detail: next }));
    } catch (error) {
      console.warn("Database health cache warning:", error);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const summary = useMemo<Record<SummaryKey, number>>(() => ({
    total: checks.length,
    ok: checks.filter((check) => check.status === "ok").length,
    missing: checks.filter((check) => check.status === "missing" || check.status === "error").length,
    permission: checks.filter((check) => check.status === "permission" || check.status === "unknown").length,
    empty: checks.filter((check) => check.status === "empty").length,
  }), [checks]);

  const missingObjects = checks.filter((check) => check.status === "missing").map((check) => check.id).join(", ") || "—";
  const pdfPayload = {
    language: isArabic ? "ar" as const : "en" as const,
    sectionTitle: title,
    filters: new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE"),
    totals: { ...summary, missingObjects, recommended: summary.missing ? (isArabic ? "طبّق migrations ثم أعد الفحص" : "Apply migrations, then re-run checks") : (isArabic ? "تحقق من الصفوف الفارغة والصلاحيات" : "Review empty rows and permissions") },
    columns: [
      { key: "object", label: isArabic ? "العنصر" : "Object" },
      { key: "kind", label: isArabic ? "النوع" : "Type" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "rows", label: isArabic ? "عدد الصفوف" : "Rows" },
      { key: "message", label: isArabic ? "الرسالة" : "Message" },
    ],
    rows: checks.map((check) => ({ object: check.id, kind: isArabic ? kindText[check.kind].ar : kindText[check.kind].en, status: isArabic ? statusText[check.status].ar : statusText[check.status].en, rows: typeof check.rowCount === "number" ? String(check.rowCount) : "—", message: isArabic ? check.messageAr : check.messageEn })),
  };

  async function copyReport() {
    await navigator.clipboard?.writeText(buildReport(checks, isArabic));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return <section className="dn-admin-section-workspace">
    <header className="dn-section-hero"><div><span>DAY NIGHT · Supabase</span><h1>{title}</h1><p>{isArabic ? "تحقق آمن من جاهزية الجداول والعروض والدوال المطلوبة في الإنتاج بدون عرض أخطاء Supabase الخام." : "Safely verifies required production tables, views, and RPCs without exposing raw Supabase errors."}</p></div><div className="dn-section-hero-actions"><button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" />{isArabic ? "إعادة الفحص" : "Re-run checks"}</button><button type="button" onClick={() => void copyReport()}><Copy className="h-4 w-4" />{copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ تقرير الفحص" : "Copy health report")}</button><AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} /></div></header>
    <div className="dn-section-kpis">{([{ key: "total", ar: "إجمالي الفحوصات", en: "Total checks" }, { key: "ok", ar: "يعمل بنجاح", en: "Working" }, { key: "missing", ar: "يحتاج migration", en: "Migration required" }, { key: "permission", ar: "مشاكل صلاحيات", en: "Permission issues" }, { key: "empty", ar: "لا توجد بيانات", en: "Empty" }] as const).map((item) => <article key={item.key}><Database className="h-5 w-5" /><strong>{summary[item.key]}</strong><span>{isArabic ? item.ar : item.en}</span></article>)}</div>
    <article className="dn-admin-filter-table-card"><h2>{isArabic ? "نتائج الفحص" : "Check results"}</h2><div className="dn-admin-filter-table-wrap"><table className="dn-admin-filter-table"><thead><tr><th>{isArabic ? "العنصر" : "Object"}</th><th>{isArabic ? "النوع" : "Type"}</th><th>{isArabic ? "الحالة" : "Status"}</th><th>{isArabic ? "عدد الصفوف" : "Rows"}</th><th>{isArabic ? "الرسالة" : "Message"}</th><th>{isArabic ? "الإجراء" : "Action"}</th></tr></thead><tbody>{checks.map((check) => <tr key={check.id}><td><b>{check.id}</b><br />{isArabic ? check.labelAr : check.labelEn}</td><td>{isArabic ? kindText[check.kind].ar : kindText[check.kind].en}</td><td><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${badgeClass(check.status)}`}>{isArabic ? statusText[check.status].ar : statusText[check.status].en}</span></td><td>{typeof check.rowCount === "number" ? check.rowCount : "—"}</td><td>{isArabic ? check.messageAr : check.messageEn}</td><td>{check.status === "missing" ? (isArabic ? "طبّق migration" : "Apply migration") : check.status === "permission" ? (isArabic ? "راجع RLS" : "Review RLS") : (isArabic ? "راقب" : "Monitor")}</td></tr>)}</tbody></table></div></article>
    <article className="dn-admin-support-card"><h2>{isArabic ? "تعليمات تطبيق migration" : "Migration application instructions"}</h2><p>{isArabic ? "إذا ظهر أن finance_summary أو admin_daily_closings غير موجودة، فهذا يعني أن الكود تم دمجه لكن SQL migration لم يُطبق بعد على Supabase." : "If finance_summary or admin_daily_closings appears missing, code was merged but the SQL migration has not been applied to Supabase yet."}</p><ol><li>Open Supabase Dashboard.</li><li>Go to SQL Editor.</li><li>Apply migrations in order: 20260710072000_finance_summary_view_rpc.sql, then 20260710120000_admin_daily_closing.sql.</li><li>{isArabic ? "أعد تشغيل مركز فحص قاعدة البيانات." : "Re-run Database Health Center."}</li><li>{isArabic ? "تأكد أن كل الفحوصات خضراء أو صفراء." : "Confirm all checks are green or yellow."}</li></ol><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onNavigate?.("settings")}><Settings className="h-4 w-4" />{isArabic ? "فتح الإعدادات" : "Open settings"}</button><button type="button" onClick={() => onNavigate?.("finance_dashboard")}><BarChart3 className="h-4 w-4" />{isArabic ? "فتح لوحة المالية" : "Open finance dashboard"}</button><span><ShieldCheck className="inline h-4 w-4" /> {isArabic ? "لا يتم عرض أسرار Supabase أو الأخطاء الخام." : "No Supabase secrets or raw errors are shown."}</span></div></article>
  </section>;
}
