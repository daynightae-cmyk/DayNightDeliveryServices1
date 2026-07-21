import { useMemo, useState } from "react";
import { Archive, CalendarCheck, Mail, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import type { Order } from "../../types";
import { sendDeliveryConfirmationEmail } from "../../lib/deliveryConfirmationEmail";

const FINAL_STATUSES = new Set(["delivered", "cancelled", "canceled", "returned", "failed", "delivery_failed"]);

function recordOf(order: Order) {
  return order as Order & Record<string, unknown>;
}

function normalizeStatus(value?: unknown) {
  return String(value || "pending").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function trackingOf(order: Order) {
  const row = recordOf(order);
  return String(row.tracking_code || row.tracking_number || row.invoice_number || row.id || "DAY-NIGHT");
}

function finalDateOf(order: Order) {
  const row = recordOf(order);
  return String(row.delivered_at || row.delivery_date || row.completed_at || row.updated_at || row.created_at || "");
}

function formatDate(value: string, locale: string, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, includeTime
    ? { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "2-digit" });
}

function statusLabel(status: unknown, isArabic: boolean) {
  const normalized = normalizeStatus(status);
  const labels: Record<string, [string, string]> = {
    pending: ["قيد المراجعة", "Pending"],
    confirmed: ["مؤكد", "Confirmed"],
    assigned: ["تم تعيين مندوب", "Driver assigned"],
    accepted: ["قبلها المندوب", "Accepted"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    out_for_delivery: ["في طريقها للتسليم", "Out for delivery"],
    delivered: ["تم التسليم", "Delivered"],
    returned: ["مرتجع", "Returned"],
    cancelled: ["ملغي", "Cancelled"],
    canceled: ["ملغي", "Cancelled"],
    failed: ["تعذر التسليم", "Delivery failed"],
    delivery_failed: ["تعذر التسليم", "Delivery failed"],
  };
  return labels[normalized]?.[isArabic ? 0 : 1] || normalized.replaceAll("_", " ");
}

function OrderCard({ order, isArabic, historical }: { order: Order; isArabic: boolean; historical: boolean }) {
  const row = recordOf(order);
  const tracking = trackingOf(order);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function sendEmail() {
    setSending(true);
    setNotice("");
    setError("");
    try {
      await sendDeliveryConfirmationEmail(String(row.id || ""));
      setNotice(isArabic ? "تم إرسال ملخص الطلب إلى بريد الحساب." : "The order summary was sent to the account email.");
    } catch (sendError) {
      const raw = sendError instanceof Error ? sendError.message : String(sendError || "");
      setError(isArabic ? `تعذر إرسال التأكيد: ${raw}` : `Could not send confirmation: ${raw}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:bg-white/[0.075]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-black text-brand-gold" dir="ltr">{tracking}</p>
          <p className="mt-1 text-xs font-bold text-white/75">
            {String(row.sender_city || "—")} → {String(row.receiver_city || "—")}
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            {String(row.package_type || (isArabic ? "شحنة" : "Shipment"))} · {Number(row.pieces || 1)} {isArabic ? "قطعة" : "pcs"} · {Number(row.weight || 1)} kg
          </p>
        </div>

        <div className="grid min-w-[280px] grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
            <CalendarCheck className="mx-auto mb-1 h-4 w-4 text-brand-gold" />
            <p className="text-[10px] text-white/45">{historical ? (isArabic ? "تاريخ الإغلاق" : "Final date") : (isArabic ? "تاريخ الطلب" : "Created")}</p>
            <p className="text-[11px] font-bold text-white">{formatDate(historical ? finalDateOf(order) : String(row.created_at || ""), isArabic ? "ar-AE" : "en-AE")}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
            <p className="text-[10px] text-white/45">{isArabic ? "الحالة النهائية" : "Status"}</p>
            <p className="text-[11px] font-black text-emerald-200">{statusLabel(row.status, isArabic)}</p>
          </div>
          <Link to={`/tracking?code=${encodeURIComponent(tracking)}`} className="flex items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-3 py-2 text-[11px] font-black text-brand-gold">
            {isArabic ? "التتبع" : "Track"}
          </Link>
          <button type="button" onClick={() => void sendEmail()} disabled={sending || !row.id} className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white hover:bg-white/10 disabled:opacity-50">
            <Mail className="h-3.5 w-3.5" /> {sending ? (isArabic ? "إرسال..." : "Sending...") : (isArabic ? "إرسال التأكيد" : "Email summary")}
          </button>
        </div>
      </div>
      {notice && <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-200">{notice}</p>}
      {error && <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-200">{error}</p>}
    </article>
  );
}

export default function CustomerOrderHistory({
  orders,
  loading,
  error,
  isArabic,
  onRefresh,
}: {
  orders: Order[];
  loading: boolean;
  error: string;
  isArabic: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  const activeOrders = useMemo(() => orders.filter((order) => !FINAL_STATUSES.has(normalizeStatus(recordOf(order).status))), [orders]);
  const historicalOrders = useMemo(
    () => orders
      .filter((order) => FINAL_STATUSES.has(normalizeStatus(recordOf(order).status)))
      .sort((a, b) => new Date(finalDateOf(b)).getTime() - new Date(finalDateOf(a)).getTime()),
    [orders],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#061225]/95 p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold">
              <Truck className="h-4 w-4" /> {isArabic ? "الشحنات النشطة" : "Active deliveries"}
            </span>
            <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">{isArabic ? "طلباتك الجارية" : "Current delivery requests"}</h3>
          </div>
          <button type="button" onClick={() => void onRefresh()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {isArabic ? "تحديث مباشر" : "Live refresh"}
          </button>
        </div>
        {error && <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-xs font-bold text-rose-200">{error}</div>}
        {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs font-bold text-white/55">{isArabic ? "جاري تحميل الطلبات..." : "Loading orders..."}</div>}
        {!loading && activeOrders.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"><PackageCheck className="mx-auto mb-3 h-8 w-8 text-brand-gold" /><p className="text-sm font-black text-white">{isArabic ? "لا توجد شحنات نشطة" : "No active deliveries"}</p></div>}
        {!loading && activeOrders.length > 0 && <div className="space-y-3">{activeOrders.map((order) => <OrderCard key={String(recordOf(order).id)} order={order} isArabic={isArabic} historical={false} />)}</div>}
      </section>

      <section className="rounded-[2rem] border border-brand-gold/15 bg-[#061225]/95 p-5 shadow-2xl sm:p-7">
        <div className="mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold">
            <Archive className="h-4 w-4" /> {isArabic ? "سجل الطلبات" : "Order history"}
          </span>
          <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">{isArabic ? "عمليات التسليم السابقة" : "Past deliveries"}</h3>
          <p className="mt-1 text-xs text-white/45">{isArabic ? "الحالة النهائية وتاريخ التسليم أو الإلغاء أو الإرجاع لكل طلب." : "Final status and completion date for each delivered, cancelled, failed, or returned order."}</p>
        </div>
        {!loading && historicalOrders.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"><Archive className="mx-auto mb-3 h-8 w-8 text-brand-gold" /><p className="text-sm font-black text-white">{isArabic ? "لا يوجد سجل مكتمل بعد" : "No completed order history yet"}</p></div>}
        {!loading && historicalOrders.length > 0 && <div className="space-y-3">{historicalOrders.map((order) => <OrderCard key={String(recordOf(order).id)} order={order} isArabic={isArabic} historical />)}</div>}
      </section>
    </div>
  );
}
