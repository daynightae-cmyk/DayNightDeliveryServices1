import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquareText, RefreshCw, Star, X } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import { supabase } from "../../supabase";

function average(values: unknown[]) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

export default function MerchantFeedbackSummaryLauncher() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const isMerchantRoute = /^\/merchant(?:\/|$)/.test(window.location.pathname);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<any[]>([]);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("merchant_order_feedback");
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      setFeedback(Array.isArray(row?.feedback) ? row.feedback : []);
    } catch {
      setError(isArabic ? "تعذر تحميل تقييمات طلباتكم. تأكد من تحديث قاعدة البيانات." : "Order feedback could not load. Verify the database update.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const summary = useMemo(() => ({
    count: feedback.length,
    overall: average(feedback.map((item) => item.overall_rating)),
    company: average(feedback.map((item) => item.company_rating)),
    driver: average(feedback.map((item) => item.driver_rating)),
  }), [feedback]);

  if (!isMerchantRoute) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 start-4 z-[91000] flex min-h-14 items-center gap-3 rounded-2xl border border-white/15 bg-[#071A33] px-4 py-3 text-white shadow-[0_20px_60px_rgba(7,26,51,0.35)] sm:bottom-6"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#D4AF37] text-[#071A33]"><Star className="h-5 w-5 fill-current" /></span>
        <span className="text-start"><strong className="block text-xs">{isArabic ? "تقييمات طلباتكم" : "Order feedback"}</strong><small className="text-[10px] text-white/55">{isArabic ? "بدون بيانات إدارية حساسة" : "Privacy-safe summary"}</small></span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100050] flex items-end justify-center bg-[#071A33]/75 backdrop-blur-sm sm:items-center sm:p-5" dir={isArabic ? "rtl" : "ltr"}>
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] bg-[#F4F8FF] p-5 shadow-2xl sm:rounded-[30px] sm:p-7">
            <header className="flex items-start justify-between gap-3">
              <div><span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0057B8]">MERCHANT EXPERIENCE</span><h2 className="mt-1 text-xl font-black text-[#071A33]">{isArabic ? "تقييمات طلبات المتجر" : "Merchant order feedback"}</h2><p className="mt-1 text-xs text-[#52627A]">{isArabic ? "لا تظهر أرقام العملاء أو عناوين IP أو ملاحظات الإدارة الداخلية." : "Customer phones, IP hashes, and internal admin notes are never shown."}</p></div>
              <button onClick={() => setOpen(false)} className="rounded-full bg-[#071A33]/5 p-2"><X className="h-5 w-5" /></button>
            </header>

            <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [isArabic ? "عدد التقييمات" : "Ratings", summary.count],
                [isArabic ? "المتوسط العام" : "Overall", summary.overall.toFixed(1)],
                [isArabic ? "تقييم الشركة" : "Company", summary.company.toFixed(1)],
                [isArabic ? "تقييم المندوب" : "Driver", summary.driver.toFixed(1)],
              ].map(([label, value]) => <article key={label} className="rounded-2xl bg-white p-4 shadow-sm"><Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" /><strong className="mt-2 block text-xl text-[#071A33]">{value}</strong><span className="text-[10px] font-bold text-[#52627A]">{label}</span></article>)}
            </section>

            <div className="mt-4 flex justify-end"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#0057B8] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button></div>
            {error && <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
            {loading && !feedback.length ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#0057B8]" /></div> : <div className="mt-4 space-y-3">{feedback.map((item) => <article key={item.id} className="rounded-3xl border border-[#071A33]/8 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><strong className="font-mono text-xs text-[#0057B8]">{item.tracking_number}</strong><p className="mt-2 text-sm leading-6 text-[#52627A]">{item.comment || (isArabic ? "لا يوجد تعليق نصي." : "No written comment.")}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7D8] px-3 py-1 text-xs font-black text-[#8A6400]"><Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />{item.overall_rating}</span></div><div className="mt-3 flex flex-wrap gap-2">{(item.selected_tags || []).map((tag: string) => <span key={tag} className="rounded-full bg-[#0057B8]/8 px-3 py-1 text-[10px] font-black text-[#0057B8]">{tag}</span>)}</div></article>)}{!feedback.length && !loading && <div className="rounded-3xl bg-white p-10 text-center text-[#52627A]"><MessageSquareText className="mx-auto mb-3 h-10 w-10 text-[#A8B3C5]" />{isArabic ? "لم تصل تقييمات لطلباتكم بعد." : "No order feedback yet."}</div>}</div>}
          </div>
        </div>
      )}
    </>
  );
}
