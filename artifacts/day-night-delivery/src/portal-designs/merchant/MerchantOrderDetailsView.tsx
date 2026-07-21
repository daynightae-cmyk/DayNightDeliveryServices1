import { useState } from "react";
import { ArrowLeft, ArrowRight, Copy, FileDown, MapPin, MessageCircle, Phone, Printer, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import type { MerchantPortalCallbacks } from "./merchantCallbacks";
import { merchantDate, merchantMoney, merchantPhoneHref, merchantWhatsappHref } from "./merchantFormatters";
import type { MerchantOrderViewModel, MerchantTimelineEventViewModel } from "./merchantViewModels";
import { MerchantButton, MerchantCard, MerchantModal, MerchantSectionHeader, MerchantStatePanel, MerchantStatusBadge } from "./MerchantUi";

export interface MerchantOrderDetailsViewProps {
  order?: MerchantOrderViewModel | null;
  timeline: MerchantTimelineEventViewModel[];
  callbacks: MerchantPortalCallbacks;
  isArabic: boolean;
  readOnly?: boolean;
}

export function MerchantOrderDetailsView({ order, timeline, callbacks, isArabic, readOnly }: MerchantOrderDetailsViewProps) {
  const locale = isArabic ? "ar-AE" : "en-AE";
  const [action, setAction] = useState<"cancel" | "return" | "reschedule" | null>(null);
  const [reason, setReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!order) return <MerchantStatePanel type="empty" isArabic={isArabic} titleAr="اختر طلباً لعرض التفاصيل" titleEn="Select an order to view details" />;

  async function performAction() {
    if (!action || !order) return;
    setBusy(true);
    setMessage("");
    let result;
    if (action === "cancel" && callbacks.onCancelOrder) result = await callbacks.onCancelOrder(order.id, reason);
    if (action === "return" && callbacks.onRequestReturn) result = await callbacks.onRequestReturn(order.id, reason);
    if (action === "reschedule" && callbacks.onRequestReschedule) result = await callbacks.onRequestReschedule(order.id, rescheduleDate, reason);
    if (!result) {
      setMessage(isArabic ? "هذه العملية غير متاحة للحساب الحالي." : "This operation is unavailable for the current account.");
    } else if (result.success) {
      setMessage(isArabic ? "تم إرسال الطلب إلى النظام بنجاح." : "The request was submitted successfully.");
      setAction(null);
      await callbacks.onRefreshData();
    } else setMessage(result.error?.message || (isArabic ? "تعذر إكمال العملية." : "The operation could not be completed."));
    setBusy(false);
  }

  function copyTracking() {
    void navigator.clipboard?.writeText(order?.trackingNumber || "");
    setMessage(isArabic ? "تم نسخ رقم التتبع." : "Tracking number copied.");
  }

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  return (
    <div className="dn-merchant-stack">
      <MerchantSectionHeader
        eyebrowAr="ملف الطلب"
        eyebrowEn="ORDER FILE"
        titleAr="تفاصيل كاملة ومسار واضح"
        titleEn="Complete details and a clear timeline"
        descriptionAr="المستلم، الاستلام، الطرد، المالية، المندوب، والحالة الحالية."
        descriptionEn="Recipient, pickup, parcel, finance, courier, and current status."
        isArabic={isArabic}
        actions={<>
          <MerchantButton variant="ghost" onClick={() => callbacks.onNavigate("orders", undefined)}><BackIcon className="h-4 w-4" />{isArabic ? "الطلبات" : "Orders"}</MerchantButton>
          <MerchantButton variant="secondary" onClick={() => callbacks.onTrackOrder(order)}><MapPin className="h-4 w-4" />{isArabic ? "فتح الخريطة" : "Open map"}</MerchantButton>
        </>}
      />

      <MerchantCard className="dn-merchant-order-identity" tone="navy">
        <div><span>{isArabic ? "رقم التتبع" : "Tracking number"}</span><strong dir="ltr">{order.trackingNumber}</strong><button type="button" onClick={copyTracking}><Copy className="h-4 w-4" /></button></div>
        <div><MerchantStatusBadge status={order.status} isArabic={isArabic} /><small>{merchantDate(order.updatedAt || order.createdAt, isArabic)}</small></div>
        <dl>
          <div><dt>{isArabic ? "الفاتورة" : "Invoice"}</dt><dd dir="ltr">{order.invoiceNumber || "—"}</dd></div>
          <div><dt>{isArabic ? "الكوبون/المرجع" : "Coupon / reference"}</dt><dd dir="ltr">{order.couponNumber || order.merchantReference || "—"}</dd></div>
          <div><dt>{isArabic ? "الخدمة" : "Service"}</dt><dd>{order.serviceType || "—"}</dd></div>
          <div><dt>{isArabic ? "الفرع" : "Branch"}</dt><dd>{order.pickupBranch || "—"}</dd></div>
        </dl>
      </MerchantCard>

      <div className="dn-merchant-detail-grid">
        <MerchantCard>
          <header className="dn-merchant-card-header"><div><span>{isArabic ? "المستلم" : "RECIPIENT"}</span><h3>{order.recipientName}</h3></div></header>
          <dl className="dn-merchant-detail-list">
            <div><dt>{isArabic ? "الهاتف" : "Phone"}</dt><dd dir="ltr">{order.recipientPhone || "—"}</dd></div>
            <div><dt>{isArabic ? "الهاتف البديل" : "Alternate phone"}</dt><dd dir="ltr">{order.recipientAlternatePhone || "—"}</dd></div>
            <div><dt>{isArabic ? "الموقع" : "Location"}</dt><dd>{[order.deliveryEmirate, order.deliveryCity, order.deliveryArea].filter(Boolean).join(" · ") || "—"}</dd></div>
            <div><dt>{isArabic ? "العنوان" : "Address"}</dt><dd>{order.deliveryAddress || "—"}</dd></div>
            <div><dt>{isArabic ? "علامة مميزة" : "Landmark"}</dt><dd>{order.deliveryLandmark || "—"}</dd></div>
          </dl>
          <footer className="dn-merchant-inline-actions">
            {order.recipientPhone ? <a className="dn-merchant-button is-secondary" href={merchantPhoneHref(order.recipientPhone)}><Phone className="h-4 w-4" />{isArabic ? "اتصال" : "Call"}</a> : null}
            {order.recipientPhone ? <a className="dn-merchant-button is-ghost" href={merchantWhatsappHref(order.recipientPhone)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a> : null}
          </footer>
        </MerchantCard>

        <MerchantCard>
          <header className="dn-merchant-card-header"><div><span>{isArabic ? "الاستلام" : "PICKUP"}</span><h3>{order.pickupBranch || order.senderName || "DAY NIGHT"}</h3></div></header>
          <dl className="dn-merchant-detail-list">
            <div><dt>{isArabic ? "جهة الاتصال" : "Contact"}</dt><dd>{order.senderName || "—"}</dd></div>
            <div><dt>{isArabic ? "الهاتف" : "Phone"}</dt><dd dir="ltr">{order.senderPhone || "—"}</dd></div>
            <div><dt>{isArabic ? "العنوان" : "Address"}</dt><dd>{order.pickupAddress || "—"}</dd></div>
            <div><dt>{isArabic ? "المندوب" : "Courier"}</dt><dd>{order.driverName || (isArabic ? "لم يتم التعيين" : "Not assigned")}</dd></div>
            <div><dt>{isArabic ? "هاتف المندوب" : "Courier phone"}</dt><dd dir="ltr">{order.driverPhone || "—"}</dd></div>
          </dl>
        </MerchantCard>

        <MerchantCard>
          <header className="dn-merchant-card-header"><div><span>{isArabic ? "الطرد" : "PACKAGE"}</span><h3>{order.packageType || (isArabic ? "شحنة" : "Shipment")}</h3></div></header>
          <dl className="dn-merchant-detail-list">
            <div><dt>{isArabic ? "الوصف" : "Description"}</dt><dd>{order.packageDescription || "—"}</dd></div>
            <div><dt>{isArabic ? "القطع" : "Pieces"}</dt><dd>{order.pieces ?? "—"}</dd></div>
            <div><dt>{isArabic ? "الوزن" : "Weight"}</dt><dd>{order.weight ? `${order.weight} kg` : "—"}</dd></div>
            <div><dt>{isArabic ? "قابل للكسر" : "Fragile"}</dt><dd>{order.fragile ? (isArabic ? "نعم" : "Yes") : (isArabic ? "لا" : "No")}</dd></div>
            <div><dt>{isArabic ? "ملاحظات" : "Notes"}</dt><dd>{order.notes || "—"}</dd></div>
          </dl>
        </MerchantCard>

        <MerchantCard tone="gold">
          <header className="dn-merchant-card-header"><div><span>{isArabic ? "المالية" : "FINANCE"}</span><h3>{isArabic ? "تفاصيل الدفع والتحصيل" : "Payment and collection"}</h3></div></header>
          <dl className="dn-merchant-detail-list">
            <div><dt>{isArabic ? "طريقة الدفع" : "Payment"}</dt><dd>{order.paymentMethod || "—"}</dd></div>
            <div><dt>{isArabic ? "قيمة البضاعة" : "Goods value"}</dt><dd>{merchantMoney(order.goodsValue, "AED", locale)}</dd></div>
            <div><dt>COD</dt><dd>{merchantMoney(order.codAmount, "AED", locale)}</dd></div>
            <div><dt>{isArabic ? "تم التحصيل" : "Collected"}</dt><dd>{merchantMoney(order.collectedAmount, "AED", locale)}</dd></div>
            <div><dt>{isArabic ? "رسوم التوصيل" : "Delivery fee"}</dt><dd>{merchantMoney(order.deliveryFee, "AED", locale)}</dd></div>
            <div><dt>{isArabic ? "مستحق التاجر" : "Merchant due"}</dt><dd>{merchantMoney(order.merchantDue, "AED", locale)}</dd></div>
          </dl>
        </MerchantCard>
      </div>

      <MerchantCard>
        <header className="dn-merchant-card-header"><div><span>{isArabic ? "التسلسل التشغيلي" : "OPERATION TIMELINE"}</span><h3>{isArabic ? "تاريخ الحالة والتحديثات" : "Status and update history"}</h3></div><RefreshCw className="h-5 w-5" /></header>
        {timeline.length ? <ol className="dn-merchant-timeline">{timeline.map((event, index) => <li key={event.id} className={index === timeline.length - 1 ? "is-current" : ""}><i /><div><strong>{isArabic ? event.labelAr : event.labelEn}</strong><span>{event.note || ""}</span><small>{merchantDate(event.timestamp, isArabic)}</small></div></li>)}</ol> : <MerchantStatePanel type="empty" isArabic={isArabic} titleAr="لا يوجد سجل حالة متاح" titleEn="No status history is available" />}
      </MerchantCard>

      <MerchantCard className="dn-merchant-order-action-center">
        <header className="dn-merchant-card-header"><div><span>{isArabic ? "إجراءات الطلب" : "ORDER ACTIONS"}</span><h3>{isArabic ? "الإجراءات المتاحة حسب الحالة" : "Actions allowed for the current status"}</h3></div></header>
        <div>
          {callbacks.onPrintLabels ? <MerchantButton variant="secondary" onClick={() => void callbacks.onPrintLabels?.([order.id])}><Printer className="h-4 w-4" />{isArabic ? "طباعة الملصق" : "Print label"}</MerchantButton> : null}
          {callbacks.onDownloadInvoice && order.invoiceNumber ? <MerchantButton variant="secondary" onClick={() => void callbacks.onDownloadInvoice?.(order.invoiceNumber || "")}><FileDown className="h-4 w-4" />{isArabic ? "تحميل الفاتورة" : "Download invoice"}</MerchantButton> : null}
          <MerchantButton variant="ghost" onClick={() => callbacks.onNavigate("new_order", undefined)}>{isArabic ? "تكرار كطلب جديد" : "Duplicate as new"}</MerchantButton>
          <MerchantButton variant="ghost" onClick={() => callbacks.onNavigate("support", { orderId: order.id })}>{isArabic ? "طلب دعم" : "Request support"}</MerchantButton>
          {callbacks.onRequestReschedule ? <MerchantButton variant="secondary" disabled={readOnly} onClick={() => setAction("reschedule")}><RefreshCw className="h-4 w-4" />{isArabic ? "إعادة جدولة" : "Reschedule"}</MerchantButton> : null}
          {callbacks.onRequestReturn ? <MerchantButton variant="secondary" disabled={readOnly} onClick={() => setAction("return")}><RotateCcw className="h-4 w-4" />{isArabic ? "طلب إرجاع" : "Request return"}</MerchantButton> : null}
          {callbacks.onCancelOrder ? <MerchantButton variant="danger" disabled={readOnly} onClick={() => setAction("cancel")}><XCircle className="h-4 w-4" />{isArabic ? "إلغاء الطلب" : "Cancel order"}</MerchantButton> : null}
        </div>
        {message ? <p className="dn-merchant-action-message">{message}</p> : null}
      </MerchantCard>

      <MerchantModal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action === "cancel" ? (isArabic ? "إلغاء الطلب" : "Cancel order") : action === "return" ? (isArabic ? "طلب إرجاع" : "Request return") : (isArabic ? "إعادة جدولة" : "Reschedule")}
        footer={<><MerchantButton variant="ghost" onClick={() => setAction(null)}>{isArabic ? "إغلاق" : "Close"}</MerchantButton><MerchantButton variant={action === "cancel" ? "danger" : "primary"} disabled={busy || !reason.trim() || (action === "reschedule" && !rescheduleDate)} onClick={() => void performAction()}>{busy ? (isArabic ? "جاري الإرسال..." : "Submitting...") : (isArabic ? "تأكيد" : "Confirm")}</MerchantButton></>}
      >
        {action === "reschedule" ? <label className="dn-merchant-field"><span>{isArabic ? "الموعد الجديد" : "New date"}</span><input type="datetime-local" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} /></label> : null}
        <label className="dn-merchant-field"><span>{isArabic ? "السبب" : "Reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} /></label>
      </MerchantModal>
    </div>
  );
}
