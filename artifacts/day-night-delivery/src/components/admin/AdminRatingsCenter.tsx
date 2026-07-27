import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCopy, ExternalLink, Loader2, MessageCircle, RefreshCw, ShieldAlert, Star, Store, Truck, UserRoundCheck } from "lucide-react";
import { supabase } from "../../supabase";
import { loadAdminCustomerExperience, subscribeCustomerExperience } from "../../services/customerExperienceService";
import { createMultiPartyRatingLink, type RatingParty } from "../../services/multiPartyRatingsService";

function average(values: unknown[]) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function formatRating(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function cleanPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) return `971${digits.slice(1)}`;
  return digits;
}

function StarsValue({ value }: { value: number }) {
  return <span className="inline-flex items-center gap-1 font-black text-[#8A6400]"><Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />{formatRating(value)}</span>;
}

export default function AdminRatingsCenter({ isArabic }: { isArabic: boolean }) {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [raterFilter, setRaterFilter] = useState<"all" | RatingParty>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error("supabase_not_configured");
      const [snapshot, ordersResult, driversResult] = await Promise.all([
        loadAdminCustomerExperience(),
        supabase.from("orders").select("*").order("updated_at", { ascending: false }).limit(500),
        supabase.from("driver_profiles").select("*").limit(500),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (driversResult.error) throw driversResult.error;
      setFeedback(snapshot.feedback || []);
      setMerchants(snapshot.merchants || []);
      setOrders(ordersResult.data || []);
      setDrivers(driversResult.data || []);
    } catch (cause) {
      console.warn("Ratings center load failed", cause);
      setError(isArabic ? "تعذر تحميل قسم التقييمات. طبّق Migration التقييمات متعددة الأطراف وتأكد من الصلاحيات." : "Ratings could not load. Apply the multi-party ratings migration and verify permissions.");
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => subscribeCustomerExperience(() => void refresh()), [refresh]);

  const merchantById = useMemo(() => new Map(merchants.map((item) => [item.id, item])), [merchants]);
  const driverById = useMemo(() => new Map(drivers.map((item) => [item.id, item])), [drivers]);

  const filtered = useMemo(
    () => feedback.filter((item) => raterFilter === "all" || String(item.rater_type || "customer") === raterFilter),
    [feedback, raterFilter],
  );

  const summary = useMemo(() => ({
    total: feedback.length,
    overall: average(feedback.map((item) => item.overall_rating)),
    company: average(feedback.map((item) => item.company_rating)),
    driver: average(feedback.map((item) => item.driver_rating)),
    merchant: average(feedback.map((item) => item.merchant_rating)),
    customer: average(feedback.map((item) => item.customer_cooperation_rating)),
    fiveStars: feedback.length ? feedback.filter((item) => Number(item.overall_rating) === 5).length / feedback.length * 100 : 0,
    low: feedback.filter((item) => Number(item.overall_rating) <= 2).length,
  }), [feedback]);

  const driverScores = useMemo(() => {
    const grouped = new Map<string, number[]>();
    feedback.forEach((item) => {
      if (!item.driver_id || !item.driver_rating) return;
      grouped.set(item.driver_id, [...(grouped.get(item.driver_id) || []), Number(item.driver_rating)]);
    });
    return [...grouped.entries()].map(([id, values]) => ({
      id,
      name: driverById.get(id)?.full_name || driverById.get(id)?.name || id,
      rating: average(values),
      count: values.length,
    })).sort((a, b) => b.rating - a.rating).slice(0, 10);
  }, [driverById, feedback]);

  const merchantScores = useMemo(() => {
    const grouped = new Map<string, number[]>();
    feedback.forEach((item) => {
      if (!item.merchant_id || !item.merchant_rating) return;
      grouped.set(item.merchant_id, [...(grouped.get(item.merchant_id) || []), Number(item.merchant_rating)]);
    });
    return [...grouped.entries()].map(([id, values]) => ({
      id,
      name: merchantById.get(id)?.trade_name || merchantById.get(id)?.owner_name || id,
      rating: average(values),
      count: values.length,
    })).sort((a, b) => b.rating - a.rating).slice(0, 10);
  }, [feedback, merchantById]);

  const deliveredOrders = useMemo(() => orders.filter((order) => {
    const status = String(order.status || "").toLowerCase().replace(/-/g, "_");
    return ["delivered", "completed", "complete"].includes(status);
  }).slice(0, 30), [orders]);

  async function makeLink(order: any, party: RatingParty, mode: "copy" | "whatsapp") {
    const key = `${order.id}:${party}:${mode}`;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await createMultiPartyRatingLink(order.id, party, isArabic ? "ar" : "en");
      if (mode === "copy") {
        await navigator.clipboard.writeText(result.url);
        setNotice(isArabic ? `تم نسخ رابط تقييم ${party === "customer" ? "العميل" : party === "merchant" ? "التاجر" : "المندوب"}.` : "Rating link copied.");
        return;
      }
      const merchant = merchantById.get(order.merchant_id);
      const phone = party === "customer"
        ? cleanPhone(order.receiver_phone || order.customer_phone)
        : party === "merchant"
          ? cleanPhone(merchant?.phone || order.merchant_phone)
          : cleanPhone(order.driver_phone || driverById.get(order.assigned_driver_id || order.driver_id)?.phone);
      if (!phone) throw new Error("recipient_phone_missing");
      const reference = order.tracking_number || order.tracking_code || order.invoice_number || order.id;
      const label = party === "customer" ? (isArabic ? "العميل" : "customer") : party === "merchant" ? (isArabic ? "التاجر" : "merchant") : (isArabic ? "المندوب" : "driver");
      const message = isArabic
        ? `السلام عليكم 👋\n\nنشكركم على التعامل مع داي نايت لخدمات التوصيل والشحن.\n📦 رقم الطلب: ${reference}\n⭐ نرجو من ${label} تقييم التجربة من الرابط الآمن التالي:\n${result.url}\n\nرأيكم يرفع جودة الخدمة ويظهر مباشرة في قسم التقييمات.`
        : `Hello 👋\n\nThank you for using DAY NIGHT DELIVERY SERVICES.\n📦 Order: ${reference}\n⭐ Please complete the secure ${label} rating:\n${result.url}\n\nYour feedback updates the Ratings Center directly.`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      setNotice(isArabic ? "تم تجهيز رسالة واتساب مع رابط التقييم." : "WhatsApp rating request prepared.");
    } catch (cause) {
      console.warn("Rating link generation failed", cause);
      setError(isArabic ? "تعذر إنشاء أو إرسال رابط التقييم. تحقق من بيانات الهاتف وMigration." : "Rating link could not be created or sent. Verify phone data and the migration.");
    } finally {
      setBusy("");
    }
  }

  const kpis = [
    [isArabic ? "متوسط الشركة" : "Company average", summary.company, Star],
    [isArabic ? "متوسط المناديب" : "Driver average", summary.driver, Truck],
    [isArabic ? "متوسط التجار" : "Merchant average", summary.merchant, Store],
    [isArabic ? "تعاون العملاء" : "Customer cooperation", summary.customer, UserRoundCheck],
  ] as const;

  return (
    <section className="min-h-full rounded-[30px] bg-[#EEF4FF] p-3 text-[#071A33] sm:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <header className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top_left,#1964b9_0,#071A33_55%,#031024_100%)] p-6 text-white shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><span className="text-[10px] font-black tracking-[0.22em] text-[#F5D46E]">DAY NIGHT RATINGS COMMAND</span><h1 className="mt-2 text-3xl font-black">{isArabic ? "قسم التقييمات" : "Ratings Center"}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-white/65">{isArabic ? "تقييم العميل للمندوب والشركة، تقييم التاجر للخدمة والمندوب، وتقييم المندوب للتاجر وتعاون العميل - مرتبطة بكل طلب وتظهر لحظيًا." : "Customer, merchant and driver ratings linked to each order and updated in real time."}</p></div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{isArabic ? "تحديث" : "Refresh"}</button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/8 p-4"><Icon className="h-5 w-5 text-[#F5D46E]" /><strong className="mt-3 block text-2xl"><StarsValue value={Number(value)} /></strong><span className="mt-1 block text-xs font-bold text-white/60">{label}</span></article>)}</div>
        <div className="mt-3 grid grid-cols-3 gap-3"><article className="rounded-2xl bg-white/8 p-4"><strong className="text-2xl">{summary.total}</strong><span className="block text-[10px] text-white/60">{isArabic ? "إجمالي التقييمات" : "Total ratings"}</span></article><article className="rounded-2xl bg-white/8 p-4"><strong className="text-2xl">{summary.fiveStars.toFixed(0)}%</strong><span className="block text-[10px] text-white/60">{isArabic ? "تقييم 5 نجوم" : "Five-star share"}</span></article><article className={`rounded-2xl p-4 ${summary.low ? "bg-red-500/20" : "bg-white/8"}`}><strong className="text-2xl">{summary.low}</strong><span className="block text-[10px] text-white/60">{isArabic ? "تقييمات تحتاج متابعة" : "Low ratings"}</span></article></div>
      </header>

      {error && <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-50 p-4 text-sm font-black text-red-800">{error}</p>}
      {notice && <p className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-sm font-black text-emerald-800">{notice}</p>}
      {loading && !feedback.length && <div className="grid h-48 place-items-center"><Loader2 className="h-10 w-10 animate-spin text-[#0057B8]" /></div>}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <article className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{isArabic ? "كل التقييمات" : "All ratings"}</h2><p className="text-xs text-[#52627A]">{isArabic ? "فلترة حسب صاحب التقييم" : "Filter by rating party"}</p></div><div className="flex flex-wrap gap-2">{(["all","customer","merchant","driver"] as const).map((value) => <button key={value} onClick={() => setRaterFilter(value)} className={`rounded-full px-3 py-2 text-[10px] font-black ${raterFilter === value ? "bg-[#0057B8] text-white" : "bg-[#071A33]/5 text-[#52627A]"}`}>{value === "all" ? (isArabic ? "الكل" : "All") : value === "customer" ? (isArabic ? "العملاء" : "Customers") : value === "merchant" ? (isArabic ? "التجار" : "Merchants") : (isArabic ? "المناديب" : "Drivers")}</button>)}</div></div>
          <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-1">{filtered.map((item) => <article key={item.id} className={`rounded-3xl border p-4 ${Number(item.overall_rating) <= 2 ? "border-red-300 bg-red-50" : "border-[#071A33]/8 bg-[#F8FBFF]"}`}><div className="flex items-start justify-between gap-3"><div><strong className="font-mono text-xs text-[#0057B8]">{item.tracking_number}</strong><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-[#071A33]/6 px-3 py-1 text-[10px] font-black">{item.rater_type || "customer"}</span>{item.driver_rating && <span className="text-xs">{isArabic ? "المندوب" : "Driver"}: <StarsValue value={Number(item.driver_rating)} /></span>}{item.company_rating && <span className="text-xs">{isArabic ? "الشركة" : "Company"}: <StarsValue value={Number(item.company_rating)} /></span>}{item.merchant_rating && <span className="text-xs">{isArabic ? "التاجر" : "Merchant"}: <StarsValue value={Number(item.merchant_rating)} /></span>}{item.customer_cooperation_rating && <span className="text-xs">{isArabic ? "العميل" : "Customer"}: <StarsValue value={Number(item.customer_cooperation_rating)} /></span>}</div><p className="mt-3 text-sm leading-6 text-[#52627A]">{item.comment || (isArabic ? "لا يوجد تعليق نصي." : "No written comment.")}</p></div><span className="rounded-full bg-[#FFF4C5] px-3 py-2"><StarsValue value={Number(item.overall_rating)} /></span></div>{Number(item.overall_rating) <= 2 && <p className="mt-3 inline-flex items-center gap-2 text-xs font-black text-red-700"><ShieldAlert className="h-4 w-4" />{isArabic ? "يحتاج متابعة فورية" : "Requires follow-up"}</p>}</article>)}{!filtered.length && !loading && <p className="rounded-3xl bg-[#F8FBFF] p-10 text-center text-sm text-[#52627A]">{isArabic ? "لا توجد تقييمات في هذا الفلتر." : "No ratings in this filter."}</p>}</div>
        </article>

        <aside className="space-y-5"><article className="rounded-[28px] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black"><Truck className="h-5 w-5 text-[#0057B8]" />{isArabic ? "أفضل المناديب" : "Top drivers"}</h2><div className="mt-4 space-y-2">{driverScores.map((row, index) => <div key={row.id} className="flex items-center justify-between rounded-2xl bg-[#F4F8FF] p-3"><span className="text-xs font-black">{index + 1}. {row.name}<small className="block text-[9px] text-[#52627A]">{row.count} {isArabic ? "تقييم" : "ratings"}</small></span><StarsValue value={row.rating} /></div>)}{!driverScores.length && <p className="text-xs text-[#52627A]">{isArabic ? "لا توجد نتائج بعد." : "No results yet."}</p>}</div></article><article className="rounded-[28px] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black"><Store className="h-5 w-5 text-[#D4AF37]" />{isArabic ? "تقييم شركاء التجار" : "Merchant partner scores"}</h2><div className="mt-4 space-y-2">{merchantScores.map((row, index) => <div key={row.id} className="flex items-center justify-between rounded-2xl bg-[#FFF9E8] p-3"><span className="text-xs font-black">{index + 1}. {row.name}<small className="block text-[9px] text-[#52627A]">{row.count} {isArabic ? "تقييم" : "ratings"}</small></span><StarsValue value={row.rating} /></div>)}{!merchantScores.length && <p className="text-xs text-[#52627A]">{isArabic ? "يظهر بعد تقييم المناديب للتجار." : "Appears after driver-to-merchant ratings."}</p>}</div></article></aside>
      </div>

      <article className="mt-5 rounded-[28px] bg-white p-5 shadow-sm"><div><h2 className="text-xl font-black">{isArabic ? "روابط التقييم المرتبطة بالطلبيات" : "Order-linked rating requests"}</h2><p className="mt-1 text-xs text-[#52627A]">{isArabic ? "أنشئ رابطًا منفصلًا للعميل أو التاجر أو المندوب، ثم انسخه أو أرسله بواتساب." : "Create separate customer, merchant or driver links and copy or send them by WhatsApp."}</p></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-start text-xs"><thead><tr className="border-b border-[#071A33]/10 text-[#52627A]"><th className="p-3">{isArabic ? "الطلب" : "Order"}</th><th className="p-3">{isArabic ? "العميل" : "Customer"}</th><th className="p-3">{isArabic ? "التاجر" : "Merchant"}</th><th className="p-3">{isArabic ? "المندوب" : "Driver"}</th></tr></thead><tbody>{deliveredOrders.map((order) => { const reference = order.tracking_number || order.tracking_code || order.invoice_number || order.id; return <tr key={order.id} className="border-b border-[#071A33]/6"><td className="p-3"><strong className="font-mono text-[#0057B8]">{reference}</strong><small className="block text-[#52627A]">{order.receiver_name || order.customer_name || "—"}</small></td>{(["customer","merchant","driver"] as RatingParty[]).map((party) => <td key={party} className="p-3"><div className="flex gap-2"><button disabled={Boolean(busy)} onClick={() => void makeLink(order, party, "copy")} className="inline-flex items-center gap-1 rounded-xl bg-[#071A33]/6 px-3 py-2 font-black"><ClipboardCopy className="h-4 w-4" />{isArabic ? "نسخ" : "Copy"}</button><button disabled={Boolean(busy)} onClick={() => void makeLink(order, party, "whatsapp")} className="inline-flex items-center gap-1 rounded-xl bg-[#25D366] px-3 py-2 font-black text-white">{busy === `${order.id}:${party}:whatsapp` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}{isArabic ? "واتساب" : "WhatsApp"}</button></div></td>)}</tr>; })}</tbody></table></div>{!deliveredOrders.length && <p className="mt-4 rounded-2xl bg-[#F4F8FF] p-8 text-center text-sm text-[#52627A]">{isArabic ? "لا توجد طلبات مسلّمة لإنشاء روابط لها." : "No delivered orders are available."}</p>}</article>

      <a href="/admin/customer-experience?tab=complaints" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#071A33] px-5 py-3 text-sm font-black text-white"><ExternalLink className="h-4 w-4" />{isArabic ? "فتح مركز الشكاوى والرسائل" : "Open complaints and messages"}</a>
    </section>
  );
}
