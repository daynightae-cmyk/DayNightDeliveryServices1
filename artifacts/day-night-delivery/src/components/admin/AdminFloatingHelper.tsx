import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { fetchAllOrders } from "../../supabase";
import { fetchMerchants } from "../../lib/adminData";

export default function AdminFloatingHelper() {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("أنا خليفة، تحت أمرك يا أبو خليفة.");

  useEffect(() => {
    let active = true;
    async function load() {
      const [orders, merchants] = await Promise.all([fetchAllOrders(), fetchMerchants()]);
      if (!active) return;
      if (!orders.length && !merchants.length) setText("أنا خليفة، تحت أمرك يا أبو خليفة. لا توجد بيانات حقيقية كافية حالياً.");
      else setText(`أنا خليفة. يا أبو خليفة عندك حالياً ${orders.length} طلب و ${merchants.length} تاجر من قاعدة البيانات مباشرة.`);
    }
    load();
    const refresh = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(refresh); };
  }, []);

  return (
    <div className="dn-ai-buddy" dir="rtl">
      {open && <div className="dn-ai-buddy-card p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gold text-brand-deep"><Bot className="h-5 w-5" /></span><div><strong className="block text-sm font-black text-white">خليفة</strong><span className="text-[11px] font-bold text-white/45">بوت الإدارة الداخلي</span></div></div><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white"><X className="h-4 w-4" /></button></div><p className="text-sm font-bold leading-7 text-white/72">{text}</p></div>}
      <button type="button" className="dn-ai-buddy-toggle" onClick={() => setOpen((value) => !value)} aria-label="Khalifa admin helper"><span className="dn-ai-buddy-mini" /></button>
    </div>
  );
}
