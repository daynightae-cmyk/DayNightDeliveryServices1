from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_text_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one occurrence, found {count}: {old[:120]!r}")
    return content.replace(old, new, 1)


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    write(path, replace_text_once(content, old, new, path))


template = read("scripts/export-localization-template.ts.txt")
template = replace_text_once(
    template,
    '''export function localizedOrderAddress(order: Order, language: ExportDocumentLanguage, side: "sender" | "receiver" = "receiver") {
  const record = order as FlexibleOrder;
  return localizedPart(record, language,
    side === "receiver" ? ["receiver_address_ar", "delivery_address_ar", "receiver_area_ar", "delivery_area_ar", "receiver_landmark_ar", "delivery_landmark_ar"] : ["sender_address_ar", "pickup_address_ar", "sender_area_ar", "pickup_area_ar", "sender_landmark_ar", "pickup_landmark_ar"],
    side === "receiver" ? ["receiver_address", "delivery_address", "receiver_area", "delivery_area", "receiver_landmark", "delivery_landmark"] : ["sender_address", "pickup_address", "sender_area", "pickup_area", "sender_landmark", "pickup_landmark"]);
}''',
    '''function combineAddressParts(parts: string[]) {
  const combined: string[] = [];
  for (const rawPart of parts) {
    const part = clean(rawPart);
    if (!part || part === EMPTY) continue;
    const normalized = part.replace(/\\s+/g, " ").trim();
    if (combined.some((existing) => existing === normalized || existing.includes(normalized) || normalized.includes(existing))) continue;
    combined.push(normalized);
  }
  return combined.join("، ") || EMPTY;
}

export function localizedOrderAddress(order: Order, language: ExportDocumentLanguage, side: "sender" | "receiver" = "receiver") {
  const record = order as FlexibleOrder;
  const fullArabicKeys = side === "receiver"
    ? ["receiver_address_ar", "delivery_address_ar"]
    : ["sender_address_ar", "pickup_address_ar"];
  const partialArabicKeys = side === "receiver"
    ? ["receiver_area_ar", "delivery_area_ar", "receiver_landmark_ar", "delivery_landmark_ar"]
    : ["sender_area_ar", "pickup_area_ar", "sender_landmark_ar", "pickup_landmark_ar"];
  const fallbackKeys = side === "receiver"
    ? ["receiver_address", "delivery_address", "receiver_area", "delivery_area", "receiver_landmark", "delivery_landmark"]
    : ["sender_address", "pickup_address", "sender_area", "pickup_area", "sender_landmark", "pickup_landmark"];
  const fallback = localizeExportText(explicitText(record, fallbackKeys), language);
  if (language !== "ar") return fallback;

  const fullArabic = explicitText(record, fullArabicKeys);
  const partialArabic = partialArabicKeys.map((key) => clean(record[key])).filter(Boolean);
  return combineAddressParts([fullArabic || fallback, ...partialArabic]);
}''',
    "export localization template address contract",
)
for function_name in (
    "localizedOrderStatus",
    "localizedPaymentMethod",
    "localizedServiceType",
    "localizedPackageType",
):
    template = replace_text_once(
        template,
        f'''export function {function_name}(value: unknown, language: ExportDocumentLanguage) {{
  if (language !== "ar") return clean(value).replace(/_/g, " ") || EMPTY;''',
        f'''export function {function_name}(value: unknown, language: ExportDocumentLanguage) {{
  if (language !== "ar") return clean(value) || EMPTY;''',
        f"{function_name} English preservation contract",
    )
write("src/lib/exportLocalization.ts", template)

# Remove the accidental zero-impact placeholder through the reviewed source PR.
placeholder = ROOT / "scripts/.tmp"
if placeholder.exists():
    placeholder.unlink()

replace_once("src/types.ts", "  sender_city: string;\n  sender_address: string;\n", "  sender_city: string;\n  sender_address: string;\n  sender_emirate?: string;\n  sender_area?: string;\n  sender_landmark?: string;\n  sender_city_ar?: string;\n  sender_emirate_ar?: string;\n  sender_area_ar?: string;\n  sender_address_ar?: string;\n  sender_landmark_ar?: string;\n")
replace_once("src/types.ts", "  receiver_city: string;\n  receiver_address: string;\n", "  receiver_city: string;\n  receiver_address: string;\n  receiver_emirate?: string;\n  receiver_area?: string;\n  receiver_landmark?: string;\n  receiver_city_ar?: string;\n  receiver_emirate_ar?: string;\n  receiver_area_ar?: string;\n  receiver_address_ar?: string;\n  receiver_landmark_ar?: string;\n  destination_country_ar?: string;\n")

