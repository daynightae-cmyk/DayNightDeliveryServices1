import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import {
  AdminIconBadge,
  AdminStateChip,
  type AdminIconName,
  type AdminIconTone,
} from "./adminIconSystem";
import {
  fetchAdminDatabaseHealth,
  type AdminDbHealthCheck,
  type AdminDbHealthStatus,
} from "../../lib/adminData";
import { fetchFinanceHardeningHealth } from "../../lib/adminFinanceLedger";
import { addAdminNotification } from "../../lib/adminAudio";

type Props = {
  isArabic: boolean;
  onNavigate?: (id: "settings" | "finance_dashboard") => void;
};

type SummaryKey = "total" | "ok" | "missing" | "permission" | "empty";
type ObjectMeta = { ar: string; en: string; areaAr: string; areaEn: string };
type FinanceHealth = Record<string, unknown> & { ok?: boolean; reason?: string };

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
  finance_summary: { ar: "ملخص المالية القديم", en: "Legacy finance summary", areaAr: "المالية", areaEn: "Finance" },
  get_finance_summary: { ar: "إجراء ملخص المالية القديم", en: "Legacy finance summary procedure", areaAr: "المالية", areaEn: "Finance" },
  admin_finance_hardening_health: { ar: "حزمة المالية والميزانية الجديدة", en: "Finance and budget hardening", areaAr: "المالية والميزانية", areaEn: "Finance & Budget" },
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
  merchant_statement_entries: { ar: "جدول كشوفات التجار القديم", en: "Legacy merchant entries", areaAr: "التجار", areaEn: "Merchants" },
  driver_statement_entries: { ar: "جدول كشوفات المناديب", en: "Driver statement entries", areaAr: "المناديب", areaEn: "Drivers" },
  import_batches: { ar: "جدول دفعات الاستيراد", en: "Import batches", areaAr: "الاستيراد", areaEn: "Import" },
  import_batch_rows: { ar: "جدول صفوف الاستيراد", en: "Import rows", areaAr: "الاستيراد", areaEn: "Import" },
  admin_audit_events: { ar: "جدول سجل التدقيق", en: "Admin audit events", areaAr: "التدقيق", areaEn: "Audit" },
  orders: { ar: "جدول الطلبيات", en: "Orders table", areaAr: "الطلبيات", areaEn: "Orders" },
  merchants: { ar: "جدول التجار", en: "Merchants table", areaAr: "التجار", areaEn: "Merchants" },
  profiles: { ar: "جدول المستخدمين والصلاحيات", en: "Profiles and roles table", areaAr: "الصلاحيات", areaEn: "Roles" },
};

const baseMigration = "supabase/migrations/20260711010000_admin_production_foundation.sql";
const financeMigration = "supabase/migrations/20260720010000_admin_finance_budget_expenses_hardening.sql";

function statusChip(status: AdminDbHealthStatus): { name: AdminIconName; tone: AdminIconTone } {
  if (status === "ok") return { name: "success", tone: "success" };
  if (status === "empty") return { name: "info", tone: "warning" };
  if (status === "missing" || status === "error") return { name: "error", tone: "danger" };
  if (status === "permission") return { name: "warning", tone: "warning" };
  return { name: "info", tone: "neutral" };
}

function objectName(check: AdminDbHealthCheck, isArabic: boolean) {
  const meta = objectMeta[check.id];
  return meta ? (isArabic ? meta.ar : meta.en) : isArabic ? check.labelAr : check.labelEn;
}

function areaName(check: AdminDbHealthCheck, isArabic: boolean) {
  const meta = objectMeta[check.id];
  return meta ? (isArabic ? meta.areaAr : meta.areaEn) : isArabic ? "النظام" : "System";
}

function statusMessage(check: AdminDbHealthCheck, isArabic: boolean) {
  if (check.id === "admin_finance_hardening_health") {
    if (check.status === "ok") return isArabic ? "الدفتر المالي والمصروفات والتسويات والميزانية والإغلاق اليومي متصلة وتستجيب." : "Ledger, expenses, adjustments, budget, and daily closing are connected.";
    if (check.status === "missing") return isArabic ? "Migration المالية والميزانية الجديدة لم تُطبق بعد." : "The new finance and budget migration is not applied.";
    return isArabic ? "توجد مشكلة صلاحية أو تشغيل في مركز المالية الجديد." : "The new finance center has a permission or runtime issue.";
  }
  if (check.status === "ok") return isArabic ? "متصل ويستجيب من قاعدة البيانات." : "Connected and responding from the database.";
  if (check.status === "empty") return isArabic ? "الكائن موجود وجاهز، لكنه لا يحتوي صفوفاً حالياً." : "Object exists and is ready, but currently has no rows.";
  if (check.status === "missing") return isArabic ? "غير مطبق في Supabase ويحتاج Migration." : "Not applied in Supabase; migration required.";
  if (check.status === "permission") return isArabic ? "الكائن موجود غالباً، لكن صلاحيات الأدمن أو RLS تمنع الوصول." : "Object likely exists, but admin permissions or RLS block access.";
  if (check.status === "unknown") return isArabic ? "لا يمكن تأكيد الحالة من المتصفح حالياً." : "The browser cannot confirm this object right now.";
  return isArabic ? "يحتاج مراجعة إدارية بدون عرض خطأ Supabase الخام." : "Needs admin review without exposing raw Supabase errors.";
}

