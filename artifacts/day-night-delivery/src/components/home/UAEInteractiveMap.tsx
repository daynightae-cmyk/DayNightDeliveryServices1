import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { fetchPublicLiveOperationsMap } from "../../supabase";

const MAP_IMAGE_URL = "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png";

type MapRow = {
  tracking_ref?: string | null;
  status?: string | null;
  sender_city?: string | null;
  receiver_city?: string | null;
};

const demoRows: MapRow[] = [
  { tracking_ref: "DN-LIVE-001", status: "Out for Delivery", sender_city: "Abu Dhabi", receiver_city: "Dubai" },
  { tracking_ref: "DN-LIVE-002", status: "In Transit", sender_city: "Abu Dhabi", receiver_city: "Sharjah" },
  { tracking_ref: "DN-LIVE-003", status: "Picked Up", sender_city: "Dubai", receiver_city: "Al Ain" },
];

export default function UAEInteractiveMap() {
  const [rows, setRows] = useState<MapRow[]>(demoRows);
  const [activeCount, setActiveCount] = useState(demoRows.length);
  const [signalCount, setSignalCount] = useState<number | string>("—");
  const [mode, setMode] = useState("عرض تشغيلي");
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [imageOk, setImageOk] = useState(true);

  async function refreshMap() {
    setUpdatedAt(new Date());
    const payload = await fetchPublicLiveOperationsMap(18);

    if (!payload) {
      setMode("RPC غير مفعل");
      setRows(demoRows);
      setActiveCount(demoRows.length);
      setSignalCount("—");
      return;
    }

    const safeRows = Array.isArray(payload.orders) ? payload.orders : [];
    setRows(safeRows.length ? safeRows : demoRows);
    setActiveCount(Number(payload.active_orders_count ?? safeRows.length) || 0);
    setSignalCount(Number(payload.driver_count ?? 0) || "—");
    setMode(safeRows.length ? "تشغيل مباشر آمن" : "لا توجد طلبات نشطة");
  }

  useEffect(() => {
    void refreshMap();
    const timer = window.setInterval(() => void refreshMap(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const timeLabel = updatedAt.toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="relative w-full overflow-hidden px-4 py-16 text-white sm:px-8 lg:px-12" dir="rtl" style={{ background: "linear-gradient(135deg,#030a18,#071a33 48%,#01050f)" }}>
      <div className="mx-auto mb-7 flex w-[min(1180px,100%)] flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <span className="mb-3 inline-flex rounded-full border border-[#f5b700]/25 bg-[#f5b700]/10 px-4 py-1.5 text-xs font-black tracking-[0.14em] text-[#f5b700]">DAY NIGHT SECURE LIVE OPS</span>
          <h2 className="m-0 text-[clamp(30px,4vw,54px)] font-black leading-[1.08]">خريطة تشغيل حية وآمنة</h2>
          <p className="mt-4 max-w-[760px] text-sm font-bold leading-8 text-white/70">بيانات عامة محدودة من RPC آمن، مع تحديث تلقائي كل 30 ثانية.</p>
        </div>
        <button onClick={() => void refreshMap()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-[#f5b700] backdrop-blur hover:bg-[#f5b700] hover:text-[#071a33]">
          <RefreshCw size={16} /> تحديث الآن
        </button>
      </div>

      <div className="mx-auto grid w-[min(1180px,100%)] grid-cols-1 gap-4 rounded-[36px] border border-[#18a8e8]/20 bg-[#061225]/90 p-4 shadow-2xl lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-[30px] bg-[#030a18]">
          {imageOk ? <img src={MAP_IMAGE_URL} alt="DAY NIGHT UAE live map" className="absolute inset-0 h-full w-full object-cover brightness-90" onError={() => setImageOk(false)} /> : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.28)_65%,rgba(0,0,0,.55)_100%)]" />
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 max-md:grid-cols-1">
            {[{ label: "طلبات نشطة", value: activeCount }, { label: "مؤشرات تشغيل", value: signalCount }, { label: "آخر تحديث", value: timeLabel }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur"><strong className="block text-xl font-black" dir="ltr">{item.value}</strong><span className="text-xs font-bold text-white/60">{item.label}</span></div>)}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-[#f5b700]"><Activity size={18} /><strong>{mode}</strong></div>
            <p className="text-xs font-bold leading-6 text-white/60">الموقع لا يقرأ الجداول التشغيلية مباشرة. التغذية تأتي من وظيفة عامة محدودة الحقول.</p>
          </div>
          {rows.slice(0, 7).map((row, index) => <div key={`${row.tracking_ref || index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><span className="block text-xs font-black" dir="ltr">{row.tracking_ref || `DN-${index + 1}`}</span><span className="mt-1 block text-[11px] font-bold text-white/50">{row.status || "Pending"} • {row.sender_city || "Abu Dhabi"} ← {row.receiver_city || "Dubai"}</span></div>)}
        </aside>
      </div>
    </section>
  );
}
