from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "scripts/apply-runtime-full-arabic-addresses.py"
content = TARGET.read_text(encoding="utf-8")

replacement = r'''# 8) Permanent fail-closed gate for full addresses and all runtime mounts.
gate = read("scripts/export-language-policy-gate.mjs")
for obsolete in (
    """  ["src/lib/exportLocalization.ts", "const partialArabic = partialArabicKeys.map"],
""",
    """  ["src/lib/exportLocalization.ts", "return combineAddressParts([fullArabic || fallback, ...partialArabic])"],
""",
):
    gate = gate.replace(obsolete, "")

gate = replace_text_once(
    gate,
    """  ["src/components/AdminPanel.tsx", "localizedOrderStatus(order.status, language)"],
];""",
    """  ["src/components/AdminPanel.tsx", "localizedOrderStatus(order.status, language)"],
  ["src/lib/exportLocalization.ts", "const addressComponents: Array<[string[], string[]]>"],
  ["src/lib/exportLocalization.ts", "receiver_building"],
  ["src/lib/exportLocalization.ts", "export function isLikelyLocationText"],
  ["src/components/ArabicAddressRuntimeBridge.tsx", "localizedWrites"],
  ["src/components/ArabicAddressRuntimeBridge.tsx", "MutationObserver"],
  ["src/main.tsx", "<ArabicAddressRuntimeBridge />"],
  ["src/components/driver/DriverOrderCard.tsx", "localizedOrderAddress"],
  ["src/components/driver/DriverCustomerCommunication.tsx", "localizedDeliveryAddress"],
  ["src/components/merchant/MerchantPortalCommandCenter.tsx", "localizedOrderAddress(order, language"],
  ["src/components/Tracking.tsx", "عنوان التسليم الكامل"],
  ["src/components/admin/AdminSectionWorkspaceComplete.tsx", "localizedOrderDestination"],
];""",
    "export language gate checks tail",
)
gate = replace_text_once(
    gate,
    """  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],
];""",
    """  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],
  ["Dubai, Deira, Villa 12, Street 5, Building 8, Floor 2, Near Al Zahiyah", "دبي، ديرة، فيلا 12، شارع 5، مبنى 8، الطابق 2، بالقرب من الزاهية"],
];""",
    "complete address fixture",
)
write("scripts/export-language-policy-gate.mjs", gate)

print("Runtime full Arabic address patch applied.")'''

pattern = r'# 8\) Permanent fail-closed gate for full addresses and all runtime mounts\.[\s\S]*?print\("Runtime full Arabic address patch applied\."\)'
updated, count = re.subn(pattern, replacement, content, count=1)
if count != 1:
    raise SystemExit(f"generator gate repair: expected one occurrence, found {count}")

TARGET.write_text(updated, encoding="utf-8")
print("Runtime full Arabic address generator V3 syntax repaired.")
