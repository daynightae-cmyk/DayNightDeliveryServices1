import { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Navigation,
  PackageCheck,
  Phone,
  Route,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { DriverOrder, DriverStatusAction } from "../../types/driver";

type Props = {
  order: DriverOrder;
  isArabic: boolean;
  busy: boolean;
  navigationActive?: boolean;
  onStatus: (status: string, note?: string) => Promise<boolean>;
  onNavigate?: (acceptIfAssigned?: boolean) => void;
  onChat?: () => void;
};

const actions: DriverStatusAction[] = [
  { value: "confirmed", ar: "بدء تنفيذ المهمة", en: "Start job" },
  { value: "picked_up", ar: "تم استلام الشحنة", en: "Picked up" },
  { value: "in_transit", ar: "في الطريق للتسليم", en: "In transit" },
  { value: "delivered", ar: "تأكيد التسليم", en: "Confirm delivery", requiresNote: true },
  { value: "cancelled", ar: "تعذر التسليم / إلغاء", en: "Delivery issue / cancel", requiresNote: true },
  { value: "returned", ar: "إرجاع للتاجر", en: "Return to merchant", requiresNote: true },
];

const progressStatuses = ["assigned", "confirmed", "picked_up", "in_transit", "delivered"];
const cleanPhone = (value?: string) => String(value || "").replace(/[^+\d]/g, "");
const whatsAppPhone = (value?: string) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return digits;
};
const statusText = (status: string, isArabic: boolean) => {
  const normalized = String(status || "").toLowerCase();
  const labels: Record<string, [string, string]> = {
    assigned: ["مسند للمندوب", "Assigned"],
    confirmed: ["تم تأكيد المهمة", "Confirmed"],
    accepted: ["بدأ التنفيذ", "Started"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    out_for_delivery: ["خرج للتسليم", "Out for delivery"],
    delivered: ["تم التسليم", "Delivered"],
    cancelled: ["ملغي / متعذر", "Cancelled / issue"],
    returned: ["راجع", "Returned"],
    postponed: ["مؤجل", "Postponed"],
  };
  return labels[normalized]?.[isArabic ? 0 : 1] || status;
};

function nextActions(status: string) {
  const normalized = String(status || "assigned").toLowerCase();
  if (normalized === "assigned") return actions.filter((action) => action.value === "confirmed" || action.value === "cancelled");
  if (normalized === "confirmed" || normalized === "accepted") return actions.filter((action) => action.value === "picked_up" || action.value === "cancelled");
  if (normalized === "picked_up") return actions.filter((action) => action.value === "in_transit" || action.value === "returned");
  if (normalized === "in_transit" || normalized === "out_for_delivery") return actions.filter((action) => action.value === "delivered" || action.value === "cancelled" || action.value === "returned");
  return [];
}

export default function DriverOrderCard({ order, isArabic, busy, navigationActive = false, onStatus, onNavigate, onChat }: Props) {
  const [note, setNote] = useState("");
  const [selectedAction, setSelectedAction] = useState<DriverStatusAction | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = cleanPhone(order.receiver_phone || order.customer_phone);
  const whatsappPhone = whatsAppPhone(order.receiver_phone || order.customer_phone);
  const pickupAddress = [order.sender_city, order.sender_address].filter(Boolean).join("، ");
  const deliveryAddress = [order.receiver_city, order.receiver_address].filter(Boolean).join("، ");
  const reference = order.tracking_number || order.tracking_code || order.invoice_number || order.id;
  const availableActions = nextActions(order.status);
  const rawStatus = String(order.status || "assigned").toLowerCase();
  const normalizedStatus = rawStatus === "accepted" ? "confirmed" : rawStatus;
  const activeStep = Math.max(0, progressStatuses.indexOf(normalizedStatus));
  const isClosed = ["delivered", "cancelled", "returned"].includes(normalizedStatus);
  const whatsappMessage = isArabic
    ? [
        `السلام عليكم ${order.receiver_name || order.customer_name || "عميلنا الكريم"}،`,
        "معكم مندوب DAY NIGHT لخدمات التوصيل والشحن.",
        `لديكم طلبية رقم ${reference}.`,
        `حالة الطلبية: ${statusText(order.status, true)}.`,
        deliveryAddress ? `عنوان التسليم المسجل: ${deliveryAddress}.` : "",
        Number(order.cod_amount || 0) > 0 ? `المبلغ المطلوب عند الاستلام: ${Number(order.cod_amount).toFixed(2)} درهم.` : "",
        "نرجو تأكيد تواجدكم ومشاركة موقعكم عند الحاجة، وشكراً لتعاونكم.",
      ].filter(Boolean).join("\n")
    : [
        `Hello ${order.receiver_name || order.customer_name || "valued customer"},`,
        "This is your DAY NIGHT delivery driver.",
        `Your order reference is ${reference}.`,
        `Current status: ${statusText(order.status, false)}.`,
        deliveryAddress ? `Registered delivery address: ${deliveryAddress}.` : "",
        Number(order.cod_amount || 0) > 0 ? `Amount due on delivery: ${Number(order.cod_amount).toFixed(2)} AED.` : "",
        "Please confirm your availability and share your location if needed. Thank you.",
      ].filter(Boolean).join("\n");

  async function runAction(action: DriverStatusAction, actionNote?: string) {
    const succeeded = await onStatus(action.value, actionNote);
    if (succeeded && action.value === "confirmed") onNavigate?.(false);
    return succeeded;
  }

  async function confirmAction() {
    if (!selectedAction) return;
    if (selectedAction.requiresNote && !note.trim()) return;
    const succeeded = await runAction(selectedAction, note.trim() || undefined);
    if (succeeded) {
      setSelectedAction(null);
      setNote("");
    }
  }

  async function copyReference() {
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className={`dn-driver-order-card dn-driver-order-card-v2 ${isClosed ? "is-closed" : ""}`}>
      <header className="dn-driver-order-header">
        <div>
          <button type="button" className="dn-driver-order-reference" onClick={() => void copyReference()}>
            <small>{reference}</small><ClipboardCopy />
          </button>
          {copied && <em className="dn-driver-copy-confirm">{isArabic ? "تم النسخ" : "Copied"}</em>}
          <h3>{order.receiver_name || order.customer_name || (isArabic ? "عميل بدون اسم" : "Unnamed customer")}</h3>
          <p>{order.sender_city || "—"} <Route /> {order.receiver_city || "—"}</p>
        </div>
        <div className="dn-driver-order-badges">
          {order.priority && <span className={`dn-driver-priority is-${String(order.priority).toLowerCase()}`}>{order.priority}</span>}
          <span className={`dn-driver-status dn-driver-status-${normalizedStatus}`}>{statusText(order.status, isArabic)}</span>
        </div>
      </header>

      {!isClosed && (
        <div className="dn-driver-order-progress" aria-label="Order progress">
          {progressStatuses.map((status, index) => (
            <span key={status} className={index <= activeStep ? "is-complete" : ""}>
              <i>{index < activeStep ? <CheckCircle2 /> : index + 1}</i>
              <small>{statusText(status, isArabic)}</small>
            </span>
          ))}
        </div>
      )}

      <div className="dn-driver-order-route">
        <div>
          <span><PackageCheck /></span>
          <section><small>{isArabic ? "الاستلام" : "Pickup"}</small><strong>{pickupAddress || "—"}</strong></section>
        </div>
        <div>
          <span><MapPin /></span>
          <section><small>{isArabic ? "التسليم" : "Drop-off"}</small><strong>{deliveryAddress || "—"}</strong></section>
        </div>
      </div>

      <div className="dn-driver-order-meta dn-driver-order-meta-v2">
        <span><Banknote /> COD: {Number(order.cod_amount || 0).toFixed(2)} AED</span>
        <span><Clock3 /> {new Date(order.created_at).toLocaleString(isArabic ? "ar-AE" : "en-AE")}</span>
        <span><PackageCheck /> {order.pieces || 1} {isArabic ? "قطعة" : "pcs"} · {Number(order.weight || 0).toFixed(1)}kg</span>
        <span><ShieldCheck /> {order.service_type || "standard"} · {order.payment_method || "—"}</span>
      </div>

      {(order.notes || order.package_description) && (
        <div className="dn-driver-order-notes">
          <strong>{isArabic ? "تعليمات الطلب" : "Order instructions"}</strong>
          <p>{order.notes || order.package_description}</p>
        </div>
      )}

      <div className="dn-driver-contact-grid">
        <a href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone}><Phone /> <span>{isArabic ? "اتصال" : "Call"}</span></a>
        <a href={whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!whatsappPhone}><MessageCircle /> <span>{isArabic ? "رسالة واتساب" : "WhatsApp message"}</span></a>
        <button type="button" onClick={onChat} disabled={!onChat}><MessagesSquare /><span>{isArabic ? "محادثة العميل" : "Customer chat"}</span></button>
        <button type="button" className={navigationActive ? "is-navigation-active" : ""} onClick={() => onNavigate?.(true)} disabled={!onNavigate || navigationActive}>
          <Navigation />
          <span>{navigationActive ? (isArabic ? "الملاحة تعمل" : "Navigation active") : (isArabic ? "الملاحة داخل التطبيق" : "In-app navigation")}</span>
        </button>
      </div>

      {availableActions.length > 0 && (
        <div className="dn-driver-action-grid">
          {availableActions.map((action) => (
            <button
              type="button"
              key={action.value}
              disabled={busy}
              className={action.value === "cancelled" || action.value === "returned" ? "is-danger" : ""}
              onClick={() => {
                if (action.requiresNote) setSelectedAction(action);
                else void runAction(action);
              }}
            >
              {action.value === "delivered" || action.value === "confirmed" ? <CheckCircle2 /> : action.value === "cancelled" || action.value === "returned" ? <TriangleAlert /> : <Send />}
              {isArabic ? action.ar : action.en}
            </button>
          ))}
        </div>
      )}

      {selectedAction && (
        <div className="dn-driver-action-note">
          <label>
            {isArabic ? "اكتب ملاحظة واضحة قبل التأكيد" : "Add a clear note before confirming"}
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} autoFocus />
          </label>
          <div>
            <button type="button" onClick={() => setSelectedAction(null)}>{isArabic ? "إلغاء" : "Cancel"}</button>
            <button type="button" disabled={!note.trim() || busy} onClick={confirmAction}>{isArabic ? "تأكيد" : "Confirm"}</button>
          </div>
        </div>
      )}
    </article>
  );
}
