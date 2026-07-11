import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import type { Merchant, Order } from "../../types";
import { addAdminNotification } from "../../lib/adminAudio";
import {
  approveAdjustment,
  approveExpense,
  createAdjustment,
  createExpense,
  createOrSyncCodCollectionFromOrder,
  deriveDriverStatementFromOrders,
  deriveMerchantStatementFromOrders,
  fetchAdjustments,
  fetchAdminAuditEvents,
  fetchCodCollections,
  fetchDriverStatementEntries,
  fetchExpenses,
  fetchMerchantStatementEntries,
  markCodCollected,
  markCodReconciled,
  voidAdjustment,
  voidExpense,
  type FinanceSummary,
  type FinanceSummarySource,
} from "../../lib/adminData";
import AdminPdfExportButton from "./AdminPdfExportButton";
import "../../styles/dn-admin-finance-suite.css";

type FinanceArea = "finance_dashboard" | "driver_statements" | "merchant_statements" | "income" | "cod" | "expenses" | "accounts" | "adjustments" | "audit_log";
type SourceKind = "production_table" | "live_orders" | "empty_table";
type Row = Record<string, any>;

type Props = {
  isArabic: boolean;
  activeSection?: FinanceArea;
  orders: Order[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  financeSummarySource: FinanceSummarySource;
  onRefresh: () => Promise<void>;
  onNavigate: (id: string) => void;
};

const order: FinanceArea[] = ["finance_dashboard", "driver_statements", "merchant_statements", "income", "cod", "expenses", "accounts", "adjustments", "audit_log"];
const money = (value: unknown) => `${Number(value || 0).toFixed(2)} AED`;
const tr = (ar: boolean, a: string, e: string) => (ar ? a : e);
const clean = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function isDelivered(item: Order) {
  return /deliver|complete|تم_التسليم/.test(clean(item.status).toLowerCase().replace(/[\s-]+/g, "_"));
}

function orderRef(item: Order) {
  return clean(item.tracking_number || item.invoice_number || item.coupon_number || item.id || "—");
}

function rowVal(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = num(row[key]);
    if (value !== 0) return value;
  }
  return 0;
}

const rowDebit = (row: Row) => rowVal(row, ["debit", "expense_amount", "amount_debit"]);
const rowCredit = (row: Row) => rowVal(row, ["credit", "amount_credit", "delivery_income", "delivery_fee", "cod_amount", "collected_amount", "amount"]);
const rowBalance = (row: Row) => rowVal(row, ["balance", "net_amount", "running_balance", "cod_amount", "amount", "credit"]);
const rowDate = (row: Row) => clean(row.entry_date || row.expense_date || row.collection_date || row.created_at || row.updated_at || new Date().toISOString()).slice(0, 10);
const rowRef = (row: Row) => clean(row.tracking_number || row.reference_number || row.invoice_number || row.order_id || row.entity_id || row.id || "—");
const rowType = (row: Row) => clean(row.entry_type || row.adjustment_type || row.category || row.action || row.status || row.payment_method || "—");
const rowNotes = (row: Row) => clean(row.notes || row.reason || row.file_name || row.source || "—");

function rowEntity(row: Row, merchants: Merchant[]) {
  const merchantId = clean(row.merchant_id);
  const merchant = merchants.find((item) => item.id === merchantId);
  return clean(merchant?.trade_name || row.merchant_name || row.driver_name || row.entity_type || row.entity_id || merchantId || "—");
}

function sumRows(rows: Row[]) {
  return {
    totalDebit: rows.reduce((sum, row) => sum + rowDebit(row), 0),
    totalCredit: rows.reduce((sum, row) => sum + rowCredit(row), 0),
    totalBalance: rows.reduce((sum, row) => sum + rowBalance(row), 0),
    count: rows.length,
  };
}

function sourceLabel(source: SourceKind, isArabic: boolean) {
  if (source === "production_table") return tr(isArabic, "جدول إنتاج حقيقي", "Production table");
  if (source === "live_orders") return tr(isArabic, "مبني من الطلبات الحية", "Built from live orders");
  return tr(isArabic, "جاهز بدون صفوف", "Ready with no rows");
}

