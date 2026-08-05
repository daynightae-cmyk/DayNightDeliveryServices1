from pathlib import Path

component_path = Path("artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx")
component = component_path.read_text(encoding="utf-8")
old_call = '''      const savedSettlement = merchantSettlement(
                calculated.merchantDue,
                isArabic,
                calculated.deliveryFeeMode,
              );'''
new_call = '''      const savedSettlement = merchantSettlement(
                calculated.merchantDue,
                isArabic,
              );'''
if old_call not in component:
    raise RuntimeError("saved merchant settlement signature was not found")
component_path.write_text(component.replace(old_call, new_call, 1), encoding="utf-8")

plugin_path = Path("artifacts/day-night-delivery/scripts/precise-financial-rule-compatible-plugin.ts")
plugin = plugin_path.read_text(encoding="utf-8")
old_detection = '''        source.includes("effectiveDeliveryFeeMode") &&
        source.includes("calculateFinancialOpsOrder") &&
        source.includes('data-admin-new-order-form="merchant"');'''
new_detection = '''        source.includes("calculateFinancialOpsOrder") &&
        source.includes("resolvedFinancialInput") &&
        source.includes('data-admin-new-order-form="merchant"');'''
if old_detection not in plugin:
    raise RuntimeError("authoritative new-order plugin detection was not found")
plugin_path.write_text(plugin.replace(old_detection, new_detection, 1), encoding="utf-8")

Path(".github/scripts/admin_live_financial_followup.py").unlink(missing_ok=True)
