import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import AdminLiveOperationsMap from "./AdminLiveOperationsMap";
import AdminPdfExportButton from "./AdminPdfExportButton";
import AdminFinanceOperationsCenter from "./AdminFinanceOperationsCenter";
import AdminDriverAssignmentModal from "./AdminDriverAssignmentModal";
import AdminOrderEditModal from "./AdminOrderEditModal";
import AdminOrderDeleteModal from "./AdminOrderDeleteModal";
import { adminSectionById, type AdminSectionId } from "./AdminSectionRegistry";
import type { Merchant, Order } from "../../types";
import type { FinanceSummary, FinanceSummarySource } from "../../lib/adminData";
import { AdminEmptyState, AdminIconBadge, AdminStateChip, type AdminIconName, type AdminIconTone } from "./adminIconSystem";
import { addAdminNotification, playAdminAudioEvent } from "../../lib/adminAudio";
import { updateExistingOrderStatus } from "../../supabaseAdminOps";
import { cleanAdminText, matchesAdminSection, normalizeAdminKey, normalizeOrderStatus } from "../../lib/adminOrderLogic";
import "../../styles/dn-admin-sections.css";

type FinanceArea = "finance_dashboard" | "driver_statements" | "merchant_statements" | "income" | "cod" | "expenses" | "accounts" | "adjustments" | "audit_log";
type Props = {
  id: AdminSectionId;
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  financeSummary: FinanceSummary | null;
  financeSummarySource?: FinanceSummarySource;
  financeWarning?: string;
  onNavigate?: (id: AdminSectionId) => void;
  onRefresh?: () => Promise<void>;
};
type ExtendedOrder = Order & {
  total?: number;
  total_amount?: number;
  total_price?: number;
  amount?: number;
  pickup_city?: string;
  delivery_city?: string;
  driver_id?: string;
  assigned_driver_id?: string;
  price_source?: string;
};
type OrderStatusOption = { value: string; ar: string; en: string; icon: typeof CheckCircle2 };

const financeSections = new Set<AdminSectionId>([
  "finance_dashboard",
  "driver_statements",
  "merchant_statements",
  "income",
  "cod",
  "expenses",
  "accounts",
  "adjustments",
  "audit_log",
]);
const orderStatusOptions: OrderStatusOption[] = [
  { value: "pending", ar: "قيد الانتظار", en: "Pending", icon: CalendarClock },
  { value: "review", ar: "قيد المراجعة", en: "Under review", icon: Search },
  { value: "confirmed", ar: "تم التأكيد", en: "Confirmed", icon: CheckCircle2 },
  { value: "assigned", ar: "تم تعيين مندوب", en: "Driver assigned", icon: Truck },
  { value: "picked_up", ar: "تم الاستلام", en: "Picked up", icon: Truck },
  { value: "in_transit", ar: "في الطريق", en: "In transit", icon: Truck },
  { value: "delivered", ar: "تم التسليم", en: "Delivered", icon: CheckCircle2 },
  { value: "postponed", ar: "مؤجل", en: "Postponed", icon: CalendarClock },
  { value: "returned", ar: "راجع", en: "Returned", icon: RotateCcw },
  { value: "cancelled", ar: "ملغي", en: "Cancelled", icon: XCircle },
];
const ORDER_STATUS_VALUES = new Set(orderStatusOptions.map((option) => option.value));
const normalize = cleanAdminText;
const normalizeStatusKey = normalizeAdminKey;
const extra = (order: Order) => order as ExtendedOrder;
const money = (value: unknown, isArabic: boolean) =>
  isArabic ? `${Number(value || 0).toFixed(2)} درهم` : `${Number(value || 0).toFixed(2)} AED`;
const tracking = (order: Order) =>
  order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";
const route = (order: Order) =>
  `${order.sender_city || extra(order).pickup_city || "—"} → ${order.receiver_city || extra(order).delivery_city || order.destination_country || "—"}`;