function sourceTone(source: SourceKind) {
  if (source === "production_table") return "is-db";
  if (source === "live_orders") return "is-live";
  return "is-empty";
}

function makeIncomeRows(orders: Order[]): Row[] {
  return orders.map((item) => ({
    id: `income-${item.id}`,
    order_id: item.id,
    tracking_number: orderRef(item),
    entry_date: clean(item.created_at).slice(0, 10),
    entry_type: "delivery_income",
    debit: 0,
    credit: num(item.delivery_price || item.price || item.base_price),
    balance: num(item.delivery_price || item.price || item.base_price),
    merchant_id: item.merchant_id,
    merchant_name: item.merchant_name || item.sender_name,
    status: item.status,
    notes: `${item.sender_city || "—"} → ${item.receiver_city || item.destination_country || "—"}`,
    created_at: item.created_at,
  }));
}

function makeCodRows(orders: Order[]): Row[] {
  return orders.filter((item) => num(item.cod_amount) > 0).map((item) => {
    const collected = isDelivered(item) ? num(item.cod_amount) : 0;
    return {
      id: `cod-order-${item.id}`,
      order_id: item.id,
      tracking_number: orderRef(item),
      merchant_id: item.merchant_id,
      driver_id: (item as any).driver_id || (item as any).assigned_driver_id,
      entry_date: clean(item.created_at).slice(0, 10),
      collection_date: clean(item.created_at).slice(0, 10),
      entry_type: "order_cod",
      cod_amount: num(item.cod_amount),
      collected_amount: collected,
      reconciled_amount: 0,
      credit: num(item.cod_amount),
      balance: Math.max(0, num(item.cod_amount) - collected),
      status: collected > 0 ? "collected_from_order" : "pending_from_order",
      notes: "Live COD row from orders until cod_collections is synced.",
      created_at: item.created_at,
    };
  });
}

function makeAuditRows(orders: Order[]): Row[] {
  return orders.slice(0, 120).map((item) => ({
    id: `audit-order-${item.id}`,
    entity_type: "order",
    entity_id: item.id,
    action: `order_${clean(item.status).toLowerCase() || "loaded"}`,
    reference_number: orderRef(item),
    created_at: item.updated_at || item.created_at,
    notes: `Order ${orderRef(item)} loaded from production orders.`,
  }));
}

function pdfPayload(isArabic: boolean, title: string, source: string, rows: Row[], merchants: Merchant[]) {
  const totals = sumRows(rows);
  return {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: `DAY NIGHT · ${title}`,
    filters: `${tr(isArabic, "مصدر البيانات", "Data source")}: ${source}`,
    totals: { rows: String(totals.count), debit: money(totals.totalDebit), credit: money(totals.totalCredit), balance: money(totals.totalBalance) },
    columns: [
      { key: "date", label: tr(isArabic, "التاريخ", "Date") },
      { key: "ref", label: tr(isArabic, "المرجع", "Reference") },
      { key: "entity", label: tr(isArabic, "الكيان", "Entity") },
      { key: "type", label: tr(isArabic, "النوع", "Type") },
      { key: "debit", label: tr(isArabic, "مدين", "Debit") },
      { key: "credit", label: tr(isArabic, "دائن", "Credit") },
      { key: "balance", label: tr(isArabic, "الرصيد", "Balance") },
      { key: "notes", label: tr(isArabic, "ملاحظات", "Notes") },
    ],
    rows: rows.slice(0, 100).map((row) => ({ date: rowDate(row), ref: rowRef(row), entity: rowEntity(row, merchants), type: rowType(row), debit: money(rowDebit(row)), credit: money(rowCredit(row)), balance: money(rowBalance(row)), notes: rowNotes(row) })),
  };
}

