from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs"
gate = GATE.read_text(encoding="utf-8")

replacements = {
    '''  [component.includes("explicitZeroGoods || explicitZeroManualDelivery"), "zero goods and explicit manual zero update the state atomically"],''':
    '''  [interactionState.includes("explicitZeroGoods || explicitZeroManual"), "zero goods and explicit manual zero update the state atomically"],''',
    '''  [component.includes('next.delivery_fee_mode = "deduct_from_merchant"'), "zero values select merchant debit in the same state update"],''':
    '''  [interactionState.includes('next.delivery_fee_mode = "deduct_from_merchant"'), "zero values select merchant debit in the same state update"],''',
    '''  [component.includes('next.payment_method = "merchant_pays"'), "zero values synchronize merchant payment"],''':
    '''  [interactionState.includes('next.payment_method = "merchant_pays"'), "zero values synchronize merchant payment"],''',
}

for old, new in replacements.items():
    if old not in gate:
        raise RuntimeError(f"outdated gate check not found: {old}")
    gate = gate.replace(old, new, 1)

GATE.write_text(gate, encoding="utf-8")
print("Financial acceptance gate now checks the authoritative state reducer.")
