import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Search,
  Store,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { Merchant, Order } from "../../types";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import AdminPdfExportButton from "./AdminPdfExportButton";

type Props = {
  isArabic: boolean;
  merchants: Merchant[];
  orders: Order[];
  dateFrom: string;
  dateTo: string;
  query: string;
  onNavigate: (id: string) => void;
};

const clean = (value: unknown) => String(value ?? "").trim();
const amount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${amount(value).toFixed(2)} درهم` : `${amount(value).toFixed(2)} AED`;
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s_-]+/g, "");

function merchantOrderMatches(order: Order, merchant: Merchant) {
  const merchantId = normalize(merchant.id);
  const merchantCode = normalize(merchant.merchant_code);
  const merchantName = normalize(merchant.trade_name);
  return (
    (merchantId && normalize(order.merchant_id) === merchantId) ||
    (merchantCode && normalize(order.merchant_code) === merchantCode) ||
    (merchantName && normalize(order.merchant_name) === merchantName)
  );
}

function orderReference(order: Order) {
  return clean(order.tracking_number || order.tracking_code || order.invoice_number || order.invoiceNumber || order.coupon_number || order.id || "—");
}

function goodsValue(order: Order) {
  return amount(order.goods_value ?? order.product_value ?? order.merchant_goods_value ?? 0);
}

function deliveryValue(order: Order) {
  return amount(order.company_revenue ?? order.delivery_fee ?? order.delivery_price ?? 0);
}

function customerValue(order: Order) {
  return amount(order.customer_total ?? order.total_amount ?? order.total ?? order.collected_amount ?? 0);
}

function merchantValue(order: Order) {
  return amount(order.merchant_due ?? 0);
}

function toWhatsAppPhone(value: unknown) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return digits;
}

function statusLabel(value: unknown, isArabic: boolean) {
  const status = clean(value).toLowerCase();
  const labels: Record<string, [string, string]> = {
    pending: ["جديد", "Pending"],
    assigned: ["مسند للمندوب", "Assigned"],
    confirmed: ["مؤكد", "Confirmed"],
    accepted: ["قيد التنفيذ", "Accepted"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    out_for_delivery: ["خرج للتسليم", "Out for delivery"],
    delivered: ["تم التسليم", "Delivered"],
    cancelled: ["ملغي", "Cancelled"],
    returned: ["راجع", "Returned"],
    postponed: ["مؤجل", "Postponed"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || status.replace(/_/g, " ") || "—";
}

function statusTone(value: unknown) {
  const status = clean(value).toLowerCase();
  if (status === "delivered") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (["cancelled", "returned"].includes(status)) return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (["in_transit", "out_for_delivery", "picked_up", "accepted"].includes(status)) return "border-brand-sky/30 bg-brand-sky/10 text-brand-sky";
  return "border-brand-gold/30 bg-brand-gold/10 text-brand-gold";
}

function MerchantMetric({ icon: Icon, label, value, hint }: { icon: typeof Banknote; label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black text-white/50">{label}</span>
        <Icon className="h-4 w-4 text-brand-gold" />
      </div>
      <strong className="mt-2 block text-lg font-black text-white" dir="ltr">{value}</strong>
      <small className="mt-1 block text-[10px] font-bold text-white/40">{hint}</small>
    </article>
  );
}

export default function AdminMerchantStatementsCenter({ isArabic, merchants, orders, dateFrom, dateTo, query, onNavigate }: Props) {
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [merchantQuery, setMerchantQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [allTime, setAllTime] = useState(true);

  const merchantRows = useMemo(
    () => merchants.map((merchant) => ({
      merchant,
      orders: orders.filter((order) => merchantOrderMatches(order, merchant)),
    })),
    [merchants, orders],
  );

  const visibleMerchants = useMemo(() => {
    const needle = normalize(`${query} ${merchantQuery}`);
    return merchantRows
      .filter(({ merchant }) => !needle || normalize([merchant.trade_name, merchant.owner_name, merchant.merchant_code, merchant.phone, merchant.city, merchant.emirate].join(" ")).includes(needle))
      .sort((a, b) => {
        const bDate = new Date(b.orders[0]?.created_at || b.merchant.updated_at || b.merchant.created_at || 0).getTime();
        const aDate = new Date(a.orders[0]?.created_at || a.merchant.updated_at || a.merchant.created_at || 0).getTime();
        return b.orders.length - a.orders.length || bDate - aDate;
      });
  }, [merchantRows, merchantQuery, query]);

  const selectedRow = merchantRows.find(({ merchant }) => merchant.id === selectedMerchantId) || null;

  const visibleOrders = useMemo(() => {
    if (!selectedRow) return [];
    const needle = normalize(orderQuery);
    return selectedRow.orders
      .filter((order) => {
        const date = clean(order.created_at).slice(0, 10);
        const inRange = allTime || ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo));
        const statusMatches = statusFilter === "all" || clean(order.status).toLowerCase() === statusFilter;
        const searchMatches = !needle || normalize([
          orderReference(order), order.coupon_number, order.receiver_name, order.receiver_phone,
          order.receiver_city, order.receiver_address, order.sender_city, order.status,
        ].join(" ")).includes(needle);
        return inRange && statusMatches && searchMatches;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [allTime, dateFrom, dateTo, orderQuery, selectedRow, statusFilter]);

  useEffect(() => {
    setSelectedOrderIds((current) => current.filter((id) => visibleOrders.some((order) => order.id === id)));
  }, [visibleOrders]);

  const selectedOrders = visibleOrders.filter((order) => selectedOrderIds.includes(order.id));
  const totalsSource = selectedOrders.length ? selectedOrders : visibleOrders;
  const totals = useMemo(() => ({
    goods: totalsSource.reduce((sum, order) => sum + goodsValue(order), 0),
    delivery: totalsSource.reduce((sum, order) => sum + deliveryValue(order), 0),
    customer: totalsSource.reduce((sum, order) => sum + customerValue(order), 0),
    merchant: totalsSource.reduce((sum, order) => sum + merchantValue(order), 0),
    delivered: totalsSource.filter((order) => clean(order.status).toLowerCase() === "delivered").length,
    active: totalsSource.filter((order) => !["delivered", "cancelled", "returned"].includes(clean(order.status).toLowerCase())).length,
  }), [totalsSource]);

  const merchant = selectedRow?.merchant || null;
  const merchantPhone = toWhatsAppPhone(merchant?.phone || merchant?.alt_phone);
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedOrderIds.includes(order.id));

  const pdfPayload: AdminPdfPayload = {
    language: isArabic ? "ar" : "en",
    sectionTitle: `${isArabic ? "كشف طلبات التاجر" : "Merchant order statement"} · ${merchant?.trade_name || "DAY NIGHT"}`,
    filters: `${allTime ? (isArabic ? "كل الفترات" : "All time") : `${dateFrom} → ${dateTo}`} · ${isArabic ? "المحدد" : "Selected"}: ${selectedOrders.length}`,
    totals: {
      [isArabic ? "عدد الطلبات" : "Orders"]: selectedOrders.length,
      [isArabic ? "قيمة البضاعة" : "Goods value"]: money(totals.goods, isArabic),
      [isArabic ? "رسوم التوصيل" : "Delivery fees"]: money(totals.delivery, isArabic),
      [isArabic ? "إجمالي العميل" : "Customer total"]: money(totals.customer, isArabic),
      [isArabic ? "مستحق التاجر" : "Merchant due"]: money(totals.merchant, isArabic),
    },
    columns: [
      { key: "reference", label: isArabic ? "رقم الطلب" : "Order" },
      { key: "coupon", label: isArabic ? "الكوبون" : "Coupon" },
      { key: "created", label: isArabic ? "التاريخ" : "Date" },
      { key: "sender", label: isArabic ? "المرسل" : "Sender" },
      { key: "recipient", label: isArabic ? "المستلم" : "Recipient" },
      { key: "phone", label: isArabic ? "الهاتف" : "Phone" },
      { key: "destination", label: isArabic ? "عنوان التسليم" : "Destination" },
      { key: "package", label: isArabic ? "الشحنة" : "Package" },
      { key: "payment", label: isArabic ? "الدفع" : "Payment" },
      { key: "goods", label: isArabic ? "البضاعة" : "Goods" },
      { key: "delivery", label: isArabic ? "التوصيل" : "Delivery" },
      { key: "customer", label: isArabic ? "العميل" : "Customer" },
      { key: "merchant", label: isArabic ? "مستحق التاجر" : "Merchant due" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: selectedOrders.map((order) => ({
      reference: orderReference(order),
      coupon: order.coupon_number || "—",
      created: clean(order.created_at).slice(0, 16).replace("T", " "),
      sender: `${order.sender_name || "—"} · ${order.sender_phone || "—"} · ${[order.sender_city, order.sender_address].filter(Boolean).join("، ") || "—"}`,
      recipient: order.receiver_name || order.customer_name || "—",
      phone: order.receiver_phone || order.customer_phone || "—",
      destination: [order.receiver_city, order.receiver_address].filter(Boolean).join("، ") || "—",
      package: `${order.package_type || "—"} · ${order.pieces || 1} · ${amount(order.weight).toFixed(1)} kg · ${order.service_type || "—"}${order.notes ? ` · ${order.notes}` : ""}`,
      payment: `${order.payment_method || "—"} · COD ${money(order.cod_amount, isArabic)}`,
      goods: money(goodsValue(order), isArabic),
      delivery: money(deliveryValue(order), isArabic),
      customer: money(customerValue(order), isArabic),
      merchant: money(merchantValue(order), isArabic),
      status: statusLabel(order.status, isArabic),
    })),
    orientation: "landscape",
  };

  const merchantWhatsAppMessage = useMemo(() => {
    if (!merchant || !selectedOrders.length) return "";
    const orderLines = selectedOrders.slice(0, 20).map((order, index) =>
      `${index + 1}) ${orderReference(order)} · ${statusLabel(order.status, true)} · مستحق التاجر ${money(merchantValue(order), true)}`,
    );
    if (selectedOrders.length > 20) orderLines.push(`… و${selectedOrders.length - 20} طلبية إضافية موضحة في الكشف.`);
    return [
      `السلام عليكم ${merchant.trade_name}،`,
      "تحية طيبة من DAY NIGHT لخدمات التوصيل والشحن.",
      "نرسل لكم ملخص كشف الطلبيات المحددة:",
      ...orderLines,
      "",
      `عدد الطلبيات: ${selectedOrders.length}`,
      `إجمالي قيمة البضاعة: ${money(totals.goods, true)}`,
      `إجمالي رسوم التوصيل: ${money(totals.delivery, true)}`,
      `إجمالي مستحق التاجر: ${money(totals.merchant, true)}`,
      "",
      "يرجى مراجعة الكشف، ويسعد فريق DAY NIGHT خدمتكم في أي وقت.",
    ].join("\n");
  }, [merchant, selectedOrders, totals.delivery, totals.goods, totals.merchant]);

  function openMerchant(id: string) {
    setSelectedMerchantId(id);
    setSelectedOrderIds([]);
    setOrderQuery("");
    setStatusFilter("all");
  }

  function toggleOrder(id: string) {
    setSelectedOrderIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (!merchant || !selectedRow) {
    return (
      <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-4 sm:p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold"><Store className="h-4 w-4" />{isArabic ? "دليل التجار" : "Merchant directory"}</span>
            <h2 className="mt-2 text-2xl font-black text-white">{isArabic ? "اختر التاجر لفتح كشفه الكامل" : "Choose a merchant to open the full statement"}</h2>
            <p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "كل التجار المسجلين ظاهرون هنا، بما فيهم من لا يملكون طلبات بعد." : "Every registered merchant is shown, including merchants without orders yet."}</p>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 lg:min-w-[320px]">
            <Search className="h-4 w-4 text-white/35" />
            <input value={merchantQuery} onChange={(event) => setMerchantQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "اسم التاجر، الكود، الهاتف..." : "Merchant, code, phone..."} />
          </label>
        </header>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleMerchants.map(({ merchant: item, orders: itemOrders }) => {
            const delivered = itemOrders.filter((order) => clean(order.status).toLowerCase() === "delivered").length;
            const due = itemOrders.reduce((sum, order) => sum + merchantValue(order), 0);
            return (
              <article key={item.id} className="dn-admin-merchant-directory-card rounded-[1.4rem] border border-white/10 bg-[#071a33] p-4 text-start transition hover:-translate-y-0.5 hover:border-brand-gold/35">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
                    {item.logo_url ? <img src={item.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${clean(item.status).toLowerCase() === "inactive" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>
                    {clean(item.status).toLowerCase() === "inactive" ? (isArabic ? "غير نشط" : "Inactive") : (isArabic ? "نشط" : "Active")}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black text-white">{item.trade_name || item.owner_name || "—"}</h3>
                <p className="mt-1 text-[11px] font-bold text-white/45" dir="ltr">{item.merchant_code || "—"} · {item.phone || "—"}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
                  <span><b className="block text-sm text-white">{itemOrders.length}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "طلب" : "orders"}</small></span>
                  <span><b className="block text-sm text-emerald-200">{delivered}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "مُسلّم" : "delivered"}</small></span>
                  <span><b className="block text-sm text-brand-gold" dir="ltr">{due.toFixed(2)}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "مستحق" : "due"}</small></span>
                </div>
                <button type="button" onClick={() => openMerchant(item.id)} className="mt-4 w-full rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2.5 text-xs font-black text-brand-gold transition hover:bg-brand-gold hover:text-[#071a33]">{isArabic ? "فتح كشف التاجر" : "Open merchant statement"}</button>
              </article>
            );
          })}
        </div>
        {!visibleMerchants.length && <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm font-bold text-white/45">{isArabic ? "لا يوجد تاجر مطابق للبحث." : "No merchant matches this search."}</div>}
      </section>
    );
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  return (
    <section className="space-y-4">
      <header className="relative overflow-hidden rounded-[1.8rem] border border-brand-gold/25 bg-[#031226] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(212,175,55,0.15),transparent_28rem)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setSelectedMerchantId("")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white hover:border-brand-gold/35 hover:text-brand-gold" aria-label={isArabic ? "الرجوع للتجار" : "Back to merchants"}><BackIcon className="h-5 w-5" /></button>
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">{merchant.logo_url ? <img src={merchant.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-6 w-6" />}</span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold">{isArabic ? "كشف تاجر حي" : "LIVE MERCHANT STATEMENT"}</span>
              <h2 className="mt-1 text-2xl font-black text-white">{merchant.trade_name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-white/48">
                <span><UserRound className="inline h-3.5 w-3.5" /> {merchant.owner_name || "—"}</span>
                <span dir="ltr"><Phone className="inline h-3.5 w-3.5" /> {merchant.phone || "—"}</span>
                <span><MapPin className="inline h-3.5 w-3.5" /> {[merchant.emirate, merchant.city].filter(Boolean).join("، ") || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={merchant.phone ? `tel:${merchant.phone}` : undefined} aria-disabled={!merchant.phone} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white aria-disabled:pointer-events-none aria-disabled:opacity-35"><Phone className="h-4 w-4" />{isArabic ? "اتصال بالتاجر" : "Call merchant"}</a>
            <button type="button" onClick={() => onNavigate("new_order")} className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"><PackageCheck className="h-4 w-4" />{isArabic ? "طلب جديد" : "New order"}</button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MerchantMetric icon={ClipboardCheck} label={isArabic ? "الطلبات الظاهرة" : "Visible orders"} value={String(totalsSource.length)} hint={selectedOrders.length ? (isArabic ? "الطلبات المحددة" : "Selected orders") : (isArabic ? "حسب الفلاتر" : "By filters")} />
        <MerchantMetric icon={CheckCircle2} label={isArabic ? "تم التسليم" : "Delivered"} value={String(totals.delivered)} hint={isArabic ? "مكتملة" : "Completed"} />
        <MerchantMetric icon={PackageCheck} label={isArabic ? "قيد التنفيذ" : "Active"} value={String(totals.active)} hint={isArabic ? "تحتاج متابعة" : "Needs follow-up"} />
        <MerchantMetric icon={Banknote} label={isArabic ? "قيمة البضاعة" : "Goods value"} value={money(totals.goods, isArabic)} hint={isArabic ? "مثبتة بالطلبات" : "Order snapshots"} />
        <MerchantMetric icon={WalletCards} label={isArabic ? "رسوم التوصيل" : "Delivery fees"} value={money(totals.delivery, isArabic)} hint={isArabic ? "دخل التوصيل" : "Delivery revenue"} />
        <MerchantMetric icon={Store} label={isArabic ? "مستحق التاجر" : "Merchant due"} value={money(totals.merchant, isArabic)} hint={isArabic ? "حسب المحدد" : "Current selection"} />
      </div>

      <section className="rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="space-y-4 border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div><span className="text-xs font-black text-brand-gold">{merchant.merchant_code || "—"}</span><h3 className="mt-1 text-xl font-black text-white">{visibleOrders.length} {isArabic ? "طلبية مطابقة" : "matching orders"}</h3></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAllTime((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black ${allTime ? "border-brand-gold/35 bg-brand-gold/10 text-brand-gold" : "border-white/10 bg-white/5 text-white/55"}`}><CalendarDays className="h-4 w-4" />{allTime ? (isArabic ? "كل الفترات" : "All time") : `${dateFrom} → ${dateTo}`}</button>
              <button type="button" disabled={!visibleOrders.length} onClick={() => setSelectedOrderIds(allVisibleSelected ? [] : visibleOrders.map((order) => order.id))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35">{allVisibleSelected ? (isArabic ? "إلغاء تحديد الكل" : "Clear all") : (isArabic ? "تحديد الكل الظاهر" : "Select visible")}</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3"><Search className="h-4 w-4 text-white/35" /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "رقم الطلب، العميل، الهاتف، المنطقة..." : "Order, customer, phone, area..."} /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none"><option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option><option value="pending">{isArabic ? "جديد" : "Pending"}</option><option value="assigned">{isArabic ? "مسند" : "Assigned"}</option><option value="in_transit">{isArabic ? "في الطريق" : "In transit"}</option><option value="delivered">{isArabic ? "تم التسليم" : "Delivered"}</option><option value="cancelled">{isArabic ? "ملغي" : "Cancelled"}</option><option value="returned">{isArabic ? "راجع" : "Returned"}</option></select>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-start text-xs">
            <thead className="bg-white/[0.045] text-white/55"><tr><th className="px-4 py-3">{isArabic ? "تحديد" : "Select"}</th><th className="px-4 py-3">{isArabic ? "الطلب" : "Order"}</th><th className="px-4 py-3">{isArabic ? "المستلم" : "Recipient"}</th><th className="px-4 py-3">{isArabic ? "المسار والعنوان" : "Route & address"}</th><th className="px-4 py-3">{isArabic ? "بيانات الشحنة" : "Shipment"}</th><th className="px-4 py-3">{isArabic ? "الحساب" : "Financials"}</th><th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th></tr></thead>
            <tbody>
              {visibleOrders.map((order) => {
                const selected = selectedOrderIds.includes(order.id);
                return <tr key={order.id} onClick={() => toggleOrder(order.id)} className={`cursor-pointer border-t border-white/7 text-white/75 transition ${selected ? "bg-brand-gold/[0.08]" : "hover:bg-white/[0.025]"}`}>
                  <td className="px-4 py-4"><input type="checkbox" checked={selected} onChange={() => toggleOrder(order.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 accent-[#d4af37]" aria-label={`${isArabic ? "تحديد" : "Select"} ${orderReference(order)}`} /></td>
                  <td className="px-4 py-4"><strong className="block text-sm text-white" dir="ltr">{orderReference(order)}</strong><small className="mt-1 block text-[10px] text-white/38" dir="ltr">{order.coupon_number || "—"} · {clean(order.created_at).slice(0, 16).replace("T", " ")}</small></td>
                  <td className="px-4 py-4"><strong className="block text-white">{order.receiver_name || order.customer_name || "—"}</strong><a href={order.receiver_phone ? `tel:${order.receiver_phone}` : undefined} onClick={(event) => event.stopPropagation()} className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-sky" dir="ltr"><Phone className="h-3 w-3" />{order.receiver_phone || order.customer_phone || "—"}</a></td>
                  <td className="max-w-[285px] px-4 py-4"><strong className="block text-white">{order.sender_city || "—"} ← {order.receiver_city || "—"}</strong><small className="mt-1 block leading-5 text-white/42">{isArabic ? "استلام" : "Pickup"}: {order.sender_name || "—"} · {order.sender_phone || "—"} · {order.sender_address || "—"}</small><small className="block leading-5 text-white/42">{isArabic ? "تسليم" : "Drop-off"}: {order.receiver_address || "—"}</small></td>
                  <td className="px-4 py-4"><span className="block">{order.package_type || "—"} · {order.service_type || "—"}</span><small className="block text-white/42">{order.pieces || 1} {isArabic ? "قطعة" : "pcs"} · {amount(order.weight).toFixed(1)} kg</small><small className="block text-white/42">{order.payment_method || "—"} · COD {money(order.cod_amount, isArabic)}</small>{order.notes && <small className="mt-1 block max-w-[210px] leading-5 text-amber-100/70">{order.notes}</small>}</td>
                  <td className="px-4 py-4"><div className="grid min-w-[220px] grid-cols-2 gap-1"><span>{isArabic ? "بضاعة" : "Goods"}: <b dir="ltr">{money(goodsValue(order), isArabic)}</b></span><span>{isArabic ? "توصيل" : "Delivery"}: <b dir="ltr">{money(deliveryValue(order), isArabic)}</b></span><span>{isArabic ? "العميل" : "Customer"}: <b dir="ltr">{money(customerValue(order), isArabic)}</b></span><span className="text-brand-gold">{isArabic ? "للتاجر" : "Merchant"}: <b dir="ltr">{money(merchantValue(order), isArabic)}</b></span><span className="col-span-2 text-white/45">{isArabic ? "تحمل الرسوم" : "Fee mode"}: {order.delivery_fee_mode || "—"}</span></div></td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${statusTone(order.status)}`}>{statusLabel(order.status, isArabic)}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
          {!visibleOrders.length && <div className="grid min-h-48 place-items-center p-8 text-center"><div><XCircle className="mx-auto h-9 w-9 text-white/25" /><h4 className="mt-3 text-lg font-black text-white">{isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"}</h4><p className="mt-2 text-xs font-bold text-white/42">{isArabic ? "غيّر البحث أو الحالة أو افتح كل الفترات." : "Change search, status, or switch to all time."}</p></div></div>}
        </div>
      </section>

      <aside className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-[1.5rem] border border-brand-gold/25 bg-[#06172c]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div><span className="text-[10px] font-black text-brand-gold">{isArabic ? "الطلبات المحددة" : "SELECTED ORDERS"}</span><strong className="mt-1 block text-lg font-black text-white">{selectedOrders.length} {isArabic ? "طلبية · مستحق" : "orders · due"} <b className="text-brand-gold" dir="ltr">{money(selectedOrders.length ? totals.merchant : 0, isArabic)}</b></strong></div>
        <div className="flex flex-wrap gap-2">
          {selectedOrders.length ? <AdminPdfExportButton payload={pdfPayload} label={isArabic ? "كشف PDF / CSV" : "PDF / CSV statement"} /> : <button type="button" disabled className="dn-admin-pdf-button opacity-40"><FileDown className="h-4 w-4" />{isArabic ? "حدد طلبات للطباعة" : "Select orders to export"}</button>}
          <a href={merchantPhone && selectedOrders.length ? `https://wa.me/${merchantPhone}?text=${encodeURIComponent(merchantWhatsAppMessage)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!merchantPhone || !selectedOrders.length} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-xs font-black text-[#031226] aria-disabled:pointer-events-none aria-disabled:opacity-35"><MessageCircle className="h-4 w-4" />{isArabic ? "إرسال الكشف على واتساب" : "Send via WhatsApp"}</a>
          <button type="button" onClick={() => onNavigate("all_orders")} className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"><ClipboardCheck className="h-4 w-4" />{isArabic ? "إدارة حالات الطلبات" : "Manage order statuses"}</button>
        </div>
      </aside>
    </section>
  );
}
