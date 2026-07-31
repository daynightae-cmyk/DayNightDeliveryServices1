from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "scripts/apply-runtime-full-arabic-addresses.py"


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one occurrence, found {count}")
    return content.replace(old, new, 1)


def replace_regex_once(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected one occurrence, found {count}")
    return updated


content = TARGET.read_text(encoding="utf-8")

# Arabic-first per component: do not append the English counterpart when an Arabic
# address/area/street/building/etc. value already exists.
content = replace_regex_once(
    content,
    r'''  const arabicKeys = side === "receiver"[\s\S]*?  return combineAddressParts\(\[\.\.\.arabicParts, \.\.\.fallbackParts\]\);''',
    '''  const addressComponents: Array<[string[], string[]]> = side === "receiver"
    ? [
        [["receiver_address_ar", "delivery_address_ar"], ["receiver_address", "delivery_address"]],
        [["receiver_area_ar", "delivery_area_ar"], ["receiver_area", "delivery_area"]],
        [["receiver_street_ar", "delivery_street_ar"], ["receiver_street", "delivery_street"]],
        [["receiver_building_ar", "delivery_building_ar"], ["receiver_building", "delivery_building"]],
        [["receiver_villa_ar", "delivery_villa_ar"], ["receiver_villa", "delivery_villa"]],
        [["receiver_apartment_ar", "delivery_apartment_ar"], ["receiver_apartment", "delivery_apartment"]],
        [["receiver_floor_ar", "delivery_floor_ar"], ["receiver_floor", "delivery_floor"]],
        [["receiver_landmark_ar", "delivery_landmark_ar"], ["receiver_landmark", "delivery_landmark"]],
      ]
    : [
        [["sender_address_ar", "pickup_address_ar"], ["sender_address", "pickup_address"]],
        [["sender_area_ar", "pickup_area_ar"], ["sender_area", "pickup_area"]],
        [["sender_street_ar", "pickup_street_ar"], ["sender_street", "pickup_street"]],
        [["sender_building_ar", "pickup_building_ar"], ["sender_building", "pickup_building"]],
        [["sender_villa_ar", "pickup_villa_ar"], ["sender_villa", "pickup_villa"]],
        [["sender_apartment_ar", "pickup_apartment_ar"], ["sender_apartment", "pickup_apartment"]],
        [["sender_floor_ar", "pickup_floor_ar"], ["sender_floor", "pickup_floor"]],
        [["sender_landmark_ar", "pickup_landmark_ar"], ["sender_landmark", "pickup_landmark"]],
      ];
  const parts = addressComponents.map(([arabicKeys, fallbackKeys]) => {
    if (language === "ar") {
      const explicitArabic = explicitText(record, arabicKeys);
      if (explicitArabic) return explicitArabic;
    }
    return localizeExportText(explicitText(record, fallbackKeys), language);
  });
  return combineAddressParts(parts);''',
    "component-level Arabic-first address policy",
)

# Realtime-safe runtime bridge: distinguish our own DOM write from a React/live-data
# update and refresh the saved source when the application changes a reused text node.
content = replace_once(
    content,
    'const originals = new WeakMap<Text, string>();\nconst tracked = new Set<Text>();',
    'const originals = new WeakMap<Text, string>();\nconst tracked = new Set<Text>();\nconst localizedWrites = new WeakSet<Text>();',
    "runtime bridge write tracking",
)
content = replace_once(
    content,
    '''function processText(node: Text) {
  const current = node.nodeValue || "";
  if (!shouldLocalize(node)) return;
  const original = originals.get(node) || current;
  if (!originals.has(node)) originals.set(node, original);
  const localized = localizeExportText(original, "ar");
  if (localized !== current) node.nodeValue = localized;
  tracked.add(node);
}''',
    '''function processText(node: Text) {
  const current = node.nodeValue || "";
  if (localizedWrites.has(node)) {
    localizedWrites.delete(node);
    tracked.add(node);
    return;
  }

  const saved = originals.get(node);
  const savedLocalized = saved === undefined ? "" : localizeExportText(saved, "ar");
  if (!shouldLocalize(node)) {
    if (saved !== undefined && current !== savedLocalized) originals.set(node, current);
    return;
  }

  const original = saved !== undefined && current === savedLocalized ? saved : current;
  originals.set(node, original);
  const localized = localizeExportText(original, "ar");
  if (localized !== current) {
    localizedWrites.add(node);
    node.nodeValue = localized;
  }
  tracked.add(node);
}''',
    "runtime bridge realtime refresh",
)

# Empty stored addresses must retain the resolved map city label instead of rendering —.
content = replace_once(
    content,
    'activeOrder ? localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "sender") : (isArabic ? pickupLabel.labelAr : pickupLabel.labelEn)',
    'activeOrder && localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "sender") !== "—" ? localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "sender") : (isArabic ? pickupLabel.labelAr : pickupLabel.labelEn)',
    "pickup map label fallback",
)
content = replace_once(
    content,
    'activeOrder ? localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "receiver") : (isArabic ? destinationLabel.labelAr : destinationLabel.labelEn)',
    'activeOrder && localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "receiver") !== "—" ? localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "receiver") : (isArabic ? destinationLabel.labelAr : destinationLabel.labelEn)',
    "destination map label fallback",
)

# Replace the obsolete gate patch with the actual current checks-array tail. Remove
# markers belonging to the old address implementation and add runtime/full-address checks.
content = replace_regex_once(
    content,
    r'''# 8\) Permanent fail-closed gate for full addresses and all runtime mounts\.[\s\S]*?print\("Runtime full Arabic address patch applied\."\)''',
    '''# 8) Permanent fail-closed gate for full addresses and all runtime mounts.
gate = read("scripts/export-language-policy-gate.mjs")
for obsolete in (
    '  ["src/lib/exportLocalization.ts", "const partialArabic = partialArabicKeys.map"],\\n',
    '  ["src/lib/exportLocalization.ts", "return combineAddressParts([fullArabic || fallback, ...partialArabic])"],\\n',
):
    gate = gate.replace(obsolete, "")

gate = replace_text_once(
    gate,
    '  ["src/components/AdminPanel.tsx", "localizedOrderStatus(order.status, language)"],\\n];',
    '  ["src/components/AdminPanel.tsx", "localizedOrderStatus(order.status, language)"],\\n'
    '  ["src/lib/exportLocalization.ts", "const addressComponents: Array<[string[], string[]]>"],\\n'
    '  ["src/lib/exportLocalization.ts", "receiver_building"],\\n'
    '  ["src/lib/exportLocalization.ts", "export function isLikelyLocationText"],\\n'
    '  ["src/components/ArabicAddressRuntimeBridge.tsx", "localizedWrites"],\\n'
    '  ["src/components/ArabicAddressRuntimeBridge.tsx", "MutationObserver"],\\n'
    '  ["src/main.tsx", "<ArabicAddressRuntimeBridge />"],\\n'
    '  ["src/components/driver/DriverOrderCard.tsx", "localizedOrderAddress"],\\n'
    '  ["src/components/driver/DriverCustomerCommunication.tsx", "localizedDeliveryAddress"],\\n'
    '  ["src/components/merchant/MerchantPortalCommandCenter.tsx", "localizedOrderAddress(order, language"],\\n'
    '  ["src/components/Tracking.tsx", "عنوان التسليم الكامل"],\\n'
    '  ["src/components/admin/AdminSectionWorkspaceComplete.tsx", "localizedOrderDestination"],\\n'
    '];',
    "export language gate checks tail",
)
gate = replace_text_once(
    gate,
    '  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],\\n];',
    '  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],\\n'
    '  ["Dubai, Deira, Villa 12, Street 5, Building 8, Floor 2, Near Al Zahiyah", "دبي، ديرة، فيلا 12، شارع 5، مبنى 8، الطابق 2، بالقرب من الزاهية"],\\n'
    '];',
    "complete address fixture",
)
write("scripts/export-language-policy-gate.mjs", gate)

print("Runtime full Arabic address patch applied.")''',
    "current gate contract",
)

TARGET.write_text(content, encoding="utf-8")
print("Runtime Arabic address generator hardened after review.")
