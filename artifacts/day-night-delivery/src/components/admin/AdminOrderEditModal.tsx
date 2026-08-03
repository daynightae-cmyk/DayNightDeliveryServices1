import type { ComponentProps } from "react";
import AdminOrderEditModalComplete from "./AdminOrderEditModalComplete";

type Props = ComponentProps<typeof AdminOrderEditModalComplete>;

/**
 * Keep the editor mounted after every successful save and close it only when the
 * operator explicitly exits. The complete editor publishes the verified saved
 * row through `dn-admin-orders-updated`, so invoking the legacy parent callback
 * would only trigger an unnecessary global refresh and destroy workspace state.
 */
export default function AdminOrderEditModal(props: Props) {
  const { open, order, onClose, ...modalProps } = props;

  return (
    <AdminOrderEditModalComplete
      {...modalProps}
      order={order}
      open={open}
      onSaved={async () => undefined}
      onClose={onClose}
    />
  );
}
