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

const financeOrder: FinanceArea[] = ["finance_dashboard", "driver_statements", "merchant_statements", "income", "cod", "expenses", "accounts", "adjustments", "audit_log"];
const clean = (value: unknown) => String(value ?? "").trim();
const hasArabic = (value: string) => /[\u0600-\u06FF]/.test(value);
const tr = (isArabic: boolean, ar: string, en: string) => (isArabic ? ar : en);
const num = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const labels: Record<string, { ar: string; en: string }> = {
  finance_dashboard: { ar: "لوحة المالية", en: "Finance Dashboard" },
  driver_statements: { ar: "كشوفات المناديب", en: "Driver Statements" },
  merchant_statements: { ar: "كشوفات التجار", en: "Merchant Statements" },
  income: { ar: "الدخل", en: "Income" },
  cod: { ar: "COD", en: "COD" },
  expenses: { ar: "المصروفات", en: "Expenses" },
  accounts: { ar: "الحسابات", en: "Accounts" },
  adjustments: { ar: "التسويات", en: "Adjustments" },
  audit_log: { ar: "سجل التدقيق", en: "Audit Log" },
  production_table: { ar: "جدول فعلي", en: "Production table" },
  live_orders: { ar: "من الطلبات الحية", en: "Live orders" },
  empty_table: { ar: "جاهز بلا صفوف", en: "Ready with no rows" },
  total_income: { ar: "إجمالي الدخل", en: "Total income" },
  total_expenses: { ar: "المصروفات", en: "Expenses" },
  pending_cod: { ar: "COD معلق", en: "Pending COD" },
  merchants: { ar: "التجار", en: "Merchants" },
  drivers: { ar: "المناديب", en: "Drivers" },
  net_estimate: { ar: "صافي تقديري", en: "Net estimate" },
  finance_rows: { ar: "صفوف مالية", en: "Finance rows" },
  date: { ar: "التاريخ", en: "Date" },
  ref: { ar: "المرجع", en: "Reference" },
  entity: { ar: "الكيان", en: "Entity" },
  type: { ar: "النوع", en: "Type" },
  debit: { ar: "مدين", en: "Debit" },
  credit: { ar: "دائن", en: "Credit" },
  balance: { ar: "الرصيد", en: "Balance" },
  notes: { ar: "ملاحظات", en: "Notes" },
  search: { ar: "بحث", en: "Search" },
  search_rows: { ar: "البحث والصفوف", en: "Search and rows" },
  visible_rows: { ar: "صف ظاهر", en: "visible rows" },
  refresh: { ar: "تحديث", en: "Refresh" },
  loading: { ar: "تحميل", en: "Loading" },
  export_pdf: { ar: "تصدير PDF", en: "Export PDF" },
  source: { ar: "مصدر البيانات", en: "Data source" },
  summary_source: { ar: "مصدر الملخص", en: "Summary source" },
  rpc: { ar: "دالة قاعدة البيانات", en: "RPC" },
  view: { ar: "عرض قاعدة البيانات", en: "View" },
  derived: { ar: "حساب مشتق", en: "Derived" },
  no_fake: { ar: "لا يتم إنشاء أرقام وهمية؛ كل قيمة من الطلبات أو الجداول المالية.", en: "No fake numbers; every value comes from orders or finance tables." },
  no_rows: { ar: "لا توجد صفوف لهذا القسم حالياً، والنظام لا يعرض صفوفاً وهمية.", en: "No rows for this section right now; the system does not show fake rows." },
  add_expense: { ar: "إضافة مصروف", en: "Add expense" },
  save_expense: { ar: "حفظ مصروف", en: "Save expense" },
  approve_expense: { ar: "اعتماد أول مصروف", en: "Approve first expense" },
  void_expense: { ar: "إلغاء أول مصروف", en: "Void first expense" },
  add_adjustment: { ar: "إضافة تسوية", en: "Add adjustment" },
  save_adjustment: { ar: "حفظ تسوية", en: "Save adjustment" },
  approve_adjustment: { ar: "اعتماد أول تسوية", en: "Approve first adjustment" },
  void_adjustment: { ar: "إلغاء أول تسوية", en: "Void first adjustment" },
  collect_cod: { ar: "تحصيل أول COD", en: "Collect first COD" },
  reconcile_cod: { ar: "تسوية أول COD", en: "Reconcile first COD" },
  cod_side_text: { ar: "تحصيل وتسوية أول صف COD معلق من الجدول أو الطلبات الحية.", en: "Collect and reconcile the first pending COD row from the table or live orders." },
  amount: { ar: "المبلغ", en: "Amount" },
  category: { ar: "التصنيف", en: "Category" },
  reference: { ar: "المرجع", en: "Reference" },
  reason: { ar: "السبب", en: "Reason" },
  positive: { ar: "موجب", en: "Positive" },
  negative: { ar: "سالب", en: "Negative" },
  delivery_income: { ar: "دخل التوصيل", en: "Delivery income" },
  order_cod: { ar: "COD الطلب", en: "Order COD" },
  order_cancelled: { ar: "طلب ملغي", en: "Order cancelled" },
  order_canceled: { ar: "طلب ملغي", en: "Order canceled" },
  order_delivered: { ar: "طلب تم تسليمه", en: "Order delivered" },
  order_completed: { ar: "طلب مكتمل", en: "Order completed" },
  order_pending: { ar: "طلب قيد الانتظار", en: "Order pending" },
  order_loaded: { ar: "طلب محمل", en: "Order loaded" },
  pending_from_order: { ar: "معلق من الطلب", en: "Pending from order" },
  collected_from_order: { ar: "محصل من الطلب", en: "Collected from order" },
  cod_pending: { ar: "COD معلق", en: "Pending COD" },
  merchant_payable: { ar: "مستحقات التجار", en: "Merchant payable" },
  driver_payable: { ar: "مستحقات المناديب", en: "Driver payable" },
  manual: { ar: "يدوي", en: "Manual" },
  draft: { ar: "مسودة", en: "Draft" },
  approved: { ar: "معتمد", en: "Approved" },
  void: { ar: "ملغي", en: "Void" },
  cash: { ar: "نقدي", en: "Cash" },
  fuel: { ar: "وقود", en: "Fuel" },
  driver: { ar: "مندوب", en: "Driver" },
  maintenance: { ar: "صيانة", en: "Maintenance" },
  tolls: { ar: "رسوم طرق", en: "Tolls" },
  office: { ar: "مكتب", en: "Office" },
  software: { ar: "برمجيات", en: "Software" },
  marketing: { ar: "تسويق", en: "Marketing" },
  other: { ar: "أخرى", en: "Other" },
  order: { ar: "طلب", en: "Order" },
  account_income_note: { ar: "دخل التوصيل من الطلبات", en: "Delivery income from orders" },
  account_expenses_note: { ar: "المصروفات المعتمدة والمسودات", en: "Approved and draft expenses" },
  account_cod_note: { ar: "تعرض COD المعلق", en: "Pending COD exposure" },
  account_merchant_note: { ar: "تعرض مستحقات التجار", en: "Merchant payable exposure" },
  account_driver_note: { ar: "تعرض مستحقات المناديب", en: "Driver payable exposure" },
  account_net_note: { ar: "صافي التقدير", en: "Net estimate" },
  live_cod_row: { ar: "صف COD حي من الطلبات حتى تتم مزامنته في جدول التحصيل.", en: "Live COD row from orders until cod_collections is synced." },
  delivery_income_from_orders: { ar: "دخل التوصيل من الطلبات", en: "Delivery income from orders" },
  voided_from_finance_suite: { ar: "تم الإلغاء من مجموعة المالية", en: "Voided from finance suite" },
  collected_from_finance_suite: { ar: "تم التحصيل من مجموعة المالية", en: "Collected from finance suite" },
  reconciled_from_finance_suite: { ar: "تمت التسوية من مجموعة المالية", en: "Reconciled from finance suite" },
};

