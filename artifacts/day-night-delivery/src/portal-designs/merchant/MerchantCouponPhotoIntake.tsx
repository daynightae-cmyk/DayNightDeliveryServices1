import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, FileImage, RefreshCw, RotateCcw, ScanLine, Trash2, UploadCloud, XCircle } from "lucide-react";
import type { MerchantCouponExtractionResult, MerchantFileUploadResult } from "./merchantCallbacks";
import type { MerchantOrderFormDraft } from "./merchantViewModels";
import { MerchantButton, MerchantCard, MerchantSectionHeader, MerchantStatePanel } from "./MerchantUi";

export interface MerchantCouponPhotoIntakeProps {
  isArabic: boolean;
  onUpload?: (file: File) => Promise<MerchantFileUploadResult>;
  onExtract?: (url: string) => Promise<MerchantCouponExtractionResult>;
  onUseFields(fields: Partial<MerchantOrderFormDraft>): void;
  onClose(): void;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string; format?: string }>>;
};

export function MerchantCouponPhotoIntake({ isArabic, onUpload, onExtract, onUseFields, onClose }: MerchantCouponPhotoIntakeProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [rotation, setRotation] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "uploaded" | "extracting" | "review" | "error">("idle");
  const [message, setMessage] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [extraction, setExtraction] = useState<MerchantCouponExtractionResult | null>(null);
  const [manual, setManual] = useState<Partial<MerchantOrderFormDraft>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectFile(selected?: File | null) {
    if (!selected) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setRotation(0);
    setState("idle");
    setMessage("");
    setExtraction(null);
    setManual({});
  }

  async function detectBarcodeLocally(selected: File): Promise<Partial<MerchantOrderFormDraft>> {
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) return {};
    try {
      const bitmap = await createImageBitmap(selected);
      const detected = await new Detector({ formats: ["qr_code", "code_128", "ean_13", "ean_8"] }).detect(bitmap);
      bitmap.close();
      const first = detected.find((item) => item.rawValue)?.rawValue;
      return first ? { couponNumber: first } : {};
    } catch {
      return {};
    }
  }

  async function uploadAndReview() {
    if (!file) return;
    setState("uploading");
    setMessage("");
    let uploadResult: MerchantFileUploadResult;
    if (onUpload) uploadResult = await onUpload(file);
    else uploadResult = { success: false, error: { code: "UPLOAD_NOT_CONNECTED", message: isArabic ? "رفع صورة الكوبون غير متصل بخدمة تخزين موثوقة." : "Coupon image upload is not connected to an authoritative storage service." } };
    if (!uploadResult.success || !uploadResult.url) {
      setState("error");
      setMessage(uploadResult.error?.message || (isArabic ? "تعذر رفع الصورة." : "Image upload failed."));
      return;
    }
    setUploadedUrl(uploadResult.url);
    setState("extracting");
    const localFields = await detectBarcodeLocally(file);
    let extractResult: MerchantCouponExtractionResult = { success: true, extractionSource: Object.keys(localFields).length ? "barcode" : "manual", fields: localFields, confidence: Object.keys(localFields).length ? 1 : null, warnings: Object.keys(localFields).length ? [] : [isArabic ? "لم يتم اكتشاف باركود؛ راجع البيانات يدوياً." : "No barcode was detected; review fields manually."] };
    if (onExtract) {
      const remoteResult = await onExtract(uploadResult.url);
      if (remoteResult.success) extractResult = { ...remoteResult, fields: { ...localFields, ...remoteResult.fields } };
      else extractResult = { ...extractResult, warnings: [...(extractResult.warnings || []), remoteResult.error?.message || (isArabic ? "خدمة الاستخراج غير متاحة." : "Extraction service is unavailable.")] };
    }
    setExtraction(extractResult);
    setManual(extractResult.fields || {});
    setState("review");
  }

  function removeFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setUploadedUrl("");
    setExtraction(null);
    setManual({});
    setMessage("");
    setState("idle");
  }

  return (
    <div className="dn-merchant-stack">
      <MerchantSectionHeader eyebrowAr="إدخال الكوبون" eyebrowEn="COUPON PHOTO INTAKE" titleAr="التقط الصورة ثم راجع البيانات قبل إنشاء الطلب" titleEn="Capture, upload, and verify before creating the order" descriptionAr="لا يتم إنشاء أي طلب تلقائياً من الصورة؛ المراجعة البشرية إلزامية." descriptionEn="No order is created automatically from the image; human verification is required." isArabic={isArabic} actions={<MerchantButton variant="ghost" onClick={onClose}>{isArabic ? "العودة للنموذج" : "Back to form"}</MerchantButton>} />

      <div className="dn-merchant-coupon-layout">
        <MerchantCard className="dn-merchant-coupon-capture">
          {!previewUrl ? (
            <button type="button" className="dn-merchant-coupon-drop" onClick={() => fileInputRef.current?.click()}>
              <span><Camera className="h-8 w-8" /></span>
              <strong>{isArabic ? "التقاط أو رفع صورة الكوبون" : "Capture or upload the coupon"}</strong>
              <p>{isArabic ? "استخدم الكاميرا أو اختر صورة واضحة بصيغة JPG/PNG." : "Use the camera or select a clear JPG/PNG image."}</p>
              <em><UploadCloud className="h-4 w-4" />{isArabic ? "اختيار صورة" : "Choose image"}</em>
            </button>
          ) : (
            <div className="dn-merchant-coupon-preview">
              <div><img src={previewUrl} alt={isArabic ? "معاينة الكوبون" : "Coupon preview"} style={{ transform: `rotate(${rotation}deg)` }} /></div>
              <footer>
                <MerchantButton variant="secondary" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCcw className="h-4 w-4" />{isArabic ? "تدوير" : "Rotate"}</MerchantButton>
                <MerchantButton variant="secondary" onClick={() => fileInputRef.current?.click()}><FileImage className="h-4 w-4" />{isArabic ? "استبدال" : "Replace"}</MerchantButton>
                <MerchantButton variant="danger" onClick={removeFile}><Trash2 className="h-4 w-4" />{isArabic ? "حذف" : "Remove"}</MerchantButton>
              </footer>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => selectFile(event.target.files?.[0])} />
          {file ? <div className="dn-merchant-file-meta"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div> : null}
          {state === "error" ? <MerchantStatePanel type="error" isArabic={isArabic} descriptionAr={message} descriptionEn={message} onRetry={() => void uploadAndReview()} /> : null}
          {file && state !== "review" && state !== "error" ? <MerchantButton disabled={state === "uploading" || state === "extracting"} onClick={() => void uploadAndReview()}>{state === "uploading" ? <><RefreshCw className="h-4 w-4 animate-spin" />{isArabic ? "جاري الرفع..." : "Uploading..."}</> : state === "extracting" ? <><ScanLine className="h-4 w-4 animate-pulse" />{isArabic ? "جاري فحص الباركود والحقول..." : "Checking barcode and fields..."}</> : <><UploadCloud className="h-4 w-4" />{isArabic ? "رفع ومراجعة" : "Upload and review"}</>}</MerchantButton> : null}
        </MerchantCard>

        <MerchantCard>
          <header className="dn-merchant-card-header"><div><span>{isArabic ? "المراجعة" : "VERIFICATION"}</span><h3>{isArabic ? "الحقول المستخرجة أو اليدوية" : "Extracted or manual fields"}</h3></div>{state === "review" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <ScanLine className="h-5 w-5" />}</header>
          {state !== "review" ? <MerchantStatePanel type="empty" isArabic={isArabic} titleAr="ارفع الصورة أولاً" titleEn="Upload the image first" descriptionAr="بعد الرفع ستظهر الحقول للمراجعة والتصحيح." descriptionEn="After upload, fields will appear for review and correction." /> : (
            <div className="dn-merchant-coupon-review">
              {extraction?.warnings?.length ? <div className="dn-merchant-warning-list">{extraction.warnings.map((warning) => <p key={warning}><XCircle className="h-4 w-4" />{warning}</p>)}</div> : null}
              <div className="dn-merchant-form-grid">
                <label><span>{isArabic ? "رقم الكوبون" : "Coupon number"}</span><input value={manual.couponNumber || ""} onChange={(event) => setManual((current) => ({ ...current, couponNumber: event.target.value }))} dir="ltr" /></label>
                <label><span>{isArabic ? "اسم المستلم" : "Recipient name"}</span><input value={manual.recipientName || ""} onChange={(event) => setManual((current) => ({ ...current, recipientName: event.target.value }))} /></label>
                <label><span>{isArabic ? "الهاتف" : "Phone"}</span><input value={manual.recipientPhone || ""} onChange={(event) => setManual((current) => ({ ...current, recipientPhone: event.target.value }))} dir="ltr" /></label>
                <label><span>{isArabic ? "المدينة" : "City"}</span><input value={manual.deliveryCity || ""} onChange={(event) => setManual((current) => ({ ...current, deliveryCity: event.target.value }))} /></label>
                <label className="is-wide"><span>{isArabic ? "العنوان" : "Address"}</span><textarea value={manual.deliveryAddress || ""} onChange={(event) => setManual((current) => ({ ...current, deliveryAddress: event.target.value }))} rows={3} /></label>
                <label><span>COD (AED)</span><input type="number" min="0" step="0.01" value={manual.codAmount ?? ""} onChange={(event) => setManual((current) => ({ ...current, codAmount: Number(event.target.value) || 0 }))} dir="ltr" /></label>
                <label><span>{isArabic ? "مرجع التاجر" : "Merchant reference"}</span><input value={manual.merchantReference || ""} onChange={(event) => setManual((current) => ({ ...current, merchantReference: event.target.value }))} dir="ltr" /></label>
              </div>
              <div className="dn-merchant-verification-meta"><span>{isArabic ? "المصدر" : "Source"}: {extraction?.extractionSource || "manual"}</span><span>{isArabic ? "الثقة" : "Confidence"}: {extraction?.confidence === null || extraction?.confidence === undefined ? "—" : `${Math.round(extraction.confidence * 100)}%`}</span><span dir="ltr">{uploadedUrl ? "Image uploaded" : ""}</span></div>
              <MerchantButton onClick={() => onUseFields(manual)}><CheckCircle2 className="h-4 w-4" />{isArabic ? "اعتماد الحقول وفتح نموذج الطلب" : "Use fields in order form"}</MerchantButton>
            </div>
          )}
        </MerchantCard>
      </div>
    </div>
  );
}
