import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { Merchant, Order } from "../../types";
import type { MerchantStatementPayload } from "../../lib/merchantStatementExport";
import { localizeExportText, localizedOrderDestination } from "../../lib/exportLocalization";
import MerchantStatementExportButton from "./MerchantStatementExportButton";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import {
  confirmMerchantStatementDispatch,
  fetchMerchantStatementDispatchStatus,
  merchantStatementDispatchErrorCode,
  type MerchantStatementDispatchStatus,
} from "../../lib/merchantStatementDispatch";

type Props = {
  isArabic: boolean;
  merchants: Merchant[];
  orders: Order[];
  dateFrom: string;
  dateTo: string;
  query: string;
  onNavigate: (id: string) => void;
};

type TransferFilter = "all" | "unsent" | "sent";
type PendingTransfer = {
  orders: Order[];
  resend: boolean;
  whatsappOpened: boolean;
};

const OFFICIAL_LOGO = "https://i.postimg.cc/XqnP282D/cropped-circle-image-(9).png";
const TRACKING_ROOT = "https://daynightae.com/tracking";

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
  return Boolean(merchantId && normalize(order.merchant_id) === merchantId);
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
  if (["in_transit", "out_for_delivery", "picked_up", "accepted"].includes(status)) {
    return "border-brand-sky/30 bg-brand-sky/10 text-brand-sky";
  }
  return "border-brand-gold/30 bg-brand-gold/10 text-brand-gold";
}

function merchantSettlement(value: unknown, isArabic: boolean) {
  const parsed = amount(value);
  if (parsed < 0) {
    return isArabic
      ? `مستحق على التاجر ${money(Math.abs(parsed), true)}`
      : `Due from merchant ${money(Math.abs(parsed), false)}`;
  }
  return isArabic
    ? `مستحق للتاجر ${money(parsed, true)}`
    : `Due to merchant ${money(parsed, false)}`;
}

