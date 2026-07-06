import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchAllOrders } from "../../supabase";
import { fetchMerchants } from "../../lib/adminData";
import khalifaAssets from "./khalifaAssets";
import "../../styles/dn-khalifa-final.css";

export default function AdminFloatingHelper() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("أنا خليفة تحت أمرك يا أبو خليفة.");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [orders, merchants] = await Promise.all([fetchAllOrders(), fetchMerchants()]);
        if (!active) return;

        if (!orders.length && !merchants.length) {
          setText("أنا خليفة تحت أمرك يا أبو خليفة. لا توجد بيانات حقيقية كافية حاليا.");
        } else {
          setText(`أنا خليفة. يا أبو خليفة عندك حاليا ${orders.length} طلب و ${merchants.length} تاجر من قاعدة البيانات مباشرة.`);
        }
      } catch {
        if (active) {
          setText("أنا خليفة معاك يا أبو خليفة. أقدر أساعدك في متابعة لوحة الإدارة.");
        }
      }
    }

    load();
    const refresh = window.setInterval(load, 60000);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  return (
    <div className="dn-khalifa-floating" dir="rtl">
      {open && (
        <div className="dn-khalifa-floating-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={khalifaAssets.bot}
                alt="خليفة"
                className="dn-khalifa-bot-avatar"
              />
              <div>
                <strong className="block text-sm font-black text-[#F5B700]">خليفة</strong>
                <span className="text-[11px] font-bold text-white/45">مساعد أبو خليفة</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white"
              aria-label="إغلاق مساعد خليفة"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm font-bold leading-7 text-white/75">
            {text}
          </p>
        </div>
      )}

      <button
        type="button"
        className="dn-khalifa-floating-button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Khalifa admin helper"
      >
        <img
          src={khalifaAssets.bot}
          alt="خليفة"
          className="h-10 w-10 rounded-full border border-white/10 bg-white/5 object-contain p-1"
        />
        <span className="text-right">
          <strong className="block text-sm font-black text-white">خليفة</strong>
          <span className="block text-[11px] font-bold text-[#F5B700]">مساعد أبو خليفة</span>
        </span>
      </button>
    </div>
  );
}
