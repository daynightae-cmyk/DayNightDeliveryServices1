import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { fetchAdminDatabaseHealth, type AdminDbHealthCheck, type AdminDbHealthStatus } from "../../lib/adminData";
import { addAdminNotification } from "../../lib/adminAudio";

type Props = { isArabic: boolean; onNavigate?: (id: "settings" | "finance_dashboard") => void };
type SummaryKey = "total" | "ok" | "missing" | "permission" | "empty";

type ObjectMeta = { ar: string; en: string; areaAr: string; areaEn: string };

const statusText: Record<AdminDbHealthStatus, { ar: string; en: string }> = {
  ok: { ar: "جاهز", en: "Ready" },
  missing: { ar: "غير مطبق", en: "Not applied" },
  permission: { ar: "صلاحية مطلوبة", en: "Permission required" },
  empty: { ar: "جاهز بلا بيانات", en: "Ready, no rows" },
  error: { ar: "تحتاج مراجعة", en: "Needs review" },
  unknown: { ar: "غير مؤكد", en: "Unconfirmed" },
};

const kindText: Record<AdminDbHealthCheck["kind"], { ar: string; en: string }> = {
  table: { ar: "جدول بيانات", en: "Table" },
  view: { ar: "عرض ملخص", en: "View" },
  rpc: { ar: "إجراء قاعدة بيانات", en: "RPC" },
};

const objectMeta: Record<string, ObjectMeta> = {
  finance_summary: { ar: "ملخص المالية", en: "Finance summary", areaAr: "المالية", areaEn: "Finance" },
  get_finance_summary: { ar: "إجراء ملخص المالية", en: "Finance summary procedure", areaAr: "المالية", areaEn: "Finance" },
  admin_create_expense: { ar: "إجراء إنشاء مصروف", en: "Create expense procedure", areaAr: "المصروفات", areaEn: "Expenses" },
  admin_create_adjustment: { ar: "إجراء إنشاء تسوية", en: "Create adjustment procedure", areaAr: "التسويات", areaEn: "Adjustments" },
  admin_create_print_job: { ar: "إجراء إنشاء مهمة طباعة", en: "Create print job procedure", areaAr: "الطباعة", areaEn: "Print" },
  admin_mark_print_job_printed: { ar: "إجراء تأكيد الطباعة", en: "Mark print job printed", areaAr: "الطباعة", areaEn: "Print" },
  admin_save_daily_closing: { ar: "إجراء حفظ الإغلاق اليومي", en: "Save daily closing procedure", areaAr: "الإغلاق اليومي", areaEn: "Daily closing" },
  admin_create_audit_event: { ar: "إجراء تسجيل التدقيق", en: "Create audit event procedure", areaAr: "سجل التدقيق", areaEn: "Audit" },
  admin_daily_closings: { ar: "جدول الإغلاق اليومي", en: "Daily closing table", areaAr: "الإغلاق اليومي", areaEn: "Daily closing" },
  print_jobs: { ar: "جدول مهام الطباعة", en: "Print jobs table", areaAr: "الطباعة", areaEn: "Print" },
  admin_expenses: { ar: "جدول المصروفات", en: "Expenses table", areaAr: "المصروفات", areaEn: "Expenses" },
  admin_adjustments: { ar: "جدول التسويات", en: "Adjustments table", areaAr: "التسويات", areaEn: "Adjustments" },
  cod_collections: { ar: "جدول التحصيل عند التسليم", en: "Cash-on-delivery collection table", areaAr: "التحصيل", areaEn: "Collections" },
  merchant_statement_entries: { ar: "جدول كشوفات التجار", en: "Merchant statement entries", areaAr: "التجار", areaEn: "Merchants" },
  driver_statement_entries: { ar: "جدول كشوفات المناديب", en: "Driver statement entries", areaAr: "المناديب", areaEn: "Drivers" },
  import_batches: { ar: "جدول دفعات الاستيراد", en: "Import batches", areaAr: "الاستيراد", areaEn: "Import" },
  import_batch_rows: { ar: "جدول صفوف الاستيراد", en: "Import rows", areaAr: "الاستيراد", areaEn: "Import" },
  admin_audit_events: { ar: "جدول سجل التدقيق", en: "Admin audit events", areaAr: "التدقيق", areaEn: "Audit" },
  orders: { ar: "جدول الطلبيات", en: "Orders table", areaAr: "الطلبيات", areaEn: "Orders" },
  merchants: { ar: "جدول التجار", en: "Merchants table", areaAr: "التجار", areaEn: "Merchants" },
  profiles: { ar: "جدول المستخدمين والصلاحيات", en: "Profiles and roles table", areaAr: "الصلاحيات", areaEn: "Roles" },
};

