import type { Order } from "../types";
import { buildShippingLabel, printShippingLabel } from "../lib/shippingLabel";

interface ShippingLabelProps {
  order: Order;
}

export default function ShippingLabel({ order }: ShippingLabelProps) {
  const label = buildShippingLabel(order);

  const html = `<!doctype html><html><body style="font-family:sans-serif;padding:16px"><h2>DAY NIGHT DELIVERY SERVICES</h2><p>${label.trackingCode}</p><p>${label.sender}</p><p>${label.receiver}</p><img src="${label.qrUrl}" width="160" height="160" /></body></html>`;

  return (
    <div className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 text-xs space-y-2">
      <h3 className="font-bold text-brand-gold">A6 Shipping Label</h3>
      <p className="text-white/70">Tracking: {label.trackingCode}</p>
      <p className="text-white/70">From: {label.from}</p>
      <p className="text-white/70">To: {label.to}</p>
      <button onClick={() => printShippingLabel(html)} className="px-4 py-2 bg-brand-gold text-brand-deep rounded-xl font-bold">Print Label</button>
    </div>
  );
}
