import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Languages,
  Loader2,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import localAssets from "../data/localAssets";
import {
  loadFeedbackContext,
  submitOrderFeedback,
  submitPublicComplaint,
  uploadComplaintAttachment,
  type ComplaintCreated,
  type FeedbackContext,
} from "../services/customerExperienceService";
import {
  openPreparedWhatsApp,
  prepareWhatsAppMessage,
} from "../services/whatsappMessageService";

const QUICK_TAGS = [
  ["وصل في الوقت", "Arrived on time"],
  ["المندوب محترم", "Respectful driver"],
  ["التغليف سليم", "Package intact"],
  ["التتبع واضح", "Clear tracking"],
  ["الخدمة سريعة", "Fast service"],
  ["التواصل ممتاز", "Excellent communication"],
  ["حدث تأخير", "Delivery delay"],
  ["صعوبة في التواصل", "Communication difficulty"],
  ["مشكلة في المبلغ", "Amount issue"],
  ["الشحنة تعرضت للتلف", "Shipment damaged"],
] as const;

const COMPLAINT_CATEGORIES = [
  ["driver", "شكوى من المندوب", "Driver complaint"],
  ["delivery_delay", "تأخر التوصيل", "Delivery delay"],
  ["bad_behavior", "سوء تعامل", "Bad behavior"],
  ["incorrect_cod", "مبلغ تحصيل غير صحيح", "Incorrect COD amount"],
  ["damaged_shipment", "تلف الشحنة", "Damaged shipment"],
  ["lost_shipment", "فقدان الشحنة", "Lost shipment"],
  ["wrong_recipient", "تسليم لشخص غير صحيح", "Wrong recipient"],
  ["location_noncompliance", "عدم الالتزام بالموقع", "Location issue"],
  ["tracking_issue", "مشكلة في التتبع", "Tracking issue"],
  ["merchant_issue", "مشكلة مع التاجر", "Merchant issue"],
  ["customer_service", "مشكلة في خدمة العملاء", "Customer service"],
  ["other", "مشكلة أخرى", "Other"],
] as const;

const CRITERIA = [
  ["punctualityRating", "الالتزام بالموعد", "Punctuality"],
  ["communicationRating", "سهولة التواصل", "Communication"],
  ["professionalismRating", "حسن التعامل والمظهر المهني", "Professional conduct"],
  ["packageCareRating", "المحافظة على الشحنة", "Package care"],
  ["trackingExperienceRating", "سهولة التتبع ودقة الوصول", "Tracking and location accuracy"],
] as const;

type CriteriaKey = (typeof CRITERIA)[number][0];

function tokenFromPath() {
  const match = window.location.pathname.match(/^\/(?:feedback|rate)\/([^/]+)/i);
  return decodeURIComponent(match?.[1] || "");
}

function Stars({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          onClick={() => onChange(star)}
          aria-label={`${label}: ${star}`}
          aria-checked={value === star}
          role="radio"
          className="rounded-xl p-1.5 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
        >
          <Star className={`h-7 w-7 ${star <= value ? "fill-[#D4AF37] text-[#D4AF37]" : "text-[#A8B3C5]"}`} />
        </button>
      ))}
    </div>
  );
}

function ratingMeaning(value: number, isArabic: boolean) {
  const ar = ["", "سيئة جدًا", "تحتاج إلى تحسين", "جيدة", "جيدة جدًا", "ممتازة"];
  const en = ["", "Very poor", "Needs improvement", "Good", "Very good", "Excellent"];
  return (isArabic ? ar : en)[value] || "";
}