const wordMap: Record<string, string> = {
  order: "طلب", cancelled: "ملغي", canceled: "ملغي", pending: "قيد الانتظار", delivered: "تم التسليم", completed: "مكتمل", loaded: "محمل", income: "دخل", expenses: "مصروفات", expense: "مصروف", adjustment: "تسوية", adjustments: "تسويات", audit: "تدقيق", log: "سجل", merchant: "تاجر", merchants: "تجار", driver: "مندوب", drivers: "مناديب", payable: "مستحق", net: "صافي", estimate: "تقديري", collection: "تحصيل", collected: "محصل", reconciled: "مسوى", from: "من", live: "حي", rows: "صفوف", row: "صف", account: "حساب", cash: "نقدي", manual: "يدوي", positive: "موجب", negative: "سالب", cod: "COD"
};

const categoryOptions = ["fuel", "driver", "maintenance", "tolls", "office", "software", "marketing", "other"];
const label = (key: unknown, isArabic: boolean) => {
  const raw = clean(key);
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const pair = labels[normalized] || labels[raw];
  if (pair) return tr(isArabic, pair.ar, pair.en);
  if (!isArabic) return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Undefined";
  const parts = normalized.split("_").map((part) => wordMap[part]).filter(Boolean);
  return parts.length ? parts.join(" ") : "غير محدد";
};
const money = (value: unknown, isArabic: boolean) => isArabic ? `${Number(value || 0).toFixed(2)} درهم` : `${Number(value || 0).toFixed(2)} AED`;

