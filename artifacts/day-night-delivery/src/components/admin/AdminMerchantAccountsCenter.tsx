import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  ClipboardCheck,
  FileText,
  Landmark,
  PackageCheck,
  Phone,
  Search,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { Merchant, Order } from "../../types";
import type { FinanceLedgerRow } from "../../lib/adminFinanceLedger";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import AdminPdfExportButton from "./AdminPdfExportButton";

type Props = {
  isArabic: boolean;
  merchants: Merchant[];
  orders: Order[];
  accountEntries: FinanceLedgerRow[];
  settlements: FinanceLedgerRow[];
  query: string;
  dateFrom: string;
  dateTo: string;
  onNavigate: (id: string) => void;
};

type AccountTab = "overview" | "orders" | "ledger";

type GroupedLedgerRow = {
  row: FinanceLedgerRow;
  duplicateCount: number;
  key: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s_-]+/g, "");
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${numberValue(value).toFixed(2)} درهم` : `${numberValue(value).toFixed(2)} AED`;

function ownsOrder(order: Order, merchantId: string) {
  return Boolean(normalize(merchantId) && normalize(order.merchant_id) === normalize(merchantId));
}

function ownsLedgerRow(row: FinanceLedgerRow, merchantId: string) {
  return Boolean(normalize(merchantId) && normalize(row.merchant_id) === normalize(merchantId));
}

function orderReference(order: Order) {
  return clean(
    order.tracking_number ||
      order.tracking_code ||
      order.invoice_number ||
      order.invoiceNumber ||
      order.coupon_number ||
      order.id ||
      "—",
  );
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
  return clean(row.posted_at || row.entry_date || row.created_at || row.updated_at || "—").slice(0, 16).replace("T", " ");
}

function rowType(row: FinanceLedgerRow, isArabic: boolean) {
  const type = normalize(row.entry_type || row.account_type || row.category || row.direction || "entry");
  const labels: Record<string, [string, string]> = {
    delivered_order_settlement: ["ترحيل طلب مُسلّم", "Delivered order settlement"],
    merchant_payable: ["مستحق تاجر", "Merchant payable"],
    company_revenue: ["دخل داي نايت", "DAY NIGHT revenue"],
    customer_collection: ["تحصيل عميل", "Customer collection"],
    debit: ["مدين", "Debit"],
    credit: ["دائن", "Credit"],
    entry: ["حركة مالية", "Finance entry"],
  };
  return labels[type]?.[isArabic ? 0 : 1] || type.replace(/_/g, " ");
}

function rowAmount(row: FinanceLedgerRow) {
  return numberValue(
    row.amount ??
      row.merchant_due ??
      row.customer_total ??
      row.company_revenue ??
      row.delivery_fee ??
      0,
  );
}

function orderGoods(order: Order) {
  return numberValue(order.goods_value ?? order.product_value ?? order.merchant_goods_value ?? 0);
}

function orderDelivery(order: Order) {
  return numberValue(order.company_revenue ?? order.delivery_fee ?? order.delivery_price ?? 0);
}

function orderCustomer(order: Order) {
  return numberValue(order.customer_total ?? order.total_amount ?? order.total ?? order.collected_amount ?? 0);
}

function orderMerchantDue(order: Order) {
  return numberValue(order.merchant_due ?? 0);
}

function ledgerGroupingKey(row: FinanceLedgerRow) {
  return [
    clean(row.order_id),
    rowReference(row),
    normalize(row.entry_type || row.account_type || row.category),
    normalize(row.direction),
    rowAmount(row).toFixed(2),
    rowDate(row),
  ].join("|");
}

function groupDuplicateLedgerRows(rows: FinanceLedgerRow[]): GroupedLedgerRow[] {
  const grouped = new Map<string, GroupedLedgerRow>();
  rows.forEach((row) => {
    const key = ledgerGroupingKey(row);
    const current = grouped.get(key);
    if (current) current.duplicateCount += 1;
    else grouped.set(key, { row, duplicateCount: 1, key });
  });
  return [...grouped.values()].sort((a, b) => rowDate(b.row).localeCompare(rowDate(a.row)));
}

function statusText(value: unknown, isArabic: boolean) {
  const status = normalize(value);
  const labels: Record<string, [string, string]> = {
    delivered: ["تم التسليم", "Delivered"],
    pending: ["جديد", "Pending"],
    assigned: ["مسند", "Assigned"],
    in_transit: ["في الطريق", "In transit"],
    cancelled: ["ملغي", "Cancelled"],
    returned: ["راجع", "Returned"],
    approved: ["معتمد", "Approved"],
    posted: ["مُرحّل", "Posted"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || status.replace(/_/g, " ") || "—";
}

export default function AdminMerchantAccountsCenter({
  isArabic,
  merchants,
  orders,
  accountEntries,
  settlements,
  query,
  dateFrom,
  dateTo,
  onNavigate,
}: Props) {
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [merchantQuery, setMerchantQuery] = useState("");
  const [detailQuery, setDetailQuery] = useState("");
  const [tab, setTab] = useState<AccountTab>("overview");

  const merchantRows = useMemo(
    () => merchants.map((merchant) => {
      const merchantOrders = orders.filter((order) => ownsOrder(order, merchant.id));
      const merchantSettlements = settlements.filter((row) => ownsLedgerRow(row, merchant.id));
      const merchantLedger = accountEntries.filter((row) => ownsLedgerRow(row, merchant.id));
      return { merchant, merchantOrders, merchantSettlements, merchantLedger };
    }),
    [accountEntries, merchants, orders, settlements],
  );

  const visibleMerchants = useMemo(
    () => merchantRows
      .filter(({ merchant }) => matchesSearchQuery([
        merchant.trade_name,
        merchant.owner_name,
        merchant.merchant_code,
        merchant.phone,
        merchant.email,
        merchant.city,
        merchant.emirate,
      ], `${query} ${merchantQuery}`))
      .sort((a, b) => b.merchantOrders.length - a.merchantOrders.length),
    [merchantQuery, merchantRows, query],
  );

  const selected = merchantRows.find(({ merchant }) => merchant.id === selectedMerchantId) || null;

  function selectMerchant(id: string) {
    setSelectedMerchantId(id);
    setDetailQuery("");
    setTab("overview");
  }

  if (!selected) {
    return (
      <section data-admin-merchant-accounts-directory="true" className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-4 sm:p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold"><Landmark className="h-4 w-4" />{isArabic ? "حسابات التجار" : "Merchant accounts"}</span>
            <h2 className="mt-2 text-2xl font-black text-white">{isArabic ? "اختر التاجر لفتح ملفه المالي" : "Choose a merchant to open the finance file"}</h2>
            <p className="mt-2 max-w-3xl text-xs font-bold leading-6 text-white/45">{isArabic ? "كل تاجر يظهر في ملف مستقل بالـUUID الحقيقي: ملخص الحساب، طلبياته، وحركاته المالية. لا يوجد خلط بين التجار." : "Every merchant opens in an exact-UUID isolated file containing the summary, orders, and ledger. Merchant data is never mixed."}</p>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 lg:min-w-[340px]">
            <Search className="h-4 w-4 text-white/35" />
            <input value={merchantQuery} onChange={(event) => setMerchantQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "اسم التاجر، الكود، الهاتف..." : "Merchant, code, phone..."} />
          </label>
        </header>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleMerchants.map(({ merchant, merchantOrders, merchantLedger }) => {
            const delivered = merchantOrders.filter((order) => normalize(order.status) === "delivered").length;
            const due = merchantOrders.reduce((sum, order) => sum + orderMerchantDue(order), 0);
            return (
              <article key={merchant.id} className="rounded-[1.45rem] border border-white/10 bg-[#071A33] p-4 transition hover:border-brand-gold/35">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold"><Store className="h-5 w-5" /></span>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-200">{isArabic ? "ملف مستقل" : "Isolated file"}</span>
                </div>
                <h3 className="mt-3 text-lg font-black text-white">{merchant.trade_name || merchant.owner_name || "—"}</h3>
                <p className="mt-1 text-[11px] font-bold text-white/45" dir="ltr">{merchant.merchant_code || "—"} · {merchant.phone || "—"}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
                  <span><b className="block text-sm text-white">{merchantOrders.length}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "طلب" : "orders"}</small></span>
                  <span><b className="block text-sm text-emerald-200">{delivered}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "مُسلّم" : "delivered"}</small></span>
                  <span><b className="block text-sm text-brand-gold">{merchantLedger.length}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "حركة" : "entries"}</small></span>
                </div>
                <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-[10px] font-black text-white/55">{due < 0 ? (isArabic ? "على التاجر" : "Merchant debit") : (isArabic ? "للتاجر" : "Due to merchant")}: <b className="text-brand-gold" dir="ltr">{money(due, isArabic)}</b></p>
                <button type="button" onClick={() => selectMerchant(merchant.id)} className="mt-3 w-full rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2.5 text-xs font-black text-brand-gold">{isArabic ? "فتح الحساب والطلبيات" : "Open account and orders"}</button>
              </article>
            );
          })}
        </div>
        {!visibleMerchants.length && <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-sm font-bold text-white/45">{isArabic ? "لا يوجد تاجر مطابق للبحث." : "No merchant matches the search."}</div>}
      </section>
    );
  }

  const merchant = selected.merchant;
  const merchantOrders = selected.merchantOrders
    .filter((order) => matchesSearchQuery([
      orderReference(order),
      order.coupon_number,
      order.receiver_name,
      order.receiver_phone,
      order.receiver_city,
      order.status,
    ], detailQuery))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  const merchantLedger = selected.merchantLedger.filter((row) => matchesSearchQuery(Object.values(row), detailQuery));
  const groupedLedger = groupDuplicateLedgerRows(merchantLedger);
  const deliveredOrders = selected.merchantOrders.filter((order) => normalize(order.status) === "delivered");
  const goodsTotal = deliveredOrders.reduce((sum, order) => sum + orderGoods(order), 0);
  const deliveryTotal = deliveredOrders.reduce((sum, order) => sum + orderDelivery(order), 0);
  const customerTotal = deliveredOrders.reduce((sum, order) => sum + orderCustomer(order), 0);
  const merchantDue = deliveredOrders.reduce((sum, order) => sum + orderMerchantDue(order), 0);
  const collapsedDuplicates = groupedLedger.reduce((sum, item) => sum + Math.max(0, item.duplicateCount - 1), 0);
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const pdfPayload = {
    language: isArabic ? ("ar" as const) : ("en" as const),
    sectionTitle: `${isArabic ? "كشف حساب التاجر" : "Merchant account statement"} · ${merchant.trade_name || merchant.owner_name || merchant.merchant_code}`,
    filters: `${dateFrom} → ${dateTo} · ${merchant.merchant_code || merchant.id}`,
    totals: {
      [isArabic ? "عدد الطلبيات" : "Orders"]: String(selected.merchantOrders.length),
      [isArabic ? "الطلبات المسلّمة" : "Delivered"]: String(deliveredOrders.length),
      [isArabic ? "إجمالي قيمة البضاعة" : "Goods total"]: money(goodsTotal, isArabic),
      [isArabic ? "رسوم التوصيل" : "Delivery fees"]: money(deliveryTotal, isArabic),
      [isArabic ? "مستحق التاجر" : "Merchant due"]: money(merchantDue, isArabic),
    },
    columns: [
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "reference", label: isArabic ? "المرجع" : "Reference" },
      { key: "type", label: isArabic ? "نوع الحركة" : "Entry type" },
      { key: "amount", label: isArabic ? "المبلغ" : "Amount" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
      { key: "notes", label: isArabic ? "الملاحظات" : "Notes" },
    ],
    rows: groupedLedger.length
      ? groupedLedger.map(({ row, duplicateCount }) => ({
          date: rowDate(row),
          reference: rowReference(row),
          type: rowType(row, isArabic),
          amount: money(rowAmount(row), isArabic),
          status: statusText(row.status || row.direction, isArabic),
          notes: duplicateCount > 1
            ? isArabic
              ? `تم دمج ${duplicateCount} سجلات متطابقة بصريًا دون حذفها من قاعدة البيانات.`
              : `${duplicateCount} identical records were visually collapsed without deleting database rows.`
            : clean(row.notes || row.reason || "—"),
        }))
      : merchantOrders.map((order) => ({
          date: clean(order.created_at).slice(0, 10),
          reference: orderReference(order),
          type: isArabic ? "طلبية" : "Order",
          amount: money(orderMerchantDue(order), isArabic),
          status: statusText(order.status, isArabic),
          notes: order.receiver_name || "—",
        })),
  };

  const tabs: Array<{ id: AccountTab; ar: string; en: string }> = [
    { id: "overview", ar: "ملخص الحساب", en: "Account summary" },
    { id: "orders", ar: "طلبيات التاجر", en: "Merchant orders" },
    { id: "ledger", ar: "الحركات المالية", en: "Finance ledger" },
  ];

  return (
    <section data-admin-merchant-account-file="true" className="space-y-4">
      <header className="rounded-[1.8rem] border border-brand-gold/25 bg-[#031226] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setSelectedMerchantId("")} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white" aria-label={isArabic ? "الرجوع للتجار" : "Back to merchants"}><BackIcon className="h-5 w-5" /></button>
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold"><Landmark className="h-6 w-6" /></span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold">MERCHANT FINANCE FILE</span>
              <h2 className="mt-1 text-2xl font-black text-white">{merchant.trade_name || merchant.owner_name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-white/48">
                <span><UserRound className="inline h-3.5 w-3.5" /> {merchant.owner_name || "—"}</span>
                <span dir="ltr"><Phone className="inline h-3.5 w-3.5" /> {merchant.phone || "—"}</span>
                <span dir="ltr">{merchant.merchant_code || merchant.id}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminPdfExportButton payload={pdfPayload} label={isArabic ? "كشف حساب التاجر PDF" : "Merchant account PDF"} />
            <button type="button" onClick={() => onNavigate("merchant_statements")} className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold"><FileText className="h-4 w-4" />{isArabic ? "كشوف الطلبيات PDF" : "Order PDF statements"}</button>
            <button type="button" onClick={() => onNavigate("all_orders")} className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"><ClipboardCheck className="h-4 w-4" />{isArabic ? "إدارة الطلبات" : "Manage orders"}</button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-2xl border border-white/10 bg-[#031226] p-4"><span className="text-[10px] font-black text-white/45">{isArabic ? "كل الطلبيات" : "All orders"}</span><strong className="mt-2 block text-xl text-white">{selected.merchantOrders.length}</strong></article>
        <article className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4"><span className="text-[10px] font-black text-emerald-200/70">{isArabic ? "تم التسليم" : "Delivered"}</span><strong className="mt-2 block text-xl text-emerald-200">{deliveredOrders.length}</strong></article>
        <article className="rounded-2xl border border-white/10 bg-[#031226] p-4"><span className="text-[10px] font-black text-white/45">{isArabic ? "قيمة البضاعة" : "Goods value"}</span><strong className="mt-2 block text-sm text-white" dir="ltr">{money(goodsTotal, isArabic)}</strong></article>
        <article className="rounded-2xl border border-brand-sky/25 bg-brand-sky/[0.07] p-4"><span className="text-[10px] font-black text-brand-sky/70">{isArabic ? "رسوم التوصيل" : "Delivery fees"}</span><strong className="mt-2 block text-sm text-brand-sky" dir="ltr">{money(deliveryTotal, isArabic)}</strong></article>
        <article className="rounded-2xl border border-brand-gold/25 bg-brand-gold/[0.07] p-4"><span className="text-[10px] font-black text-brand-gold/70">{merchantDue < 0 ? (isArabic ? "على التاجر" : "Merchant debit") : (isArabic ? "للتاجر" : "Due to merchant")}</span><strong className="mt-2 block text-sm text-brand-gold" dir="ltr">{money(merchantDue, isArabic)}</strong></article>
        <article className="rounded-2xl border border-white/10 bg-[#031226] p-4"><span className="text-[10px] font-black text-white/45">{isArabic ? "حركات مكررة مطوية" : "Collapsed duplicate rows"}</span><strong className="mt-2 block text-xl text-white">{collapsedDuplicates}</strong></article>
      </div>

      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="space-y-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-xl border px-4 py-2.5 text-xs font-black ${tab === item.id ? "border-brand-gold/35 bg-brand-gold/10 text-brand-gold" : "border-white/10 bg-white/5 text-white/55"}`}>{isArabic ? item.ar : item.en}</button>)}
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 lg:min-w-[320px]"><Search className="h-4 w-4 text-white/35" /><input value={detailQuery} onChange={(event) => setDetailQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "بحث داخل حساب التاجر فقط..." : "Search this merchant only..."} /></label>
          </div>
          {collapsedDuplicates > 0 && <p className="rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-[10px] font-bold text-amber-100">{isArabic ? "تم طي الصفوف المتطابقة بصريًا لمنع الزحمة فقط؛ لم يتم حذف أو تعديل أي سجل مالي في قاعدة البيانات." : "Identical rows are visually collapsed to remove clutter only; no financial database row was deleted or changed."}</p>}
        </header>

        {tab === "overview" && (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h3 className="flex items-center gap-2 text-lg font-black text-white"><WalletCards className="h-5 w-5 text-brand-gold" />{isArabic ? "الخلاصة المالية" : "Financial summary"}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><p className="rounded-xl bg-white/5 p-3 text-xs font-bold text-white/55">{isArabic ? "إجمالي العميل" : "Customer total"}<b className="mt-1 block text-white" dir="ltr">{money(customerTotal, isArabic)}</b></p><p className="rounded-xl bg-white/5 p-3 text-xs font-bold text-white/55">{isArabic ? "رسوم التوصيل" : "Delivery fees"}<b className="mt-1 block text-brand-sky" dir="ltr">{money(deliveryTotal, isArabic)}</b></p><p className="rounded-xl bg-white/5 p-3 text-xs font-bold text-white/55">{isArabic ? "قيمة البضاعة" : "Goods value"}<b className="mt-1 block text-white" dir="ltr">{money(goodsTotal, isArabic)}</b></p><p className="rounded-xl bg-white/5 p-3 text-xs font-bold text-white/55">{isArabic ? "الرصيد النهائي" : "Final balance"}<b className="mt-1 block text-brand-gold" dir="ltr">{money(merchantDue, isArabic)}</b></p></div></article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h3 className="flex items-center gap-2 text-lg font-black text-white"><PackageCheck className="h-5 w-5 text-brand-sky" />{isArabic ? "حالة التشغيل" : "Operations status"}</h3><div className="mt-4 space-y-3 text-xs font-bold text-white/55"><p>{isArabic ? "الطلبات المسلّمة" : "Delivered orders"}: <b className="text-emerald-200">{deliveredOrders.length}</b></p><p>{isArabic ? "الطلبات غير المكتملة" : "Open/non-final orders"}: <b className="text-brand-gold">{Math.max(0, selected.merchantOrders.length - deliveredOrders.length)}</b></p><p>{isArabic ? "سجلات دفتر الحساب" : "Ledger database rows"}: <b className="text-white">{selected.merchantLedger.length}</b></p><p>{isArabic ? "الصفوف المعروضة بعد الطي" : "Rows shown after collapse"}: <b className="text-white">{groupDuplicateLedgerRows(selected.merchantLedger).length}</b></p></div></article>
          </div>
        )}

        {tab === "orders" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-start text-xs"><thead className="bg-white/[0.045] text-white/55"><tr><th className="px-4 py-3">{isArabic ? "الطلب / الكوبون" : "Order / coupon"}</th><th className="px-4 py-3">{isArabic ? "العميل" : "Customer"}</th><th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th><th className="px-4 py-3">{isArabic ? "إجمالي العميل" : "Customer total"}</th><th className="px-4 py-3">{isArabic ? "التوصيل" : "Delivery"}</th><th className="px-4 py-3">{isArabic ? "مستحق التاجر" : "Merchant due"}</th></tr></thead><tbody>{merchantOrders.map((order) => <tr key={order.id} className="border-t border-white/7 text-white/75"><td className="px-4 py-4"><strong className="block text-white" dir="ltr">{orderReference(order)}</strong><small className="text-white/38" dir="ltr">{order.coupon_number || "—"}</small></td><td className="px-4 py-4"><strong className="block text-white">{order.receiver_name || order.customer_name || "—"}</strong><small className="text-brand-sky" dir="ltr">{order.receiver_phone || order.customer_phone || "—"}</small></td><td className="px-4 py-4">{statusText(order.status, isArabic)}</td><td className="px-4 py-4" dir="ltr">{money(orderCustomer(order), isArabic)}</td><td className="px-4 py-4 text-brand-sky" dir="ltr">{money(orderDelivery(order), isArabic)}</td><td className="px-4 py-4 text-brand-gold" dir="ltr">{money(orderMerchantDue(order), isArabic)}</td></tr>)}</tbody></table>
            {!merchantOrders.length && <div className="grid min-h-44 place-items-center text-sm font-bold text-white/45">{isArabic ? "لا توجد طلبيات مطابقة داخل هذا التاجر." : "No matching orders for this merchant."}</div>}
          </div>
        )}

        {tab === "ledger" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-start text-xs"><thead className="bg-white/[0.045] text-white/55"><tr><th className="px-4 py-3">{isArabic ? "التاريخ" : "Date"}</th><th className="px-4 py-3">{isArabic ? "المرجع" : "Reference"}</th><th className="px-4 py-3">{isArabic ? "نوع الحركة" : "Entry type"}</th><th className="px-4 py-3">{isArabic ? "المبلغ" : "Amount"}</th><th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th><th className="px-4 py-3">{isArabic ? "التكرار" : "Duplicates"}</th></tr></thead><tbody>{groupedLedger.map(({ row, duplicateCount, key }) => <tr key={key} className="border-t border-white/7 text-white/75"><td className="px-4 py-4 whitespace-nowrap">{rowDate(row)}</td><td className="px-4 py-4 font-black text-white" dir="ltr">{rowReference(row)}</td><td className="px-4 py-4">{rowType(row, isArabic)}</td><td className="px-4 py-4 text-brand-gold" dir="ltr">{money(rowAmount(row), isArabic)}</td><td className="px-4 py-4">{statusText(row.status || row.direction, isArabic)}</td><td className="px-4 py-4">{duplicateCount > 1 ? <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black text-amber-100">×{duplicateCount} {isArabic ? "مطوية" : "collapsed"}</span> : <span className="text-white/30">—</span>}</td></tr>)}</tbody></table>
            {!groupedLedger.length && <div className="grid min-h-44 place-items-center text-sm font-bold text-white/45">{isArabic ? "لا توجد حركات مالية مطابقة لهذا التاجر في الفترة." : "No matching ledger entries for this merchant in the period."}</div>}
          </div>
        )}
      </section>

      <footer className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#031226] p-4 md:grid-cols-3">
        <div className="flex items-center gap-3"><Store className="h-5 w-5 text-brand-gold" /><div><span className="text-[10px] font-black text-white/40">{isArabic ? "التاجر" : "Merchant"}</span><strong className="block text-xs text-white">{merchant.trade_name || merchant.owner_name}</strong></div></div>
        <div className="flex items-center gap-3"><Banknote className="h-5 w-5 text-brand-sky" /><div><span className="text-[10px] font-black text-white/40">{isArabic ? "الرصيد" : "Balance"}</span><strong className="block text-xs text-white" dir="ltr">{money(merchantDue, isArabic)}</strong></div></div>
        <div className="flex items-center gap-3"><Landmark className="h-5 w-5 text-emerald-300" /><div><span className="text-[10px] font-black text-white/40">{isArabic ? "عزل البيانات" : "Data isolation"}</span><strong className="block text-xs text-white">{isArabic ? "merchant_id مطابق فقط" : "Exact merchant_id only"}</strong></div></div>
      </footer>
    </section>
  );
}
