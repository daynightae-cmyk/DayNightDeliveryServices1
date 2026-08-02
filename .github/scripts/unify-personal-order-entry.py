from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str, label: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    write(path, content.replace(old, new, 1))
    print(f"PASS {label}")


def regex_once(path: str, pattern: str, replacement: str, label: str, flags: int = 0) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    write(path, updated)
    print(f"PASS {label}")


new_order = "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx"
personal_form = "artifacts/day-night-delivery/src/components/admin/AdminPersonalOrderForm.tsx"
registry = "artifacts/day-night-delivery/src/components/admin/AdminSectionRegistry.ts"
luxury = "artifacts/day-night-delivery/src/components/AdminPanelLuxury.tsx"
command = "artifacts/day-night-delivery/src/components/admin/command-center/AdminPanelCommandCenter.tsx"
workspace = "artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspace.tsx"
legacy = "artifacts/day-night-delivery/src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx"
bulk = "artifacts/day-night-delivery/src/components/admin/AdminOrderBulkOperations.tsx"
gate = "artifacts/day-night-delivery/scripts/personal-orders-admin-gate.mjs"

replace_once(
    new_order,
    'import CouponPhotoIntake, { type CouponPhotoReview } from "../shared/CouponPhotoIntake";\n',
    'import CouponPhotoIntake, { type CouponPhotoReview } from "../shared/CouponPhotoIntake";\nimport AdminPersonalOrderForm from "./AdminPersonalOrderForm";\n',
    "new order imports embedded personal form",
)

replace_once(
    new_order,
    'const clean = (value: unknown) => String(value ?? "").trim();\n',
    'const PERSONAL_ORDER_OPTION = "__personal_order__";\ntype OrderOwnerMode = "merchant" | "personal";\n\nconst clean = (value: unknown) => String(value ?? "").trim();\n',
    "new order defines personal option sentinel",
)

replace_once(
    new_order,
    '  const [form, setForm] = useState<FinancialOpsOrderInput>(() => freshOrderForMerchant(null));\n',
    '  const [form, setForm] = useState<FinancialOpsOrderInput>(() => freshOrderForMerchant(null));\n  const [ownerMode, setOwnerMode] = useState<OrderOwnerMode>("merchant");\n',
    "new order stores owner mode",
)

replace_once(
    new_order,
    '  const settlement = financials ? merchantSettlement(financials.merchantDue, isArabic) : null;\n',
    '  const settlement = financials ? merchantSettlement(financials.merchantDue, isArabic) : null;\n  const ownerSelectionValue = ownerMode === "personal" ? PERSONAL_ORDER_OPTION : form.merchant_id || "";\n',
    "new order derives unified selector value",
)

replace_once(
    new_order,
    '''  function chooseMerchant(id: string) {
    const merchant = merchants.find((item) => item.id === id) || null;
    setForm((current) => ({
      ...current,
      merchant,
      merchant_id: merchant?.id || "",
      merchant_name: merchant?.trade_name || "",
      merchant_code: merchant?.merchant_code || "",
      pickup_city: merchant?.emirate || current.pickup_city,
      pickup_area: merchant?.city || current.pickup_area,
      pickup_street: merchant?.pickup_address || merchant?.address || current.pickup_street,
    }));
    setSource("pending");
    setMessage("");
    setError("");
  }
''',
    '''  function chooseMerchant(id: string) {
    if (id === PERSONAL_ORDER_OPTION) {
      setOwnerMode("personal");
      setForm(freshOrderForMerchant(null));
      setSource("pending");
      setMessage("");
      setError("");
      return;
    }

    const merchant = merchants.find((item) => item.id === id) || null;
    setOwnerMode("merchant");
    setForm((current) => ({
      ...current,
      merchant,
      merchant_id: merchant?.id || "",
      merchant_name: merchant?.trade_name || "",
      merchant_code: merchant?.merchant_code || "",
      pickup_city: merchant?.emirate || current.pickup_city,
      pickup_area: merchant?.city || current.pickup_area,
      pickup_street: merchant?.pickup_address || merchant?.address || current.pickup_street,
    }));
    setSource("pending");
    setMessage("");
    setError("");
  }
''',
    "new order selector switches safely between merchant and personal",
)

