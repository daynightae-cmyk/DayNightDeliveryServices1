import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw, ShieldAlert } from "lucide-react";
import type { Merchant, Order } from "../../types";
import { addAdminNotification } from "../../lib/adminAudio";
import { markCodReconciled, type FinanceRow, type FinanceSummary, type FinanceSummarySource } from "../../lib/adminData";
import {
  fetchProductionCodRows,
  fetchProductionFinanceSummary,
  fetchProductionRows,
  fetchProductionStatementSummary,
  rowBalance,
  rowCredit,
  rowDate,
  rowDebit,
  rowNotes,
  rowReference,
  rowType,
  type AdminProductionRowsResult,
  type AdminProductionSource,
} from "../../lib/adminProductionData";
import AdminPdfExportButton from "./AdminPdfExportButton";

const money = (value: unknown) => `${Number(value || 0).toFixed(2)} AED`;
const text = (ar: boolean, a: string, e: string) => ar ? a : e;

function sourceLabel(source?: AdminProductionSource | FinanceSummarySource | string) {
  if (source === "db" || source === "rpc" || source === "view") return "DB-backed";
  return "DB unavailable";
}

function simplePdf(isArabic: boolean, title: string, source: string, totals: Record<string, string>, rows: FinanceRow[], warnings: string[] = []) {
  return {
    language: isArabic ? "ar" as const : "en" as const,
    sectionTitle: `DAY NIGHT · ${title}`,
    filters: `${text(isArabic, "تاريخ الإنشاء", "Generated")}: ${new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE")} | ${text(isArabic, "مصدر البيانات", "Source")}: ${source}${warnings.length ? ` | ${warnings.join(" | ")}` : ""}`,
    totals,
    columns: [
      { key: "date", label: text(isArabic, "التاريخ", "Date") },
      { key: "tracking", label: text(isArabic, "التتبع", "Tracking") },
      { key: "type", label: text(isArabic, "النوع", "Type") },
      { key: "debit", label: text(isArabic, "مدين", "Debit") },
      { key: "credit", label: text(isArabic, "دائن", "Credit") },
      { key: "balance", label: text(isArabic, "الرصيد", "Balance") },
      { key: "notes", label: text(isArabic, "ملاحظات", "Notes") },
    ],
    rows: rows.slice(0, 60).map((row) => ({
      date: rowDate(row),
      tracking: rowReference(row),
      type: rowType(row),
      debit: money(rowDebit(row)),
      credit: money(rowCredit(row)),
      balance: money(rowBalance(row)),
      notes: rowNotes(row),
    })),
  };
}

type Props = {
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  financeSummarySource: FinanceSummarySource;
  onRefresh: () => Promise<void>;
  onNavigate: (id: string) => void;
};

type CodRowsResult = Awaited<ReturnType<typeof fetchProductionCodRows>>;
type StatementRowsResult = Awaited<ReturnType<typeof fetchProductionStatementSummary>>;

function emptyRowsResult(table: string): AdminProductionRowsResult {
  return { rows: [], source: "unavailable", table, synced: false, message: "Not loaded yet." };
}

