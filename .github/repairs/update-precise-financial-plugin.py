from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/scripts/precise-financial-rule-compatible-plugin.ts"
source = TARGET.read_text(encoding="utf-8")

old = '''      const isAuthoritativeNewOrder =
        normalized.endsWith(
          "/src/components/admin/AdminNewOrderComplete.tsx",
        ) &&
        source.includes("effectiveDeliveryFeeMode") &&
        source.includes("calculateFinancialOpsOrder") &&
        source.includes('data-admin-new-order-form="merchant"');'''
new = '''      const isAuthoritativeNewOrder =
        normalized.endsWith(
          "/src/components/admin/AdminNewOrderComplete.tsx",
        ) &&
        source.includes("const resolvedFinancialInput = useMemo<FinancialOpsOrderInput>") &&
        source.includes("delivery_fee_mode: form.delivery_fee_mode") &&
        source.includes("calculateFinancialOpsOrder(resolvedFinancialInput)") &&
        source.includes("createFinancialOpsOrder(submissionInput)") &&
        source.includes('data-admin-new-order-form="merchant"');'''
if old not in source:
    raise RuntimeError("legacy new-order compatibility predicate not found")
source = source.replace(old, new, 1)
source = source.replace(
    'name: "day-night-precise-financial-rule-compatible-v5"',
    'name: "day-night-precise-financial-rule-compatible-v6"',
    1,
)
TARGET.write_text(source, encoding="utf-8")
print("Precise financial build guard now recognizes the canonical source.")
