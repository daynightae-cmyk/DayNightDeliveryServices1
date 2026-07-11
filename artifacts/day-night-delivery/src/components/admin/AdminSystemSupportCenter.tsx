import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Copy, Database, Headphones, Plus, RefreshCw, ShieldCheck } from "lucide-react";
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
  orders: any[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  onNavigate?: (id: string) => void;
};

type SupportDraft = { issueType: string; priority: string; affectedPage: string; description: string; adminNote: string };
const storageKey = "dn_admin_support_notes_v1";
const t = (isArabic: boolean, ar: string, en: string) => (isArabic ? ar : en);
const money = (value: unknown, isArabic: boolean) => isArabic ? `${Number(value || 0).toFixed(2)} درهم` : `${Number(value || 0).toFixed(2)} AED`;

function readLocalNotes(): FinanceRow[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(storageKey) || "[]") as FinanceRow[]; }
  catch { return []; }
}
function writeLocalNotes(rows: FinanceRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(rows.slice(0, 80)));
}
function rowDate(row: FinanceRow) { return String(row.created_at || row.updated_at || new Date().toISOString()).slice(0, 19).replace("T", " "); }
function rowText(row: FinanceRow, key: string) {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  return String(metadata[key] || row[key] || "—");
}
function priorityLabel(value: string, isArabic: boolean) {
  const map: Record<string, [string, string]> = { low: ["منخفض", "Low"], normal: ["عادي", "Normal"], high: ["مرتفع", "High"], critical: ["حرج", "Critical"] };
  const pair = map[value] || map.normal;
  return isArabic ? pair[0] : pair[1];
}
function issueLabel(value: string, isArabic: boolean) {
  const map: Record<string, [string, string]> = {
    database: ["قاعدة البيانات", "Database"], ui: ["الواجهة", "User interface"], finance: ["المالية", "Finance"], orders: ["الطلبات", "Orders"], merchants: ["التجار", "Merchants"], deployment: ["النشر", "Deployment"], other: ["أخرى", "Other"],
  };
  const pair = map[value] || map.other;
  return isArabic ? pair[0] : pair[1];
}

