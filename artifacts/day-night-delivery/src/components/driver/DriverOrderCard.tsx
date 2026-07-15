import { MapPin, Phone, MessageCircle } from "lucide-react";
import type { Order } from "../../types";

type Props = {
  order: Order;
  isArabic: boolean;
  busy: boolean;
  onStatus: (status: string, note?: string) => void;
};

const statuses = [
  { v: "accepted", ar: "بدء المهمة", en: "Start" },
  { v: "picked_up", ar: "تم الاستلام", en: "Picked up" },
  { v: "in_transit", ar: "في الطريق", en: "In transit" },
  { v: "delivered", ar: "تم التسليم", en: "Delivered" },
  { v: "cancelled", ar: "فشل/مشكلة", en: "Failed / issue" },
];

const cleanPhone = (value?: string) => String(value || "").replace(/[^+\d]/g, "");

export default function DriverOrderCard({ order, isArabic, busy, onStatus }: Props) {
  const phone = cleanPhone(order.receiver_phone || order.customer_phone);
  const address = [order.receiver_city, order.receiver_address].filter(Boolean).join(" ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-black text-brand-gold">
            {order.tracking_number || order.tracking_code || order.invoice_number || order.id}
          </p>
          <h3 className="mt-1 text-lg font-black text-white">{order.receiver_name || order.customer_name || "—"}</h3>
          <p className="text-xs text-white/60">
            {order.sender_city} → {order.receiver_city}
          </p>
        </div>
        <span className="rounded-full bg-brand-blue/20 px-3 py-1 text-xs font-black text-sky-100">
          {order.status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-white/75">
        <p>
          <b>{isArabic ? "الاستلام:" : "Pickup:"}</b> {order.sender_address || order.sender_city || "—"}
        </p>
        <p>
          <b>{isArabic ? "التسليم:" : "Dropoff:"}</b> {order.receiver_address || order.receiver_city || "—"}
        </p>
        <p>
          <b>COD:</b> {Number(order.cod_amount || 0).toFixed(2)} AED
        </p>
        {order.notes && (
          <p>
            <b>{isArabic ? "ملاحظات:" : "Notes:"}</b> {order.notes}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <a className="rounded-xl bg-white/10 p-3 text-center text-xs font-black text-white" href={`tel:${phone}`}>
          <Phone className="mx-auto mb-1 h-4 w-4" />
          {isArabic ? "اتصال" : "Call"}
        </a>
        <a
          className="rounded-xl bg-[#25D366]/20 p-3 text-center text-xs font-black text-[#9dffc2]"
          href={`https://wa.me/${phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="mx-auto mb-1 h-4 w-4" />
          WhatsApp
        </a>
        <a
          className="rounded-xl bg-brand-gold/20 p-3 text-center text-xs font-black text-brand-gold"
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin className="mx-auto mb-1 h-4 w-4" />
          Map
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {statuses.map((status) => (
          <button
            key={status.v}
            disabled={busy}
            onClick={() => onStatus(status.v)}
            className="rounded-xl bg-brand-gold px-3 py-3 text-xs font-black text-[#071A33] disabled:opacity-50"
          >
            {isArabic ? status.ar : status.en}
          </button>
        ))}
      </div>
    </article>
  );
}