const unifiedMigration = "supabase/migrations/20260711010000_admin_production_foundation.sql";

function badgeClass(status: AdminDbHealthStatus) {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-100 border-emerald-400/40";
  if (status === "empty") return "bg-amber-500/15 text-amber-100 border-amber-400/35";
  if (status === "missing" || status === "error") return "bg-red-500/15 text-red-100 border-red-400/35";
  return "bg-sky-500/15 text-sky-100 border-sky-400/35";
}

function objectName(check: AdminDbHealthCheck, isArabic: boolean) {
  const meta = objectMeta[check.id];
  if (!meta) return isArabic ? check.labelAr : check.labelEn;
  return isArabic ? meta.ar : meta.en;
}

function areaName(check: AdminDbHealthCheck, isArabic: boolean) {
  const meta = objectMeta[check.id];
  if (!meta) return isArabic ? "النظام" : "System";
  return isArabic ? meta.areaAr : meta.areaEn;
}

function statusMessage(check: AdminDbHealthCheck, isArabic: boolean) {
  if (check.status === "ok") return isArabic ? "متصل ويستجيب من قاعدة البيانات." : "Connected and responding from the database.";
  if (check.status === "empty") return isArabic ? "الكائن موجود وجاهز، لكنه لا يحتوي صفوفاً حالياً." : "Object exists and is ready, but currently has no rows.";
  if (check.status === "missing") return isArabic ? "غير مطبق في Supabase. طبّق ملف قاعدة البيانات الموحد ثم أعد الفحص." : "Not applied in Supabase. Apply the unified database file, then re-run checks.";
  if (check.status === "permission") return isArabic ? "الكائن موجود غالباً، لكن صلاحيات الأدمن أو RLS تمنع القراءة/التنفيذ." : "Object likely exists, but admin permissions or RLS blocks access.";
  if (check.status === "unknown") return isArabic ? "لا يمكن تأكيد الحالة من المتصفح حالياً." : "The browser cannot confirm this object right now.";
  return isArabic ? "يحتاج مراجعة إدارية بدون عرض خطأ Supabase الخام." : "Needs admin review without exposing raw Supabase errors.";
}

function actionText(check: AdminDbHealthCheck, isArabic: boolean) {
  if (check.status === "missing") return isArabic ? "طبّق ملف قاعدة البيانات" : "Apply database file";
  if (check.status === "permission") return isArabic ? "راجع صلاحية الأدمن" : "Review admin permission";
  if (check.status === "empty") return isArabic ? "اختبر ببيانات حقيقية" : "Test with real rows";
  if (check.status === "ok") return isArabic ? "جاهز" : "Ready";
  return isArabic ? "راجع" : "Review";
}

function buildReport(checks: AdminDbHealthCheck[], isArabic: boolean) {
  return checks
    .map((check) => `${objectName(check, isArabic)} [${check.id}]: ${isArabic ? statusText[check.status].ar : statusText[check.status].en} (${typeof check.rowCount === "number" ? check.rowCount : "—"}) - ${statusMessage(check, isArabic)}`)
    .join("\n");
}

function buildRepairChecklist(checks: AdminDbHealthCheck[], isArabic: boolean) {
  const missing = checks.filter((check) => check.status === "missing" || check.status === "error");
  const permission = checks.filter((check) => check.status === "permission" || check.status === "unknown");
  const empty = checks.filter((check) => check.status === "empty");
  if (isArabic) {
    return [
      "DAY NIGHT — خطة إصلاح فحص قاعدة البيانات",
      `الملف المطلوب: ${unifiedMigration}`,
      "الخطوة 1: افتح Supabase SQL Editor.",
      "الخطوة 2: افتح الملف أعلاه من GitHub وانسخ SQL كاملاً من أول create extension حتى آخر grant.",
      "الخطوة 3: شغّل SQL مرة واحدة. الملف آمن ومتكرر ولا يحذف بيانات.",
      "الخطوة 4: ارجع إلى /admin → النظام → فحص قاعدة البيانات واضغط إعادة الفحص.",
      "",
      `غير مطبق: ${missing.map((check) => check.id).join(", ") || "لا يوجد"}`,
      `صلاحية/غير مؤكد: ${permission.map((check) => check.id).join(", ") || "لا يوجد"}`,
      `جاهز بلا بيانات: ${empty.map((check) => check.id).join(", ") || "لا يوجد"}`,
    ].join("\n");
  }
  return [
    "DAY NIGHT — Database Health Repair Plan",
    `Required file: ${unifiedMigration}`,
    "Step 1: Open Supabase SQL Editor.",
    "Step 2: Open the file above from GitHub and copy the full SQL from create extension through the final grant.",
    "Step 3: Run the SQL once. It is idempotent and does not wipe data.",
    "Step 4: Return to /admin → System → Database Health and re-run checks.",
    "",
    `Not applied: ${missing.map((check) => check.id).join(", ") || "none"}`,
    `Permission/unconfirmed: ${permission.map((check) => check.id).join(", ") || "none"}`,
    `Ready with no rows: ${empty.map((check) => check.id).join(", ") || "none"}`,
  ].join("\n");
}

