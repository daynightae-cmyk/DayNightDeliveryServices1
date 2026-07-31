from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:160]!r}")
    write(path, content.replace(old, new, 1))


def replace_regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{path}: regex expected one occurrence, found {count}: {pattern[:160]!r}")
    write(path, updated)


# 1) Central address localization: preserve every stored address component, not just city/emirate.
replace_once(
    "src/lib/exportLocalization.ts",
    '''export function localizeExportText(value: unknown, language: ExportDocumentLanguage) {
  let text = clean(value);
  if (!text) return EMPTY;
  if (language !== "ar" || !/[A-Za-z]/.test(text)) return text;
  [...ARABIC_PHRASES].sort((a, b) => b[0].length - a[0].length).forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  [...ARABIC_TERMS].sort((a, b) => b[0].length - a[0].length).forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  text = text.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g, transliterateLatinWord);
  return text.replace(/\\s*,\\s*/g, "، ").replace(/\\s*:\\s*/g, ": ").replace(/\\s+-\\s+/g, " - ").replace(/\\s{2,}/g, " ").trim() || EMPTY;
}''',
    '''export function localizeExportText(value: unknown, language: ExportDocumentLanguage) {
  let text = clean(value);
  if (!text) return EMPTY;
  if (language !== "ar" || !/[A-Za-z]/.test(text)) return text;
  [...ARABIC_PHRASES].sort((a, b) => b[0].length - a[0].length).forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  [...ARABIC_TERMS].sort((a, b) => b[0].length - a[0].length).forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  text = text.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g, transliterateLatinWord);
  return text.replace(/\\s*,\\s*/g, "، ").replace(/\\s*:\\s*/g, ": ").replace(/\\s+-\\s+/g, " - ").replace(/\\s{2,}/g, " ").trim() || EMPTY;
}

export function isLikelyLocationText(value: unknown) {
  const text = clean(value).toLowerCase();
  if (!text || !/[a-z]/i.test(text)) return false;
  if ([...ARABIC_PHRASES, ...ARABIC_TERMS].some(([latin]) => text.includes(latin))) return true;
  return /(?:\\b(?:address|location|route|pickup|drop[ -]?off|delivery|destination|city|area|emirate|district|street|road|building|tower|villa|apartment|flat|floor|office|shop|warehouse|block|sector|zone|landmark|near|opposite|behind|mall|hotel|school|hospital|mosque|airport|port)\\b)/i.test(text);
}''',
)

replace_regex_once(
    "src/lib/exportLocalization.ts",
    r'''export function localizedOrderAddress\(order: Order, language: ExportDocumentLanguage, side: "sender" \| "receiver" = "receiver"\) \{[\s\S]*?\n\}\nexport function localizedOrderDestination''',
    '''export function localizedOrderAddress(order: Order, language: ExportDocumentLanguage, side: "sender" | "receiver" = "receiver") {
  const record = order as FlexibleOrder;
  const arabicKeys = side === "receiver"
    ? [
        "receiver_address_ar", "delivery_address_ar", "receiver_area_ar", "delivery_area_ar",
        "receiver_street_ar", "delivery_street_ar", "receiver_building_ar", "delivery_building_ar",
        "receiver_villa_ar", "delivery_villa_ar", "receiver_apartment_ar", "delivery_apartment_ar",
        "receiver_floor_ar", "delivery_floor_ar", "receiver_landmark_ar", "delivery_landmark_ar",
      ]
    : [
        "sender_address_ar", "pickup_address_ar", "sender_area_ar", "pickup_area_ar",
        "sender_street_ar", "pickup_street_ar", "sender_building_ar", "pickup_building_ar",
        "sender_villa_ar", "pickup_villa_ar", "sender_apartment_ar", "pickup_apartment_ar",
        "sender_floor_ar", "pickup_floor_ar", "sender_landmark_ar", "pickup_landmark_ar",
      ];
  const fallbackKeys = side === "receiver"
    ? [
        "receiver_address", "delivery_address", "receiver_area", "delivery_area",
        "receiver_street", "delivery_street", "receiver_building", "delivery_building",
        "receiver_villa", "delivery_villa", "receiver_apartment", "delivery_apartment",
        "receiver_floor", "delivery_floor", "receiver_landmark", "delivery_landmark",
      ]
    : [
        "sender_address", "pickup_address", "sender_area", "pickup_area",
        "sender_street", "pickup_street", "sender_building", "pickup_building",
        "sender_villa", "pickup_villa", "sender_apartment", "pickup_apartment",
        "sender_floor", "pickup_floor", "sender_landmark", "pickup_landmark",
      ];
  const arabicParts = language === "ar"
    ? arabicKeys.map((key) => clean(record[key])).filter(Boolean)
    : [];
  const fallbackParts = fallbackKeys
    .map((key) => clean(record[key]))
    .filter(Boolean)
    .map((part) => localizeExportText(part, language));
  return combineAddressParts([...arabicParts, ...fallbackParts]);
}
export function localizedOrderDestination''',
)

