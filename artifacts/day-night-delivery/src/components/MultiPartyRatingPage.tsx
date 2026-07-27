import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Languages, Loader2, MessageSquareText, ShieldCheck, Star } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import localAssets from "../data/localAssets";
import FeedbackPage from "./FeedbackPage";
import {
  loadMultiPartyRatingContext,
  ratingTokenFromPath,
  submitMultiPartyRating,
  type MultiPartyRatingContext,
} from "../services/multiPartyRatingsService";

const TAGS = [
  ["التعامل ممتاز", "Excellent conduct"],
  ["التواصل واضح", "Clear communication"],
  ["الالتزام بالوقت", "On-time service"],
  ["الإجراءات سهلة", "Easy process"],
  ["تعاون ممتاز", "Excellent cooperation"],
  ["يحتاج تحسين", "Needs improvement"],
] as const;

function Stars({ value, label, onChange }: { value: number; label: string; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${label}: ${star}`}
          key={star}
          onClick={() => onChange(star)}
          className="rounded-xl p-1.5 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
        >
          <Star className={`h-8 w-8 ${star <= value ? "fill-[#D4AF37] text-[#D4AF37]" : "text-white/25"}`} />
        </button>
      ))}
    </div>
  );
}

function partyTitle(context: MultiPartyRatingContext, isArabic: boolean) {
  if (context.rater_type === "merchant") return isArabic ? "تقييم شريكنا التاجر" : "Merchant partner rating";
  if (context.rater_type === "driver") return isArabic ? "تقييم المندوب للتجربة" : "Driver experience rating";
  return isArabic ? "تقييم العميل" : "Customer rating";
}

export default function MultiPartyRatingPage() {
  const { language, toggleLanguage } = useAppContext();
  const isArabic = language === "ar";
  const token = useMemo(ratingTokenFromPath, []);
  const [context, setContext] = useState<MultiPartyRatingContext | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overall, setOverall] = useState(0);
  const [company, setCompany] = useState(0);
  const [driver, setDriver] = useState(0);
  const [merchant, setMerchant] = useState(0);
  const [customer, setCustomer] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [requestContact, setRequestContact] = useState(false);

  useEffect(() => {
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [isArabic]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadMultiPartyRatingContext(token)
      .then((value) => {
        if (!active) return;
        setContext(value);
      })
      .catch((cause) => {
        if (!active) return;
        const message = String((cause as any)?.message || "");
        if (message.includes("get_experience_rating_context") || message.includes("function") || message.includes("schema cache")) {
          setLegacy(true);
        } else {
          setError(isArabic ? "رابط التقييم غير صالح أو منتهي الصلاحية." : "The rating link is invalid or expired.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isArabic, token]);

  if (legacy) return <FeedbackPage />;
  if (context?.rater_type === "customer" && context.can_submit) return <FeedbackPage />;

  async function submit() {
    if (!context) return;
    setError("");
    const needsDriver = Boolean(context.targets?.driver);
    const needsMerchant = Boolean(context.targets?.merchant);
    const needsCustomer = Boolean(context.targets?.customer);
    if (!overall || !company || (needsDriver && !driver) || (needsMerchant && !merchant) || (needsCustomer && !customer)) {
      setError(isArabic ? "أكمل جميع التقييمات المطلوبة أولًا." : "Complete all required ratings first.");
      return;
    }
    setSubmitting(true);
    try {
      await submitMultiPartyRating(token, {
        overallRating: overall,
        companyRating: company,
        driverRating: needsDriver ? driver : undefined,
        merchantRating: needsMerchant ? merchant : undefined,
        customerCooperationRating: needsCustomer ? customer : undefined,
        punctualityRating: driver || overall,
        communicationRating: driver || merchant || customer || overall,
        professionalismRating: driver || merchant || overall,
        packageCareRating: driver || overall,
        trackingExperienceRating: company || overall,
        selectedTags: tags,
        comment,
        requestContact,
      });
      setSuccess(true);
    } catch (cause) {
      console.warn("Multi-party rating submission failed", cause);
      setError(isArabic ? "تعذر حفظ التقييم الآن. تحقق من الرابط وحاول مجددًا." : "The rating could not be saved. Verify the link and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center bg-[#071A33]"><Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" /></div>;
  }

  if (error && !context) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top,#174d91_0,#071A33_52%,#031024_100%)] p-4 text-white" dir={isArabic ? "rtl" : "ltr"}>
        <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-white/8 p-8 text-center shadow-2xl backdrop-blur-xl">
          <img src={localAssets.logo} alt="DAY NIGHT" className="mx-auto h-24 w-24 rounded-full ring-4 ring-[#D4AF37]/30" />
          <ShieldCheck className="mx-auto mt-5 h-12 w-12 text-[#D4AF37]" />
          <h1 className="mt-4 text-2xl font-black">{isArabic ? "رابط تقييم آمن" : "Secure rating link"}</h1>
          <p className="mt-3 text-sm leading-7 text-white/65">{error}</p>
          <button onClick={toggleLanguage} className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/30 px-5 py-3 text-sm font-black text-[#F5D46E]"><Languages className="h-4 w-4" />{isArabic ? "English" : "العربية"}</button>
        </div>
      </main>
    );
  }

  if (!context) return null;

  if (!context.can_submit) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top,#174d91_0,#071A33_52%,#031024_100%)] p-4 text-white" dir={isArabic ? "rtl" : "ltr"}>
        <div className="w-full max-w-xl rounded-[34px] border border-white/10 bg-white/8 p-8 text-center shadow-2xl backdrop-blur-xl">
          <img src={localAssets.logo} alt="DAY NIGHT" className="mx-auto h-24 w-24 rounded-full ring-4 ring-[#D4AF37]/30" />
          <Clock3 className="mx-auto mt-5 h-12 w-12 text-[#38BDF8]" />
          <h1 className="mt-4 text-2xl font-black">{isArabic ? "رابط التقييم جاهز" : "Rating link is ready"}</h1>
          <p className="mt-3 text-sm leading-7 text-white/70">
            {isArabic
              ? `يمكن استخدام الرابط بعد اكتمال تسليم الطلب ${context.tracking_number}. احتفظ بالرسالة وافتح الرابط بعد التسليم.`
              : `This link becomes active after shipment ${context.tracking_number} is delivered. Keep the message and open it after delivery.`}
          </p>
          <button onClick={toggleLanguage} className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/30 px-5 py-3 text-sm font-black text-[#F5D46E]"><Languages className="h-4 w-4" />{isArabic ? "English" : "العربية"}</button>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top,#174d91_0,#071A33_52%,#031024_100%)] p-4 text-white" dir={isArabic ? "rtl" : "ltr"}>
        <div className="w-full max-w-lg rounded-[34px] border border-emerald-400/20 bg-white/8 p-8 text-center shadow-2xl backdrop-blur-xl">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-300" />
          <h1 className="mt-4 text-3xl font-black">{isArabic ? "تم تسجيل تقييمك" : "Your rating was recorded"}</h1>
          <p className="mt-3 text-sm leading-7 text-white/70">{isArabic ? "شكرًا لمساعدتنا على تطوير خدمة داي نايت والمندوبين وشركائنا." : "Thank you for helping DAY NIGHT improve its service, drivers, and partners."}</p>
        </div>
      </main>
    );
  }

  const cards: Array<[string, number, (value: number) => void]> = [
    [isArabic ? "التقييم العام" : "Overall experience", overall, setOverall],
    [isArabic ? "تقييم شركة داي نايت" : "DAY NIGHT company rating", company, setCompany],
  ];
  if (context.targets?.driver) cards.push([isArabic ? `تقييم المندوب - ${context.driver_name || ""}` : `Driver rating - ${context.driver_name || ""}`, driver, setDriver]);
  if (context.targets?.merchant) cards.push([isArabic ? `تقييم التاجر - ${context.merchant_name || ""}` : `Merchant rating - ${context.merchant_name || ""}`, merchant, setMerchant]);
  if (context.targets?.customer) cards.push([isArabic ? "تعاون العميل أثناء التسليم" : "Customer cooperation", customer, setCustomer]);

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_15%_0%,#1457a4_0,#071A33_44%,#031024_100%)] px-3 py-6 text-white sm:px-5 sm:py-10" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-4xl">
        <header className="rounded-[34px] border border-white/10 bg-white/8 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={localAssets.logo} alt="DAY NIGHT" className="h-20 w-20 rounded-full ring-4 ring-[#D4AF37]/30" />
              <div><span className="text-[10px] font-black tracking-[0.2em] text-[#F5D46E]">DAY NIGHT RATINGS</span><h1 className="mt-1 text-2xl font-black sm:text-3xl">{partyTitle(context, isArabic)}</h1><p className="mt-2 text-sm text-white/65">{context.tracking_number}</p></div>
            </div>
            <button onClick={toggleLanguage} className="rounded-2xl border border-white/15 p-3"><Languages className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/8 p-4 text-sm leading-7 text-white/75">
            <ShieldCheck className="mb-2 h-5 w-5 text-[#38BDF8]" />
            {isArabic ? "يُحفظ كل تقييم حسب صاحب التقييم والطلب، ويظهر للإدارة في قسم التقييمات دون كشف بيانات حساسة للأطراف الأخرى." : "Each rating is stored by rater and order, then shown to administration without exposing sensitive data to other parties."}
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {cards.map(([label, value, onChange]) => (
            <article key={label} className="rounded-[28px] border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="font-black">{label}</h2>
              <Stars value={value} label={label} onChange={onChange} />
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-[30px] border border-white/10 bg-white/8 p-5 shadow-xl backdrop-blur-xl">
          <h2 className="flex items-center gap-2 text-lg font-black"><MessageSquareText className="h-5 w-5 text-[#D4AF37]" />{isArabic ? "ملاحظات سريعة" : "Quick feedback"}</h2>
          <div className="mt-4 flex flex-wrap gap-2">{TAGS.map(([ar, en]) => { const label = isArabic ? ar : en; const active = tags.includes(ar); return <button type="button" key={ar} onClick={() => setTags((current) => active ? current.filter((item) => item !== ar) : [...current, ar])} className={`rounded-full border px-4 py-2 text-xs font-black ${active ? "border-[#D4AF37] bg-[#D4AF37] text-[#071A33]" : "border-white/15 bg-white/5 text-white/70"}`}>{label}</button>; })}</div>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} placeholder={isArabic ? "اكتب ملاحظتك أو اقتراحك..." : "Write your note or suggestion..."} className="mt-4 w-full rounded-2xl border border-white/15 bg-[#04152c]/70 p-4 text-sm text-white outline-none focus:border-[#D4AF37]" />
          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-white/70"><input type="checkbox" checked={requestContact} onChange={(event) => setRequestContact(event.target.checked)} className="h-4 w-4 accent-[#D4AF37]" />{isArabic ? "أرغب أن تتواصل معي خدمة العملاء" : "I would like customer service to contact me"}</label>
          {error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">{error}</p>}
          <button type="button" disabled={submitting} onClick={() => void submit()} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#F5D46E] px-6 text-base font-black text-[#071A33] disabled:opacity-60">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Star className="h-5 w-5 fill-current" />}{isArabic ? "إرسال التقييم" : "Submit rating"}</button>
        </section>
      </div>
    </main>
  );
}
