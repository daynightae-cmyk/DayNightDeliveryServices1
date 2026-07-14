import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  FileImage,
  FileUp,
  Loader2,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  importCouponFile,
  parseCouponText,
  type CouponImportResult,
} from "../../lib/couponImport";

export type CouponPhotoReview = {
  result: CouponImportResult;
  confidence: number;
  needsReview: boolean;
  extractedDeliveryFee: number | null;
  file: File | null;
  previewUrl: string;
  source: "camera" | "upload" | "text";
};

type Props = {
  isArabic: boolean;
  mode: "admin" | "public";
  onReview: (review: CouponPhotoReview) => void;
  onClear?: () => void;
  compact?: boolean;
};

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function confidenceFor(result: CouponImportResult) {
  const fields = result.fields;
  const checks = [
    fields.coupon_number,
    fields.receiver_name,
    fields.receiver_phone,
    fields.receiver_address || fields.delivery_street,
    fields.delivery_city,
    fields.package_type,
    fields.cod_amount,
  ];
  const filled = checks.filter((value) => clean(value)).length;
  const sourceBonus = result.source === "barcode" ? 16 : result.source === "ocr" ? 10 : 4;
  const penalty = Math.min(28, result.warnings.length * 7);
  return Math.max(18, Math.min(98, Math.round((filled / checks.length) * 82 + sourceBonus - penalty)));
}

function deliveryFeeFromText(rawText: string) {
  const normalized = String(rawText || "").replace(/[٠-٩]/g, (char) => String("٠١٢٣٤٥٦٧٨٩".indexOf(char)));
  const patterns = [
    /(?:delivery\s*(?:fee|charge|price)|سعر\s*التوصيل|رسوم\s*التوصيل)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /(?:fee|charge)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const amount = Number(match[1].replace(",", "."));
    if (Number.isFinite(amount) && amount > 0 && amount <= 1000) return amount;
  }
  return null;
}

function warningLabel(key: string, isArabic: boolean) {
  const labels: Record<string, { ar: string; en: string }> = {
    receiver_name: { ar: "اسم المستلم", en: "Receiver name" },
    receiver_phone: { ar: "هاتف المستلم", en: "Receiver phone" },
    address: { ar: "عنوان التسليم", en: "Delivery address" },
    coupon_number: { ar: "رقم الكوبون أو المرجع", en: "Coupon or reference" },
  };
  return labels[key] ? (isArabic ? labels[key].ar : labels[key].en) : key;
}

function sourceLabel(result: CouponImportResult, isArabic: boolean) {
  if (result.source === "barcode") return isArabic ? "QR / باركود" : "QR / barcode";
  if (result.source === "ocr") return isArabic ? "OCR من الصورة" : "Image OCR";
  return isArabic ? "نص أو ملف" : "Text or file";
}