# 2) Runtime bridge for every web/native/mobile surface.
write(
    "src/components/ArabicAddressRuntimeBridge.tsx",
    '''import { useEffect } from "react";
import { useAppContext } from "../lib/AppContext";
import { isLikelyLocationText, localizeExportText } from "../lib/exportLocalization";

const LOCATION_CONTEXT = /(?:address|location|route|pickup|drop[ -]?off|delivery|destination|city|area|emirate|district|street|road|building|tower|villa|apartment|flat|floor|office|shop|warehouse|block|sector|zone|landmark|map|عنوان|موقع|مسار|استلام|تسليم|وجهة|مدينة|منطقة|إمارة|شارع|طريق|مبنى|برج|فيلا|شقة|طابق|معلم)/i;
const BLOCKED_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE"]);
const originals = new WeakMap<Text, string>();
const tracked = new Set<Text>();

function elementContext(element: Element | null) {
  let current = element;
  const tokens: string[] = [];
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
    tokens.push(
      current.id,
      typeof current.className === "string" ? current.className : "",
      current.getAttribute("aria-label") || "",
      current.getAttribute("title") || "",
      current.getAttribute("data-label") || "",
      current.getAttribute("data-field") || "",
      current.getAttribute("data-column") || "",
    );
  }
  const previous = element?.previousElementSibling;
  if (previous) tokens.push(previous.textContent || "");
  return tokens.join(" ");
}

function isOperationalToken(text: string) {
  const compact = text.trim();
  if (!compact || !/[A-Za-z]/.test(compact)) return true;
  if (/https?:|www\.|@|\+?\d[\d\s-]{5,}/i.test(compact)) return true;
  if (/^[A-Z0-9_-]{6,}$/i.test(compact) && !/\s/.test(compact)) return true;
  return false;
}

function shouldLocalize(node: Text) {
  const parent = node.parentElement;
  if (!parent || BLOCKED_TAGS.has(parent.tagName)) return false;
  if (parent.closest("[data-dn-no-localize='true'], [translate='no']")) return false;
  const text = node.nodeValue || "";
  if (isOperationalToken(text)) return false;
  return isLikelyLocationText(text) || LOCATION_CONTEXT.test(elementContext(parent));
}

function processText(node: Text) {
  const current = node.nodeValue || "";
  if (!shouldLocalize(node)) return;
  const original = originals.get(node) || current;
  if (!originals.has(node)) originals.set(node, original);
  const localized = localizeExportText(original, "ar");
  if (localized !== current) node.nodeValue = localized;
  tracked.add(node);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    processText(root as Text);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    processText(node as Text);
    node = walker.nextNode();
  }
}

function restoreEnglish() {
  tracked.forEach((node) => {
    const original = originals.get(node);
    if (original !== undefined && node.isConnected) node.nodeValue = original;
  });
  tracked.clear();
}

export default function ArabicAddressRuntimeBridge() {
  const { language } = useAppContext();

  useEffect(() => {
    if (language !== "ar") {
      restoreEnglish();
      return;
    }

    const root = document.getElementById("root") || document.body;
    walk(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") processText(mutation.target as Text);
        mutation.addedNodes.forEach(walk);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
''',
)

