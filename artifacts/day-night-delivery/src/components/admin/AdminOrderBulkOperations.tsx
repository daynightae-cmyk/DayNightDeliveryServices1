import { useMemo, useState } from "react";
import { CheckSquare2, FileDown, ListChecks, Printer, Search, Square, Store, X } from "lucide-react";
import type { AdminPdfPayload } from "../../lib/adminPdfExport";
import { localizedOrderRoute } from "../../lib/exportLocalization";
import { normalizeOrderStatus } from "../../lib/adminOrderLogic";
import { formatAdminMoney } from "../../lib/adminLocale";
import type { Merchant, Order } from "../../types";
import AdminPdfExportButton from "./AdminPdfExportButton";
import type { AdminSectionId } from "./AdminSectionRegistry";

type Props = {
  sectionId: AdminSectionId;
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

const SELECTOR_PAGE_SIZE = 30;
const clean = (value: unknown) => String(value ?? "").trim();
const orderId = (order: Order) => clean(order.id || order.tracking_number || order.invoice_number || order.coupon_number);
const reference = (order: Order) => clean(order.tracking_number || order.invoice_number || order.coupon_number || order.id) || "—";
const merchantName = (merchant: Merchant) => clean(merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id) || "—";

function statusLabel(value: unknown, isArabic: boolean) {
  const status = normalizeOrderStatus(value as string | Order | null | undefined);
  const labels: Record<string, [string, string]> = {
    pending: ["قيد الانتظار", "Pending"], review: ["قيد المراجعة", "Under review"], confirmed: ["تم التأكيد", "Confirmed"],
    assigned: ["تم تعيين مندوب", "Driver assigned"], picked_up: ["تم الاستلام", "Picked up"], in_transit: ["في الطريق", "In transit"],
    delivered: ["تم التسليم", "Delivered"], postponed: ["مؤجل", "Postponed"], returned: ["راجع", "Returned"], cancelled: ["ملغي", "Cancelled"],
  };
  return labels[status]?.[isArabic ? 0 : 1] || status.replaceAll("_", " ") || "—";
}

function reportTitle(sectionId: AdminSectionId, isArabic: boolean, selected: boolean) {
  return isArabic ? (selected ? "الطلبات المحددة" : "كل نتائج الطلبات") : (selected ? "Selected orders" : "All order results");
}

function makePayload(orders: Order[], isArabic: boolean, sectionId: AdminSectionId, selected: boolean): AdminPdfPayload {
  return {
    language: isArabic ? "ar" : "en",
    sectionTitle: reportTitle(sectionId, isArabic, selected),
    filters: isArabic ? `عدد الطلبات: ${orders.length}` : `Orders: ${orders.length}`,
    totals: {
      orders: orders.length,
      cod: formatAdminMoney(orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0), isArabic),
      delivery: formatAdminMoney(orders.reduce((sum, order) => sum + Number(order.delivery_price || order.delivery_fee || 0), 0), isArabic),
    },
    columns: [
      { key: "tracking", label: isArabic ? "التتبع" : "Tracking" },
      { key: "sender", label: isArabic ? "المرسل / التاجر" : "Sender / merchant" },
      { key: "customer", label: isArabic ? "المستلم" : "Recipient" },
      { key: "phone", label: isArabic ? "الهاتف" : "Phone" },
      { key: "route", label: isArabic ? "المسار" : "Route" },
      { key: "cod", label: "COD" },
      { key: "status", label: isArabic ? "الحالة" : "Status" },
    ],
    rows: orders.map((order) => ({
      tracking: reference(order),
      sender: clean(order.merchant_name || order.sender_name) || "—",
      customer: clean(order.receiver_name || order.customer_name) || "—",
      phone: clean(order.receiver_phone || order.customer_phone) || "—",
      route: localizedOrderRoute(order, isArabic ? "ar" : "en"),
      cod: formatAdminMoney(order.cod_amount, isArabic),
      status: statusLabel(order.status, isArabic),
    })),
  };
}