const amount = (order: Order) =>
  Number(order.delivery_price || order.price || extra(order).total || extra(order).total_price || extra(order).total_amount || extra(order).amount || 0);
const canonicalStatus = (value: unknown) => normalizeOrderStatus(value as string | Order | null | undefined);
const selectStatus = (value: unknown) =>
  ORDER_STATUS_VALUES.has(canonicalStatus(value)) ? canonicalStatus(value) : "pending";

const statusWords: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد الانتظار", en: "Pending" },
  review: { ar: "قيد المراجعة", en: "Under review" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  confirmed: { ar: "تم التأكيد", en: "Confirmed" },
  assigned: { ar: "تم تعيين مندوب", en: "Driver assigned" },
  picked_up: { ar: "تم الاستلام", en: "Picked up" },
  in_transit: { ar: "في الطريق", en: "In transit" },
  out_for_delivery: { ar: "في الطريق", en: "Out for delivery" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  completed: { ar: "مكتمل", en: "Completed" },
  postponed: { ar: "مؤجل", en: "Postponed" },
  returned: { ar: "راجع", en: "Returned" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
  canceled: { ar: "ملغي", en: "Canceled" },
  failed: { ar: "فشل", en: "Failed" },
};

function statusText(value: unknown, isArabic: boolean) {
  const key = normalizeStatusKey(value);
  const pair = statusWords[key] || statusWords[canonicalStatus(value)];
  if (pair) return isArabic ? pair.ar : pair.en;
  return key ? (isArabic ? "حالة محفوظة" : key.replace(/_/g, " ")) : "—";
}

function stateChip(value: unknown): { name: AdminIconName; tone: AdminIconTone } {
  const status = canonicalStatus(value);
  if (status === "delivered") return { name: "delivered-orders", tone: "success" };
  if (status === "cancelled") return { name: "cancelled-orders", tone: "danger" };
  if (status === "returned" || status === "postponed") return { name: "returned-orders", tone: "warning" };
  if (status === "review" || status === "pending") return { name: "review-orders-status", tone: "neutral" };
  return { name: "active-orders", tone: "info" };
}

function orderSearchText(order: Order) {
  return normalize([
    tracking(order),
    order.coupon_number,
    order.sender_city,
    order.receiver_city,
    order.destination_country,
    order.notes,
    order.sender_address,
    order.receiver_address,
    order.payment_method,
    order.merchant_name,
    order.merchant_code,
    order.sender_name,
    order.receiver_name,
    order.customer_name,
    order.receiver_phone,
    order.sender_phone,
    order.driver_name,
    order.driver_phone,
  ].join(" "));
}

export default function AdminSectionWorkspaceComplete({
  id,
  isArabic,
  orders,
  merchants,
  financeSummary,
  financeSummarySource = "derived",
  financeWarning,
  onNavigate,
  onRefresh,
}: Props) {
  const config = adminSectionById[id];
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [statusBusy, setStatusBusy] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const refresh = onRefresh || (async () => undefined);

  useEffect(() => {
    setQuery("");
    setNotice("");
    setStatusDrafts({});
    setStatusBusy("");
    setEditOrder(null);
    setDeleteOrder(null);
    setAssignOrder(null);
  }, [id]);

  const liveOrders = useMemo(
    () => orders.map((order) => {
      const override = statusOverrides[String(order.id || tracking(order))];
      return override && canonicalStatus(order.status) !== override ? { ...order, status: override } : order;
    }),
    [orders, statusOverrides],
  );
  const baseRows = useMemo(() => liveOrders.filter((order) => matchesAdminSection(order, id)), [id, liveOrders]);
  const rows = useMemo(
    () => baseRows.filter((order) => !query || orderSearchText(order).includes(normalize(query))).slice(0, 200),
    [baseRows, query],
  );

  if (financeSections.has(id)) {
    return (
      <AdminFinanceOperationsCenter
        isArabic={isArabic}
        activeSection={id as FinanceArea}
        orders={liveOrders}
        merchants={merchants}
        financeSummary={financeSummary}
        financeSummarySource={financeSummarySource}
        onRefresh={refresh}
        onNavigate={(target) => onNavigate?.(target as AdminSectionId)}
      />
    );
  }

  async function changeOrderStatus(order: Order) {
    const rowKey = String(order.id || tracking(order));
    const current = selectStatus(order.status || "pending");
    const next = selectStatus(statusDrafts[rowKey] || current);
    if (!order.id || next === current) return;
    setStatusBusy(rowKey);
    setNotice("");
    try {
      const ok = await updateExistingOrderStatus(
        order.id,
        next,
        isArabic ? `تحديث من لوحة الإدارة إلى ${statusText(next, true)}` : `Admin updated status to ${statusText(next, false)}`,
      );
      if (!ok) throw new Error("status_update_failed");
      setStatusOverrides((previous) => ({ ...previous, [rowKey]: next }));
      window.dispatchEvent(new CustomEvent("dn-admin-order-status-change", { detail: { orderId: order.id, status: next } }));
      playAdminAudioEvent(next === "delivered" ? "success" : "notification");
      addAdminNotification({
        type: "success",
        sectionId: id,
        priority: "low",
        dedupeKey: `status:${order.id}:${next}`,
        titleAr: "تم تحديث حالة الطلب",
        titleEn: "Order status updated",
        bodyAr: `تم تحديث ${tracking(order)} إلى ${statusText(next, true)}.`,
        bodyEn: `${tracking(order)} updated to ${statusText(next, false)}.`,
      });
      setNotice(isArabic ? `تم تحديث ${tracking(order)} بنجاح.` : `${tracking(order)} updated successfully.`);
      await refresh();
    } catch (error) {
      console.error(error);
      setNotice(isArabic ? "فشل تحديث الحالة. راجع صلاحيات Supabase." : "Status update failed. Check Supabase permissions.");
    } finally {
      setStatusBusy("");
    }
  }

  const title = isArabic ? config.titleAr : config.titleEn;
  const totals = {
    orders: baseRows.length,
    visible: rows.length,
    income: money(baseRows.reduce((sum, order) => sum + amount(order), 0), isArabic),
  };

  return (
    <section className="dn-section-workspace" dir={isArabic ? "rtl" : "ltr"}>
      <header className="dn-section-hero">
        <div className="dn-section-hero-copy">
          <AdminIconBadge name="orders" label={title} />
          <div>
            <span>{isArabic ? "إدارة مرنة · بيانات Supabase الحقيقية" : "Flexible management · Live Supabase data"}</span>
            <h1>{title}</h1>
            <p>{isArabic ? config.subtitleAr : config.subtitleEn}</p>
          </div>
        </div>
        <div className="dn-section-hero-actions">
          <button type="button" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />{isArabic ? "تحديث" : "Refresh"}</button>
          <AdminPdfExportButton payload={{ language: isArabic ? "ar" : "en", sectionTitle: title, filters: query || (isArabic ? "بدون فلاتر" : "No filters"), totals, columns: [{ key: "tracking", label: isArabic ? "التتبع" : "Tracking" }, { key: "coupon", label: isArabic ? "الكوبون" : "Coupon" }, { key: "status", label: isArabic ? "الحالة" : "Status" }, { key: "merchant", label: isArabic ? "التاجر" : "Merchant" }, { key: "route", label: isArabic ? "المسار" : "Route" }, { key: "amount", label: isArabic ? "السعر" : "Price" }], rows: rows.map((order) => ({ tracking: tracking(order), coupon: order.coupon_number || "—", status: statusText(order.status, isArabic), merchant: order.merchant_name || order.sender_name || "—", route: route(order), amount: money(amount(order), isArabic) })) }} />
        </div>
      </header>

      {id === "dashboard" && <AdminLiveOperationsMap isArabic={isArabic} orders={liveOrders} />}
      {financeWarning && <p className="dn-clean-note">{isArabic ? "ملخص مالي مشتق مؤقتاً من الطلبات" : "Finance summary temporarily derived from orders"}</p>}

      <div className="dn-section-kpis">
        <article><AdminIconBadge name="orders" /><strong>{baseRows.length}</strong><span>{isArabic ? "إجمالي القسم" : "Section total"}</span><small>{isArabic ? "بيانات حقيقية" : "Live data"}</small></article>
        <article><AdminIconBadge name="review-orders-status" /><strong>{baseRows.filter((order) => ["pending", "review"].includes(canonicalStatus(order.status))).length}</strong><span>{isArabic ? "تحتاج متابعة" : "Needs review"}</span><small>{isArabic ? "قابلة للتعديل" : "Editable"}</small></article>
        <article><AdminIconBadge name="driver" /><strong>{baseRows.filter((order) => extra(order).assigned_driver_id || extra(order).driver_id || order.driver_name).length}</strong><span>{isArabic ? "مُسندة" : "Assigned"}</span><small>{isArabic ? "إسناد حقيقي" : "Live dispatch"}</small></article>
        <article><AdminIconBadge name="income" /><strong>{totals.income}</strong><span>{isArabic ? "قيمة التوصيل" : "Delivery value"}</span><small>{isArabic ? "حسب الصفوف" : "From rows"}</small></article>
      </div>

      <div className="dn-section-panels">
        <article>
          <h3><AdminIconBadge name="filters" />{isArabic ? "البحث" : "Search"}</h3>
          <div className="dn-section-form"><label><span>{isArabic ? "بحث شامل" : "Global search"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "رقم كوبون، تتبع، هاتف، تاجر..." : "Coupon, tracking, phone, merchant..."} /></label></div>
        </article>
        <article>
          <h3><AdminIconBadge name="click" />{isArabic ? "سياسة الإجراءات" : "Action policy"}</h3>
          <p className="dn-clean-note">{isArabic ? "التعديل والحذف منفصلان وواضحان في كل صف. الحذف آمن وممنوع للطلبات المسندة أو الجارية أو المسلّمة، بينما تعديل الحالة والإسناد لهما أدوات مستقلة." : "Edit and delete are separate and visible on every row. Deletion is protected for assigned, active, or delivered orders; status and dispatch use dedicated controls."}</p>
          <button type="button" onClick={() => onNavigate?.("new_order")} className="mt-3">{isArabic ? "إضافة طلب جديد" : "Add new order"}</button>
        </article>
      </div>

      <article className="dn-section-table-card">
        <h3><AdminIconBadge name="rows" />{isArabic ? "إدارة الطلبات الحالية" : "Manage current orders"}</h3>
        {notice && <p className="dn-clean-note">{notice}</p>}
        <div className="dn-section-table-wrap">
          <table>
            <thead><tr><th>{isArabic ? "التتبع" : "Tracking"}</th><th>{isArabic ? "رقم الكوبون" : "Coupon"}</th><th>{isArabic ? "الحالة" : "Status"}</th><th>{isArabic ? "التاجر" : "Merchant"}</th><th>{isArabic ? "المسار" : "Route"}</th><th>{isArabic ? "المستلم" : "Receiver"}</th><th>{isArabic ? "سعر التوصيل" : "Delivery price"}</th><th>{isArabic ? "إدارة الطلب" : "Actions"}</th><th>{isArabic ? "تحديث الحالة" : "Status update"}</th></tr></thead>
            <tbody>
              {rows.map((order) => {
                const rowKey = String(order.id || tracking(order));
                const current = selectStatus(order.status || "pending");
                const draft = statusDrafts[rowKey] || current;
                const busy = statusBusy === rowKey;
                const assigned = extra(order).assigned_driver_id || extra(order).driver_id || order.driver_name || order.driver_code;
                return (
                  <tr key={rowKey}>
                    <td><span dir="ltr" className="dn-order-track-ref">{tracking(order)}</span></td>
                    <td><strong dir="ltr">{order.coupon_number || (isArabic ? "مطلوب استكماله" : "Missing")}</strong></td>
                    <td><AdminStateChip name={stateChip(order.status).name} tone={stateChip(order.status).tone}>{statusText(order.status, isArabic)}</AdminStateChip></td>
                    <td>{order.merchant_name || order.sender_name || "—"}</td>
                    <td>{route(order)}</td>
                    <td><strong>{order.receiver_name || order.customer_name || "—"}</strong><small className="block opacity-60">{order.receiver_phone || "—"}</small></td>
                    <td><strong>{money(amount(order), isArabic)}</strong>{extra(order).price_source === "manual" && <small className="block text-brand-gold">{isArabic ? "سعر يدوي" : "Manual"}</small>}</td>
                    <td>
                      <div className="flex min-w-[300px] flex-wrap gap-2">
                        <button type="button" onClick={() => setEditOrder(order)} className="inline-flex items-center gap-1 rounded-lg border border-brand-sky/25 px-3 py-2 text-xs font-black"><Pencil className="h-4 w-4" />{isArabic ? "تعديل" : "Edit"}</button>
                        <button type="button" onClick={() => setDeleteOrder(order)} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 px-3 py-2 text-xs font-black text-rose-200"><Trash2 className="h-4 w-4" />{isArabic ? "حذف" : "Delete"}</button>
                        <button type="button" onClick={() => setAssignOrder(order)} className="inline-flex items-center gap-1 rounded-lg border border-brand-gold/30 px-3 py-2 text-xs font-black text-brand-gold"><Truck className="h-4 w-4" />{assigned ? (isArabic ? "إعادة تعيين" : "Reassign") : (isArabic ? "إرسال للمندوب" : "Assign driver")}</button>
                      </div>
                    </td>
                    <td><div className="dn-order-status-control"><select value={draft} onChange={(event) => setStatusDrafts((previous) => ({ ...previous, [rowKey]: event.target.value }))}>{orderStatusOptions.map((option) => <option value={option.value} key={option.value}>{isArabic ? option.ar : option.en}</option>)}</select><button type="button" disabled={busy || draft === current} onClick={() => void changeOrderStatus(order)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{busy ? (isArabic ? "جارٍ الحفظ" : "Saving") : (isArabic ? "تحديث" : "Update")}</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <AdminEmptyState icon="empty-state" title={isArabic ? "لا توجد طلبات مطابقة" : "No matching orders"} message={isArabic ? "غيّر البحث أو أضف طلباً جديداً." : "Change the search or add a new order."} action={<button type="button" onClick={() => setQuery("")}><RefreshCw className="h-4 w-4" />{isArabic ? "مسح البحث" : "Clear search"}</button>} />}
        </div>
      </article>

      <AdminOrderEditModal order={editOrder} merchants={merchants} isArabic={isArabic} open={Boolean(editOrder)} onClose={() => setEditOrder(null)} onSaved={async () => { setNotice(isArabic ? "تم حفظ تعديلات الطلب بنجاح." : "Order changes saved."); setEditOrder(null); await refresh(); }} />
      <AdminOrderDeleteModal order={deleteOrder} isArabic={isArabic} open={Boolean(deleteOrder)} onClose={() => setDeleteOrder(null)} onDeleted={async () => { setNotice(isArabic ? "تم حذف الطلب الآمن وتسجيل السبب." : "Safe order deletion completed and logged."); setDeleteOrder(null); await refresh(); }} />
      <AdminDriverAssignmentModal order={assignOrder} isArabic={isArabic} open={Boolean(assignOrder)} onClose={() => setAssignOrder(null)} onSaved={async () => { setNotice(isArabic ? "تم إرسال الطلب للمندوب وتحديث الإسناد." : "Order dispatched and assignment updated."); setAssignOrder(null); await refresh(); }} />
    </section>
  );
}