export default function CouponPhotoIntake({ isArabic, mode, onReview, onClear, compact = false }: Props) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manualText, setManualText] = useState("");
  const [showText, setShowText] = useState(false);
  const [review, setReview] = useState<CouponPhotoReview | null>(null);

  useEffect(() => () => {
    if (review?.previewUrl) URL.revokeObjectURL(review.previewUrl);
  }, [review?.previewUrl]);

  const missingLabels = useMemo(
    () => review?.result.warnings.map((key) => warningLabel(key, isArabic)) || [],
    [review, isArabic],
  );

  function emit(result: CouponImportResult, file: File | null, previewUrl: string, source: CouponPhotoReview["source"]) {
    const confidence = confidenceFor(result);
    const next: CouponPhotoReview = {
      result,
      confidence,
      needsReview: result.warnings.length > 0 || confidence < 82,
      extractedDeliveryFee: deliveryFeeFromText(result.rawText),
      file,
      previewUrl,
      source,
    };
    setReview((current) => {
      if (current?.previewUrl && current.previewUrl !== previewUrl) URL.revokeObjectURL(current.previewUrl);
      return next;
    });
    onReview(next);
  }

  async function readImage(file: File, source: "camera" | "upload") {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError(isArabic ? "استخدم صورة واضحة بصيغة JPG أو PNG أو WEBP." : "Use a clear JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(isArabic ? "حجم الصورة أكبر من 12 ميجابايت. صغّر الصورة ثم حاول مجدداً." : "The image is larger than 12 MB. Resize it and retry.");
      return;
    }

    setBusy(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const result = await importCouponFile(file);
      emit(result, file, previewUrl, source);
    } catch (cause) {
      URL.revokeObjectURL(previewUrl);
      console.warn("Coupon image reading failed:", cause);
      setError(
        isArabic
          ? "لم نستطع قراءة الكوبون تلقائياً. جرّب صورة أقرب بدون ميل أو انعكاس، أو استخدم الإدخال اليدوي أدناه."
          : "The coupon could not be read automatically. Try a closer image without glare, or use the manual text fallback below.",
      );
      setShowText(true);
    } finally {
      setBusy(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, source: "camera" | "upload") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void readImage(file, source);
  }

  function parseManualText() {
    const text = manualText.trim();
    if (!text) {
      setError(isArabic ? "الصق نص الكوبون أولاً." : "Paste the coupon text first.");
      return;
    }
    setError("");
    emit(parseCouponText(text), null, "", "text");
  }

  function clearReview() {
    if (review?.previewUrl) URL.revokeObjectURL(review.previewUrl);
    setReview(null);
    setError("");
    setManualText("");
    onClear?.();
  }

  const title = mode === "admin"
    ? (isArabic ? "إدخال الكوبون بالتصوير" : "Coupon Photo Intake")
    : (isArabic ? "لديك كوبون؟ صوّره أو ارفعه هنا" : "Have a coupon? Capture or upload it here");

  return (
    <section
      className={`rounded-[1.75rem] border border-brand-gold/20 bg-brand-deep/55 ${compact ? "p-4" : "p-5 sm:p-6"}`}
      dir={isArabic ? "rtl" : "ltr"}
      aria-label={title}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-black text-white">{title}</h3>
            <p className="mt-1 text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "سنحاول قراءة QR أو الباركود ثم OCR. راجع كل البيانات يدوياً قبل إنشاء الطلب؛ الصورة لا تُعتبر مصدراً نهائياً بمفردها."
                : "We try QR/barcode first, then OCR. Review every field before creating the order; the image is never treated as final truth."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[11px] font-black text-emerald-200">
          <ShieldCheck className="h-4 w-4" />
          {isArabic ? "مراجعة يدوية إلزامية" : "Manual review required"}
        </span>
      </div>

      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event, "upload")} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleFile(event, "camera")} />

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-sky/25 bg-white/[0.045] px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/55 hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-50">
          <Camera className="h-4 w-4" />
          {isArabic ? "تصوير الكوبون" : "Capture coupon"}
        </button>
        <button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-sky/25 bg-white/[0.045] px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/55 hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {isArabic ? "رفع صورة الكوبون" : "Upload coupon image"}
        </button>
        <button type="button" onClick={() => setShowText((value) => !value)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-sky/25 bg-white/[0.045] px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/55 hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
          <ClipboardPaste className="h-4 w-4" />
          {isArabic ? "إدخال نص يدوي" : "Manual text fallback"}
        </button>
      </div>

      {showText && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3">
          <textarea
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            rows={4}
            placeholder={isArabic ? "الصق نص الكوبون أو بيانات QR هنا..." : "Paste coupon or QR text here..."}
            className="w-full rounded-xl border border-white/10 bg-brand-deep/80 px-4 py-3 text-xs font-bold text-white outline-none placeholder:text-white/30 focus:border-brand-gold"
          />
          <button type="button" onClick={parseManualText} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-xs font-black text-brand-deep transition hover:bg-white">
            <ScanLine className="h-4 w-4" />
            {isArabic ? "تحليل النص ومراجعته" : "Parse and review text"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs font-bold leading-6 text-amber-100">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {review && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {review.previewUrl ? (
              <img src={review.previewUrl} alt={isArabic ? "معاينة صورة الكوبون" : "Coupon image preview"} className="h-52 w-full object-contain" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/45">
                <FileImage className="h-8 w-8" />
                <span className="text-xs font-bold">{isArabic ? "تم الإدخال بالنص" : "Text input used"}</span>
              </div>
            )}
            <button type="button" onClick={clearReview} aria-label={isArabic ? "إزالة الكوبون" : "Remove coupon"} className="absolute left-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-brand-deep/90 text-white transition hover:border-rose-400 hover:text-rose-300">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-sky/25 bg-brand-sky/10 px-3 py-1.5 text-[11px] font-black text-brand-sky">
                <ScanLine className="h-3.5 w-3.5" /> {sourceLabel(review.result, isArabic)}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black ${review.confidence >= 82 ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-100"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isArabic ? `ثقة القراءة ${review.confidence}%` : `Extraction confidence ${review.confidence}%`}
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs font-bold leading-6 text-white/70">
              {review.needsReview
                ? (isArabic ? "تم استخراج بيانات أولية وتحتاج مراجعة دقيقة قبل الحفظ." : "Preliminary data was extracted and requires careful review before saving.")
                : (isArabic ? "تم استخراج الحقول الأساسية، ومع ذلك يجب تأكيدها يدوياً." : "Core fields were extracted, but manual confirmation is still required.")}
            </div>

            {missingLabels.length > 0 && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs font-bold text-amber-100">
                <strong>{isArabic ? "بيانات تحتاج استكمال:" : "Fields need completion:"}</strong>{" "}{missingLabels.join(isArabic ? "، " : ", ")}
              </div>
            )}

            {review.extractedDeliveryFee !== null && (
              <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 p-3 text-xs font-bold text-brand-gold">
                {isArabic ? `قيمة توصيل مقروءة من الكوبون: ${review.extractedDeliveryFee.toFixed(2)} درهم` : `Delivery fee read from coupon: ${review.extractedDeliveryFee.toFixed(2)} AED`}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
