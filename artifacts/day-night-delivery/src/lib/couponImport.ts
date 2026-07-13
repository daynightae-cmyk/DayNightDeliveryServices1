import type { OpsOrderInput } from "./adminOperationsData";
import { UAE_LOCATIONS, getDefaultAreaForEmirate } from "../data/uaeLocations";

export type CouponImportResult = {
  fields: Partial<OpsOrderInput>;
  rawText: string;
  source: "text" | "barcode" | "ocr";
  warnings: string[];
};

type CouponFieldKey =
  | "coupon_number"
  | "receiver_name"
  | "receiver_phone"
  | "receiver_address"
  | "delivery_city"
  | "delivery_area"
  | "delivery_street"
  | "package_type"
  | "order_count"
  | "weight"
  | "cod_amount"
  | "status";

type BarcodeDetectorCtor = new (options?: unknown) => {
  detect: (image: ImageBitmap | HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
};

type TextDetectorCtor = new () => {
  detect: (image: ImageBitmap | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
};

type TesseractWorker = {
  recognize: (image: string | Blob | File | HTMLCanvasElement) => Promise<{ data?: { text?: string; confidence?: number } }>;
  setParameters?: (params: Record<string, string>) => Promise<void>;
  terminate: () => Promise<void>;
};

type TesseractModule = {
  recognize?: (
    image: string | Blob | File | HTMLCanvasElement,
    langs?: string,
    options?: Record<string, unknown>,
  ) => Promise<{ data?: { text?: string; confidence?: number } }>;
  createWorker?: (
    langs?: string,
    oem?: number,
    options?: Record<string, unknown>,
  ) => Promise<TesseractWorker>;
};

type OcrTarget = {
  canvas: HTMLCanvasElement;
  psm: "6" | "7" | "11" | "13";
  label?: string;
  whitelist?: string;
};

const TESSERACT_ESM_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js";
const TESSERACT_UMD_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";
const TESSERACT_WORKER_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js";
const TESSERACT_CORE_URL = "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-simd-lstm.wasm.js";
const TESSERACT_LANG_URL = "https://tessdata.projectnaptha.com/4.0.0";
const OCR_SCRIPT_ID = "daynight-tesseract-ocr";

const LABEL_NOISE = /hayak|invoice|amount|delivery|service|total|customer|consignee|address|phone|mobile|receiver|shipper|date|quantity|return|fragile|urgent|cold|area|please|write|بيانات|المرسل|المستلم|العميل|العنوان|الهاتف|الموبايل|التاريخ|الإجمالي|الاجمالي|المجموع|الخدمة|التوصيل|درهم|كمية|مرتجع|هش|عاجل|بارد/i;

function normalizeDigits(value: string) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/[٠-٩۰-۹]/g, (char) => {
    const arabicIndex = arabic.indexOf(char);
    if (arabicIndex >= 0) return String(arabicIndex);
    const persianIndex = persian.indexOf(char);
    return persianIndex >= 0 ? String(persianIndex) : char;
  });
}