# 3) Mount the runtime bridge in public web, native driver/merchant shells and standalone pages.
replace_once(
    "src/main.tsx",
    'import MerchantInternationalTrackingLauncher from "./components/merchant/MerchantInternationalTrackingLauncher";\n',
    'import MerchantInternationalTrackingLauncher from "./components/merchant/MerchantInternationalTrackingLauncher";\nimport ArabicAddressRuntimeBridge from "./components/ArabicAddressRuntimeBridge";\n',
)
replace_once(
    "src/main.tsx",
    '<AppProvider><App />',
    '<AppProvider><ArabicAddressRuntimeBridge /><App />',
)
replace_once(
    "src/main.tsx",
    '<AppProvider><NativeRoleRoot role={role} />',
    '<AppProvider><ArabicAddressRuntimeBridge /><NativeRoleRoot role={role} />',
)
replace_once(
    "src/main.tsx",
    '<AppProvider><InternationalTrackingPage />',
    '<AppProvider><ArabicAddressRuntimeBridge /><InternationalTrackingPage />',
)
replace_once(
    "src/main.tsx",
    '<AppProvider><RatingPage />',
    '<AppProvider><ArabicAddressRuntimeBridge /><RatingPage />',
)

# 4) Driver app/card: full localized pickup/drop-off, routes and Arabic message payloads.
replace_once(
    "src/components/driver/DriverOrderCard.tsx",
    'import type { DriverOrder, DriverStatusAction } from "../../types/driver";\n',
    'import type { DriverOrder, DriverStatusAction } from "../../types/driver";\nimport type { Order } from "../../types";\nimport { localizedOrderAddress, localizedOrderRoute, localizedPackageType, localizedPaymentMethod, localizedServiceType } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/driver/DriverOrderCard.tsx",
    '''  const phone = cleanPhone(order.receiver_phone || order.customer_phone);
  const pickupAddress = [order.sender_city, order.sender_address].filter(Boolean).join("، ");
  const deliveryAddress = [order.receiver_city, order.receiver_address].filter(Boolean).join("، ");''',
    '''  const phone = cleanPhone(order.receiver_phone || order.customer_phone);
  const language = isArabic ? "ar" : "en";
  const localizedOrder = order as unknown as Order;
  const pickupAddress = localizedOrderAddress(localizedOrder, language, "sender");
  const deliveryAddress = localizedOrderAddress(localizedOrder, language, "receiver");
  const routeLabel = localizedOrderRoute(localizedOrder, language);''',
)
replace_once(
    "src/components/driver/DriverOrderCard.tsx",
    '<p>{order.sender_city || "—"} <Route /> {order.receiver_city || "—"}</p>',
    '<p>{routeLabel}</p>',
)
replace_once(
    "src/components/driver/DriverOrderCard.tsx",
    '<span><ShieldCheck /> {order.service_type || "standard"} · {order.payment_method || "—"}</span>',
    '<span><ShieldCheck /> {localizedServiceType(order.service_type || "standard", language)} · {localizedPaymentMethod(order.payment_method, language)} · {localizedPackageType(order.package_type || "shipment", language)}</span>',
)

