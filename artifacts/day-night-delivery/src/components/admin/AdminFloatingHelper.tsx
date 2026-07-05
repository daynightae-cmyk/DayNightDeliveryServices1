import { useState } from "react";
import { Bot, X } from "lucide-react";

export default function AdminFloatingHelper() {
  const [open, setOpen] = useState(true);
  const text = "يا أبو خليفة، راجع التجار والطلبات المهمة الأول.";
  return (
    <div className="dn-ai-buddy" dir="rtl">
      {open && (
        <div className="dn-ai-buddy-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gold text-brand-deep"><Bot className="h-5 w-5" /></span><strong className="block text-sm font-black text-white">مساعد الإدارة</strong></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-sm font-bold leading-7 text-white/72">{text}</p>
        </div>
      )}
      <button type="button" className="dn-ai-buddy-toggle" onClick={() => setOpen((value) => !value)} aria-label="Admin helper"><span className="dn-ai-buddy-mini" /></button>
    </div>
  );
}
