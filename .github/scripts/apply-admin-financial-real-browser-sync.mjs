import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`admin_financial_sync_patch_missing_${label}`);
  }
  const next = source.replace(before, after);
  if (next === source) {
    throw new Error(`admin_financial_sync_patch_noop_${label}`);
  }
  return next;
}

const componentPath = path.join(
  root,
  "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
);
let component = fs.readFileSync(componentPath, "utf8");

component = replaceRequired(
  component,
  `  function setFinancialField(field: AdminFinancialField, rawValue: string) {\n    setForm((current) => updateAdminFinancialField(current, field, rawValue));\n    markFinancialChange();\n  }\n\n  function setPriceMode`,
  `  function setFinancialField(field: AdminFinancialField, rawValue: string) {\n    setForm((current) => updateAdminFinancialField(current, field, rawValue));\n    markFinancialChange();\n  }\n\n  function handleFinancialInputCapture(event: FormEvent<HTMLFormElement>) {\n    const target = event.target;\n    if (!(target instanceof HTMLInputElement)) return;\n\n    const field = target.dataset.adminFinancialField;\n    if (\n      field === "goods_value" ||\n      field === "manual_delivery_price" ||\n      field === "discount_amount"\n    ) {\n      setFinancialField(field, target.value);\n    }\n  }\n\n  function setPriceMode`,
  "capture_handler",
);

component = replaceRequired(
  component,
  `<form data-admin-new-order-form="merchant" autoComplete="off" onSubmit={submit}`,
  `<form data-admin-new-order-form="merchant" autoComplete="off" onInputCapture={handleFinancialInputCapture} onSubmit={submit}`,
  "form_capture",
);

component = replaceRequired(
  component,
  `data-admin-financial-preview-version="5"`,
  `data-admin-financial-preview-version="6"`,
  "preview_version",
);

component = replaceRequired(
  component,
  `<input type="number" min={0} step="0.01" data-admin-financial-input="true" name="dn_goods_value_no_history_20260805" autoComplete="off" aria-autocomplete="none" inputMode="decimal" data-form-type="other" data-lpignore="true" data-1p-ignore="true" value={form.goods_value} onInput={(event) => setFinancialField("goods_value", event.currentTarget.value)} placeholder="100.00" className={inputClass()} required />`,
  `<input type="number" min={0} step="0.01" data-admin-financial-input="true" data-admin-financial-field="goods_value" name="dn_goods_value_no_history_20260805" autoComplete="off" aria-autocomplete="none" inputMode="decimal" data-form-type="other" data-lpignore="true" data-1p-ignore="true" value={form.goods_value} onChange={(event) => setFinancialField("goods_value", event.currentTarget.value)} onBlur={(event) => setFinancialField("goods_value", event.currentTarget.value)} placeholder="100.00" className={inputClass()} required />`,
  "goods_input",
);

component = replaceRequired(
  component,
  `<input type="number" min={0} step="0.01" data-admin-financial-input="true" value={form.manual_delivery_price ?? ""} onInput={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)} placeholder="25.00" className={inputClass()} />`,
  `<input type="number" min={0} step="0.01" data-admin-financial-input="true" data-admin-financial-field="manual_delivery_price" value={form.manual_delivery_price ?? ""} onChange={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)} onBlur={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)} placeholder="25.00" className={inputClass()} />`,
  "manual_delivery_input",
);

component = replaceRequired(
  component,
  `<input type="number" min={0} step="0.01" data-admin-financial-input="true" value={form.discount_amount ?? ""} onInput={(event) => setFinancialField("discount_amount", event.currentTarget.value)} placeholder={isArabic ? "اتركه فارغًا بدون خصم" : "Leave blank when there is no discount"} className={inputClass()} />`,
  `<input type="number" min={0} step="0.01" data-admin-financial-input="true" data-admin-financial-field="discount_amount" value={form.discount_amount ?? ""} onChange={(event) => setFinancialField("discount_amount", event.currentTarget.value)} onBlur={(event) => setFinancialField("discount_amount", event.currentTarget.value)} placeholder={isArabic ? "اتركه فارغًا بدون خصم" : "Leave blank when there is no discount"} className={inputClass()} />`,
  "discount_input",
);

fs.writeFileSync(componentPath, component, "utf8");

const gatePath = path.join(
  root,
  "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs",
);
let gate = fs.readFileSync(gatePath, "utf8");

gate = replaceRequired(
  gate,
  `[component.includes('data-admin-financial-preview-version="5"'), "deployed form exposes financial truth version 5"],\n  [component.includes('onInput={(event) => setFinancialField("goods_value", event.currentTarget.value)}'), "goods value is bound on every input event"],\n  [component.includes('onInput={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}'), "manual delivery is bound on every input event"],\n  [component.includes('onInput={(event) => setFinancialField("discount_amount", event.currentTarget.value)}'), "discount is bound on every input event"],`,
  `[component.includes('data-admin-financial-preview-version="6"'), "deployed form exposes financial truth version 6"],\n  [component.includes("onInputCapture={handleFinancialInputCapture}"), "form captures financial input before bubble listeners can interfere"],\n  [component.includes('data-admin-financial-field="goods_value"'), "goods field has an explicit financial identity"],\n  [component.includes('data-admin-financial-field="manual_delivery_price"'), "manual delivery field has an explicit financial identity"],\n  [component.includes('data-admin-financial-field="discount_amount"'), "discount field has an explicit financial identity"],\n  [component.includes('onChange={(event) => setFinancialField("goods_value", event.currentTarget.value)}'), "goods value uses the standard controlled-input change path"],\n  [component.includes('onChange={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}'), "manual delivery uses the standard controlled-input change path"],\n  [component.includes('onChange={(event) => setFinancialField("discount_amount", event.currentTarget.value)}'), "discount uses the standard controlled-input change path"],\n  [component.includes('onBlur={(event) => setFinancialField("goods_value", event.currentTarget.value)}'), "goods value reconciles browser or extension autofill on blur"],`,
  "gate_contract",
);

fs.writeFileSync(gatePath, gate, "utf8");

console.log("Applied Admin financial real-browser synchronization repair.");