personal_mode_block = '''
  if (ownerMode === "personal") {
    return (
      <section
        data-admin-unified-personal-order-entry="true"
        className="space-y-4"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="rounded-[2rem] border border-brand-gold/30 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-xl font-black text-white">
              {isArabic ? "إضافة طلب — تاجر أو غرض شخصي" : "Add order — merchant or personal purpose"}
            </h2>
            <p className="mt-1 text-xs font-bold leading-6 text-white/55">
              {isArabic
                ? "اختيار غرض شخصي يلغي أي علاقة بالتجار أو حساباتهم، ويحفظ الطلب مباشرة باسم المرسل والمستلم."
                : "Personal purpose removes every merchant and merchant-ledger relationship and saves the order directly for the sender and recipient."}
            </p>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-black text-brand-gold">
              {isArabic ? "نوع الطلب أو التاجر" : "Order purpose or merchant"}
            </span>
            <select
              data-admin-order-owner-select="true"
              value={ownerSelectionValue}
              onChange={(event) => chooseMerchant(event.target.value)}
              className={inputClass()}
            >
              <option value="">{isArabic ? "اختر التاجر أو غرض شخصي *" : "Select merchant or personal purpose *"}</option>
              <option value={PERSONAL_ORDER_OPTION}>{isArabic ? "غرض شخصي — بدون تاجر" : "Personal purpose — no merchant"}</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>
              ))}
            </select>
          </label>
        </div>
        <AdminPersonalOrderForm isArabic={isArabic} onSaved={onSaved} />
      </section>
    );
  }

'''
replace_once(
    new_order,
    '  return (\n    <form onSubmit={submit}',
    personal_mode_block + '  return (\n    <form data-admin-new-order-form="merchant" onSubmit={submit}',
    "new order renders personal form inside the unified add-order route",
)

replace_once(
    new_order,
    '<h3 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-brand-gold" />{isArabic ? "التاجر والكوبون" : "Merchant and coupon"}</h3>\n          <select value={form.merchant_id || ""} onChange={(event) => chooseMerchant(event.target.value)} className={inputClass()} required>\n            <option value="">{isArabic ? "اختر التاجر *" : "Select merchant *"}</option>\n            {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>)}\n          </select>',
    '<h3 className="flex items-center gap-2 text-sm font-black text-white"><Store className="h-4 w-4 text-brand-gold" />{isArabic ? "نوع الطلب والتاجر والكوبون" : "Order purpose, merchant, and coupon"}</h3>\n          <select data-admin-order-owner-select="true" value={ownerSelectionValue} onChange={(event) => chooseMerchant(event.target.value)} className={inputClass()} required>\n            <option value="">{isArabic ? "اختر التاجر أو غرض شخصي *" : "Select merchant or personal purpose *"}</option>\n            <option value={PERSONAL_ORDER_OPTION}>{isArabic ? "غرض شخصي — بدون تاجر" : "Personal purpose — no merchant"}</option>\n            {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchantOptionLabel(merchant)}</option>)}\n          </select>',
    "merchant form exposes personal purpose in the merchant selector",
)