function noteText(value: unknown, isArabic: boolean) {
  const raw = clean(value);
  if (!raw || raw === "—") return "—";
  const loaded = raw.match(/^order_loaded:(.+)$/);
  if (loaded) return isArabic ? `تم تحميل الطلب ${loaded[1]} من الطلبات الفعلية.` : `Order ${loaded[1]} loaded from production orders.`;
  const pair = labels[raw.toLowerCase().replace(/[\s-]+/g, "_")];
  if (pair) return tr(isArabic, pair.ar, pair.en);
  if (!isArabic) return raw;
  if (hasArabic(raw)) return raw;
  return "ملاحظة محفوظة في السجل";
}

function isDelivered(item: Order) {
  return /deliver|complete|تم_التسليم/.test(clean(item.status).toLowerCase().replace(/[\s-]+/g, "_"));
}
const orderRef = (item: Order) => clean(item.tracking_number || item.invoice_number || item.coupon_number || item.id || "—");
function rowVal(row: Row, keys: string[]) { for (const key of keys) { const value = num(row[key]); if (value !== 0) return value; } return 0; }
const rowDebit = (row: Row) => rowVal(row, ["debit", "expense_amount", "amount_debit"]);
const rowCredit = (row: Row) => rowVal(row, ["credit", "amount_credit", "delivery_income", "delivery_fee", "cod_amount", "collected_amount", "amount"]);
const rowBalance = (row: Row) => rowVal(row, ["balance", "net_amount", "running_balance", "cod_amount", "amount", "credit"]);
const rowDate = (row: Row) => clean(row.entry_date || row.expense_date || row.collection_date || row.created_at || row.updated_at || new Date().toISOString()).slice(0, 10);
const rowRef = (row: Row) => clean(row.tracking_number || row.reference_number || row.invoice_number || row.order_id || row.entity_id || row.id || "—");
const rowType = (row: Row) => clean(row.entry_type || row.adjustment_type || row.category || row.action || row.status || row.payment_method || "—");
const rowNotes = (row: Row) => clean(row.notes || row.reason || row.file_name || row.source || "—");
function rowEntity(row: Row, merchants: Merchant[], isArabic: boolean) {
  const merchantId = clean(row.merchant_id);
  const merchant = merchants.find((item) => item.id === merchantId);
  const value = clean(merchant?.trade_name || row.merchant_name || row.driver_name || row.entity_type || row.entity_id || merchantId || "—");
  return value === "order" ? label("order", isArabic) : value;
}
function sumRows(rows: Row[]) {
  return { totalDebit: rows.reduce((s, r) => s + rowDebit(r), 0), totalCredit: rows.reduce((s, r) => s + rowCredit(r), 0), totalBalance: rows.reduce((s, r) => s + rowBalance(r), 0), count: rows.length };
}
const sourceLabel = (source: SourceKind, isArabic: boolean) => label(source, isArabic);
const sourceTone = (source: SourceKind) => source === "production_table" ? "is-db" : source === "live_orders" ? "is-live" : "is-empty";

