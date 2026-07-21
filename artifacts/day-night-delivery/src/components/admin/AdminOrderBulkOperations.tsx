import { useMemo } from "react";
import {
  CheckSquare2,
  ListChecks,
  Printer,
  Search,
  Square,
  Store,
  X,
} from "lucide-react";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import { normalizeOrderStatus } from "../../lib/adminOrderLogic";
import type { Merchant, Order } from "../../types";
import AdminPdfExportButton from "./AdminPdfExportButton";

type Props = {
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  merchantId: string;
  query: string;
  selectedIds: string[];
  onMerchantChange: (merchantId: string) => void;
  onQueryChange: (query: string) => void;
  onSelectionChange: (ids: string[]) => void;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function orderId(order: Order) {
  return clean(order.id || order.tracking_number || order.invoice_number || order.coupon_number);
}

function reference(order: Order) {
  return clean(order.tracking_number || order.invoice_number || order.coupon_number || order.id) || "—";
}

function merchantName(merchant: Merchant) {
  return clean(merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id) || "—";
}

function statusLabel(value: unknown, isArabic: boolean) {
  const status = normalizeOrderStatus(value as string | Order | null | undefined);
  const labels: Record<string, [string, string]> = {
    pending: ["قيد الانتظار", "Pending"],
    review: ["قيد المراجعة", "Under review"],
    confirmed: ["تم التأكيد", "Confirmed"],
    assigned: ["تم تعيين مندوب", "Driver assigned"],
    accepted: ["تم قبول المهمة", "Accepted"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    out_for_delivery: ["خرج للتسليم", "Out for delivery"],
    delivered: ["تم التسليم", "Delivered"],
    postponed: ["مؤجل", "Postponed"],
    returned: ["راجع", "Returned"],
    cancelled: ["ملغي", "Cancelled"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || status.replaceAll("_", " ") || "—";
}

function escapeHtml(value: unknown) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makePayload(orders: Order[], isArabic: boolean): AdminPdfPayload {
  return {
    language: isArabic ? "ar" : "en",
    sectionTitle: isArabic ? "طلبات التجار المحددة" : "Selected merchant orders",
    filters: isArabic
      ? `عدد الطلبات المحددة: ${orders.length}`
      : `Selected orders: ${orders.length}`,
    totals: {
      orders: orders.length,
      cod: `${orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0).toFixed(2)} AED`,
      delivery: `${orders.reduce((sum, order) => sum + Number(order.delivery_price || order.delivery_fee || 0), 0).toFixed(2)} AED`,
    },
    columns: [
      { key: "tracking", label: isArabic ? "التتبع" : "Tracking" },
      { key: "merchant", label: isArabic ? "التاجر" : "Merchant" },
      { key: "customer", label: isArabic ? "المستلم" : "Recipient" },
      { key: "phone", label: isArabic ? "الهاتف" : "Phone" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "cod", label: "COD" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: orders.map((order) => ({
      tracking: reference(order),
      merchant: clean(order.merchant_name || order.sender_name) || "—",
      customer: clean(order.receiver_name || order.customer_name) || "—",
      phone: clean(order.receiver_phone || order.customer_phone) || "—",
      route: `${clean(order.sender_city) || "—"} → ${clean(order.receiver_city || order.destination_country) || "—"}`,
      cod: `${Number(order.cod_amount || 0).toFixed(2)} AED`,
      status: statusLabel(order.status, isArabic),
    })),
  };
}

function printOrders(orders: Order[], isArabic: boolean) {
  const popup = window.open("", "DAY_NIGHT_ORDER_PRINT", "width=1280,height=860");
  if (!popup) return;

  const rows = orders
    .map(
      (order) => `<tr>
        <td dir="ltr">${escapeHtml(reference(order))}</td>
        <td>${escapeHtml(order.merchant_name || order.sender_name || "—")}</td>
        <td>${escapeHtml(order.receiver_name || order.customer_name || "—")}</td>
        <td dir="ltr">${escapeHtml(order.receiver_phone || order.customer_phone || "—")}</td>
        <td>${escapeHtml(order.sender_city || "—")} → ${escapeHtml(order.receiver_city || order.destination_country || "—")}</td>
        <td dir="ltr">${Number(order.cod_amount || 0).toFixed(2)} AED</td>
        <td>${escapeHtml(statusLabel(order.status, isArabic))}</td>
      </tr>`,
    )
    .join("");

  popup.document.write(`<!doctype html>
  <html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
    <head>
      <meta charset="utf-8" />
      <title>DAY NIGHT — ${isArabic ? "طلبات التجار" : "Merchant orders"}</title>
      <style>
        @page{size:A4 landscape;margin:12mm}
        *{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#07172c;margin:0}
        header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d4af37;padding-bottom:12px;margin-bottom:18px}
        h1{margin:0;font-size:24px}p{margin:5px 0 0;color:#4a5d73}strong{color:#0b3d70}
        table{width:100%;border-collapse:collapse;font-size:11px}th{background:#07172c;color:#fff;padding:9px;border:1px solid #253e58}
        td{padding:8px;border:1px solid #ccd6e0;vertical-align:top}tbody tr:nth-child(even){background:#eef4f9}
        footer{margin-top:14px;font-size:10px;color:#60758b}
      </style>
    </head>
    <body>
      <header><div><strong>DAY NIGHT DELIVERY SERVICES</strong><h1>${isArabic ? "كشف الطلبات المحددة" : "Selected orders report"}</h1><p>${isArabic ? "بيانات تشغيل حقيقية من لوحة الإدارة" : "Live operational data from the admin portal"}</p></div><b>${orders.length}</b></header>
      <table><thead><tr>
        <th>${isArabic ? "التتبع" : "Tracking"}</th><th>${isArabic ? "التاجر" : "Merchant"}</th><th>${isArabic ? "المستلم" : "Recipient"}</th><th>${isArabic ? "الهاتف" : "Phone"}</th><th>${isArabic ? "المسار" : "Route"}</th><th>COD</th><th>${isArabic ? "الحالة" : "Status"}</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <footer>www.daynightae.com · +971 56 875 7331 · ${new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE")}</footer>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));</script>
    </body>
  </html>`);
  popup.document.close();
  popup.focus();
}

export default function AdminOrderBulkOperations({
  isArabic,
  orders,
  merchants,
  merchantId,
  query,
  selectedIds,
  onMerchantChange,
  onQueryChange,
  onSelectionChange,
}: Props) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOrders = useMemo(
    () => orders.filter((order) => selected.has(orderId(order))),
    [orders, selected],
  );
  const exportOrders = selectedOrders.length ? selectedOrders : orders;
  const payload = useMemo(() => makePayload(exportOrders, isArabic), [exportOrders, isArabic]);

  function toggle(order: Order) {
    const id = orderId(order);
    if (!id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange([...next]);
  }

  return (
    <section className="dn-admin-bulk-console" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-admin-bulk-console-head">
        <div>
          <h3><ListChecks className="h-5 w-5" />{isArabic ? "تحديد وعمليات طلبات التاجر" : "Merchant order selection and actions"}</h3>
          <p>{isArabic ? "ابحث بالتاجر أو الطلب، حدّد طلباً أو أكثر، ثم اطبع أو صدّر PDF/CSV/Word." : "Filter by merchant or order, select one or more, then print or export PDF/CSV/Word."}</p>
        </div>
        <div className="dn-admin-bulk-summary">
          <strong>{orders.length}</strong>
          <span>{isArabic ? "مطابق" : "matching"}</span>
          <strong>{selectedOrders.length}</strong>
          <span>{isArabic ? "محدد" : "selected"}</span>
        </div>
      </div>

      <div className="dn-admin-bulk-filter-grid">
        <label>
          <span><Store className="inline h-4 w-4" /> {isArabic ? "التاجر" : "Merchant"}</span>
          <select value={merchantId} onChange={(event) => onMerchantChange(event.target.value)}>
            <option value="">{isArabic ? "كل التجار" : "All merchants"}</option>
            {merchants.map((merchant) => (
              <option value={clean(merchant.id)} key={clean(merchant.id)}>
                {merchantName(merchant)}{merchant.merchant_code ? ` · ${merchant.merchant_code}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span><Search className="inline h-4 w-4" /> {isArabic ? "بحث داخل الطلبات" : "Search orders"}</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={isArabic ? "تتبع، كوبون، اسم، هاتف، مدينة، حالة..." : "Tracking, coupon, name, phone, city, status..."}
          />
        </label>
      </div>

      <div className="dn-admin-bulk-console-actions">
        <button type="button" className="is-primary" onClick={() => onSelectionChange(orders.map(orderId).filter(Boolean))} disabled={!orders.length}>
          <CheckSquare2 className="h-4 w-4" />{isArabic ? "تحديد كل النتائج" : "Select all results"}
        </button>
        <button type="button" onClick={() => onSelectionChange([])} disabled={!selectedIds.length}>
          <X className="h-4 w-4" />{isArabic ? "مسح التحديد" : "Clear selection"}
        </button>
        <button type="button" onClick={() => printOrders(exportOrders, isArabic)} disabled={!exportOrders.length}>
          <Printer className="h-4 w-4" />{isArabic ? "طباعة المحدد" : "Print selected"}
        </button>
        <AdminPdfExportButton payload={payload} label={isArabic ? "تصدير المحدد" : "Export selected"} />
      </div>

      <details className="dn-admin-bulk-selector" open={orders.length > 0 && orders.length <= 12}>
        <summary>{isArabic ? "اختيار الطلبات بالاسم ورقم التتبع" : "Choose orders by name and tracking"}</summary>
        <div className="dn-admin-bulk-selector-list">
          {orders.slice(0, 200).map((order) => {
            const id = orderId(order);
            const checked = selected.has(id);
            return (
              <button
                type="button"
                className={`dn-admin-bulk-order-option ${checked ? "is-selected" : ""}`}
                key={id}
                onClick={() => toggle(order)}
                aria-pressed={checked}
              >
                {checked ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                <span>
                  <strong dir="ltr">{reference(order)}</strong>
                  <small>{clean(order.merchant_name || order.sender_name) || "—"} · {clean(order.receiver_name || order.customer_name) || "—"}</small>
                </span>
                <em>{statusLabel(order.status, isArabic)}</em>
              </button>
            );
          })}
          {!orders.length && <p>{isArabic ? "لا توجد طلبات مطابقة للفلاتر الحالية." : "No orders match the current filters."}</p>}
        </div>
      </details>
    </section>
  );
}