replace_once("src/lib/merchantStatementExport.ts", 'import { jsPDF } from "jspdf";\n', 'import { jsPDF } from "jspdf";\nimport { localizeExportText, localizedOrderStatus } from "./exportLocalization";\n')
replace_once("src/lib/merchantStatementExport.ts", "  const rows = payload.rows.map(normalizeStatementRow);\n  return {\n    ...payload,\n    rows,\n    totals: {", "  const rows = payload.rows.map(normalizeStatementRow).map((row) => ({\n    ...row,\n    destination: localizeExportText(row.destination, payload.language),\n    status: row.status ? localizedOrderStatus(row.status, payload.language) : row.status,\n  }));\n  return {\n    ...payload,\n    merchant: {\n      ...payload.merchant,\n      location: payload.merchant.location ? localizeExportText(payload.merchant.location, payload.language) : payload.merchant.location,\n      address: payload.merchant.address ? localizeExportText(payload.merchant.address, payload.language) : payload.merchant.address,\n    },\n    rows,\n    totals: {")

replace_once("src/lib/adminPdfExport.ts", 'import { jsPDF } from "jspdf";\n', 'import { jsPDF } from "jspdf";\nimport { localizeExportField } from "./exportLocalization";\n')
replace_once("src/lib/adminPdfExport.ts", "function visibleColumns(payload: AdminPdfPayload) {", "function localizedCell(payload: AdminPdfPayload, column: AdminPdfColumn, value: unknown) {\n  return localizeExportField(column.key, column.label, value, payload.language);\n}\n\nfunction visibleColumns(payload: AdminPdfPayload) {")
replace_once("src/lib/adminPdfExport.ts", '${rows.map((row) => `<tr>${columns.map((column) => `<td>${html(row[column.key])}</td>`).join("")}</tr>`).join("")}', '${rows.map((row) => `<tr>${columns.map((column) => `<td>${html(localizedCell(payload, column, row[column.key]))}</td>`).join("")}</tr>`).join("")}')
replace_once("src/lib/adminPdfExport.ts", '  const rows = safeRows(payload).map((row) => columns.map((column) => csvValue(row[column.key])).join(","));', '  const rows = safeRows(payload).map((row) => columns.map((column) => csvValue(localizedCell(payload, column, row[column.key]))).join(","));')
replace_once("src/lib/adminPdfExport.ts", "        const value = row[column.key];", "        const value = localizedCell(payload, column, row[column.key]);")

replace_once("src/components/admin/AdminMerchantStatementsCenter.tsx", 'import type { MerchantStatementPayload } from "../../lib/merchantStatementExport";\n', 'import type { MerchantStatementPayload } from "../../lib/merchantStatementExport";\nimport { localizeExportText, localizedOrderDestination } from "../../lib/exportLocalization";\n')
replace_once("src/components/admin/AdminMerchantStatementsCenter.tsx", 'function routeText(order: Order) {\n  return [order.receiver_city || order.destination_country, order.receiver_address]\n    .filter(Boolean)\n    .join("، ") || "—";\n}', 'function routeText(order: Order, isArabic: boolean) {\n  return localizedOrderDestination(order, isArabic ? "ar" : "en");\n}')
content = read("src/components/admin/AdminMerchantStatementsCenter.tsx")
if "routeText(order)" not in content:
    raise SystemExit("AdminMerchantStatementsCenter.tsx: routeText call missing")
write("src/components/admin/AdminMerchantStatementsCenter.tsx", content.replace("routeText(order)", "routeText(order, isArabic)"))
replace_once("src/components/admin/AdminMerchantStatementsCenter.tsx", '        location: [merchant?.emirate, merchant?.city].filter(Boolean).join("، "),\n        address: merchant?.address || merchant?.pickup_address,', '        location: localizeExportText([merchant?.emirate, merchant?.city].filter(Boolean).join("، "), isArabic ? "ar" : "en"),\n        address: localizeExportText(merchant?.address || merchant?.pickup_address, isArabic ? "ar" : "en"),')

