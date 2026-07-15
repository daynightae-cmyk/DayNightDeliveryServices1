import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  MapPin,
  MessageCircle,
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
  onStatus: (status: string, note?: string) => void;
};

const actions: DriverStatusAction[] = [
  { value: "accepted", ar: "قبول وبدء المهمة", en: "Accept job" },
  { value: "picked_up", ar: "تم استلام الشحنة", en: "Picked up" },
  { value: "in_transit", ar: "في الطريق للتسليم", en: "In transit" },
  { value: "delivered", ar: "تأكيد التسليم", en: "Confirm delivery", requiresNote: true },
  { value: "cancelled", ar: "تعذر التسليم / مشكلة", en: "Delivery issue", requiresNote: true },
  { value: "returned", ar: "إرجاع للتاجر", en: "Return to merchant", requiresNote: true },
];

const progressStatuses = ["assigned", "accepted", "picked_up", "in_transit", "delivered"];
const cleanPhone = (value?: string) => String(value || "").replace(/[^+\d]/g, "");
const statusText = (status: string, isArabic: boolean) => {
  const normalized = String(status || "").toLowerCase();
  const labels: Record<string, [string, string]> = {
    assigned: ["مسند للمندوب", "Assigned"],
    accepted: ["تم القبول", "Accepted"],
    picked_up: ["تم الاستلام", "Picked up"],
    in_transit: ["في الطريق", "In transit"],
    delivered: ["تم التسليم", "Delivered"],
    cancelled: ["تعذر التسليم", "Issue"],
    returned: ["راجع", "Returned"],
    postponed: ["مؤجل", "Postponed"],
  };
  return labels[normalized]?.[isArabic ? 0 : 1] || status;
};

function nextActions(status: string) {
  const normalized = String(status || "assigned").toLowerCase();
  if (normalized === "assigned") return actions.filter((action) => action.value === "accepted" || action.value === "cancelled");
  if (normalized === "accepted") return actions.filter((action) => action.value === "picked_up" || action.value === "cancelled");
  if (normalized === "picked_up") return actions.filter((action) => action.value === "in_transit" || action.value === "returned");
  if (normalized === "in_transit") return actions.filter((action) => action.value === "delivered" || action.value === "cancelled" || action.value === "returned");
  return [];
}

export default function DriverOrderCard({ order, isArabic, busy, onStatus }: Props) {
  const [note, setNote] = useState("");
  const [selectedAction, setSelectedAction] = useState<DriverStatusAction | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = cleanPhone(order.receiver_phone || order.customer_phone);
  const pickupAddress = [order.sender_city, order.sender_address].filter(Boolean).join("، ");
  const deliveryAddress = [order.receiver_city, order.receiver_address].filter(Boolean).join("، ");
  const reference = order.tracking_number || order.tracking_code || order.invoice_number || order.id;
  const mapQuery = useMemo(() => {
    const lat = Number(order.receiver_lat ?? order.delivery_lat);
    const lng = Number(order.receiver_lng ?? order.delivery_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;
    return deliveryAddress;
  }, [deliveryAddress, order.delivery_lat, order.delivery_lng, order.receiver_lat, order.receiver_lng]);
  const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
  const availableActions = nextActions(order.status);
  const normalizedStatus = String(order.status || "assigned").toLowerCase();
  const activeStep = Math.max(0, progressStatuses.indexOf(normalizedStatus));
  const isClosed = ["delivered", "cancelled", "returned"].includes(normalizedStatus);

  function confirmAction() {
    if (!selectedAction) return;
    if (selectedAction.requiresNote && !note.trim()) return;
    onStatus(selectedAction.value, note.trim() || undefined);
    setSelectedAction(null);
    setNote("");
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
        <a href={phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!phone}><MessageCircle /> <span>WhatsApp</span></a>
        <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin /> <span>{isArabic ? "الملاحة" : "Navigate"}</span></a>
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
                else onStatus(action.value);
              }}
            >
              {action.value === "delivered" ? <CheckCircle2 /> : action.value === "cancelled" || action.value === "returned" ? <TriangleAlert /> : <Send />}
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