replace_once(
    "src/components/driver/DriverCustomerCommunication.tsx",
    'import type { DriverOrder } from "../../types/driver";\n',
    'import type { DriverOrder } from "../../types/driver";\nimport type { Order } from "../../types";\nimport { localizedOrderAddress, localizedOrderCity } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/driver/DriverCustomerCommunication.tsx",
    '''  const recordedPaymentMode = useMemo(() => normalizePaymentMode(order.payment_method), [order.payment_method]);
''',
    '''  const recordedPaymentMode = useMemo(() => normalizePaymentMode(order.payment_method), [order.payment_method]);
  const language = isArabic ? "ar" : "en";
  const localizedOrder = order as unknown as Order;
  const localizedCustomerCity = localizedOrderCity(localizedOrder, language, "receiver");
  const localizedPickupAddress = localizedOrderAddress(localizedOrder, language, "sender");
  const localizedDeliveryAddress = localizedOrderAddress(localizedOrder, language, "receiver");
''',
)
replace_once(
    "src/components/driver/DriverCustomerCommunication.tsx",
    '        customerCity: order.receiver_city,',
    '        customerCity: localizedCustomerCity,',
)
replace_once(
    "src/components/driver/DriverCustomerCommunication.tsx",
    '        pickupAddress: [order.sender_city, order.sender_address].filter(Boolean).join("، "),\n        deliveryAddress: [order.receiver_city, order.receiver_address].filter(Boolean).join("، "),',
    '        pickupAddress: localizedPickupAddress,\n        deliveryAddress: localizedDeliveryAddress,',
)

replace_once(
    "src/components/driver/DriverDashboard.tsx",
    'import type { DriverOrder, DriverProfile, DriverShiftStatus, ProfileRole } from "../../types/driver";\n',
    'import type { DriverOrder, DriverProfile, DriverShiftStatus, ProfileRole } from "../../types/driver";\nimport type { Order } from "../../types";\nimport { localizedOrderAddress, localizedOrderCity, localizedOrderDestination, localizedOrderRoute } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/driver/DriverDashboard.tsx",
    '''  const currentWeight = Number(currentOrder?.weight);
  const currentPieces = Number(currentOrder?.pieces);''',
    '''  const currentWeight = Number(currentOrder?.weight);
  const currentPieces = Number(currentOrder?.pieces);
  const displayLanguage = isArabic ? "ar" : "en";
  const localizeDriverOrder = (value: DriverOrder) => value as unknown as Order;''',
)
replace_once(
    "src/components/driver/DriverDashboard.tsx",
    '<span className="dn-driver-exact-job-tags"><em>{statusLabel(order.status, isArabic)}</em><em>{order.receiver_city || (isArabic ? "الإمارات" : "UAE")}</em></span>\n                        <span className="dn-driver-exact-job-route"><b>{order.sender_city || "—"}</b><i>→</i><b>{order.receiver_city || "—"}</b></span>',
    '<span className="dn-driver-exact-job-tags"><em>{statusLabel(order.status, isArabic)}</em><em>{localizedOrderCity(localizeDriverOrder(order), displayLanguage, "receiver")}</em></span>\n                        <span className="dn-driver-exact-job-route"><b>{localizedOrderRoute(localizeDriverOrder(order), displayLanguage)}</b></span>',
)
replace_once(
    "src/components/driver/DriverDashboard.tsx",
    '<div><small>{isArabic ? "الخريطة المباشرة" : "Live map"}</small><h2>{currentOrder ? `${currentOrder.sender_city || "—"} → ${currentOrder.receiver_city || "—"}` : (isArabic ? "موقع المندوب الحالي" : "Current driver location")}</h2></div>',
    '<div><small>{isArabic ? "الخريطة المباشرة" : "Live map"}</small><h2>{currentOrder ? localizedOrderRoute(localizeDriverOrder(currentOrder), displayLanguage) : (isArabic ? "موقع المندوب الحالي" : "Current driver location")}</h2></div>',
)
replace_once(
    "src/components/driver/DriverDashboard.tsx",
    '<div><small>{isArabic ? "عنوان التسليم" : "Delivery address"}</small><strong>{currentOrder ? [currentOrder.receiver_city, currentOrder.receiver_address].filter(Boolean).join("، ") || "—" : (isArabic ? "بانتظار مهمة" : "Waiting for assignment")}</strong><span><Clock3 />{isArabic ? "آخر مزامنة" : "Last sync"}: {lastSyncLabel}</span></div>',
    '<div><small>{isArabic ? "عنوان التسليم" : "Delivery address"}</small><strong>{currentOrder ? localizedOrderDestination(localizeDriverOrder(currentOrder), displayLanguage) : (isArabic ? "بانتظار مهمة" : "Waiting for assignment")}</strong><span><Clock3 />{isArabic ? "آخر مزامنة" : "Last sync"}: {lastSyncLabel}</span></div>',
)

