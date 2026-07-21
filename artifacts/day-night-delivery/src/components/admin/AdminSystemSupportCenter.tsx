import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Headphones,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import {
  createAdminAuditEvent,
  fetchAdminAuditEvents,
  fetchAdminDatabaseHealth,
  type AdminDbHealthCheck,
  type FinanceRow,
  type FinanceSummary,
} from "../../lib/adminData";
import type { Merchant } from "../../types";

type Props = {
  isArabic: boolean;
  orders: unknown[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
};

type Draft = {
  issueType: string;
  priority: string;
  affectedPage: string;
  description: string;
  adminNote: string;
};

type SupportMetadata = Draft & {
  createdFrom: string;
  createdAt: string;
  sync_status?: "database" | "pending_local";
  local_id?: string;
};

const storageKey = "dn_admin_support_notes_pending_v2";
const t = (arMode: boolean, ar: string, en: string) => (arMode ? ar : en);
const money = (value: unknown, arMode: boolean) =>
  arMode ? `${Number(value || 0).toFixed(2)} درهم` : `${Number(value || 0).toFixed(2)} AED`;
const issueMap: Record<string, [string, string]> = {
  database: ["قاعدة البيانات", "Database"],
  ui: ["الواجهة", "User interface"],
  finance: ["المالية", "Finance"],
  orders: ["الطلبات", "Orders"],
  merchants: ["التجار", "Merchants"],
  deployment: ["النشر", "Deployment"],
  other: ["أخرى", "Other"],
};
const priorityMap: Record<string, [string, string]> = {
  low: ["منخفض", "Low"],
  normal: ["عادي", "Normal"],
  high: ["مرتفع", "High"],
  critical: ["حرج", "Critical"],
};

function issueLabel(value: string, arMode: boolean) {
  const pair = issueMap[value] || issueMap.other;
  return arMode ? pair[0] : pair[1];
}
function priorityLabel(value: string, arMode: boolean) {
  const pair = priorityMap[value] || priorityMap.normal;
  return arMode ? pair[0] : pair[1];
}
function readPendingNotes(): FinanceRow[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? (parsed as FinanceRow[]) : [];
  } catch {
    return [];
  }
}
function writePendingNotes(rows: FinanceRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(rows.slice(0, 80)));
}
function rowDate(row: FinanceRow) {
  return String(row.created_at || row.updated_at || new Date().toISOString()).slice(0, 19).replace("T", " ");
}
function metadata(row: FinanceRow): Record<string, unknown> {
  return ((row.metadata || {}) as Record<string, unknown>) || {};
}
function meta(row: FinanceRow, key: string) {
  return String(metadata(row)[key] || row[key] || "—");
}
function syncStatus(row: FinanceRow) {
  return meta(row, "sync_status") === "pending_local" ? "pending_local" : "database";
}

