import { useMemo, useState } from "react";
import { Download, Filter, MapPin, PackagePlus, Printer, Search, SlidersHorizontal, X } from "lucide-react";
import type { MerchantPortalCallbacks } from "./merchantCallbacks";
import { merchantDate, merchantMoney } from "./merchantFormatters";
import { normalizeMerchantStatus } from "./merchantStatusMapping";
import type { MerchantOrderViewModel } from "./merchantViewModels";
import { MerchantButton, MerchantCard, MerchantSectionHeader, MerchantStatePanel, MerchantStatusBadge } from "./MerchantUi";

export interface MerchantOrdersViewProps {
  orders: MerchantOrderViewModel[];
  callbacks: MerchantPortalCallbacks;
  isArabic: boolean;
  initialStatus?: string;
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
}

const statusTabs = ["all", "active", "pickup", "in_transit", "delivered", "under_review", "failed", "postponed", "returned", "cancelled"] as const;

function matchesStatus(order: MerchantOrderViewModel, selected: string): boolean {
  const status = normalizeMerchantStatus(order.status);
  if (selected === "all") return true;
  if (selected === "active") return ["pending", "confirmed", "pickup_requested", "assigned", "accepted", "heading_to_pickup", "arrived_at_pickup", "picked_up", "at_hub", "in_transit", "out_for_delivery", "arrived_at_customer"].includes(status);
  if (selected === "pickup") return ["pickup_requested", "assigned", "accepted", "heading_to_pickup", "arrived_at_pickup", "picked_up"].includes(status);
  if (selected === "in_transit") return ["at_hub", "in_transit", "out_for_delivery", "arrived_at_customer"].includes(status);
  if (selected === "under_review") return ["under_review", "review"].includes(status);
  if (selected === "failed") return ["failed", "delivery_failed"].includes(status);
  return status === selected;
}

