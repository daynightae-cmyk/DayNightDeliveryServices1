from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, content: str) -> None:
    (ROOT / relative).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one occurrence, found {count}")
    return content.replace(old, new, 1)


def regex_once(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count != 1:
        raise SystemExit(f"{label}: expected one regex occurrence, found {count}")
    return updated


# Central export/display policy. Every existing PDF/report consumer already imports
# localizedOrderDestination/localizedOrderRoute, so changing these functions updates
# all export surfaces without mutating stored order data.
path = "src/lib/exportLocalization.ts"
content = read(path)
content = replace_once(
    content,
    'import type { Order } from "../types";\n',
    'import type { Order } from "../types";\nimport { areEquivalentLocations, formatDestinationLocation, inferDestinationEmirate } from "./destinationLocation";\n',
    "export localization central formatter import",
)
old_destination = '''export function localizedOrderDestination(order: Order, language: ExportDocumentLanguage) {
  const city = localizedOrderCity(order, language, "receiver");
  const address = localizedOrderAddress(order, language, "receiver");
  if (city === EMPTY) return address;
  if (address === EMPTY || address === city) return city;
  return `${city}${language === "ar" ? "، " : ", "}${address}`;
}
export function localizedOrderRoute(order: Order, language: ExportDocumentLanguage) {
  return `${localizedOrderCity(order, language, "sender")} → ${localizedOrderCity(order, language, "receiver")}`;
}
'''
new_destination = '''function optionalLocalizedPart(
  record: FlexibleOrder,
  language: ExportDocumentLanguage,
  arabicKeys: string[],
  fallbackKeys: string[],
) {
  const value = localizedPart(record, language, arabicKeys, fallbackKeys);
  return value === EMPTY ? "" : value;
}

export function localizedOrderDestinationEmirate(order: Order, language: ExportDocumentLanguage) {
  const record = order as FlexibleOrder;
  const explicitEmirate = optionalLocalizedPart(
    record,
    language,
    ["receiver_emirate_ar", "delivery_emirate_ar"],
    ["receiver_emirate", "delivery_emirate"],
  );
  if (explicitEmirate) return explicitEmirate;

  const explicitArea = optionalLocalizedPart(
    record,
    language,
    ["receiver_area_ar", "delivery_area_ar"],
    ["receiver_area", "delivery_area"],
  );
  const city = optionalLocalizedPart(
    record,
    language,
    ["receiver_city_ar", "delivery_city_ar"],
    ["receiver_city", "delivery_city"],
  );
  return inferDestinationEmirate(explicitArea || city, language) || city;
}

export function localizedOrderDestinationArea(order: Order, language: ExportDocumentLanguage) {
  const record = order as FlexibleOrder;
  const explicitArea = optionalLocalizedPart(
    record,
    language,
    ["receiver_area_ar", "delivery_area_ar"],
    ["receiver_area", "delivery_area"],
  );
  if (explicitArea) return explicitArea;

  const city = optionalLocalizedPart(
    record,
    language,
    ["receiver_city_ar", "delivery_city_ar"],
    ["receiver_city", "delivery_city"],
  );
  const emirate = localizedOrderDestinationEmirate(order, language);
  return city && !areEquivalentLocations(city, emirate) ? city : "";
}

export function localizedOrderDestination(order: Order, language: ExportDocumentLanguage) {
  const emirate = localizedOrderDestinationEmirate(order, language);
  const area = localizedOrderDestinationArea(order, language);
  const localizedEmirate = language === "ar" && emirate ? localizeExportText(emirate, language) : emirate;
  const localizedArea = language === "ar" && area ? localizeExportText(area, language) : area;
  return formatDestinationLocation(localizedEmirate, localizedArea, language);
}

export function localizedOrderDestinationTooltip(order: Order, language: ExportDocumentLanguage) {
  const destination = localizedOrderDestination(order, language);
  const address = localizedOrderAddress(order, language, "receiver");
  if (address === EMPTY || address === destination) return destination;
  return combineAddressParts([destination, address]);
}

export function localizedOrderRoute(order: Order, language: ExportDocumentLanguage) {
  return localizedOrderDestination(order, language);
}
'''
content = replace_once(content, old_destination, new_destination, "central destination functions")
write(path, content)


# Main all-orders workspace shown in the user's screenshot.
path = "src/components/admin/AdminSectionWorkspaceComplete.tsx"
content = read(path)
content = replace_once(
    content,
    'import { localizedOrderCity, localizedOrderDestination } from "../../lib/exportLocalization";',
    'import { localizedOrderDestination, localizedOrderDestinationTooltip } from "../../lib/exportLocalization";',
    "admin workspace formatter imports",
)
content = replace_once(
    content,
    '''const route = (order: Order, isArabic: boolean) =>
  `${localizedOrderCity(order, isArabic ? "ar" : "en", "sender")} → ${localizedOrderDestination(order, isArabic ? "ar" : "en")}`;''',
    '''const route = (order: Order, isArabic: boolean) =>
  localizedOrderDestination(order, isArabic ? "ar" : "en");

const routeTooltip = (order: Order, isArabic: boolean) =>
  localizedOrderDestinationTooltip(order, isArabic ? "ar" : "en");''',
    "admin workspace route helper",
)
content = replace_once(
    content,
    '<td>{route(order, isArabic)}</td>',
    '''<td>
                      <span
                        className="block max-w-[260px] truncate whitespace-nowrap font-semibold text-white/85"
                        title={routeTooltip(order, isArabic)}
                        dir={isArabic ? "rtl" : "ltr"}
                      >
                        {route(order, isArabic)}
                      </span>
                    </td>''',
    "admin workspace route cell",
)
write(path, content)


# Legacy admin table still rendered sender/receiver city fields directly.
path = "src/components/AdminPanel.tsx"
content = read(path)
content = replace_once(
    content,
    'import { localizedOrderCity, localizedOrderStatus, localizedPackageType, localizedPaymentMethod } from "../lib/exportLocalization";',
    'import { localizedOrderAddress, localizedOrderCity, localizedOrderDestination, localizedOrderDestinationTooltip, localizedOrderStatus, localizedPackageType, localizedPaymentMethod } from "../lib/exportLocalization";',
    "legacy admin formatter imports",
)
content = regex_once(
    content,
    r'<td className="p-4 text-white/75"><p><span className="text-white font-semibold">\{text\(order\.sender_city\)\}</span> ← <span className="text-white font-semibold">\{text\(order\.receiver_city\)\}</span></p><p className="text-white/35 mt-1 max-w-\[220px\] truncate">\{text\(order\.receiver_address\)\}</p></td>',
    '''<td className="p-4 text-white/75">
                  <span
                    className="block max-w-[240px] truncate whitespace-nowrap font-semibold text-white"
                    title={localizedOrderDestinationTooltip(order, exportLanguage)}
                    dir={isArabic ? "rtl" : "ltr"}
                  >
                    {localizedOrderDestination(order, exportLanguage)}
                  </span>
                </td>''',
    "legacy admin route cell",
)
content = replace_once(
    content,
    '<p className="text-white/65">{text(selectedOrder.receiver_city)}</p><p className="text-white/40 text-xs leading-relaxed">{text(selectedOrder.receiver_address)}</p>',
    '<p className="text-white/65 truncate whitespace-nowrap" title={localizedOrderDestinationTooltip(selectedOrder, exportLanguage)}>{localizedOrderDestination(selectedOrder, exportLanguage)}</p><p className="text-white/40 text-xs leading-relaxed">{localizedOrderAddress(selectedOrder, exportLanguage, "receiver")}</p>',
    "legacy admin receiver details",
)
write(path, content)


# Permanent command and production-gate coverage.
path = "package.json"
package = json.loads(read(path))
scripts = package.setdefault("scripts", {})
scripts["destination-location:test"] = "node --experimental-strip-types scripts/destination-location-tests.ts"
production_gate = scripts.get("production:gate", "")
test_command = "node --experimental-strip-types scripts/destination-location-tests.ts"
if test_command not in production_gate:
    scripts["production:gate"] = f"{test_command} && {production_gate}" if production_gate else test_command
write(path, json.dumps(package, ensure_ascii=False, indent=2) + "\n")


# Fail closed if a destination display regresses to sender → receiver in the reviewed surfaces.
for relative in (
    "src/components/admin/AdminSectionWorkspaceComplete.tsx",
    "src/components/AdminPanel.tsx",
    "src/lib/exportLocalization.ts",
):
    source = read(relative)
    for line_number, line in enumerate(source.splitlines(), start=1):
        if ("sender_city" in line or "localizedOrderCity" in line) and ("→" in line or "←" in line):
            raise SystemExit(f"legacy directional route remains: {relative}:{line_number}")

print("Destination location display policy applied successfully.")
