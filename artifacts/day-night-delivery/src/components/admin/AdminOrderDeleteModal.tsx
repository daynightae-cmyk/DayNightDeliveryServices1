import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { deleteOpsOrder, opsErrorDetail } from "../../lib/adminOperationsData";
import type { Order } from "../../types";

type ExtendedOrder = Order & {
  assigned_driver_id?: string | null;
  driver_id?: string | null;
};

type Props = {
  order: Order | null;
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onDeleted?: (reference: string) => Promise<void> | void;
};

const DELETE_STATUSES = new Set([
  "pending",
  "review",
  "under_review",
  "confirmed",
  "cancelled",
  "canceled",
  "returned",
]);

const clean = (value: unknown) => String(value ?? "").trim();
const normalizeStatus = (value: unknown) =>
  clean(value).toLowerCase().replace(/[\s-]+/g, "_");
const orderReference = (order: Order) =>
  order.tracking_number ||
  order.invoice_number ||
  order.coupon_number ||
  order.id ||
  "—";

export default function AdminOrderDeleteModal({
  order,
  isArabic,
  open,
  onClose,
  onDeleted,
}: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setBusy(false);
    setError("");
  }, [open, order?.id]);

  const blockReason = useMemo(() => {
    if (!order) return "";
    const row = order as ExtendedOrder;
    const assigned =
      row.assigned_driver_id ||
      row.driver_id ||
      order.driver_code ||
      order.driver_name;
    if (assigned) {
      return isArabic
        ? "لا يمكن حذف طلب مُسند لمندوب. ألغِ الإسناد أولاً حفاظاً على سجل المندوب والطلب."
        : "An assigned order cannot be deleted. Unassign it first to preserve driver and order history.";
    }
    if (!DELETE_STATUSES.has(normalizeStatus(order.status))) {
      return isArabic
        ? "لا يمكن حذف طلب داخل التنفيذ أو تم تسليمه. استخدم الإلغاء أو الإرجاع حسب الحالة التشغيلية."
        : "An active or delivered order cannot be deleted. Use cancellation or return according to the workflow.";
    }
    return "";
  }, [isArabic, order]);

  if (!open || !order) return null;

  async function confirmDelete() {
    if (blockReason) return setError(blockReason);
    if (clean(reason).length < 4) {
      return setError(
        isArabic
          ? "اكتب سبب الحذف بوضوح؛ السبب مطلوب لسجل التدقيق."
          : "Enter a clear deletion reason; it is required for the audit log.",
      );
    }

    setBusy(true);
    setError("");
    try {
      const result = await deleteOpsOrder(order, reason);
      if (!result.deleted) throw new Error("delete_not_confirmed");
      await onDeleted?.(result.reference);
      window.dispatchEvent(new CustomEvent("dn-admin-orders-updated"));
      onClose();
    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
          ? `تعذر حذف الطلب الحقيقي.${detail ? ` السبب: ${detail}` : ""}`
          : `The real order could not be deleted.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="dn-admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <section className="dn-admin-action-modal !max-w-xl">
        <header>
          <div>
            <span>{isArabic ? "حذف آمن مع سجل تدقيق" : "Safe deletion with audit log"}</span>
            <strong>{orderReference(order)}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-1">
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs font-bold leading-6 text-amber-100">
            <ShieldCheck className="mb-2 h-5 w-5" />
            {isArabic
              ? "قبل الحذف تُحفظ نسخة كاملة من الطلب وسبب الحذف وبيانات منفّذ العملية. لا يمكن حذف الطلبات المسندة أو الجارية أو المسلّمة."
              : "Before deletion, a complete snapshot, reason, and acting user are logged. Assigned, active, or delivered orders cannot be deleted."}
          </div>

          {blockReason && (
            <div className="flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100">
              <AlertTriangle className="h-4 w-4 flex-none" />
              {blockReason}
            </div>
          )}
          {error && !blockReason && (
            <div className="flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold text-rose-100">
              <AlertTriangle className="h-4 w-4 flex-none" />
              {error}
            </div>
          )}

          <label className="block space-y-2 text-xs font-black text-white/70">
            <span>{isArabic ? "سبب الحذف *" : "Deletion reason *"}</span>
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                isArabic
                  ? "مثال: طلب تجريبي أُضيف بالخطأ، ولا توجد عليه حركة تشغيلية."
                  : "Example: Test order created by mistake with no operational activity."
              }
              className="w-full rounded-xl border border-white/10 bg-brand-deep/75 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-rose-400/60"
              disabled={Boolean(blockReason) || busy}
            />
          </label>
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            {isArabic ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={busy || Boolean(blockReason)}
            onClick={() => void confirmDelete()}
            className="!bg-rose-500 !text-white disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {busy
              ? isArabic
                ? "جارٍ الحذف..."
                : "Deleting..."
              : isArabic
                ? "تأكيد الحذف الآمن"
                : "Confirm safe deletion"}
          </button>
        </footer>
      </section>
    </div>
  );
}