const tabLabel: Record<(typeof statusTabs)[number], { ar: string; en: string }> = {
  all: { ar: "الكل", en: "All" },
  active: { ar: "نشط", en: "Active" },
  pickup: { ar: "الاستلام", en: "Pickup" },
  in_transit: { ar: "في الطريق", en: "In transit" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  under_review: { ar: "مراجعة", en: "Review" },
  failed: { ar: "متعثر", en: "Failed" },
  postponed: { ar: "مؤجل", en: "Postponed" },
  returned: { ar: "مرتجع", en: "Returned" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

export function MerchantOrdersView({ orders, callbacks, isArabic, initialStatus = "all", loading, error, readOnly }: MerchantOrdersViewProps) {
  const locale = isArabic ? "ar-AE" : "en-AE";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [branch, setBranch] = useState("all");
  const [city, setCity] = useState("all");
  const [codOnly, setCodOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const branches = useMemo(() => Array.from(new Set(orders.map((order) => order.pickupBranch).filter(Boolean) as string[])), [orders]);
  const cities = useMemo(() => Array.from(new Set(orders.map((order) => order.deliveryCity).filter(Boolean) as string[])), [orders]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesStatus(order, status)) return false;
      if (branch !== "all" && order.pickupBranch !== branch) return false;
      if (city !== "all" && order.deliveryCity !== city) return false;
      if (codOnly && Number(order.codAmount || 0) <= 0) return false;
      if (!normalizedQuery) return true;
      return [
        order.trackingNumber,
        order.invoiceNumber,
        order.couponNumber,
        order.merchantReference,
        order.recipientName,
        order.recipientPhone,
        order.deliveryCity,
        order.deliveryAddress,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [branch, city, codOnly, orders, query, status]);

  function toggleOrder(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function printSelected() {
    if (!callbacks.onPrintLabels || selectedIds.length === 0) return;
    setBusyAction("print");
    setActionMessage("");
    const result = await callbacks.onPrintLabels(selectedIds);
    setActionMessage(result.success ? (isArabic ? `تم تجهيز ${result.printedCount || selectedIds.length} ملصقاً للطباعة.` : `${result.printedCount || selectedIds.length} labels are ready to print.`) : result.error?.message || (isArabic ? "تعذر تجهيز الملصقات." : "Labels could not be prepared."));
    setBusyAction("");
  }

  function exportVisible() {
    const rows = filtered.map((order) => [order.trackingNumber, order.invoiceNumber || "", order.recipientName, order.recipientPhone || "", order.deliveryCity || "", order.status, order.codAmount ?? "", order.createdAt || ""]);
    const csv = [["Tracking", "Invoice", "Recipient", "Phone", "City", "Status", "COD", "Created"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `day-night-merchant-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <MerchantStatePanel type="loading" isArabic={isArabic} />;
  if (error) return <MerchantStatePanel type="error" isArabic={isArabic} descriptionAr={error} descriptionEn={error} onRetry={() => void callbacks.onRefreshData()} />;

  return (
    <div className="dn-merchant-stack">
      <MerchantSectionHeader
        eyebrowAr="مساحة الطلبات"
        eyebrowEn="ORDER WORKSPACE"
        titleAr="كل الطلبات والحالات من مكان واحد"
        titleEn="Every order and status in one workspace"
        descriptionAr="ابحث وفلتر وافتح التفاصيل أو التتبع دون مغادرة بوابة التاجر."
        descriptionEn="Search, filter, inspect, and track without leaving the merchant portal."
        isArabic={isArabic}
        actions={<>
          <MerchantButton variant="secondary" onClick={exportVisible}><Download className="h-4 w-4" />{isArabic ? "تصدير الظاهر" : "Export visible"}</MerchantButton>
          <MerchantButton onClick={() => callbacks.onNavigate("new_order", undefined)} disabled={readOnly}><PackagePlus className="h-4 w-4" />{isArabic ? "طلب جديد" : "New order"}</MerchantButton>
        </>}
      />

      <MerchantCard className="dn-merchant-orders-toolbar">
        <div className="dn-merchant-search-box"><Search className="h-5 w-5" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "رقم التتبع، الفاتورة، الكوبون، المستلم أو الهاتف" : "Tracking, invoice, coupon, recipient, or phone"} /><button type="button" onClick={() => setQuery("")} aria-label={isArabic ? "مسح البحث" : "Clear search"}>{query ? <X className="h-4 w-4" /> : null}</button></div>
        <MerchantButton variant={filtersOpen ? "primary" : "secondary"} onClick={() => setFiltersOpen((current) => !current)}><SlidersHorizontal className="h-4 w-4" />{isArabic ? "الفلاتر" : "Filters"}</MerchantButton>
        <span className="dn-merchant-result-count">{filtered.length} / {orders.length}</span>
      </MerchantCard>

      {filtersOpen ? (
        <MerchantCard className="dn-merchant-filter-panel">
          <label><span>{isArabic ? "الفرع" : "Branch"}</span><select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="all">{isArabic ? "كل الفروع" : "All branches"}</option>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>{isArabic ? "مدينة التسليم" : "Delivery city"}</span><select value={city} onChange={(event) => setCity(event.target.value)}><option value="all">{isArabic ? "كل المدن" : "All cities"}</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="dn-merchant-checkbox"><input type="checkbox" checked={codOnly} onChange={(event) => setCodOnly(event.target.checked)} /><span>{isArabic ? "COD فقط" : "COD only"}</span></label>
          <MerchantButton variant="ghost" onClick={() => { setBranch("all"); setCity("all"); setCodOnly(false); }}><Filter className="h-4 w-4" />{isArabic ? "إعادة ضبط" : "Reset"}</MerchantButton>
        </MerchantCard>
      ) : null}

      <div className="dn-merchant-order-tabs" role="tablist">
        {statusTabs.map((item) => <button key={item} type="button" className={status === item ? "is-active" : ""} onClick={() => setStatus(item)}>{isArabic ? tabLabel[item].ar : tabLabel[item].en}<b>{orders.filter((order) => matchesStatus(order, item)).length}</b></button>)}
      </div>

      {selectedIds.length > 0 ? (
        <div className="dn-merchant-bulk-bar">
          <strong>{isArabic ? `${selectedIds.length} طلب محدد` : `${selectedIds.length} selected`}</strong>
          {callbacks.onPrintLabels ? <MerchantButton variant="secondary" disabled={busyAction === "print"} onClick={() => void printSelected()}><Printer className="h-4 w-4" />{isArabic ? "طباعة الملصقات" : "Print labels"}</MerchantButton> : null}
          <MerchantButton variant="ghost" onClick={() => setSelectedIds([])}>{isArabic ? "إلغاء التحديد" : "Clear"}</MerchantButton>
        </div>
      ) : null}
      {actionMessage ? <p className="dn-merchant-action-message">{actionMessage}</p> : null}

      {orders.length === 0 ? <MerchantStatePanel type="empty" isArabic={isArabic} /> : filtered.length === 0 ? <MerchantStatePanel type="filtered" isArabic={isArabic} /> : (
        <>
          <div className="dn-merchant-orders-mobile">
            {filtered.map((order) => (
              <article key={order.id} className="dn-merchant-order-card">
                <header><label><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleOrder(order.id)} /><span className="sr-only">Select</span></label><MerchantStatusBadge status={order.status} isArabic={isArabic} /><strong dir="ltr">{order.trackingNumber}</strong></header>
                <div><h3>{order.recipientName}</h3><p>{order.deliveryCity || "—"} · <span dir="ltr">{order.recipientPhone || "—"}</span></p></div>
                <dl><div><dt>COD</dt><dd>{merchantMoney(order.codAmount, "AED", locale)}</dd></div><div><dt>{isArabic ? "الرسوم" : "Fee"}</dt><dd>{merchantMoney(order.deliveryFee, "AED", locale)}</dd></div><div><dt>{isArabic ? "التاريخ" : "Date"}</dt><dd>{merchantDate(order.createdAt, isArabic, false)}</dd></div></dl>
                <footer><MerchantButton variant="secondary" onClick={() => callbacks.onOpenOrder(order.id)}>{isArabic ? "التفاصيل" : "Details"}</MerchantButton><MerchantButton variant="ghost" onClick={() => callbacks.onTrackOrder(order)}><MapPin className="h-4 w-4" />{isArabic ? "تتبع" : "Track"}</MerchantButton></footer>
              </article>
            ))}
          </div>

          <div className="dn-merchant-orders-table-wrap">
            <table className="dn-merchant-orders-table">
              <thead><tr><th><input type="checkbox" checked={filtered.length > 0 && filtered.every((order) => selectedIds.includes(order.id))} onChange={(event) => setSelectedIds(event.target.checked ? filtered.map((order) => order.id) : [])} /></th><th>{isArabic ? "التتبع" : "Tracking"}</th><th>{isArabic ? "المستلم" : "Recipient"}</th><th>{isArabic ? "الموقع" : "Location"}</th><th>{isArabic ? "الخدمة" : "Service"}</th><th>{isArabic ? "الحالة" : "Status"}</th><th>COD</th><th>{isArabic ? "الرسوم" : "Fee"}</th><th>{isArabic ? "آخر تحديث" : "Updated"}</th><th>{isArabic ? "الإجراء" : "Action"}</th></tr></thead>
              <tbody>{filtered.map((order) => <tr key={order.id} onDoubleClick={() => callbacks.onOpenOrder(order.id)}><td><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleOrder(order.id)} /></td><td><button type="button" className="dn-merchant-link" dir="ltr" onClick={() => callbacks.onOpenOrder(order.id)}>{order.trackingNumber}</button><small dir="ltr">{order.invoiceNumber || order.couponNumber || order.merchantReference || "—"}</small></td><td><strong>{order.recipientName}</strong><small dir="ltr">{order.recipientPhone || "—"}</small></td><td><span>{order.deliveryCity || "—"}</span><small>{order.deliveryAddress || "—"}</small></td><td>{order.serviceType || "—"}</td><td><MerchantStatusBadge status={order.status} isArabic={isArabic} /></td><td>{merchantMoney(order.codAmount, "AED", locale)}</td><td>{merchantMoney(order.deliveryFee, "AED", locale)}</td><td>{merchantDate(order.updatedAt || order.createdAt, isArabic)}</td><td><div className="dn-merchant-table-actions"><button type="button" onClick={() => callbacks.onOpenOrder(order.id)}>{isArabic ? "فتح" : "Open"}</button><button type="button" onClick={() => callbacks.onTrackOrder(order)}><MapPin className="h-4 w-4" /></button></div></td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
