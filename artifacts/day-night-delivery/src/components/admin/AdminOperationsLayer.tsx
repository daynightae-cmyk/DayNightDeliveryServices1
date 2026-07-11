import { useEffect, useMemo, useState } from "react";
import { Database, Printer, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import {
  approveAdjustment,
  approveExpense,
  commitValidImportRows,
  createAdjustment,
  createExpense,
  createImportBatch,
  createPrintJob,
  markPrintJobPrinted,
  saveImportPreviewRows,
  validateImportRows,
  voidAdjustment,
  voidExpense,
  type FinanceRow,
} from "../../lib/adminData";
import {
  fetchProductionRows,
  productionTableForSection,
  rowBalance,
  rowCredit,
  rowDate,
  rowDebit,
  rowNotes,
  rowReference,
  rowType,
  summarizeRows,
  syncAdminProductionRows,
  type AdminProductionFilters,
  type AdminProductionSource,
} from "../../lib/adminProductionData";
import { actionLabel, fieldLabel, financeTypeLabel } from "../../data/adminTranslations";
import { addAdminNotification } from "../../lib/adminAudio";
import type { Merchant, Order } from "../../types";
import "../../styles/dn-admin-ops-layer.css";

type Props = {
  id: string;
  title: string;
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  onRefresh: () => Promise<void>;
};

const inputClass = "rounded-xl border border-white/10 bg-brand-deep/70 px-3 py-2 text-sm font-bold text-white outline-none";

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function parseCsv(text: string): Record<string, string>[] {
  const [head = "", ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = head.split(",").map((header) => header.trim());

  return lines.map((line) => Object.fromEntries(line.split(",").map((cell, index) => [headers[index] || `field_${index}`, cell.trim()])));
}

function sourceText(source: AdminProductionSource, isArabic: boolean, table: string) {
  if (source === "db") return isArabic ? `مصدر فعلي: ${table}` : `Real source: ${table}`;
  return isArabic ? `غير متصل بقاعدة البيانات: ${table}` : `Database unavailable: ${table}`;
}

function tablePdf(isArabic: boolean, title: string, source: string, rows: FinanceRow[]) {
  return {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: title,
    filters: `${isArabic ? "مصدر البيانات" : "Data source"}: ${source}`,
    totals: {
      rows: rows.length,
      debit: money(rows.reduce((sum, row) => sum + rowDebit(row), 0)),
      credit: money(rows.reduce((sum, row) => sum + rowCredit(row), 0)),
      balance: money(rows.reduce((sum, row) => sum + rowBalance(row), 0)),
    },
    columns: ["date", "tracking", "type", "debit", "credit", "balance", "notes"].map((key) => ({ key, label: fieldLabel(key, isArabic) })),
    rows: rows.map((row) => ({
      date: rowDate(row),
      tracking: rowReference(row),
      type: financeTypeLabel(rowType(row), isArabic),
      debit: money(rowDebit(row)),
      credit: money(rowCredit(row)),
      balance: money(rowBalance(row)),
      notes: rowNotes(row),
    })),
  };
}

export default function AdminOperationsLayer({ id, title, isArabic, orders, merchants, onRefresh }: Props) {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<AdminProductionSource>("unavailable");
  const [tableName, setTableName] = useState(productionTableForSection(id).table);
  const [merchantId, setMerchantId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [codOnly, setCodOnly] = useState(false);
  const [expense, setExpense] = useState({
    amount: "",
    category: "fuel",
    payment_method: "cash",
    expense_date: new Date().toISOString().slice(0, 10),
    reference_number: "",
    notes: "",
    status: "draft",
  });
  const [adjustment, setAdjustment] = useState({
    adjustment_type: "manual_finance_adjustment",
    direction: "positive" as "positive" | "negative",
    amount: "",
    reason: "",
    notes: "",
  });
  const [csvPreview, setCsvPreview] = useState<ReturnType<typeof validateImportRows>>([]);
  const [lastBatchId, setLastBatchId] = useState("");

  const filters: AdminProductionFilters = { merchantId, driverId, dateFrom, dateTo, status };

  async function load() {
    setBusy(true);
    setMessage("");

    try {
      const result = await fetchProductionRows(id, filters);
      const normalized = result.rows.map((row) => ({
        ...row,
        debit: rowDebit(row),
        credit: rowCredit(row),
        balance: rowBalance(row),
      }));
      const visibleRows = codOnly ? normalized.filter((row) => rowDebit(row) + rowCredit(row) + rowBalance(row) > 0) : normalized;
      setRows(visibleRows);
      setSource(result.source);
      setTableName(result.table);

      if (result.message) setMessage(result.message);
      if (result.source === "db" && result.synced) {
        setMessage(isArabic ? "تمت مزامنة الفروع التشغيلية من قاعدة البيانات الحقيقية." : "Operational branches synced from the real database.");
      }

      if (id === "print" && visibleRows.length > 0) {
        addAdminNotification({
          type: "print",
          sectionId: "print",
          priority: "normal",
          dedupeKey: `ops-print-db:${visibleRows.length}`,
          audioEvent: "print_ready",
          titleAr: "طابور طباعة حقيقي",
          titleEn: "Real print queue",
          bodyAr: `يوجد ${visibleRows.length} مهمة طباعة محفوظة في قاعدة البيانات.`,
          bodyEn: `${visibleRows.length} print jobs are saved in the database.`,
        });
      }
    } catch (error) {
      console.warn("Admin DB operation load failed:", (error as Error)?.message || error);
      setRows([]);
      setSource("unavailable");
      setMessage(isArabic ? "فشل الاتصال بجدول الإنتاج الحقيقي. لا يتم عرض صفوف وهمية." : "Real production table failed to load. No fake rows are displayed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const totals = useMemo(() => summarizeRows(rows), [rows]);
  const dataSourceText = sourceText(source, isArabic, tableName);

  async function submitExpense() {
    if (!expense.amount || Number(expense.amount) <= 0 || !expense.category || !expense.expense_date) {
      setMessage(isArabic ? "المبلغ والتصنيف والتاريخ مطلوبة." : "Amount, category, and date are required.");
      return;
    }

    await createExpense(expense);
    setMessage(isArabic ? "تم حفظ المصروف في قاعدة البيانات." : "Expense saved to the database.");
    await load();
    await onRefresh();
  }

  async function submitAdjustment() {
    if (!adjustment.amount || Number(adjustment.amount) <= 0 || !adjustment.reason) {
      setMessage(isArabic ? "المبلغ والسبب مطلوبان." : "Amount and reason are required.");
      return;
    }

    await createAdjustment({ ...adjustment, merchant_id: merchantId || undefined, driver_id: driverId || undefined });
    setMessage(isArabic ? "تم إنشاء التسوية في قاعدة البيانات." : "Adjustment saved to the database.");
    await load();
    await onRefresh();
  }

  async function handleCsv(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage(isArabic ? "CSV مدعوم الآن. لا يتم إنشاء صفوف وهمية من XLSX." : "CSV is supported now. No fake XLSX rows are created.");
      return;
    }

    const parsed = parseCsv(await file.text());
    const validation = validateImportRows(parsed, merchantId || undefined);
    setCsvPreview(validation);

    const batch = await createImportBatch({
      merchant_id: merchantId || undefined,
      file_name: file.name,
      import_mode: "database_preview",
      total_rows: validation.length,
      valid_rows: validation.filter((row) => row.status === "valid").length,
      invalid_rows: validation.filter((row) => row.status === "invalid").length,
    });

    setLastBatchId(String(batch.id || ""));
    await saveImportPreviewRows(String(batch.id), validation);
    setMessage(isArabic ? "تم حفظ معاينة الاستيراد كصفوف حقيقية في قاعدة البيانات." : "Import preview rows were saved as real database rows.");
  }

  async function makePrintJob() {
    const selected = orders.slice(0, 25).map((order) => order.id).filter(Boolean);
    if (!selected.length) {
      setMessage(isArabic ? "لا توجد طلبات حقيقية لإنشاء مهمة طباعة." : "No real orders are available for a print job.");
      return;
    }

    await createPrintJob({
      job_type: "invoice",
      language: isArabic ? "ar" : "en",
      order_ids: selected,
      merchant_id: merchantId || undefined,
      filters,
      pdf_payload: tablePdf(isArabic, title, dataSourceText, rows),
    });
    setMessage(isArabic ? "تم إنشاء مهمة الطباعة في قاعدة البيانات." : "Print job saved to the database.");
    addAdminNotification({
      type: "success",
      sectionId: "print",
      priority: "normal",
      dedupeKey: `print-job-db:${Date.now()}`,
      audioEvent: "success",
      titleAr: "تم إنشاء مهمة الطباعة",
      titleEn: "Print job created",
      bodyAr: "تم حفظ مهمة الطباعة في قاعدة البيانات.",
      bodyEn: "The print job was saved in the database.",
      dedupeMs: 1000,
    });
    await load();
  }

  async function approveFirst() {
    const firstId = rows[0]?.id;
    if (!firstId || (id !== "expenses" && id !== "adjustments")) {
      setMessage(isArabic ? "الاعتماد الإنتاجي متاح للمصروفات والتسويات ذات الصفوف المحفوظة فقط." : "Production approval is available only for saved expenses and adjustments.");
      return;
    }

    await (id === "expenses" ? approveExpense(String(firstId)) : approveAdjustment(String(firstId)));
    setMessage(isArabic ? "تم الاعتماد في قاعدة البيانات." : "Approved in the database.");
    await load();
  }

  async function voidFirst() {
    const firstId = rows[0]?.id;
    if (!firstId || (id !== "expenses" && id !== "adjustments")) {
      setMessage(isArabic ? "الإلغاء الإنتاجي متاح للمصروفات والتسويات ذات الصفوف المحفوظة فقط." : "Production voiding is available only for saved expenses and adjustments.");
      return;
    }

    await (id === "expenses" ? voidExpense(String(firstId), "Voided from admin") : voidAdjustment(String(firstId), "Voided from admin"));
    setMessage(isArabic ? "تم الإلغاء في قاعدة البيانات." : "Voided in the database.");
    await load();
  }

  async function runSync() {
    const sync = await syncAdminProductionRows();
    setMessage(sync.ok
      ? (isArabic ? "تمت مزامنة صفوف COD والكشوفات من الطلبات الحقيقية." : "COD and statement rows synced from real orders.")
      : sync.message || (isArabic ? "فشلت المزامنة." : "Sync failed."));
    await load();
  }

  return (
    <section className="dn-ops-layer" dir={isArabic ? "rtl" : "ltr"}>
      <header>
        <div>
          <span>{isArabic ? "طبقة إنتاج مرتبطة بقاعدة البيانات" : "Production DB-backed layer"}</span>
          <h1>{title}</h1>
          <p>{isArabic ? "كل الصفوف هنا من جداول Supabase أو عمليات محفوظة فقط. لا توجد صفوف وهمية أو derived UI rows." : "All rows here come from Supabase tables or saved operations only. No fake or UI-derived rows are displayed."}</p>
        </div>
        <AdminPdfExportButton payload={tablePdf(isArabic, title, dataSourceText, rows)} />
      </header>

      <div className={`dn-ops-message ${source === "db" ? "is-db" : "is-warning"}`}>
        <Database className="inline h-4 w-4" /> {dataSourceText}
        {message ? ` · ${message}` : ""}
      </div>

      <div className="dn-ops-filters">
        <select className={inputClass} value={merchantId} onChange={(event) => setMerchantId(event.target.value)}>
          <option value="">{isArabic ? "كل التجار" : "All merchants"}</option>
          {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id}</option>)}
        </select>
        <input className={inputClass} value={driverId} onChange={(event) => setDriverId(event.target.value)} placeholder={isArabic ? "معرف المندوب" : "Driver id"} />
        <input className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} placeholder={isArabic ? "الحالة" : "Status"} />
        <input className={inputClass} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input className={inputClass} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <label className="dn-ops-toggle"><input type="checkbox" checked={codOnly} onChange={(event) => setCodOnly(event.target.checked)} /> {fieldLabel("codOnly", isArabic)}</label>
        <button type="button" onClick={() => void load()}><RefreshCw className="inline h-4 w-4" /> {busy ? (isArabic ? "تحميل" : "Loading") : (isArabic ? "تحديث" : "Refresh")}</button>
        <button type="button" onClick={() => void runSync()}>{isArabic ? "مزامنة الإنتاج" : "Sync production"}</button>
      </div>

      <div className="dn-ops-kpis">
        <article><span>{isArabic ? "الصفوف" : "Rows"}</span><strong>{totals.count}</strong></article>
        <article><span>{isArabic ? "مدين" : "Debit"}</span><strong>{money(totals.debit)}</strong></article>
        <article><span>{isArabic ? "دائن/مبلغ" : "Credit/Amount"}</span><strong>{money(totals.credit)}</strong></article>
        <article><span>{isArabic ? "بانتظار إجراء" : "Pending"}</span><strong>{totals.pending}</strong></article>
      </div>

      {id === "expenses" && (
        <div className="dn-ops-form">
          <input className={inputClass} type="number" placeholder={fieldLabel("amount", isArabic)} value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} />
          <select className={inputClass} value={expense.category} onChange={(event) => setExpense({ ...expense, category: event.target.value })}>
            {["fuel", "driver", "maintenance", "tolls", "office", "software", "marketing", "rent", "salary", "telecom", "bank_fees", "other"].map((category) => <option key={category} value={category}>{financeTypeLabel(category, isArabic)}</option>)}
          </select>
          <input className={inputClass} type="date" value={expense.expense_date} onChange={(event) => setExpense({ ...expense, expense_date: event.target.value })} />
          <input className={inputClass} placeholder={fieldLabel("reference", isArabic)} value={expense.reference_number} onChange={(event) => setExpense({ ...expense, reference_number: event.target.value })} />
          <input className={inputClass} placeholder={fieldLabel("notes", isArabic)} value={expense.notes} onChange={(event) => setExpense({ ...expense, notes: event.target.value })} />
          <button type="button" onClick={() => void submitExpense()}>{actionLabel("addExpense", isArabic)}</button>
        </div>
      )}

      {id === "adjustments" && (
        <div className="dn-ops-form">
          <select className={inputClass} value={adjustment.adjustment_type} onChange={(event) => setAdjustment({ ...adjustment, adjustment_type: event.target.value })}>
            {["cod_correction", "merchant_correction", "driver_deduction", "refund", "payout_correction", "delivery_fee_correction", "manual_finance_adjustment"].map((type) => <option key={type} value={type}>{financeTypeLabel(type, isArabic)}</option>)}
          </select>
          <select className={inputClass} value={adjustment.direction} onChange={(event) => setAdjustment({ ...adjustment, direction: event.target.value === "negative" ? "negative" : "positive" })}>
            <option value="positive">{financeTypeLabel("positive", isArabic)}</option>
            <option value="negative">{financeTypeLabel("negative", isArabic)}</option>
          </select>
          <input className={inputClass} type="number" placeholder={fieldLabel("amount", isArabic)} value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} />
          <input className={inputClass} placeholder={isArabic ? "السبب" : "Reason"} value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} />
          <input className={inputClass} placeholder={fieldLabel("notes", isArabic)} value={adjustment.notes} onChange={(event) => setAdjustment({ ...adjustment, notes: event.target.value })} />
          <button type="button" onClick={() => void submitAdjustment()}>{actionLabel("createAdjustment", isArabic)}</button>
        </div>
      )}

      {id === "import" && (
        <div className="dn-ops-form">
          <input className={inputClass} type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && void handleCsv(event.target.files[0])} />
          <button type="button" disabled={!lastBatchId} onClick={async () => { const result = await commitValidImportRows(lastBatchId); setMessage(result.message); }}>{actionLabel("commitRows", isArabic)}</button>
          <span>{isArabic ? `صفوف معاينة محفوظة في DB: ${csvPreview.length}` : `Preview rows saved in DB: ${csvPreview.length}`}</span>
        </div>
      )}

      {id === "print" && (
        <div className="dn-ops-form">
          <button type="button" onClick={() => void makePrintJob()}>{isArabic ? "إنشاء مهمة طباعة من الطلبات" : "Create print job from orders"}</button>
          <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={tablePdf(isArabic, title, dataSourceText, rows)} />
          <button type="button" onClick={() => window.print()}>{isArabic ? "طباعة بوليصة" : "Print shipping label"}</button>
          <button type="button" onClick={() => window.print()}>{isArabic ? "طباعة فاتورة" : "Print invoice"}</button>
          <button type="button" onClick={() => window.print()}>{isArabic ? "طباعة كشف إحضار" : "Print pickup manifest"}</button>
          <button type="button" onClick={async () => { const first = rows[0]; if (first?.id) { await markPrintJobPrinted(String(first.id)); addAdminNotification({ type: "print", sectionId: "print", priority: "normal", dedupeKey: `print-done:${first.id}`, audioEvent: "print_done", titleAr: "تم تحديث حالة الطباعة", titleEn: "Print status updated", bodyAr: "تم تحديد مهمة الطباعة كمطبوعة.", bodyEn: "The print job was marked as printed." }); await load(); } else setMessage(isArabic ? "لا توجد مهمة طباعة محفوظة في قاعدة البيانات." : "No saved print job exists in the database."); }}>{isArabic ? "تحديد كمطبوع" : "Mark printed"}</button>
        </div>
      )}

      <div className="dn-ops-actions">
        <button type="button" onClick={() => void makePrintJob()}><Printer />{isArabic ? "طباعة/طابور" : "Print/queue"}</button>
        <button type="button" onClick={() => void approveFirst()}><ShieldCheck />{isArabic ? "اعتماد أول صف" : "Approve first"}</button>
        <button type="button" onClick={() => void voidFirst()}><WalletCards />{isArabic ? "إلغاء أول صف" : "Void first"}</button>
      </div>

      <div className="dn-ops-table">
        <table>
          <thead>
            <tr>
              <th>{isArabic ? "التاريخ" : "Date"}</th>
              <th>{isArabic ? "التتبع/الكيان" : "Tracking/entity"}</th>
              <th>{isArabic ? "النوع" : "Type"}</th>
              <th>{isArabic ? "مدين" : "Debit"}</th>
              <th>{isArabic ? "دائن" : "Credit"}</th>
              <th>{isArabic ? "الرصيد" : "Balance"}</th>
              <th>{isArabic ? "ملاحظات" : "Notes"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id || index)}>
                <td>{rowDate(row)}</td>
                <td>{rowReference(row)}</td>
                <td>{financeTypeLabel(rowType(row), isArabic)}</td>
                <td>{money(rowDebit(row))}</td>
                <td>{money(rowCredit(row))}</td>
                <td>{money(rowBalance(row))}</td>
                <td>{rowNotes(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <div className="dn-ops-empty">
            {source === "db"
              ? (isArabic ? "لا توجد صفوف محفوظة في جدول قاعدة البيانات لهذا القسم بعد." : "No saved database rows exist for this section yet.")
              : (isArabic ? "قاعدة البيانات غير متاحة لهذا القسم. لا يتم عرض صفوف وهمية." : "Database is unavailable for this section. No fake rows are displayed.")}
          </div>
        )}
      </div>
    </section>
  );
}