export default function AdminSystemSupportCenter({ isArabic, orders, merchants, financeSummary, onNavigate }: Props) {
  const [health, setHealth] = useState<AdminDbHealthCheck[]>([]);
  const [auditRows, setAuditRows] = useState<FinanceRow[]>([]);
  const [localRows, setLocalRows] = useState<FinanceRow[]>(() => readLocalNotes());
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<SupportDraft>({ issueType: "database", priority: "normal", affectedPage: "admin", description: "", adminNote: "" });

  async function refresh() {
    setLoading(true);
    try {
      const [nextHealth, nextAudit] = await Promise.all([
        fetchAdminDatabaseHealth().catch(() => [] as AdminDbHealthCheck[]),
        fetchAdminAuditEvents().catch(() => [] as FinanceRow[]),
      ]);
      setHealth(nextHealth);
      setAuditRows(nextAudit.filter((row) => String(row.entity_type || "") === "support_note" || String(row.action || "").includes("support")).slice(0, 30));
      setLocalRows(readLocalNotes());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const supportRows = useMemo(() => [...auditRows, ...localRows].slice(0, 40), [auditRows, localRows]);
  const summary = useMemo(() => {
    const dbProblems = health.filter((item) => ["missing", "permission", "error", "unknown"].includes(item.status)).length;
    const empty = health.filter((item) => item.status === "empty").length;
    return {
      orders: orders.length,
      merchants: merchants.length,
      codPending: Number(financeSummary?.cod_pending || 0),
      dbProblems,
      empty,
      notes: supportRows.length,
    };
  }, [financeSummary?.cod_pending, health, merchants.length, orders.length, supportRows.length]);

  const diagnostics = [
    `${t(isArabic, "الطلبات", "Orders")}: ${summary.orders}`,
    `${t(isArabic, "التجار", "Merchants")}: ${summary.merchants}`,
    `${t(isArabic, "COD معلق", "Pending COD")}: ${money(summary.codPending, isArabic)}`,
    `${t(isArabic, "مشاكل قاعدة البيانات", "Database issues")}: ${summary.dbProblems}`,
    `${t(isArabic, "جداول فارغة", "Empty objects")}: ${summary.empty}`,
    `${t(isArabic, "ملاحظات الدعم", "Support notes")}: ${summary.notes}`,
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
      { key: "note", label: t(isArabic, "الملاحظة", "Note") },
    ],
    rows: supportRows.map((row) => ({ date: rowDate(row), type: issueLabel(rowText(row, "issueType"), isArabic), priority: priorityLabel(rowText(row, "priority"), isArabic), page: rowText(row, "affectedPage"), note: rowText(row, "description") })),
  };

  async function saveSupportNote() {
    if (!draft.description.trim() && !draft.adminNote.trim()) return;
    const payload = {
      entity_type: "support_note",
      action: "create_support_note",
      metadata: { ...draft, createdFrom: "admin_system_support", createdAt: new Date().toISOString() },
    };
    const dbRow = await createAdminAuditEvent(payload).catch(() => null);
    const localRow = (dbRow || { id: `local-support-${Date.now()}`, ...payload, created_at: new Date().toISOString() }) as FinanceRow;
    const next = [localRow, ...readLocalNotes()];
    writeLocalNotes(next);
    setLocalRows(next);
    setDraft({ issueType: "database", priority: "normal", affectedPage: "admin", description: "", adminNote: "" });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    void refresh();
  }

  async function copyDiagnostics() {
    await navigator.clipboard?.writeText(diagnostics);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return <section className="dn-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
    <header className="dn-section-hero">
      <div><span>DAY NIGHT · {t(isArabic, "النظام", "System")}</span><h1>{t(isArabic, "مركز الدعم الفني", "Technical Support Center")}</h1><p>{t(isArabic, "تشخيص عملي للوحة الإدارة مع سجل ملاحظات دعم حقيقي يحاول الحفظ في سجل التدقيق، ثم يستخدم حفظاً محلياً آمناً عند عدم توفر الجدول.", "Operational diagnostics with support notes saved to the audit log when available, then safely cached locally if the table is unavailable.")}</p></div>
      <div className="dn-section-hero-actions"><button type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" />{loading ? t(isArabic, "تحميل", "Loading") : t(isArabic, "تحديث", "Refresh")}</button><button type="button" onClick={() => void copyDiagnostics()}><Copy className="h-4 w-4" />{copied ? t(isArabic, "تم النسخ", "Copied") : t(isArabic, "نسخ التشخيص", "Copy diagnostics")}</button><AdminPdfExportButton label={t(isArabic, "تصدير PDF", "Export PDF")} payload={pdfPayload} /></div>
    </header>
    <div className="dn-section-kpis">
      <article><Database className="h-5 w-5" /><strong>{summary.dbProblems}</strong><span>{t(isArabic, "مشاكل قاعدة البيانات", "Database issues")}</span></article>
      <article><ClipboardList className="h-5 w-5" /><strong>{summary.orders}</strong><span>{t(isArabic, "طلبات محملة", "Loaded orders")}</span></article>
      <article><Headphones className="h-5 w-5" /><strong>{summary.notes}</strong><span>{t(isArabic, "ملاحظات دعم", "Support notes")}</span></article>
      <article><ShieldCheck className="h-5 w-5" /><strong>{money(summary.codPending, isArabic)}</strong><span>{t(isArabic, "COD معلق", "Pending COD")}</span></article>
    </div>
    <div className="dn-section-panels">
      <article><h3><Plus />{t(isArabic, "تسجيل ملاحظة دعم", "Create support note")}</h3><div className="dn-section-form"><label><span>{t(isArabic, "نوع المشكلة", "Issue type")}</span><select value={draft.issueType} onChange={(e) => setDraft((v) => ({ ...v, issueType: e.target.value }))}><option value="database">{issueLabel("database", isArabic)}</option><option value="ui">{issueLabel("ui", isArabic)}</option><option value="finance">{issueLabel("finance", isArabic)}</option><option value="orders">{issueLabel("orders", isArabic)}</option><option value="merchants">{issueLabel("merchants", isArabic)}</option><option value="deployment">{issueLabel("deployment", isArabic)}</option><option value="other">{issueLabel("other", isArabic)}</option></select></label><label><span>{t(isArabic, "الأولوية", "Priority")}</span><select value={draft.priority} onChange={(e) => setDraft((v) => ({ ...v, priority: e.target.value }))}><option value="low">{priorityLabel("low", isArabic)}</option><option value="normal">{priorityLabel("normal", isArabic)}</option><option value="high">{priorityLabel("high", isArabic)}</option><option value="critical">{priorityLabel("critical", isArabic)}</option></select></label><label><span>{t(isArabic, "القسم المتأثر", "Affected page")}</span><input value={draft.affectedPage} onChange={(e) => setDraft((v) => ({ ...v, affectedPage: e.target.value }))} /></label><label><span>{t(isArabic, "الوصف", "Description")}</span><textarea value={draft.description} onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))} placeholder={t(isArabic, "اكتب المشكلة بوضوح...", "Describe the issue clearly...")} /></label><label><span>{t(isArabic, "ملاحظة الإدارة", "Admin note")}</span><textarea value={draft.adminNote} onChange={(e) => setDraft((v) => ({ ...v, adminNote: e.target.value }))} /></label></div><button type="button" onClick={() => void saveSupportNote()}><Plus className="h-4 w-4" />{t(isArabic, "حفظ الملاحظة", "Save note")}</button>{saved && <p className="dn-clean-note">{t(isArabic, "تم الحفظ.", "Saved.")}</p>}</article>
      <article><h3><ShieldCheck />{t(isArabic, "إجراءات سريعة", "Quick actions")}</h3><div className="dn-action-grid"><button onClick={() => onNavigate?.("database_health")}>{t(isArabic, "فحص قاعدة البيانات", "Database health")}</button><button onClick={() => onNavigate?.("production_readiness")}>{t(isArabic, "جاهزية الإنتاج", "Production readiness")}</button><button onClick={() => onNavigate?.("settings")}>{t(isArabic, "الإعدادات", "Settings")}</button><button onClick={() => onNavigate?.("finance_dashboard")}>{t(isArabic, "لوحة المالية", "Finance dashboard")}</button></div><pre className="dn-clean-note whitespace-pre-wrap">{diagnostics}</pre></article>
    </div>
    <article className="dn-section-table-card"><h3><Headphones />{t(isArabic, "سجل ملاحظات الدعم", "Support notes log")}</h3><div className="dn-section-table-wrap"><table><thead><tr><th>{t(isArabic, "التاريخ", "Date")}</th><th>{t(isArabic, "النوع", "Type")}</th><th>{t(isArabic, "الأولوية", "Priority")}</th><th>{t(isArabic, "القسم", "Page")}</th><th>{t(isArabic, "الملاحظة", "Note")}</th></tr></thead><tbody>{supportRows.map((row) => <tr key={String(row.id || row.created_at)}><td>{rowDate(row)}</td><td>{issueLabel(rowText(row, "issueType"), isArabic)}</td><td>{priorityLabel(rowText(row, "priority"), isArabic)}</td><td>{rowText(row, "affectedPage")}</td><td>{rowText(row, "description")}</td></tr>)}</tbody></table>{!supportRows.length && <div className="dn-empty-state"><Headphones className="h-5 w-5" />{t(isArabic, "لا توجد ملاحظات دعم محفوظة حالياً.", "No support notes saved yet.")}</div>}</div></article>
  </section>;
}