export default function FeedbackPage() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const token = useMemo(tokenFromPath, []);
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [companyRating, setCompanyRating] = useState(0);
  const [criteria, setCriteria] = useState<Record<CriteriaKey, number>>({
    punctualityRating: 0,
    communicationRating: 0,
    professionalismRating: 0,
    packageCareRating: 0,
    trackingExperienceRating: 0,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [requestContact, setRequestContact] = useState(false);
  const [allowPublicDisplay, setAllowPublicDisplay] = useState(false);

  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState("driver");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [description, setDescription] = useState("");
  const [preferredContactTime, setPreferredContactTime] = useState("");
  const [complaintContact, setComplaintContact] = useState(true);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [complaintCreated, setComplaintCreated] = useState<ComplaintCreated | null>(null);
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [isArabic]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadFeedbackContext(token)
      .then((data) => active && setContext(data))
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "feedback_token_invalid_or_expired";
        setLoadError(message);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  async function submitFeedback() {
    setFormError("");
    if (!overallRating || !driverRating || !companyRating) {
      setFormError(isArabic ? "اختر التقييم العام وتقييم المندوب والشركة أولًا." : "Select the overall, driver, and company ratings first.");
      return;
    }
    setSubmitting(true);
    try {
      await submitOrderFeedback(token, {
        overallRating,
        driverRating,
        companyRating,
        punctualityRating: criteria.punctualityRating || driverRating,
        communicationRating: criteria.communicationRating || driverRating,
        professionalismRating: criteria.professionalismRating || driverRating,
        packageCareRating: criteria.packageCareRating || driverRating,
        trackingExperienceRating: criteria.trackingExperienceRating || companyRating,
        selectedTags: tags,
        comment: comment.trim(),
        allowPublicDisplay,
        requestContact,
      });
      setSuccess(true);
    } catch (error) {
      setFormError(isArabic ? "تعذر حفظ التقييم الآن. تحقق من الرابط وحاول مجددًا." : "The feedback could not be saved. Verify the link and try again.");
      console.warn("Feedback submission failed", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComplaint() {
    setFormError("");
    if (description.trim().length < 10) {
      setFormError(isArabic ? "اكتب وصفًا واضحًا للمشكلة لا يقل عن 10 أحرف." : "Describe the problem in at least 10 characters.");
      return;
    }
    setComplaintBusy(true);
    try {
      const created = await submitPublicComplaint(token, {
        category: complaintCategory,
        severity,
        description: description.trim(),
        preferredContactTime: preferredContactTime.trim() || undefined,
        requestContact: complaintContact,
      });
      if (attachment) await uploadComplaintAttachment(created, attachment);
      setComplaintCreated(created);
    } catch (error) {
      const code = error instanceof Error ? error.message : "complaint_creation_failed";
      setFormError(
        isArabic
          ? code.includes("rate_limited") ? "تم تسجيل شكوى مشابهة منذ لحظات. انتظر قليلًا قبل إعادة المحاولة." : "تعذر إرسال الشكوى. راجع البيانات ونوع المرفق وحاول مجددًا."
          : code.includes("rate_limited") ? "A similar complaint was submitted moments ago. Please wait before retrying." : "The complaint could not be submitted. Check the details and attachment.",
      );
    } finally {
      setComplaintBusy(false);
    }
  }

  async function openComplaintWhatsApp() {
    if (!complaintCreated) return;
    try {
      const prepared = await prepareWhatsAppMessage({
        messageType: "complaint_support",
        complaintNumber: complaintCreated.complaint_number,
        locale: isArabic ? "ar" : "en",
        metadata: { surface: "feedback_complaint_success" },
      });
      await openPreparedWhatsApp(prepared);
    } catch {
      setFormError(isArabic ? "تعذر فتح واتساب. رقم الشكوى محفوظ ويمكن استخدامه للتواصل." : "WhatsApp could not be opened. Keep the complaint number for support.");
    }
  }

  if (loading) {
    return <div className="min-h-dvh bg-[#071A33] flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" /></div>;
  }

  if (loadError || !context) {
    return (
      <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#123b73_0,#071A33_48%,#041124_100%)] px-4 py-10 text-white" dir={isArabic ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-lg rounded-[32px] border border-white/10 bg-white/8 p-7 text-center shadow-2xl backdrop-blur-xl">
          <img src={localAssets.logo} alt="DAY NIGHT" className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-[#D4AF37]/30" />
          <AlertTriangle className="mx-auto mt-6 h-12 w-12 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">{isArabic ? "رابط التقييم غير صالح" : "Invalid feedback link"}</h1>
          <p className="mt-3 text-sm leading-7 text-white/70">{isArabic ? "قد يكون الرابط منتهي الصلاحية أو غير مكتمل. تواصل مع خدمة العملاء للحصول على المساعدة." : "The link may be expired or incomplete. Contact customer support for assistance."}</p>
          <button onClick={toggleLanguage} className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-5 py-3 text-sm font-black text-[#F5D46E]"><Languages className="h-4 w-4" />{isArabic ? "English" : "العربية"}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_15%_0%,#1457a4_0,#071A33_43%,#041124_100%)] px-3 py-6 text-white sm:px-5 sm:py-10" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-4xl">
        <header className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/8 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="absolute -end-20 -top-24 h-64 w-64 rounded-full bg-[#0057B8]/40 blur-3xl" />
          <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start">
            <img src={localAssets.logo} alt="DAY NIGHT" className="h-24 w-24 rounded-full object-cover ring-4 ring-[#D4AF37]/35 shadow-xl" />
            <div className="flex-1">
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#F5D46E]">DAY NIGHT DELIVERY SERVICES</span>
              <h1 className="mt-2 text-2xl font-black sm:text-4xl">{isArabic ? "كيف كانت تجربتك مع داي نايت؟" : "How was your DAY NIGHT experience?"}</h1>
              <p className="mt-2 text-sm leading-7 text-white/70">{isArabic ? "رأيك يساعدنا على تحسين الخدمة، ويصل مباشرة إلى إدارة الشركة." : "Your feedback helps improve our service and reaches management directly."}</p>
            </div>
            <button onClick={toggleLanguage} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-2.5 text-xs font-black"><Languages className="h-4 w-4" />{isArabic ? "English" : "العربية"}</button>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [isArabic ? "رقم الشحنة" : "Tracking", context.tracking_number],
              [isArabic ? "تاريخ التسليم" : "Delivered", context.delivered_at ? new Date(context.delivered_at).toLocaleDateString(isArabic ? "ar-AE" : "en-AE") : "—"],
              [isArabic ? "الخدمة" : "Service", context.service_type || "Delivery"],
              [isArabic ? "المندوب" : "Driver", String(context.driver_name || "DAY NIGHT").split(" ")[0]],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-[#071A33]/50 p-3">
                <small className="block text-[10px] font-bold text-white/50">{label}</small>
                <strong className="mt-1 block break-words text-sm text-white">{value}</strong>
              </div>
            ))}
          </div>
        </header>

        {success ? (
          <section className="mt-5 rounded-[32px] border border-emerald-300/20 bg-emerald-400/10 p-7 text-center shadow-2xl backdrop-blur-xl">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-300" />
            <h2 className="mt-4 text-2xl font-black">{isArabic ? "شكرًا لتقييمك" : "Thank you for your feedback"}</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">{isArabic ? "تم حفظ تقييمك بنجاح وإرساله إلى إدارة داي نايت." : "Your feedback was saved and sent to DAY NIGHT management."}</p>
            <button onClick={() => setComplaintOpen(true)} className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-200">{isArabic ? "لدي شكوى أو مشكلة" : "I have a complaint"}</button>
          </section>
        ) : (
          <section className="mt-5 space-y-5 rounded-[32px] border border-white/10 bg-white/95 p-5 text-[#071A33] shadow-2xl sm:p-8">
            <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#FFF9E8] p-5 text-center">
              <h2 className="text-xl font-black">{isArabic ? "التقييم العام" : "Overall rating"}</h2>
              <div className="mt-3 flex justify-center"><Stars value={overallRating} onChange={setOverallRating} label={isArabic ? "التقييم العام" : "Overall rating"} /></div>
              <strong className="mt-2 block text-sm text-[#9A6F00]">{ratingMeaning(overallRating, isArabic)}</strong>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-[#0057B8]/15 bg-[#F4F8FF] p-4">
                <h3 className="font-black">{isArabic ? "تقييم المندوب" : "Driver rating"}</h3>
                <Stars value={driverRating} onChange={setDriverRating} label={isArabic ? "تقييم المندوب" : "Driver rating"} />
              </div>
              <div className="rounded-3xl border border-[#0057B8]/15 bg-[#F4F8FF] p-4">
                <h3 className="font-black">{isArabic ? "تقييم الشركة" : "Company rating"}</h3>
                <Stars value={companyRating} onChange={setCompanyRating} label={isArabic ? "تقييم الشركة" : "Company rating"} />
              </div>
            </div>

            <div className="rounded-3xl border border-[#071A33]/10 p-4 sm:p-5">
              <h3 className="font-black">{isArabic ? "تفاصيل التجربة" : "Experience details"}</h3>
              <div className="mt-4 divide-y divide-[#071A33]/8">
                {CRITERIA.map(([key, ar, en]) => (
                  <div key={key} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                    <span className="text-sm font-bold">{isArabic ? ar : en}</span>
                    <Stars value={criteria[key]} onChange={(value) => setCriteria((current) => ({ ...current, [key]: value }))} label={isArabic ? ar : en} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-black">{isArabic ? "اختيارات سريعة" : "Quick tags"}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_TAGS.map(([ar, en]) => {
                  const value = isArabic ? ar : en;
                  const active = tags.includes(value);
                  return <button type="button" key={ar} onClick={() => toggleTag(value)} className={`rounded-full border px-3 py-2 text-xs font-black transition ${active ? "border-[#0057B8] bg-[#0057B8] text-white" : "border-[#071A33]/12 bg-[#F7F9FC] text-[#52627A]"}`}>{value}</button>;
                })}
              </div>
            </div>

            <label className="block font-black">
              {isArabic ? "أخبرنا بالمزيد عن تجربتك" : "Tell us more about your experience"}
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-2xl border border-[#071A33]/15 bg-[#F7F9FC] p-4 text-sm font-medium leading-7 outline-none focus:border-[#0057B8]" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-[#071A33]/10 bg-[#F7F9FC] p-4 text-sm font-bold">
                <input type="checkbox" checked={requestContact} onChange={(event) => setRequestContact(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>{isArabic ? "أرغب في أن تتواصل الإدارة معي." : "I would like management to contact me."}</span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[#071A33]/10 bg-[#F7F9FC] p-4 text-sm font-bold">
                <input type="checkbox" checked={allowPublicDisplay} onChange={(event) => setAllowPublicDisplay(event.target.checked)} className="mt-1 h-4 w-4" />
                <span>{isArabic ? "أوافق على عرض تقييمي دون رقم الهاتف أو البيانات الشخصية." : "Allow public display without personal information."}</span>
              </label>
            </div>

            {formError && <p className="rounded-2xl border border-red-500/20 bg-red-50 p-3 text-sm font-bold text-red-800">{formError}</p>}

            <button type="button" disabled={submitting} onClick={() => void submitFeedback()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0057B8] to-[#007BFF] px-5 py-4 text-base font-black text-white shadow-xl disabled:opacity-60">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Star className="h-5 w-5" />}
              {isArabic ? "إرسال التقييم" : "Submit feedback"}
            </button>
          </section>
        )}

        <section className="mt-5 overflow-hidden rounded-[32px] border border-amber-300/20 bg-[#1A2538]/90 shadow-2xl backdrop-blur-xl">
          <button type="button" onClick={() => setComplaintOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-5 text-start sm:p-6">
            <span className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-amber-300" /><span><strong className="block text-lg">{isArabic ? "لدي شكوى أو مشكلة" : "I have a complaint or problem"}</strong><small className="mt-1 block text-white/55">{isArabic ? "تصل مباشرة إلى إدارة داي نايت" : "Sent directly to DAY NIGHT management"}</small></span></span>
            <ChevronDown className={`h-5 w-5 transition ${complaintOpen ? "rotate-180" : ""}`} />
          </button>

          {complaintOpen && (
            <div className="border-t border-white/10 p-5 sm:p-6">
              {complaintCreated ? (
                <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
                  <h3 className="mt-4 text-xl font-black">{isArabic ? "تم استلام شكواك بنجاح" : "Complaint received successfully"}</h3>
                  <p className="mt-3 text-sm text-white/70">{isArabic ? "رقم الشكوى:" : "Complaint number:"}</p>
                  <strong className="mt-1 block font-mono text-xl text-[#F5D46E]" dir="ltr">{complaintCreated.complaint_number}</strong>
                  <p className="mt-3 text-sm leading-7 text-white/70">{isArabic ? "ستراجعها إدارة داي نايت وتتواصل معك عند الحاجة." : "DAY NIGHT management will review it and contact you when needed."}</p>
                  <button onClick={() => void openComplaintWhatsApp()} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-black text-[#071A33]"><MessageCircle className="h-5 w-5" />{isArabic ? "فتح واتساب برقم الشكوى" : "Open WhatsApp with complaint number"}</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-black">{isArabic ? "نوع الشكوى" : "Complaint type"}<select value={complaintCategory} onChange={(event) => setComplaintCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#071A33] p-3 text-white outline-none">{COMPLAINT_CATEGORIES.map(([value, ar, en]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}</select></label>
                    <label className="text-sm font-black">{isArabic ? "درجة الخطورة" : "Severity"}<select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#071A33] p-3 text-white outline-none"><option value="low">{isArabic ? "منخفضة" : "Low"}</option><option value="medium">{isArabic ? "متوسطة" : "Medium"}</option><option value="high">{isArabic ? "مرتفعة" : "High"}</option><option value="critical">{isArabic ? "حرجة" : "Critical"}</option></select></label>
                  </div>

                  <label className="block text-sm font-black">{isArabic ? "وصف المشكلة" : "Problem description"}<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={5} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#071A33]/80 p-4 text-white outline-none placeholder:text-white/30" placeholder={isArabic ? "اكتب ما حدث بوضوح، مع الوقت أو التفاصيل المهمة." : "Explain what happened, including time and relevant details."} /></label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-black">{isArabic ? "الوقت المناسب للتواصل" : "Preferred contact time"}<input value={preferredContactTime} onChange={(event) => setPreferredContactTime(event.target.value)} maxLength={120} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#071A33] p-3 text-white outline-none" placeholder={isArabic ? "مثال: بعد الساعة 6 مساءً" : "Example: after 6 PM"} /></label>
                    <label className="text-sm font-black">{isArabic ? "إرفاق صورة أو PDF" : "Attach image or PDF"}<span className="mt-2 flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/70"><FileUp className="h-5 w-5 text-[#F5D46E]" />{attachment ? attachment.name : (isArabic ? "JPEG / PNG / WEBP / PDF — بحد أقصى 8MB" : "JPEG / PNG / WEBP / PDF — max 8MB")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></span></label>
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold"><input type="checkbox" checked={complaintContact} onChange={(event) => setComplaintContact(event.target.checked)} className="mt-1 h-4 w-4" /><span>{isArabic ? `أطلب اتصالًا من الإدارة على الرقم المسجل ${context.masked_phone || ""}` : `Request a management call on the saved number ${context.masked_phone || ""}`}</span></label>

                  {formError && <p className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm font-bold text-red-100">{formError}</p>}
                  <button type="button" disabled={complaintBusy} onClick={() => void submitComplaint()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-[#D4AF37] px-5 py-4 text-base font-black text-[#071A33] disabled:opacity-60">{complaintBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}{isArabic ? "إرسال الشكوى إلى الإدارة" : "Submit complaint to management"}</button>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="py-7 text-center text-xs leading-6 text-white/45"><PackageCheck className="mx-auto mb-2 h-5 w-5 text-[#D4AF37]" />DAY NIGHT DELIVERY SERVICES<br />Fast • Reliable • Every Time</footer>
      </div>
    </main>
  );
}
