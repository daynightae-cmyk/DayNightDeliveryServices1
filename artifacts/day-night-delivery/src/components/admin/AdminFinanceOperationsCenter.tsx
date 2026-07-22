import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  Loader2,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Store,
  Truck,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { Merchant, Order } from "../../types";
import {
  createFinanceAdjustment,
  createFinanceExpense,
  fetchFinanceLedgerSnapshot,
  setFinanceAdjustmentStatus,
  setFinanceExpenseStatus,
  upsertFinanceBudget,
  type AdjustmentDraft,
  type BudgetDraft,
  type ExpenseDraft,
  type FinanceBudgetRow,
  type FinanceLedgerRow,
  type FinanceLedgerSnapshot,
} from "../../lib/adminFinanceLedger";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import AdminPdfExportButton from "./AdminPdfExportButton";
import AdminMerchantStatementsCenter from "./AdminMerchantStatementsCenter";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";

export type FinanceArea =
  | "finance_dashboard"
  | "driver_statements"
  | "merchant_statements"
  | "income"
  | "cod"
  | "expenses"
  | "accounts"
  | "adjustments"
  | "audit_log";

type FinanceView = FinanceArea | "budget";

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

const clean = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${numberValue(value).toFixed(2)} درهم` : `${numberValue(value).toFixed(2)} AED`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");

const views: Array<{
  id: FinanceView;
  ar: string;
  en: string;
  icon: typeof BarChart3;
}> = [
  { id: "finance_dashboard", ar: "الملخص المالي", en: "Finance summary", icon: BarChart3 },
  { id: "merchant_statements", ar: "كشوفات التجار", en: "Merchant statements", icon: Store },
  { id: "driver_statements", ar: "كشوفات المناديب", en: "Driver statements", icon: Truck },
  { id: "income", ar: "دخل داي نايت", en: "DAY NIGHT income", icon: Banknote },
  { id: "cod", ar: "التحصيل", en: "Collections", icon: WalletCards },
  { id: "expenses", ar: "المصروفات", en: "Expenses", icon: FileText },
  { id: "budget", ar: "الميزانية", en: "Budget", icon: PiggyBank },
  { id: "accounts", ar: "دفتر الحسابات", en: "Accounts ledger", icon: Landmark },
  { id: "adjustments", ar: "التسويات", en: "Adjustments", icon: Scale },
  { id: "audit_log", ar: "سجل التدقيق", en: "Audit log", icon: ShieldCheck },
];

const expenseCategories = [
  ["fuel", "وقود", "Fuel"],
  ["driver", "مندوبون", "Drivers"],
  ["maintenance", "صيانة", "Maintenance"],
  ["tolls", "رسوم طرق", "Tolls"],
  ["office", "مكتب", "Office"],
  ["software", "برمجيات", "Software"],
  ["marketing", "تسويق", "Marketing"],
  ["other", "أخرى", "Other"],
] as const;

function merchantName(merchantId: unknown, merchants: Merchant[]) {
  const id = clean(merchantId);
  const merchant = merchants.find((item) => item.id === id);
  return merchant?.trade_name || merchant?.owner_name || merchant?.merchant_code || id || "—";
}

function rowReference(row: FinanceLedgerRow) {
  return clean(
    row.order_reference ||
      row.tracking_number ||
      row.reference_number ||
      row.coupon_number ||
      row.order_id ||
      row.id ||
      "—",
  );
}

function rowDate(row: FinanceLedgerRow) {
  return clean(row.posted_at || row.expense_date || row.entry_date || row.created_at || row.updated_at || "—").slice(0, 10);
}

function rowStatus(row: FinanceLedgerRow) {
  return normalize(row.status || row.entry_type || row.direction || "—");
}

function statusText(status: string, isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    draft: ["مسودة", "Draft"],
    approved: ["معتمد", "Approved"],
    void: ["ملغي", "Void"],
    delivered_order_settlement: ["ترحيل طلب مُسلّم", "Delivered settlement"],
    credit: ["دائن", "Credit"],
    debit: ["مدين", "Debit"],
    positive: ["موجب", "Positive"],
    negative: ["سالب", "Negative"],
  };
  return labels[status] ? labels[status][isArabic ? 0 : 1] : status.replace(/_/g, " ");
}

function sourceText(source: FinanceLedgerSnapshot["source"], isArabic: boolean) {
  if (source === "rpc") return isArabic ? "RPC مالي مُراجع" : "Audited finance RPC";
  if (source === "tables") return isArabic ? "جداول الإنتاج" : "Production tables";
  return isArabic ? "مشتق من الطلبات — يحتاج Migration" : "Derived from orders — migration required";
}

function toneForSource(source: FinanceLedgerSnapshot["source"]) {
  return source === "rpc" ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : source === "tables" ? "border-brand-sky/35 bg-brand-sky/10 text-brand-sky" : "border-amber-300/35 bg-amber-300/10 text-amber-100";
}

function defaultExpense(): ExpenseDraft {
  return { expense_date: today(), category: "fuel", amount: "", payment_method: "cash", reference_number: "", notes: "" };
}

function defaultAdjustment(): AdjustmentDraft {
  return { adjustment_type: "manual", direction: "positive", amount: "", reference_number: "", reason: "", notes: "" };
}

function defaultBudget(): BudgetDraft {
  return { period_start: monthStart(), period_end: today(), category: "operations", allocated_amount: "", notes: "" };
}

function MetricCard({ label, value, hint, warning = false }: { label: string; value: string; hint: string; warning?: boolean }) {
  return (
    <article className={`rounded-[1.4rem] border p-4 ${warning ? "border-amber-300/35 bg-amber-300/10" : "border-white/10 bg-white/[0.045]"}`}>
      <span className="text-[11px] font-black text-white/48">{label}</span>
      <strong className={`mt-2 block text-xl font-black ${warning ? "text-amber-100" : "text-white"}`} dir="ltr">{value}</strong>
      <small className="mt-1 block text-[10px] font-bold text-white/42">{hint}</small>
    </article>
  );
}

export default function AdminFinanceOperationsCenter({
  isArabic,
  activeSection = "finance_dashboard",
  orders,
  merchants,
  financeSummary: _legacySummary,
  financeSummarySource: _legacySource,
  onRefresh,
  onNavigate,
}: Props) {
  const [view, setView] = useState<FinanceView>(activeSection);
  const [snapshot, setSnapshot] = useState<FinanceLedgerSnapshot | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(defaultExpense);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft>(defaultAdjustment);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>(defaultBudget);

  useEffect(() => setView(activeSection), [activeSection]);

  async function load(includeParent = false) {
    setBusy(true);
    setMessage("");
    try {
      if (includeParent) await onRefresh();
      const next = await fetchFinanceLedgerSnapshot(orders, dateFrom, dateTo);
      setSnapshot(next);
      if (next.warning) setMessage(isArabic ? "تم فتح مسار احتياطي موثوق؛ طبّق Migration المالية الجديدة للوضع الكامل." : next.warning);
    } catch (error) {
      console.warn("Finance center load failed:", error);
      setMessage(isArabic ? "تعذر تحميل دفتر المالية. راجع صلاحية الأدمن وMigration المالية." : "Could not load the finance ledger. Check admin access and the finance migration.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [dateFrom, dateTo, orders]);

  const rows = useMemo(() => {
    if (!snapshot) return [] as FinanceLedgerRow[];
    if (view === "merchant_statements" || view === "income" || view === "cod" || view === "finance_dashboard") return snapshot.settlements;
    if (view === "driver_statements") return snapshot.driverEntries;
    if (view === "expenses") return snapshot.expenses;
    if (view === "budget") return snapshot.budgets;
    if (view === "accounts") return snapshot.accountEntries;
    if (view === "adjustments") return snapshot.adjustments;
    return snapshot.auditEvents;
  }, [snapshot, view]);

  const visibleRows = useMemo(() => {
    const needle = normalize(query);
    return rows.filter((row) => !needle || normalize(Object.values(row).join(" ")).includes(needle)).slice(0, 500);
  }, [query, rows]);

  const summary = snapshot?.summary;
  const activeView = views.find((item) => item.id === view) || views[0];

  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: `DAY NIGHT · ${isArabic ? activeView.ar : activeView.en}`,
    filters: `${dateFrom} → ${dateTo} · ${query || (isArabic ? "بدون بحث" : "No search")}`,
    totals: summary
      ? {
          [isArabic ? "إجمالي العميل" : "Customer total"]: money(summary.customerTotal, isArabic),
          [isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"]: money(summary.deliveryRevenue, isArabic),
          [isArabic ? "مستحق التجار" : "Merchant due"]: money(summary.merchantDue, isArabic),
          [isArabic ? "المصروفات المعتمدة" : "Approved expenses"]: money(summary.approvedExpenses, isArabic),
          [isArabic ? "صافي التشغيل" : "Operating net"]: money(summary.operatingNet, isArabic),
        }
      : {},
    columns: [
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "reference", label: isArabic ? "المرجع" : "Reference" },
      { key: "entity", label: isArabic ? "الكيان" : "Entity" },
      { key: "type", label: isArabic ? "النوع" : "Type" },
      { key: "amount", label: isArabic ? "المبلغ" : "Amount" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "notes", label: isArabic ? "الملاحظات" : "Notes" },
    ],
    rows: visibleRows.map((row) => ({
      date: rowDate(row),
      reference: rowReference(row),
      entity: merchantName(row.merchant_id, merchants),
      type: statusText(normalize(row.entry_type || row.category || row.account_type || row.adjustment_type || "—"), isArabic),
      amount: money(row.amount ?? row.customer_total ?? row.company_revenue ?? row.merchant_due ?? row.allocated_amount, isArabic),
      status: statusText(rowStatus(row), isArabic),
      notes: clean(row.notes || row.reason || "—"),
    })),
  };

  async function execute(action: () => Promise<unknown>, successAr: string, successEn: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      playAdminAudioEvent("success");
      addAdminNotification({
        type: "success",
        sectionId: view,
        priority: "normal",
        dedupeKey: `finance:${view}:${Date.now()}`,
        titleAr: "تم حفظ العملية المالية",
        titleEn: "Finance operation saved",
        bodyAr: successAr,
        bodyEn: successEn,
      });
      setMessage(isArabic ? successAr : successEn);
      await load(true);
    } catch (error) {
      console.warn("Finance write failed:", error);
      setMessage(isArabic ? "لم تُحفظ العملية. راجع الحقول وMigration المالية وصلاحيات الأدمن." : "The operation was not saved. Check fields, finance migration, and admin permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function saveExpense() {
    await execute(
      () => createFinanceExpense(expenseDraft),
      "تم تسجيل المصروف كمسودة في قاعدة البيانات.",
      "The expense was saved as a database draft.",
    );
    setExpenseDraft(defaultExpense());
  }

  async function saveAdjustment() {
    await execute(
      () => createFinanceAdjustment(adjustmentDraft),
      "تم تسجيل التسوية كمسودة في قاعدة البيانات.",
      "The adjustment was saved as a database draft.",
    );
    setAdjustmentDraft(defaultAdjustment());
  }

  async function saveBudget() {
    await execute(
      () => upsertFinanceBudget(budgetDraft),
      "تم حفظ بند الميزانية وتحديث الانحراف الفعلي.",
      "The budget line and actual variance were updated.",
    );
    setBudgetDraft(defaultBudget());
  }

  const settlementTotals = useMemo(() => {
    const selected = visibleRows;
    return {
      goods: selected.reduce((total, row) => total + numberValue(row.goods_value), 0),
      delivery: selected.reduce((total, row) => total + numberValue(row.company_revenue ?? row.delivery_fee), 0),
      discount: selected.reduce((total, row) => total + numberValue(row.discount_amount), 0),
      customer: selected.reduce((total, row) => total + numberValue(row.customer_total), 0),
      merchant: selected.reduce((total, row) => total + numberValue(row.merchant_due), 0),
    };
  }, [visibleRows]);

  return (
    <section className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
      <header className="relative overflow-hidden rounded-[2rem] border border-brand-gold/25 bg-[#031226] p-6 shadow-2xl shadow-black/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(212,175,55,0.18),transparent_28rem),radial-gradient(circle_at_92%_0%,rgba(11,95,255,0.18),transparent_30rem)]" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold"><Landmark className="h-7 w-7" /></span>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold">DAY NIGHT FINANCE CONTROL</span>
              <h1 className="mt-2 text-3xl font-black text-white">{view === "merchant_statements" ? (isArabic ? "كشوفات التجار والطلبيات" : "Merchant Order Statements") : (isArabic ? "مركز المالية والميزانية" : "Finance & Budget Control Center")}</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-white/55">
                {view === "merchant_statements"
                  ? (isArabic ? "اختر أي تاجر مسجل، راجع طلباته كاملة، حدّد المطلوب ثم اطبع كشفاً احترافياً أو أرسله مباشرة إلى رقم واتساب المسجل." : "Choose any registered merchant, review the full order history, select exact orders, then export a professional statement or send it to the saved WhatsApp number.")
                  : isArabic
                  ? "مصدر واحد للحقيقة: ترحيلات الطلبات المسلّمة، مستحقات التجار، دخل داي نايت، المصروفات، التسويات والميزانية — بدون أرقام وهمية أو معادلات COD قديمة."
                  : "One source of truth for delivered settlements, merchant liabilities, DAY NIGHT revenue, expenses, adjustments, and budgets—without fake rows or legacy COD formulas."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${toneForSource(snapshot?.source || "orders")}`}>
              {snapshot?.source === "rpc" ? <BadgeCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {sourceText(snapshot?.source || "orders", isArabic)}
            </span>
            <button type="button" disabled={busy} onClick={() => void load(true)} className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/35 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isArabic ? "تحديث شامل" : "Full refresh"}
            </button>
            {view !== "merchant_statements" && <AdminPdfExportButton payload={pdfPayload} />}
          </div>
        </div>
      </header>

      {message && <p className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-xs font-bold leading-6 text-brand-gold">{message}</p>}

      {view !== "merchant_statements" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={isArabic ? "المحصل من العملاء" : "Collected from customers"} value={money(summary?.collectedAmount, isArabic)} hint={isArabic ? "من الطلبات المُرحّلة" : "Posted settlements"} />
        <MetricCard label={isArabic ? "مستحق التجار" : "Merchant due"} value={money(summary?.merchantDue, isArabic)} hint={isArabic ? "بعد التوصيل والخصم" : "After fee and discount"} />
        <MetricCard label={isArabic ? "دخل داي نايت" : "DAY NIGHT revenue"} value={money(summary?.deliveryRevenue, isArabic)} hint={isArabic ? "رسوم التوصيل" : "Delivery fees"} />
        <MetricCard label={isArabic ? "المصروفات المعتمدة" : "Approved expenses"} value={money(summary?.approvedExpenses, isArabic)} hint={isArabic ? "المسودات لا تخصم" : "Drafts excluded"} />
        <MetricCard label={isArabic ? "صافي التشغيل" : "Operating net"} value={money(summary?.operatingNet, isArabic)} hint={isArabic ? "الدخل − المصروف + التسويات" : "Revenue − expense + adjustments"} warning={numberValue(summary?.operatingNet) < 0} />
      </div>}

      {view !== "merchant_statements" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={isArabic ? "قيمة البضاعة" : "Goods value"} value={money(summary?.goodsValue, isArabic)} hint={isArabic ? "طلبات مسلّمة" : "Delivered orders"} />
        <MetricCard label={isArabic ? "الخصومات" : "Discounts"} value={money(summary?.discounts, isArabic)} hint={isArabic ? "مسجلة عند الإدخال" : "Fixed at entry"} />
        <MetricCard label={isArabic ? "تحصيل معلق" : "Pending collection"} value={money(summary?.pendingCollection, isArabic)} hint={isArabic ? "يحتاج متابعة" : "Needs follow-up"} warning={numberValue(summary?.pendingCollection) > 0} />
        <MetricCard label={isArabic ? "مُسلّم غير مُرحّل" : "Delivered, not posted"} value={String(summary?.unpostedDeliveredOrders ?? 0)} hint={isArabic ? "يجب أن يكون صفر" : "Must be zero"} warning={numberValue(summary?.unpostedDeliveredOrders) > 0} />
      </div>}

      <nav className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-[#031226] p-2 sm:grid-cols-2 lg:grid-cols-5">
        {views.map(({ id, ar, en, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setView(id);
              if (id !== "budget" && id !== activeSection) onNavigate(id);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[11px] font-black transition ${view === id ? "bg-brand-gold text-brand-deep" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
          >
            <Icon className="h-4 w-4" />
            {isArabic ? ar : en}
          </button>
        ))}
      </nav>

      <section className="grid gap-4 rounded-[1.6rem] border border-white/10 bg-[#031226] p-4 lg:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-xs font-black text-white/55">{isArabic ? "من تاريخ" : "From"}</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none focus:border-brand-gold/50" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black text-white/55">{isArabic ? "إلى تاريخ" : "To"}</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none focus:border-brand-gold/50" />
        </label>
        <label className="block lg:min-w-[280px]">
          <span className="mb-2 block text-xs font-black text-white/55">{isArabic ? "بحث داخل القسم" : "Search section"}</span>
          <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 focus-within:border-brand-gold/50">
            <Search className="h-4 w-4 text-white/35" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "مرجع، تاجر، تصنيف..." : "Reference, merchant, category..."} />
          </span>
        </label>
      </section>

      {view === "merchant_statements" && (
        <AdminMerchantStatementsCenter
          isArabic={isArabic}
          merchants={merchants}
          orders={orders}
          dateFrom={dateFrom}
          dateTo={dateTo}
          query={query}
          onNavigate={onNavigate}
        />
      )}

      {view === "expenses" && (
        <section className="rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><FileText className="h-5 w-5 text-brand-gold" />{isArabic ? "تسجيل مصروف حقيقي" : "Record a real expense"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input type="date" value={expenseDraft.expense_date} onChange={(event) => setExpenseDraft((value) => ({ ...value, expense_date: event.target.value }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <select value={expenseDraft.category} onChange={(event) => setExpenseDraft((value) => ({ ...value, category: event.target.value }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white">
              {expenseCategories.map(([value, ar, en]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft((value) => ({ ...value, amount: event.target.value }))} placeholder={isArabic ? "المبلغ" : "Amount"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <select value={expenseDraft.payment_method} onChange={(event) => setExpenseDraft((value) => ({ ...value, payment_method: event.target.value }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white">
              <option value="cash">{isArabic ? "نقدي" : "Cash"}</option><option value="bank">{isArabic ? "بنك" : "Bank"}</option><option value="card">{isArabic ? "بطاقة" : "Card"}</option>
            </select>
            <input value={expenseDraft.reference_number} onChange={(event) => setExpenseDraft((value) => ({ ...value, reference_number: event.target.value }))} placeholder={isArabic ? "رقم الفاتورة/المرجع" : "Invoice/reference"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <input value={expenseDraft.notes} onChange={(event) => setExpenseDraft((value) => ({ ...value, notes: event.target.value }))} placeholder={isArabic ? "ملاحظات" : "Notes"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white md:col-span-2" />
            <button type="button" disabled={busy || numberValue(expenseDraft.amount) <= 0} onClick={() => void saveExpense()} className="rounded-xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep disabled:opacity-50">{isArabic ? "حفظ كمسودة" : "Save draft"}</button>
          </div>
          <p className="mt-3 text-xs font-bold text-white/42">{isArabic ? "لا يدخل المصروف في صافي التشغيل إلا بعد الاعتماد. الإلغاء يبقي أثر التدقيق ولا يحذف السجل." : "Only approved expenses affect operating net. Voiding preserves the audit trail."}</p>
        </section>
      )}

      {view === "adjustments" && (
        <section className="rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><Scale className="h-5 w-5 text-brand-gold" />{isArabic ? "تسوية مالية خاضعة للاعتماد" : "Approval-controlled adjustment"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={adjustmentDraft.direction} onChange={(event) => setAdjustmentDraft((value) => ({ ...value, direction: event.target.value as "positive" | "negative" }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white"><option value="positive">{isArabic ? "إضافة" : "Positive"}</option><option value="negative">{isArabic ? "خصم" : "Negative"}</option></select>
            <input type="number" min="0" step="0.01" value={adjustmentDraft.amount} onChange={(event) => setAdjustmentDraft((value) => ({ ...value, amount: event.target.value }))} placeholder={isArabic ? "المبلغ" : "Amount"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <input value={adjustmentDraft.reference_number} onChange={(event) => setAdjustmentDraft((value) => ({ ...value, reference_number: event.target.value }))} placeholder={isArabic ? "مرجع" : "Reference"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <input value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft((value) => ({ ...value, reason: event.target.value }))} placeholder={isArabic ? "السبب الإلزامي" : "Required reason"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <input value={adjustmentDraft.notes} onChange={(event) => setAdjustmentDraft((value) => ({ ...value, notes: event.target.value }))} placeholder={isArabic ? "ملاحظات" : "Notes"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white md:col-span-2" />
            <button type="button" disabled={busy || numberValue(adjustmentDraft.amount) <= 0 || !clean(adjustmentDraft.reason)} onClick={() => void saveAdjustment()} className="rounded-xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep disabled:opacity-50">{isArabic ? "حفظ التسوية" : "Save adjustment"}</button>
          </div>
        </section>
      )}

      {view === "budget" && (
        <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label={isArabic ? "الميزانية المعتمدة" : "Allocated budget"} value={money(summary?.budgetAllocated, isArabic)} hint={`${dateFrom} → ${dateTo}`} />
            <MetricCard label={isArabic ? "المصروف الفعلي" : "Actual approved spend"} value={money(summary?.budgetSpent, isArabic)} hint={isArabic ? "مصروفات معتمدة فقط" : "Approved expenses only"} />
            <MetricCard label={isArabic ? "المتبقي/التجاوز" : "Remaining / overrun"} value={money(summary?.budgetRemaining, isArabic)} hint={isArabic ? "السالب يعني تجاوز" : "Negative means overrun"} warning={numberValue(summary?.budgetRemaining) < 0} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input type="date" value={budgetDraft.period_start} onChange={(event) => setBudgetDraft((value) => ({ ...value, period_start: event.target.value }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <input type="date" value={budgetDraft.period_end} onChange={(event) => setBudgetDraft((value) => ({ ...value, period_end: event.target.value }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <select value={budgetDraft.category} onChange={(event) => setBudgetDraft((value) => ({ ...value, category: event.target.value }))} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white"><option value="operations">{isArabic ? "تشغيل" : "Operations"}</option>{expenseCategories.map(([value, ar, en]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}</select>
            <input type="number" min="0" step="0.01" value={budgetDraft.allocated_amount} onChange={(event) => setBudgetDraft((value) => ({ ...value, allocated_amount: event.target.value }))} placeholder={isArabic ? "المبلغ المعتمد" : "Allocated amount"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white" />
            <button type="button" disabled={busy || numberValue(budgetDraft.allocated_amount) < 0} onClick={() => void saveBudget()} className="rounded-xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep disabled:opacity-50">{isArabic ? "حفظ الميزانية" : "Save budget"}</button>
            <input value={budgetDraft.notes} onChange={(event) => setBudgetDraft((value) => ({ ...value, notes: event.target.value }))} placeholder={isArabic ? "ملاحظات الميزانية" : "Budget notes"} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white md:col-span-2 xl:col-span-5" />
          </div>
        </section>
      )}

      {(view === "finance_dashboard" || view === "income" || view === "cod") && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label={isArabic ? "البضاعة الظاهرة" : "Visible goods"} value={money(settlementTotals.goods, isArabic)} hint={`${visibleRows.length} ${isArabic ? "صف" : "rows"}`} />
          <MetricCard label={isArabic ? "التوصيل الظاهر" : "Visible delivery"} value={money(settlementTotals.delivery, isArabic)} hint={isArabic ? "دخل الشركة" : "Company income"} />
          <MetricCard label={isArabic ? "الخصم الظاهر" : "Visible discount"} value={money(settlementTotals.discount, isArabic)} hint={isArabic ? "مثبت بالطلب" : "Order snapshot"} />
          <MetricCard label={isArabic ? "إجمالي العميل" : "Customer total"} value={money(settlementTotals.customer, isArabic)} hint={isArabic ? "المبلغ المحصل" : "Collected total"} />
          <MetricCard label={isArabic ? "مستحق التاجر" : "Merchant due"} value={money(settlementTotals.merchant, isArabic)} hint={isArabic ? "التزام الشركة" : "Company liability"} />
        </div>
      )}

      {view !== "merchant_statements" && <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-brand-gold">{isArabic ? activeView.ar : activeView.en}</p>
            <h2 className="mt-1 text-xl font-black text-white">{visibleRows.length} {isArabic ? "صف مالي حقيقي" : "real finance rows"}</h2>
          </div>
          {view === "finance_dashboard" && <button type="button" onClick={() => setView("budget")} className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-xs font-black text-brand-gold"><PiggyBank className="h-4 w-4" />{isArabic ? "فتح الميزانية" : "Open budget"}</button>}
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-start text-xs">
            <thead className="bg-white/[0.045] text-white/55">
              <tr>
                <th className="px-4 py-3">{isArabic ? "التاريخ" : "Date"}</th>
                <th className="px-4 py-3">{isArabic ? "المرجع" : "Reference"}</th>
                <th className="px-4 py-3">{isArabic ? "التاجر/الكيان" : "Merchant/entity"}</th>
                <th className="px-4 py-3">{isArabic ? "النوع" : "Type"}</th>
                <th className="px-4 py-3">{isArabic ? "التفصيل المالي" : "Financial detail"}</th>
                <th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th>
                {(view === "expenses" || view === "adjustments") && <th className="px-4 py-3">{isArabic ? "الإجراءات" : "Actions"}</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const status = rowStatus(row);
                const isExpense = view === "expenses";
                const isAdjustment = view === "adjustments";
                const budget = row as FinanceBudgetRow;
                return (
                  <tr key={clean(row.id) || `${view}-${index}`} className="border-t border-white/7 text-white/75">
                    <td className="whitespace-nowrap px-4 py-3">{rowDate(row)}</td>
                    <td className="max-w-[180px] break-words px-4 py-3 font-black text-white">{rowReference(row)}</td>
                    <td className="px-4 py-3">{merchantName(row.merchant_id, merchants)}</td>
                    <td className="px-4 py-3">{statusText(normalize(row.entry_type || row.category || row.account_type || row.adjustment_type || "—"), isArabic)}</td>
                    <td className="px-4 py-3">
                      {view === "budget" ? (
                        <div className="grid min-w-[220px] gap-1 sm:grid-cols-2">
                          <span>{isArabic ? "معتمد" : "Allocated"}: <b dir="ltr">{money(budget.allocated_amount, isArabic)}</b></span>
                          <span>{isArabic ? "مصروف" : "Spent"}: <b dir="ltr">{money(budget.spent_amount, isArabic)}</b></span>
                          <span>{isArabic ? "متبقي" : "Remaining"}: <b dir="ltr">{money(budget.remaining_amount, isArabic)}</b></span>
                          <span>{isArabic ? "استخدام" : "Utilization"}: <b dir="ltr">{numberValue(budget.utilization_percent).toFixed(1)}%</b></span>
                        </div>
                      ) : row.customer_total !== undefined || row.goods_value !== undefined ? (
                        <div className="grid min-w-[250px] gap-1 sm:grid-cols-2">
                          <span>{isArabic ? "بضاعة" : "Goods"}: <b dir="ltr">{money(row.goods_value, isArabic)}</b></span>
                          <span>{isArabic ? "توصيل" : "Delivery"}: <b dir="ltr">{money(row.company_revenue ?? row.delivery_fee, isArabic)}</b></span>
                          <span>{isArabic ? "خصم" : "Discount"}: <b dir="ltr">{money(row.discount_amount, isArabic)}</b></span>
                          <span>{isArabic ? "العميل" : "Customer"}: <b dir="ltr">{money(row.customer_total, isArabic)}</b></span>
                          <span>{isArabic ? "التاجر" : "Merchant"}: <b dir="ltr">{money(row.merchant_due, isArabic)}</b></span>
                          <span>{isArabic ? "المحصل" : "Collected"}: <b dir="ltr">{money(row.collected_amount, isArabic)}</b></span>
                        </div>
                      ) : (
                        <strong dir="ltr" className={normalize(row.direction) === "debit" || normalize(row.direction) === "negative" ? "text-rose-200" : "text-emerald-200"}>{money(row.amount, isArabic)}</strong>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${status === "approved" || status === "credit" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : status === "void" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"}`}>{statusText(status, isArabic)}</span></td>
                    {(isExpense || isAdjustment) && (
                      <td className="px-4 py-3">
                        <div className="flex min-w-[190px] gap-2">
                          <button type="button" disabled={busy || status !== "draft" || !row.id} onClick={() => void execute(() => isExpense ? setFinanceExpenseStatus(clean(row.id), "approved") : setFinanceAdjustmentStatus(clean(row.id), "approved"), isArabic ? "تم الاعتماد وترحيل الأثر المالي." : "Approved and posted to finance.", "Approved and posted to finance.")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-200 disabled:opacity-35"><CheckCircle2 className="h-3.5 w-3.5" />{isArabic ? "اعتماد" : "Approve"}</button>
                          <button type="button" disabled={busy || status === "void" || !row.id} onClick={() => void execute(() => isExpense ? setFinanceExpenseStatus(clean(row.id), "void", "Voided by admin") : setFinanceAdjustmentStatus(clean(row.id), "void", "Voided by admin"), isArabic ? "تم الإلغاء مع الاحتفاظ بأثر التدقيق." : "Voided with audit trail preserved.", "Voided with audit trail preserved.")} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] font-black text-rose-200 disabled:opacity-35"><XCircle className="h-3.5 w-3.5" />{isArabic ? "إلغاء" : "Void"}</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleRows.length && (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <div><ClipboardList className="mx-auto h-9 w-9 text-brand-gold" /><h3 className="mt-3 text-lg font-black text-white">{isArabic ? "لا توجد صفوف في الفترة المحددة" : "No rows in the selected period"}</h3><p className="mt-2 text-xs font-bold text-white/45">{isArabic ? "النظام لا يعرض بيانات وهمية. أنشئ حركة حقيقية أو غيّر الفترة." : "No fake rows are shown. Create a real transaction or change the period."}</p></div>
            </div>
          )}
        </div>
      </section>}

      <footer className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#031226] p-4 md:grid-cols-3">
        <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-brand-gold" /><div><span className="text-[10px] font-black text-white/40">{isArabic ? "الفترة" : "Period"}</span><strong className="block text-xs text-white">{dateFrom} → {dateTo}</strong></div></div>
        <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-brand-sky" /><div><span className="text-[10px] font-black text-white/40">{isArabic ? "آخر توليد" : "Generated"}</span><strong className="block text-xs text-white">{snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleString(isArabic ? "ar-AE" : "en-AE") : "—"}</strong></div></div>
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /><div><span className="text-[10px] font-black text-white/40">{isArabic ? "قاعدة الحساب" : "Accounting rule"}</span><strong className="block text-xs text-white">{isArabic ? "التسليم يرحّل مرة واحدة" : "Delivery posts once"}</strong></div></div>
      </footer>
    </section>
  );
}