# 5) Merchant app: localized view models feed every merchant section and mobile shell.
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    'import { buildAdminCsv, buildAdminPdf } from "../../lib/adminPdfExport";\n',
    'import { buildAdminCsv, buildAdminPdf } from "../../lib/adminPdfExport";\nimport { localizeExportText, localizedOrderAddress, localizedOrderCity, localizedPackageType, localizedPaymentMethod, localizedServiceType } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    'function mapOrder(order: OrderRecord): MerchantOrderViewModel {',
    'function mapOrder(order: OrderRecord, isArabic: boolean): MerchantOrderViewModel {\n  const language = isArabic ? "ar" : "en";',
)
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    '''    deliveryEmirate: clean(order.receiver_emirate || order.delivery_emirate),
    deliveryCity: clean(order.receiver_city),
    deliveryArea: clean(order.receiver_area || order.delivery_area),
    deliveryAddress: clean(order.receiver_address),
    deliveryLandmark: clean(order.receiver_landmark),
    pickupBranch: clean(order.pickup_branch || order.branch_name),
    pickupAddress: clean(order.sender_address),''',
    '''    deliveryEmirate: localizeExportText(order.receiver_emirate || order.delivery_emirate, language),
    deliveryCity: localizedOrderCity(order, language, "receiver"),
    deliveryArea: localizeExportText(order.receiver_area || order.delivery_area, language),
    deliveryAddress: localizedOrderAddress(order, language, "receiver"),
    deliveryLandmark: localizeExportText(order.receiver_landmark || order.delivery_landmark, language),
    pickupBranch: localizeExportText(order.pickup_branch || order.branch_name, language),
    pickupAddress: localizedOrderAddress(order, language, "sender"),''',
)
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    '''    serviceType: clean(order.service_type),
    packageType: clean(order.package_type),''',
    '''    serviceType: localizedServiceType(order.service_type, language),
    packageType: localizedPackageType(order.package_type, language),''',
)
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    '    paymentMethod: clean(order.payment_method),',
    '    paymentMethod: localizedPaymentMethod(order.payment_method, language),',
)
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    '  const merchant=merchantRows[0] ? mapMerchant(merchantRows[0]) : null; const orders=useMemo(()=>rawOrders.map(mapOrder),[rawOrders]);',
    '  const merchant=merchantRows[0] ? mapMerchant(merchantRows[0]) : null; const orders=useMemo(()=>rawOrders.map((order)=>mapOrder(order,isArabic)),[rawOrders,isArabic]);',
)
replace_once(
    "src/components/merchant/MerchantPortalCommandCenter.tsx",
    '  const selectedOrder=selectedRaw?mapOrder(selectedRaw):null;',
    '  const selectedOrder=selectedRaw?mapOrder(selectedRaw,isArabic):null;',
)

