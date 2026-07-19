import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardPaste,
  FileImage,
  FileUp,
  Flashlight,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  SwitchCamera,
  X,
  ZoomIn,
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

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (image: HTMLVideoElement | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
};

type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
  focusMode?: string[];
};

type ZoomRange = { min: number; max: number; step: number };

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CAPTURE_EDGE = 3200;
const LIVE_SCAN_INTERVAL_MS = 650;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function supportsLiveCamera() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

function cameraErrorMessage(error: unknown, isArabic: boolean) {
  const name = String((error as { name?: string })?.name || "");
  if (!window.isSecureContext) {
    return isArabic
      ? "الكاميرا الحية تحتاج فتح الموقع عبر HTTPS الآمن."
      : "Live camera requires the secure HTTPS site.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return isArabic
      ? "تم رفض إذن الكاميرا. اضغط علامة القفل بجوار رابط الموقع، اسمح بالكاميرا، ثم أعد المحاولة."
      : "Camera permission was denied. Open the site permission icon, allow Camera, then retry.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return isArabic ? "لم يتم العثور على كاميرا متصلة بهذا الجهاز." : "No connected camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return isArabic
      ? "الكاميرا مستخدمة في برنامج آخر. أغلق برنامج الكاميرا أو Zoom أو WhatsApp ثم أعد المحاولة."
      : "The camera is busy in another app. Close Camera, Zoom, or WhatsApp and retry.";
  }
  if (name === "OverconstrainedError") {
    return isArabic ? "إعداد الكاميرا غير مدعوم. سيتم المحاولة بإعداد تلقائي." : "That camera setting is unsupported. Automatic settings will be used.";
  }
  return isArabic
    ? "تعذر تشغيل الكاميرا الحية. يمكنك إعادة المحاولة أو استخدام كاميرا الجهاز الاحتياطية."
    : "The live camera could not start. Retry or use the device-camera fallback.";
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
  if (result.source === "ocr") return isArabic ? "OCR عربي وإنجليزي متعدد المراحل" : "Multi-pass Arabic/English OCR";
  return isArabic ? "نص أو ملف" : "Text or file";
}

function canvasQuality(canvas: HTMLCanvasElement) {
  const sample = document.createElement("canvas");
  const targetWidth = Math.min(180, canvas.width);
  const scale = targetWidth / Math.max(1, canvas.width);
  sample.width = Math.max(1, Math.round(canvas.width * scale));
  sample.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { brightness: 128, sharpness: 20 };
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
  let brightness = 0;
  let sharpness = 0;
  let previous = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
    brightness += gray;
    if (index > 0) sharpness += Math.abs(gray - previous);
    previous = gray;
  }
  const count = Math.max(1, pixels.length / 4);
  return { brightness: brightness / count, sharpness: sharpness / count };
}