export default function AdminSystemSupportCenter({ isArabic, orders, merchants, financeSummary }: Props) {
  const [health, setHealth] = useState<AdminDbHealthCheck[]>([]);
  const [auditRows, setAuditRows] = useState<FinanceRow[]>([]);
  const [pendingRows, setPendingRows] = useState<FinanceRow[]>(() => readPendingNotes());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "warning" | "error">("success");
  const [draft, setDraft] = useState<Draft>({
    issueType: "database",
    priority: "normal",
    affectedPage: "admin",
    description: "",
    adminNote: "",
  });

  async function refresh() {
    setLoading(true);
    try {
      const [nextHealth, nextAudit] = await Promise.all([
        fetchAdminDatabaseHealth().catch(() => [] as AdminDbHealthCheck[]),
        fetchAdminAuditEvents().catch(() => [] as FinanceRow[]),
      ]);
      setHealth(nextHealth);
      setAuditRows(
        nextAudit
          .filter(
            (row) =>
              String(row.entity_type || "") === "support_note" ||
              String(row.action || "").includes("support"),
          )
          .slice(0, 40),
      );
      setPendingRows(readPendingNotes());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const supportRows = useMemo(() => [...pendingRows, ...auditRows].slice(0, 60), [auditRows, pendingRows]);
  const summary = useMemo(
    () => ({
      orders: orders.length,
      merchants: merchants.length,
      codPending: Number(financeSummary?.cod_pending || 0),
      dbProblems: health.filter((item) => ["missing", "permission", "error", "unknown"].includes(item.status)).length,
      empty: health.filter((item) => item.status === "empty").length,
      notes: supportRows.length,
      pendingSync: pendingRows.length,
    }),
    [financeSummary?.cod_pending, health, merchants.length, orders.length, pendingRows.length, supportRows.length],
  );
  const diagnostics = [
    `${t(isArabic, "الطلبات", "Orders")}: ${summary.orders}`,
    `${t(isArabic, "التجار", "Merchants")}: ${summary.merchants}`,
    `${t(isArabic, "COD معلق", "Pending COD")}: ${money(summary.codPending, isArabic)}`,
    `${t(isArabic, "مشاكل قاعدة البيانات", "Database issues")}: ${summary.dbProblems}`,
    `${t(isArabic, "جداول فارغة", "Empty objects")}: ${summary.empty}`,
    `${t(isArabic, "ملاحظات الدعم", "Support notes")}: ${summary.notes}`,
    `${t(isArabic, "بانتظار مزامنة", "Pending sync")}: ${summary.pendingSync}`,
  ].join("\n");
  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: t(isArabic, "DAY NIGHT · مركز الدعم الفني", "DAY NIGHT · Technical Support Center"),
    filters: new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE"),
    totals: summary,
    columns: [
      { key: "date", label: t(isArabic, "التاريخ", "Date") },
      { key: "type", label: t(isArabic, "النوع", "Type") },
      { key: "priority", label: t(isArabic, "الأولوية", "Priority") },
      { key: "page", label: t(isArabic, "القسم", "Page") },
      { key: "source", label: t(isArabic, "الحفظ", "Persistence") },
      { key: "note", label: t(isArabic, "الملاحظة", "Note") },
    ],
    rows: supportRows.map((row) => ({
      date: rowDate(row),
      type: issueLabel(meta(row, "issueType"), isArabic),
      priority: priorityLabel(meta(row, "priority"), isArabic),
      page: meta(row, "affectedPage"),
      source:
        syncStatus(row) === "pending_local"
          ? t(isArabic, "محلي بانتظار المزامنة", "Local, pending sync")
          : t(isArabic, "قاعدة البيانات", "Database"),
      note: meta(row, "description"),
    })),
  };

  async function saveSupportNote() {
    if (!draft.description.trim() && !draft.adminNote.trim()) {
      setNoticeTone("error");
      setNotice(t(isArabic, "اكتب وصفاً أو ملاحظة قبل الحفظ.", "Enter a description or note before saving."));
      return;
    }
    setNotice("");
    const createdAt = new Date().toISOString();
    const baseMetadata: SupportMetadata = {
      ...draft,
      createdFrom: "admin_system_support",
      createdAt,
      sync_status: "database",
    };
    const payload = {
      entity_type: "support_note",
      action: "create_support_note",
      metadata: baseMetadata,
    };
    const dbRow = await createAdminAuditEvent(payload).catch(() => null);
    if (dbRow) {
      setNoticeTone("success");
      setNotice(t(isArabic, "تم حفظ ملاحظة الدعم في سجل التدقيق.", "Support note saved to the audit log."));
    } else {
      const localId = `local-support-${Date.now()}`;
      const pendingMetadata: SupportMetadata = {
        ...baseMetadata,
        sync_status: "pending_local",
        local_id: localId,
      };
      const localRow = {
        id: localId,
        entity_type: "support_note",
        action: "create_support_note",
        metadata: pendingMetadata,
        created_at: createdAt,
        status: "pending_local",
      } as FinanceRow;
      const next = [localRow, ...readPendingNotes()];
      writePendingNotes(next);
      setPendingRows(next);
      setNoticeTone("warning");
      setNotice(
        t(
          isArabic,
          "تعذر الحفظ في قاعدة البيانات؛ حُفظت الملاحظة محلياً بوضوح وستظل بانتظار المزامنة.",
          "Database save failed; the note is explicitly stored locally and remains pending sync.",
        ),
      );
    }
    setDraft({ issueType: "database", priority: "normal", affectedPage: "admin", description: "", adminNote: "" });
    await refresh();
  }

  async function retryPendingNotes() {
    const pending = readPendingNotes();
    if (!pending.length) return;
    setSyncing(true);
    setNotice("");
    const remaining: FinanceRow[] = [];
    let syncedCount = 0;
    for (const row of pending) {
      const rowMeta = metadata(row);
      const cleanMetadata = { ...rowMeta, sync_status: "database", syncedAt: new Date().toISOString() };
      delete cleanMetadata.local_id;
      const saved = await createAdminAuditEvent({
        entity_type: "support_note",
        action: "create_support_note",
        metadata: cleanMetadata,
      }).catch(() => null);
      if (saved) syncedCount += 1;
      else remaining.push(row);
    }
    writePendingNotes(remaining);
    setPendingRows(remaining);
    setNoticeTone(remaining.length ? "warning" : "success");
    setNotice(
      remaining.length
        ? t(
            isArabic,
            `تمت مزامنة ${syncedCount} وبقي ${remaining.length} محلياً بانتظار صلاحية قاعدة البيانات.`,
            `${syncedCount} synced; ${remaining.length} remain locally pending database permission.`,
          )
        : t(isArabic, `تمت مزامنة ${syncedCount} ملاحظة بنجاح.`, `${syncedCount} note(s) synchronized successfully.`),
    );
    setSyncing(false);
    await refresh();
  }

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setNoticeTone("error");
      setNotice(t(isArabic, "تعذر الوصول إلى الحافظة.", "Clipboard access was unavailable."));
    }
  }

  return (
    <section className="dn-section-workspace dn-support-center-final" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-section-hero">
        <div>
          <span>DAY NIGHT · {t(isArabic, "النظام", "System")}</span>
          <h1>{t(isArabic, "مركز الدعم الفني", "Technical Support Center")}</h1>
          <p>
            {t(
              isArabic,
              "تشخيص فعلي وسجل دعم يميّز بوضوح بين الحفظ في قاعدة البيانات والحفظ المحلي المعلّق.",
              "Operational diagnostics with an explicit distinction between database persistence and locally pending notes.",
            )}
          </p>
        </div>
        <div className="dn-section-hero-actions">
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? t(isArabic, "تحميل", "Loading") : t(isArabic, "تحديث", "Refresh")}
          </button>
          <button type="button" onClick={() => void retryPendingNotes()} disabled={syncing || !pendingRows.length}>
            <RotateCcw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {t(isArabic, "مزامنة المعلّق", "Sync pending")}
          </button>
          <button type="button" onClick={() => void copyDiagnostics()}>
            <Copy className="h-4 w-4" />
            {copied ? t(isArabic, "تم النسخ", "Copied") : t(isArabic, "نسخ التشخيص", "Copy diagnostics")}
          </button>
          <AdminPdfExportButton label={t(isArabic, "تصدير PDF", "Export PDF")} payload={pdfPayload} />
        </div>
      </header>

      {notice && (
        <div className={`dn-support-notice is-${noticeTone}`} role={noticeTone === "error" ? "alert" : "status"}>
          {noticeTone === "success" ? <CheckCircle2 /> : <AlertTriangle />}
          <span>{notice}</span>
        </div>
      )}

      <div className="dn-section-kpis">
        <article><Database className="h-5 w-5" /><strong>{summary.dbProblems}</strong><span>{t(isArabic, "مشاكل قاعدة البيانات", "Database issues")}</span></article>
        <article><ClipboardList className="h-5 w-5" /><strong>{summary.orders}</strong><span>{t(isArabic, "طلبات محملة", "Loaded orders")}</span></article>
        <article><Headphones className="h-5 w-5" /><strong>{summary.notes}</strong><span>{t(isArabic, "ملاحظات دعم", "Support notes")}</span></article>
        <article className={summary.pendingSync ? "is-warning" : ""}><RotateCcw className="h-5 w-5" /><strong>{summary.pendingSync}</strong><span>{t(isArabic, "بانتظار المزامنة", "Pending sync")}</span></article>
        <article><ShieldCheck className="h-5 w-5" /><strong>{money(summary.codPending, isArabic)}</strong><span>{t(isArabic, "COD معلق", "Pending COD")}</span></article>
      </div>

      <div className="dn-section-panels">
        <article>
          <h3><Plus />{t(isArabic, "تسجيل ملاحظة دعم", "Create support note")}</h3>
          <div className="dn-section-form">
            <label><span>{t(isArabic, "نوع المشكلة", "Issue type")}</span><select value={draft.issueType} onChange={(event) => setDraft((value) => ({ ...value, issueType: event.target.value }))}>{Object.keys(issueMap).map((key) => <option key={key} value={key}>{issueLabel(key, isArabic)}</option>)}</select></label>
            <label><span>{t(isArabic, "الأولوية", "Priority")}</span><select value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value }))}>{Object.keys(priorityMap).map((key) => <option key={key} value={key}>{priorityLabel(key, isArabic)}</option>)}</select></label>
            <label><span>{t(isArabic, "القسم المتأثر", "Affected page")}</span><input value={draft.affectedPage} onChange={(event) => setDraft((value) => ({ ...value, affectedPage: event.target.value }))} /></label>
            <label><span>{t(isArabic, "الوصف", "Description")}</span><textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder={t(isArabic, "اكتب المشكلة بوضوح...", "Describe the issue clearly...")} /></label>
            <label><span>{t(isArabic, "ملاحظة الإدارة", "Admin note")}</span><textarea value={draft.adminNote} onChange={(event) => setDraft((value) => ({ ...value, adminNote: event.target.value }))} /></label>
          </div>
          <button type="button" onClick={() => void saveSupportNote()}><Plus className="h-4 w-4" />{t(isArabic, "حفظ الملاحظة", "Save note")}</button>
        </article>
        <article>
          <h3><ShieldCheck />{t(isArabic, "ملخص التشخيص", "Diagnostics summary")}</h3>
          <pre className="dn-clean-note whitespace-pre-wrap">{diagnostics}</pre>
          <p className="dn-clean-note">{t(isArabic, "لا تعرض هذه الصفحة أي مفاتيح بيئة أو أسرار Supabase.", "This page never exposes environment keys or Supabase secrets.")}</p>
        </article>
      </div>

      <article className="dn-section-table-card">
        <h3><Headphones />{t(isArabic, "سجل ملاحظات الدعم", "Support notes log")}</h3>
        <div className="dn-section-table-wrap">
          <table>
            <thead><tr><th>{t(isArabic, "التاريخ", "Date")}</th><th>{t(isArabic, "النوع", "Type")}</th><th>{t(isArabic, "الأولوية", "Priority")}</th><th>{t(isArabic, "القسم", "Page")}</th><th>{t(isArabic, "الحفظ", "Persistence")}</th><th>{t(isArabic, "الملاحظة", "Note")}</th></tr></thead>
            <tbody>
              {supportRows.map((row) => {
                const pending = syncStatus(row) === "pending_local";
                return <tr key={String(row.id || row.created_at)} className={pending ? "is-pending-local" : ""}><td>{rowDate(row)}</td><td>{issueLabel(meta(row, "issueType"), isArabic)}</td><td>{priorityLabel(meta(row, "priority"), isArabic)}</td><td>{meta(row, "affectedPage")}</td><td><span className={`dn-support-source ${pending ? "is-local" : "is-db"}`}>{pending ? t(isArabic, "محلي · معلق", "Local · pending") : t(isArabic, "قاعدة البيانات", "Database")}</span></td><td>{meta(row, "description")}</td></tr>;
              })}
            </tbody>
          </table>
          {!supportRows.length && <div className="dn-empty-state"><Headphones className="h-5 w-5" />{t(isArabic, "لا توجد ملاحظات دعم محفوظة حالياً.", "No support notes saved yet.")}</div>}
        </div>
      </article>
    </section>
  );
}