# 6) Customer tracking/history and map popups.
replace_once(
    "src/components/customer/CustomerOrderHistory.tsx",
    'import { sendDeliveryConfirmationEmail } from "../../lib/deliveryConfirmationEmail";\n',
    'import { sendDeliveryConfirmationEmail } from "../../lib/deliveryConfirmationEmail";\nimport { localizedOrderDestination, localizedOrderRoute, localizedPackageType } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/customer/CustomerOrderHistory.tsx",
    '''  const [chatOpen, setChatOpen] = useState(false);
''',
    '''  const [chatOpen, setChatOpen] = useState(false);
  const language = isArabic ? "ar" : "en";
  const route = localizedOrderRoute(order, language);
  const destination = localizedOrderDestination(order, language);
''',
)
replace_once(
    "src/components/customer/CustomerOrderHistory.tsx",
    '''          <p className="mt-1 text-xs font-bold text-white/75">
            {String(row.sender_city || "—")} → {String(row.receiver_city || "—")}
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            {String(row.package_type || (isArabic ? "شحنة" : "Shipment"))} · {Number(row.pieces || 1)} {isArabic ? "قطعة" : "pcs"} · {Number(row.weight || 1)} kg
          </p>''',
    '''          <p className="mt-1 text-xs font-bold text-white/75">{route}</p>
          <p className="mt-1 text-[11px] text-white/55">{destination}</p>
          <p className="mt-1 text-[11px] text-white/45">
            {localizedPackageType(row.package_type || "shipment", language)} · {Number(row.pieces || 1)} {isArabic ? "قطعة" : "pcs"} · {Number(row.weight || 1)} kg
          </p>''',
)

replace_once(
    "src/components/Tracking.tsx",
    'import { whatsappStatusUpdate } from "../lib/whatsapp";\n',
    'import { whatsappStatusUpdate } from "../lib/whatsapp";\nimport { localizedOrderCity, localizedOrderDestination, localizedOrderRoute, localizedOrderStatus, localizedPackageType } from "../lib/exportLocalization";\n',
)
replace_once(
    "src/components/Tracking.tsx",
    '  const locale = isArabic ? "ar-AE" : "en-AE";\n',
    '  const locale = isArabic ? "ar-AE" : "en-AE";\n  const displayLanguage = isArabic ? "ar" : "en";\n',
)
replace_once(
    "src/components/Tracking.tsx",
    '<span style={{ color: textMain }} className="mt-2 block text-sm font-bold">{item.sender_city || "—"} → {item.receiver_city || "—"}</span><span style={{ color: textMuted }} className="mt-1 block text-xs">{item.status || "Pending"} • {formatDate(item.created_at, locale)}</span>',
    '<span style={{ color: textMain }} className="mt-2 block text-sm font-bold">{localizedOrderRoute(item, displayLanguage)}</span><span style={{ color: textMuted }} className="mt-1 block text-xs">{localizedOrderDestination(item, displayLanguage)}</span><span style={{ color: textMuted }} className="mt-1 block text-xs">{localizedOrderStatus(item.status || "pending", displayLanguage)} • {formatDate(item.created_at, locale)}</span>',
)
replace_once(
    "src/components/Tracking.tsx",
    '''{[{ icon: MapPin, label: isArabic ? "مدينة الاستلام" : "From", val: order.sender_city || "—" },{ icon: MapPin, label: isArabic ? "مدينة التسليم" : "To", val: order.receiver_city || "—" },{ icon: Package, label: isArabic ? "محتوى الشحنة" : "Package", val: order.package_description || order.package_type || "—" },''',
    '''{[{ icon: MapPin, label: isArabic ? "مدينة الاستلام" : "From", val: localizedOrderCity(order, displayLanguage, "sender") },{ icon: MapPin, label: isArabic ? "عنوان التسليم الكامل" : "Full delivery address", val: localizedOrderDestination(order, displayLanguage) },{ icon: Package, label: isArabic ? "محتوى الشحنة" : "Package", val: order.package_description ? localizeExportText(order.package_description, displayLanguage) : localizedPackageType(order.package_type || "shipment", displayLanguage) },''',
)
# Add missing import used by the replacement above.
replace_once(
    "src/components/Tracking.tsx",
    'import { localizedOrderCity, localizedOrderDestination, localizedOrderRoute, localizedOrderStatus, localizedPackageType } from "../lib/exportLocalization";',
    'import { localizeExportText, localizedOrderCity, localizedOrderDestination, localizedOrderRoute, localizedOrderStatus, localizedPackageType } from "../lib/exportLocalization";',
)