function routeText(order: Order, isArabic: boolean) {
  return localizedOrderDestination(order, isArabic ? "ar" : "en");
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

function dispatchErrorText(error: unknown, isArabic: boolean) {
  const code = merchantStatementDispatchErrorCode(error);
  const messages: Record<string, [string, string]> = {
    resend_reason_required: ["هذه الطلبات تم تحويلها من قبل. اكتب سبب إعادة الإرسال.", "These orders were already sent. Enter a resend reason."],
    ownership_mismatch: ["تم إيقاف العملية لأن إحدى الطلبات لا تتبع هذا التاجر.", "The operation was blocked because one order does not belong to this merchant."],
    not_authorized: ["ليس لديك صلاحية تسجيل تحويل كشوف التجار.", "You are not authorized to record merchant statement transfers."],
    merchant_not_found: ["التاجر المحدد غير موجود في قاعدة البيانات.", "The selected merchant was not found."],
    orders_required: ["حدد طلبية واحدة على الأقل.", "Select at least one order."],
    runtime_missing: ["ميزة منع تكرار التحويل غير جاهزة في قاعدة البيانات. تم تعطيل الإرسال لحمايتك من التكرار.", "Duplicate-send protection is not ready in the database. Sending is disabled for safety."],
    unknown: ["تعذر التحقق من سجل التحويل. لم يتم تسجيل أي طلبية كمحوّلة.", "The transfer log could not be verified. No order was marked as sent."],
  };
  return messages[code]?.[isArabic ? 0 : 1] || messages.unknown[isArabic ? 0 : 1];
}

function indexDispatchStatuses(rows: MerchantStatementDispatchStatus[]) {
  return rows.reduce<Record<string, MerchantStatementDispatchStatus>>((result, row) => {
    result[row.orderId] = row;
    return result;
  }, {});
}

function MerchantMetric({
  icon: Icon,
  label,
  value,
  hint,
  emphasis = false,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <article className={`rounded-[1.35rem] border p-4 ${emphasis ? "border-brand-gold/35 bg-brand-gold/[0.08]" : "border-white/10 bg-white/[0.045]"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black text-white/50">{label}</span>
        <Icon className="h-4 w-4 text-brand-gold" />
      </div>
      <strong className={`mt-2 block text-lg font-black ${emphasis ? "text-brand-gold" : "text-white"}`} dir="ltr">{value}</strong>
      <small className="mt-1 block text-[10px] font-bold text-white/40">{hint}</small>
    </article>
  );
}

export default function AdminMerchantStatementsCenter({
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
  const [transferFilter, setTransferFilter] = useState<TransferFilter>("all");
  const [allTime, setAllTime] = useState(true);
  const [dispatchStatusByOrder, setDispatchStatusByOrder] = useState<Record<string, MerchantStatementDispatchStatus>>({});
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState("");
  const [dispatchSuccess, setDispatchSuccess] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);
  const [resendReason, setResendReason] = useState("");
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);

  const merchantRows = useMemo(
    () =>
      merchants.map((merchant) => ({
        merchant,
        orders: orders.filter((order) => merchantOrderMatches(order, merchant)),
      })),
    [merchants, orders],
  );

  const visibleMerchants = useMemo(() => {
    return merchantRows
      .filter(
        ({ merchant }) =>
          matchesSearchQuery([
              merchant.trade_name,
              merchant.owner_name,
              merchant.merchant_code,
              merchant.phone,
              merchant.city,
              merchant.emirate,
            ], `${query} ${merchantQuery}`),
      )
      .sort((a, b) => {
        const bDate = new Date(b.orders[0]?.created_at || b.merchant.updated_at || b.merchant.created_at || 0).getTime();
        const aDate = new Date(a.orders[0]?.created_at || a.merchant.updated_at || a.merchant.created_at || 0).getTime();
        return b.orders.length - a.orders.length || bDate - aDate;
      });
  }, [merchantRows, merchantQuery, query]);

  const selectedRow = merchantRows.find(({ merchant }) => merchant.id === selectedMerchantId) || null;
  const merchant = selectedRow?.merchant || null;

  useEffect(() => {
    let cancelled = false;
    setDispatchStatusByOrder({});
    setDispatchError("");
    setDispatchSuccess("");
    if (!selectedMerchantId) {
      setDispatchLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setDispatchLoading(true);
    void fetchMerchantStatementDispatchStatus(selectedMerchantId)
      .then((rows) => {
        if (!cancelled) setDispatchStatusByOrder(indexDispatchStatuses(rows));
      })
      .catch((error) => {
        if (!cancelled) setDispatchError(dispatchErrorText(error, isArabic));
      })
      .finally(() => {
        if (!cancelled) setDispatchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isArabic, selectedMerchantId]);

  const dispatchReady = !dispatchLoading && !dispatchError;

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
              order.sender_city,
              order.status,
            ], orderQuery);
        const sent = Boolean(dispatchStatusByOrder[order.id]);
        const transferMatches =
          transferFilter === "all" ||
          (dispatchReady && transferFilter === "sent" && sent) ||
          (dispatchReady && transferFilter === "unsent" && !sent);
        return inRange && statusMatches && searchMatches && transferMatches;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [
    allTime,
    dateFrom,
    dateTo,
    dispatchReady,
    dispatchStatusByOrder,
    orderQuery,
    selectedRow,
    statusFilter,
    transferFilter,
  ]);

  useEffect(() => {
    setSelectedOrderIds((current) => current.filter((id) => visibleOrders.some((order) => order.id === id)));
  }, [visibleOrders]);

  const selectedOrders = visibleOrders.filter((order) => selectedOrderIds.includes(order.id));
  const exportOrders = selectedOrders.length ? selectedOrders : visibleOrders;
  const transferScopeOrders = selectedOrders.length ? selectedOrders : visibleOrders;
  const unsentTransferOrders = dispatchReady
    ? transferScopeOrders.filter((order) => !dispatchStatusByOrder[order.id])
    : [];
  const sentTransferOrders = dispatchReady
    ? transferScopeOrders.filter((order) => Boolean(dispatchStatusByOrder[order.id]))
    : [];
  const merchantSentCount = selectedRow?.orders.filter((order) => Boolean(dispatchStatusByOrder[order.id])).length || 0;
  const merchantUnsentCount = Math.max(0, (selectedRow?.orders.length || 0) - merchantSentCount);

  const totals = useMemo(
    () => ({
      goods: exportOrders.reduce((sum, order) => sum + goodsValue(order), 0),
      delivery: exportOrders.reduce((sum, order) => sum + deliveryValue(order), 0),
      customer: exportOrders.reduce((sum, order) => sum + customerValue(order), 0),
      merchant: exportOrders.reduce((sum, order) => sum + merchantValue(order), 0),
      delivered: exportOrders.filter((order) => clean(order.status).toLowerCase() === "delivered").length,
      active: exportOrders.filter(
        (order) => !["delivered", "cancelled", "returned"].includes(clean(order.status).toLowerCase()),
      ).length,
    }),
    [exportOrders],
  );

  const merchantPhone = toWhatsAppPhone(merchant?.phone || merchant?.alt_phone);
  const allVisibleSelected =
    visibleOrders.length > 0 && visibleOrders.every((order) => selectedOrderIds.includes(order.id));

  const periodLabel = allTime
    ? isArabic
      ? "كل الفترات"
      : "All time"
    : `${dateFrom || "—"} → ${dateTo || "—"}`;

  const statementPayload = useMemo<MerchantStatementPayload>(
    () => ({
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
      rows: exportOrders.map((order, index) => ({
        index: index + 1,
        reference: orderReference(order),
        coupon: clean(order.coupon_number) || "—",
        customer: order.receiver_name || order.customer_name || "—",
        phone: order.receiver_phone || order.customer_phone || "—",
        destination: routeText(order, isArabic),
        date: clean(order.delivery_date || order.created_at).slice(0, 10) || "—",
        customerTotal: customerValue(order),
        deliveryFee: deliveryValue(order),
        merchantDue: merchantValue(order),
        status: statusLabel(order.status, isArabic),
        trackingUrl: trackingUrl(order),
      })),
      totals: {
        orders: exportOrders.length,
        goodsValue: totals.goods,
        deliveryFees: totals.delivery,
        customerTotal: totals.customer,
        merchantBalance: totals.merchant,
      },
      periodLabel,
      logoUrl: OFFICIAL_LOGO,
      generatedBy: "DAY NIGHT DELIVERY SERVICES",
    }),
    [exportOrders, isArabic, merchant, periodLabel, totals.customer, totals.delivery, totals.goods, totals.merchant],
  );

  function merchantWhatsAppMessage(targetOrders: Order[]) {
    if (!merchant || !targetOrders.length) return "";
    const targetTotals = {
      goods: targetOrders.reduce((sum, order) => sum + goodsValue(order), 0),
      delivery: targetOrders.reduce((sum, order) => sum + deliveryValue(order), 0),
      merchant: targetOrders.reduce((sum, order) => sum + merchantValue(order), 0),
    };
    const orderLines = targetOrders.slice(0, 20).map(
      (order, index) =>
        `${index + 1}) ${orderReference(order)} · ${statusLabel(order.status, true)} · ${merchantSettlement(merchantValue(order), true)}\nمتابعة الطلبية:\n${trackingUrl(order)}`,
    );
    if (targetOrders.length > 20) {
      orderLines.push(`… و${targetOrders.length - 20} طلبية إضافية موضحة في الكشف.`);
    }
    return [
      `السلام عليكم ${merchant.trade_name || merchant.owner_name || "شريكنا الكريم"}،`,
      "تحية طيبة من DAY NIGHT لخدمات التوصيل والشحن.",
      `نرسل لكم كشف الطلبيات للفترة: ${periodLabel}`,
      "",
      ...orderLines,
      "",
      `عدد الطلبيات: ${targetOrders.length}`,
      `إجمالي قيمة البضاعة: ${money(targetTotals.goods, true)}`,
      `إجمالي رسوم التوصيل: ${money(targetTotals.delivery, true)}`,
      `${merchantSettlement(targetTotals.merchant, true)}`,
      "",
      "نشكر لكم ثقتكم وتعاونكم، ويسعد فريق DAY NIGHT خدمتكم في أي وقت.",
      "www.daynightae.com",
    ].join("\n");
  }

  async function refreshDispatchStatuses() {
    if (!selectedMerchantId) return;
    setDispatchLoading(true);
    setDispatchError("");
    try {
      const rows = await fetchMerchantStatementDispatchStatus(selectedMerchantId);
      setDispatchStatusByOrder(indexDispatchStatuses(rows));
    } catch (error) {
      setDispatchError(dispatchErrorText(error, isArabic));
    } finally {
      setDispatchLoading(false);
    }
  }

  function openMerchant(id: string) {
    setSelectedMerchantId(id);
    setSelectedOrderIds([]);
    setOrderQuery("");
    setStatusFilter("all");
    setTransferFilter("all");
    setPendingTransfer(null);
    setResendReason("");
  }

  function toggleOrder(id: string) {
    setSelectedOrderIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function openWhatsApp(targetOrders: Order[], resend: boolean) {
    if (!merchantPhone || !targetOrders.length) return;
    const message = merchantWhatsAppMessage(targetOrders);
    const opened = window.open(
      `https://wa.me/${merchantPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (!opened) {
      setDispatchError(
        isArabic
          ? "المتصفح منع فتح واتساب. اسمح بالنوافذ المنبثقة ثم أعد المحاولة. لم يتم تسجيل أي طلبية كمحوّلة."
          : "The browser blocked WhatsApp. Allow pop-ups and try again. No order was marked as sent.",
      );
      return;
    }
    setPendingTransfer({ orders: targetOrders, resend, whatsappOpened: true });
  }

  function beginNewTransfer() {
    if (!dispatchReady || !unsentTransferOrders.length) return;
    setDispatchSuccess("");
    openWhatsApp(unsentTransferOrders, false);
  }

  function beginResend() {
    if (!dispatchReady || !sentTransferOrders.length) return;
    setDispatchSuccess("");
    setResendReason("");
    setPendingTransfer({ orders: sentTransferOrders, resend: true, whatsappOpened: false });
  }

  async function confirmPendingTransfer() {
    if (!merchant || !pendingTransfer?.whatsappOpened || confirmingTransfer) return;
    if (pendingTransfer.resend && !clean(resendReason)) {
      setDispatchError(
        isArabic ? "اكتب سبب إعادة الإرسال قبل التسجيل." : "Enter the resend reason before recording it.",
      );
      return;
    }

    setConfirmingTransfer(true);
    setDispatchError("");
    try {
      const result = await confirmMerchantStatementDispatch({
        merchantId: merchant.id,
        orderIds: pendingTransfer.orders.map((order) => order.id),
        periodLabel,
        resendReason: pendingTransfer.resend ? resendReason : undefined,
        metadata: {
          merchant_code: merchant.merchant_code || null,
          order_references: pendingTransfer.orders.map(orderReference),
          selected_order_count: pendingTransfer.orders.length,
        },
      });
      await refreshDispatchStatuses();
      setSelectedOrderIds([]);
      setPendingTransfer(null);
      setResendReason("");
      setDispatchSuccess(
        isArabic
          ? `تم تسجيل تحويل ${result.orderCount} طلبية للتاجر بنجاح. لن تدخل في إرسال جديد مرة أخرى.`
          : `${result.orderCount} orders were recorded as sent. They are now protected from duplicate sending.`,
      );
    } catch (error) {
      setDispatchError(dispatchErrorText(error, isArabic));
    } finally {
      setConfirmingTransfer(false);
    }
  }

  if (!merchant || !selectedRow) {
    return (
      <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-4 sm:p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold">
              <Store className="h-4 w-4" />
              {isArabic ? "دليل التجار" : "Merchant directory"}
            </span>
            <h2 className="mt-2 text-2xl font-black text-white">
              {isArabic ? "اختر التاجر لفتح كشف واضح ومتكامل" : "Choose a merchant for a clear full statement"}
            </h2>
            <p className="mt-2 text-xs font-bold leading-6 text-white/45">
              {isArabic
                ? "الكشف يعرض كل الطلبات والحسابات، ويسجل ما تم تحويله للتاجر لمنع الإرسال المكرر."
                : "The statement shows all orders and records what was sent to prevent duplicate delivery."}
            </p>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 lg:min-w-[320px]">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={merchantQuery}
              onChange={(event) => setMerchantQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
              placeholder={isArabic ? "اسم التاجر، الكود، الهاتف..." : "Merchant, code, phone..."}
            />
          </label>
        </header>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleMerchants.map(({ merchant: item, orders: itemOrders }) => {
            const delivered = itemOrders.filter((order) => clean(order.status).toLowerCase() === "delivered").length;
            const due = itemOrders.reduce((sum, order) => sum + merchantValue(order), 0);
            return (
              <article
                key={item.id}
                className="dn-admin-merchant-directory-card rounded-[1.4rem] border border-white/10 bg-[#071a33] p-4 text-start transition hover:-translate-y-0.5 hover:border-brand-gold/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
                    {item.logo_url ? (
                      <img src={item.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black ${
                      clean(item.status).toLowerCase() === "inactive"
                        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    }`}
                  >
                    {clean(item.status).toLowerCase() === "inactive"
                      ? isArabic
                        ? "غير نشط"
                        : "Inactive"
                      : isArabic
                        ? "نشط"
                        : "Active"}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black text-white">{item.trade_name || item.owner_name || "—"}</h3>
                <p className="mt-1 text-[11px] font-bold text-white/45" dir="ltr">
                  {item.merchant_code || "—"} · {item.phone || "—"}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
                  <span><b className="block text-sm text-white">{itemOrders.length}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "طلب" : "orders"}</small></span>
                  <span><b className="block text-sm text-emerald-200">{delivered}</b><small className="text-[9px] font-bold text-white/38">{isArabic ? "مُسلّم" : "delivered"}</small></span>
                  <span><b className="block text-sm text-brand-gold" dir="ltr">{Math.abs(due).toFixed(2)}</b><small className="text-[9px] font-bold text-white/38">{due < 0 ? (isArabic ? "على التاجر" : "from merchant") : (isArabic ? "للتاجر" : "to merchant")}</small></span>
                </div>
                <button
                  type="button"
                  onClick={() => openMerchant(item.id)}
                  className="mt-4 w-full rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-2.5 text-xs font-black text-brand-gold transition hover:bg-brand-gold hover:text-[#071a33]"
                >
                  {isArabic ? "فتح كشف التاجر" : "Open merchant statement"}
                </button>
              </article>
            );
          })}
        </div>
        {!visibleMerchants.length && (
          <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm font-bold text-white/45">
            {isArabic ? "لا يوجد تاجر مطابق للبحث." : "No merchant matches this search."}
          </div>
        )}
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
            <button
              type="button"
              onClick={() => setSelectedMerchantId("")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white hover:border-brand-gold/35 hover:text-brand-gold"
              aria-label={isArabic ? "الرجوع للتجار" : "Back to merchants"}
            >
              <BackIcon className="h-5 w-5" />
            </button>
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
              {merchant.logo_url ? <img src={merchant.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-6 w-6" />}
            </span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold">
                {isArabic ? "كشف تاجر حي" : "LIVE MERCHANT STATEMENT"}
              </span>
              <h2 className="mt-1 text-2xl font-black text-white">{merchant.trade_name}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-white/48">
                <span><UserRound className="inline h-3.5 w-3.5" /> {merchant.owner_name || "—"}</span>
                <span dir="ltr"><Phone className="inline h-3.5 w-3.5" /> {merchant.phone || "—"}</span>
                <span><MapPin className="inline h-3.5 w-3.5" /> {[merchant.emirate, merchant.city].filter(Boolean).join("، ") || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={merchant.phone ? `tel:${merchant.phone}` : undefined}
              aria-disabled={!merchant.phone}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white aria-disabled:pointer-events-none aria-disabled:opacity-35"
            >
              <Phone className="h-4 w-4" />{isArabic ? "اتصال بالتاجر" : "Call merchant"}
            </a>
            <button
              type="button"
              onClick={() => onNavigate("new_order")}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"
            >
              <PackageCheck className="h-4 w-4" />{isArabic ? "طلب جديد" : "New order"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <MerchantMetric icon={ClipboardCheck} label={isArabic ? "طلبات الكشف" : "Statement orders"} value={String(exportOrders.length)} hint={selectedOrders.length ? (isArabic ? "المحدد فقط" : "Selected only") : (isArabic ? "كل الظاهر" : "All visible")} />
        <MerchantMetric icon={CheckCircle2} label={isArabic ? "تم التسليم" : "Delivered"} value={String(totals.delivered)} hint={isArabic ? "مكتملة" : "Completed"} />
        <MerchantMetric icon={PackageCheck} label={isArabic ? "قيد التنفيذ" : "Active"} value={String(totals.active)} hint={isArabic ? "تحتاج متابعة" : "Needs follow-up"} />
        <MerchantMetric icon={ShieldCheck} label={isArabic ? "تم تحويلها للتاجر" : "Sent to merchant"} value={dispatchLoading ? "…" : String(merchantSentCount)} hint={isArabic ? `${merchantUnsentCount} غير محولة` : `${merchantUnsentCount} unsent`} />
        <MerchantMetric icon={Banknote} label={isArabic ? "قيمة البضاعة" : "Goods value"} value={money(totals.goods, isArabic)} hint={isArabic ? "حسب الطلبات" : "Order values"} />
        <MerchantMetric icon={WalletCards} label={isArabic ? "رسوم التوصيل" : "Delivery fees"} value={money(totals.delivery, isArabic)} hint={isArabic ? "دخل التوصيل" : "Delivery revenue"} />
        <MerchantMetric icon={Store} label={totals.merchant < 0 ? (isArabic ? "مستحق على التاجر" : "Due from merchant") : (isArabic ? "مستحق للتاجر" : "Due to merchant")} value={money(Math.abs(totals.merchant), isArabic)} hint={isArabic ? "الرصيد النهائي" : "Final balance"} emphasis />
      </div>

      {(dispatchError || dispatchSuccess) && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 text-xs font-bold leading-6 ${
            dispatchError
              ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          }`}
          role="status"
        >
          {dispatchError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{dispatchError || dispatchSuccess}</span>
        </div>
      )}

      <section className="rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="space-y-4 border-b border-white/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <span className="text-xs font-black text-brand-gold">{merchant.merchant_code || "—"}</span>
              <h3 className="mt-1 text-xl font-black text-white">{visibleOrders.length} {isArabic ? "طلبية مطابقة" : "matching orders"}</h3>
              <p className="mt-1 text-[10px] font-bold text-white/40">
                {isArabic
                  ? "الطلبات المحوّلة تظهر بعلامة خضراء، ولن تدخل في تحويل جديد إلا من زر إعادة الإرسال مع سبب واضح."
                  : "Sent orders have a green badge and cannot be sent again without the explicit resend action and a reason."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllTime((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black ${allTime ? "border-brand-gold/35 bg-brand-gold/10 text-brand-gold" : "border-white/10 bg-white/5 text-white/55"}`}
              >
                <CalendarDays className="h-4 w-4" />{allTime ? (isArabic ? "كل الفترات" : "All time") : `${dateFrom} → ${dateTo}`}
              </button>
              <button
                type="button"
                disabled={!visibleOrders.length}
                onClick={() => setSelectedOrderIds(allVisibleSelected ? [] : visibleOrders.map((order) => order.id))}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35"
              >
                {allVisibleSelected ? (isArabic ? "إلغاء تحديد الكل" : "Clear all") : (isArabic ? "تحديد الكل الظاهر" : "Select visible")}
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_210px_220px]">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071A33] px-4 py-3">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={orderQuery}
                onChange={(event) => setOrderQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
                placeholder={isArabic ? "رقم الطلب، العميل، الهاتف، المنطقة..." : "Order, customer, phone, area..."}
              />
            </label>
            <select
              value={transferFilter}
              disabled={!dispatchReady}
              onChange={(event) => setTransferFilter(event.target.value as TransferFilter)}
              className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none disabled:opacity-40"
              data-merchant-dispatch-filter="true"
            >
              <option value="all">{isArabic ? "كل حالات التحويل" : "All transfer states"}</option>
              <option value="unsent">{isArabic ? "لم يتم تحويلها" : "Not sent"}</option>
              <option value="sent">{isArabic ? "تم تحويلها للتاجر" : "Sent to merchant"}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#071A33] px-4 py-3 text-sm font-bold text-white outline-none"
            >
              <option value="all">{isArabic ? "كل الحالات" : "All statuses"}</option>
              <option value="pending">{isArabic ? "جديد" : "Pending"}</option>
              <option value="review">{isArabic ? "قيد المراجعة" : "Under review"}</option>
              <option value="assigned">{isArabic ? "مسند" : "Assigned"}</option>
              <option value="in_transit">{isArabic ? "في الطريق" : "In transit"}</option>
              <option value="delivered">{isArabic ? "تم التسليم" : "Delivered"}</option>
              <option value="cancelled">{isArabic ? "ملغي" : "Cancelled"}</option>
              <option value="returned">{isArabic ? "راجع" : "Returned"}</option>
            </select>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1370px] text-start text-xs">
            <thead className="bg-white/[0.045] text-white/55">
              <tr>
                <th className="px-4 py-3">{isArabic ? "تحديد" : "Select"}</th>
                <th className="px-4 py-3">{isArabic ? "الطلب / الكوبون" : "Order / Coupon"}</th>
                <th className="px-4 py-3">{isArabic ? "العميل والهاتف" : "Customer & phone"}</th>
                <th className="px-4 py-3">{isArabic ? "عنوان التسليم" : "Destination"}</th>
                <th className="px-4 py-3">{isArabic ? "الحساب الواضح" : "Clear financials"}</th>
                <th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th>
                <th className="px-4 py-3">{isArabic ? "التحويل للتاجر" : "Merchant transfer"}</th>
                <th className="px-4 py-3">{isArabic ? "الخدمات" : "Services"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const selected = selectedOrderIds.includes(order.id);
                const settlement = merchantValue(order);
                const dispatch = dispatchStatusByOrder[order.id];
                return (
                  <tr
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={`cursor-pointer border-t border-white/7 text-white/75 transition ${selected ? "bg-brand-gold/[0.08]" : "hover:bg-white/[0.025]"}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOrder(order.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 accent-[#d4af37]"
                        aria-label={`${isArabic ? "تحديد" : "Select"} ${orderReference(order)}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <strong className="block text-sm text-white" dir="ltr">{orderReference(order)}</strong>
                      <small className="mt-1 block text-[10px] text-white/38" dir="ltr">
                        {isArabic ? "كوبون" : "Coupon"}: {order.coupon_number || "—"}
                      </small>
                      <small className="block text-[10px] text-white/38" dir="ltr">
                        {clean(order.created_at).slice(0, 16).replace("T", " ")}
                      </small>
                    </td>
                    <td className="px-4 py-4">
                      <strong className="block text-white">{order.receiver_name || order.customer_name || "—"}</strong>
                      <a
                        href={order.receiver_phone ? `tel:${order.receiver_phone}` : undefined}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-sky"
                        dir="ltr"
                      >
                        <Phone className="h-3 w-3" />{order.receiver_phone || order.customer_phone || "—"}
                      </a>
                    </td>
                    <td className="max-w-[300px] px-4 py-4">
                      <strong className="block text-white">{order.receiver_city || order.destination_country || "—"}</strong>
                      <small className="mt-1 block whitespace-normal leading-5 text-white/48">{order.receiver_address || "—"}</small>
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid min-w-[245px] grid-cols-2 gap-1.5 text-[10px]">
                        <span className="rounded-lg bg-white/5 px-2 py-1.5">{isArabic ? "إجمالي العميل" : "Customer"}<b className="block text-white" dir="ltr">{money(customerValue(order), isArabic)}</b></span>
                        <span className="rounded-lg bg-white/5 px-2 py-1.5">{isArabic ? "التوصيل" : "Delivery"}<b className="block text-brand-sky" dir="ltr">{money(deliveryValue(order), isArabic)}</b></span>
                        <span className={`col-span-2 rounded-lg px-2 py-1.5 font-black ${settlement < 0 ? "bg-rose-400/10 text-rose-200" : "bg-emerald-400/10 text-emerald-200"}`}>
                          {merchantSettlement(settlement, isArabic)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${statusTone(order.status)}`}>
                        {statusLabel(order.status, isArabic)}
                      </span>
                    </td>
                    <td className="px-4 py-4" data-merchant-dispatch-status={dispatch ? "sent" : "unsent"}>
                      {dispatchLoading ? (
                        <span className="inline-flex items-center gap-2 text-[10px] font-black text-white/45">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {isArabic ? "جاري التحقق" : "Checking"}
                        </span>
                      ) : dispatchError ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[10px] font-black text-rose-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {isArabic ? "التحقق متوقف" : "Check blocked"}
                        </span>
                      ) : dispatch ? (
                        <div className="min-w-[175px]">
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-200">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {isArabic ? "تم تحويلها للتاجر" : "Sent to merchant"}
                          </span>
                          <small className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-white/42">
                            <Clock3 className="h-3 w-3" />{dispatchTime(dispatch.latestSentAt, isArabic)}
                          </small>
                          {dispatch.sentCount > 1 && (
                            <small className="mt-1 block text-[9px] font-black text-brand-gold">
                              {isArabic ? `أعيد إرسالها ${dispatch.sentCount - 1} مرة` : `Resent ${dispatch.sentCount - 1} time(s)`}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black text-amber-100">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {isArabic ? "لم يتم تحويلها" : "Not sent"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={trackingUrl(order)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/35 bg-brand-sky/10 px-3 py-2.5 text-[10px] font-black text-brand-sky transition hover:bg-brand-sky hover:text-[#031226]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {isArabic ? "متابعة الطلبية" : "Track order"}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleOrders.length && (
            <div className="grid min-h-48 place-items-center p-8 text-center">
              <div>
                <XCircle className="mx-auto h-9 w-9 text-white/25" />
                <h4 className="mt-3 text-lg font-black text-white">{isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"}</h4>
                <p className="mt-2 text-xs font-bold text-white/42">
                  {isArabic ? "غيّر البحث أو الحالة أو فلتر التحويل أو افتح كل الفترات." : "Change search, status, transfer filter, or switch to all time."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-[1.5rem] border border-brand-gold/25 bg-[#06172c]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-[10px] font-black text-brand-gold">
            {selectedOrders.length
              ? isArabic
                ? "العمليات على الطلبات المحددة"
                : "ACTIONS APPLY TO SELECTED ORDERS"
              : isArabic
                ? "العمليات على كل الطلبات الظاهرة"
                : "ACTIONS APPLY TO ALL VISIBLE ORDERS"}
          </span>
          <strong className="mt-1 block text-lg font-black text-white">
            {exportOrders.length} {isArabic ? "طلبية" : "orders"} · {merchantSettlement(totals.merchant, isArabic)}
          </strong>
          <small className="mt-1 block text-[10px] font-bold text-white/42">
            {isArabic
              ? `${unsentTransferOrders.length} غير محولة · ${sentTransferOrders.length} تم تحويلها`
              : `${unsentTransferOrders.length} unsent · ${sentTransferOrders.length} already sent`}
          </small>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MerchantStatementExportButton
            payload={statementPayload}
            isArabic={isArabic}
            disabled={!exportOrders.length}
          />
          <button
            type="button"
            onClick={beginNewTransfer}
            disabled={!merchantPhone || !dispatchReady || !unsentTransferOrders.length}
            data-merchant-dispatch-primary="true"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-xs font-black text-[#031226] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {dispatchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {dispatchLoading
              ? isArabic
                ? "جاري فحص سجل التحويل"
                : "Checking transfer history"
              : unsentTransferOrders.length
                ? isArabic
                  ? `تحويل ${unsentTransferOrders.length} غير محولة عبر واتساب`
                  : `Send ${unsentTransferOrders.length} new via WhatsApp`
                : isArabic
                  ? "لا توجد طلبات جديدة للتحويل"
                  : "No new orders to send"}
          </button>
          {sentTransferOrders.length > 0 && (
            <button
              type="button"
              onClick={beginResend}
              disabled={!merchantPhone || !dispatchReady}
              data-merchant-dispatch-resend="true"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3 text-xs font-black text-brand-gold disabled:cursor-not-allowed disabled:opacity-35"
            >
              <RotateCcw className="h-4 w-4" />
              {isArabic ? `إعادة إرسال ${sentTransferOrders.length}` : `Resend ${sentTransferOrders.length}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate("all_orders")}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-sky/30 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"
          >
            <ClipboardCheck className="h-4 w-4" />{isArabic ? "إدارة وتعديل الطلبات" : "Manage and edit orders"}
          </button>
        </div>
      </aside>

      {pendingTransfer && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-[#010711]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <section className="w-full max-w-xl rounded-[1.8rem] border border-brand-gold/30 bg-[#06172c] p-5 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold">
                  {pendingTransfer.resend ? <RotateCcw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {pendingTransfer.resend
                    ? isArabic
                      ? "إعادة إرسال محمية"
                      : "PROTECTED RESEND"
                    : isArabic
                      ? "تأكيد التحويل للتاجر"
                      : "CONFIRM MERCHANT TRANSFER"}
                </span>
                <h3 className="mt-2 text-xl font-black text-white">
                  {pendingTransfer.orders.length} {isArabic ? "طلبية" : "orders"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingTransfer(null);
                  setResendReason("");
                }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60"
                aria-label={isArabic ? "إغلاق" : "Close"}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {!pendingTransfer.whatsappOpened ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-xs font-bold leading-6 text-amber-100">
                  {isArabic
                    ? "هذه الطلبات سبق تحويلها. لن نفتح واتساب قبل كتابة سبب واضح، وسيُحفظ السبب في سجل المراجعة."
                    : "These orders were already sent. WhatsApp will not open until you enter a clear reason, which will be kept in the audit log."}
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-white">
                    {isArabic ? "سبب إعادة الإرسال" : "Resend reason"}
                  </span>
                  <textarea
                    value={resendReason}
                    onChange={(event) => setResendReason(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-[#031226] p-3 text-sm font-bold text-white outline-none focus:border-brand-gold/45"
                    placeholder={isArabic ? "مثال: طلب التاجر نسخة جديدة من الكشف" : "Example: Merchant requested a new copy"}
                    data-merchant-dispatch-resend-reason="true"
                  />
                </label>
                <button
                  type="button"
                  disabled={!clean(resendReason)}
                  onClick={() => openWhatsApp(pendingTransfer.orders, true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-[#031226] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isArabic ? "فتح واتساب لإعادة الإرسال" : "Open WhatsApp to resend"}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-brand-sky/25 bg-brand-sky/10 p-4 text-xs font-bold leading-6 text-brand-sky">
                  {isArabic
                    ? "تم فتح واتساب، لكن الطلبات لم تُسجل كمحوّلة بعد. بعد إرسال الرسالة وملف PDF فعليًا اضغط «تأكيد تم التحويل»."
                    : "WhatsApp was opened, but the orders are not marked as sent yet. After actually sending the message and PDF, press Confirm sent."}
                </div>
                <div className="max-h-36 overflow-auto rounded-2xl border border-white/10 bg-[#031226] p-3 text-[11px] font-bold text-white/65">
                  {pendingTransfer.orders.slice(0, 8).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 border-b border-white/7 py-2 last:border-0">
                      <span dir="ltr">{orderReference(order)}</span>
                      <span dir="ltr">{order.coupon_number || "—"}</span>
                    </div>
                  ))}
                  {pendingTransfer.orders.length > 8 && (
                    <div className="pt-2 text-center text-brand-gold">
                      + {pendingTransfer.orders.length - 8} {isArabic ? "طلبات أخرى" : "more orders"}
                    </div>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingTransfer(null);
                      setResendReason("");
                    }}
                    disabled={confirmingTransfer}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
                  >
                    {isArabic ? "لم أرسل بعد" : "Not sent yet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmPendingTransfer()}
                    disabled={confirmingTransfer}
                    data-merchant-dispatch-confirm="true"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-[#031226] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {confirmingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {confirmingTransfer
                      ? isArabic
                        ? "جاري التسجيل"
                        : "Recording"
                      : isArabic
                        ? "تأكيد تم التحويل"
                        : "Confirm sent"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
