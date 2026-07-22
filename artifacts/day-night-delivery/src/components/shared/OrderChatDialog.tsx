import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, MessageCircle, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import type { Order } from "../../types";
import { useOrderChat, type OrderChatRole } from "../../hooks/useOrderChat";
import "../../styles/dn-order-chat.css";

type Props = {
  open: boolean;
  order: Order | null;
  actorRole: OrderChatRole;
  isArabic: boolean;
  onClose: () => void;
};

function referenceOf(order: Order | null) {
  if (!order) return "—";
  return String(order.tracking_number || order.tracking_code || order.invoice_number || order.id || "—");
}

function senderLabel(role: string, isArabic: boolean) {
  if (role === "driver") return isArabic ? "المندوب" : "Driver";
  if (role === "customer") return isArabic ? "العميل" : "Customer";
  return isArabic ? "مركز العمليات" : "Operations";
}

export default function OrderChatDialog({ open, order, actorRole, isArabic, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const chat = useOrderChat(open ? String(order?.id || "") : null, isArabic);

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length]);

  if (!open || !order) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (await chat.send(value)) setDraft("");
  }

  return (
    <div className="dn-order-chat-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="dn-order-chat-dialog" role="dialog" aria-modal="true" aria-label={isArabic ? "محادثة الطلبية" : "Order conversation"} dir={isArabic ? "rtl" : "ltr"}>
        <header>
          <span><MessageCircle /></span>
          <div><small>DAY NIGHT LIVE CHAT</small><h2>{isArabic ? "محادثة الطلبية" : "Order conversation"}</h2><p dir="ltr">#{referenceOf(order)}</p></div>
          <button type="button" onClick={() => void chat.refresh()} disabled={chat.loading} aria-label={isArabic ? "تحديث" : "Refresh"}><RefreshCw className={chat.loading ? "animate-spin" : ""} /></button>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}><X /></button>
        </header>

        <div className="dn-order-chat-security"><ShieldCheck />{isArabic ? "محادثة خاصة بين العميل والمندوب المسند ومركز العمليات." : "Private conversation for the customer, assigned driver, and operations."}</div>
        {chat.error ? <div className="dn-order-chat-error">{chat.error}</div> : null}

        <div ref={listRef} className="dn-order-chat-messages">
          {chat.loading && !chat.messages.length ? <div className="dn-order-chat-loading"><Loader2 className="animate-spin" />{isArabic ? "تحميل المحادثة..." : "Loading conversation..."}</div> : null}
          {!chat.loading && !chat.messages.length ? <div className="dn-order-chat-empty"><MessageCircle /><strong>{isArabic ? "ابدأ المحادثة الآن" : "Start the conversation"}</strong><span>{isArabic ? "اكتب رسالة أو شارك موقعك الحالي." : "Write a message or share your current location."}</span></div> : null}
          {chat.messages.map((message) => {
            const mine = message.sender_role === actorRole;
            const isLocation = message.message_type === "location" && Number.isFinite(Number(message.latitude)) && Number.isFinite(Number(message.longitude));
            const mapsUrl = isLocation ? `https://www.google.com/maps?q=${message.latitude},${message.longitude}` : "";
            return <article key={message.id} className={mine ? "is-mine" : ""}>
              <small>{message.sender_name || senderLabel(message.sender_role, isArabic)} · {new Date(message.created_at).toLocaleTimeString(isArabic ? "ar-AE" : "en-AE", { hour: "2-digit", minute: "2-digit" })}</small>
              {isLocation ? <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin /><span><strong>{message.body || (isArabic ? "موقع مشترك" : "Shared location")}</strong><em dir="ltr">{Number(message.latitude).toFixed(5)}, {Number(message.longitude).toFixed(5)}</em></span></a> : <p>{message.body}</p>}
            </article>;
          })}
        </div>

        <form onSubmit={submit}>
          <button type="button" onClick={() => void chat.sendLocation()} disabled={chat.sending} title={isArabic ? "مشاركة موقعي" : "Share my location"}><Crosshair /></button>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={1} placeholder={isArabic ? "اكتب رسالتك..." : "Write a message..."} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <button type="submit" className="is-send" disabled={chat.sending || !draft.trim()}>{chat.sending ? <Loader2 className="animate-spin" /> : <Send />}</button>
        </form>
      </section>
    </div>
  );
}