replace_once(
    personal_form,
    '    <form\n      onSubmit={submit}\n',
    '    <form\n      data-admin-personal-order-form="true"\n      onSubmit={submit}\n',
    "personal form exposes stable form selector",
)
replace_once(
    personal_form,
    '          <input\n            value={form.reference || ""}\n',
    '          <input\n            data-admin-next-order-focus="true"\n            data-admin-personal-coupon="true"\n            value={form.reference || ""}\n',
    "personal coupon participates in duplicate preflight",
)
replace_once(
    personal_form,
    '            <input\n              value={form.sender_name}\n',
    '            <input\n              data-admin-personal-sender-name="true"\n              value={form.sender_name}\n',
    "personal sender name has stable selector",
)
replace_once(
    personal_form,
    '            <input\n              value={form.sender_phone}\n',
    '            <input\n              data-admin-personal-sender-phone="true"\n              value={form.sender_phone}\n',
    "personal sender phone has stable selector",
)
replace_once(
    personal_form,
    '          <textarea\n            rows={3}\n            value={form.pickup_street}\n',
    '          <textarea\n            data-admin-personal-pickup-address="true"\n            rows={3}\n            value={form.pickup_street}\n',
    "personal pickup address has stable selector",
)
replace_once(
    personal_form,
    '            <input\n              value={form.receiver_name}\n',
    '            <input\n              data-admin-personal-receiver-name="true"\n              value={form.receiver_name}\n',
    "personal receiver name has stable selector",
)
replace_once(
    personal_form,
    '            <input\n              value={form.receiver_phone}\n',
    '            <input\n              data-admin-personal-receiver-phone="true"\n              value={form.receiver_phone}\n',
    "personal receiver phone has stable selector",
)
replace_once(
    personal_form,
    '          <textarea\n            rows={3}\n            value={form.delivery_street}\n',
    '          <textarea\n            data-admin-personal-delivery-address="true"\n            rows={3}\n            value={form.delivery_street}\n',
    "personal delivery address has stable selector",
)
replace_once(
    personal_form,
    '        <input\n          type="number"\n          min={0}\n          step="0.01"\n          value={form.goods_value}\n',
    '        <input\n          data-admin-personal-goods-value="true"\n          type="number"\n          min={0}\n          step="0.01"\n          value={form.goods_value}\n',
    "personal goods value has stable selector",
)
replace_once(
    personal_form,
    '        <button\n          type="submit"\n',
    '        <button\n          data-admin-personal-order-save="true"\n          type="submit"\n',
    "personal save action has stable selector",
)
replace_once(
    personal_form,
    '      setForm(emptyForm);\n      window.dispatchEvent(\n',
    '      setForm(emptyForm);\n      window.setTimeout(() => {\n        document.querySelector<HTMLInputElement>("[data-admin-personal-coupon=\\"true\\"]")?.focus();\n      }, 0);\n      window.dispatchEvent(\n',
    "personal form resets and focuses next order",
)

replace_once(
    luxury,
    '''  {
    id: "personal_orders",
    ar: "الطلبيات الشخصية",
    en: "Personal Orders",
    groupAr: "الطلبات",
    groupEn: "Orders",
    Icon: PackagePlus,
  },
''',
    "",
    "legacy admin sidebar removes personal orders section",
)
replace_once(
    command,
    '  { id: "personal_orders", ar: "الطلبيات الشخصية", en: "Personal Orders", groupAr: "الطلبات", groupEn: "Orders", Icon: PackagePlus },\n',
    "",
    "command center removes personal orders section",
)
regex_once(
    registry,
    r'^\s*cfg\("personal_orders".*\n',
    "",
    "section registry removes personal orders page",
    flags=re.MULTILINE,
)
replace_once(
    registry,
    '"نموذج طلبية احترافي مع تسعير ورقم تتبع."',
    '"نموذج موحّد لطلب تاجر أو غرض شخصي مع تسعير ورقم تتبع."',
    "new order registry description mentions personal purpose",
)
replace_once(
    registry,
    '"Professional order form with pricing and tracking."',
    '"Unified merchant or personal-purpose order form with pricing and tracking."',
    "new order English registry description mentions personal purpose",
)
replace_once(
    workspace,
    '  "personal_orders",\n',
    "",
    "workspace no longer exposes personal orders as a standalone console",
)
replace_once(
    legacy,
    'import AdminPersonalOrderForm from "./AdminPersonalOrderForm";\n',
    "",
    "legacy workspace removes standalone personal form import",
)
replace_once(
    legacy,
    '''      {id === "personal_orders" && (
        <AdminPersonalOrderForm
          isArabic={isArabic}
          onSaved={async () => {
            setNotice(isArabic ? "تم إنشاء الطلب الشخصي وتحديث القائمة." : "Personal order created and list refreshed.");
            await refresh();
          }}
        />
      )}
''',
    "",
    "legacy workspace removes standalone personal page",
)
replace_once(
    legacy,
    '<th>{id === "personal_orders" ? (isArabic ? "المرسل والمستلم" : "Sender / recipient") : (isArabic ? "التاجر والعميل" : "Merchant / customer")}</th>',
    '<th>{isArabic ? "التاجر أو المرسل / العميل" : "Merchant or sender / customer"}</th>',
    "orders table labels merchant and personal senders together",
)

