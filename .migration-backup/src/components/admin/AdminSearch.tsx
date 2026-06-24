import { useMemo, useState } from "react";
import type { Order } from "../../types";

interface AdminSearchProps {
  orders: Order[];
  onFiltered: (orders: Order[]) => void;
}

export default function AdminSearch({ orders, onFiltered }: AdminSearchProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = orders.filter((o) => {
      const matchesQuery = !q || [o.id, o.sender_name, o.receiver_name, o.sender_phone, o.receiver_phone, o.sender_city, o.receiver_city].some((v) => String(v || "").toLowerCase().includes(q));
      const matchesStatus = status === "all" || o.status.toLowerCase() === status.toLowerCase();
      return matchesQuery && matchesStatus;
    });
    onFiltered(result);
    return result;
  }, [orders, onFiltered, query, status]);

  function exportCsv() {
    const headers = ["id", "sender", "receiver", "status", "city_from", "city_to", "price"];
    const rows = filtered.map((o) => [o.id, o.sender_name, o.receiver_name, o.status, o.sender_city, o.receiver_city, String(o.delivery_price)]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-search-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-brand-cool/20 border border-white/10 rounded-2xl p-4 space-y-3">
      <h3 className="text-white font-bold text-sm">Advanced Search</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="tracking, sender, phone, city" className="bg-brand-deep border border-white/10 rounded-xl px-3 py-2 text-xs" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-brand-deep border border-white/10 rounded-xl px-3 py-2 text-xs">
          <option value="all">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Transit">In Transit</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button onClick={exportCsv} className="bg-brand-gold text-brand-deep rounded-xl px-3 py-2 text-xs font-bold">Export CSV</button>
      </div>
      <p className="text-[11px] text-white/50">Results: {filtered.length}</p>
    </section>
  );
}
