import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Order } from "../../types";
import { createAdminAuditEvent, updateOrderStatus } from "../../lib/adminData";
import { statusLabel } from "../../data/adminTranslations";

type Props = { order: Order | null; isArabic: boolean; open: boolean; onClose: () => void; onSaved?: () => Promise<void> | void };
const statuses = ["pending","confirmed","under_review","assigned","pickup_scheduled","picked_up","in_transit","delivered","postponed","returned","cancelled","failed"];
const ref = (order: Order) => order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—";
export default function AdminStatusUpdateModal({ order, isArabic, open, onClose, onSaved }: Props) {
  const [status, setStatus] = useState("under_review");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(false);
  const [effectiveAt, setEffectiveAt] = useState(new Date().toISOString().slice(0, 16));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open || !order) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order?.id) { setMessage(isArabic ? "لا يوجد معرف طلب صالح؛ التحديث تجريبي فقط." : "No valid order id; preview update only."); return; }
    setBusy(true); setMessage("");
    try {
      await updateOrderStatus(order.id, status, [reason, note, effectiveAt, notify ? "notify_requested" : "no_notify"].filter(Boolean).join(" | "));
      await createAdminAuditEvent({ entity_type: "order", entity_id: order.id, action: "status_update", metadata: { status, reason, effectiveAt, notify } });
      setMessage(isArabic ? "تم حفظ تحديث الحالة." : "Status update saved.");
      await onSaved?.();
    } catch {
      setMessage(isArabic ? "تعذر حفظ التحديث في قاعدة البيانات. هذه معاينة غير متصلة ولم يتم ادعاء نجاح وهمي." : "Database update unavailable. This is an offline preview; no fake success was recorded.");
    } finally { setBusy(false); }
  }
  return <div className="dn-admin-modal-backdrop" role="dialog" aria-modal="true"><form className="dn-admin-action-modal" onSubmit={submit}><header><div><span>{isArabic ? "تحديث حالة الطلب" : "Update order status"}</span><strong>{ref(order)}</strong></div><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></header><label>{isArabic ? "الحالة الجديدة" : "New status"}<select value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((item)=><option key={item} value={item}>{statusLabel(item,isArabic)}</option>)}</select></label><label>{isArabic ? "السبب" : "Reason"}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isArabic ? "سبب التحديث" : "Update reason"} /></label><label>{isArabic ? "ملاحظة الإدارة" : "Admin note"}<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label><label>{isArabic ? "وقت النفاذ" : "Effective date/time"}<input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} /></label><label className="dn-admin-inline-check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{isArabic ? "طلب إشعار العميل/التاجر إذا كان مدعوماً" : "Request merchant/customer notification if supported"}</label>{message && <p className="dn-admin-modal-message">{message}</p>}<footer><button type="button" onClick={onClose}>{isArabic ? "إغلاق" : "Close"}</button><button type="submit" disabled={busy}>{busy ? (isArabic ? "حفظ..." : "Saving...") : (isArabic ? "حفظ التحديث" : "Save update")}</button></footer></form></div>;
}
