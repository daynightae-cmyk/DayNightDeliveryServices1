import { useEffect, useMemo, useState } from "react";
import { Printer, ShieldCheck, WalletCards } from "lucide-react";
import AdminPdfExportButton from "./AdminPdfExportButton";
import {
  approveAdjustment,
  approveExpense,
  commitValidImportRows,
  createAdjustment,
  createExpense,
  createImportBatch,
  createPrintJob,
  deriveDriverStatementFromOrders,
  deriveMerchantStatementFromOrders,
  fetchAdjustments,
  fetchAdminAuditEvents,
  fetchCodCollections,
  fetchDriverStatementEntries,
  fetchExpenses,
  fetchMerchantStatementEntries,
  fetchPrintJobs,
  markPrintJobPrinted,
  saveImportPreviewRows,
  validateImportRows,
  voidAdjustment,
  voidExpense,
  type FinanceRow,
} from "../../lib/adminData";
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

type AdminFilters = {
  merchantId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const inputClass = "rounded-xl border border-white/10 bg-brand-deep/70 px-3 py-2 text-sm font-bold text-white outline-none";

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} AED`;
}

function cleanDate(value: unknown) {
  return String(value || new Date().toISOString()).slice(0, 10);
}

function rowNumber(row: FinanceRow, keys: string[]) {
  for (const key of keys) {
    const value = Number(row[key] || 0);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function rowDebit(row: FinanceRow) {
  return rowNumber(row, ["debit", "expense_amount"]);
}

function rowCredit(row: FinanceRow) {
  return rowNumber(row, ["credit", "amount", "cod_amount", "collected_amount", "delivery_fee", "payout_amount"]);
}

function rowBalance(row: FinanceRow) {
  return rowNumber(row, ["balance", "net_amount", "cod_amount", "collected_amount", "amount", "credit"]);
}

function rowDate(row: FinanceRow) {
  return String(row.entry_date || row.expense_date || row.collection_date || row.printed_at || cleanDate(row.created_at));
}

function rowReference(row: FinanceRow) {
  return String(row.tracking_number || row.reference_number || row.entity_id || row.order_id || row.id || "—");
}

function rowType(row: FinanceRow) {
  return String(row.entry_type || row.adjustment_type || row.job_type || row.category || row.action || row.status || "—");
}

function rowNotes(row: FinanceRow) {
  return String(row.notes || row.reason || row.entity_type || row.file_name || "—");
}

function parseCsv(text: string): Record<string, string>[] {
  const [head = "", ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = head.split(",").map((header) => header.trim());

  return lines.map((line) => Object.fromEntries(line.split(",").map((cell, index) => [headers[index] || `field_${index}`, cell.trim()])));
}


function printableRowsFromOrders(orders: Order[], isArabic: boolean): FinanceRow[] {
  return orders.map((order) => ({
    id: `derived-print-${order.id || order.tracking_number || order.invoice_number}`,
    order_id: order.id || order.tracking_number || order.invoice_number,
    tracking_number: order.tracking_number || order.invoice_number || order.id || "—",
    entry_date: String(order.created_at || order.updated_at || new Date().toISOString()).slice(0, 10),
    job_type: "invoice",
    debit: Number(order.delivery_price || order.price || order.base_price || 0),
    credit: Number(order.cod_amount || 0),
    balance: Number(order.cod_amount || 0) + Number(order.delivery_price || order.price || order.base_price || 0),
    status: "ready_from_orders",
    merchant_name: order.merchant_name || order.sender_name || "—",
    receiver_name: order.receiver_name || "—",
    city: order.receiver_city || order.sender_city || "—",
    document_type: isArabic ? "فاتورة" : "Invoice",
    print_status: isArabic ? "جاهز للطباعة من الطلبات" : "Ready to print from orders",
    notes: isArabic ? "جاهز للطباعة من الطلبات" : "Ready to print from orders",
    created_at: order.created_at || new Date().toISOString(),
  }));
}

function tablePdf(isArabic: boolean, title: string, rows: FinanceRow[]) {
  return {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: title,
    filters: isArabic ? "الفلاتر الحالية" : "Current filters",
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
  const [merchantId, setMerchantId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const filters: AdminFilters = { merchantId, driverId, dateFrom, dateTo };

  async function load() {
    setBusy(true);
    setMessage("");

    try {
      let data: FinanceRow[] = [];

      if (id === "expenses") data = await fetchExpenses(filters);
      else if (id === "adjustments") data = await fetchAdjustments(filters);
      else if (id === "audit_log") data = await fetchAdminAuditEvents(filters);
      else if (id === "print") {
        data = await fetchPrintJobs(filters);
        if (!data.length && orders.length) {
          data = printableRowsFromOrders(orders, isArabic);
          setMessage(isArabic ? "لا توجد مهام طباعة محفوظة، لكن توجد طلبات جاهزة لإنشاء فواتير." : "No saved print jobs, but orders are ready for invoices.");
        }
      }
      else if (id === "cod") {
        data = await fetchCodCollections(filters);
        if (!data.length) {
          data = orders
            .filter((order) => Number(order.cod_amount || 0) > 0)
            .map((order) => ({
              id: `derived-cod-${order.id || order.tracking_number || order.invoice_number}`,
              order_id: order.id,
              merchant_id: order.merchant_id,
              tracking_number: order.tracking_number || order.invoice_number,
              entry_date: String(order.created_at || new Date().toISOString()).slice(0, 10),
              entry_type: "pending",
              debit: 0,
              credit: Number(order.cod_amount || 0),
              balance: Number(order.cod_amount || 0),
              cod_amount: Number(order.cod_amount || 0),
              status: "pending",
              notes: isArabic ? "مشتق من الطلبات" : "Derived from orders",
              created_at: order.created_at,
            }));
        }
      } else if (id === "driver_statements") {
        data = await fetchDriverStatementEntries(filters);
        if (!data.length) data = deriveDriverStatementFromOrders(driverId || undefined, orders, filters);
      } else if (id === "merchant_statements") {
        data = await fetchMerchantStatementEntries(filters);
        if (!data.length) data = deriveMerchantStatementFromOrders(merchantId || undefined, orders, filters);
      } else if (id === "reports") {
        data = [
          ...(await fetchExpenses(filters)),
          ...(await fetchAdjustments(filters)),
          ...(await fetchPrintJobs(filters)),
        ];
      }

      const normalized = data.map((row) => ({
        ...row,
        debit: rowDebit(row),
        credit: rowCredit(row),
        balance: rowBalance(row),
      }));

      const visibleRows = codOnly ? normalized.filter((row) => rowDebit(row) + rowCredit(row) + rowBalance(row) > 0) : normalized;
      setRows(visibleRows);
      if (id === "print" && visibleRows.length > 0) addAdminNotification({ type: "print", sectionId: "print", priority: "normal", dedupeKey: `ops-print-ready:${visibleRows.length}`, audioEvent: "print_ready", titleAr: "فواتير جاهزة للطباعة", titleEn: "Invoices ready to print", bodyAr: `يوجد ${visibleRows.length} طلب يمكن إنشاء فواتير أو بوالص له.`, bodyEn: `${visibleRows.length} orders can generate invoices or labels.` });
    } catch (error) {
      console.warn("Admin operations layer load failed:", (error as Error)?.message || error);
      setMessage(isArabic ? "تعذر تحميل الجدول المتخصص؛ تم الحفاظ على الواجهة بدون عرض خطأ تقني." : "Specialized table could not be loaded; technical details were hidden.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, orders.length]);

  const totals = useMemo(
    () => ({
      count: rows.length,
      debit: rows.reduce((sum, row) => sum + rowDebit(row), 0),
      credit: rows.reduce((sum, row) => sum + rowCredit(row), 0),
      pending: rows.filter((row) => /draft|pending|queued/.test(String(row.status || ""))).length,
    }),
    [rows],
  );

  async function submitExpense() {
    if (!expense.amount || Number(expense.amount) <= 0 || !expense.category || !expense.expense_date) {
      setMessage(isArabic ? "المبلغ والتصنيف والتاريخ مطلوبة." : "Amount, category, and date are required.");
      return;
    }

    await createExpense(expense);
    setMessage(isArabic ? "تم حفظ المصروف كعملية حقيقية." : "Expense saved as a real operation.");
    await load();
    await onRefresh();
  }

  async function submitAdjustment() {
    if (!adjustment.amount || Number(adjustment.amount) <= 0 || !adjustment.reason) {
      setMessage(isArabic ? "المبلغ والسبب مطلوبان." : "Amount and reason are required.");
      return;
    }

    await createAdjustment({ ...adjustment, merchant_id: merchantId || undefined, driver_id: driverId || undefined });
    setMessage(isArabic ? "تم إنشاء التسوية." : "Adjustment created.");
    await load();
  }

  async function handleCsv(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage(isArabic ? "CSV مدعوم الآن؛ XLSX قيد الانتظار بوضوح." : "CSV is supported now; XLSX remains pending.");
      return;
    }

    const parsed = parseCsv(await file.text());
    const validation = validateImportRows(parsed, merchantId || undefined);
    setCsvPreview(validation);

    const batch = await createImportBatch({
      merchant_id: merchantId || undefined,
      file_name: file.name,
      import_mode: "preview",
      total_rows: validation.length,
      valid_rows: validation.filter((row) => row.status === "valid").length,
      invalid_rows: validation.filter((row) => row.status === "invalid").length,
    });

    setLastBatchId(String(batch.id || ""));
    await saveImportPreviewRows(String(batch.id), validation);
    setMessage(isArabic ? "تم حفظ معاينة الاستيراد فقط؛ لم يتم إنشاء طلبات بعد." : "Import preview saved only; no orders were created yet.");
  }

  async function makePrintJob() {
    const selected = orders.slice(0, 25).map((order) => order.id).filter(Boolean);
    try {
      await createPrintJob({
        job_type: "invoice",
        language: isArabic ? "ar" : "en",
        order_ids: selected,
        merchant_id: merchantId || undefined,
        filters,
        pdf_payload: tablePdf(isArabic, title, rows),
      });
      setMessage(isArabic ? "تم إنشاء مهمة الطباعة" : "Print job queued.");
      addAdminNotification({ type: "success", sectionId: "print", priority: "normal", dedupeKey: `print-job:${Date.now()}`, audioEvent: "success", titleAr: "تم إنشاء مهمة الطباعة", titleEn: "Print job created", bodyAr: "تم حفظ مهمة الطباعة في قاعدة البيانات.", bodyEn: "The print job was saved in the database.", dedupeMs: 1000 });
      await load();
    } catch (error) {
      console.warn("Print job save failed:", (error as Error)?.message || error);
      setMessage(isArabic ? "معاينة فقط — تعذر حفظ مهمة الطباعة في قاعدة البيانات." : "Preview only — could not save print job in the database.");
      addAdminNotification({ type: "warning", sectionId: "print", priority: "high", dedupeKey: "print-preview-only", audioEvent: "warning", titleAr: "معاينة فقط", titleEn: "Preview only", bodyAr: "لم يتم حفظ مهمة الطباعة في قاعدة البيانات.", bodyEn: "The print job was not saved in the database." });
    }
  }

  async function approveFirst() {
    const firstId = rows[0]?.id;
    if (!firstId || (id !== "expenses" && id !== "adjustments")) {
      setMessage(isArabic ? "الاعتماد الحقيقي متاح للمصروفات والتسويات فقط حالياً." : "Real approval is currently available for expenses and adjustments only.");
      return;
    }

    await (id === "expenses" ? approveExpense(String(firstId)) : approveAdjustment(String(firstId)));
    await load();
  }

  async function voidFirst() {
    const firstId = rows[0]?.id;
    if (!firstId || (id !== "expenses" && id !== "adjustments")) {
      setMessage(isArabic ? "الإلغاء الحقيقي متاح للمصروفات والتسويات فقط حالياً." : "Real voiding is currently available for expenses and adjustments only.");
      return;
    }

    await (id === "expenses" ? voidExpense(String(firstId), "Voided from admin") : voidAdjustment(String(firstId), "Voided from admin"));
    await load();
  }

  return (
    <section className="dn-ops-layer" dir={isArabic ? "rtl" : "ltr"}>
      <header>
        <div>
          <span>{isArabic ? "طبقة عمليات حقيقية" : "Real operations layer"}</span>
          <h1>{title}</h1>
          <p>{isArabic ? "كل إجراء يكتب إلى جداول Supabase الجديدة أو يوضح أنه معاينة فقط." : "Actions write to new Supabase tables or are clearly marked preview-only."}</p>
        </div>
        <AdminPdfExportButton payload={tablePdf(isArabic, title, rows)} />
      </header>

      {message && <div className="dn-ops-message">{message}</div>}

      <div className="dn-ops-filters">
        <select className={inputClass} value={merchantId} onChange={(event) => setMerchantId(event.target.value)}>
          <option value="">{isArabic ? "كل التجار" : "All merchants"}</option>
          {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id}</option>)}
        </select>
        <input className={inputClass} value={driverId} onChange={(event) => setDriverId(event.target.value)} placeholder={isArabic ? "معرف المندوب" : "Driver id"} />
        <input className={inputClass} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input className={inputClass} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <label className="dn-ops-toggle"><input type="checkbox" checked={codOnly} onChange={(event) => setCodOnly(event.target.checked)} /> {fieldLabel("codOnly", isArabic)}</label>
        <button type="button" onClick={() => void load()}>{busy ? (isArabic ? "تحميل" : "Loading") : (isArabic ? "تحديث" : "Refresh")}</button>
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
          <input className={inputClass} type="file" accept=".csv,.xlsx" onChange={(event) => event.target.files?.[0] && void handleCsv(event.target.files[0])} />
          <button type="button" disabled={!lastBatchId} onClick={async () => { const result = await commitValidImportRows(lastBatchId); setMessage(result.message); }}>{actionLabel("commitRows", isArabic)}</button>
          <span>{isArabic ? `معاينة الاستيراد: ${csvPreview.length} صف. لم يتم إنشاء طلبات قبل التأكيد.` : `Import preview: ${csvPreview.length} rows. No orders are created before confirmation.`}</span>
        </div>
      )}

      {id === "print" && (
        <div className="dn-ops-form">
          <button type="button" onClick={() => void makePrintJob()}>{isArabic ? "إنشاء مهمة طباعة" : "Create print job"}</button>
          <AdminPdfExportButton label={isArabic ? "تصدير PDF" : "Export PDF"} payload={tablePdf(isArabic, title, rows)} />
          <button type="button" onClick={() => window.print()}>{isArabic ? "طباعة بوليصة" : "Print shipping label"}</button>
          <button type="button" onClick={() => window.print()}>{isArabic ? "طباعة فاتورة" : "Print invoice"}</button>
          <button type="button" onClick={() => window.print()}>{isArabic ? "طباعة كشف إحضار" : "Print pickup manifest"}</button>
          <button type="button" onClick={async () => { const first = rows.find((row) => !String(row.id || "").startsWith("derived-print-")); if (first?.id) { await markPrintJobPrinted(String(first.id)); addAdminNotification({ type: "print", sectionId: "print", priority: "normal", dedupeKey: `print-done:${first.id}`, audioEvent: "print_done", titleAr: "تم تحديث حالة الطباعة", titleEn: "Print status updated", bodyAr: "تم تحديد مهمة الطباعة كمطبوعة.", bodyEn: "The print job was marked as printed." }); await load(); } else setMessage(isArabic ? "معاينة فقط — تعذر حفظ مهمة الطباعة في قاعدة البيانات." : "Preview only — could not save print job in the database."); }}>{isArabic ? "تحديد كمطبوع" : "Mark printed"}</button>
          <span>{isArabic ? "جاهز للطباعة من الطلبات" : "Ready to print from orders"}</span>
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
            {id === "print" ? (orders.length ? (isArabic ? "لا توجد مهام طباعة محفوظة، لكن توجد طلبات جاهزة لإنشاء فواتير." : "No saved print jobs, but orders are ready for invoices.") : (isArabic ? "لا توجد طلبات لإنشاء فواتير حالياً." : "No orders are available for invoices right now.")) : (isArabic ? "لا توجد بيانات محفوظة في هذا القسم حالياً. عند غياب الجداول المتخصصة يتم عرض مشتقات الطلبات حيثما أمكن." : "No saved data in this section right now. When specialized tables are missing, order-derived rows are shown where possible.")}
          </div>
        )}
      </div>
    </section>
  );
}
