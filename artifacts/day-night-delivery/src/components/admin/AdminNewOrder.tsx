import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Database,
  FileUp,
  Loader2,
  MapPin,
  PackagePlus,
  ReceiptText,
  Save,
  ScanLine,
} from "lucide-react";
import {
  calculateMerchantStatementNet,
  calculateOpsOrderPrice,
  createOpsOrder,
  type OpsDataSource,
  type OpsOrderInput,
} from "../../lib/adminOperationsData";
import { importCouponFile, parseCouponText, type CouponImportResult } from "../../lib/couponImport";
import { UAE_LOCATIONS, getAreasForEmirate, getDefaultAreaForEmirate } from "../../data/uaeLocations";
import type { Merchant, Order } from "../../types";

const emptyOrder: OpsOrderInput = {
  merchant: null,
  merchant_id: "",
  merchant_name: "",
  merchant_code: "",
  coupon_number: "",
  shipping_scope: "local",
  order_count: 1,
  pickup_city: "Abu Dhabi",
  pickup_area: "Mussafah",
  pickup_street: "",
  delivery_city: "Dubai",
  delivery_area: "Deira",
  delivery_street: "",
  destination_country: "SA",
  receiver_name: "",
  receiver_phone: "",
  receiver_address: "",
  package_type: "",
  package_description: "",
  weight: 1,
  payment_method: "merchant_pays",
  cod_amount: "",
  notes: "",
  status: "pending",
};

const destinations = ["SA", "KW", "BH", "OM", "QA", "WORLD", "USA", "UK", "EU", "Canada", "Australia"];

const paymentOptions = [
  { value: "merchant_pays", ar: "التاجر يتحمل رسوم التوصيل", en: "Merchant pays delivery fee" },
  { value: "receiver_pays", ar: "المستلم يدفع رسوم التوصيل", en: "Receiver pays delivery fee" },
  { value: "cod", ar: "تحصيل من العميل عند التسليم", en: "Collect from customer on delivery" },
];

const statusOptions = [
  { value: "pending", ar: "قيد الانتظار", en: "Pending" },
  { value: "review", ar: "قيد المراجعة", en: "Under review" },
  { value: "confirmed", ar: "تم التأكيد", en: "Confirmed" },
  { value: "assigned", ar: "تم تعيين مندوب", en: "Driver assigned" },
  { value: "picked_up", ar: "تم الإحضار", en: "Picked up" },
  { value: "in_transit", ar: "في الطريق", en: "In transit" },
];

function inputClass() {
  return "w-full rounded-2xl border border-brand-sky/20 bg-brand-deep/75 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/30 focus:border-brand-gold/70 focus:ring-2 focus:ring-brand-gold/15";
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: number, isArabic: boolean) {
  return isArabic ? `${value.toFixed(2)} درهم` : `${value.toFixed(2)} AED`;
}

function sourceLabel(source: OpsDataSource | "pending" | "none", isArabic: boolean) {
  if (source === "rpc") return isArabic ? "تم الحفظ عبر إجراء قاعدة البيانات الإنتاجي" : "Saved through production database procedure";
  if (source === "db") return isArabic ? "تم الحفظ مباشرة في جدول الطلبات" : "Saved directly to orders table";
  if (source === "pending") return isArabic ? "بانتظار الحفظ" : "Waiting to save";
  return isArabic ? "لم يتم الحفظ بعد" : "Not saved yet";
}

function optionLabel(option: { ar: string; en: string }, isArabic: boolean) {
  return isArabic ? option.ar : option.en;
}

function matchMerchantFromText(text: string, merchants: Merchant[]) {
  const compactText = text.toLowerCase().replace(/\s+/g, " ");
  return merchants.find((merchant) => {
    const candidates = [merchant.trade_name, merchant.merchant_code, merchant.phone, merchant.email]
      .map((value) => clean(value).toLowerCase())
      .filter((value) => value.length >= 3);
    return candidates.some((candidate) => compactText.includes(candidate));
  }) || null;
}

