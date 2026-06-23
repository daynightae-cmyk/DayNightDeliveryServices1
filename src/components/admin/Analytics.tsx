import { useMemo } from "react";
import type { Order } from "../../types";

interface AnalyticsProps {
  orders: Order[];
}

export default function Analytics({ orders }: AnalyticsProps) {
  const stats = useMemo(() => {
    const byCity: Record<string, number> = {};
    let revenue = 0;
    for (const order of orders) {
      byCity[order.receiver_city] = (byCity[order.receiver_city] || 0) + 1;
      revenue += Number(order.delivery_price || 0);
    }
    const topCity = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0];
    return {
      totalOrders: orders.length,
      totalRevenue: Number(revenue.toFixed(2)),
      topCity: topCity ? `${topCity[0]} (${topCity[1]})` : "N/A"
    };
  }, [orders]);

  return (
    <section className="bg-brand-cool/20 border border-white/10 rounded-2xl p-4 space-y-3">
      <h3 className="text-white font-bold text-sm">Analytics Dashboard</h3>
      <p className="text-xs text-white/70">Total orders: {stats.totalOrders}</p>
      <p className="text-xs text-white/70" dir="ltr">Revenue: {stats.totalRevenue} AED</p>
      <p className="text-xs text-white/70">Top city: {stats.topCity}</p>
      <div className="text-[11px] text-white/50">Interactive chart integration hook is ready for chart library adapter.</div>
    </section>
  );
}