export default function AdminFinanceOperationsCenter({ isArabic, orders, merchants, financeSummary, financeSummarySource, onRefresh, onNavigate }: Props) {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [summarySource, setSummarySource] = useState<AdminProductionSource>("unavailable");
  const [cod, setCod] = useState<CodRowsResult | null>(null);
  const [merchant, setMerchant] = useState<StatementRowsResult | null>(null);
  const [driver, setDriver] = useState<StatementRowsResult | null>(null);
  const [expenses, setExpenses] = useState<AdminProductionRowsResult>(() => emptyRowsResult("admin_expenses"));
  const [adjustments, setAdjustments] = useState<AdminProductionRowsResult>(() => emptyRowsResult("admin_adjustments"));
  const [audit, setAudit] = useState<AdminProductionRowsResult>(() => emptyRowsResult("admin_audit_events"));
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    setNotice("");
    const [financeResult, codResult, merchantResult, driverResult, expensesResult, adjustmentsResult, auditResult] = await Promise.all([
      fetchProductionFinanceSummary(),
      fetchProductionCodRows(),
      fetchProductionStatementSummary("merchant"),
      fetchProductionStatementSummary("driver"),
      fetchProductionRows("expenses"),
      fetchProductionRows("adjustments"),
      fetchProductionRows("audit_log"),
    ]);

    const parentIsDbBacked = financeSummarySource === "rpc" || financeSummarySource === "view";
    setSummary(financeResult.summary || (parentIsDbBacked ? financeSummary : null));
    setSummarySource(financeResult.source === "db" || parentIsDbBacked ? "db" : "unavailable");
    setCod(codResult);
    setMerchant(merchantResult);
    setDriver(driverResult);
    setExpenses(expensesResult);
    setAdjustments(adjustmentsResult);
    setAudit(auditResult);
    setLoading(false);
  }

  useEffect(() => { void reload(); }, []);

  const activeSummary = summary;
  const dbBlocked = summarySource !== "db";
  const topCod = (cod?.rows || []).filter((row) => Math.max(0, Number(row.cod_amount || row.amount || row.credit || 0) - Number(row.reconciled_amount || row.collected_amount || 0)) > 0).slice(0, 6);
  const pendingCod = cod?.pending || activeSummary?.cod_pending || 0;
  const draftExpenses = expenses.rows.filter((row) => !/approved|void/.test(String(row.status || "draft"))).length;
  const approvedExpenseTotal = expenses.rows.filter((row) => /approved/.test(String(row.status))).reduce((sum, row) => sum + Number(row.amount || row.total || rowDebit(row)), 0);
  const pendingAdjustments = adjustments.rows.filter((row) => !/approved|void/.test(String(row.status || "draft"))).length;
  const approvedAdjustmentNet = adjustments.rows.filter((row) => /approved/.test(String(row.status))).reduce((sum, row) => sum + (String(row.direction) === "negative" ? -Number(row.amount || 0) : Number(row.amount || 0)), 0);
  const payout = useMemo(() => {
    const codBlocked = Number(pendingCod || 0) > 0;
    const merchantReady = !dbBlocked && !codBlocked && (merchant?.source === "db");
    const driverReady = !dbBlocked && !codBlocked && (driver?.source === "db");
    return { merchant: merchantReady ? "ready" : codBlocked ? "cod" : dbBlocked ? "db" : "review", driver: driverReady ? "ready" : codBlocked ? "cod" : dbBlocked ? "db" : "review", blocked: !merchantReady || !driverReady };
  }, [dbBlocked, driver?.source, merchant?.source, pendingCod]);

  useEffect(() => {
    if (!cod) return;
    if (cod.pending > 0) addAdminNotification({ type: "cod", sectionId: "finance_dashboard", priority: "high", dedupeKey: `finance-cod-db-${Math.round(cod.pending)}`, audioEvent: "cod_alert", titleAr: "COD يحتاج تسوية", titleEn: "COD needs reconciliation", bodyAr: `COD معلق ${money(cod.pending)}.`, bodyEn: `Pending COD is ${money(cod.pending)}.` });
    if (dbBlocked) addAdminNotification({ type: "warning", sectionId: "finance_dashboard", priority: "high", dedupeKey: "finance-source-db-unavailable", audioEvent: "warning", titleAr: "المالية غير متصلة بالكامل", titleEn: "Finance DB unavailable", bodyAr: "لن يتم عرض أرقام وهمية. طبّق migration وتحقق من RLS.", bodyEn: "No fake figures are displayed. Apply migration and verify RLS." });
    if (payout.blocked) addAdminNotification({ type: "warning", sectionId: "finance_dashboard", priority: "high", dedupeKey: `finance-payout-${payout.merchant}-${payout.driver}`, audioEvent: "warning", titleAr: "الصرف موقوف للمراجعة", titleEn: "Payout blocked for review", bodyAr: "راجع COD والدفتر قبل الصرف.", bodyEn: "Review COD and ledger before payout." });
    if (!payout.blocked && !dbBlocked) addAdminNotification({ type: "success", sectionId: "finance_dashboard", dedupeKey: "finance-ready-db", audioEvent: "success", titleAr: "المالية متصلة بالإنتاج", titleEn: "Finance is DB-backed", bodyAr: "الفحوصات المالية الأساسية مرتبطة بقاعدة البيانات.", bodyEn: "Core finance checks are database-backed." });
  }, [cod, dbBlocked, payout]);

  const statusText = (value: string) => value === "ready"
    ? text(isArabic, "جاهز للصرف", "Ready for payout")
    : value === "cod"
      ? text(isArabic, "موقوف بسبب COD", "Blocked by COD")
      : value === "db"
        ? text(isArabic, "موقوف بسبب قاعدة البيانات", "Blocked by database")
        : text(isArabic, "يحتاج مراجعة", "Needs review");

  const cards = [
    [text(isArabic, "إجمالي الدخل", "Total income"), money(activeSummary?.total_income)],
    [text(isArabic, "إجمالي المصروفات", "Total expenses"), money(activeSummary?.total_expenses)],
    [text(isArabic, "COD محصل", "COD collected"), money(cod?.collected ?? activeSummary?.cod_collected)],
    [text(isArabic, "COD معلق", "Pending COD"), money(pendingCod)],
    [text(isArabic, "مستحقات التجار", "Merchant payable"), money(merchant?.balance ?? activeSummary?.merchant_payable)],
    [text(isArabic, "مستحقات المناديب", "Driver payable"), money(driver?.balance ?? activeSummary?.driver_payable)],
    [text(isArabic, "صافي فعلي", "Actual net"), money(activeSummary?.net_estimate)],
    [text(isArabic, "مصدر البيانات", "Data source"), sourceLabel(summarySource)],
  ];

  const warnings = [
    dbBlocked && text(isArabic, "قاعدة البيانات غير مكتملة لهذا المركز. لن يتم عرض بدائل وهمية أو أرقام مشتقة كأنها إنتاج.", "Database is incomplete for this center. No fake or derived alternatives are shown as production."),
    cod?.message,
    merchant?.message,
    driver?.message,
    expenses.message,
    adjustments.message,
    audit.message,
  ].filter(Boolean) as string[];

  const allRows = [
    ...(cod?.rows || []),
    ...(merchant?.rows || []),
    ...(driver?.rows || []),
    ...expenses.rows,
    ...adjustments.rows,
    ...audit.rows,
  ];

  async function doReconcile() {
    const first = topCod[0];
    if (!first?.id || cod?.source !== "db") return;
    await markCodReconciled(String(first.id), "Reconciled from Finance Operations Center");
    setNotice(text(isArabic, "تمت تسوية COD وتسجيلها في قاعدة البيانات.", "COD reconciliation saved to the database."));
    await reload();
    await onRefresh();
  }

  return (
    <section className="dn-section-workspace dn-finance-ops-grid">
      <header className="dn-section-hero">
        <div>
          <span>DAY NIGHT · {text(isArabic, "إنتاج متصل بقاعدة البيانات", "Production DB-backed")}</span>
          <h1>{text(isArabic, "مركز المالية والتسويات", "Finance & Reconciliation Center")}</h1>
          <p>{text(isArabic, "لا يتم عرض أرقام وهمية. عند غياب الجداول أو الصلاحيات تظهر حالة عدم اتصال واضحة.", "No fake figures are displayed. Missing tables or permissions show a clear unavailable state.")}</p>
        </div>
        <div className="dn-section-hero-actions">
          <button onClick={() => void reload()}><RefreshCw className="h-4 w-4" />{loading ? text(isArabic, "تحميل", "Loading") : text(isArabic, "تحديث", "Refresh")}</button>
          <AdminPdfExportButton label={text(isArabic, "تصدير المالية PDF", "Finance PDF")} payload={simplePdf(isArabic, text(isArabic, "نظرة مالية", "Finance overview"), sourceLabel(summarySource), Object.fromEntries(cards), allRows, warnings)} />
        </div>
      </header>

      {warnings.map((warning) => <article className="dn-admin-support-card dn-finance-warning" key={warning}><ShieldAlert className="inline h-4 w-4" /> {warning}</article>)}
      {notice && <article className="dn-admin-support-card dn-finance-warning"><CheckCircle2 className="inline h-4 w-4" /> {notice}</article>}

      <div className="dn-section-kpis">
        {cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{sourceLabel(summarySource)}</small></article>)}
      </div>

      <section className="dn-admin-section-panels dn-finance-panels">
        <article className="dn-finance-panel">
          <h2>{text(isArabic, "تسوية COD", "COD reconciliation")}</h2>
          <p>{text(isArabic, "COD معلق", "Pending COD")}: <b>{money(pendingCod)}</b> · {sourceLabel(cod?.source)}</p>
          <div className="dn-section-hero-actions dn-finance-action-row">
            <button onClick={() => onNavigate("cod")}>{text(isArabic, "فتح التحصيل COD", "Open COD collections")}</button>
            <AdminPdfExportButton label={text(isArabic, "تصدير COD PDF", "Export COD PDF")} payload={simplePdf(isArabic, "COD", sourceLabel(cod?.source), { pending: money(pendingCod), collected: money(cod?.collected), reconciled: money(cod?.reconciled) }, cod?.rows || [], warnings)} />
            <button disabled={cod?.source !== "db" || !topCod.length} onClick={() => void doReconcile()}>{text(isArabic, "تسوية أول عملية معلقة", "Reconcile first pending")}</button>
          </div>
          {cod?.source !== "db" && <p><AlertTriangle className="inline h-4 w-4" /> {text(isArabic, "لا يمكن تنفيذ التسوية قبل اتصال cod_collections.", "Real reconciliation is disabled until cod_collections is connected.")}</p>}
          <ul>{topCod.map((row) => <li key={String(row.id || rowReference(row))}>{rowReference(row)} — {money(rowBalance(row) || rowCredit(row))} — {String(row.status || "pending")}</li>)}</ul>
        </article>

        <article className="dn-finance-panel">
          <h2>{text(isArabic, "كشوفات التجار", "Merchant statements")}</h2>
          <p>{text(isArabic, "مستحقات التجار", "Merchant payable")}: <b>{money(merchant?.balance)}</b> · {sourceLabel(merchant?.source)}</p>
          <p>{text(isArabic, "المصدر: merchant_statement_entries فقط.", "Source: merchant_statement_entries only.")}</p>
          <button onClick={() => onNavigate("merchant_statements")}>{text(isArabic, "فتح كشوفات التجار", "Open merchant statements")}</button>
          <AdminPdfExportButton label="PDF" payload={simplePdf(isArabic, text(isArabic, "كشوفات التجار", "Merchant statements"), sourceLabel(merchant?.source), { balance: money(merchant?.balance), credit: money(merchant?.credit), debit: money(merchant?.debit) }, merchant?.rows || [], warnings)} />
        </article>

        <article className="dn-finance-panel">
          <h2>{text(isArabic, "كشوفات المناديب", "Driver statements")}</h2>
          <p>{text(isArabic, "مستحقات المناديب", "Driver payable")}: <b>{money(driver?.balance)}</b> · {sourceLabel(driver?.source)}</p>
          <p>{text(isArabic, "المصدر: driver_statement_entries فقط.", "Source: driver_statement_entries only.")}</p>
          <button onClick={() => onNavigate("driver_statements")}>{text(isArabic, "فتح كشوفات المناديب", "Open driver statements")}</button>
          <AdminPdfExportButton label="PDF" payload={simplePdf(isArabic, text(isArabic, "كشوفات المناديب", "Driver statements"), sourceLabel(driver?.source), { balance: money(driver?.balance), credit: money(driver?.credit), debit: money(driver?.debit) }, driver?.rows || [], warnings)} />
        </article>

        <article className="dn-finance-panel">
          <h2>{text(isArabic, "اعتماد المصروفات والتسويات", "Expenses & adjustments approval")}</h2>
          <p>{text(isArabic, "مصروفات قيد الاعتماد", "Pending expenses")}: {draftExpenses} · {money(approvedExpenseTotal)}</p>
          <p>{text(isArabic, "تسويات قيد الاعتماد", "Pending adjustments")}: {pendingAdjustments} · {money(approvedAdjustmentNet)}</p>
          <button onClick={() => onNavigate("expenses")}>{text(isArabic, "فتح المصروفات", "Open expenses")}</button>
          <button onClick={() => onNavigate("adjustments")}>{text(isArabic, "فتح التسويات", "Open adjustments")}</button>
        </article>

        <article className="dn-finance-panel">
          <h2>{text(isArabic, "جاهزية الصرف", "Payout readiness")}</h2>
          <p>{text(isArabic, "التجار", "Merchants")}: <b>{statusText(payout.merchant)}</b></p>
          <p>{text(isArabic, "المناديب", "Drivers")}: <b>{statusText(payout.driver)}</b></p>
          <p>{payout.blocked ? text(isArabic, "الصرف موقوف حتى اكتمال COD والدفتر.", "Payout remains blocked until COD and ledger are complete.") : text(isArabic, "جاهز للمراجعة النهائية.", "Ready for final review.")}</p>
        </article>

        <article className="dn-finance-panel">
          <h2>{text(isArabic, "سجل التدقيق المالي", "Finance audit trail")}</h2>
          <p>{text(isArabic, "آخر العمليات", "Recent events")}: {audit.rows.length} · {sourceLabel(audit.source)}</p>
          <button onClick={() => onNavigate("audit_log")}>{text(isArabic, "فتح سجل التدقيق", "Open audit log")}</button>
          <ul>{audit.rows.slice(0, 5).map((row) => <li key={String(row.id || row.created_at)}><Database className="inline h-3.5 w-3.5" /> {rowType(row)} — {rowReference(row)}</li>)}</ul>
        </article>
      </section>
    </section>
  );
}