function escapeHtml(value: unknown) {
  return clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function printOrders(orders: Order[], isArabic: boolean, sectionId: AdminSectionId) {
  const popup = window.open("", "DAY_NIGHT_ORDER_PRINT", "width=1280,height=860");
  if (!popup) return;
  const rows = orders.map((order) => `<tr><td dir="ltr">${escapeHtml(reference(order))}</td><td>${escapeHtml(order.merchant_name || order.sender_name || "—")}</td><td>${escapeHtml(order.receiver_name || order.customer_name || "—")}</td><td dir="ltr">${escapeHtml(order.receiver_phone || order.customer_phone || "—")}</td><td>${escapeHtml(localizedOrderRoute(order, isArabic ? "ar" : "en"))}</td><td dir="${isArabic ? "rtl" : "ltr"}">${escapeHtml(formatAdminMoney(order.cod_amount, isArabic))}</td><td>${escapeHtml(statusLabel(order.status, isArabic))}</td></tr>`).join("");
  popup.document.write(`<!doctype html><html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}"><head><meta charset="utf-8"/><title>DAY NIGHT — ${reportTitle(sectionId, isArabic, false)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#07172c;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d4af37;padding-bottom:12px;margin-bottom:18px}h1{margin:0;font-size:24px}p{margin:5px 0 0;color:#4a5d73}strong{color:#0b3d70}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#07172c;color:#fff;padding:9px;border:1px solid #253e58}td{padding:8px;border:1px solid #ccd6e0;vertical-align:top}tbody tr:nth-child(even){background:#eef4f9}footer{margin-top:14px;font-size:10px;color:#60758b}</style></head><body><header><div><strong>DAY NIGHT DELIVERY SERVICES</strong><h1>${reportTitle(sectionId, isArabic, false)}</h1><p>${isArabic ? "بيانات تشغيل حقيقية من لوحة الإدارة" : "Live operational data from the admin portal"}</p></div><b>${orders.length}</b></header><table><thead><tr><th>${isArabic ? "التتبع" : "Tracking"}</th><th>${isArabic ? "المرسل / التاجر" : "Sender / merchant"}</th><th>${isArabic ? "المستلم" : "Recipient"}</th><th>${isArabic ? "الهاتف" : "Phone"}</th><th>${isArabic ? "المسار" : "Route"}</th><th>COD</th><th>${isArabic ? "الحالة" : "Status"}</th></tr></thead><tbody>${rows}</tbody></table><footer>www.daynightae.com · +971 56 875 7331 · ${new Date().toLocaleString(isArabic ? "ar-AE" : "en-AE")}</footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));</script></body></html>`);
  popup.document.close();
  popup.focus();
}

export default function AdminOrderBulkOperations({ sectionId, isArabic, orders, merchants, merchantId, query, selectedIds, onMerchantChange, onQueryChange, onSelectionChange }: Props) {
  const [selectorPage, setSelectorPage] = useState(0);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOrders = useMemo(() => orders.filter((order) => selected.has(orderId(order))), [orders, selected]);
  const allPayload = useMemo(() => makePayload(orders, isArabic, sectionId, false), [isArabic, orders, sectionId]);
  const selectedPayload = useMemo(
    () => selectedOrders.length ? makePayload(selectedOrders, isArabic, sectionId, true) : allPayload,
    [allPayload, isArabic, sectionId, selectedOrders],
  );
  const printRows = selectedOrders.length ? selectedOrders : orders;
  const selectorPageCount = Math.max(1, Math.ceil(orders.length / SELECTOR_PAGE_SIZE));
  const selectorSafePage = Math.min(selectorPage, selectorPageCount - 1);
  const selectorStart = selectorSafePage * SELECTOR_PAGE_SIZE;
  const selectorRows = orders.slice(selectorStart, selectorStart + SELECTOR_PAGE_SIZE);

  function toggle(order: Order) {
    const id = orderId(order);
    if (!id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange([...next]);
  }

  return (
    <section className="dn-admin-bulk-console" dir={isArabic ? "rtl" : "ltr"}>
      <div className="dn-admin-bulk-console-head">
        <div><h3><ListChecks className="h-5 w-5" />{isArabic ? "تحديد الطلبات والتصدير الجماعي" : "Order selection and bulk export"}</h3><p>{isArabic ? "حدّد أي عدد من الطلبات، أو صدّر كل النتائج مباشرة في ملف PDF بصري منظم." : "Select any number of orders, or export all current results directly as a structured visual PDF."}</p></div>
        <div className="dn-admin-bulk-summary"><strong>{orders.length}</strong><span>{isArabic ? "ظاهر" : "visible"}</span><strong>{selectedOrders.length}</strong><span>{isArabic ? "محدد" : "selected"}</span></div>
      </div>

      <div className="dn-admin-bulk-filter-grid">
        {<label><span><Store className="inline h-4 w-4" /> {isArabic ? "التاجر" : "Merchant"}</span><select value={merchantId} onChange={(event) => onMerchantChange(event.target.value)}><option value="">{isArabic ? "كل التجار والطلبات الشخصية" : "All merchants and personal orders"}</option>{merchants.map((merchant) => <option value={clean(merchant.id)} key={clean(merchant.id)}>{merchantName(merchant)}{merchant.merchant_code ? ` · ${merchant.merchant_code}` : ""}</option>)}</select></label>}
        <label><span><Search className="inline h-4 w-4" /> {isArabic ? "بحث داخل كل الطلبات" : "Search all orders"}</span><input data-admin-order-search="true" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={isArabic ? "تتبع، كوبون، اسم، هاتف، تاجر، مدينة، حالة..." : "Tracking, coupon, name, phone, merchant, city, status..."} /></label>
      </div>

      <div className="dn-admin-bulk-console-actions">
        <button type="button" className="is-primary" onClick={() => onSelectionChange(orders.map(orderId).filter(Boolean))} disabled={!orders.length}><CheckSquare2 className="h-4 w-4" />{isArabic ? "تحديد كل النتائج" : "Select all results"}</button>
        <button type="button" onClick={() => onSelectionChange([])} disabled={!selectedIds.length}><X className="h-4 w-4" />{isArabic ? "مسح التحديد" : "Clear selection"}</button>
        <button type="button" onClick={() => printOrders(printRows, isArabic, sectionId)} disabled={!printRows.length}><Printer className="h-4 w-4" />{selectedOrders.length ? (isArabic ? "طباعة المحدد" : "Print selected") : (isArabic ? "طباعة كل النتائج" : "Print all")}</button>
        <AdminPdfExportButton payload={selectedPayload} label={selectedOrders.length ? (isArabic ? "تصدير المحدد PDF" : "Export selected PDF") : (isArabic ? "تصدير النتائج PDF" : "Export results PDF")} />
        {selectedOrders.length > 0 && <AdminPdfExportButton payload={allPayload} label={isArabic ? "تصدير كل النتائج PDF" : "Export all results PDF"} />}
      </div>

      <details className="dn-admin-bulk-selector" open>
        <summary><FileDown className="inline h-4 w-4" /> {isArabic ? "اختيار الطلبات بالاسم ورقم التتبع" : "Choose orders by name and tracking"}</summary>
        <div className="dn-admin-bulk-selector-list">
          {selectorRows.map((order) => {
            const id = orderId(order);
            const checked = selected.has(id);
            return (
              <button type="button" className={`dn-admin-bulk-order-option ${checked ? "is-selected" : ""}`} key={id} onClick={() => toggle(order)} aria-pressed={checked}>
                {checked ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                <span><strong dir="ltr">{reference(order)}</strong><small>{clean(order.merchant_name || order.sender_name) || "—"} · {clean(order.receiver_name || order.customer_name) || "—"}</small></span>
                <em>{statusLabel(order.status, isArabic)}</em>
              </button>
            );
          })}
          {!orders.length && <p>{isArabic ? "لا توجد طلبات مطابقة للفلاتر الحالية." : "No orders match the current filters."}</p>}
        </div>
        {selectorPageCount > 1 && (
          <div className="dn-admin-order-pagination">
            <span>{isArabic ? "صفحة" : "Page"} {selectorSafePage + 1} / {selectorPageCount}</span>
            <div>
              <button type="button" disabled={selectorSafePage === 0} onClick={() => setSelectorPage((value) => Math.max(0, value - 1))}>{isArabic ? "السابق" : "Previous"}</button>
              <button type="button" disabled={selectorSafePage >= selectorPageCount - 1} onClick={() => setSelectorPage((value) => Math.min(selectorPageCount - 1, value + 1))}>{isArabic ? "التالي" : "Next"}</button>
            </div>
          </div>
        )}
      </details>
    </section>
  );
}
