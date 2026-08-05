from pathlib import Path


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")


component = Path("artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx")
replace_exact(
    component,
    '''  function handleFinancialInputCapture(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const field = target.dataset.adminFinancialField;
    if (
      field === "goods_value" ||
      field === "manual_delivery_price" ||
      field === "discount_amount"
    ) {
      setFinancialField(field, target.value);
    }
  }

''',
    "",
    "remove financial input capture handler",
)
replace_exact(
    component,
    '<form data-admin-new-order-form="merchant" autoComplete="off" onInputCapture={handleFinancialInputCapture} onSubmit={submit}',
    '<form data-admin-new-order-form="merchant" autoComplete="off" onSubmit={submit}',
    "remove form input capture",
)
replace_exact(
    component,
    '<section data-admin-financial-preview-version="7" data-selected-merchant-id={form.merchant_id || ""} data-delivery-fee-mode={financials?.deliveryFeeMode ?? ""} data-customer-total={financials?.customerTotal ?? ""} data-merchant-due={financials?.merchantDue ?? ""}',
    '''<section
        data-admin-financial-preview-version="verified-v1"
        data-selected-merchant-id={form.merchant_id || ""}
        data-delivery-fee-mode={financials?.deliveryFeeMode ?? ""}
        data-payment-method={resolvedFinancialInput.payment_method}
        data-goods-value={financials?.goodsValue ?? ""}
        data-delivery-fee={financials?.deliveryFee ?? ""}
        data-discount-amount={financials?.discountAmount ?? ""}
        data-customer-total={financials?.customerTotal ?? ""}
        data-merchant-due={financials?.merchantDue ?? ""}
        data-company-revenue={financials?.companyRevenue ?? ""}''',
    "replace preview verification marker",
)
replace_exact(
    component,
    'value={form.goods_value} onChange={(event) => setFinancialField("goods_value", event.currentTarget.value)} onBlur={(event) => setFinancialField("goods_value", event.currentTarget.value)}',
    'value={form.goods_value} onChange={(event) => setFinancialField("goods_value", event.currentTarget.value)}',
    "remove goods blur writer",
)
replace_exact(
    component,
    '<input type="number" min={0} step="0.01" data-admin-financial-input="true" data-admin-financial-field="manual_delivery_price" value={form.manual_delivery_price ?? ""} onChange={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)} onBlur={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}',
    '<input type="number" min={0} step="0.01" inputMode="decimal" data-admin-financial-input="true" data-admin-financial-field="manual_delivery_price" name="dn_manual_delivery_price_no_history_20260805" autoComplete="off" aria-autocomplete="none" data-form-type="other" data-lpignore="true" data-1p-ignore="true" value={form.manual_delivery_price ?? ""} onChange={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}',
    "make manual delivery a single controlled writer",
)
replace_exact(
    component,
    '<input type="number" min={0} step="0.01" data-admin-financial-input="true" data-admin-financial-field="discount_amount" value={form.discount_amount ?? ""} onChange={(event) => setFinancialField("discount_amount", event.currentTarget.value)} onBlur={(event) => setFinancialField("discount_amount", event.currentTarget.value)}',
    '<input type="number" min={0} step="0.01" inputMode="decimal" data-admin-financial-input="true" data-admin-financial-field="discount_amount" name="dn_discount_amount_no_history_20260805" autoComplete="off" aria-autocomplete="none" data-form-type="other" data-lpignore="true" data-1p-ignore="true" value={form.discount_amount ?? ""} onChange={(event) => setFinancialField("discount_amount", event.currentTarget.value)}',
    "make discount a single controlled writer",
)

hardened = Path(".github/scripts/final-preview-browser-acceptance-hardened.mjs")
hardened_text = hardened.read_text(encoding="utf-8")
marker_count = hardened_text.count('data-admin-financial-preview-version="7"')
if marker_count < 3:
    raise SystemExit(f"browser marker: expected at least 3 matches, found {marker_count}")
hardened_text = hardened_text.replace(
    'data-admin-financial-preview-version="7"',
    'data-admin-financial-preview-version="verified-v1"',
)
old_mode_assertion = "node.dataset.deliveryFeeMode === 'deduct_from_merchant'"
if hardened_text.count(old_mode_assertion) != 1:
    raise SystemExit("browser payment assertion anchor missing")
hardened_text = hardened_text.replace(
    old_mode_assertion,
    "node.dataset.deliveryFeeMode === 'deduct_from_merchant' &&\n          node.dataset.paymentMethod === 'merchant_pays'",
)
hardened.write_text(hardened_text, encoding="utf-8")

gate = Path("artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs")
gate_text = gate.read_text(encoding="utf-8")
gate_text = gate_text.replace(
    '[component.includes(\'data-admin-financial-preview-version="7"\'), "deployed form exposes financial truth version 7"],',
    '[component.includes(\'data-admin-financial-preview-version="verified-v1"\'), "form exposes the verified financial preview marker"],',
)
gate_text = gate_text.replace(
    '[component.includes("onInputCapture={handleFinancialInputCapture}"), "form captures financial input before bubble listeners can interfere"],',
    '[!component.includes("onInputCapture={handleFinancialInputCapture}"), "financial state has no competing form-capture writer"],',
)
gate_text = gate_text.replace(
    '[component.includes(\'onBlur={(event) => setFinancialField("goods_value", event.currentTarget.value)}\'), "goods value reconciles browser or extension autofill on blur"],',
    '[!component.includes(\'onBlur={(event) => setFinancialField("goods_value", event.currentTarget.value)}\'), "goods value has no competing blur writer"],\n  [!component.includes(\'onBlur={(event) => setFinancialField("manual_delivery_price", event.currentTarget.value)}\'), "manual delivery has no competing blur writer"],\n  [!component.includes(\'onBlur={(event) => setFinancialField("discount_amount", event.currentTarget.value)}\'), "discount has no competing blur writer"],',
)
gate_text = gate_text.replace('name: "CASE 1 PASS:', 'name: "CASE 1 equation:')
gate_text = gate_text.replace('name: "CASE 2 PASS:', 'name: "CASE 2 equation:')
gate_text = gate_text.replace('name: "CASE 3 PASS:', 'name: "CASE 3 equation:')
gate_text = gate_text.replace('name: "CASE 4 PASS:', 'name: "CASE 4 equation:')
gate_text = gate_text.replace(
    'console.log("LIVE CHANGE PASS");\nconsole.log("SAVE/REOPEN PASS");\nconsole.log("BUILD CONTRACT PASS");',
    'console.log("STATIC FINANCIAL CONTRACT VERIFIED");',
)
for fragment in (
    'data-admin-financial-preview-version="verified-v1"',
    'financial state has no competing form-capture writer',
    'goods value has no competing blur writer',
    'STATIC FINANCIAL CONTRACT VERIFIED',
):
    if fragment not in gate_text:
        raise SystemExit(f"static gate cleanup missing: {fragment}")
gate.write_text(gate_text, encoding="utf-8")

for obsolete in (
    Path(".github/scripts/admin-new-order-financial-browser-diagnostic.mjs"),
    Path(".github/workflows/admin-new-order-financial-browser-diagnostic.yml"),
    Path(".github/scripts/apply-admin-financial-controlled-source.py"),
    Path(".github/workflows/apply-admin-financial-controlled-source.yml"),
):
    obsolete.unlink(missing_ok=True)
