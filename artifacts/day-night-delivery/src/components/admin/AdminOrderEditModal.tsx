import { useEffect, useState, type ComponentProps } from "react";
import type { Order } from "../../types";
import AdminOrderEditModalComplete from "./AdminOrderEditModalComplete";

type Props = ComponentProps<typeof AdminOrderEditModalComplete>;

/**
 * Keeps the editor mounted after a successful database save.
 *
 * The legacy parent callback closes the modal immediately because it clears the
 * selected order inside `onSaved`. We therefore defer that callback until the
 * operator explicitly presses Close/Cancel. The complete editor already emits
 * `dn-admin-orders-updated` after every verified save, so the rest of the admin
 * shell can still react to the persisted row without destroying the form.
 */
export default function AdminOrderEditModal(props: Props) {
  const { open, order, onClose, onSaved, ...modalProps } = props;
  const [lastSavedOrder, setLastSavedOrder] = useState<Order | null>(null);
  const orderId = String(order?.id || order?.tracking_number || order?.invoice_number || "");

  useEffect(() => {
    if (!open) setLastSavedOrder(null);
  }, [open]);

  useEffect(() => {
    setLastSavedOrder(null);
  }, [orderId]);

  async function handleSaved(savedOrder: Order) {
    // Do not call the parent callback here: the current parent implementation
    // clears `editOrder` and closes the editor. Keep the saved row until the
    // operator explicitly exits instead.
    setLastSavedOrder(savedOrder);
  }

  async function handleExplicitClose() {
    try {
      if (lastSavedOrder) await onSaved?.(lastSavedOrder);
    } finally {
      onClose();
    }
  }

  return (
    <AdminOrderEditModalComplete
      {...modalProps}
      order={order}
      open={open}
      onSaved={handleSaved}
      onClose={() => void handleExplicitClose()}
    />
  );
}
