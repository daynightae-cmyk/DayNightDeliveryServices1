import type { OpsOrderInput } from "./adminOperationsData";
import { UAE_LOCATIONS, getDefaultAreaForEmirate } from "../data/uaeLocations";

export type CouponImportResult = {
  fields: Partial<OpsOrderInput>;
  rawText: string;
  source: "text" | "barcode" | "ocr";
  warnings: string[];
};

type TesseractModule = {
  recognize: (
    image: File | Blob | string,
    langs?: string,
    options?: Record<string, unknown>,
  ) => Promise<{ data?: { text?: string } }>;
};

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
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lineText(raw: string) {
  return normalizeDigits(raw)
    .replace(/[\u200f\u200e]/g, "")
    .split(/\r?\n|\|/)
    .map(clean)
    .filter(Boolean);
}

function findLineValue(lines: string[], labels: string[]) {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
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

function firstPhone(text: string) {
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

async function readBarcodeFromImage(file: File): Promise<string> {
  try {
    const Detector = (window as unknown as { BarcodeDetector?: new (options?: unknown) => { detect: (image: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Detector) return "";
    const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    bitmap.close?.();
    return codes.map((code) => code.rawValue).filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

async function readImageWithOcr(file: File): Promise<string> {
  const tesseract = (await import("tesseract.js")) as unknown as TesseractModule;
  const result = await tesseract.recognize(file, "ara+eng", {
    logger: undefined,
  });
  return result.data?.text || "";
}

export async function readCouponFile(file: File): Promise<{ text: string; source: CouponImportResult["source"] }> {
  const type = file.type || "";
  const name = file.name.toLowerCase();

  if (type.startsWith("image/")) {
    const barcode = await readBarcodeFromImage(file);
    if (barcode.trim()) return { text: barcode, source: "barcode" };
    const ocr = await readImageWithOcr(file);
    return { text: ocr, source: "ocr" };
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

  throw new Error("Unsupported coupon file. Use an image, camera photo, TXT, CSV, or JSON file.");
}

export function parseCouponText(rawText: string): CouponImportResult {
  const text = normalizeDigits(rawText || "");
  const lines = lineText(text);
  const warnings: string[] = [];
  const fields: Partial<OpsOrderInput> = {};

  const couponNumber = findCouponNumber(text, lines);
  if (couponNumber) fields.coupon_number = couponNumber;

  const receiverName = findLineValue(lines, ["اسم العميل", "اسم المستلم", "العميل", "المستلم", "customer name", "receiver name", "name"]);
  if (receiverName) fields.receiver_name = receiverName;

  const receiverPhone = findLineValue(lines, ["هاتف العميل", "رقم الهاتف", "تليفون", "موبايل", "mobile", "phone", "telephone"])
    || firstPhone(text);
  if (receiverPhone) fields.receiver_phone = receiverPhone;

  const address = findLineValue(lines, ["عنوان العميل", "عنوان المستلم", "العنوان", "address", "receiver address", "delivery address"]);
  const location = findEmirateAndArea(`${address}\n${text}`);
  if (location.emirate) fields.delivery_city = location.emirate;
  if (location.area) fields.delivery_area = location.area;
  if (address) {
    fields.receiver_address = address;
    fields.delivery_street = address;
  }

  const packageText = findLineValue(lines, ["محتوى الشحنة", "وصف الشحنة", "المنتج", "الصنف", "package", "item", "description"]);
  if (packageText) {
    fields.package_type = packageText;
    fields.package_description = packageText;
  }

  const pieces = findMoney(lines, ["عدد القطع", "القطع", "pieces", "qty", "quantity"]);
  if (pieces) fields.order_count = Math.max(1, Number(pieces) || 1);

  const weight = findMoney(lines, ["الوزن", "weight", "kg"]);
  if (weight) fields.weight = Math.max(1, Number(weight) || 1);

  const total = findMoney(lines, ["الإجمالي", "مجموع الإجمالي", "المجموع", "total", "amount"]);
  const cod = findMoney(lines, ["التحصيل", "مبلغ التحصيل", "تحصيل", "cod", "collection", "collect"]);
  const collectionAmount = cod || total;
  if (collectionAmount) {
    fields.cod_amount = collectionAmount;
    fields.payment_method = Number(collectionAmount) > 0 ? "cod" : "merchant_pays";
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
