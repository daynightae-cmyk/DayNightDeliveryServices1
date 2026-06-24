import { useMemo, useState } from "react";
import type { Order } from "../../types";
import SignatureCapture from "../signature/SignatureCapture";

interface DriverMobileViewProps {
  orders: Order[];
  onStatusChange: (orderId: string, status: Order["status"], note?: string) => void;
}

const flow: Order["status"][] = ["Picked Up", "In Transit", "Delivered"];

export default function DriverMobileView({ orders, onStatusChange }: DriverMobileViewProps) {
  const [note, setNote] = useState("");
  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled"), [orders]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">Driver Mobile View</h2>
      <p className="text-xs text-white/60">Offline support ready: last assigned orders are cached in memory for temporary use.</p>
      <div className="space-y-3">
        {activeOrders.map((order) => (
          <article key={order.id} className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 space-y-3">
            <p className="text-brand-gold font-mono">{order.id}</p>
            <p className="text-xs text-white/70">{order.sender_city} {"->"} {order.receiver_city}</p>
            <div className="flex flex-wrap gap-2">
              {flow.map((status) => (
                <button key={status} onClick={() => onStatusChange(order.id, status, note)} className="px-3 py-1.5 text-xs bg-brand-gold text-brand-deep rounded-lg font-bold">{status}</button>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery note" className="w-full bg-brand-deep border border-white/10 rounded-xl px-3 py-2 text-xs" />
            <SignatureCapture status={order.status} />
          </article>
        ))}
      </div>
    </section>
  );
}