replace_once("src/components/admin/AdminOrderBulkOperations.tsx", 'import type { AdminPdfPayload } from "../../lib/adminPdfExport";\n', 'import type { AdminPdfPayload } from "../../lib/adminPdfExport";\nimport { localizedOrderRoute } from "../../lib/exportLocalization";\n')
replace_once("src/components/admin/AdminOrderBulkOperations.tsx", '      route: `${clean(order.sender_city) || "—"} → ${clean(order.receiver_city || order.destination_country) || "—"}`,', '      route: localizedOrderRoute(order, isArabic ? "ar" : "en"),')
replace_once("src/components/admin/AdminOrderBulkOperations.tsx", '${escapeHtml(order.sender_city || "—")} → ${escapeHtml(order.receiver_city || order.destination_country || "—")}', '${escapeHtml(localizedOrderRoute(order, isArabic ? "ar" : "en"))}')

replace_once("src/lib/invoice.ts", 'import { supabase } from "../supabase";\n', 'import { supabase } from "../supabase";\nimport { localizeExportText, localizedOrderAddress, localizedOrderCity, localizedOrderRoute, localizedOrderStatus, localizedPackageType, localizedPaymentMethod, localizedServiceType } from "./exportLocalization";\n')
replace_once("src/lib/invoice.ts", '      senderCity: safeText(order.sender_city),\n      senderAddress: safeText(order.sender_address),', '      senderCity: localizedOrderCity(order, lang, "sender"),\n      senderAddress: localizedOrderAddress(order, lang, "sender"),')
replace_once("src/lib/invoice.ts", '      receiverCity: safeText(order.receiver_city),\n      receiverAddress: safeText(order.receiver_address),', '      receiverCity: localizedOrderCity(order, lang, "receiver"),\n      receiverAddress: localizedOrderAddress(order, lang, "receiver"),')
replace_once("src/lib/invoice.ts", '      packageType: safeText(order.package_type),', '      packageType: localizedPackageType(order.package_type, lang),')
replace_once("src/lib/invoice.ts", '      description: safeText(order.package_description || order.package_type || order.notes),', '      description: order.package_description\n        ? localizeExportText(order.package_description, lang)\n        : localizedPackageType(order.package_type || "shipment", lang),')
replace_once("src/lib/invoice.ts", '      serviceType: safeText(order.service_type || "Standard"),\n      fromCity: safeText(order.sender_city),\n      toCity: safeText(order.receiver_city),\n      route: `${safeText(order.sender_city)} → ${safeText(order.receiver_city)}`,\n      status: safeText(order.status),\n      paymentMethod: safeText(order.payment_method),', '      serviceType: localizedServiceType(order.service_type || "standard", lang),\n      fromCity: localizedOrderCity(order, lang, "sender"),\n      toCity: localizedOrderCity(order, lang, "receiver"),\n      route: localizedOrderRoute(order, lang),\n      status: localizedOrderStatus(order.status, lang),\n      paymentMethod: localizedPaymentMethod(order.payment_method, lang),')

replace_once("src/lib/printableDocuments.ts", 'import type { ExportLanguage, OrderPDFData } from "./exportUtils";\n', 'import type { ExportLanguage, OrderPDFData } from "./exportUtils";\nimport { localizeExportText, localizedPackageType, localizedPaymentMethod, localizedServiceType } from "./exportLocalization";\n')
replace_once("src/lib/printableDocuments.ts", '  const trackUrl = `${companyMeta.website}/tracking?code=${encodeURIComponent(invoice)}`;\n  const body =', '  const trackUrl = `${companyMeta.website}/tracking?code=${encodeURIComponent(invoice)}`;\n  const senderCity = localizeExportText(data.senderCity, language);\n  const senderAddress = localizeExportText(data.senderAddress, language);\n  const receiverCity = localizeExportText(data.receiverCity, language);\n  const receiverAddress = localizeExportText(data.receiverAddress, language);\n  const packageType = localizedPackageType(data.packageType, language);\n  const serviceType = localizedServiceType(data.serviceType, language);\n  const paymentMethod = localizedPaymentMethod(data.paymentMethod, language);\n  const body =')
for old, new in [
    ('${escapeHtml(data.senderCity)} → ${escapeHtml(data.receiverCity)}', '${escapeHtml(senderCity)} → ${escapeHtml(receiverCity)}'),
    ('${escapeHtml(data.senderCity)}<br/>${L.address}: ${escapeHtml(data.senderAddress)}', '${escapeHtml(senderCity)}<br/>${L.address}: ${escapeHtml(senderAddress)}'),
    ('${escapeHtml(data.receiverCity)}<br/>${L.address}: ${escapeHtml(data.receiverAddress)}', '${escapeHtml(receiverCity)}<br/>${L.address}: ${escapeHtml(receiverAddress)}'),
    ('${escapeHtml(data.packageType)}</td><td>${escapeHtml(data.serviceType)}</td><td>${escapeHtml(data.paymentMethod.replace(/_/g, " "))}', '${escapeHtml(packageType)}</td><td>${escapeHtml(serviceType)}</td><td>${escapeHtml(paymentMethod)}'),
]:
    replace_once("src/lib/printableDocuments.ts", old, new)