replace_once(
    bulk,
    'import { CheckSquare2, FileDown, ListChecks, Printer, Search, Square, Store, UserRound, X } from "lucide-react";\n',
    'import { CheckSquare2, FileDown, ListChecks, Printer, Search, Square, Store, X } from "lucide-react";\n',
    "bulk console removes standalone personal icon",
)
replace_once(
    bulk,
    '''  if (sectionId === "personal_orders") {
    return isArabic ? (selected ? "الطلبيات الشخصية المحددة" : "كل الطلبيات الشخصية") : (selected ? "Selected personal orders" : "All personal orders");
  }
''',
    "",
    "bulk report removes standalone personal section title",
)
replace_once(
    bulk,
    '  const personal = sectionId === "personal_orders";\n',
    "",
    "bulk console removes standalone personal mode",
)
regex_once(
    bulk,
    r'\{personal \? <div className="flex min-h-11[\s\S]*?</div> : <label><span><Store className="inline h-4 w-4" /> \{isArabic \? "التاجر" : "Merchant"\}</span><select value=\{merchantId\} onChange=\{\(event\) => onMerchantChange\(event\.target\.value\)\}><option value="">\{isArabic \? "كل التجار" : "All merchants"\}</option>\{merchants\.map\(\(merchant\) => <option value=\{clean\(merchant\.id\)\} key=\{clean\(merchant\.id\)\}>\{merchantName\(merchant\)\}\{merchant\.merchant_code \? ` · \$\{merchant\.merchant_code\}` : ""\}</option>\)\}</select></label>\}',
    '{<label><span><Store className="inline h-4 w-4" /> {isArabic ? "التاجر" : "Merchant"}</span><select value={merchantId} onChange={(event) => onMerchantChange(event.target.value)}><option value="">{isArabic ? "كل التجار والطلبات الشخصية" : "All merchants and personal orders"}</option>{merchants.map((merchant) => <option value={clean(merchant.id)} key={clean(merchant.id)}>{merchantName(merchant)}{merchant.merchant_code ? ` · ${merchant.merchant_code}` : ""}</option>)}</select></label>}',
    "bulk console uses one combined all-orders merchant filter",
)

replace_once(
    gate,
    'const personal = read("src/components/admin/AdminPersonalOrderForm.tsx");\n',
    'const unified = read("src/components/admin/AdminNewOrderComplete.tsx");\nexpect(unified, /PERSONAL_ORDER_OPTION = "__personal_order__"/, "new order defines personal purpose option");\nexpect(unified, /غرض شخصي — بدون تاجر/, "merchant selector exposes personal purpose");\nexpect(unified, /data-admin-unified-personal-order-entry="true"/, "personal form renders inside new-order route");\nexpect(unified, /AdminPersonalOrderForm/, "unified new-order route reuses protected personal save flow");\nconst personal = read("src/components/admin/AdminPersonalOrderForm.tsx");\n',
    "gate checks unified personal entry",
)
replace_once(
    gate,
    'expect(personal, /رقم الكوبون — اختياري/, "personal order form exposes an explicit coupon field");\n',
    'expect(personal, /رقم الكوبون — اختياري/, "personal order form exposes an explicit coupon field");\nexpect(personal, /data-admin-next-order-focus="true"/, "personal coupon uses global duplicate preflight");\nexpect(personal, /data-admin-personal-order-save="true"/, "personal save action is browser-testable");\n',
    "gate checks personal save selectors",
)
replace_once(
    gate,
    'expect(logic, /sectionId === "personal_orders"/, "personal section filters only personal rows");\nconst registry = read("src/components/admin/AdminSectionRegistry.ts");\nexpect(registry, /"personal_orders","الطلبيات الشخصية"/, "personal section is registered");\nconst command = read("src/components/admin/command-center/AdminPanelCommandCenter.tsx");\nexpect(command, /id: "personal_orders"/, "personal section appears in command center");\n',
    'const registry = read("src/components/admin/AdminSectionRegistry.ts");\nreject(registry, /cfg\\("personal_orders"/, "standalone personal section is removed from registry");\nconst command = read("src/components/admin/command-center/AdminPanelCommandCenter.tsx");\nreject(command, /id: "personal_orders"/, "standalone personal section is removed from command center");\nconst luxury = read("src/components/AdminPanelLuxury.tsx");\nreject(luxury, /id: "personal_orders"/, "standalone personal section is removed from legacy sidebar");\nconst legacy = read("src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx");\nreject(legacy, /id === "personal_orders"/, "standalone personal workspace is removed");\n',
    "gate rejects every standalone personal page surface",
)

print("All unified personal-order source patches completed.")
