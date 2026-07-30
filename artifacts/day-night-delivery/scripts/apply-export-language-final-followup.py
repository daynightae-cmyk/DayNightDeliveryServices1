from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:140]!r}")
    write(path, content.replace(old, new, 1))


replace_once(
    "src/components/AdminPanel.tsx",
    'import { downloadInvoicePdf, invoiceNumberForOrder } from "../lib/invoice";\n',
    'import { downloadInvoicePdf, invoiceNumberForOrder } from "../lib/invoice";\n'
    'import { localizedOrderCity, localizedOrderStatus, localizedPackageType, localizedPaymentMethod } from "../lib/exportLocalization";\n',
)

replace_once(
    "src/components/AdminPanel.tsx",
    '''  const rows = orders.map((order) => [
    invoiceCode(order), trackingCode(order), order.coupon_number, order.merchant_name, dateText(order.created_at, language), order.sender_name, order.sender_phone, order.receiver_name, order.receiver_phone, order.receiver_city, order.package_type, order.order_count || order.pieces || 1, order.payment_method, Number(order.delivery_price || order.price || 0).toFixed(2), Number(order.cod_amount || 0).toFixed(2), order.status, order.notes || "",
  ].map(csvCell).join(","));''',
    '''  const rows = orders.map((order) => [
    invoiceCode(order),
    trackingCode(order),
    order.coupon_number,
    order.merchant_name,
    dateText(order.created_at, language),
    order.sender_name,
    order.sender_phone,
    order.receiver_name,
    order.receiver_phone,
    localizedOrderCity(order, language, "receiver"),
    localizedPackageType(order.package_type, language),
    order.order_count || order.pieces || 1,
    localizedPaymentMethod(order.payment_method, language),
    Number(order.delivery_price || order.price || 0).toFixed(2),
    Number(order.cod_amount || 0).toFixed(2),
    localizedOrderStatus(order.status, language),
    order.notes || "",
  ].map(csvCell).join(","));''',
)

package_path = "package.json"
package_text = read(package_path)
e2e_script = '    "customer-experience:e2e": "node scripts/customer-experience-runtime-e2e.mjs",\n'
e2e_anchor = '    "customer-experience:sql": "node scripts/customer-experience-sql-docker-gate.mjs",\n'
if e2e_script not in package_text:
    if e2e_anchor not in package_text:
        raise SystemExit("package.json: customer-experience script anchor missing")
    package_text = package_text.replace(e2e_anchor, e2e_anchor + e2e_script, 1)
write(package_path, package_text)

gate_path = "scripts/export-language-policy-gate.mjs"
gate_text = read(gate_path)
admin_checks = '''  ["src/components/AdminPanel.tsx", "localizedOrderCity(order, language, \\\"receiver\\\")"],
  ["src/components/AdminPanel.tsx", "localizedPackageType(order.package_type, language)"],
  ["src/components/AdminPanel.tsx", "localizedPaymentMethod(order.payment_method, language)"],
  ["src/components/AdminPanel.tsx", "localizedOrderStatus(order.status, language)"],
'''
check_anchor = '  ["src/types.ts", "receiver_address_ar?: string"],\n'
if admin_checks not in gate_text:
    if check_anchor not in gate_text:
        raise SystemExit("export language gate: checks anchor missing")
    gate_text = gate_text.replace(check_anchor, check_anchor + admin_checks, 1)

script_check = '''if (packageJson.scripts?.["customer-experience:e2e"] !== "node scripts/customer-experience-runtime-e2e.mjs") {
  throw new Error("package.json: customer-experience:e2e was removed");
}
'''
script_anchor = '''if (!String(packageJson.scripts?.["production:gate"] || "").includes("node scripts/export-language-policy-gate.mjs")) {
  throw new Error("package.json: production:gate does not enforce export localization");
}
'''
if script_check not in gate_text:
    if script_anchor not in gate_text:
        raise SystemExit("export language gate: package script anchor missing")
    gate_text = gate_text.replace(script_anchor, script_anchor + script_check, 1)
write(gate_path, gate_text)

print("Final export-language follow-up patch applied.")