function makeIncomeRows(orders: Order[]): Row[] {
  return orders.map((item) => ({ id: `income-${item.id}`, order_id: item.id, tracking_number: orderRef(item), entry_date: clean(item.created_at).slice(0, 10), entry_type: "delivery_income", debit: 0, credit: num(item.delivery_price || item.price || item.base_price), balance: num(item.delivery_price || item.price || item.base_price), merchant_id: item.merchant_id, merchant_name: item.merchant_name || item.sender_name, status: item.status, notes: "delivery_income_from_orders", created_at: item.created_at }));
}
function makeCodRows(orders: Order[]): Row[] {
  return orders.filter((item) => num(item.cod_amount) > 0).map((item) => { const collected = isDelivered(item) ? num(item.cod_amount) : 0; return { id: `cod-order-${item.id}`, order_id: item.id, tracking_number: orderRef(item), merchant_id: item.merchant_id, driver_id: (item as any).driver_id || (item as any).assigned_driver_id, entry_date: clean(item.created_at).slice(0, 10), collection_date: clean(item.created_at).slice(0, 10), entry_type: "order_cod", cod_amount: num(item.cod_amount), collected_amount: collected, reconciled_amount: 0, credit: num(item.cod_amount), balance: Math.max(0, num(item.cod_amount) - collected), status: collected > 0 ? "collected_from_order" : "pending_from_order", notes: "live_cod_row", created_at: item.created_at }; });
}
function makeAuditRows(orders: Order[]): Row[] {
  return orders.slice(0, 120).map((item) => ({ id: `audit-order-${item.id}`, entity_type: "order", entity_id: item.id, action: `order_${clean(item.status).toLowerCase() || "loaded"}`, reference_number: orderRef(item), created_at: item.updated_at || item.created_at, notes: `order_loaded:${orderRef(item)}` }));
}
function pdfPayload(isArabic: boolean, title: string, source: string, rows: Row[], merchants: Merchant[]) {
  const totals = sumRows(rows);
  return {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: `DAY NIGHT · ${title}`,
    filters: `${label("source", isArabic)}: ${source}`,
    totals: { rows: String(totals.count), debit: money(totals.totalDebit, isArabic), credit: money(totals.totalCredit, isArabic), balance: money(totals.totalBalance, isArabic) },
    columns: ["date", "ref", "entity", "type", "debit", "credit", "balance", "notes"].map((key) => ({ key, label: label(key, isArabic) })),
    rows: rows.slice(0, 100).map((row) => ({ date: rowDate(row), ref: rowRef(row), entity: rowEntity(row, merchants, isArabic), type: label(rowType(row), isArabic), debit: money(rowDebit(row), isArabic), credit: money(rowCredit(row), isArabic), balance: money(rowBalance(row), isArabic), notes: noteText(rowNotes(row), isArabic) })),
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
    try { const rows = await loader(); setReady((s) => ({ ...s, [key]: true })); return rows || []; }
    catch (error) { console.warn(`Finance ${key} load skipped:`, error); setReady((s) => ({ ...s, [key]: false })); return []; }
  }
  async function reload() {
    setLoading(true); setMessage("");
    const next = {
      expenses: await safeRows(fetchExpenses as unknown as () => Promise<Row[]>, "expenses"),
      adjustments: await safeRows(fetchAdjustments as unknown as () => Promise<Row[]>, "adjustments"),
      cod: await safeRows(fetchCodCollections as unknown as () => Promise<Row[]>, "cod"),
      merchant: await safeRows(fetchMerchantStatementEntries as unknown as () => Promise<Row[]>, "merchant"),
      driver: await safeRows(fetchDriverStatementEntries as unknown as () => Promise<Row[]>, "driver"),
      audit: await safeRows(fetchAdminAuditEvents as unknown as () => Promise<Row[]>, "audit"),
    };
    setTables(next); setLoading(false);
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
      { id: "account-income", entry_type: "income", credit: income, debit: 0, balance: income, notes: "account_income_note", created_at: new Date().toISOString() },
      { id: "account-expenses", entry_type: "expenses", credit: 0, debit: expenses, balance: -expenses, notes: "account_expenses_note", created_at: new Date().toISOString() },
      { id: "account-cod", entry_type: "cod_pending", credit: financeSummary?.cod_pending || 0, debit: 0, balance: financeSummary?.cod_pending || 0, notes: "account_cod_note", created_at: new Date().toISOString() },
      { id: "account-merchant-payable", entry_type: "merchant_payable", credit: 0, debit: financeSummary?.merchant_payable || 0, balance: -(financeSummary?.merchant_payable || 0), notes: "account_merchant_note", created_at: new Date().toISOString() },
      { id: "account-driver-payable", entry_type: "driver_payable", credit: 0, debit: financeSummary?.driver_payable || 0, balance: -(financeSummary?.driver_payable || 0), notes: "account_driver_note", created_at: new Date().toISOString() },
      { id: "account-net", entry_type: "net_estimate", credit: Math.max(0, net), debit: Math.max(0, -net), balance: net, notes: "account_net_note", created_at: new Date().toISOString() },
    ];
  }, [financeSummary, incomeRows, tables.expenses]);

  const packs = useMemo(() => {
    const financeSource: SourceKind = financeSummarySource === "rpc" || financeSummarySource === "view" ? "production_table" : "live_orders";
    const tableSource = (rows: Row[], key: string): SourceKind => rows.length ? "production_table" : ready[key] ? "empty_table" : "live_orders";
    const items = [
      { id: "finance_dashboard", subtitleAr: "مؤشرات مالية حقيقية من الطلبات والجداول المالية بدون أرقام وهمية.", subtitleEn: "Real finance indicators from orders and finance tables with no fake numbers.", icon: <Landmark />, rows: [...incomeRows, ...codRows, ...tables.expenses, ...tables.adjustments], source: financeSource },
      { id: "driver_statements", subtitleAr: "أرصدة المناديب من جدول الكشوفات أو من الطلبات المسندة.", subtitleEn: "Driver balances from statement rows or assigned live orders.", icon: <Truck />, rows: driverRows, source: tableSource(tables.driver, "driver") },
      { id: "merchant_statements", subtitleAr: "كشف كل تاجر من السجلات المالية أو من طلباته المرتبطة.", subtitleEn: "Merchant statements from finance entries or directly linked live orders.", icon: <ReceiptText />, rows: merchantRows, source: tableSource(tables.merchant, "merchant") },
      { id: "income", subtitleAr: "دخل التوصيل من أسعار الطلبات الحية.", subtitleEn: "Delivery income from live order prices.", icon: <Banknote />, rows: incomeRows, source: incomeRows.length ? "live_orders" : "empty_table" },
      { id: "cod", subtitleAr: "COD من جدول التحصيل أو من الطلبات الحية.", subtitleEn: "COD from collection rows or live orders.", icon: <Wallet />, rows: codRows, source: tableSource(tables.cod, "cod") },
      { id: "expenses", subtitleAr: "إضافة واعتماد وإلغاء المصروفات من جدول المصروفات الحقيقي.", subtitleEn: "Create, approve, and void expenses from the real expenses table.", icon: <FileText />, rows: tables.expenses, source: tableSource(tables.expenses, "expenses") },
      { id: "accounts", subtitleAr: "دفتر حسابات مختصر للدخل والمصروفات وCOD والمستحقات.", subtitleEn: "Account ledger summary for income, expenses, COD, and payables.", icon: <Landmark />, rows: accountsRows, source: financeSource },
      { id: "adjustments", subtitleAr: "إضافة واعتماد التسويات بسجل تدقيق.", subtitleEn: "Create and approve adjustments with audit trail.", icon: <Scale />, rows: tables.adjustments, source: tableSource(tables.adjustments, "adjustments") },
      { id: "audit_log", subtitleAr: "أحداث التدقيق المالية أو أثر حي من الطلبات.", subtitleEn: "Finance audit events or live order trail.", icon: <ShieldCheck />, rows: auditRows, source: tableSource(tables.audit, "audit") },
    ] as Array<{ id: FinanceArea; subtitleAr: string; subtitleEn: string; icon: any; rows: Row[]; source: SourceKind }>;
    return items.map((item) => ({ ...item, title: label(item.id, isArabic), subtitle: tr(isArabic, item.subtitleAr, item.subtitleEn), ...sumRows(item.rows) }));
  }, [accountsRows, auditRows, codRows, driverRows, financeSummarySource, incomeRows, isArabic, merchantRows, ready, tables]);

  const activePack = packs.find((pack) => pack.id === activeSection) || packs[0];
  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = activePack.rows || [];
    if (!q) return rows.slice(0, 120);
    return rows.filter((row) => [rowRef(row), rowType(row), rowEntity(row, merchants, isArabic), noteText(rowNotes(row), isArabic), row.status].join(" ").toLowerCase().includes(q)).slice(0, 120);
  }, [activePack.rows, merchants, query, isArabic]);

  const summaryCards = [
    { label: label("total_income", isArabic), value: money(financeSummary?.total_income || incomeRows.reduce((sum, row) => sum + rowCredit(row), 0), isArabic), icon: <Banknote /> },
    { label: label("total_expenses", isArabic), value: money(financeSummary?.total_expenses || tables.expenses.reduce((sum, row) => sum + rowCredit(row), 0), isArabic), icon: <FileText /> },
    { label: "COD", value: money(financeSummary?.cod_total || codRows.reduce((sum, row) => sum + rowCredit(row), 0), isArabic), icon: <Wallet /> },
    { label: label("pending_cod", isArabic), value: money(financeSummary?.cod_pending || codRows.reduce((sum, row) => sum + Math.max(0, rowBalance(row) - num(row.collected_amount)), 0), isArabic), icon: <AlertTriangle /> },
    { label: label("merchants", isArabic), value: money(financeSummary?.merchant_payable || sumRows(merchantRows).totalBalance, isArabic), icon: <ReceiptText /> },
    { label: label("drivers", isArabic), value: money(financeSummary?.driver_payable || sumRows(driverRows).totalBalance, isArabic), icon: <Truck /> },
    { label: label("net_estimate", isArabic), value: money(financeSummary?.net_estimate || (sumRows(incomeRows).totalCredit - sumRows(tables.expenses).totalCredit), isArabic), icon: <Landmark /> },
    { label: label("finance_rows", isArabic), value: String(packs.reduce((sum, pack) => sum + pack.count, 0)), icon: <ClipboardList /> },
  ];

  useEffect(() => {
    const pendingCod = Number(financeSummary?.cod_pending || 0);
    if (pendingCod > 0) addAdminNotification({ type: "cod", sectionId: "cod", priority: "high", dedupeKey: `finance-suite-cod-${Math.round(pendingCod)}`, audioEvent: "cod_alert", titleAr: "COD يحتاج متابعة", titleEn: "COD needs follow-up", bodyAr: `COD معلق ${money(pendingCod, true)}.`, bodyEn: `Pending COD is ${money(pendingCod, false)}.` });
  }, [financeSummary?.cod_pending]);

  async function fullRefresh() { await reload(); await onRefresh(); }
  async function saveExpense() {
    if (!expenseDraft.amount) return setMessage(tr(isArabic, "أدخل مبلغ المصروف أولاً.", "Enter an expense amount first."));
    setLoading(true);
    try { await createExpense({ category: expenseDraft.category, amount: expenseDraft.amount, reference_number: expenseDraft.reference, notes: expenseDraft.notes, status: "draft" }); setExpenseDraft({ category: "fuel", amount: "", reference: "", notes: "" }); setMessage(tr(isArabic, "تم حفظ المصروف في قاعدة البيانات.", "Expense saved to the database.")); await fullRefresh(); }
    catch (error) { console.warn("Expense save failed:", error); setMessage(tr(isArabic, "لم يتم الحفظ. طبّق migration المالية ثم أعد المحاولة.", "Save failed. Apply the finance migration, then retry.")); }
    finally { setLoading(false); }
  }
  async function saveAdjustment() {
    if (!adjustmentDraft.amount || !adjustmentDraft.reason) return setMessage(tr(isArabic, "أدخل مبلغ وسبب التسوية أولاً.", "Enter amount and reason first."));
    setLoading(true);
    try { await createAdjustment({ ...adjustmentDraft, status: "draft" }); setAdjustmentDraft({ adjustment_type: "manual", direction: "positive", amount: "", reason: "", notes: "" }); setMessage(tr(isArabic, "تم حفظ التسوية في قاعدة البيانات.", "Adjustment saved to the database.")); await fullRefresh(); }
    catch (error) { console.warn("Adjustment save failed:", error); setMessage(tr(isArabic, "لم يتم حفظ التسوية. طبّق migration المالية ثم أعد المحاولة.", "Adjustment save failed. Apply the finance migration, then retry.")); }
    finally { setLoading(false); }
  }
  async function approveFirstExpense() { const first = tables.expenses.find((row) => !/approved|void/.test(clean(row.status).toLowerCase())); if (!first?.id) return setMessage(tr(isArabic, "لا يوجد مصروف بانتظار الاعتماد.", "No expense is waiting for approval.")); await approveExpense(String(first.id)); setMessage(tr(isArabic, "تم اعتماد أول مصروف.", "First expense approved.")); await fullRefresh(); }
  async function voidFirstExpense() { const first = tables.expenses.find((row) => !/void/.test(clean(row.status).toLowerCase())); if (!first?.id) return setMessage(tr(isArabic, "لا يوجد مصروف قابل للإلغاء.", "No expense can be voided.")); await voidExpense(String(first.id), "voided_from_finance_suite"); setMessage(tr(isArabic, "تم إلغاء أول مصروف.", "First expense voided.")); await fullRefresh(); }
  async function approveFirstAdjustment() { const first = tables.adjustments.find((row) => !/approved|void/.test(clean(row.status).toLowerCase())); if (!first?.id) return setMessage(tr(isArabic, "لا توجد تسوية بانتظار الاعتماد.", "No adjustment is waiting for approval.")); await approveAdjustment(String(first.id)); setMessage(tr(isArabic, "تم اعتماد أول تسوية.", "First adjustment approved.")); await fullRefresh(); }
  async function voidFirstAdjustment() { const first = tables.adjustments.find((row) => !/void/.test(clean(row.status).toLowerCase())); if (!first?.id) return setMessage(tr(isArabic, "لا توجد تسوية قابلة للإلغاء.", "No adjustment can be voided.")); await voidAdjustment(String(first.id), "voided_from_finance_suite"); setMessage(tr(isArabic, "تم إلغاء أول تسوية.", "First adjustment voided.")); await fullRefresh(); }
  async function ensureCodRow(row: Row) { if (!clean(row.id).startsWith("cod-order-")) return row; const sourceOrder = orders.find((item) => String(item.id) === clean(row.order_id)); if (!sourceOrder) throw new Error("Order not found"); return (await createOrSyncCodCollectionFromOrder(sourceOrder)) || row; }
  async function collectFirstCod() { const first = codRows.find((row) => Math.max(0, rowCredit(row) - num(row.collected_amount)) > 0); if (!first) return setMessage(tr(isArabic, "لا يوجد COD معلق للتحصيل.", "No pending COD to collect.")); setLoading(true); try { const target = await ensureCodRow(first); if (!target.id) throw new Error("COD row not ready"); await markCodCollected(String(target.id), rowCredit(first), "collected_from_finance_suite"); setMessage(tr(isArabic, "تم تسجيل تحصيل COD في قاعدة البيانات.", "COD collection saved to the database.")); await fullRefresh(); } catch (error) { console.warn("COD collect failed:", error); setMessage(tr(isArabic, "تعذر التحصيل. طبّق migration المالية وتأكد من صلاحية الأدمن.", "Collection failed. Apply finance migration and confirm admin permissions.")); } finally { setLoading(false); } }
  async function reconcileFirstCod() { const first = codRows.find((row) => Math.max(0, rowCredit(row) - num(row.reconciled_amount)) > 0); if (!first) return setMessage(tr(isArabic, "لا يوجد COD بانتظار التسوية.", "No COD is waiting for reconciliation.")); setLoading(true); try { const target = await ensureCodRow(first); if (!target.id) throw new Error("COD row not ready"); await markCodReconciled(String(target.id), "reconciled_from_finance_suite"); setMessage(tr(isArabic, "تمت تسوية COD في قاعدة البيانات.", "COD reconciled in the database.")); await fullRefresh(); } catch (error) { console.warn("COD reconcile failed:", error); setMessage(tr(isArabic, "تعذرت التسوية. طبّق migration المالية وتأكد من صلاحية الأدمن.", "Reconciliation failed. Apply finance migration and confirm admin permissions.")); } finally { setLoading(false); } }

  return (
    <section className="dn-finance-suite" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-finance-hero"><div><span><Sparkles className="h-4 w-4" /> DAY NIGHT · {tr(isArabic, "مالية إنتاجية", "Production finance")}</span><h1>{activePack.title}</h1><p>{activePack.subtitle}</p></div><div className="dn-finance-hero-actions"><button type="button" onClick={() => void fullRefresh()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />{loading ? label("loading", isArabic) : label("refresh", isArabic)}</button><AdminPdfExportButton label={label("export_pdf", isArabic)} payload={pdfPayload(isArabic, activePack.title, sourceLabel(activePack.source, isArabic), filteredRows, merchants)} /></div></header>
      <nav className="dn-finance-tabs" aria-label={tr(isArabic, "أقسام المالية", "Finance sections")}>{financeOrder.map((id) => { const pack = packs.find((item) => item.id === id) || packs[0]; return <button key={pack.id} type="button" className={pack.id === activePack.id ? "is-active" : ""} onClick={() => onNavigate(pack.id)}><span className="dn-finance-tab-icon">{pack.icon}</span><strong>{pack.title}</strong><small>{pack.count}</small></button>; })}</nav>
      <div className="dn-finance-source-line"><span className={sourceTone(activePack.source)}><Database className="h-4 w-4" />{sourceLabel(activePack.source, isArabic)}</span><b>{label("summary_source", isArabic)}: {label(financeSummarySource, isArabic)}</b><em>{label("no_fake", isArabic)}</em></div>
      {message && <article className="dn-finance-message"><CheckCircle2 className="h-4 w-4" />{message}</article>}
      <section className="dn-finance-kpis">{summaryCards.map((card) => <article key={card.label}><i>{card.icon}</i><span>{card.label}</span><strong>{card.value}</strong></article>)}</section>
      <section className="dn-finance-command-grid"><article className="dn-finance-command-card dn-finance-command-main"><h2><Search className="h-5 w-5" />{label("search_rows", isArabic)}</h2><div className="dn-finance-toolbar"><label><span>{label("search", isArabic)}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr(isArabic, "مرجع، تاجر، مندوب، نوع، ملاحظة...", "Reference, merchant, driver, type, note...")} /></label><div className="dn-finance-mini-stats"><b>{filteredRows.length}</b><span>{label("visible_rows", isArabic)}</span><b>{money(activePack.totalCredit, isArabic)}</b><span>{label("credit", isArabic)}</span><b>{money(activePack.totalDebit, isArabic)}</b><span>{label("debit", isArabic)}</span></div></div><div className="dn-finance-table-wrap"><table><thead><tr>{["date", "ref", "entity", "type", "debit", "credit", "balance", "notes"].map((key) => <th key={key}>{label(key, isArabic)}</th>)}</tr></thead><tbody>{filteredRows.map((row) => <tr key={String(row.id || rowRef(row))}><td>{rowDate(row)}</td><td>{rowRef(row)}</td><td>{rowEntity(row, merchants, isArabic)}</td><td>{label(rowType(row), isArabic)}</td><td>{money(rowDebit(row), isArabic)}</td><td>{money(rowCredit(row), isArabic)}</td><td>{money(rowBalance(row), isArabic)}</td><td>{noteText(rowNotes(row), isArabic)}</td></tr>)}</tbody></table>{!filteredRows.length && <div className="dn-finance-empty"><ClipboardList className="h-5 w-5" />{label("no_rows", isArabic)}</div>}</div></article>
        <aside className="dn-finance-command-side"><article><h2><Wallet className="h-5 w-5" />COD</h2><p>{label("cod_side_text", isArabic)}</p><button type="button" onClick={() => void collectFirstCod()} disabled={loading}>{label("collect_cod", isArabic)}</button><button type="button" onClick={() => void reconcileFirstCod()} disabled={loading}>{label("reconcile_cod", isArabic)}</button></article><article><h2><FileText className="h-5 w-5" />{label("add_expense", isArabic)}</h2><div className="dn-finance-form-mini"><input value={expenseDraft.amount} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, amount: event.target.value }))} placeholder={label("amount", isArabic)} /><select value={expenseDraft.category} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, category: event.target.value }))}>{categoryOptions.map((key) => <option key={key} value={key}>{label(key, isArabic)}</option>)}</select><input value={expenseDraft.reference} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, reference: event.target.value }))} placeholder={label("reference", isArabic)} /><input value={expenseDraft.notes} onChange={(event) => setExpenseDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder={label("notes", isArabic)} /></div><button type="button" onClick={() => void saveExpense()} disabled={loading}><Plus className="h-4 w-4" />{label("save_expense", isArabic)}</button><button type="button" onClick={() => void approveFirstExpense()} disabled={loading || !tables.expenses.length}>{label("approve_expense", isArabic)}</button><button type="button" onClick={() => void voidFirstExpense()} disabled={loading || !tables.expenses.length}>{label("void_expense", isArabic)}</button></article><article><h2><Scale className="h-5 w-5" />{label("add_adjustment", isArabic)}</h2><div className="dn-finance-form-mini"><input value={adjustmentDraft.amount} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, amount: event.target.value }))} placeholder={label("amount", isArabic)} /><select value={adjustmentDraft.direction} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, direction: event.target.value === "negative" ? "negative" : "positive" }))}><option value="positive">{label("positive", isArabic)}</option><option value="negative">{label("negative", isArabic)}</option></select><input value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, reason: event.target.value }))} placeholder={label("reason", isArabic)} /><input value={adjustmentDraft.notes} onChange={(event) => setAdjustmentDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder={label("notes", isArabic)} /></div><button type="button" onClick={() => void saveAdjustment()} disabled={loading}><Plus className="h-4 w-4" />{label("save_adjustment", isArabic)}</button><button type="button" onClick={() => void approveFirstAdjustment()} disabled={loading || !tables.adjustments.length}>{label("approve_adjustment", isArabic)}</button><button type="button" onClick={() => void voidFirstAdjustment()} disabled={loading || !tables.adjustments.length}>{label("void_adjustment", isArabic)}</button></article></aside></section>
    </section>
  );
}
