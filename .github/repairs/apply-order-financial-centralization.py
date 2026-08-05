from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/src/lib/orderFinancialOperations.ts"
source = TARGET.read_text(encoding="utf-8")
original = source

if 'import {\n  financialNumber,' not in source:
    raise RuntimeError("orderFinancials import block not found")
source = source.replace(
    'import {\n  financialNumber,',
    'import {\n  calculateOrderFinancials,\n  financialNumber,',
    1,
)

source, count = re.subn(
    r'const roundMoney = \(value: number\) =>\n  Math\.round\(\(value \+ Number\.EPSILON\) \* 100\) / 100;\n',
    '',
    source,
    count=1,
)
if count != 1:
    raise RuntimeError(f"roundMoney duplicate helper removal count={count}")

pattern = r'''  const goodsValue = roundMoney\([\s\S]*?  return \{\n    goodsValue,\n    deliveryFee: resolvedDeliveryFee,\n    discountAmount,\n    deliveryFeeMode,\n    customerTotal,\n    merchantDue,\n    companyRevenue: resolvedDeliveryFee,\n    systemDeliveryFee: pricing\.systemTotal,\n    priceSource: input\.price_mode === "manual" \? "manual" : pricing\.priceSource,\n  \};'''
replacement = '''  return {
    ...calculateOrderFinancials({
      goodsValue: input.goods_value,
      deliveryFee,
      discountAmount: input.discount_amount,
      deliveryFeeMode,
    }),
    systemDeliveryFee: pricing.systemTotal,
    priceSource: input.price_mode === "manual" ? "manual" : pricing.priceSource,
  };'''
source, count = re.subn(pattern, replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"central calculator replacement count={count}")

if source == original:
    raise RuntimeError("orderFinancialOperations.ts was not modified")
if source.count("calculateOrderFinancials({") != 1:
    raise RuntimeError("calculateOrderFinancials must be the single calculation call")

TARGET.write_text(source, encoding="utf-8")
print("Central order financial calculator restored.")
