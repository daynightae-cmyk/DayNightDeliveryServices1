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
  if (["رقمالكوبون", "رقمالمرجع", "رقمالطلب", "coupon", "reference", "tracking", "trackingnumber", "ordernumber"].includes(h)) return "coupon_number";
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
  if (field === "receiver_address") {
    fields.receiver_address = cleanValue;
    fields.delivery_street = cleanValue;
    return;
  }
  if (field === "package_type") {
    fields.package_type = cleanValue;
    fields.package_description = cleanValue;
    return;
  }
  if (field === "order_count") {
    fields.order_count = Math.max(1, Number(cleanValue.replace(/[^0-9.]/g, "")) || 1);
    return;
  }
  if (field === "weight") {
    fields.weight = Math.max(1, Number(cleanValue.replace(/[^0-9.]/g, "")) || 1);
    return;
  }
  if (field === "cod_amount") {
    const amount = cleanValue.replace(/[^0-9.\-]/g, "");
    fields.cod_amount = amount || cleanValue;
    fields.payment_method = Number(amount || 0) > 0 ? "cod" : "merchant_pays";
    return;
  }
  if (field === "delivery_city") {
    const location = findEmirateAndArea(cleanValue);
    fields.delivery_city = location.emirate || cleanValue;
    if (location.area) fields.delivery_area = location.area;
    return;
  }
  if (field === "delivery_area") {
    fields.delivery_area = cleanValue;
    return;
  }
  fields[field] = cleanValue as never;
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
    const entries = Object.entries(row as Record<string, unknown>);
    const fields: Partial<OpsOrderInput> = {};
    for (const [header, value] of entries) {
      const field = headerToField(header);
      if (!field || field === "delivery_fee" || field === "net") continue;
      applyTableValue(fields, field, String(value ?? ""));
    }
    return fields;
  } catch {
    return {};
  }
}

async function readBarcodeFromImage(file: File): Promise<string> {
  try {
    const Detector = (window as unknown as { BarcodeDetector?: new (options?: unknown) => { detect: (image: ImageBitmap | HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
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

async function readImageWithNativeTextDetector(file: File): Promise<string> {
  try {
    const TextDetector = (window as unknown as { TextDetector?: new () => { detect: (image: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).TextDetector;
    if (!TextDetector) return "";
    const detector = new TextDetector();
    const bitmap = await createImageBitmap(file);
    const detections = await detector.detect(bitmap);
    bitmap.close?.();
    return detections.map((item) => item.rawValue).filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

export async function readCouponFile(file: File): Promise<{ text: string; source: CouponImportResult["source"] }> {
  const type = file.type || "";
  const name = file.name.toLowerCase();

  if (type.startsWith("image/")) {
    const barcode = await readBarcodeFromImage(file);
    if (barcode.trim()) return { text: barcode, source: "barcode" };
    const nativeText = await readImageWithNativeTextDetector(file);
    if (nativeText.trim()) return { text: nativeText, source: "ocr" };
    throw new Error("لم يتم العثور على QR أو باركود أو نص مقروء في الصورة. صوّر الكوبون بوضوح أو ارفعه كملف CSV/TXT/JSON.");
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

  throw new Error("Unsupported coupon file. Use an image with QR/barcode/readable text, camera photo, TXT, CSV, or JSON file.");
}

export function parseCouponText(rawText: string): CouponImportResult {
  const text = normalizeDigits(rawText || "");
  const lines = lineText(text);
  const warnings: string[] = [];
  const tableFields = { ...parseDelimitedTable(text), ...parseJsonObject(text) };
  const fields: Partial<OpsOrderInput> = { ...tableFields };

  const couponNumber = fields.coupon_number || findCouponNumber(text, lines);
  if (couponNumber) fields.coupon_number = couponNumber;

  const receiverName = fields.receiver_name || findLineValue(lines, ["اسم العميل", "اسم المستلم", "العميل", "المستلم", "customer name", "receiver name", "name"]);
  if (receiverName) fields.receiver_name = receiverName;

  const receiverPhone = fields.receiver_phone || findLineValue(lines, ["هاتف العميل", "رقم الهاتف", "تليفون", "موبايل", "mobile", "phone", "telephone"])
    || firstPhone(text);
  if (receiverPhone) fields.receiver_phone = receiverPhone;

  const address = fields.receiver_address || findLineValue(lines, ["عنوان العميل", "عنوان المستلم", "العنوان", "address", "receiver address", "delivery address"]);
  const location = findEmirateAndArea(`${address || ""}\n${fields.delivery_city || ""}\n${fields.delivery_area || ""}\n${text}`);
  if (location.emirate) fields.delivery_city = location.emirate;
  if (location.area) fields.delivery_area = location.area;
  if (address) {
    fields.receiver_address = address;
    fields.delivery_street = fields.delivery_street || address;
  }

  const packageText = fields.package_type || findLineValue(lines, ["محتوى الشحنة", "وصف الشحنة", "المنتج", "الصنف", "package", "item", "description"]);
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
    const total = findMoney(lines, ["الإجمالي", "مجموع الإجمالي", "المجموع", "total", "amount"]);
    const cod = findMoney(lines, ["التحصيل", "مبلغ التحصيل", "تحصيل", "cod", "collection", "collect"]);
    const collectionAmount = cod || total;
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
