import { buildTrackingQrUrl } from "./qrGenerator";
import type { Order } from "../types";

export function buildShippingLabel(order: Order) {
  return {
    trackingCode: order.id,
    sender: `${order.sender_name} | ${order.sender_phone}`,
    receiver: `${order.receiver_name} | ${order.receiver_phone}`,
    from: order.sender_city,
    to: order.receiver_city,
    weight: `${order.weight} kg`,
    shippedAt: new Date(order.created_at).toLocaleDateString(),
    qrUrl: buildTrackingQrUrl(order.id)
  };
}

export function printShippingLabel(labelHtml: string) {
  const popup = window.open("", "_blank", "width=800,height=900");
  if (!popup) return;
  popup.document.write(labelHtml);
  popup.document.close();
  popup.focus();
  popup.print();
}
