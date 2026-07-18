import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { deleteAdminOrderImmediately } from "../../lib/adminOrderDeleteData";
import type { Order } from "../../types";

type Props = {
  order: Order | null;
  isArabic: boolean;
  open: boolean;
  onClose: () => void;
  onDeleted?: (reference: string) => Promise<void> | void;
};

const orderReference = (order: Order) =>
  order.tracking_number ||
  order.invoice_number ||
  order.coupon_number ||
  order.id ||
  "—";

/**
 * One-click admin deletion.
 *
 * No reason field, no second confirmation, and no raw database/schema message is
 * ever shown to the operator. Compatibility across Supabase migration generations
 * is handled by the deletion data layer.
 */
export default function AdminOrderDeleteModal({
  order,
  isArabic,
  open,
  onClose,
}: Props) {
  const startedReference = useRef("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!open || !order) {
      startedReference.current = "";
      setBusy(false);
      setError("");
      return;
    }

    const reference = String(orderReference(order));
    const attemptKey = `${reference}:${retryToken}`;
    if (startedReference.current === attemptKey) return;
    startedReference.current = attemptKey;
    setBusy(true);
    setError("");

    void (async () => {
      try {
        const result = await deleteAdminOrderImmediately(order);
        if (!result.deleted) throw new Error("delete_not_confirmed");

        window.dispatchEvent(
          new CustomEvent("dn-admin-orders-updated", {
            detail: { deletedReference: result.reference },
          }),
        );

        onClose();

        // Reload from the authoritative Supabase snapshot so every live installed
        // shell immediately reflects the deletion without retaining a stale row.
        window.setTimeout(() => window.location.reload(), 80);
      } catch (cause) {
        console.error("DAY NIGHT order deletion failed", cause);
        setBusy(false);
        setError(
          isArabic
            ? "تعذر الحذف الآن. اضغط إعادة المحاولة."
            : "Deletion could not be completed. Press retry.",
        );
      }
    })();
  }, [isArabic, onClose, open, order, retryToken]);

  if (!open || !order) return null;

  if (!error) {
    return (
      <div
        className="dn-admin-modal-backdrop"
        role="status"
        aria-live="polite"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <section className="dn-admin-action-modal !max-w-sm">
          <div className="flex items-center justify-center gap-3 p-6 text-sm font-black text-white">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-rose-300" />
            ) : (
              <Trash2 className="h-5 w-5 text-rose-300" />
            )}
            <span>{isArabic ? "جارٍ حذف الطلب..." : "Deleting order..."}</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="dn-admin-modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <section className="dn-admin-action-modal !max-w-md">
        <header>
          <div>
            <span>{isArabic ? "تعذر الحذف" : "Deletion failed"}</span>
            <strong>{orderReference(order)}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs font-bold leading-6 text-rose-100">
          <AlertTriangle className="h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>

        <footer>
          <button
            type="button"
            onClick={() => {
              startedReference.current = "";
              setRetryToken((value) => value + 1);
            }}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {isArabic ? "إعادة المحاولة" : "Retry"}
          </button>
          <button type="button" onClick={onClose}>
            {isArabic ? "إغلاق" : "Close"}
          </button>
        </footer>
      </section>
    </div>
  );
}