function actionText(check: AdminDbHealthCheck, isArabic: boolean) {
  if (check.id === "admin_finance_hardening_health" && check.status !== "ok") return isArabic ? "طبّق Migration المالية الجديدة" : "Apply the finance migration";
  if (check.status === "missing") return isArabic ? "طبّق ملف قاعدة البيانات" : "Apply database file";
  if (check.status === "permission") return isArabic ? "راجع صلاحية الأدمن" : "Review admin permission";
  if (check.status === "empty") return isArabic ? "اختبر ببيانات حقيقية" : "Test with real rows";
  if (check.status === "ok") return isArabic ? "جاهز" : "Ready";
  return isArabic ? "راجع" : "Review";
}

function financeHealthCheck(health: FinanceHealth): AdminDbHealthCheck {
  const reason = String(health.reason || "");
  const status: AdminDbHealthStatus = health.ok === true ? "ok" : reason === "migration_required" ? "missing" : reason ? "permission" : "unknown";
  return {
    id: "admin_finance_hardening_health",
    labelAr: "حزمة المالية والميزانية الجديدة",
    labelEn: "Finance and budget hardening",
    kind: "rpc",
    status,
    rowCount: Number(health.expenses_total || 0) + Number(health.adjustments_total || 0) + Number(health.budgets_total || 0),
    messageAr: "",
    messageEn: "",
  };
}

function buildReport(checks: AdminDbHealthCheck[], isArabic: boolean) {
  return checks.map((check) => `${objectName(check, isArabic)} [${check.id}]: ${isArabic ? statusText[check.status].ar : statusText[check.status].en} (${typeof check.rowCount === "number" ? check.rowCount : "—"}) - ${statusMessage(check, isArabic)}`).join("\n");
}

function buildRepairChecklist(checks: AdminDbHealthCheck[], isArabic: boolean) {
  const financeMissing = checks.some((check) => check.id === "admin_finance_hardening_health" && check.status !== "ok");
  const otherMissing = checks.filter((check) => check.id !== "admin_finance_hardening_health" && (check.status === "missing" || check.status === "error"));
  const permission = checks.filter((check) => check.status === "permission" || check.status === "unknown");
  const lines = isArabic
    ? [
        "DAY NIGHT — خطة إصلاح قاعدة البيانات",
        financeMissing ? `المالية والميزانية: ${financeMigration}` : "المالية والميزانية: جاهزة",
        otherMissing.length ? `الأساس الإداري: ${baseMigration}` : "الأساس الإداري: جاهز",
        "1. افتح Supabase SQL Editor.",
        "2. شغّل فقط الملف الذي يظهر أنه غير مطبق، مرة واحدة.",
        "3. ارجع إلى /admin → فحص قاعدة البيانات واضغط إعادة الفحص.",
        `غير مطبق: ${otherMissing.map((check) => check.id).join(", ") || "لا يوجد"}`,
        `صلاحية/غير مؤكد: ${permission.map((check) => check.id).join(", ") || "لا يوجد"}`,
      ]
    : [
        "DAY NIGHT — Database Repair Plan",
        financeMissing ? `Finance and budget: ${financeMigration}` : "Finance and budget: ready",
        otherMissing.length ? `Admin foundation: ${baseMigration}` : "Admin foundation: ready",
        "1. Open Supabase SQL Editor.",
        "2. Run only the file reported as missing, once.",
        "3. Return to /admin → Database Health and re-run checks.",
        `Not applied: ${otherMissing.map((check) => check.id).join(", ") || "none"}`,
        `Permission/unconfirmed: ${permission.map((check) => check.id).join(", ") || "none"}`,
      ];
  return lines.join("\n");
}