replace_once(
    "src/components/tracking/TrackingMap.tsx",
    'import { useAppContext } from "../../lib/AppContext";\n',
    'import { useAppContext } from "../../lib/AppContext";\nimport { localizedOrderAddress } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/tracking/TrackingMap.tsx",
    '        {pickupPos && <Marker position={pickupPos} icon={pickupIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-blue uppercase">{t.pickupPoint}</p><p>{getString(activeOrder, ["sender_address", "pickup_address"]) || (isArabic ? pickupLabel.labelAr : pickupLabel.labelEn)}</p></div></Popup></Marker>}',
    '        {pickupPos && <Marker position={pickupPos} icon={pickupIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-blue uppercase">{t.pickupPoint}</p><p>{activeOrder ? localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "sender") : (isArabic ? pickupLabel.labelAr : pickupLabel.labelEn)}</p></div></Popup></Marker>}',
)
replace_once(
    "src/components/tracking/TrackingMap.tsx",
    '        {destinationPos && <Marker position={destinationPos} icon={destinationIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-gold uppercase"><Flag className="mr-1 inline h-3 w-3" />{t.destinationPoint}</p><p>{getString(activeOrder, ["receiver_address", "delivery_address"]) || (isArabic ? destinationLabel.labelAr : destinationLabel.labelEn)}</p></div></Popup></Marker>}',
    '        {destinationPos && <Marker position={destinationPos} icon={destinationIcon}><Popup><div className={`text-xs font-bold ${isArabic ? "text-right" : "text-left"}`}><p className="text-brand-gold uppercase"><Flag className="mr-1 inline h-3 w-3" />{t.destinationPoint}</p><p>{activeOrder ? localizedOrderAddress(activeOrder, isArabic ? "ar" : "en", "receiver") : (isArabic ? destinationLabel.labelAr : destinationLabel.labelEn)}</p></div></Popup></Marker>}',
)

# 7) Admin order tables/details: full localized destination, not emirate-only routes.
replace_once(
    "src/components/admin/AdminSectionWorkspaceComplete.tsx",
    'import { financialsFromOrder } from "../../lib/orderFinancials";\n',
    'import { financialsFromOrder } from "../../lib/orderFinancials";\nimport { localizedOrderCity, localizedOrderDestination } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/admin/AdminSectionWorkspaceComplete.tsx",
    '''const route = (order: Order) =>
  `${order.sender_city || "—"} → ${order.receiver_city || order.destination_country || "—"}`;''',
    '''const route = (order: Order, isArabic: boolean) =>
  `${localizedOrderCity(order, isArabic ? "ar" : "en", "sender")} → ${localizedOrderDestination(order, isArabic ? "ar" : "en")}`;''',
)
replace_once(
    "src/components/admin/AdminSectionWorkspaceComplete.tsx",
    '<td>{route(order)}</td>',
    '<td>{route(order, isArabic)}</td>',
)

