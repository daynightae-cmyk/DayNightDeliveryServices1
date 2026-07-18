import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { deleteOpsOrder, opsErrorDetail } from "../../lib/adminOperationsData";
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
 * Opening this component starts the real Supabase deletion immediately. The admin is
 * no longer asked to type a reason or press a second confirmation button. The RPC
 * still receives a fixed internal audit reason so deletion records remain traceable.
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

  useEffect(() => {
    if (!open || !order) {
      startedReference.current = "";
      setBusy(false);
      setError("");
      return;
    }

    const reference = String(orderReference(order));
    if (startedReference.current === reference) return;
    startedReference.current = reference;
    setBusy(true);
    setError("");

    void (async () => {
      try {
        const result = await deleteOpsOrder(
          order,
          "Direct one-click deletion from DAY NIGHT admin orders table",
        );
        if (!result.deleted) throw new Error("delete_not_confirmed");

        window.dispatchEvent(
          new CustomEvent("dn-admin-orders-updated", {
            detail: { deletedReference: result.reference },
          }),
        );

        onClose();

        // A reload guarantees every installed live shell, browser tab, and cached
        // admin workspace immediately receives the authoritative Supabase snapshot.
        window.setTimeout(() => window.location.reload(), 80);
      } catch (cause) {
        const detail = opsErrorDetail(cause);
        setBusy(false);
        setError(
          isArabic
            ? `تعذر حذف الطلب.${detail ? ` ${detail}` : ""}`
            : `The order could not be deleted.${detail ? ` ${detail}` : ""}`,
        );
      }
    })();
  }, [isArabic, onClose, open, order]);

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
      <section className="dn-admin-action-modal !max-w-xl">
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
          <button type="button" onClick={onClose}>
            {isArabic ? "إغلاق" : "Close"}
          </button>
        </footer>
      </section>
    </div>
  );
}