function importWarningLabel(key: string, isArabic: boolean) {
  const ar: Record<string, string> = {
    receiver_name: "اسم العميل",
    receiver_phone: "هاتف العميل",
    address: "العنوان",
    coupon_number: "رقم الكوبون أو المرجع",
  };
  const en: Record<string, string> = {
    receiver_name: "receiver name",
    receiver_phone: "receiver phone",
    address: "address",
    coupon_number: "coupon or reference",
  };
  return isArabic ? ar[key] || key : en[key] || key;
}

export default function AdminNewOrder({
  isArabic,
  merchants,
  onSaved,
}: {
  isArabic: boolean;
  merchants: Merchant[];
  onSaved?: (order: Order) => void;
}) {
  const [form, setForm] = useState<OpsOrderInput>(emptyOrder);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [source, setSource] = useState<OpsDataSource | "pending" | "none">("none");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === form.merchant_id) || null,
    [form.merchant_id, merchants],
  );

  const pickupAreas = useMemo(() => getAreasForEmirate(form.pickup_city), [form.pickup_city]);
  const deliveryAreas = useMemo(() => getAreasForEmirate(form.delivery_city), [form.delivery_city]);

  const price = useMemo(
    () => calculateOpsOrderPrice({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );

  const settlement = useMemo(
    () => calculateMerchantStatementNet({ ...form, merchant: selectedMerchant }),
    [form, selectedMerchant],
  );

  function setField<K extends keyof OpsOrderInput>(key: K, value: OpsOrderInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSource("pending");
  }

  function choosePickupEmirate(value: string) {
    setForm((prev) => ({ ...prev, pickup_city: value, pickup_area: getDefaultAreaForEmirate(value) }));
    setSource("pending");
  }

  function chooseDeliveryEmirate(value: string) {
    setForm((prev) => ({ ...prev, delivery_city: value, delivery_area: getDefaultAreaForEmirate(value) }));
    setSource("pending");
  }

  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    const merchantEmirate = merchant?.emirate || prevSafeEmirate(form.pickup_city);
    const merchantArea = merchant?.city && merchant.city !== merchantEmirate ? merchant.city : getDefaultAreaForEmirate(merchantEmirate);
    setForm((prev) => ({
      ...prev,
      merchant,
      merchant_id: id,
      merchant_name: merchant?.trade_name || prev.merchant_name,
      merchant_code: merchant?.merchant_code || "",
      pickup_city: merchantEmirate,
      pickup_area: merchantArea,
      pickup_street: merchant?.pickup_address || merchant?.address || prev.pickup_street || "",
      payment_method: merchant?.default_payment_method || prev.payment_method || "merchant_pays",
    }));
    setSource("pending");
  }

  function prevSafeEmirate(value: string | undefined) {
    return UAE_LOCATIONS.some((item) => item.value === value) ? value || "Abu Dhabi" : "Abu Dhabi";
  }

  function applyImportedCoupon(result: CouponImportResult) {
    const matchedMerchant = matchMerchantFromText(result.rawText, merchants);
    const imported = result.fields;
    const importedNotes = clean(imported.notes);
    setForm((prev) => ({
      ...prev,
      ...imported,
      merchant: matchedMerchant || prev.merchant,
      merchant_id: matchedMerchant?.id || prev.merchant_id,
      merchant_name: matchedMerchant?.trade_name || imported.merchant_name || prev.merchant_name,
      merchant_code: matchedMerchant?.merchant_code || imported.merchant_code || prev.merchant_code,
      pickup_city: matchedMerchant?.emirate || prev.pickup_city,
      pickup_area: matchedMerchant?.city || prev.pickup_area,
      pickup_street: matchedMerchant?.pickup_address || matchedMerchant?.address || prev.pickup_street,
      notes: importedNotes ? `${clean(prev.notes)}\n${importedNotes}`.trim() : prev.notes,
    }));

    const missing = result.warnings.map((key) => importWarningLabel(key, isArabic));
    setImportSummary(
      isArabic
        ? `تم استيراد بيانات الكوبون من ${result.source === "barcode" ? "QR / باركود" : result.source === "ocr" ? "الصورة" : "الملف"}. ${missing.length ? `راجع الحقول الناقصة: ${missing.join("، ")}.` : "تم ملء الحقول الأساسية تلقائيًا."}`
        : `Coupon data imported from ${result.source === "barcode" ? "QR / barcode" : result.source === "ocr" ? "image" : "file"}. ${missing.length ? `Review missing fields: ${missing.join(", ")}.` : "Core fields were filled automatically."}`,
    );
    setSource("pending");
  }

  async function handleCouponFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setMessage("");
    setImportSummary("");
    setImporting(true);
    try {
      const result = await importCouponFile(file);
      applyImportedCoupon(result);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setImporting(false);
    }
  }

  function importFromClipboardText() {
    const text = window.prompt(
      isArabic
        ? "الصق نص الكوبون أو بيانات الكشف هنا وسيتم توزيعها على الخانات تلقائيًا."
        : "Paste coupon or manifest text here and it will be mapped into the form automatically.",
    );
    if (!text) return;
    setError("");
    setMessage("");
    const result = parseCouponText(text);
    applyImportedCoupon(result);
  }

  function validate() {
    const missing = [
      !selectedMerchant && !clean(form.merchant_name) ? (isArabic ? "التاجر أو اسم المرسل" : "merchant or sender name") : "",
      !clean(form.pickup_city) ? (isArabic ? "إمارة الاستلام" : "pickup emirate") : "",
      !clean(form.pickup_area) ? (isArabic ? "منطقة الاستلام" : "pickup area") : "",
      !clean(form.delivery_city) ? (isArabic ? "إمارة التسليم" : "delivery emirate") : "",
      !clean(form.delivery_area) ? (isArabic ? "منطقة التسليم" : "delivery area") : "",
      !clean(form.receiver_name) ? (isArabic ? "اسم العميل" : "receiver name") : "",
      !clean(form.receiver_phone) ? (isArabic ? "هاتف العميل" : "receiver phone") : "",
      !clean(form.receiver_address) && !clean(form.delivery_street) ? (isArabic ? "تفاصيل الشارع أو الفيلا" : "street or villa details") : "",
      !clean(form.package_type) ? (isArabic ? "محتوى الشحنة" : "package content") : "",
    ].filter(Boolean);

    if (missing.length) {
      return isArabic ? `حقول مطلوبة: ${missing.join("، ")}` : `Required fields: ${missing.join(", ")}`;
    }

    if (form.payment_method === "cod" && Number(form.cod_amount || 0) <= 0) {
      return isArabic ? "عند اختيار التحصيل من العميل يجب إدخال مبلغ التحصيل." : "Collection amount is required when collecting from the customer.";
    }

    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const result = await createOpsOrder({ ...form, merchant: selectedMerchant });
      const saved = result.row;
      const tracking = saved.tracking_number || saved.invoice_number || saved.id;
      setSource(result.source);
      setMessage(isArabic ? `تم إنشاء الطلبية وربطها بقاعدة البيانات. رقم التتبع: ${tracking}` : `Live order created and linked to the database. Tracking: ${tracking}`);
      setImportSummary("");
      setForm({
        ...emptyOrder,
        merchant_id: selectedMerchant?.id || "",
        merchant_name: selectedMerchant?.trade_name || "",
        merchant_code: selectedMerchant?.merchant_code || "",
        merchant: selectedMerchant,
        pickup_city: selectedMerchant?.emirate || emptyOrder.pickup_city,
        pickup_area: selectedMerchant?.city || emptyOrder.pickup_area,
        pickup_street: selectedMerchant?.pickup_address || selectedMerchant?.address || "",
        payment_method: selectedMerchant?.default_payment_method || "merchant_pays",
      });
      onSaved?.(saved);
    } catch (err) {
      setSource("none");
      setError(String((err as Error).message || err));
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    title: isArabic ? "إضافة طلبية إنتاجية متصلة بقاعدة البيانات" : "Create live database-backed shipment",
    hint: isArabic
      ? "حدد من يتحمل رسوم التوصيل: إذا اخترت التاجر يتحمل الرسوم ومبلغ التحصيل 0، ستنزل في كشف التاجر صافي سالب بقيمة رسوم التوصيل."
      : "Choose who pays the delivery fee: if the merchant pays and collection is 0, the merchant statement posts a negative net equal to the delivery fee.",
    merchant: isArabic ? "التاجر" : "Merchant",
    sender: isArabic ? "اسم المرسل" : "Sender name",
    coupon: isArabic ? "رقم الكوبون أو المرجع" : "Coupon or reference",
    pickupEmirate: isArabic ? "إمارة الاستلام" : "Pickup emirate",
    pickupArea: isArabic ? "منطقة الاستلام" : "Pickup area",
    pickupStreet: isArabic ? "الشارع أو الحي أو رقم الفيلا للاستلام" : "Pickup street, neighborhood, or villa",
    deliveryEmirate: isArabic ? "إمارة التسليم" : "Delivery emirate",
    deliveryArea: isArabic ? "منطقة التسليم" : "Delivery area",
    deliveryStreet: isArabic ? "الشارع أو الحي أو رقم الفيلا للتسليم" : "Delivery street, neighborhood, or villa",
    scope: isArabic ? "نطاق الشحن" : "Shipping scope",
    destination: isArabic ? "دولة الشحن الدولي" : "International destination",
    receiver: isArabic ? "اسم العميل" : "Receiver name",
    phone: isArabic ? "هاتف العميل" : "Receiver phone",
    address: isArabic ? "عنوان تفصيلي إضافي" : "Additional address details",
    package: isArabic ? "محتوى الشحنة" : "Package content",
    pieces: isArabic ? "عدد القطع" : "Pieces",
    weight: isArabic ? "الوزن بالكيلو" : "Weight in kg",
    payment: isArabic ? "من يتحمل رسوم التوصيل؟" : "Who pays the delivery fee?",
    collectionAmount: isArabic ? "مبلغ التحصيل من العميل" : "Customer collection amount",
    status: isArabic ? "حالة البداية" : "Initial status",
    notes: isArabic ? "ملاحظات تشغيلية" : "Operations notes",
    save: saving ? (isArabic ? "جارٍ الحفظ في قاعدة البيانات..." : "Saving to database...") : (isArabic ? "حفظ الطلبية في قاعدة البيانات" : "Save shipment to database"),
  };

  const settlementTone = settlement.merchantNet < 0 ? "border-rose-400/30 bg-rose-400/10 text-rose-100" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-brand-sky/20 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold">
            <PackagePlus className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white">{labels.title}</h2>
            <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-white/55">{labels.hint}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-200">
          <Database className="h-4 w-4" />
          {sourceLabel(source, isArabic)}
        </span>
      </div>

      <div className="mb-4 rounded-[1.5rem] border border-brand-gold/20 bg-brand-gold/5 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-brand-gold">
          <ScanLine className="h-5 w-5" />
          {isArabic ? "استيراد بيانات الكوبون بدل الإدخال اليدوي" : "Import coupon data instead of manual entry"}
        </div>
        <p className="mb-3 text-xs font-bold leading-6 text-white/55">
          {isArabic
            ? "ارفع صورة كوبون أو QR/باركود أو ملف CSV/TXT/JSON، أو افتح الكاميرا من الهاتف. سيتم ملء رقم الكوبون واسم العميل والهاتف والعنوان والتحصيل تلقائيًا، ثم تراجع البيانات قبل الحفظ."
            : "Upload a coupon image, QR/barcode, CSV/TXT/JSON file, or open the phone camera. The coupon/reference, receiver name, phone, address, and collection fields are filled automatically for review before saving."}
        </p>
        <input ref={fileInputRef} type="file" accept="image/*,.csv,.txt,.json,text/csv,text/plain,application/json" className="hidden" onChange={handleCouponFile} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCouponFile} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={importing} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/30 bg-brand-deep/80 px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/50 disabled:opacity-60">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {isArabic ? "استيراد ملف أو صورة" : "Import file or image"}
          </button>
          <button type="button" disabled={importing} onClick={() => cameraInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/30 bg-brand-deep/80 px-4 py-3 text-xs font-black text-white transition hover:border-brand-gold/50 disabled:opacity-60">
            <Camera className="h-4 w-4" />
            {isArabic ? "تصوير بالكاميرا" : "Capture with camera"}
          </button>
          <button type="button" disabled={importing} onClick={importFromClipboardText} className="inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep transition hover:-translate-y-0.5 disabled:opacity-60">
            <ScanLine className="h-4 w-4" />
            {isArabic ? "لصق نص الكوبون" : "Paste coupon text"}
          </button>
        </div>
        {importSummary && <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-xs font-bold leading-6 text-emerald-100">{importSummary}</div>}
      </div>

      {message && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}
      {error && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-black text-white/60">{labels.merchant}</span>
          <select className={inputClass()} value={form.merchant_id || ""} onChange={(event) => chooseMerchant(event.target.value)}>
            <option value="">{isArabic ? "اختر تاجرًا من قاعدة البيانات أو أدخل مرسلًا يدويًا" : "Select a merchant from the database or enter a sender manually"}</option>
            {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.trade_name} — {merchant.phone}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.sender}</span><input className={inputClass()} value={form.merchant_name || ""} onChange={(event) => setField("merchant_name", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.coupon}</span><input dir="ltr" className={inputClass()} value={form.coupon_number || ""} onChange={(event) => setField("coupon_number", event.target.value)} /></label>

        <div className="rounded-[1.5rem] border border-brand-gold/15 bg-brand-gold/5 p-3 md:col-span-2 xl:col-span-3">
          <p className="mb-3 flex items-center gap-2 text-xs font-black text-brand-gold"><MapPin className="h-4 w-4" />{isArabic ? "مسار الاستلام والتسليم" : "Pickup and delivery route"}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.pickupEmirate}</span><select className={inputClass()} value={form.pickup_city} onChange={(event) => choosePickupEmirate(event.target.value)}>{UAE_LOCATIONS.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.pickupArea}</span><select className={inputClass()} value={form.pickup_area || ""} onChange={(event) => setField("pickup_area", event.target.value)}>{pickupAreas.map((area) => <option key={area.value} value={area.value}>{optionLabel(area, isArabic)}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.pickupStreet}</span><input className={inputClass()} value={form.pickup_street || ""} onChange={(event) => setField("pickup_street", event.target.value)} placeholder={isArabic ? "مثال: شارع، حي، بناية، فيلا" : "Street, district, building, villa"} /></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.deliveryEmirate}</span><select className={inputClass()} value={form.delivery_city} onChange={(event) => chooseDeliveryEmirate(event.target.value)}>{UAE_LOCATIONS.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.deliveryArea}</span><select className={inputClass()} value={form.delivery_area || ""} onChange={(event) => setField("delivery_area", event.target.value)}>{deliveryAreas.map((area) => <option key={area.value} value={area.value}>{optionLabel(area, isArabic)}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.deliveryStreet}</span><input className={inputClass()} value={form.delivery_street || ""} onChange={(event) => setField("delivery_street", event.target.value)} placeholder={isArabic ? "مثال: شارع، حي، بناية، فيلا" : "Street, district, building, villa"} /></label>
          </div>
        </div>

        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.scope}</span><select className={inputClass()} value={form.shipping_scope} onChange={(event) => setField("shipping_scope", event.target.value as "local" | "international")}><option value="local">{isArabic ? "محلي داخل الإمارات" : "Local within UAE"}</option><option value="international">{isArabic ? "دولي" : "International"}</option></select></label>
        {form.shipping_scope === "international" && <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.destination}</span><select className={inputClass()} value={form.destination_country || "SA"} onChange={(event) => setField("destination_country", event.target.value)}>{destinations.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>}
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.receiver}</span><input className={inputClass()} value={form.receiver_name} onChange={(event) => setField("receiver_name", event.target.value)} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.phone}</span><input dir="ltr" className={inputClass()} value={form.receiver_phone} onChange={(event) => setField("receiver_phone", event.target.value)} /></label>
        <label className="space-y-1 md:col-span-2"><span className="text-xs font-black text-white/60">{labels.address}</span><input className={inputClass()} value={form.receiver_address} onChange={(event) => setField("receiver_address", event.target.value)} placeholder={isArabic ? "تفاصيل إضافية إن وجدت" : "Extra details if needed"} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.package}</span><input className={inputClass()} value={form.package_type} onChange={(event) => { setField("package_type", event.target.value); setField("package_description", event.target.value); }} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.pieces}</span><input type="number" min="1" className={inputClass()} value={form.order_count} onChange={(event) => setField("order_count", Number(event.target.value))} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.weight}</span><input type="number" min="1" step="0.1" className={inputClass()} value={form.weight || 1} onChange={(event) => setField("weight", Number(event.target.value))} /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.payment}</span><select className={inputClass()} value={form.payment_method} onChange={(event) => setField("payment_method", event.target.value)}>{paymentOptions.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.collectionAmount}</span><input type="number" min="0" className={inputClass()} value={form.cod_amount || ""} onChange={(event) => setField("cod_amount", event.target.value)} placeholder="0" /></label>
        <label className="space-y-1"><span className="text-xs font-black text-white/60">{labels.status}</span><select className={inputClass()} value={form.status || "pending"} onChange={(event) => setField("status", event.target.value)}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{optionLabel(item, isArabic)}</option>)}</select></label>
        <label className="space-y-1 md:col-span-2 xl:col-span-3"><span className="text-xs font-black text-white/60">{labels.notes}</span><textarea className={`${inputClass()} min-h-24`} value={form.notes || ""} onChange={(event) => setField("notes", event.target.value)} /></label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-[1.5rem] border border-brand-sky/20 bg-brand-deep/45 p-4 md:grid-cols-3">
        <div><p className="text-[11px] font-black text-white/45">{isArabic ? "تحصيل من العميل" : "Customer collection"}</p><p className="text-lg font-black text-white">{money(settlement.collectionAmount, isArabic)}</p></div>
        <div><p className="text-[11px] font-black text-white/45">{isArabic ? "سعر التوصيل" : "Delivery fee"}</p><p className="text-lg font-black text-brand-gold">{money(settlement.deliveryFee, isArabic)}</p></div>
        <div className={`rounded-2xl border px-4 py-3 ${settlementTone}`}><p className="text-[11px] font-black opacity-70">{isArabic ? "الصافي في كشف التاجر" : "Merchant statement net"}</p><p className="text-lg font-black">{money(settlement.merchantNet, isArabic)}</p></div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || importing} className="inline-flex items-center gap-2 rounded-2xl bg-brand-gold px-5 py-3 text-sm font-black text-brand-deep transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
          <Save className="h-4 w-4" />
          {labels.save}
        </button>
        <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky">
          <ReceiptText className="h-4 w-4" />
          {isArabic ? "رسوم التوصيل المحسوبة" : "Calculated delivery fee"}: {price.total.toFixed(2)} AED
        </span>
      </div>
    </form>
  );
}