function clean(value: unknown) {
  return String(value ?? "").replace(/[\u200f\u200e]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeOcrText(value: string) {
  return normalizeDigits(value)
    .replace(/[|¦]/g, "\n")
    .replace(/[٠-٩۰-۹]/g, (digit) => normalizeDigits(digit))
    .replace(/[؛،]/g, " ")
    .replace(/[ـ]+/g, "")
    .replace(/\bO(?=\d)/g, "0")
    .replace(/(?<=\d)O\b/g, "0");
}

function lineText(raw: string) {
  return normalizeOcrText(raw)
    .split(/\r?\n|\|/)
    .map(clean)
    .filter(Boolean);
}

function escapeRegex(label: string) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findLineValue(lines: string[], labels: string[]) {
  const labelPattern = labels.map(escapeRegex).join("|");
  const regex = new RegExp(`(?:${labelPattern})\\s*[:：\\-]?\\s*(.+)$`, "i");
  for (const line of lines) {
    const match = line.match(regex);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function findMoney(lines: string[], labels: string[]) {
  const value = findLineValue(lines, labels);
  const match = value.match(/-?\d+(?:[.,]\d+)?/);
  return match ? match[0].replace(",", ".") : "";
}

function numericTokens(text: string) {
  return normalizeDigits(text)
    .match(/\b\d+(?:[.,]\d+)?\b/g) || [];
}

function extractUaePhones(text: string) {
  const normalized = normalizeDigits(text).replace(/[OQ]/gi, "0");
  const matches = normalized.match(/(?:\+?971|00971|0)?\s*5\s*\d[\d\s\-().]{6,}\d/g) || [];
  return matches
    .map((phone) => clean(phone).replace(/[^0-9+]/g, ""))
    .map((phone) => phone.startsWith("00971") ? `+${phone.slice(2)}` : phone)
    .filter((phone) => phone.replace(/\D/g, "").length >= 9)
    .sort((a, b) => b.length - a.length);
}

function firstPhone(text: string) {
  const uae = extractUaePhones(text)[0];
  if (uae) return uae;
  const normalized = normalizeDigits(text);
  const matches = normalized.match(/(?:\+|00)?\d[\d\s\-()]{7,}\d/g) || [];
  const best = matches
    .map((phone) => clean(phone).replace(/[()\s-]/g, ""))
    .filter((phone) => phone.length >= 8)
    .sort((a, b) => b.length - a.length)[0];
  return best || "";
}

function findCouponNumber(text: string, lines: string[]) {
  const labeled = findLineValue(lines, [
    "رقم الكوبون",
    "رقم المرجع",
    "رقم التتبع",
    "رقم الطلب",
    "رقم البوليصة",
    "الكوبون",
    "المرجع",
    "coupon",
    "reference",
    "tracking",
    "order number",
  ]);
  if (labeled) return labeled.replace(/[^A-Za-z0-9\-_/]/g, "").slice(0, 40);

  const dn = text.match(/DN[-\s]?(?:\d{4})[-\s]?[A-Z0-9\-]{4,}/i)?.[0];
  if (dn) return dn.replace(/\s+/g, "-").toUpperCase();

  const hayakBarcode = normalizeDigits(text).match(/\b0{1,4}\d{3,8}\b/)?.[0];
  if (hayakBarcode && !extractUaePhones(hayakBarcode).length) return hayakBarcode;

  const compact = normalizeDigits(text).match(/\b[A-Z]{1,5}[-_]?\d{3,}[-_]?[A-Z0-9]{0,12}\b/i)?.[0];
  return compact || "";
}

function findEmirateAndArea(text: string) {
  const normalized = clean(normalizeDigits(text)).toLowerCase();
  for (const emirate of UAE_LOCATIONS) {
    const emirateLabels = [emirate.value, emirate.ar, emirate.en].map((item) => item.toLowerCase());
    const emirateFound = emirateLabels.some((label) => label && normalized.includes(label));
    if (!emirateFound) continue;

    const area = emirate.areas.find((entry) =>
      [entry.value, entry.ar, entry.en]
        .map((item) => item.toLowerCase())
        .some((label) => label && normalized.includes(label)),
    );

    return {
      emirate: emirate.value,
      area: area?.value || getDefaultAreaForEmirate(emirate.value),
    };
  }

  for (const emirate of UAE_LOCATIONS) {
    const area = emirate.areas.find((entry) =>
      [entry.value, entry.ar, entry.en]
        .map((item) => item.toLowerCase())
        .some((label) => label && normalized.includes(label)),
    );
    if (area) return { emirate: emirate.value, area: area.value };
  }

  return { emirate: "", area: "" };
}

function splitRow(row: string) {
  if (row.includes("\t")) return row.split("\t").map(clean);
  if (row.includes(",")) return row.split(",").map(clean);
  if (row.includes(";")) return row.split(";").map(clean);
  return row.split(/\s{2,}/).map(clean);
}

function normalizeHeader(header: string) {
  return clean(header).toLowerCase().replace(/[\s_\-:/]+/g, "");
}

function headerToField(header: string): CouponFieldKey | "delivery_fee" | "net" | "" {
  const h = normalizeHeader(header);
  if (["رقمالكوبون", "رقمالمرجع", "رقمالطلب", "رقمالبوليصة", "coupon", "reference", "tracking", "trackingnumber", "ordernumber"].includes(h)) return "coupon_number";
  if (["اسمالعميل", "اسمالمستلم", "customer", "customername", "receiver", "receivername", "name"].includes(h)) return "receiver_name";
  if (["هاتفالعميل", "رقمالهاتف", "هاتف", "موبايل", "phone", "mobile", "telephone", "receiverphone"].includes(h)) return "receiver_phone";
  if (["عنوانالعميل", "عنوانالمستلم", "العنوان", "address", "receiveraddress", "deliveryaddress"].includes(h)) return "receiver_address";
  if (["الإمارة", "امارة", "الامارة", "emirate", "city", "deliverycity"].includes(h)) return "delivery_city";
  if (["المنطقة", "منطقة", "area", "deliveryarea", "district"].includes(h)) return "delivery_area";
  if (["الشارع", "الحى", "الحي", "الفيلا", "street", "villa", "building", "neighborhood"].includes(h)) return "delivery_street";
  if (["المحتوى", "محتوىالشحنة", "الشحنة", "المنتج", "الصنف", "package", "item", "description"].includes(h)) return "package_type";
  if (["عددالقطع", "القطع", "pieces", "qty", "quantity"].includes(h)) return "order_count";
  if (["الوزن", "weight", "kg"].includes(h)) return "weight";
  if (["الإجمالي", "الاجمالي", "مجموعالإجمالي", "المجموع", "total", "amount", "cod", "collection", "تحصيل", "مبلغالتحصيل"].includes(h)) return "cod_amount";
  if (["سعرالتوصيل", "deliveryfee", "deliveryprice", "deliverycharge"].includes(h)) return "delivery_fee";
  if (["الصافي", "net", "merchantnet"].includes(h)) return "net";
  if (["الحالة", "الحالةالمالية", "status", "financialstatus"].includes(h)) return "status";
  return "";
}

function applyTableValue(fields: Partial<OpsOrderInput>, field: CouponFieldKey, value: string) {
  const cleanValue = clean(value);
  if (!cleanValue) return;
  switch (field) {
    case "receiver_address":
      fields.receiver_address = cleanValue;
      fields.delivery_street = cleanValue;
      break;
    case "package_type":
      fields.package_type = cleanValue;
      fields.package_description = cleanValue;
      break;
    case "order_count":
      fields.order_count = Math.max(1, Number(cleanValue.replace(/[^0-9.]/g, "")) || 1);
      break;
    case "weight":
      fields.weight = Math.max(1, Number(cleanValue.replace(/[^0-9.]/g, "")) || 1);
      break;
    case "cod_amount": {
      const amount = cleanValue.replace(/[^0-9.\-]/g, "");
      fields.cod_amount = amount || cleanValue;
      fields.payment_method = Number(amount || 0) > 0 ? "cod" : "merchant_pays";
      break;
    }
    case "delivery_city": {
      const location = findEmirateAndArea(cleanValue);
      fields.delivery_city = location.emirate || cleanValue;
      if (location.area) fields.delivery_area = location.area;
      break;
    }
    case "delivery_area":
      fields.delivery_area = cleanValue;
      break;
    default:
      fields[field] = cleanValue as never;
      break;
  }
}

function parseDelimitedTable(text: string): Partial<OpsOrderInput> {
  const rows = normalizeDigits(text)
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);

  for (let i = 0; i < rows.length - 1; i += 1) {
    const headers = splitRow(rows[i]);
    const mapped = headers.map(headerToField);
    const meaningful = mapped.filter((field) => field && field !== "delivery_fee" && field !== "net");
    if (headers.length < 2 || meaningful.length < 2) continue;

    const values = splitRow(rows[i + 1]);
    const fields: Partial<OpsOrderInput> = {};
    mapped.forEach((field, index) => {
      if (!field || field === "delivery_fee" || field === "net") return;
      applyTableValue(fields, field, values[index] || "");
    });

    const location = findEmirateAndArea(`${fields.receiver_address || ""} ${fields.delivery_city || ""} ${fields.delivery_area || ""}`);
    if (location.emirate) fields.delivery_city = location.emirate;
    if (location.area) fields.delivery_area = location.area;
    return fields;
  }

  return {};
}

function parseJsonObject(text: string): Partial<OpsOrderInput> {
  try {
    const parsed = JSON.parse(text) as unknown;
    const row = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!row || typeof row !== "object") return {};
    const fields: Partial<OpsOrderInput> = {};
    for (const [header, value] of Object.entries(row as Record<string, unknown>)) {
      const field = headerToField(header);
      if (!field || field === "delivery_fee" || field === "net") continue;
      applyTableValue(fields, field, String(value ?? ""));
    }
    return fields;
  } catch {
    return {};
  }
}

function likelyArabicName(line: string) {
  const value = clean(line).replace(/[0-9:.,/\\_\-]+/g, " ").trim();
  if (!/[\u0600-\u06FF]{2,}/.test(value)) return "";
  if (LABEL_NOISE.test(value)) return "";
  if (value.length < 2 || value.length > 45) return "";
  return value;
}

function likelyAddressLine(line: string) {
  const value = clean(line);
  if (!/[\u0600-\u06FF]{2,}/.test(value)) return "";
  if (/phone|mobile|amount|total|invoice|hayak|هاتف|موبايل|الإجمالي|الاجمالي|المجموع/i.test(value)) return "";
  if (value.length < 5 || value.length > 90) return "";
  if (/(عجمان|دبي|ابوظبي|أبوظبي|الشارقة|العين|الفجيرة|رأس الخيمة|راس الخيمة|ام القيوين|أم القيوين|Ajman|Dubai|Sharjah|Abu Dhabi)/i.test(value)) return value;
  return "";
}

function inferAmounts(text: string) {
  const phones = new Set(extractUaePhones(text).map((phone) => phone.replace(/\D/g, "")));
  const numbers = numericTokens(text)
    .map((token) => token.replace(",", "."))
    .filter((token) => !phones.has(token.replace(/\D/g, "")))
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 20000)
    .filter((value) => value < 1900 || value > 2099);
  const likely = numbers.filter((value) => value > 0 && value <= 5000);
  if (!likely.length) return { collection: "", deliveryFee: "", total: "" };
  const unique = Array.from(new Set(likely));
  const total = Math.max(...unique);
  const deliveryFee = unique.find((value) => value > 0 && value <= 80 && value !== total) || 0;
  const collection = total > 0 ? total : 0;
  return {
    collection: collection ? String(collection) : "",
    deliveryFee: deliveryFee ? String(deliveryFee) : "",
    total: total ? String(total) : "",
  };
}

function parseHayakOrWeakCoupon(text: string, lines: string[]): Partial<OpsOrderInput> {
  const fields: Partial<OpsOrderInput> = {};
  const looksLikeDeliveryCoupon = /hayak|invoice|amount of delivery|delivery service|receiver|customer|consignee|return service|urgent service|هياك|فاتورة|مستلم|مرسل|رقم الكوبون/i.test(text)
    || /\b0{1,4}\d{3,8}\b/.test(normalizeDigits(text));
  if (!looksLikeDeliveryCoupon) return fields;

  const coupon = findCouponNumber(text, lines);
  if (coupon) fields.coupon_number = coupon;

  const phone = firstPhone(text);
  if (phone) fields.receiver_phone = phone;

  const location = findEmirateAndArea(text);
  if (location.emirate) fields.delivery_city = location.emirate;
  if (location.area) fields.delivery_area = location.area;

  const addressLine = lines.map(likelyAddressLine).find(Boolean);
  if (addressLine) {
    fields.receiver_address = addressLine;
    fields.delivery_street = addressLine;
  }

  const nameLine = lines
    .map(likelyArabicName)
    .filter(Boolean)
    .filter((line) => line !== addressLine)
    .sort((a, b) => a.length - b.length)[0];
  if (nameLine) fields.receiver_name = nameLine;

  const amounts = inferAmounts(text);
  if (amounts.total || amounts.collection) {
    fields.cod_amount = amounts.total || amounts.collection;
    fields.payment_method = Number(fields.cod_amount || 0) > 0 ? "cod" : "merchant_pays";
  }

  if (!fields.package_type) {
    const possiblePackage = lines.find((line) => /store|perfume|clothes|box|bag|قطعة|كرتون|شنطة|عطر|ملابس/i.test(line) && !/phone|amount|total|هاتف|الإجمالي|المجموع/i.test(line));
    if (possiblePackage) {
      fields.package_type = clean(possiblePackage).slice(0, 60);
      fields.package_description = fields.package_type;
    }
  }

  return fields;
}

async function imageFileToCanvas(file: File | Blob, mode: "original" | "contrast" | "binary" = "original") {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const upscale = longest < 1600 ? 1600 / Math.max(1, longest) : 1;
  const downscale = longest > 2800 ? 2800 / longest : 1;
  const scale = Math.min(2.25, upscale) * downscale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  if (mode !== "original") {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    const grays = new Uint8Array(data.data.length / 4);
    for (let i = 0, p = 0; i < data.data.length; i += 4, p += 1) {
      const gray = data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114;
      grays[p] = gray;
      sum += gray;
    }
    const mean = sum / Math.max(1, grays.length);
    for (let i = 0, p = 0; i < data.data.length; i += 4, p += 1) {
      let output = grays[p];
      if (mode === "contrast") output = Math.max(0, Math.min(255, (output - 116) * 2.05 + 156));
      if (mode === "binary") output = output > Math.max(98, mean * 0.86) ? 255 : 0;
      data.data[i] = output;
      data.data[i + 1] = output;
      data.data[i + 2] = output;
    }
    ctx.putImageData(data, 0, 0);
  }

  return canvas;
}

function cropCanvas(source: HTMLCanvasElement, x: number, y: number, width: number, height: number, mode: "original" | "contrast" | "binary" = "contrast") {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * width));
  canvas.height = Math.max(1, Math.round(source.height * height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, source.width * x, source.height * y, source.width * width, source.height * height, 0, 0, canvas.width, canvas.height);

  if (mode !== "original") {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    const grays = new Uint8Array(data.data.length / 4);
    for (let i = 0, p = 0; i < data.data.length; i += 4, p += 1) {
      const gray = data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114;
      grays[p] = gray;
      sum += gray;
    }
    const mean = sum / Math.max(1, grays.length);
    for (let i = 0, p = 0; i < data.data.length; i += 4, p += 1) {
      let output = grays[p];
      if (mode === "contrast") output = Math.max(0, Math.min(255, (output - 115) * 2.15 + 158));
      if (mode === "binary") output = output > Math.max(95, mean * 0.84) ? 255 : 0;
      data.data[i] = output;
      data.data[i + 1] = output;
      data.data[i + 2] = output;
    }
    ctx.putImageData(data, 0, 0);
  }

  return canvas;
}