export default function AdminFinanceOperationsCenter({ isArabic, activeSection = "finance_dashboard", orders, merchants, financeSummary, financeSummarySource, onRefresh, onNavigate }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [expenseDraft, setExpenseDraft] = useState({ category: "fuel", amount: "", reference: "", notes: "" });
  const [adjustmentDraft, setAdjustmentDraft] = useState({ adjustment_type: "manual", direction: "positive" as "positive" | "negative", amount: "", reason: "", notes: "" });
  const [tables, setTables] = useState<Record<string, Row[]>>({ expenses: [], adjustments: [], cod: [], merchant: [], driver: [], audit: [] });
  const [ready, setReady] = useState<Record<string, boolean>>({ expenses: false, adjustments: false, cod: false, merchant: false, driver: false, audit: false });

  async function safeRows(loader: () => Promise<Row[]>, key: string) {
    try {
      const rows = await loader();
      setReady((state) => ({ ...state, [key]: true }));
      return rows || [];
    } catch (error) {
      console.warn(`Finance ${key} load skipped:`, error);
      setReady((state) => ({ ...state, [key]: false }));
      return [];
    }
  }

  async function reload() {
    setLoading(true);
    setMessage("");
    const next = {
      expenses: await safeRows(fetchExpenses as unknown as () => Promise<Row[]>, "expenses"),
      adjustments: await safeRows(fetchAdjustments as unknown as () => Promise<Row[]>, "adjustments"),
      cod: await safeRows(fetchCodCollections as unknown as () => Promise<Row[]>, "cod"),
      merchant: await safeRows(fetchMerchantStatementEntries as unknown as () => Promise<Row[]>, "merchant"),
      driver: await safeRows(fetchDriverStatementEntries as unknown as () => Promise<Row[]>, "driver"),
      audit: await safeRows(fetchAdminAuditEvents as unknown as () => Promise<Row[]>, "audit"),
    };
    setTables(next);
    setLoading(false);
  }

  useEffect(() => { void reload(); }, []);

  const incomeRows = useMemo(() => makeIncomeRows(orders), [orders]);
  const codRows = useMemo(() => (tables.cod.length ? tables.cod : makeCodRows(orders)), [orders, tables.cod]);
  const merchantRows = useMemo(() => (tables.merchant.length ? tables.merchant : deriveMerchantStatementFromOrders(undefined, orders) as Row[]), [orders, tables.merchant]);
  const driverRows = useMemo(() => (tables.driver.length ? tables.driver : deriveDriverStatementFromOrders(undefined, orders) as Row[]), [orders, tables.driver]);
  const auditRows = useMemo(() => (tables.audit.length ? tables.audit : makeAuditRows(orders)), [orders, tables.audit]);
  const accountsRows = useMemo(() => {
    const income = financeSummary?.total_income || incomeRows.reduce((sum, row) => sum + rowCredit(row), 0);
    const expenses = financeSummary?.total_expenses || tables.expenses.reduce((sum, row) => sum + rowCredit(row), 0);
    const net = financeSummary?.net_estimate ?? income - expenses;
    return [
      { id: "account-income", entry_type: "income", credit: income, debit: 0, balance: income, notes: "Delivery income from orders", created_at: new Date().toISOString() },
      { id: "account-expenses", entry_type: "expenses", credit: 0, debit: expenses, balance: -expenses, notes: "Approved and draft expenses", created_at: new Date().toISOString() },
      { id: "account-cod", entry_type: "cod_pending", credit: financeSummary?.cod_pending || 0, debit: 0, balance: financeSummary?.cod_pending || 0, notes: "Pending COD exposure", created_at: new Date().toISOString() },
      { id: "account-merchant-payable", entry_type: "merchant_payable", credit: 0, debit: financeSummary?.merchant_payable || 0, balance: -(financeSummary?.merchant_payable || 0), notes: "Merchant payable exposure", created_at: new Date().toISOString() },
      { id: "account-driver-payable", entry_type: "driver_payable", credit: 0, debit: financeSummary?.driver_payable || 0, balance: -(financeSummary?.driver_payable || 0), notes: "Driver payable exposure", created_at: new Date().toISOString() },
      { id: "account-net", entry_type: "net_estimate", credit: Math.max(0, net), debit: Math.max(0, -net), balance: net, notes: "Net estimate", created_at: new Date().toISOString() },
    ];
  }, [financeSummary, incomeRows, tables.expenses]);

  const packs = useMemo(() => {
    const financeSource: SourceKind = financeSummarySource === "rpc" || financeSummarySource === "view" ? "production_table" : "live_orders";
    const tableSource = (rows: Row[], key: string): SourceKind => rows.length ? "production_table" : ready[key] ? "empty_table" : "live_orders";
    const items = [
      { id: "finance_dashboard", titleAr: "لوحة المالية", titleEn: "Finance Dashboard", subtitleAr: "مؤشرات مالية حقيقية من الطلبات والجداول المالية بدون أرقام وهمية.", subtitleEn: "Real finance indicators from orders and finance tables with no fake numbers.", icon: <Landmark />, rows: [...incomeRows, ...codRows, ...tables.expenses, ...tables.adjustments], source: financeSource },
      { id: "driver_statements", titleAr: "كشوفات المناديب", titleEn: "Driver Statements", subtitleAr: "أرصدة المناديب من جدول الكشوفات أو من الطلبات المسندة.", subtitleEn: "Driver balances from statement rows or assigned live orders.", icon: <Truck />, rows: driverRows, source: tableSource(tables.driver, "driver") },
      { id: "merchant_statements", titleAr: "كشوفات التجار", titleEn: "Merchant Statements", subtitleAr: "كشف كل تاجر من السجلات المالية أو من طلباته المرتبطة.", subtitleEn: "Merchant statements from finance entries or directly linked live orders.", icon: <ReceiptText />, rows: merchantRows, source: tableSource(tables.merchant, "merchant") },
      { id: "income", titleAr: "الدخل", titleEn: "Income", subtitleAr: "دخل التوصيل من أسعار الطلبات الحية.", subtitleEn: "Delivery income from live order prices.", icon: <Banknote />, rows: incomeRows, source: incomeRows.length ? "live_orders" : "empty_table" },
      { id: "cod", titleAr: "التحصيل COD", titleEn: "COD Collection", subtitleAr: "COD من جدول التحصيل أو من الطلبات الحية.", subtitleEn: "COD from collection rows or live orders.", icon: <Wallet />, rows: codRows, source: tableSource(tables.cod, "cod") },
      { id: "expenses", titleAr: "المصروفات", titleEn: "Expenses", subtitleAr: "إضافة واعتماد وإلغاء المصروفات من جدول admin_expenses.", subtitleEn: "Create, approve, and void expenses from admin_expenses.", icon: <FileText />, rows: tables.expenses, source: tableSource(tables.expenses, "expenses") },
      { id: "accounts", titleAr: "الحسابات", titleEn: "Accounts", subtitleAr: "دفتر حسابات مختصر للدخل والمصروفات وCOD والمستحقات.", subtitleEn: "Account ledger summary for income, expenses, COD, and payables.", icon: <Landmark />, rows: accountsRows, source: financeSource },
      { id: "adjustments", titleAr: "التسويات", titleEn: "Adjustments", subtitleAr: "إضافة واعتماد التسويات بسجل تدقيق.", subtitleEn: "Create and approve adjustments with audit trail.", icon: <Scale />, rows: tables.adjustments, source: tableSource(tables.adjustments, "adjustments") },
      { id: "audit_log", titleAr: "سجل التدقيق", titleEn: "Audit Log", subtitleAr: "أحداث التدقيق المالية أو أثر حي من الطلبات.", subtitleEn: "Finance audit events or live order trail.", icon: <ShieldCheck />, rows: auditRows, source: tableSource(tables.audit, "audit") },
    ] as Array<{ id: FinanceArea; titleAr: string; titleEn: string; subtitleAr: string; subtitleEn: string; icon: any; rows: Row[]; source: SourceKind }>;
    return items.map((item) => ({ ...item, ...sumRows(item.rows) }));
  }, [accountsRows, auditRows, codRows, driverRows, financeSummarySource, incomeRows, merchantRows, ready, tables]);

  const activePack = packs.find((pack) => pack.id === activeSection) || packs[0];
  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = activePack.rows || [];
    if (!q) return rows.slice(0, 120);
    return rows.filter((row) => [rowRef(row), rowType(row), rowEntity(row, merchants), rowNotes(row), row.status].join(" ").toLowerCase().includes(q)).slice(0, 120);
  }, [activePack.rows, merchants, query]);

  const summaryCards = [
    { label: tr(isArabic, "إجمالي الدخل", "Total income"), value: money(financeSummary?.total_income || incomeRows.reduce((sum, row) => sum + rowCredit(row), 0)), icon: <Banknote /> },
    { label: tr(isArabic, "المصروفات", "Expenses"), value: money(financeSummary?.total_expenses || tables.expenses.reduce((sum, row) => sum + rowCredit(row), 0)), icon: <FileText /> },
    { label: "COD", value: money(financeSummary?.cod_total || codRows.reduce((sum, row) => sum + rowCredit(row), 0)), icon: <Wallet /> },
    { label: tr(isArabic, "معلق COD", "Pending COD"), value: money(financeSummary?.cod_pending || codRows.reduce((sum, row) => sum + Math.max(0, rowBalance(row) - num(row.collected_amount)), 0)), icon: <AlertTriangle /> },
    { label: tr(isArabic, "التجار", "Merchants"), value: money(financeSummary?.merchant_payable || sumRows(merchantRows).totalBalance), icon: <ReceiptText /> },
    { label: tr(isArabic, "المناديب", "Drivers"), value: money(financeSummary?.driver_payable || sumRows(driverRows).totalBalance), icon: <Truck /> },
    { label: tr(isArabic, "صافي تقديري", "Net estimate"), value: money(financeSummary?.net_estimate || (sumRows(incomeRows).totalCredit - sumRows(tables.expenses).totalCredit)), icon: <Landmark /> },
    { label: tr(isArabic, "صفوف مالية", "Finance rows"), value: String(packs.reduce((sum, pack) => sum + pack.count, 0)), icon: <ClipboardList /> },
  ];

  useEffect(() => {
    const pendingCod = Number(financeSummary?.cod_pending || 0);
    if (pendingCod > 0) {
      addAdminNotification({ type: "cod", sectionId: "cod", priority: "high", dedupeKey: `finance-suite-cod-${Math.round(pendingCod)}`, audioEvent: "cod_alert", titleAr: "COD يحتاج متابعة", titleEn: "COD needs follow-up", bodyAr: `COD معلق ${money(pendingCod)}.`, bodyEn: `Pending COD is ${money(pendingCod)}.` });
    }
  }, [financeSummary?.cod_pending]);

  async function fullRefresh() {
    await reload();
    await onRefresh();
  }

  async function saveExpense() {
    if (!expenseDraft.amount) {
      setMessage(tr(isArabic, "أدخل مبلغ المصروف أولاً.", "Enter an expense amount first."));
      return;
    }
    setLoading(true);
    try {
      await createExpense({ category: expenseDraft.category, amount: expenseDraft.amount, reference_number: expenseDraft.reference, notes: expenseDraft.notes, status: "draft" });
      setExpenseDraft({ category: "fuel", amount: "", reference: "", notes: "" });
      setMessage(tr(isArabic, "تم حفظ المصروف في قاعدة البيانات.", "Expense saved to the database."));
      await fullRefresh();
    } catch (error) {
      console.warn("Expense save failed:", error);
      setMessage(tr(isArabic, "لم يتم الحفظ. طبّق migration المالية ثم أعد المحاولة.", "Save failed. Apply the finance migration, then retry."));
    } finally {
      setLoading(false);
    }
  }

  async function saveAdjustment() {
    if (!adjustmentDraft.amount || !adjustmentDraft.reason) {
      setMessage(tr(isArabic, "أدخل مبلغ وسبب التسوية أولاً.", "Enter amount and reason first."));
      return;
    }
    setLoading(true);
    try {
      await createAdjustment({ ...adjustmentDraft, status: "draft" });
      setAdjustmentDraft({ adjustment_type: "manual", direction: "positive", amount: "", reason: "", notes: "" });
      setMessage(tr(isArabic, "تم حفظ التسوية في قاعدة البيانات.", "Adjustment saved to the database."));
      await fullRefresh();
    } catch (error) {
      console.warn("Adjustment save failed:", error);
      setMessage(tr(isArabic, "لم يتم حفظ التسوية. طبّق migration المالية ثم أعد المحاولة.", "Adjustment save failed. Apply the finance migration, then retry."));
    } finally {
      setLoading(false);
    }
  }

  async function approveFirstExpense() {
    const first = tables.expenses.find((row) => !/approved|void/.test(clean(row.status).toLowerCase()));
    if (!first?.id) return setMessage(tr(isArabic, "لا يوجد مصروف بانتظار الاعتماد.", "No expense is waiting for approval."));
    await approveExpense(String(first.id));
    setMessage(tr(isArabic, "تم اعتماد أول مصروف.", "First expense approved."));
    await fullRefresh();
  }

  async function voidFirstExpense() {
    const first = tables.expenses.find((row) => !/void/.test(clean(row.status).toLowerCase()));
    if (!first?.id) return setMessage(tr(isArabic, "لا يوجد مصروف قابل للإلغاء.", "No expense can be voided."));
    await voidExpense(String(first.id), "Voided from finance suite");
    setMessage(tr(isArabic, "تم إلغاء أول مصروف.", "First expense voided."));
    await fullRefresh();
  }

  async function approveFirstAdjustment() {
    const first = tables.adjustments.find((row) => !/approved|void/.test(clean(row.status).toLowerCase()));
    if (!first?.id) return setMessage(tr(isArabic, "لا توجد تسوية بانتظار الاعتماد.", "No adjustment is waiting for approval."));
    await approveAdjustment(String(first.id));
    setMessage(tr(isArabic, "تم اعتماد أول تسوية.", "First adjustment approved."));
    await fullRefresh();
  }

  async function voidFirstAdjustment() {
    const first = tables.adjustments.find((row) => !/void/.test(clean(row.status).toLowerCase()));
    if (!first?.id) return setMessage(tr(isArabic, "لا توجد تسوية قابلة للإلغاء.", "No adjustment can be voided."));
    await voidAdjustment(String(first.id), "Voided from finance suite");
    setMessage(tr(isArabic, "تم إلغاء أول تسوية.", "First adjustment voided."));
    await fullRefresh();
  }

  async function ensureCodRow(row: Row) {
    if (!clean(row.id).startsWith("cod-order-")) return row;
    const sourceOrder = orders.find((item) => String(item.id) === clean(row.order_id));
    if (!sourceOrder) throw new Error("Order not found");
    return (await createOrSyncCodCollectionFromOrder(sourceOrder)) || row;
  }

  async function collectFirstCod() {
    const first = codRows.find((row) => Math.max(0, rowCredit(row) - num(row.collected_amount)) > 0);
    if (!first) return setMessage(tr(isArabic, "لا يوجد COD معلق للتحصيل.", "No pending COD to collect."));
    setLoading(true);
    try {
      const target = await ensureCodRow(first);
      if (!target.id) throw new Error("COD row not ready");
      await markCodCollected(String(target.id), rowCredit(first), "Collected from finance suite");
      setMessage(tr(isArabic, "تم تسجيل تحصيل COD في قاعدة البيانات.", "COD collection saved to the database."));
      await fullRefresh();
    } catch (error) {
      console.warn("COD collect failed:", error);
      setMessage(tr(isArabic, "تعذر التحصيل. طبّق migration المالية وتأكد من صلاحية الأدمن.", "Collection failed. Apply finance migration and confirm admin permissions."));
    } finally {
      setLoading(false);
    }
  }

  async function reconcileFirstCod() {
    const first = codRows.find((row) => Math.max(0, rowCredit(row) - num(row.reconciled_amount)) > 0);
    if (!first) return setMessage(tr(isArabic, "لا يوجد COD بانتظار التسوية.", "No COD is waiting for reconciliation."));
    setLoading(true);
    try {
      const target = await ensureCodRow(first);
      if (!target.id) throw new Error("COD row not ready");
      await markCodReconciled(String(target.id), "Reconciled from finance suite");
      setMessage(tr(isArabic, "تمت تسوية COD في قاعدة البيانات.", "COD reconciled in the database."));
      await fullRefresh();
    } catch (error) {
      console.warn("COD reconcile failed:", error);
      setMessage(tr(isArabic, "تعذرت التسوية. طبّق migration المالية وتأكد من صلاحية الأدمن.", "Reconciliation failed. Apply finance migration and confirm admin permissions."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="dn-finance-suite" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-finance-hero">
        <div>
          <span><Sparkles className="h-4 w-4" /> DAY NIGHT · {tr(isArabic, "مالية إنتاجية", "Production finance")}</span>
          <h1>{tr(isArabic, activePack.titleAr, activePack.titleEn)}</h1>
          <p>{tr(isArabic, activePack.subtitleAr, activePack.subtitleEn)}</p>
        </div>
        <div className="dn-finance-hero-actions">
          <button type="button" onClick={() => void fullRefresh()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />{loading ? tr(isArabic, "تحميل", "Loading") : tr(isArabic, "تحديث", "Refresh")}</button>
          <AdminPdfExportButton label={tr(isArabic, "تصدير PDF", "Export PDF")} payload={pdfPayload(isArabic, tr(isArabic, activePack.titleAr, activePack.titleEn), sourceLabel(activePack.source, isArabic), filteredRows, merchants)} />
        </div>
      </header>

      <nav className="dn-finance-tabs" aria-label={tr(isArabic, "أقسام المالية", "Finance sections")}>
        {order.map((id) => {
          const pack = packs.find((item) => item.id === id) || packs[0];
          return (
            <button key={pack.id} type="button" className={pack.id === activePack.id ? "is-active" : ""} onClick={() => onNavigate(pack.id)}>
              <span className="dn-finance-tab-icon">{pack.icon}</span>
              <strong>{tr(isArabic, pack.titleAr, pack.titleEn)}</strong>
              <small>{pack.count}</small>
            </button>
          );
        })}
      </nav>

      <div className="dn-finance-source-line">
        <span className={sourceTone(activePack.source)}><Database className="h-4 w-4" />{sourceLabel(activePack.source, isArabic)}</span>
        <b>{tr(isArabic, "مصدر الملخص", "Summary source")}: {financeSummarySource === "rpc" ? "RPC" : financeSummarySource === "view" ? "View" : tr(isArabic, "الطلبات الحية", "Live orders")}</b>
        <em>{tr(isArabic, "لا يتم إنشاء أرقام وهمية؛ كل قيمة من orders أو الجداول المالية.", "No fake numbers; every value comes from orders or finance tables.")}</em>
      </div>

      {message && <article className="dn-finance-message"><CheckCircle2 className="h-4 w-4" />{message}</article>}

      <section className="dn-finance-kpis">
        {summaryCards.map((card) => <article key={card.label}><i>{card.icon}</i><span>{card.label}</span><strong>{card.value}</strong></article>)}
      </section>

      <section className="dn-finance-command-grid">
        <article className="dn-finance-command-card dn-finance-command-main">
          <h2><Search className="h-5 w-5" />{tr(isArabic, "البحث والصفوف", "Search and rows")}</h2>
          <div className="dn-finance-toolbar">
            <label><span>{tr(isArabic, "بحث", "Search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr(isArabic, "مرجع، تاجر، مندوب، نوع، ملاحظة...", "Reference, merchant, driver, type, note...")} /></label>
            <div className="dn-finance-mini-stats"><b>{filteredRows.length}</b><span>{tr(isArabic, "صف ظاهر", "visible rows")}</span><b>{money(activePack.totalCredit)}</b><span>{tr(isArabic, "دائن", "credit")}</span><b>{money(activePack.totalDebit)}</b><span>{tr(isArabic, "مدين", "debit")}</span></div>
          </div>
          <div className="dn-finance-table-wrap">
            <table>
              <thead><tr><th>{tr(isArabic, "التاريخ", "Date")}</th><th>{tr(isArabic, "المرجع", "Reference")}</th><th>{tr(isArabic, "الكيان", "Entity")}</th><th>{tr(isArabic, "النوع", "Type")}</th><th>{tr(isArabic, "مدين", "Debit")}</th><th>{tr(isArabic, "دائن", "Credit")}</th><th>{tr(isArabic, "الرصيد", "Balance")}</th><th>{tr(isArabic, "ملاحظات", "Notes")}</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={String(row.id || rowRef(row))}><td>{rowDate(row)}</td><td>{rowRef(row)}</td><td>{rowEntity(row, merchants)}</td><td>{rowType(row)}</td><td>{money(rowDebit(row))}</td><td>{money(rowCredit(row))}</td><td>{money(rowBalance(row))}</td><td>{rowNotes(row)}</td></tr>)}</tbody>
            </table>
            {!filteredRows.length && <div className="dn-finance-empty"><ClipboardList className="h-5 w-5" />{tr(isArabic, "لا توجد صفوف لهذا القسم حالياً، والنظام لا يعرض صفوفاً وهمية.", "No rows for this section right now; the system does not show fake rows.")}</div>}
          </div>
        </article>

        <aside className="dn-finance-command-side">
          <article><h2><Wallet className="h-5 w-5" />COD</h2><p>{tr(isArabic, "تحصيل وتسوية أول صف COD معلق من الجدول أو الطلبات الحية.", "Collect and reconcile the first pending COD row from the table or live orders.")}</p><button type="button" onClick={() => void collectFirstCod()} disabled={loading}>{tr(isArabic, "تحصيل أول COD", "Collect first COD")}</button><button type="button" onClick={() => void reconcileFirstCod()} disabled={loading}>{tr(isArabic, "تسوية أول COD", "Reconcile first COD")}</button></article>
          <article><h2><FileText className="h-5 w-5" />{tr(isArabic, "إضافة مصروف", "Add expense")}</h2><div className="dn-finance-form-mini"><input value={expenseDraft.amount} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, amount: event.target.value }))} placeholder={tr(isArabic, "المبلغ", "Amount")} /><input value={expenseDraft.category} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, category: event.target.value }))} placeholder={tr(isArabic, "التصنيف", "Category")} /><input value={expenseDraft.reference} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, reference: event.target.value }))} placeholder={tr(isArabic, "المرجع", "Reference")} /><input value={expenseDraft.notes} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder={tr(isArabic, "ملاحظات", "Notes")} /></div><button type="button" onClick={() => void saveExpense()} disabled={loading}><Plus className="h-4 w-4" />{tr(isArabic, "حفظ مصروف", "Save expense")}</button><button type="button" onClick={() => void approveFirstExpense()} disabled={loading || !tables.expenses.length}>{tr(isArabic, "اعتماد أول مصروف", "Approve first expense")}</button><button type="button" onClick={() => void voidFirstExpense()} disabled={loading || !tables.expenses.length}>{tr(isArabic, "إلغاء أول مصروف", "Void first expense")}</button></article>
          <article><h2><Scale className="h-5 w-5" />{tr(isArabic, "إضافة تسوية", "Add adjustment")}</h2><div className="dn-finance-form-mini"><input value={adjustmentDraft.amount} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, amount: event.target.value }))} placeholder={tr(isArabic, "المبلغ", "Amount")} /><select value={adjustmentDraft.direction} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, direction: event.target.value === "negative" ? "negative" : "positive" }))}><option value="positive">{tr(isArabic, "موجب", "Positive")}</option><option value="negative">{tr(isArabic, "سالب", "Negative")}</option></select><input value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, reason: event.target.value }))} placeholder={tr(isArabic, "السبب", "Reason")} /><input value={adjustmentDraft.notes} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder={tr(isArabic, "ملاحظات", "Notes")} /></div><button type="button" onClick={() => void saveAdjustment()} disabled={loading}><Plus className="h-4 w-4" />{tr(isArabic, "حفظ تسوية", "Save adjustment")}</button><button type="button" onClick={() => void approveFirstAdjustment()} disabled={loading || !tables.adjustments.length}>{tr(isArabic, "اعتماد أول تسوية", "Approve first adjustment")}</button><button type="button" onClick={() => void voidFirstAdjustment()} disabled={loading || !tables.adjustments.length}>{tr(isArabic, "إلغاء أول تسوية", "Void first adjustment")}</button></article>
        </aside>
      </section>
    </section>
  );
}