export default function AdminDatabaseHealthCenter({ isArabic, onNavigate }: Props) {
  const [checks, setChecks] = useState<AdminDbHealthCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"report" | "repair" | null>(null);
  const title = isArabic ? "فحص قاعدة البيانات" : "Database Health";

  async function refresh() {
    setLoading(true);
    const next = await fetchAdminDatabaseHealth();
    setChecks(next);
    const problemObjects = next.filter((check) => check.status === "missing" || check.status === "error");
    const permissionObjects = next.filter((check) => check.status === "permission" || check.status === "unknown");
    if (problemObjects.length || permissionObjects.length) {
      const names = [...problemObjects, ...permissionObjects].map((check) => objectName(check, true)).join("، ");
      addAdminNotification({
        type: "database",
        sectionId: "database_health",
        priority: "high",
        dedupeKey: `db-health:${[...problemObjects, ...permissionObjects].map((check) => check.id).join("|")}`,
        audioEvent: "database_health_warning",
        titleAr: "قاعدة البيانات تحتاج استكمال",
        titleEn: "Database setup needs completion",
        bodyAr: `يوجد ${problemObjects.length + permissionObjects.length} عنصر يحتاج تطبيق أو صلاحية: ${names}.`,
        bodyEn: `${problemObjects.length + permissionObjects.length} database objects need setup or permission review.`,
      });
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

  const missingObjects = checks.filter((check) => check.status === "missing").map((check) => objectName(check, isArabic)).join(", ") || "—";
  const repairChecklist = useMemo(() => buildRepairChecklist(checks, isArabic), [checks, isArabic]);
  const pdfPayload = {
    language: isArabic ? "ar" as const : "en" as const,
    sectionTitle: title,
    filters: new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE"),
    totals: { ...summary, missingObjects, recommended: summary.missing ? (isArabic ? "طبّق ملف قاعدة البيانات الموحد ثم أعد الفحص" : "Apply the unified database file, then re-run checks") : (isArabic ? "اختبر الصفوف الفارغة والصلاحيات" : "Review empty rows and permissions") },
    columns: [
      { key: "object", label: isArabic ? "العنصر" : "Object" },
      { key: "area", label: isArabic ? "القسم" : "Area" },
      { key: "kind", label: isArabic ? "النوع" : "Type" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "rows", label: isArabic ? "عدد الصفوف" : "Rows" },
      { key: "message", label: isArabic ? "الرسالة" : "Message" },
    ],
    rows: checks.map((check) => ({ object: objectName(check, isArabic), area: areaName(check, isArabic), kind: isArabic ? kindText[check.kind].ar : kindText[check.kind].en, status: isArabic ? statusText[check.status].ar : statusText[check.status].en, rows: typeof check.rowCount === "number" ? String(check.rowCount) : "—", message: statusMessage(check, isArabic) })),
  };

  async function copyText(type: "report" | "repair") {
    const text = type === "report" ? buildReport(checks, isArabic) : repairChecklist;
    if (typeof navigator !== "undefined") await navigator.clipboard?.writeText(text);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const healthTone = summary.missing ? "is-critical" : summary.permission ? "is-warning" : "is-ready";

  return <section className="dn-admin-section-workspace">
    <header className="dn-section-hero"><div><span>DAY NIGHT · Supabase</span><h1>{title}</h1><p>{isArabic ? "فحص واضح ومفهوم لجداول وإجراءات الإنتاج، مع خطة إصلاح قابلة للنسخ بدل رسائل تقنية خام." : "Clear production table and RPC verification, with a copyable repair plan instead of raw technical messages."}</p></div><div className="dn-section-hero-actions"><button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" />{loading ? (isArabic ? "جاري الفحص" : "Checking") : (isArabic ? "إعادة الفحص" : "Re-run checks")}</button><button type="button" onClick={() => void copyText("report")}><Copy className="h-4 w-4" />{copied === "report" ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ التقرير" : "Copy report")}</button><button type="button" onClick={() => void copyText("repair")}><ClipboardList className="h-4 w-4" />{copied === "repair" ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ خطة الإصلاح" : "Copy repair plan")}</button><AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} /></div></header>
    <div className={`dn-clean-note ${healthTone}`}><ShieldCheck className="inline h-4 w-4" /> {summary.missing ? (isArabic ? "يوجد عناصر غير مطبقة في Supabase. الحل: تطبيق ملف قاعدة البيانات الموحد ثم إعادة الفحص." : "Some objects are not applied in Supabase. Apply the unified database file, then re-run checks.") : summary.permission ? (isArabic ? "العناصر موجودة غالباً، لكن توجد صلاحيات أو RLS تحتاج مراجعة." : "Objects likely exist, but permissions or RLS need review.") : (isArabic ? "الفحص الأساسي جاهز. الصفوف الفارغة ليست عطلاً؛ معناها لا توجد بيانات لهذا الجدول بعد." : "Base check is ready. Empty rows are not a failure; it means that table currently has no data.")}</div>
    <div className="dn-section-kpis">{([{ key: "total", ar: "إجمالي الفحوصات", en: "Total checks" }, { key: "ok", ar: "جاهز", en: "Ready" }, { key: "missing", ar: "غير مطبق", en: "Not applied" }, { key: "permission", ar: "صلاحيات", en: "Permissions" }, { key: "empty", ar: "جاهز بلا بيانات", en: "Ready, no rows" }] as const).map((item) => <article key={item.key}><Database className="h-5 w-5" /><strong>{summary[item.key]}</strong><span>{isArabic ? item.ar : item.en}</span></article>)}</div>
    <article className="dn-admin-filter-table-card"><h2>{isArabic ? "نتائج الفحص المفصلة" : "Detailed check results"}</h2><div className="dn-admin-filter-table-wrap"><table className="dn-admin-filter-table"><thead><tr><th>{isArabic ? "العنصر" : "Object"}</th><th>{isArabic ? "القسم" : "Area"}</th><th>{isArabic ? "النوع" : "Type"}</th><th>{isArabic ? "الحالة" : "Status"}</th><th>{isArabic ? "الصفوف" : "Rows"}</th><th>{isArabic ? "المعنى" : "Meaning"}</th><th>{isArabic ? "الإجراء" : "Action"}</th></tr></thead><tbody>{checks.map((check) => <tr key={check.id}><td><b>{objectName(check, isArabic)}</b><br /><small>{check.id}</small></td><td>{areaName(check, isArabic)}</td><td>{isArabic ? kindText[check.kind].ar : kindText[check.kind].en}</td><td><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${badgeClass(check.status)}`}>{isArabic ? statusText[check.status].ar : statusText[check.status].en}</span></td><td>{typeof check.rowCount === "number" ? check.rowCount : "—"}</td><td>{statusMessage(check, isArabic)}</td><td>{actionText(check, isArabic)}</td></tr>)}</tbody></table></div></article>
    <article className="dn-admin-support-card"><h2><AlertTriangle className="inline h-5 w-5" /> {isArabic ? "خطة الإصلاح الموحدة" : "Unified repair plan"}</h2><p>{isArabic ? "لا تحتاج تبحث بين ملفات كثيرة: إذا ظهرت عناصر غير مطبقة، استخدم الملف الموحد التالي في Supabase SQL Editor." : "Do not hunt across many files: when objects are not applied, use the unified file below in Supabase SQL Editor."}</p><pre className="dn-clean-note whitespace-pre-wrap">{repairChecklist}</pre><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyText("repair")}><Copy className="h-4 w-4" />{isArabic ? "نسخ الخطة" : "Copy plan"}</button><button type="button" onClick={() => onNavigate?.("settings")}><Settings className="h-4 w-4" />{isArabic ? "فتح الإعدادات" : "Open settings"}</button><button type="button" onClick={() => onNavigate?.("finance_dashboard")}><BarChart3 className="h-4 w-4" />{isArabic ? "فتح المالية" : "Open finance"}</button><span><CheckCircle2 className="inline h-4 w-4" /> {isArabic ? "لا يتم عرض مفاتيح Supabase أو الأخطاء الخام للمستخدم." : "Supabase keys and raw errors are never exposed to the user."}</span></div></article>
  </section>;
}
