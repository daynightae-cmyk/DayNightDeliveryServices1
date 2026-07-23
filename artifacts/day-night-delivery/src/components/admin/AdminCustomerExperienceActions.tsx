import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Eye,
  EyeOff,
  FileWarning,
  History,
  Loader2,
  MessageSquareWarning,
  ShieldBan,
  Star,
  X,
} from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import {
  convertFeedbackToComplaint,
  loadAdminCustomerExperience,
  loadComplaintDetails,
  setFeedbackReview,
  subscribeCustomerExperience,
  suspendDriverForComplaint,
} from "../../services/customerExperienceService";

type Mode = "feedback" | "complaints";

function safeDate(value: string | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function AdminCustomerExperienceActions() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const locale = isArabic ? "ar-AE" : "en-AE";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("feedback");
  const [feedback, setFeedback] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [details, setDetails] = useState<any | null>(null);
  const [suspendNote, setSuspendNote] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadAdminCustomerExperience();
      setFeedback(data.feedback || []);
      setComplaints(data.complaints || []);
    } catch {
      setError(isArabic ? "تعذر تحميل إجراءات تجربة العملاء." : "Customer Experience actions could not load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    return subscribeCustomerExperience(() => void refresh());
  }, []);

  const critical = useMemo(() => complaints.filter((item) => item.severity === "critical" && !["resolved", "closed", "rejected"].includes(item.status)).length, [complaints]);

  async function reviewFeedback(item: any, status: "reviewed" | "published" | "hidden") {
    setBusy(`${item.id}:${status}`);
    setError("");
    try {
      await setFeedbackReview({ feedbackId: item.id, reviewStatus: status, allowPublicDisplay: status === "published" });
      await refresh();
    } catch {
      setError(isArabic ? "تعذر تحديث حالة التقييم." : "Feedback review update failed.");
    } finally {
      setBusy("");
    }
  }

  async function convert(item: any) {
    setBusy(`${item.id}:convert`);
    setError("");
    try {
      const created = await convertFeedbackToComplaint(item.id, Number(item.overall_rating) <= 2 ? "high" : "medium");
      await refresh();
      setMode("complaints");
      if (created?.id) setDetails(await loadComplaintDetails(created.id));
    } catch {
      setError(isArabic ? "تعذر تحويل التقييم إلى شكوى." : "Feedback could not be converted to a complaint.");
    } finally {
      setBusy("");
    }
  }

  async function openComplaint(item: any) {
    setBusy(`${item.id}:details`);
    setError("");
    try {
      setDetails(await loadComplaintDetails(item.id));
    } catch {
      setError(isArabic ? "تعذر تحميل السجل الكامل للشكوى." : "The complete complaint record could not load.");
    } finally {
      setBusy("");
    }
  }

  async function suspendDriver() {
    const complaint = details?.complaint;
    if (!complaint?.id || !complaint.driver_id) return;
    if (!window.confirm(isArabic ? "سيتم إيقاف المندوب مؤقتًا وتسجيل الإجراء في التدقيق. هل تريد المتابعة؟" : "The driver will be suspended and the action audited. Continue?")) return;
    setBusy(`${complaint.id}:suspend`);
    try {
      await suspendDriverForComplaint(complaint.id, suspendNote.trim() || `Complaint ${complaint.complaint_number}`);
      setDetails(await loadComplaintDetails(complaint.id));
      setSuspendNote("");
    } catch {
      setError(isArabic ? "تعذر إيقاف المندوب. راجع الصلاحيات وحالة الملف." : "Driver suspension failed. Check permissions and profile status.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 start-4 z-[92000] flex min-h-14 items-center gap-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#F5D46E] px-4 py-3 text-[#071A33] shadow-[0_20px_60px_rgba(7,26,51,0.35)]"
      >
        <span className="relative"><MessageSquareWarning className="h-6 w-6" />{critical > 0 && <b className="absolute -end-3 -top-3 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] text-white">{critical}</b>}</span>
        <span className="text-start"><strong className="block text-xs">{isArabic ? "إجراءات متقدمة" : "Advanced actions"}</strong><small className="text-[10px] opacity-65">{isArabic ? "النشر والتحويل والتصعيد" : "Publish, convert, escalate"}</small></span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100100] flex justify-start bg-[#071A33]/75 backdrop-blur-sm" dir={isArabic ? "rtl" : "ltr"}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#F4F8FF] p-4 shadow-2xl sm:p-6">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-3xl bg-[#071A33] p-5 text-white shadow-xl">
              <div><span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F5D46E]">AUDITED ACTIONS</span><h2 className="mt-1 text-xl font-black">{isArabic ? "إجراءات تجربة العملاء" : "Customer Experience actions"}</h2></div>
              <button onClick={() => { setOpen(false); setDetails(null); }} className="rounded-full bg-white/10 p-2"><X className="h-5 w-5" /></button>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => { setMode("feedback"); setDetails(null); }} className={`rounded-2xl p-3 text-xs font-black ${mode === "feedback" ? "bg-[#0057B8] text-white" : "bg-white text-[#52627A]"}`}><Star className="mx-auto mb-1 h-5 w-5" />{isArabic ? "مراجعة التقييمات" : "Review feedback"}</button>
              <button onClick={() => { setMode("complaints"); setDetails(null); }} className={`rounded-2xl p-3 text-xs font-black ${mode === "complaints" ? "bg-red-600 text-white" : "bg-white text-[#52627A]"}`}><AlertOctagon className="mx-auto mb-1 h-5 w-5" />{isArabic ? "التصعيد والشكاوى" : "Escalation and complaints"}</button>
            </div>

            {error && <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
            {loading && <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0057B8]" /></div>}

            {!details && mode === "feedback" && <div className="mt-4 space-y-3">{feedback.map((item) => <article key={item.id} className="rounded-3xl border border-[#071A33]/8 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-xs font-black text-[#0057B8]">{item.tracking_number}</span><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#52627A]">{item.comment || (isArabic ? "لا يوجد تعليق نصي." : "No written comment.")}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7D8] px-3 py-1 text-xs font-black text-[#8A6400]"><Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />{item.overall_rating}</span></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#071A33]/6 px-3 py-1 text-[10px] font-black">{item.review_status || "new"}</span><button disabled={busy.startsWith(item.id)} onClick={() => void reviewFeedback(item, "published")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white"><Eye className="h-4 w-4" />{isArabic ? "نشر مجهّل" : "Publish"}</button><button disabled={busy.startsWith(item.id)} onClick={() => void reviewFeedback(item, "hidden")} className="inline-flex items-center gap-1 rounded-xl bg-[#52627A] px-3 py-2 text-[11px] font-black text-white"><EyeOff className="h-4 w-4" />{isArabic ? "إخفاء" : "Hide"}</button><button disabled={busy.startsWith(item.id)} onClick={() => void convert(item)} className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-[11px] font-black text-white"><FileWarning className="h-4 w-4" />{isArabic ? "تحويل إلى شكوى" : "Convert"}</button></div></article>)}{!feedback.length && <p className="rounded-3xl bg-white p-8 text-center text-sm text-[#52627A]">{isArabic ? "لا توجد تقييمات." : "No feedback."}</p>}</div>}

            {!details && mode === "complaints" && <div className="mt-4 space-y-3">{[...complaints].sort((a,b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0)).map((item) => <button type="button" onClick={() => void openComplaint(item)} key={item.id} className={`w-full rounded-3xl border p-4 text-start shadow-sm ${item.severity === "critical" ? "border-red-500 bg-red-50" : "border-[#071A33]/8 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-xs font-black text-[#0057B8]">{item.complaint_number}</span><h3 className="mt-1 font-black">{item.tracking_number} · {item.category}</h3><p className="mt-1 line-clamp-2 text-xs leading-6 text-[#52627A]">{item.description}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${item.severity === "critical" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800"}`}>{item.severity}</span></div></button>)}</div>}

            {details && <div className="mt-4 space-y-4"><button onClick={() => setDetails(null)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#0057B8]">← {isArabic ? "العودة للقائمة" : "Back"}</button><article className="rounded-3xl border border-[#071A33]/8 bg-white p-5"><span className="font-mono text-xs font-black text-[#0057B8]">{details.complaint.complaint_number}</span><h3 className="mt-1 text-lg font-black">{details.complaint.tracking_number} · {details.complaint.category}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#52627A]">{details.complaint.description}</p></article><section className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl bg-white p-4"><small className="text-[#52627A]">{isArabic ? "العميل" : "Customer"}</small><strong className="mt-1 block">{details.order?.receiver_name || details.order?.customer_name || "—"}</strong><span className="mt-1 block text-xs" dir="ltr">{details.order?.receiver_phone || details.order?.customer_phone || "—"}</span></article><article className="rounded-2xl bg-white p-4"><small className="text-[#52627A]">{isArabic ? "المندوب" : "Driver"}</small><strong className="mt-1 block">{details.driver?.full_name || details.order?.driver_name || "—"}</strong><span className="mt-1 block text-xs" dir="ltr">{details.driver?.phone || details.order?.driver_phone || "—"}</span></article><article className="rounded-2xl bg-white p-4"><small className="text-[#52627A]">{isArabic ? "التاجر" : "Merchant"}</small><strong className="mt-1 block">{details.merchant?.trade_name || details.order?.merchant_name || "—"}</strong><span className="mt-1 block text-xs" dir="ltr">{details.merchant?.phone || "—"}</span></article></section>{details.complaint.driver_id && <section className="rounded-3xl border border-red-500/20 bg-red-50 p-4"><h3 className="flex items-center gap-2 font-black text-red-900"><ShieldBan className="h-5 w-5" />{isArabic ? "إيقاف المندوب مؤقتًا" : "Suspend driver"}</h3><textarea value={suspendNote} onChange={(event) => setSuspendNote(event.target.value)} rows={2} className="mt-3 w-full rounded-2xl border border-red-500/20 bg-white p-3 text-sm" placeholder={isArabic ? "سبب الإيقاف وملاحظات القرار" : "Suspension reason and decision notes"} /><button disabled={busy.endsWith(":suspend")} onClick={() => void suspendDriver()} className="mt-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white">{isArabic ? "تنفيذ الإيقاف وتسجيله" : "Suspend and audit"}</button></section>}<section className="rounded-3xl bg-white p-4"><h3 className="flex items-center gap-2 font-black"><History className="h-5 w-5 text-[#0057B8]" />{isArabic ? "التسلسل الزمني للطلب" : "Order timeline"}</h3><div className="mt-3 space-y-2">{details.orderHistory.map((event:any) => <div key={event.id} className="rounded-2xl bg-[#F4F8FF] p-3 text-xs"><div className="flex justify-between gap-3"><strong>{event.status || event.new_status || event.event_type || "status"}</strong><span className="text-[#52627A]">{safeDate(event.created_at, locale)}</span></div><p className="mt-1 text-[#52627A]">{event.note || "—"}</p></div>)}{!details.orderHistory.length && <p className="text-xs text-[#52627A]">{isArabic ? "لا يوجد سجل حالة متاح." : "No status history available."}</p>}</div></section><section className="rounded-3xl bg-white p-4"><h3 className="font-black">{isArabic ? "محاولات التواصل" : "Contact attempts"}</h3><div className="mt-3 space-y-2">{details.contactAttempts.map((attempt:any) => <div key={attempt.id} className="rounded-2xl bg-[#F4F8FF] p-3 text-xs"><div className="flex justify-between"><strong>{attempt.attempt_type} · {attempt.result}</strong><span>{safeDate(attempt.created_at, locale)}</span></div><p className="mt-1 text-[#52627A]">{attempt.note || "—"}</p></div>)}{!details.contactAttempts.length && <p className="text-xs text-[#52627A]">{isArabic ? "لا توجد محاولات مسجلة." : "No contact attempts recorded."}</p>}</div></section><section className="rounded-3xl bg-white p-4"><h3 className="font-black">{isArabic ? "أحداث الشكوى" : "Complaint events"}</h3><div className="mt-3 space-y-2">{details.events.map((event:any) => <div key={event.id} className="rounded-2xl border border-[#071A33]/8 p-3 text-xs"><div className="flex justify-between"><strong>{event.event_type}</strong><span>{safeDate(event.created_at, locale)}</span></div><p className="mt-1 text-[#52627A]">{event.old_status || "—"} → {event.new_status || "—"} {event.note ? `· ${event.note}` : ""}</p></div>)}</div></section></div>}
          </div>
        </div>
      )}
    </>
  );
}
