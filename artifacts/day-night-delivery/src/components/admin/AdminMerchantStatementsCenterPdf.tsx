import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileArchive,
  Loader2,
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
import type { MerchantStatementPayload } from "../../lib/merchantStatementExport";
import { localizeExportText, localizedOrderDestination } from "../../lib/exportLocalization";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import {
  confirmMerchantStatementDispatch,
  fetchMerchantStatementDispatchStatus,
  merchantStatementDispatchErrorCode,
  type MerchantStatementDispatchStatus,
} from "../../lib/merchantStatementDispatch";
import MerchantStatementExportButton from "./MerchantStatementExportButton";

type Props = {
  isArabic: boolean;
  merchants: Merchant[];
  orders: Order[];
  dateFrom: string;
  dateTo: string;
  query: string;
  onNavigate: (id: string) => void;
};

type PdfFilter = "all" | "not_exported" | "exported";

const OFFICIAL_LOGO = "https://i.postimg.cc/XqnP282D/cropped-circle-image-(9).png";
const TRACKING_ROOT = "https://daynightae.com/tracking";

const clean = (value: unknown) => String(value ?? "").trim();
const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s_-]+/g, "");
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${numberValue(value).toFixed(2)} درهم` : `${numberValue(value).toFixed(2)} AED`;

function merchantOwnsOrder(order: Order, merchant: Merchant) {
  return Boolean(normalize(merchant.id) && normalize(order.merchant_id) === normalize(merchant.id));
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

function goodsValue(order: Order) {
  return numberValue(order.goods_value ?? order.product_value ?? order.merchant_goods_value ?? 0);
}

function deliveryValue(order: Order) {
  return numberValue(order.company_revenue ?? order.delivery_fee ?? order.delivery_price ?? 0);
}

function customerValue(order: Order) {
  return numberValue(order.customer_total ?? order.total_amount ?? order.total ?? order.collected_amount ?? 0);
}

function merchantValue(order: Order) {
  return numberValue(order.merchant_due ?? 0);
}

function trackingUrl(order: Order) {
  return `${TRACKING_ROOT}?code=${encodeURIComponent(orderReference(order))}`;
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
    review: ["قيد المراجعة", "Under review"],
    assigned: ["مسند للمندوب", "Assigned"],
    confirmed: ["مؤكد", "Confirmed"],
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
  return "border-brand-sky/30 bg-brand-sky/10 text-brand-sky";
}

function merchantSettlement(value: unknown, isArabic: boolean) {
  const parsed = numberValue(value);
  if (parsed < 0) {
    return isArabic
      ? `مستحق على التاجر ${money(Math.abs(parsed), true)}`
      : `Due from merchant ${money(Math.abs(parsed), false)}`;
  }
  return isArabic
    ? `مستحق للتاجر ${money(parsed, true)}`
    : `Due to merchant ${money(parsed, false)}`;
}

function dispatchTime(value: string, isArabic: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(isArabic ? "ar-AE" : "en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorText(error: unknown, isArabic: boolean) {
  const code = merchantStatementDispatchErrorCode(error);
  const labels: Record<string, [string, string]> = {
    resend_reason_required: ["اكتب سبب إعادة إنشاء الكشف لهذه الطلبات.", "Enter a reason for exporting these orders again."],
    ownership_mismatch: ["تم إيقاف العملية لأن إحدى الطلبات لا تتبع هذا التاجر.", "The operation was blocked because one order does not belong to this merchant."],
    not_authorized: ["ليس لديك صلاحية تسجيل كشوف التجار.", "You are not authorized to record merchant statements."],
    merchant_not_found: ["التاجر المحدد غير موجود.", "The selected merchant was not found."],
    orders_required: ["حدد طلبية واحدة على الأقل.", "Select at least one order."],
    runtime_missing: ["سجل كشوف PDF غير جاهز في قاعدة البيانات؛ تم تعطيل التصدير لمنع التكرار.", "The PDF statement log is unavailable; export is disabled to prevent duplicates."],
    unknown: ["تعذر التحقق من سجل كشوف PDF.", "The PDF statement log could not be verified."],
  };
  return labels[code]?.[isArabic ? 0 : 1] || labels.unknown[isArabic ? 0 : 1];
}

function indexStatuses(rows: MerchantStatementDispatchStatus[]) {
  return rows.reduce<Record<string, MerchantStatementDispatchStatus>>((result, row) => {
    if (row.latestChannel === "pdf_only") result[row.orderId] = row;
    return result;
  }, {});
}

export default function AdminMerchantStatementsCenterPdf({
  isArabic,
  merchants,
  orders,
  dateFrom,
  dateTo,
  query,
  onNavigate,
}: Props) {
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [merchantQuery, setMerchantQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pdfFilter, setPdfFilter] = useState<PdfFilter>("all");
  const [allTime, setAllTime] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, MerchantStatementDispatchStatus>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [success, setSuccess] = useState("");
  const [repeatReason, setRepeatReason] = useState("");

  const merchantRows = useMemo(
    () => merchants.map((merchant) => ({
      merchant,
      orders: orders.filter((order) => merchantOwnsOrder(order, merchant)),
    })),
    [merchants, orders],
  );

  const visibleMerchants = useMemo(
    () => merchantRows
      .filter(({ merchant }) => matchesSearchQuery([
        merchant.trade_name,
        merchant.owner_name,
        merchant.merchant_code,
        merchant.phone,
        merchant.city,
        merchant.emirate,
      ], `${query} ${merchantQuery}`))
      .sort((a, b) => b.orders.length - a.orders.length),
    [merchantQuery, merchantRows, query],
  );

  const selectedRow = merchantRows.find(({ merchant }) => merchant.id === selectedMerchantId) || null;
  const merchant = selectedRow?.merchant || null;

  async function refreshPdfStatus(merchantId = selectedMerchantId) {
    if (!merchantId) return;
    setStatusLoading(true);
    setStatusError("");
    try {
      const rows = await fetchMerchantStatementDispatchStatus(merchantId);
      setStatuses(indexStatuses(rows));
    } catch (error) {
      setStatuses({});
      setStatusError(errorText(error, isArabic));
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    setStatuses({});
    setSuccess("");
    setRepeatReason("");
    if (selectedMerchantId) void refreshPdfStatus(selectedMerchantId);
  }, [isArabic, selectedMerchantId]);

  const statusReady = !statusLoading && !statusError;

  const visibleOrders = useMemo(() => {
    if (!selectedRow) return [];
    return selectedRow.orders
      .filter((order) => {
        const date = clean(order.created_at).slice(0, 10);
        const inRange = allTime || ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo));
        const statusMatches = statusFilter === "all" || clean(order.status).toLowerCase() === statusFilter;
        const searchMatches = matchesSearchQuery([
          orderReference(order),
          order.coupon_number,
          order.receiver_name,
          order.receiver_phone,
          order.receiver_city,
          order.receiver_address,
          order.status,
        ], orderQuery);
        const exported = Boolean(statuses[order.id]);
        const pdfMatches = pdfFilter === "all" ||
          (statusReady && pdfFilter === "exported" && exported) ||
          (statusReady && pdfFilter === "not_exported" && !exported);
        return inRange && statusMatches && searchMatches && pdfMatches;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [allTime, dateFrom, dateTo, orderQuery, pdfFilter, selectedRow, statusFilter, statusReady, statuses]);

  useEffect(() => {
    setSelectedOrderIds((current) => current.filter((id) => visibleOrders.some((order) => order.id === id)));
  }, [visibleOrders]);

  const selectedOrders = visibleOrders.filter((order) => selectedOrderIds.includes(order.id));
  const scopeOrders = selectedOrders.length ? selectedOrders : visibleOrders;
  const newPdfOrders = statusReady ? scopeOrders.filter((order) => !statuses[order.id]) : [];
  const repeatedPdfOrders = statusReady ? scopeOrders.filter((order) => Boolean(statuses[order.id])) : [];
  const merchantPhone = toWhatsAppPhone(merchant?.phone || merchant?.alt_phone);
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedOrderIds.includes(order.id));
  const periodLabel = allTime ? (isArabic ? "كل الفترات" : "All time") : `${dateFrom || "—"} → ${dateTo || "—"}`;

  function totals(targetOrders: Order[]) {
    return {
      goods: targetOrders.reduce((sum, order) => sum + goodsValue(order), 0),
      delivery: targetOrders.reduce((sum, order) => sum + deliveryValue(order), 0),
      customer: targetOrders.reduce((sum, order) => sum + customerValue(order), 0),
      merchant: targetOrders.reduce((sum, order) => sum + merchantValue(order), 0),
    };
  }

  function statementPayload(targetOrders: Order[]): MerchantStatementPayload {
    const total = totals(targetOrders);
    return {
      language: isArabic ? "ar" : "en",
      merchant: {
        tradeName: merchant?.trade_name || merchant?.owner_name || "DAY NIGHT Merchant",
        ownerName: merchant?.owner_name,
        code: merchant?.merchant_code,
        phone: merchant?.phone,
        email: merchant?.email,
        location: localizeExportText([merchant?.emirate, merchant?.city].filter(Boolean).join("، "), isArabic ? "ar" : "en"),
        address: localizeExportText(merchant?.address || merchant?.pickup_address, isArabic ? "ar" : "en"),
      },
      rows: targetOrders.map((order, index) => ({
        index: index + 1,
        reference: orderReference(order),
        coupon: clean(order.coupon_number) || "—",
        customer: order.receiver_name || order.customer_name || "—",
        phone: order.receiver_phone || order.customer_phone || "—",
        destination: localizedOrderDestination(order, isArabic ? "ar" : "en"),
        date: clean(order.delivery_date || order.created_at).slice(0, 10) || "—",
        goodsValue: goodsValue(order),
        customerTotal: customerValue(order),
        deliveryFee: deliveryValue(order),
        merchantDue: merchantValue(order),
        status: statusLabel(order.status, isArabic),
        trackingUrl: trackingUrl(order),
      })),
      totals: {
        orders: targetOrders.length,
        goodsValue: total.goods,
        deliveryFees: total.delivery,
        customerTotal: total.customer,
        merchantBalance: total.merchant,
      },
      periodLabel,
      logoUrl: OFFICIAL_LOGO,
      generatedBy: "DAY NIGHT DELIVERY SERVICES",
    };
  }

  async function recordPdfExport(targetOrders: Order[], reason?: string) {
    if (!merchant || !targetOrders.length) throw new Error("orders_required");
    setStatusError("");
    setSuccess("");
    try {
      const result = await confirmMerchantStatementDispatch({
        merchantId: merchant.id,
        orderIds: targetOrders.map((order) => order.id),
        periodLabel,
        resendReason: clean(reason) || undefined,
        metadata: {
          merchant_code: merchant.merchant_code || null,
          order_references: targetOrders.map(orderReference),
          pdf_order_count: targetOrders.length,
        },
      });
      await refreshPdfStatus(merchant.id);
      setSelectedOrderIds([]);
      setRepeatReason("");
      setSuccess(
        isArabic
          ? `تم إنشاء وتسجيل كشف PDF يضم ${result.orderCount} طلبية. لن تدخل هذه الطلبات في كشف جديد تلقائيًا.`
          : `A PDF statement containing ${result.orderCount} orders was created and recorded. These orders will be excluded from normal new exports.`,
      );
    } catch (error) {
      setStatusError(errorText(error, isArabic));
      throw error;
    }
  }

  function whatsappMessage(targetOrders: Order[]) {
    if (!merchant || !targetOrders.length) return "";
    const total = totals(targetOrders);
    return [
      `السلام عليكم ${merchant.trade_name || merchant.owner_name || "شريكنا الكريم"}،`,
      "تحية طيبة من DAY NIGHT لخدمات التوصيل والشحن.",
      `ملخص كشف الطلبيات للفترة: ${periodLabel}`,
      "",
      ...targetOrders.slice(0, 20).map((order, index) => `${index + 1}) ${orderReference(order)} · ${statusLabel(order.status, true)}\n${trackingUrl(order)}`),
      targetOrders.length > 20 ? `… و${targetOrders.length - 20} طلبية إضافية موضحة في ملف PDF.` : "",
      "",
      `عدد الطلبيات: ${targetOrders.length}`,
      `إجمالي قيمة البضاعة: ${money(total.goods, true)}`,
      `إجمالي رسوم التوصيل: ${money(total.delivery, true)}`,
      merchantSettlement(total.merchant, true),
      "",
      "ملاحظة إدارية: فتح أو إرسال واتساب لا يغيّر حالة كشف الطلبات في النظام.",
      "www.daynightae.com",
    ].filter(Boolean).join("\n");
  }

  function openMerchant(id: string) {
    setSelectedMerchantId(id);
    setSelectedOrderIds([]);
    setOrderQuery("");
    setStatusFilter("all");
    setPdfFilter("all");
  }

  function toggleOrder(id: string) {
    setSelectedOrderIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (!merchant || !selectedRow) {
    return (
      <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-4 sm:p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold"><Store className="h-4 w-4" />{isArabic ? "كشوف PDF للتجار" : "Merchant PDF statements"}</span>
            <h2 className="mt-2 text-2xl font-black text-white">{isArabic ? "اختر التاجر أولًا" : "Choose the merchant first"}</h2>
            <p className="mt-2 text-xs font-bold leading-6 text-white/45">{isArabic ? "كل تاجر يفتح في ملف مستقل، ولا تُسجل أي طلبية إلا بعد نجاح إنشاء ملف PDF." : "Each merchant opens in an isolated workspace. An order is recorded only after PDF generation succeeds."}</p>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 lg:min-w-[320px]">
            <Search className="h-4 w-4 text-white/35" />
            <input value={merchantQuery} onChange={(event) => setMerchantQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "اسم التاجر، الكود، الهاتف..." : "Merchant, code, phone..."} />
          </label>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleMerchants.map(({ merchant: item, orders: itemOrders }) => (
            <article key={item.id} className="rounded-[1.4rem] border border-white/10 bg-[#071a33] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold"><Store className="h-5 w-5" /></span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-white/65">{itemOrders.length} {isArabic ? "طلبية" : "orders"}</span>
              </div>
              <h3 className="mt-3 text-lg font-black text-white">{item.trade_name || item.owner_name || "—"}</h3>
              <p className="mt-1 text-[11px] font-bold text-white/45" dir="ltr">{item.merchant_code || "—"} · {item.phone || "—"}</p>
              <button type="button" onClick={() => openMerchant(item.id)} className="mt-4 w-full rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2.5 text-xs font-black text-brand-gold">{isArabic ? "فتح كشوف التاجر" : "Open statements"}</button>
            </article>
          ))}
        </div>
        {!visibleMerchants.length && <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-sm font-bold text-white/45">{isArabic ? "لا يوجد تاجر مطابق." : "No matching merchant."}</div>}
      </section>
    );
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const scopeTotal = totals(scopeOrders);
  const pdfExportedCount = selectedRow.orders.filter((order) => Boolean(statuses[order.id])).length;

  return (
    <section className="space-y-4">
      <header className="rounded-[1.8rem] border border-brand-gold/25 bg-[#031226] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setSelectedMerchantId("")} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white" aria-label={isArabic ? "الرجوع للتجار" : "Back to merchants"}><BackIcon className="h-5 w-5" /></button>
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold"><Store className="h-6 w-6" /></span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold">PDF STATEMENT CONTROL</span>
              <h2 className="mt-1 text-2xl font-black text-white">{merchant.trade_name || merchant.owner_name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-white/48">
                <span><UserRound className="inline h-3.5 w-3.5" /> {merchant.owner_name || "—"}</span>
                <span dir="ltr"><Phone className="inline h-3.5 w-3.5" /> {merchant.phone || "—"}</span>
                <span>{merchant.merchant_code || "—"}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate("all_orders")} className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"><ClipboardCheck className="h-4 w-4" />{isArabic ? "إدارة الطلبات" : "Manage orders"}</button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-[#031226] p-4"><span className="text-[10px] font-black text-white/45">{isArabic ? "طلبات التاجر" : "Merchant orders"}</span><strong className="mt-2 block text-xl text-white">{selectedRow.orders.length}</strong></article>
        <article className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4"><span className="text-[10px] font-black text-emerald-200/70">{isArabic ? "دخلت كشف PDF" : "Included in PDF"}</span><strong className="mt-2 block text-xl text-emerald-200">{pdfExportedCount}</strong></article>
        <article className="rounded-2xl border border-brand-gold/25 bg-brand-gold/[0.07] p-4"><span className="text-[10px] font-black text-brand-gold/70">{isArabic ? "لم تدخل كشف PDF" : "Not in PDF"}</span><strong className="mt-2 block text-xl text-brand-gold">{Math.max(0, selectedRow.orders.length - pdfExportedCount)}</strong></article>
        <article className="rounded-2xl border border-white/10 bg-[#031226] p-4"><span className="text-[10px] font-black text-white/45">{isArabic ? "المحدد حاليًا" : "Current scope"}</span><strong className="mt-2 block text-xl text-white">{scopeOrders.length}</strong></article>
        <article className="rounded-2xl border border-white/10 bg-[#031226] p-4"><span className="text-[10px] font-black text-white/45">{isArabic ? "رصيد المحدد" : "Scope balance"}</span><strong className="mt-2 block text-sm text-brand-gold" dir="ltr">{merchantSettlement(scopeTotal.merchant, isArabic)}</strong></article>
      </div>

      {statusLoading && <p className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white/60"><Loader2 className="h-4 w-4 animate-spin" />{isArabic ? "جاري تحميل سجل كشوف PDF..." : "Loading PDF statement history..."}</p>}
      {statusError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-200">{statusError}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs font-bold text-emerald-200">{success}</p>}

      <section className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="space-y-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black text-brand-gold">{merchant.merchant_code || "—"}</p>
              <h3 className="mt-1 text-xl font-black text-white">{visibleOrders.length} {isArabic ? "طلبية مطابقة" : "matching orders"}</h3>
              <p className="mt-1 text-[10px] font-bold text-white/40">{isArabic ? "التحديد يحدد نطاق الكشف فقط. العلامة لا تُسجل إلا بعد نجاح إنشاء PDF." : "Selection defines the statement scope only. The badge is recorded only after successful PDF generation."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAllTime((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black ${allTime ? "border-brand-gold/35 bg-brand-gold/10 text-brand-gold" : "border-white/10 bg-white/5 text-white/55"}`}><CalendarDays className="h-4 w-4" />{allTime ? (isArabic ? "كل الفترات" : "All time") : `${dateFrom} → ${dateTo}`}</button>
              <button type="button" disabled={!visibleOrders.length} onClick={() => setSelectedOrderIds(allVisibleSelected ? [] : visibleOrders.map((order) => order.id))} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35">{allVisibleSelected ? (isArabic ? "إلغاء تحديد الكل" : "Clear all") : (isArabic ? "تحديد الكل الظاهر" : "Select visible")}</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_190px_210px]">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3"><Search className="h-4 w-4 text-white/35" /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none" placeholder={isArabic ? "رقم الطلب، العميل، الهاتف..." : "Order, customer, phone..."} /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white"><option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option><option value="delivered">{isArabic ? "تم التسليم" : "Delivered"}</option><option value="pending">{isArabic ? "جديد" : "Pending"}</option><option value="in_transit">{isArabic ? "في الطريق" : "In transit"}</option><option value="cancelled">{isArabic ? "ملغي" : "Cancelled"}</option><option value="returned">{isArabic ? "راجع" : "Returned"}</option></select>
            <select data-merchant-dispatch-filter="true" value={pdfFilter} onChange={(event) => setPdfFilter(event.target.value as PdfFilter)} disabled={!statusReady} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><option value="all">{isArabic ? "كل كشوف PDF" : "All PDF states"}</option><option value="not_exported">{isArabic ? "لم تدخل كشف PDF" : "Not included in PDF"}</option><option value="exported">{isArabic ? "دخلت كشف PDF" : "Included in PDF"}</option></select>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-start text-xs">
            <thead className="bg-white/[0.045] text-white/55"><tr><th className="px-4 py-3">{isArabic ? "تحديد" : "Select"}</th><th className="px-4 py-3">{isArabic ? "الطلب / الكوبون" : "Order / coupon"}</th><th className="px-4 py-3">{isArabic ? "العميل" : "Customer"}</th><th className="px-4 py-3">{isArabic ? "الحساب" : "Financials"}</th><th className="px-4 py-3">{isArabic ? "حالة الطلب" : "Order status"}</th><th className="px-4 py-3">{isArabic ? "حالة كشف PDF" : "PDF statement state"}</th><th className="px-4 py-3">{isArabic ? "متابعة" : "Tracking"}</th></tr></thead>
            <tbody>
              {visibleOrders.map((order) => {
                const selected = selectedOrderIds.includes(order.id);
                const exported = statuses[order.id];
                return (
                  <tr key={order.id} onClick={() => toggleOrder(order.id)} className={`cursor-pointer border-t border-white/7 text-white/75 ${selected ? "bg-brand-gold/[0.08]" : "hover:bg-white/[0.025]"}`}>
                    <td className="px-4 py-4"><input type="checkbox" checked={selected} onChange={() => toggleOrder(order.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 accent-[#d4af37]" aria-label={`${isArabic ? "تحديد" : "Select"} ${orderReference(order)}`} /></td>
                    <td className="px-4 py-4"><strong className="block text-sm text-white" dir="ltr">{orderReference(order)}</strong><small className="mt-1 block text-[10px] text-white/38" dir="ltr">{isArabic ? "كوبون" : "Coupon"}: {order.coupon_number || "—"}</small></td>
                    <td className="px-4 py-4"><strong className="block text-white">{order.receiver_name || order.customer_name || "—"}</strong><small className="mt-1 block text-[10px] text-brand-sky" dir="ltr">{order.receiver_phone || order.customer_phone || "—"}</small></td>
                    <td className="px-4 py-4"><span className="block">{isArabic ? "العميل" : "Customer"}: <b dir="ltr">{money(customerValue(order), isArabic)}</b></span><span className="block text-brand-gold">{merchantSettlement(merchantValue(order), isArabic)}</span></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${statusTone(order.status)}`}>{statusLabel(order.status, isArabic)}</span></td>
                    <td className="px-4 py-4">
                      {exported ? <div data-merchant-pdf-exported="true" className="min-w-[210px] rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-emerald-200"><strong className="flex items-center gap-2 text-[10px]"><CheckCircle2 className="h-3.5 w-3.5" />{isArabic ? "تم تضمينها في كشف PDF" : "Included in a PDF statement"}</strong><small className="mt-1 block text-[9px]" dir="ltr"><Clock3 className="inline h-3 w-3" /> {dispatchTime(exported.latestSentAt, isArabic)}{exported.sentCount > 1 ? ` · ×${exported.sentCount}` : ""}</small></div> : <span data-merchant-pdf-not-exported="true" className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1.5 text-[10px] font-black text-brand-gold"><FileArchive className="h-3.5 w-3.5" />{isArabic ? "لم تدخل كشف PDF" : "Not included in PDF"}</span>}
                    </td>
                    <td className="px-4 py-4"><a href={trackingUrl(order)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/35 bg-brand-sky/10 px-3 py-2.5 text-[10px] font-black text-brand-sky"><ExternalLink className="h-3.5 w-3.5" />{isArabic ? "متابعة" : "Track"}</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleOrders.length && <div className="grid min-h-48 place-items-center p-8 text-center"><div><XCircle className="mx-auto h-9 w-9 text-white/25" /><h4 className="mt-3 text-lg font-black text-white">{isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"}</h4></div></div>}
        </div>
      </section>

      <aside className="sticky bottom-3 z-20 space-y-3 rounded-[1.5rem] border border-brand-gold/25 bg-[#06172c]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div><span className="text-[10px] font-black text-brand-gold">{selectedOrders.length ? (isArabic ? "النطاق: الطلبات المحددة" : "SCOPE: SELECTED ORDERS") : (isArabic ? "النطاق: كل الطلبات الظاهرة" : "SCOPE: ALL VISIBLE ORDERS")}</span><strong className="mt-1 block text-lg font-black text-white">{scopeOrders.length} {isArabic ? "طلبية" : "orders"} · {newPdfOrders.length} {isArabic ? "جديدة للكشف" : "new for PDF"}</strong></div>
          <div className="flex flex-wrap items-center gap-2">
            <MerchantStatementExportButton payload={statementPayload(newPdfOrders)} isArabic={isArabic} disabled={!statusReady || !newPdfOrders.length} pdfLabel={isArabic ? `إنشاء PDF جديد (${newPdfOrders.length})` : `Create new PDF (${newPdfOrders.length})`} onPdfCreated={() => recordPdfExport(newPdfOrders)} />
            <a href={merchantPhone && scopeOrders.length ? `https://wa.me/${merchantPhone}?text=${encodeURIComponent(whatsappMessage(scopeOrders))}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!merchantPhone || !scopeOrders.length} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-xs font-black text-[#031226] aria-disabled:pointer-events-none aria-disabled:opacity-35"><MessageCircle className="h-4 w-4" />{isArabic ? "فتح واتساب — بدون تغيير الحالة" : "Open WhatsApp — no status change"}</a>
          </div>
        </div>
        {repeatedPdfOrders.length > 0 && (
          <div className="grid gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 lg:grid-cols-[1fr_auto]">
            <input data-merchant-dispatch-resend-reason="true" value={repeatReason} onChange={(event) => setRepeatReason(event.target.value)} placeholder={isArabic ? `سبب إعادة إنشاء PDF لـ ${repeatedPdfOrders.length} طلبية سبق تصديرها` : `Reason for exporting ${repeatedPdfOrders.length} previously exported orders again`} className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none" />
            <div data-merchant-dispatch-resend="true"><MerchantStatementExportButton payload={statementPayload(repeatedPdfOrders)} isArabic={isArabic} disabled={!statusReady || !clean(repeatReason)} pdfLabel={isArabic ? `إعادة PDF (${repeatedPdfOrders.length})` : `Re-export PDF (${repeatedPdfOrders.length})`} onPdfCreated={() => recordPdfExport(repeatedPdfOrders, repeatReason)} /></div>
          </div>
        )}
      </aside>
    </section>
  );
}