export default function AdminDatabaseHealthCenter({ isArabic, onNavigate }: Props) {
  const [checks, setChecks] = useState<AdminDbHealthCheck[]>([]);
  const [financeHealth, setFinanceHealth] = useState<FinanceHealth>({ ok: false });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"report" | "repair" | null>(null);
  const title = isArabic ? "فحص قاعدة البيانات" : "Database Health";

  async function refresh() {
    setLoading(true);
    const [baseChecks, finance] = await Promise.all([
      fetchAdminDatabaseHealth(),
      fetchFinanceHardeningHealth(),
    ]);
    const next = [...baseChecks.filter((check) => check.id !== "admin_finance_hardening_health"), financeHealthCheck(finance)];
    setChecks(next);
    setFinanceHealth(finance);

    const problemObjects = next.filter((check) => check.status === "missing" || check.status === "error");
    const permissionObjects = next.filter((check) => check.status === "permission" || check.status === "unknown");
    if (problemObjects.length || permissionObjects.length) {
      addAdminNotification({
        type: "database",
        sectionId: "database_health",
        priority: "high",
        dedupeKey: `db-health:${[...problemObjects, ...permissionObjects].map((check) => check.id).join("|")}`,
        audioEvent: "database_health_warning",
        titleAr: "قاعدة البيانات تحتاج استكمال",
        titleEn: "Database setup needs completion",
        bodyAr: `يوجد ${problemObjects.length + permissionObjects.length} عنصر يحتاج تطبيق أو صلاحية.`,
        bodyEn: `${problemObjects.length + permissionObjects.length} database objects need setup or permission review.`,
      });
    } else if (next.length) {
      addAdminNotification({
        type: "success",
        sectionId: "database_health",
        priority: "normal",
        dedupeKey: `db-health-ok:${next.length}:${finance.ok}`,
        audioEvent: "database_health_ok",
        titleAr: "قاعدة البيانات جاهزة",
        titleEn: "Database is ready",
        bodyAr: "كل فحوصات قاعدة البيانات والمالية الأساسية جاهزة.",
        bodyEn: "All required database and finance checks are ready.",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const summary = useMemo<Record<SummaryKey, number>>(
    () => ({
      total: checks.length,
      ok: checks.filter((check) => check.status === "ok").length,
      missing: checks.filter((check) => check.status === "missing" || check.status === "error").length,
      permission: checks.filter((check) => check.status === "permission" || check.status === "unknown").length,
      empty: checks.filter((check) => check.status === "empty").length,
    }),
    [checks],
  );

  const repairChecklist = useMemo(() => buildRepairChecklist(checks, isArabic), [checks, isArabic]);
  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: title,
    filters: new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE"),
    totals: {
      ...summary,
      financeHardening: financeHealth.ok === true ? "OK" : String(financeHealth.reason || "UNCONFIRMED"),
      unpostedDelivered: Number(financeHealth.unposted_delivered_orders || 0),
      duplicateSettlements: Number(financeHealth.duplicate_settlements || 0),
    },
    columns: [
      { key: "object", label: isArabic ? "العنصر" : "Object" },
      { key: "area", label: isArabic ? "القسم" : "Area" },
      { key: "kind", label: isArabic ? "النوع" : "Type" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "rows", label: isArabic ? "عدد الصفوف" : "Rows" },
      { key: "message", label: isArabic ? "الرسالة" : "Message" },
    ],
    rows: checks.map((check) => ({
      object: objectName(check, isArabic),
      area: areaName(check, isArabic),
      kind: isArabic ? kindText[check.kind].ar : kindText[check.kind].en,
      status: isArabic ? statusText[check.status].ar : statusText[check.status].en,
      rows: typeof check.rowCount === "number" ? String(check.rowCount) : "—",
      message: statusMessage(check, isArabic),
    })),
  };

  async function copyText(type: "report" | "repair") {
    const text = type === "report" ? buildReport(checks, isArabic) : repairChecklist;
    if (typeof navigator !== "undefined") await navigator.clipboard?.writeText(text);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const healthTone = summary.missing ? "is-critical" : summary.permission ? "is-warning" : "is-ready";

  return (
    <section className="dn-admin-section-workspace">
      <header className="dn-section-hero">
        <div className="dn-section-hero-copy">
          <AdminIconBadge name="database-health" label={title} />
          <div>
            <span>DAY NIGHT · Supabase</span>
            <h1>{title}</h1>
            <p>{isArabic ? "فحص جداول وإجراءات التشغيل، مع تحقق منفصل للدفتر المالي والمصروفات والميزانية والإغلاق اليومي." : "Production table and RPC verification with a separate check for ledger, expenses, budget, and daily closing."}</p>
          </div>
        </div>
        <div className="dn-section-hero-actions">
          <button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? (isArabic ? "جاري الفحص" : "Checking") : (isArabic ? "إعادة الفحص" : "Re-run checks")}</button>
          <button type="button" onClick={() => void copyText("report")}><Copy className="h-4 w-4" />{copied === "report" ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ التقرير" : "Copy report")}</button>
          <button type="button" onClick={() => void copyText("repair")}><ClipboardList className="h-4 w-4" />{copied === "repair" ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ خطة الإصلاح" : "Copy repair plan")}</button>
          <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={pdfPayload} />
        </div>
      </header>

      <div className={`dn-clean-note ${healthTone}`}>
        <ShieldCheck className="inline h-4 w-4" /> {summary.missing ? (isArabic ? "يوجد عنصر غير مطبق. انسخ خطة الإصلاح وشغّل Migration المطلوبة فقط." : "An object is not applied. Copy the repair plan and run only the required migration.") : summary.permission ? (isArabic ? "العناصر موجودة غالباً، لكن توجد صلاحيات أو RLS تحتاج مراجعة." : "Objects likely exist, but permissions or RLS need review.") : (isArabic ? "الفحوصات الأساسية والمالية جاهزة. الصفوف الفارغة لا تعني وجود عطل." : "Base and finance checks are ready. Empty tables are not failures.")}
      </div>

      <div className="dn-section-kpis">
        {([
          { key: "total", ar: "إجمالي الفحوصات", en: "Total checks", icon: "database-health" },
          { key: "ok", ar: "جاهز", en: "Ready", icon: "success" },
          { key: "missing", ar: "غير مطبق", en: "Not applied", icon: "error" },
          { key: "permission", ar: "صلاحيات", en: "Permissions", icon: "warning" },
          { key: "empty", ar: "جاهز بلا بيانات", en: "Ready, no rows", icon: "info" },
        ] as const).map((item) => (
          <article key={item.key}>
            <AdminIconBadge name={item.icon} label={isArabic ? item.ar : item.en} className="dn-admin-kpi-icon" />
            <strong>{summary[item.key]}</strong>
            <span>{isArabic ? item.ar : item.en}</span>
          </article>
        ))}
      </div>

      <article className="dn-admin-filter-table-card">
        <h2><AdminIconBadge name="rows" />{isArabic ? "نتائج الفحص المفصلة" : "Detailed check results"}</h2>
        <div className="dn-admin-filter-table-wrap">
          <table className="dn-admin-filter-table">
            <thead><tr><th>{isArabic ? "العنصر" : "Object"}</th><th>{isArabic ? "القسم" : "Area"}</th><th>{isArabic ? "النوع" : "Type"}</th><th>{isArabic ? "الحالة" : "Status"}</th><th>{isArabic ? "الصفوف" : "Rows"}</th><th>{isArabic ? "المعنى" : "Meaning"}</th><th>{isArabic ? "الإجراء" : "Action"}</th></tr></thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.id}>
                  <td><b>{objectName(check, isArabic)}</b><br /><small>{check.id}</small></td>
                  <td>{areaName(check, isArabic)}</td>
                  <td>{isArabic ? kindText[check.kind].ar : kindText[check.kind].en}</td>
                  <td><AdminStateChip name={statusChip(check.status).name} tone={statusChip(check.status).tone}>{isArabic ? statusText[check.status].ar : statusText[check.status].en}</AdminStateChip></td>
                  <td>{typeof check.rowCount === "number" ? check.rowCount : "—"}</td>
                  <td>{statusMessage(check, isArabic)}</td>
                  <td>{actionText(check, isArabic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="dn-admin-support-card">
        <h2><AlertTriangle className="inline h-5 w-5" /> {isArabic ? "خطة الإصلاح المحددة" : "Targeted repair plan"}</h2>
        <p>{isArabic ? "لا تشغّل كل ملفات SQL عشوائياً. الخطة تحدد ملف الأساس أو ملف المالية فقط عند الحاجة." : "Do not run every SQL file blindly. The plan identifies the foundation or finance migration only when required."}</p>
        <pre className="dn-clean-note whitespace-pre-wrap">{repairChecklist}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyText("repair")}><Copy className="h-4 w-4" />{isArabic ? "نسخ الخطة" : "Copy plan"}</button>
          <button type="button" onClick={() => onNavigate?.("settings")}><Settings className="h-4 w-4" />{isArabic ? "فتح الإعدادات" : "Open settings"}</button>
          <button type="button" onClick={() => onNavigate?.("finance_dashboard")}><BarChart3 className="h-4 w-4" />{isArabic ? "فتح المالية" : "Open finance"}</button>
          <span><CheckCircle2 className="inline h-4 w-4" /> {isArabic ? "لا يتم عرض مفاتيح Supabase أو الأخطاء الخام للمستخدم." : "Supabase keys and raw errors are never exposed."}</span>
        </div>
      </article>
    </section>
  );
}
