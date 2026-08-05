from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
component_path = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx"
autocomplete_path = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx"
gate_path = ROOT / "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs"

component = component_path.read_text(encoding="utf-8")
autocomplete = autocomplete_path.read_text(encoding="utf-8")
gate = gate_path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"{label}: source pattern not found")
    return text.replace(old, new, 1)

component = replace_once(
    component,
    'type="number" min={0} step="0.01" name="dn_goods_value_no_history_20260805"',
    'type="number" min={0} step="0.01" data-admin-financial-input="true" name="dn_goods_value_no_history_20260805"',
    "mark goods input",
)
component = replace_once(
    component,
    '<input type="number" min={0} step="0.01" value={form.manual_delivery_price ?? ""}',
    '<input type="number" min={0} step="0.01" data-admin-financial-input="true" value={form.manual_delivery_price ?? ""}',
    "mark manual delivery input",
)
component = replace_once(
    component,
    '<input type="number" min={0} step="0.01" value={form.discount_amount ?? ""}',
    '<input type="number" min={0} step="0.01" data-admin-financial-input="true" value={form.discount_amount ?? ""}',
    "mark discount input",
)

old_selector = 'input:not([type="hidden"]):not([type="password"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="datetime-local"]):not([readonly]):not([disabled])'
new_selector = 'input:not([type="hidden"]):not([type="password"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="datetime-local"]):not([type="number"]):not([inputmode="decimal"]):not([inputmode="numeric"]):not([data-admin-financial-input="true"]):not([readonly]):not([disabled])'
autocomplete = replace_once(
    autocomplete,
    old_selector,
    new_selector,
    "exclude numeric financial inputs from autocomplete selector",
)
autocomplete = replace_once(
    autocomplete,
    '''      for (const input of inputs) {
        if (bound.has(input)) continue;''',
    '''      for (const input of inputs) {
        if (
          input.dataset.adminFinancialInput === "true" ||
          input.type === "number" ||
          input.inputMode === "decimal" ||
          input.inputMode === "numeric"
        ) {
          continue;
        }
        if (bound.has(input)) continue;''',
    "defensive runtime exclusion",
)

needle = '''  [!component.includes("Math.max(0, financials.merchantDue)"), "negative merchant balances remain signed"],'''
addition = '''  [!component.includes("Math.max(0, financials.merchantDue)"), "negative merchant balances remain signed"],
  [component.includes('data-admin-financial-input="true"'), "financial number inputs are explicitly isolated"],
  [autocomplete.includes(':not([type="number"])'), "history autocomplete excludes number inputs"],
  [autocomplete.includes(':not([data-admin-financial-input="true"])'), "history autocomplete excludes marked financial inputs"],
  [autocomplete.includes('input.dataset.adminFinancialInput === "true"'), "runtime autocomplete guard protects financial inputs"],'''
gate = replace_once(gate, needle, addition, "extend permanent live financial gate")
gate = replace_once(
    gate,
    '''const autocompletePath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
);''',
    '''const autocompletePath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
);''',
    "autocomplete path already present",
) if 'const autocompletePath = path.join(' in gate else gate.replace(
    '''const persistencePath = path.join(
  root,
  "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
);''',
    '''const persistencePath = path.join(
  root,
  "artifacts/day-night-delivery/src/lib/adminOrderEditPersistence.ts",
);
const autocompletePath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
);''',
    1,
)
if 'const autocomplete = fs.readFileSync(autocompletePath, "utf8");' not in gate:
    gate = gate.replace(
        'const persistence = fs.readFileSync(persistencePath, "utf8");',
        'const persistence = fs.readFileSync(persistencePath, "utf8");\nconst autocomplete = fs.readFileSync(autocompletePath, "utf8");',
        1,
    )

component_path.write_text(component, encoding="utf-8")
autocomplete_path.write_text(autocomplete, encoding="utf-8")
gate_path.write_text(gate, encoding="utf-8")
print("Financial inputs isolated from Admin history autocomplete.")
