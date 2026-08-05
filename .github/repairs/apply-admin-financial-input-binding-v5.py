from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
COMPONENT = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx"
GATE = ROOT / "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs"
source = COMPONENT.read_text(encoding="utf-8")
gate = GATE.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"{label}: source pattern not found")
    return text.replace(old, new, 1)

source = replace_once(
    source,
    'import { useEffect, useMemo, useState, type FormEvent } from "react";',
    'import { useMemo, useState, type FormEvent } from "react";',
    "remove effect dependency",
)
source = replace_once(
    source,
    'import { orderFinancialValidation } from "../../lib/orderFinancials";',
    '''import { orderFinancialValidation } from "../../lib/orderFinancials";
import {
  selectAdminPriceMode,
  updateAdminFinancialField,
  type AdminFinancialField,
} from "../../lib/adminNewOrderFinancialState";''',
    "import authoritative financial reducer",
)

source, count = re.subn(
    r'''\n  useEffect\(\(\) => \{[\s\S]*?\n  \}, \[\n    form\.goods_value,\n    form\.price_mode,\n    form\.manual_delivery_price,\n    form\.delivery_fee_mode,\n    form\.payment_method,\n  \]\);\n''',
    "\n",
    source,
    count=1,
)
if count != 1:
    raise RuntimeError(f"remove competing financial effect: count={count}")

old_set_field = '''  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value } as FinancialOpsOrderInput;
      const rawGoodsValue = key === "goods_value" ? value : current.goods_value;
      const explicitZeroGoods =
        rawGoodsValue !== "" &&
        rawGoodsValue !== null &&
        rawGoodsValue !== undefined &&
        Number.isFinite(Number(rawGoodsValue)) &&
        Number(rawGoodsValue) === 0;
      const nextPriceMode = key === "price_mode" ? value : current.price_mode;
      const rawManualDelivery =
        key === "manual_delivery_price" ? value : current.manual_delivery_price;
      const explicitZeroManualDelivery =
        nextPriceMode === "manual" &&
        rawManualDelivery !== "" &&
        rawManualDelivery !== null &&
        rawManualDelivery !== undefined &&
        Number.isFinite(Number(rawManualDelivery)) &&
        Number(rawManualDelivery) === 0;

      if (explicitZeroGoods || explicitZeroManualDelivery) {
        next.delivery_fee_mode = "deduct_from_merchant";
        next.payment_method = "merchant_pays";
      }
      return next;
    });
    setSource("pending");
    setMessage("");
    setError("");
  }
'''
new_set_field = '''  function markFinancialChange() {
    setSource("pending");
    setMessage("");
    setError("");
  }

  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    markFinancialChange();
  }

  function setFinancialField(field: AdminFinancialField, rawValue: string) {
    setForm((current) => updateAdminFinancialField(current, field, rawValue));
    markFinancialChange();
  }

  function setPriceMode(mode: "system" | "manual") {
    setForm((current) => selectAdminPriceMode(current, mode));
    markFinancialChange();
  }
'''
source = replace_once(source, old_set_field, new_set_field, "replace financial state writer")

source = replace_once(
    source,
    '<section className="mt-4 rounded-[1.7rem] border border-brand-gold/30',
    '<section data-admin-financial-preview-version="5" data-customer-total={financials?.customerTotal ?? ""} data-merchant-due={financials?.merchantDue ?? ""} className="mt-4 rounded-[1.7rem] border border-brand-gold/30',
    "add observable financial truth marker",
)

source = replace_once(
    source,
    'value={form.goods_value} onChange={(event) => setField("goods_value", event.target.value)}',
    'value={form.goods_value} onInput={(event) => setFinancialField("goods_value", event.currentTarget.value)}',
    "bind goods value on every input event",
)
source = replace_once(
    source,
    'onClick={() => { setField("price_mode", "system"); setField("manual_delivery_price", ""); }}',
    'onClick={() => setPriceMode("system")}',
    "atomic system price mode",
)
source = replace_once(
    source,
    'onClick={() => setField("price_mode", "manual")}',
    'onClick={() => setPriceMode("manual")}',
    "atomic manual price mode",
)
source = replace_once(
    source,
    'value={form.manual_delivery_price ?? ""} onChange={(event) => setField("manual_delivery_price", event.target.value)}',
    'value={form.manual_delivery_price ?? ""} onInput={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}',
    "bind manual fee on every input event",
)
source = replace_once(
    source,
    'value={form.discount_amount ?? ""} onChange={(event) => setField("discount_amount", event.target.value)}',
    'value={form.discount_amount ?? ""} onInput={(event) => setFinancialField("discount_amount", event.currentTarget.value)}',
    "bind discount on every input event",
)

required = [
    'data-admin-financial-preview-version="5"',
    'onInput={(event) => setFinancialField("goods_value", event.currentTarget.value)}',
    'onInput={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}',
    'onInput={(event) => setFinancialField("discount_amount", event.currentTarget.value)}',
    'setForm((current) => updateAdminFinancialField(current, field, rawValue))',
    'setForm((current) => selectAdminPriceMode(current, mode))',
]
for marker in required:
    if marker not in source:
        raise RuntimeError(f"missing final marker: {marker}")
if "useEffect(" in source:
    raise RuntimeError("competing useEffect remains in AdminNewOrderComplete")

COMPONENT.write_text(source, encoding="utf-8")

if 'const interactionStatePath = path.join(' not in gate:
    gate = gate.replace(
        '''const autocompletePath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
);''',
        '''const autocompletePath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
);
const interactionStatePath = path.join(
  root,
  "artifacts/day-night-delivery/src/lib/adminNewOrderFinancialState.ts",
);''',
        1,
    )
    gate = gate.replace(
        'const autocomplete = fs.readFileSync(autocompletePath, "utf8");',
        'const autocomplete = fs.readFileSync(autocompletePath, "utf8");\nconst interactionState = fs.readFileSync(interactionStatePath, "utf8");',
        1,
    )

needle = '''  [autocomplete.includes('input.dataset.adminFinancialInput === "true"'), "runtime autocomplete guard protects financial inputs"],'''
addition = '''  [autocomplete.includes('input.dataset.adminFinancialInput === "true"'), "runtime autocomplete guard protects financial inputs"],
  [component.includes('data-admin-financial-preview-version="5"'), "deployed form exposes financial truth version 5"],
  [component.includes('onInput={(event) => setFinancialField("goods_value", event.currentTarget.value)}'), "goods value is bound on every input event"],
  [component.includes('onInput={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}'), "manual delivery is bound on every input event"],
  [component.includes('onInput={(event) => setFinancialField("discount_amount", event.currentTarget.value)}'), "discount is bound on every input event"],
  [!component.includes("useEffect("), "no effect can overwrite current financial input"],
  [interactionState.includes("updateAdminFinancialField"), "financial field reducer is centralized and testable"],'''
if needle in gate:
    gate = gate.replace(needle, addition, 1)

GATE.write_text(gate, encoding="utf-8")
print("Admin financial inputs now update the exact preview state on every keystroke.")
