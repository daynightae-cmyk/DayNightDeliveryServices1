import { useEffect, useMemo, useState } from "react";
import { Bot, X } from "lucide-react";
import { fetchAllOrders } from "../../supabase";
import { fetchMerchants } from "../../lib/adminData";
import type { Merchant, Order } from "../../types";

function money(value: number) {
  return `${value.toFixed(2)} AED`;
}

export default function AdminFloatingHelper() {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const [realOrders, realMerchants] = await Promise.all([fetchAllOrders(), fetchMerchants()]);
      if (!active) return;
      setOrders(realOrders);
      setMerchants(realMerchants);
    }
    load();
    const refresh = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(refresh); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => value + 1), 7000);
    return () => window.clearInterval(timer);
  }, []);

  const messages = useMemo(() => {
    const cancelled = orders.filter((order) => String(order.status || "").toLowerCase().includes("cancel") || String(order.status || "").toLowerCase().includes("fail")).length;
    const review = orders.filter((order) => ["pending", "confirmed"].some((word) => String(order.status || "").toLowerCase().includes(word))).length;
    const cod = orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0);
    if (!orders.length && !merchants.length) return ["أنا خليفه، مساعد الإدارة. لا توجد بيانات حقيقية كافية حالياً، لذلك لن أعرض أي أرقام أو أسماء وهمية."];
    return [
      `أنا خليفه. عندك حالياً ${orders.length} طلب و ${merchants.length} تاجر من قاعدة البيانات مباشرة.`,
      `طلبات قيد المراجعة فعلياً: ${review}.`,
      `الطلبات الملغية أو الفاشلة فعلياً: ${cancelled}.`,
      `إجمالي COD المسجل حالياً: ${money(cod)}.`,
    ];
  }, [orders, merchants]);

  const text = messages[index % messages.length];

  return (
    <div className="dn-ai-buddy" dir="rtl">
      {open && (
        <div className="dn-ai-buddy-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gold text-brand-deep"><Bot className="h-5 w-5" /></span><div><strong className="block text-sm font-black text-white">خليفه</strong><span className="text-[11px] font-bold text-white/45">بوت الإدارة الداخلي</span></div></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-sm font-bold leading-7 text-white/72">{text}</p>
        </div>
      )}
      <button type="button" className="dn-ai-buddy-toggle" onClick={() => setOpen((value) => !value)} aria-label="Khalifa admin helper"><span className="dn-ai-buddy-mini" /></button>
    </div>
  );
}