replace_once(
    "src/components/admin/AdminOrderDetailsDrawer.tsx",
    'import { statusLabel, fieldLabel, actionLabel } from "../../data/adminTranslations";\n',
    'import { statusLabel, fieldLabel, actionLabel } from "../../data/adminTranslations";\nimport { localizedOrderAddress, localizedOrderCity, localizedOrderDestination, localizedOrderRoute, localizedServiceType } from "../../lib/exportLocalization";\n',
)
replace_once(
    "src/components/admin/AdminOrderDetailsDrawer.tsx",
    '  const x = extra(order); const merchant = merchants.find((m)=>m.id === order.merchant_id || m.trade_name === order.merchant_name);\n',
    '  const x = extra(order); const merchant = merchants.find((m)=>m.id === order.merchant_id || m.trade_name === order.merchant_name);\n  const language = isArabic ? "ar" : "en";\n',
)
replace_regex_once(
    "src/components/admin/AdminOrderDetailsDrawer.tsx",
    r'''  const rows = \[\[fieldLabel\("status",isArabic\)[\s\S]*?\];\n''',
    '''  const rows = [[fieldLabel("status",isArabic), statusLabel(order.status,isArabic)],[fieldLabel("merchant",isArabic), merchantName(merchant) || order.merchant_name],[isArabic?"المرسل":"Sender", order.sender_name],[isArabic?"المستلم":"Receiver", order.receiver_name],[isArabic?"هاتف المرسل":"Sender phone", order.sender_phone],[isArabic?"هاتف المستلم":"Receiver phone", order.receiver_phone],[isArabic?"مدينة الإحضار":"Pickup city", localizedOrderCity(order,language,"sender")],[isArabic?"عنوان الإحضار الكامل":"Full pickup address", localizedOrderAddress(order,language,"sender")],[isArabic?"مدينة التسليم":"Delivery city", localizedOrderCity(order,language,"receiver")],[isArabic?"عنوان التسليم الكامل":"Full delivery address", localizedOrderDestination(order,language)],[fieldLabel("serviceType",isArabic), localizedServiceType(order.service_type,language)],[isArabic?"قيمة COD":"COD amount", money(order.cod_amount)],[isArabic?"رسوم التوصيل":"Delivery fee", money(order.delivery_price || order.price)],[isArabic?"المندوب":"Driver", x.assigned_driver_name || order.driver_name || x.driver_id],[isArabic?"ملاحظات":"Notes", order.notes || x.admin_notes],[isArabic?"تاريخ الإنشاء":"Created", order.created_at],[isArabic?"آخر تحديث":"Last update", order.updated_at]];
''',
)
replace_once(
    "src/components/admin/AdminOrderDetailsDrawer.tsx",
    '<p>{val(order.sender_city || x.pickup_city)} → {val(order.receiver_city || x.delivery_city || order.destination_country)}</p>',
    '<p>{localizedOrderRoute(order, language)} · {localizedOrderDestination(order, language)}</p>',
)

# 8) Permanent fail-closed gate for full addresses and all runtime mounts.
gate = read("scripts/export-language-policy-gate.mjs")
gate = gate.replace(
    '  ["src/types.ts", "receiver_address_ar?: string"],\n];',
    '  ["src/types.ts", "receiver_address_ar?: string"],\n  ["src/lib/exportLocalization.ts", "receiver_building"],\n  ["src/lib/exportLocalization.ts", "export function isLikelyLocationText"],\n  ["src/components/ArabicAddressRuntimeBridge.tsx", "MutationObserver"],\n  ["src/main.tsx", "<ArabicAddressRuntimeBridge />"],\n  ["src/components/driver/DriverOrderCard.tsx", "localizedOrderAddress"],\n  ["src/components/driver/DriverCustomerCommunication.tsx", "localizedDeliveryAddress"],\n  ["src/components/merchant/MerchantPortalCommandCenter.tsx", "localizedOrderAddress(order, language"],\n  ["src/components/Tracking.tsx", "عنوان التسليم الكامل"],\n  ["src/components/admin/AdminSectionWorkspaceComplete.tsx", "localizedOrderDestination"],\n];',
)
gate = gate.replace(
    '  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],\n];',
    '  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],\n  ["Dubai, Deira, Villa 12, Street 5, Building 8, Floor 2, Near Al Zahiyah", "دبي، ديرة، فيلا 12، شارع 5، مبنى 8، الطابق 2، بالقرب من الزاهية"],\n];',
)
if gate == read("scripts/export-language-policy-gate.mjs"):
    raise SystemExit("export-language-policy-gate.mjs: no changes applied")
write("scripts/export-language-policy-gate.mjs", gate)

print("Runtime full Arabic address patch applied.")