function couponLayoutTargets(original: HTMLCanvasElement, contrast: HTMLCanvasElement, binary: HTMLCanvasElement): OcrTarget[] {
  const ratio = original.width / Math.max(1, original.height);
  const base: OcrTarget[] = [
    { canvas: original, psm: "6", label: "full-original" },
    { canvas: contrast, psm: "6", label: "full-contrast" },
    { canvas: binary, psm: "11", label: "full-binary" },
  ];

  if (ratio < 1.7) return base;

  return [
    ...base,
    { canvas: cropCanvas(contrast, 0.12, 0.52, 0.28, 0.33, "binary"), psm: "7", label: "barcode", whitelist: "0123456789" },
    { canvas: cropCanvas(contrast, 0.40, 0.18, 0.43, 0.40, "contrast"), psm: "6", label: "receiver-zone" },
    { canvas: cropCanvas(binary, 0.40, 0.18, 0.43, 0.40, "binary"), psm: "11", label: "receiver-zone-binary" },
    { canvas: cropCanvas(contrast, 0.84, 0.18, 0.15, 0.48, "binary"), psm: "6", label: "amounts", whitelist: "0123456789." },
    { canvas: cropCanvas(contrast, 0.02, 0.16, 0.36, 0.40, "contrast"), psm: "6", label: "sender-package" },
    { canvas: cropCanvas(contrast, 0.00, 0.00, 0.28, 0.18, "binary"), psm: "6", label: "top-left", whitelist: "+0123456789" },
    { canvas: cropCanvas(contrast, 0.70, 0.00, 0.30, 0.24, "contrast"), psm: "6", label: "top-right" },
  ];
}