replace_once("src/lib/exportUtils.ts", 'import { orderInvoiceNumber, printOrderDocument } from "./printableDocuments";\n', 'import { orderInvoiceNumber, printOrderDocument } from "./printableDocuments";\nimport { localizeExportText, localizedPackageType, localizedPaymentMethod } from "./exportLocalization";\n')
replace_once("src/lib/exportUtils.ts", '  const invoiceNo = orderInvoiceNumber(data);\n  const isArabic = language === "ar";\n  const lines = isArabic ? [', '  const invoiceNo = orderInvoiceNumber(data);\n  const isArabic = language === "ar";\n  const senderCity = localizeExportText(data.senderCity, language);\n  const senderAddress = localizeExportText(data.senderAddress, language);\n  const receiverCity = localizeExportText(data.receiverCity, language);\n  const receiverAddress = localizeExportText(data.receiverAddress, language);\n  const packageType = localizedPackageType(data.packageType, language);\n  const paymentMethod = localizedPaymentMethod(data.paymentMethod, language);\n  const lines = isArabic ? [')
for old, new in [
    ('`عنوان المرسل: ${data.senderCity} - ${data.senderAddress}`', '`عنوان المرسل: ${senderCity} - ${senderAddress}`'),
    ('`عنوان المستلم: ${data.receiverCity} - ${data.receiverAddress}`', '`عنوان المستلم: ${receiverCity} - ${receiverAddress}`'),
    ('`الشحنة: ${data.packageType}`', '`الشحنة: ${packageType}`'),
    ('`الدفع: ${data.paymentMethod}`', '`الدفع: ${paymentMethod}`'),
    ('`Sender Address: ${data.senderCity} - ${data.senderAddress}`', '`Sender Address: ${senderCity} - ${senderAddress}`'),
    ('`Receiver Address: ${data.receiverCity} - ${data.receiverAddress}`', '`Receiver Address: ${receiverCity} - ${receiverAddress}`'),
]:
    replace_once("src/lib/exportUtils.ts", old, new)

write("scripts/export-language-policy-gate.mjs", '''import fs from "node:fs";
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [
  ["src/lib/exportLocalization.ts", "localizedOrderDestination"],
  ["src/lib/exportLocalization.ts", "const partialArabic = partialArabicKeys.map"],
  ["src/lib/exportLocalization.ts", "return combineAddressParts([fullArabic || fallback, ...partialArabic])"],
  ["src/lib/adminPdfExport.ts", "localizedCell(payload, column"],
  ["src/lib/adminPdfExport.ts", "csvValue(localizedCell"],
  ["src/lib/merchantStatementExport.ts", "destination: localizeExportText"],
  ["src/components/admin/AdminMerchantStatementsCenter.tsx", "localizedOrderDestination(order"],
  ["src/components/admin/AdminOrderBulkOperations.tsx", "localizedOrderRoute(order"],
  ["src/lib/invoice.ts", "localizedOrderAddress(order, lang"],
  ["src/lib/invoice.ts", "localizeExportText(order.package_description, lang)"],
  ["src/lib/printableDocuments.ts", "const receiverAddress = localizeExportText"],
  ["src/lib/exportUtils.ts", "const receiverAddress = localizeExportText"],
  ["src/types.ts", "receiver_address_ar?: string"],
];
for (const [path, marker] of checks) { if (!read(path).includes(marker)) throw new Error(`${path}: missing ${marker}`); }
const localization = read("src/lib/exportLocalization.ts");
const englishPreservationCount = (localization.match(/if \(language !== "ar"\) return clean\(value\) \|\| EMPTY;/g) || []).length;
if (englishPreservationCount !== 4) throw new Error(`Expected 4 English enum preservation guards, found ${englishPreservationCount}`);
console.log("Export language policy gate passed.");
''')

print("Export language policy patch applied.")
