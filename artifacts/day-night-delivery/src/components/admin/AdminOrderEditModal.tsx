import type { ComponentProps } from "react";
import type { Order } from "../../types";
import AdminOrderEditModalComplete from "./AdminOrderEditModalComplete";

type Props = ComponentProps<typeof AdminOrderEditModalComplete>;

/**
 * Keep the editor mounted after every verified save and close it only when the
 * operator explicitly exits. The complete editor publishes the saved row through
 * `dn-admin-orders-updated`; calling the legacy parent `onSaved` callback would
 * trigger a global refresh and destroy the current workspace state.
 */
export default function AdminOrderEditModal(props: Props) {
  const { open, order, onClose, onSaved: _legacyParentRefresh, ...modalProps } = props;

  async function handleSaved(_savedOrder: Order) {
    // Intentionally no parent callback. The verified row event updates every open
    // admin list in place while this editor remains mounted for further edits.
  }

  async function handleExplicitClose() {
    // Explicit close is the only operation that exits the editor. It must not
    // reload orders or invoke the legacy parent refresh callback.
    onClose();
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
