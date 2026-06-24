import { useMemo } from "react";
import type { Order } from "../../types";

interface CustomerDashboardProps {
  customerPhone: string;
  orders: Order[];
  onReorder: (order: Order) => void;
}

export default function CustomerDashboard({ customerPhone, orders, onReorder }: CustomerDashboardProps) {
  const customerOrders = useMemo(() => orders.filter((o) => o.sender_phone === customerPhone || o.receiver_phone === customerPhone), [orders, customerPhone]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">Customer Dashboard</h2>
      <p className="text-xs text-white/60">Previous orders, status timeline, reorder action, and pricing history.</p>
      <div className="space-y-3">
        {customerOrders.map((order) => (
          <article key={order.id} className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-brand-gold font-mono">{order.id}</p>
            <p className="text-xs text-white/70">Status: {order.status}</p>
            <p className="text-xs text-white/70" dir="ltr">Price: {order.delivery_price} AED</p>
            <button onClick={() => onReorder(order)} className="px-3 py-1.5 text-xs bg-brand-gold text-brand-deep rounded-lg font-bold">Re-order</button>
          </article>
        ))}
      </div>
    </section>
  );
}