async function readBarcodeFromImage(file: File): Promise<string> {
  try {
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) return "";
    const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"] });
    const original = await imageFileToCanvas(file, "original");
    const contrast = await imageFileToCanvas(file, "contrast");
    const barcodeCrop = cropCanvas(contrast, 0.10, 0.50, 0.32, 0.37, "binary");
    const attempts = [original, contrast, barcodeCrop];
    const found = new Set<string>();
    for (const canvas of attempts) {
      const codes = await detector.detect(canvas);
      codes.map((code) => code.rawValue).filter(Boolean).forEach((value) => found.add(String(value)));
    }
    return Array.from(found).join("\n");
  } catch {
    return "";
  }
}

async function readImageWithNativeTextDetector(file: File): Promise<string> {
  try {
    const TextDetector = (window as unknown as { TextDetector?: TextDetectorCtor }).TextDetector;
    if (!TextDetector) return "";
    const detector = new TextDetector();
    const canvas = await imageFileToCanvas(file, "contrast");
    const detections = await detector.detect(canvas);
    return detections.map((item) => item.rawValue).filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

function getGlobalTesseract() {
  return (window as unknown as { Tesseract?: TesseractModule }).Tesseract;
}

function loadScriptOnce(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadTesseract(): Promise<TesseractModule | null> {
  const loaded = getGlobalTesseract();
  if (loaded) return loaded;

  try {
    return (await import(/* @vite-ignore */ TESSERACT_ESM_URL)) as TesseractModule;
  } catch (esmError) {
    console.warn("Coupon OCR ESM load failed, trying browser bundle:", esmError);
  }

  try {
    await loadScriptOnce(TESSERACT_UMD_URL, OCR_SCRIPT_ID);
    return getGlobalTesseract() || null;
  } catch (scriptError) {
    console.warn("Coupon OCR script load failed:", scriptError);
    return null;
  }
}

function textScore(value: string) {
  const text = normalizeDigits(value || "");
  const labels = /(رقم|اسم|هاتف|عنوان|عميل|مستلم|درهم|AED|total|phone|address|customer|receiver|coupon|tracking|hayak|invoice)/i.test(text) ? 120 : 0;
  const digits = (text.match(/\d/g) || []).length * 4;
  const letters = (text.match(/[A-Za-z\u0600-\u06FF]/g) || []).length;
  return labels + digits + letters;
}

function bestText(values: string[]) {
  return values.map((value) => value || "").sort((a, b) => textScore(b) - textScore(a))[0] || "";
}

async function recognizeTargetsWithTesseract(targets: OcrTarget[]): Promise<string[]> {
  const tesseract = await loadTesseract();
  if (!tesseract) return [];

  const outputs: string[] = [];
  const options = {
    workerPath: TESSERACT_WORKER_URL,
    corePath: TESSERACT_CORE_URL,
    langPath: TESSERACT_LANG_URL,
    cacheMethod: "none",
    logger: () => undefined,
  };

  if (tesseract.createWorker) {
    let worker: TesseractWorker | null = null;
    try {
      worker = await tesseract.createWorker("eng+ara", 1, options);
      for (const target of targets) {
        await worker.setParameters?.({
          tessedit_pageseg_mode: target.psm,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
          ...(target.whitelist ? { tessedit_char_whitelist: target.whitelist } : {}),
        });
        const result = await worker.recognize(target.canvas);
        const text = result.data?.text || "";
        if (text.trim()) outputs.push(`${target.label || "zone"}:\n${text}`);
      }
    } catch (workerError) {
      console.warn("Coupon OCR worker failed:", workerError);
    } finally {
      await worker?.terminate().catch(() => undefined);
    }
  }

  if (!bestText(outputs).trim() && tesseract.recognize) {
    for (const target of targets) {
      try {
        const result = await tesseract.recognize(target.canvas, "eng+ara", {
          ...options,
          tessedit_pageseg_mode: target.psm,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
          ...(target.whitelist ? { tessedit_char_whitelist: target.whitelist } : {}),
        });
        const text = result.data?.text || "";
        if (text.trim()) outputs.push(`${target.label || "zone"}:\n${text}`);
      } catch (recognizeError) {
        console.warn("Coupon OCR recognize failed:", recognizeError);
      }
    }
  }

  return outputs;
}

async function readImageWithTesseract(file: File): Promise<string> {
  const original = await imageFileToCanvas(file, "original");
  const contrast = await imageFileToCanvas(file, "contrast");
  const binary = await imageFileToCanvas(file, "binary");
  const targets = couponLayoutTargets(original, contrast, binary);
  const outputs = await recognizeTargetsWithTesseract(targets);
  return outputs.join("\n");
}

export async function readCouponFile(file: File): Promise<{ text: string; source: CouponImportResult["source"] }> {
  const type = file.type || "";
  const name = file.name.toLowerCase();

  if (type.startsWith("image/")) {
    const barcode = await readBarcodeFromImage(file);
    const nativeText = await readImageWithNativeTextDetector(file);
    const ocrText = await readImageWithTesseract(file);
    const combined = [barcode && `barcode:\n${barcode}`, nativeText && `native-text:\n${nativeText}`, ocrText && `ocr:\n${ocrText}`]
      .filter(Boolean)
      .join("\n");

    if (combined.trim()) return { text: combined, source: ocrText.trim() || nativeText.trim() ? "ocr" : "barcode" };

    throw new Error("لم يتم استخراج بيانات من الصورة. لم يصل OCR إلى نص مقروء داخل الصورة. جرّب تصوير الكوبون قريبًا ومباشرًا بدون ميل أو لمعان، أو ارفع CSV/TXT/JSON.");
  }

  if (
    type.includes("json") ||
    type.includes("csv") ||
    type.includes("text") ||
    name.endsWith(".json") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt")
  ) {
    return { text: await file.text(), source: "text" };
  }

  throw new Error("نوع الملف غير مدعوم. استخدم صورة واضحة، QR/باركود، أو ملف CSV/TXT/JSON.");
}

export function parseCouponText(rawText: string): CouponImportResult {
  const text = normalizeOcrText(rawText || "");
  const lines = lineText(text);
  const warnings: string[] = [];
  const weakCouponFields = parseHayakOrWeakCoupon(text, lines);
  const tableFields = { ...parseDelimitedTable(text), ...parseJsonObject(text) };
  const fields: Partial<OpsOrderInput> = { ...weakCouponFields, ...tableFields };

  const couponNumber = fields.coupon_number || findCouponNumber(text, lines);
  if (couponNumber) fields.coupon_number = couponNumber;

  const receiverName = fields.receiver_name || findLineValue(lines, ["اسم العميل", "اسم المستلم", "العميل", "المستلم", "customer name", "receiver name", "consignee", "name"]);
  if (receiverName) fields.receiver_name = receiverName;

  const receiverPhone = fields.receiver_phone || findLineValue(lines, ["هاتف العميل", "رقم الهاتف", "تليفون", "موبايل", "mobile", "phone", "telephone"])
    || firstPhone(text);
  if (receiverPhone) fields.receiver_phone = receiverPhone;

  const address = fields.receiver_address || findLineValue(lines, ["عنوان العميل", "عنوان المستلم", "العنوان", "address", "receiver address", "delivery address", "customer address"]);
  const location = findEmirateAndArea(`${address || ""}\n${fields.delivery_city || ""}\n${fields.delivery_area || ""}\n${text}`);
  if (location.emirate) fields.delivery_city = location.emirate;
  if (location.area) fields.delivery_area = location.area;
  if (address) {
    fields.receiver_address = address;
    fields.delivery_street = fields.delivery_street || address;
  }

  const packageText = fields.package_type || findLineValue(lines, ["محتوى الشحنة", "وصف الشحنة", "المنتج", "الصنف", "package", "item", "description", "shipper"]);
  if (packageText) {
    fields.package_type = packageText;
    fields.package_description = fields.package_description || packageText;
  }

  if (!fields.order_count) {
    const pieces = findMoney(lines, ["عدد القطع", "القطع", "pieces", "qty", "quantity"]);
    if (pieces) fields.order_count = Math.max(1, Number(pieces) || 1);
  }

  if (!fields.weight) {
    const weight = findMoney(lines, ["الوزن", "weight", "kg"]);
    if (weight) fields.weight = Math.max(1, Number(weight) || 1);
  }

  if (fields.cod_amount === undefined || fields.cod_amount === "") {
    const total = findMoney(lines, ["الإجمالي", "الاجمالي", "مجموع الإجمالي", "المجموع", "total", "amount"]);
    const cod = findMoney(lines, ["التحصيل", "مبلغ التحصيل", "تحصيل", "cod", "collection", "collect", "amount of delivery"]);
    const inferred = inferAmounts(text).total;
    const collectionAmount = cod || total || inferred;
    if (collectionAmount) {
      fields.cod_amount = collectionAmount;
      fields.payment_method = Number(collectionAmount) > 0 ? "cod" : "merchant_pays";
    }
  }

  const notes: string[] = [];
  if (fields.coupon_number) notes.push(`Imported coupon/reference: ${fields.coupon_number}`);
  notes.push("Imported from coupon scan/file. Review all fields before saving.");
  fields.notes = notes.join("\n");

  if (!fields.receiver_name) warnings.push("receiver_name");
  if (!fields.receiver_phone) warnings.push("receiver_phone");
  if (!fields.receiver_address && !fields.delivery_street) warnings.push("address");
  if (!fields.coupon_number) warnings.push("coupon_number");

  return { fields, rawText: text, source: "text", warnings };
}

export async function importCouponFile(file: File): Promise<CouponImportResult> {
  const read = await readCouponFile(file);
  const parsed = parseCouponText(read.text);
  return { ...parsed, source: read.source };
}
