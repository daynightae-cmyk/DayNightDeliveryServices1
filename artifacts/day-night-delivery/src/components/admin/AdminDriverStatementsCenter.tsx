import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileDown,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Order } from "../../types";
import { useAdminDrivers } from "../../hooks/useAdminDrivers";
import { updateOrderStatus } from "../../lib/adminData";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import AdminPdfExportButton from "./AdminPdfExportButton";
import { matchesSearchQuery } from "../../lib/searchNormalization";

type Props = {
  isArabic: boolean;
  dateFrom: string;
  dateTo: string;
  query: string;
  onNavigate: (id: string) => void;
};

const CLOSED_STATUSES = new Set(["delivered", "cancelled", "returned"]);

const clean = (value: unknown) => String(value ?? "").trim();
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[\s_-]+/g, "");
const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${numberValue(value).toFixed(2)} درهم` : `${numberValue(value).toFixed(2)} AED`;
const orderReference = (order: Order) =>
  clean(order.tracking_number || order.tracking_code || order.invoice_number || order.id || "—");
const orderDate = (order: Order) => clean(order.created_at || order.updated_at).slice(0, 10);
const statusKey = (value: unknown) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");

function phoneForWhatsApp(value: unknown) {
  let digits = clean(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return digits;
}

function statusLabel(value: unknown, isArabic: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ["جديد", "Pending"],
    review: ["قيد المراجعة", "Under review"],
    confirmed: ["بدأ المهمة", "Mission started"],
    assigned: ["مسند للمندوب", "Assigned"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    delivered: ["تم التسليم", "Delivered"],
    postponed: ["مؤجل", "Postponed"],
    returned: ["راجع", "Returned"],
    cancelled: ["ملغي", "Cancelled"],
  };
  const status = statusKey(value);
  return labels[status]?.[isArabic ? 0 : 1] || status || "—";
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "normal" | "gold" | "success" | "danger" | "sky";
}) {
  const style =
    tone === "gold"
      ? "border-brand-gold/35 bg-brand-gold/[.09] text-brand-gold"
      : tone === "success"
        ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-200"
        : tone === "danger"
          ? "border-rose-400/25 bg-rose-400/[.07] text-rose-200"
          : tone === "sky"
            ? "border-brand-sky/25 bg-brand-sky/[.07] text-brand-sky"
            : "border-white/10 bg-[#031226] text-white";
  return (
    <article className={`rounded-[1.3rem] border p-4 ${style}`}>
      <Icon className="h-4 w-4" />
      <small className="mt-2 block text-[10px] font-black opacity-65">{label}</small>
      <strong className="mt-1 block text-lg font-black text-white" dir="ltr">{value}</strong>
    </article>
  );
}

export default function AdminDriverStatementsCenter({
  isArabic,
  dateFrom,
  dateTo,
  query,
  onNavigate: _onNavigate,
}: Props) {
  const { drivers, loading, error, refresh } = useAdminDrivers();
  const [driverId, setDriverId] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const driver = drivers.find((item) => item.id === driverId) || null;

  const visibleDrivers = useMemo(() => {
    return drivers.filter((item) =>
      matchesSearchQuery([
        item.full_name,
        item.name,
        item.phone,
        item.vehicle_plate,
        item.vehicle_type,
        item.emirate,
        item.work_area,
      ], `${query} ${driverQuery}`),
    );
  }, [driverQuery, drivers, query]);

  const visibleOrders = useMemo(() => {
    if (!driver) return [];
    return driver.orders
      .filter((order) => {
        const date = orderDate(order);
        const insidePeriod = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
        const matches = matchesSearchQuery([
            orderReference(order),
            order.coupon_number,
            order.invoice_number,
            order.receiver_name,
            order.receiver_phone,
            order.receiver_city,
            order.sender_city,
            order.status,
          ], orderQuery);
        return insidePeriod && matches;
      })
      .sort((left, right) =>
        new Date(right.created_at || right.updated_at || 0).getTime() -
        new Date(left.created_at || left.updated_at || 0).getTime(),
      );
  }, [dateFrom, dateTo, driver, orderQuery]);

  const selectedOrders = visibleOrders.filter((order) => selected.includes(order.id));
  const exportOrders = selectedOrders.length ? selectedOrders : visibleOrders;
  const activeOrders = visibleOrders.filter((order) => !CLOSED_STATUSES.has(statusKey(order.status)));
  const deliveredOrders = visibleOrders.filter((order) => statusKey(order.status) === "delivered");
  const returnedOrders = visibleOrders.filter((order) => statusKey(order.status) === "returned");
  const cancelledOrders = visibleOrders.filter((order) => statusKey(order.status) === "cancelled");
  const codTotal = visibleOrders.reduce((sum, order) => sum + numberValue(order.cod_amount), 0);
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selected.includes(order.id));

  async function changeStatus(order: Order, status: string) {
    setBusy(true);
    setMessage("");
    try {
      await updateOrderStatus(
        order.id,
        status,
        isArabic ? "تحديث من كشف طلبيات المندوب" : "Updated from driver order statement",
      );
      await refresh();
      setMessage(isArabic ? "تم تحديث حالة الطلبية في جميع اللوحات." : "Order status updated across all dashboards.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const ordersPdf: AdminPdfPayload = {
    language: isArabic ? "ar" : "en",
    sectionTitle: `${isArabic ? "كشف طلبيات المندوب" : "Driver assigned-orders statement"} · ${driver?.full_name || driver?.name || "DAY NIGHT"}`,
    filters: `${dateFrom || "—"} → ${dateTo || "—"}`,
    totals: {
      [isArabic ? "إجمالي الطلبيات" : "Total orders"]: exportOrders.length,
      [isArabic ? "قيد التنفيذ" : "Active"]: exportOrders.filter((order) => !CLOSED_STATUSES.has(statusKey(order.status))).length,
      [isArabic ? "تم التسليم" : "Delivered"]: exportOrders.filter((order) => statusKey(order.status) === "delivered").length,
      [isArabic ? "إجمالي COD" : "Total COD"]: money(
        exportOrders.reduce((sum, order) => sum + numberValue(order.cod_amount), 0),
        isArabic,
      ),
    },
    columns: [
      { key: "reference", label: isArabic ? "الطلب" : "Order" },
      { key: "date", label: isArabic ? "التاريخ" : "Date" },
      { key: "recipient", label: isArabic ? "المستلم" : "Recipient" },
      { key: "phone", label: isArabic ? "الهاتف" : "Phone" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "cod", label: "COD" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: exportOrders.map((order) => ({
      reference: orderReference(order),
      date: orderDate(order) || "—",
      recipient: order.receiver_name || order.customer_name || "—",
      phone: order.receiver_phone || "—",
      route: `${order.sender_city || "—"} → ${order.receiver_city || "—"}`,
      cod: money(order.cod_amount, isArabic),
      status: statusLabel(order.status, isArabic),
    })),
    orientation: "landscape",
  };

  const whatsappSummary = useMemo(() => {
    if (!driver) return "";
    return [
      `السلام عليكم ${driver.full_name || driver.name || "مندوبنا الكريم"}،`,
      `ملخص طلبيات DAY NIGHT المسندة لك للفترة ${dateFrom || "—"} إلى ${dateTo || "—"}:`,
      `إجمالي الطلبيات: ${visibleOrders.length}`,
      `قيد التنفيذ: ${activeOrders.length}`,
      `تم التسليم: ${deliveredOrders.length}`,
      `راجع: ${returnedOrders.length}`,
      `ملغي: ${cancelledOrders.length}`,
      `إجمالي التحصيل COD: ${money(codTotal, true)}`,
      "",
      "يرجى مراجعة المهام من تطبيق المندوب والتواصل مع مركز العمليات عند وجود أي ملاحظة.",
    ].join("\n");
  }, [activeOrders.length, cancelledOrders.length, codTotal, dateFrom, dateTo, deliveredOrders.length, driver, returnedOrders.length, visibleOrders.length]);

  if (!driver) {
    return (
      <section className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[#031226] p-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black text-brand-gold">
              <Truck className="h-4 w-4" />
              {isArabic ? "كشوفات طلبيات المناديب" : "Driver order statements"}
            </span>
            <h2 className="mt-2 text-2xl font-black text-white">
              {isArabic ? "اختر المندوب لعرض الطلبيات المسندة إليه" : "Choose a driver to view assigned orders"}
            </h2>
            <p className="mt-2 max-w-3xl text-xs font-bold leading-6 text-white/45">
              {isArabic
                ? "هذا القسم للطلبيات والتشغيل والتحصيل فقط. الرواتب والسلف والخصومات تُدار حصريًا من قسم الموظفين."
                : "This section is only for assigned orders, operations, and COD. Salaries, advances, and deductions are managed exclusively in Employees."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071a33] px-4 py-3">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={driverQuery}
                onChange={(event) => setDriverQuery(event.target.value)}
                className="bg-transparent text-sm text-white outline-none"
                placeholder={isArabic ? "بحث عن مندوب" : "Search drivers"}
              />
            </label>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {isArabic ? "تحديث حي" : "Live refresh"}
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDrivers.map((item) => (
            <article key={item.id} className="rounded-[1.4rem] border border-white/10 bg-[#071a33] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/5 text-brand-gold">
                  {item.avatar_url ? <img src={item.avatar_url} className="h-full w-full object-cover" alt="" /> : <UserRound className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-black text-white">{item.full_name || item.name || "—"}</h3>
                  <p className="mt-1 text-[11px] text-white/45" dir="ltr">{item.phone || "—"} · {item.vehicle_plate || "—"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <span className="rounded-xl bg-white/[.04] p-2"><strong className="block text-white">{item.orders.length}</strong><small className="text-[9px] text-white/40">{isArabic ? "مسند" : "Assigned"}</small></span>
                <span className="rounded-xl bg-brand-sky/[.07] p-2"><strong className="block text-brand-sky">{item.active_orders}</strong><small className="text-[9px] text-white/40">{isArabic ? "نشط" : "Active"}</small></span>
                <span className="rounded-xl bg-emerald-400/[.07] p-2"><strong className="block text-emerald-200">{item.delivered_today}</strong><small className="text-[9px] text-white/40">{isArabic ? "سُلّم اليوم" : "Today"}</small></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDriverId(item.id);
                  setSelected([]);
                  setOrderQuery("");
                  setMessage("");
                }}
                className="mt-4 w-full rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-[#071a33]"
              >
                {isArabic ? "فتح كشف الطلبيات" : "Open order statement"}
              </button>
            </article>
          ))}
        </div>
        {!loading && !visibleDrivers.length ? <p className="py-10 text-center text-sm text-white/45">{isArabic ? "لا توجد نتائج." : "No results."}</p> : null}
      </section>
    );
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const waPhone = phoneForWhatsApp(driver.phone);

  return (
    <section className="space-y-4">
      <header className="rounded-[1.8rem] border border-brand-gold/25 bg-[#031226] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => {
                setDriverId("");
                setSelected([]);
                setMessage("");
              }}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"
            >
              <BackIcon className="h-5 w-5" />
            </button>
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white/5 text-brand-gold">
              {driver.avatar_url ? <img src={driver.avatar_url} className="h-full w-full object-cover" alt="" /> : <UserRound />}
            </span>
            <div>
              <span className="text-[10px] font-black text-brand-gold">{isArabic ? "كشف الطلبيات المسندة" : "ASSIGNED ORDERS STATEMENT"}</span>
              <h2 className="mt-1 text-2xl font-black text-white">{driver.full_name || driver.name}</h2>
              <p className="mt-1 text-[11px] text-white/48">
                <Phone className="inline h-3.5 w-3.5" /> {driver.phone || "—"} · <MapPin className="inline h-3.5 w-3.5" /> {driver.emirate || driver.work_area || "—"}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[10px] font-black text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            {isArabic ? "بيانات حقيقية ومزامنة مباشرة" : "Live production data"}
          </span>
        </div>
      </header>

      {message ? <p className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-xs font-bold leading-6 text-brand-gold">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label={isArabic ? "إجمالي المسند" : "Assigned"} value={String(visibleOrders.length)} icon={PackageCheck} tone="gold" />
        <Metric label={isArabic ? "قيد التنفيذ" : "Active"} value={String(activeOrders.length)} icon={Clock3} tone="sky" />
        <Metric label={isArabic ? "تم التسليم" : "Delivered"} value={String(deliveredOrders.length)} icon={CheckCircle2} tone="success" />
        <Metric label={isArabic ? "راجع" : "Returned"} value={String(returnedOrders.length)} icon={Route} tone="danger" />
        <Metric label={isArabic ? "ملغي" : "Cancelled"} value={String(cancelledOrders.length)} icon={XCircle} tone="danger" />
        <Metric label={isArabic ? "إجمالي COD" : "Total COD"} value={money(codTotal, isArabic)} icon={Banknote} tone="gold" />
      </div>

      <section className="rounded-[1.8rem] border border-white/10 bg-[#031226]">
        <header className="flex flex-col gap-3 border-b border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-black text-white">{visibleOrders.length} {isArabic ? "طلبية مسندة للمندوب" : "assigned driver orders"}</h3>
            <p className="mt-1 text-xs text-white/45">{dateFrom || "—"} → {dateTo || "—"}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#071a33] px-3 py-2">
              <Search className="h-4 w-4 text-white/35" />
              <input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} className="bg-transparent text-xs text-white outline-none" placeholder={isArabic ? "بحث في الطلبيات" : "Search orders"} />
            </label>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? [] : visibleOrders.map((order) => order.id))}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              {allSelected ? (isArabic ? "إلغاء تحديد الكل" : "Clear all") : (isArabic ? "تحديد الكل" : "Select all")}
            </button>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-xs">
            <thead className="bg-white/[.04] text-white/55">
              <tr>
                <th className="px-4 py-3">✓</th>
                <th className="px-4 py-3">{isArabic ? "الطلب" : "Order"}</th>
                <th className="px-4 py-3">{isArabic ? "التاريخ" : "Date"}</th>
                <th className="px-4 py-3">{isArabic ? "المستلم" : "Recipient"}</th>
                <th className="px-4 py-3">{isArabic ? "الهاتف" : "Phone"}</th>
                <th className="px-4 py-3">{isArabic ? "المسار" : "Route"}</th>
                <th className="px-4 py-3">COD</th>
                <th className="px-4 py-3">{isArabic ? "الحالة" : "Status"}</th>
                <th className="px-4 py-3">{isArabic ? "متابعة" : "Track"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const reference = orderReference(order);
                return (
                  <tr key={order.id} className="border-t border-white/7 text-white/75">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(order.id)} onChange={() => setSelected((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} /></td>
                    <td className="px-4 py-3 font-black text-white" dir="ltr">{reference}</td>
                    <td className="px-4 py-3" dir="ltr">{orderDate(order) || "—"}</td>
                    <td className="px-4 py-3">{order.receiver_name || order.customer_name || "—"}</td>
                    <td className="px-4 py-3" dir="ltr">{order.receiver_phone || "—"}</td>
                    <td className="px-4 py-3">{order.sender_city || "—"} → {order.receiver_city || "—"}</td>
                    <td className="px-4 py-3 font-black text-brand-gold" dir="ltr">{money(order.cod_amount, isArabic)}</td>
                    <td className="px-4 py-3">
                      <select value={statusKey(order.status)} onChange={(event) => void changeStatus(order, event.target.value)} disabled={busy} className="rounded-lg border border-white/10 bg-[#071a33] px-3 py-2 text-xs text-white">
                        <option value="pending">{isArabic ? "جديد" : "Pending"}</option>
                        <option value="review">{isArabic ? "قيد المراجعة" : "Under review"}</option>
                        <option value="confirmed">{isArabic ? "بدأ المهمة" : "Mission started"}</option>
                        <option value="assigned">{isArabic ? "مسند" : "Assigned"}</option>
                        <option value="picked_up">{isArabic ? "تم الاستلام" : "Picked up"}</option>
                        <option value="in_transit">{isArabic ? "في الطريق" : "In transit"}</option>
                        <option value="delivered">{isArabic ? "تم التسليم" : "Delivered"}</option>
                        <option value="postponed">{isArabic ? "مؤجل" : "Postponed"}</option>
                        <option value="returned">{isArabic ? "راجع" : "Returned"}</option>
                        <option value="cancelled">{isArabic ? "ملغي" : "Cancelled"}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/tracking?code=${encodeURIComponent(reference)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-brand-sky/25 bg-brand-sky/10 px-3 py-2 font-black text-brand-sky">
                        <ExternalLink className="h-3.5 w-3.5" />{isArabic ? "متابعة" : "Track"}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleOrders.length ? <p className="py-12 text-center text-sm text-white/45">{isArabic ? "لا توجد طلبيات مسندة ضمن الفترة المحددة." : "No assigned orders in the selected period."}</p> : null}
      </section>

      <aside className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-[1.5rem] border border-brand-gold/25 bg-[#06172c]/95 p-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <strong className="text-white">
          {selectedOrders.length
            ? `${selectedOrders.length} ${isArabic ? "طلبية محددة للتصدير" : "selected for export"}`
            : `${visibleOrders.length} ${isArabic ? "طلبية ستُصدّر تلقائيًا" : "orders will be exported"}`}
        </strong>
        <div className="flex flex-wrap gap-2">
          {exportOrders.length ? (
            <AdminPdfExportButton payload={ordersPdf} label={isArabic ? "تصدير كشف الطلبيات" : "Export order statement"} />
          ) : (
            <button type="button" disabled className="dn-admin-pdf-button opacity-40"><FileDown className="h-4 w-4" />{isArabic ? "لا توجد طلبيات" : "No orders"}</button>
          )}
          <a
            href={waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(whatsappSummary)}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!waPhone}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 text-xs font-black text-[#031226] aria-disabled:pointer-events-none aria-disabled:opacity-35"
          >
            <MessageCircle className="h-4 w-4" />
            {isArabic ? "إرسال ملخص الطلبيات" : "Send order summary"}
          </a>
        </div>
      </aside>
    </section>
  );
}
