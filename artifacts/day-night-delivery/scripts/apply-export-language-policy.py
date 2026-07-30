from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


template = read("scripts/export-localization-template.ts.txt")
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

replace_once("src/lib/invoice.ts", 'import { supabase } from "../supabase";\n', 'import { supabase } from "../supabase";\nimport { localizedOrderAddress, localizedOrderCity, localizedOrderRoute, localizedOrderStatus, localizedPackageType, localizedPaymentMethod, localizedServiceType } from "./exportLocalization";\n')
replace_once("src/lib/invoice.ts", '      senderCity: safeText(order.sender_city),\n      senderAddress: safeText(order.sender_address),', '      senderCity: localizedOrderCity(order, lang, "sender"),\n      senderAddress: localizedOrderAddress(order, lang, "sender"),')
replace_once("src/lib/invoice.ts", '      receiverCity: safeText(order.receiver_city),\n      receiverAddress: safeText(order.receiver_address),', '      receiverCity: localizedOrderCity(order, lang, "receiver"),\n      receiverAddress: localizedOrderAddress(order, lang, "receiver"),')
replace_once("src/lib/invoice.ts", '      packageType: safeText(order.package_type),', '      packageType: localizedPackageType(order.package_type, lang),')
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

write("scripts/export-language-policy-gate.mjs", '''import fs from "node:fs";\nconst read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");\nconst checks = [\n  ["src/lib/exportLocalization.ts", "localizedOrderDestination"],\n  ["src/lib/adminPdfExport.ts", "localizedCell(payload, column"],\n  ["src/lib/adminPdfExport.ts", "csvValue(localizedCell"],\n  ["src/lib/merchantStatementExport.ts", "destination: localizeExportText"],\n  ["src/components/admin/AdminMerchantStatementsCenter.tsx", "localizedOrderDestination(order"],\n  ["src/components/admin/AdminOrderBulkOperations.tsx", "localizedOrderRoute(order"],\n  ["src/lib/invoice.ts", "localizedOrderAddress(order, lang"],\n  ["src/lib/printableDocuments.ts", "const receiverAddress = localizeExportText"],\n  ["src/lib/exportUtils.ts", "const receiverAddress = localizeExportText"],\n  ["src/types.ts", "receiver_address_ar?: string"],\n];\nfor (const [path, marker] of checks) { if (!read(path).includes(marker)) throw new Error(`${path}: missing ${marker}`); }\nconsole.log("Export language policy gate passed.");\n''')

print("Export language policy patch applied.")