export default function CouponPhotoIntake({ isArabic, mode, onReview, onClear, compact = false }: Props) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const fallbackCameraRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const cameraRequestIdRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualText, setManualText] = useState("");
  const [showText, setShowText] = useState(false);
  const [review, setReview] = useState<CouponPhotoReview | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [liveBarcode, setLiveBarcode] = useState("");
  const [liveCameraAvailable, setLiveCameraAvailable] = useState(false);

  useEffect(() => {
    setLiveCameraAvailable(supportsLiveCamera());
    return () => {
      cameraRequestIdRef.current += 1;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (scanTimerRef.current !== null) window.clearInterval(scanTimerRef.current);
    };
  }, []);

  useEffect(() => () => {
    if (review?.previewUrl) URL.revokeObjectURL(review.previewUrl);
  }, [review?.previewUrl]);

  const missingLabels = useMemo(
    () => review?.result.warnings.map((key) => warningLabel(key, isArabic)) || [],
    [review, isArabic],
  );

  function stopLiveScan() {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }

  function releaseCamera() {
    stopLiveScan();
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setTorchSupported(false);
    setTorchOn(false);
    setZoomRange(null);
    setLiveBarcode("");
  }

  async function waitForVideoElement() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (videoRef.current) return videoRef.current;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    throw new Error("video_element_unavailable");
  }

  function beginLiveBarcodeScan() {
    stopLiveScan();
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) return;
    let detector: InstanceType<BarcodeDetectorCtor>;
    try {
      detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "data_matrix"] });
    } catch {
      return;
    }
    let scanning = false;
    scanTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || scanning) return;
      scanning = true;
      void detector.detect(video)
        .then((codes) => {
          const value = codes.map((code) => clean(code.rawValue)).find(Boolean);
          if (value) setLiveBarcode(value);
        })
        .catch(() => undefined)
        .finally(() => { scanning = false; });
    }, LIVE_SCAN_INTERVAL_MS);
  }

  async function startCamera(deviceId?: string, preferredFacing: "environment" | "user" = facingMode) {
    const requestId = cameraRequestIdRef.current + 1;
    cameraRequestIdRef.current = requestId;
    setCameraOpen(true);
    setCameraBusy(true);
    setCameraReady(false);
    setCameraError("");
    setError("");
    setNotice("");
    releaseCamera();

    try {
      if (!supportsLiveCamera()) throw new DOMException("Live camera unavailable", "NotSupportedError");
      const preferredConstraints: MediaTrackConstraints = {
        width: { ideal: 2560, max: 3840 },
        height: { ideal: 1920, max: 2160 },
        aspectRatio: { ideal: 4 / 3 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: preferredFacing } }),
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: preferredConstraints });
      } catch (primaryError) {
        const name = String((primaryError as { name?: string })?.name || "");
        if (!deviceId && !["OverconstrainedError", "NotFoundError"].includes(name)) throw primaryError;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      }

      if (cameraRequestIdRef.current !== requestId) {
        stopStream(stream);
        return;
      }

      streamRef.current = stream;
      const video = await waitForVideoElement();
      if (cameraRequestIdRef.current !== requestId) {
        stopStream(stream);
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      if (cameraRequestIdRef.current !== requestId) {
        stopStream(stream);
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const capabilities = (track.getCapabilities?.() || {}) as ExtendedTrackCapabilities;
      setActiveDeviceId(settings.deviceId || deviceId || "");
      if (settings.facingMode === "user" || settings.facingMode === "environment") setFacingMode(settings.facingMode);
      setTorchSupported(Boolean(capabilities.torch));
      if (capabilities.zoom) {
        const nextZoom = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, Number(settings.zoom || capabilities.zoom.min)));
        setZoomRange(capabilities.zoom);
        setZoomValue(nextZoom);
      }
      if (capabilities.focusMode?.includes("continuous")) {
        void track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
      }

      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === "videoinput");
      if (cameraRequestIdRef.current !== requestId) {
        stopStream(stream);
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      setCameraDevices(devices);
      setCameraReady(true);
      beginLiveBarcodeScan();
    } catch (cause) {
      if (cameraRequestIdRef.current === requestId) {
        releaseCamera();
        setCameraError(cameraErrorMessage(cause, isArabic));
      }
    } finally {
      if (cameraRequestIdRef.current === requestId) setCameraBusy(false);
    }
  }

  function requestCamera() {
    if (supportsLiveCamera()) {
      void startCamera();
      return;
    }
    setError(
      isArabic
        ? "هذا المتصفح لا يدعم المعاينة الحية؛ سيتم فتح كاميرا الجهاز الاحتياطية."
        : "This browser does not support live preview; the device-camera fallback will open.",
    );
    fallbackCameraRef.current?.click();
  }

  function closeCamera() {
    cameraRequestIdRef.current += 1;
    releaseCamera();
    setCameraOpen(false);
    setCameraBusy(false);
    setCameraError("");
  }

  function openFallbackCamera() {
    closeCamera();
    window.setTimeout(() => fallbackCameraRef.current?.click(), 0);
  }

  async function switchCamera() {
    if (cameraBusy) return;
    if (cameraDevices.length > 1) {
      const currentIndex = cameraDevices.findIndex((device) => device.deviceId === activeDeviceId);
      const next = cameraDevices[(currentIndex + 1 + cameraDevices.length) % cameraDevices.length];
      await startCamera(next.deviceId, facingMode);
      return;
    }
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    await startCamera(undefined, nextFacing);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setCameraError(isArabic ? "الفلاش غير متاح في وضع الكاميرا الحالي." : "Torch is unavailable in the current camera mode.");
    }
  }

  async function changeZoom(value: number) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomRange) return;
    setZoomValue(value);
    await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] }).catch(() => undefined);
  }

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

  async function readImage(file: File, source: "camera" | "upload", supplementalBarcode = "") {
    setError("");
    setNotice("");
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
      let result = await importCouponFile(file);
      if (clean(supplementalBarcode)) {
        const enriched = parseCouponText(`live-barcode:\n${supplementalBarcode}\n${result.rawText}`);
        result = {
          ...enriched,
          source: result.source === "ocr" ? "ocr" : "barcode",
        };
      }
      emit(result, file, previewUrl, source);
    } catch (cause) {
      URL.revokeObjectURL(previewUrl);
      console.warn("Coupon image reading failed:", cause);
      setError(
        isArabic
          ? "تم التقاط الصورة فعلياً، لكن القراءة الآلية لم تستخرج نصاً كافياً. أعد التصوير من مسافة أقرب وبإضاءة ثابتة، أو أكمل الحقول يدوياً."
          : "The photo was captured, but automatic recognition did not extract enough text. Retake it closer with steady light, or complete the fields manually.",
      );
      setShowText(true);
    } finally {
      setBusy(false);
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError(isArabic ? "انتظر حتى تظهر صورة الكاميرا ثم التقط." : "Wait for the live preview before capturing.");
      return;
    }
    setCameraBusy(true);
    setCameraError("");
    try {
      const longest = Math.max(video.videoWidth, video.videoHeight);
      const scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(1, longest));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("canvas_unavailable");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const quality = canvasQuality(canvas);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("capture_failed")), "image/jpeg", 0.95);
      });
      const capturedBarcode = liveBarcode;
      const file = new File([blob], `day-night-coupon-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
      const qualityNotice = quality.brightness < 55
        ? (isArabic ? "الصورة مظلمة نسبياً؛ شغّل الفلاش أو قرّب الكوبون إذا كانت القراءة ناقصة." : "The image is relatively dark; use the torch or move closer if extraction is incomplete.")
        : quality.sharpness < 8
          ? (isArabic ? "الصورة قد تكون مهزوزة؛ أعد التصوير بثبات إذا كانت القراءة ناقصة." : "The image may be blurry; retake steadily if extraction is incomplete.")
          : "";
      closeCamera();
      await readImage(file, "camera", capturedBarcode);
      if (qualityNotice) setNotice(qualityNotice);
    } catch (cause) {
      console.warn("Live coupon capture failed:", cause);
      setCameraError(isArabic ? "تعذر حفظ اللقطة. أعد تشغيل الكاميرا وحاول مجدداً." : "The frame could not be saved. Restart the camera and retry.");
    } finally {
      setCameraBusy(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, source: "camera" | "upload") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (source === "camera" && cameraOpen) closeCamera();
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
    setNotice("");
    setManualText("");
    onClear?.();
  }

  const title = mode === "admin"
    ? (isArabic ? "إدخال الكوبون بالكاميرا الحية" : "Live Camera Coupon Intake")
    : (isArabic ? "لديك كوبون؟ صوّره مباشرة أو ارفع صورته" : "Have a coupon? Capture it live or upload its image");

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
                ? "الكاميرا تعمل مباشرة على الكمبيوتر والهاتف عبر getUserMedia، ثم يقرأ النظام QR والباركود وOCR عربي/إنجليزي متعدد المراحل."
                : "The camera opens live on desktop and mobile through getUserMedia, followed by QR/barcode and multi-pass Arabic/English OCR."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[11px] font-black text-emerald-200">
          <ShieldCheck className="h-4 w-4" />
          {isArabic ? "تصوير حقيقي + مراجعة يدوية" : "Real capture + manual review"}
        </span>
      </div>

      <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(event) => handleFile(event, "upload")} />
      <input ref={fallbackCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleFile(event, "camera")} />

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" disabled={busy} onClick={requestCamera} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-gold/45 bg-brand-gold/12 px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold hover:bg-brand-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-50">
          <Camera className="h-4 w-4" />
          {isArabic ? "فتح الكاميرا والتصوير الآن" : "Open live camera now"}
        </button>
        <button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-sky/25 bg-white/[0.045] px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/55 hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {isArabic ? "رفع صورة موجودة" : "Upload existing image"}
        </button>
        <button type="button" onClick={() => setShowText((value) => !value)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-sky/25 bg-white/[0.045] px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/55 hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
          <ClipboardPaste className="h-4 w-4" />
          {isArabic ? "إدخال نص يدوي" : "Manual text fallback"}
        </button>
      </div>

      <p className="mt-2 text-[11px] font-bold text-white/40">
        {liveCameraAvailable
          ? (isArabic ? "متاح: كاميرا اللابتوب/الكمبيوتر، الكاميرا الخلفية للهاتف، تبديل الكاميرا، الفلاش والزوم عند دعم الجهاز." : "Available: desktop webcam, phone rear camera, camera switching, torch and zoom when supported.")
          : (isArabic ? "المتصفح الحالي سيستخدم كاميرا الجهاز الاحتياطية." : "This browser will use the device-camera fallback.")}
      </p>

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

      {notice && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-brand-sky/25 bg-brand-sky/10 p-3 text-xs font-bold leading-6 text-brand-sky">
          <Camera className="mt-1 h-4 w-4 shrink-0" />
          <span>{notice}</span>
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
              <button type="button" onClick={requestCamera} className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1.5 text-[11px] font-black text-brand-gold">
                <RefreshCw className="h-3.5 w-3.5" />
                {isArabic ? "إعادة التصوير" : "Retake"}
              </button>
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

      {cameraOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={isArabic ? "كاميرا تصوير الكوبون" : "Coupon camera"}>
          <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-brand-gold/35 bg-[#06152f] shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
              <div>
                <strong className="block text-sm font-black text-white">{isArabic ? "كاميرا الكوبون الحية" : "Live coupon camera"}</strong>
                <span className="text-[11px] font-bold text-white/50">{isArabic ? "ضع الكوبون كاملاً داخل الإطار وثبّت الجهاز" : "Place the full coupon inside the guide and hold steady"}</span>
              </div>
              <button type="button" onClick={closeCamera} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white" aria-label={isArabic ? "إغلاق الكاميرا" : "Close camera"}>
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="relative min-h-[300px] flex-1 overflow-hidden bg-black sm:min-h-[480px]">
              <video ref={videoRef} autoPlay muted playsInline className={`h-full max-h-[68vh] w-full object-contain ${cameraReady ? "opacity-100" : "opacity-25"}`} />
              <div className="pointer-events-none absolute inset-[7%] rounded-3xl border-2 border-brand-gold/85 shadow-[0_0_0_999px_rgba(0,0,0,0.20)]">
                <span className="absolute -left-0.5 -top-0.5 h-10 w-10 rounded-tl-3xl border-l-4 border-t-4 border-white" />
                <span className="absolute -right-0.5 -top-0.5 h-10 w-10 rounded-tr-3xl border-r-4 border-t-4 border-white" />
                <span className="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-3xl border-b-4 border-l-4 border-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-3xl border-b-4 border-r-4 border-white" />
              </div>

              {(cameraBusy || !cameraReady) && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                  <Loader2 className="h-10 w-10 animate-spin text-brand-gold" />
                  <span className="text-sm font-black">{isArabic ? "جاري تشغيل الكاميرا..." : "Starting camera..."}</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-center">
                  <CameraOff className="h-12 w-12 text-amber-300" />
                  <p className="max-w-xl text-sm font-black leading-7 text-amber-100">{cameraError}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => void startCamera()} className="rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep">
                      {isArabic ? "إعادة محاولة الكاميرا" : "Retry live camera"}
                    </button>
                    <button type="button" onClick={openFallbackCamera} className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black text-white">
                      {isArabic ? "فتح كاميرا الجهاز الاحتياطية" : "Open device-camera fallback"}
                    </button>
                  </div>
                </div>
              )}

              {liveBarcode && cameraReady && (
                <div className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full border border-emerald-400/35 bg-emerald-950/90 px-4 py-2 text-center text-[11px] font-black text-emerald-200">
                  {isArabic ? "تم رصد كود مباشر: " : "Live code detected: "}{liveBarcode.slice(0, 70)}
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 bg-brand-deep/95 p-3 sm:p-4">
              {zoomRange && cameraReady && (
                <label className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white/70">
                  <ZoomIn className="h-4 w-4 text-brand-sky" />
                  <span>{isArabic ? "الزوم" : "Zoom"}</span>
                  <input className="w-full accent-amber-400" type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step || 0.1} value={zoomValue} onChange={(event) => void changeZoom(Number(event.target.value))} />
                  <span dir="ltr">{zoomValue.toFixed(1)}x</span>
                </label>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button type="button" disabled={!cameraReady || cameraBusy} onClick={() => void captureFrame()} className="col-span-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-gold px-5 text-sm font-black text-brand-deep disabled:opacity-45 sm:col-span-1">
                  {cameraBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {isArabic ? "التقاط الصورة" : "Capture photo"}
                </button>
                <button type="button" disabled={!cameraReady || cameraBusy} onClick={() => void switchCamera()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-xs font-black text-white disabled:opacity-45">
                  <SwitchCamera className="h-4 w-4" />
                  {isArabic ? "تبديل" : "Switch"}
                </button>
                <button type="button" disabled={!cameraReady || !torchSupported || cameraBusy} onClick={() => void toggleTorch()} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-xs font-black disabled:opacity-35 ${torchOn ? "border-brand-gold bg-brand-gold/20 text-brand-gold" : "border-white/15 bg-white/5 text-white"}`}>
                  <Flashlight className="h-4 w-4" />
                  {isArabic ? "الفلاش" : "Torch"}
                </button>
                <button type="button" onClick={closeCamera} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 text-xs font-black text-rose-100 sm:col-span-1">
                  <X className="h-4 w-4" />
                  {isArabic ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
