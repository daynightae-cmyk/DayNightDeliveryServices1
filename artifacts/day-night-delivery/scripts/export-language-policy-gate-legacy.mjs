import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [
  ["src/lib/exportLocalization.ts", "localizedOrderDestination"],
  ["src/lib/exportLocalization.ts", "const cityFallbackKeys = side === \"receiver\""],
  ["src/lib/exportLocalization.ts", "const broaderArabicKeys = side === \"receiver\""],
  ["src/lib/exportLocalization.ts", "[...ARABIC_PHRASES].sort"],
  ["src/lib/exportLocalization.ts", "/(address|destination|route|city|area|emirate|location|عنوان|وجهة|مسار|مدينة|منطقة|إمارة)/i"],
  ["src/lib/adminPdfExport.ts", "localizedCell(payload, column"],
  ["src/lib/adminPdfExport.ts", "csvValue(localizedCell"],
  ["src/lib/merchantStatementExport.ts", "destination: localizeExportText"],
  ["src/components/admin/AdminMerchantStatementsCenter.tsx", "localizedOrderDestination(order"],
  ["src/components/admin/AdminOrderBulkOperations.tsx", "localizedOrderRoute(order"],
  ["src/lib/invoice.ts", "localizedOrderAddress(order, lang"],
  ["src/lib/invoice.ts", "localizeExportText(order.package_description, lang)"],
  ["src/lib/printableDocuments.ts", "const receiverAddress = localizeExportText"],
  ["src/lib/exportUtils.ts", "const receiverAddress = localizeExportText"],
  ["src/types.ts", "receiver_address_ar?: string"],
  ["src/components/AdminPanel.tsx", "localizedOrderCity(order, language, \"receiver\")"],
  ["src/components/AdminPanel.tsx", "localizedPackageType(order.package_type, language)"],
  ["src/components/AdminPanel.tsx", "localizedPaymentMethod(order.payment_method, language)"],
  ["src/components/AdminPanel.tsx", "localizedOrderStatus(order.status, language)"],
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
];

for (const [path, marker] of checks) {
  if (!read(path).includes(marker)) throw new Error(`${path}: missing ${marker}`);
}

const packageJson = JSON.parse(read("package.json"));
if (packageJson.scripts?.["export-language:gate"] !== "node scripts/export-language-policy-gate.mjs") {
  throw new Error("package.json: export-language:gate is not wired");
}
if (!String(packageJson.scripts?.["production:gate"] || "").includes("node scripts/export-language-policy-gate.mjs")) {
  throw new Error("package.json: production:gate does not enforce export localization");
}
if (packageJson.scripts?.["customer-experience:e2e"] !== "node scripts/customer-experience-runtime-e2e.mjs") {
  throw new Error("package.json: customer-experience:e2e was removed");
}

const localization = read("src/lib/exportLocalization.ts");
const cityFallbackIndex = localization.indexOf("const city = explicitText(record, cityFallbackKeys)");
const broaderArabicIndex = localization.indexOf("const explicitArabicBroaderLocation = explicitText(record, broaderArabicKeys)");
if (cityFallbackIndex < 0 || broaderArabicIndex < 0 || cityFallbackIndex > broaderArabicIndex) {
  throw new Error("City-specific fallback must resolve before broader Arabic emirate/country fields");
}

const englishPreservationCount = (localization.match(/if \(language !== "ar"\) return clean\(value\) \|\| EMPTY;/g) || []).length;
if (englishPreservationCount !== 4) {
  throw new Error(`Expected 4 English enum preservation guards, found ${englishPreservationCount}`);
}

function extractPairs(constantName) {
  const match = localization.match(new RegExp(`const ${constantName} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`Unable to read ${constantName}`);
  return [...match[1].matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map((entry) => [entry[1], entry[2]]);
}

const phrasePairs = extractPairs("ARABIC_PHRASES");
const termPairs = extractPairs("ARABIC_TERMS");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const replacePhrase = (source, latin, arabic) => source.replace(new RegExp(`\\b${escapeRegExp(latin)}\\b`, "gi"), arabic);

function localizeKnownAddress(value) {
  let text = value;
  [...phrasePairs, ...termPairs]
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([latin, arabic]) => { text = replacePhrase(text, latin, arabic); });
  return text
    .replace(/\s*,\s*/g, "، ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const screenshotFixtures = [
  ["Dubai, Deira - Dubai", "دبي، ديرة - دبي"],
  ["Dubai, Ras Al Khor - Dubai", "دبي، رأس الخور - دبي"],
  ["Al Ain: Al Khalidiyah Al Ain - Al Ain", "العين: الخالدية العين - العين"],
  ["Abu Dhabi, Al Zahiyah - Abu Dhabi", "أبوظبي، الزاهية - أبوظبي"],
  ["Sharjah, Al Nud - Sharjah", "الشارقة، النود - الشارقة"],
  ["Dubai, Deira, Villa 12, Street 5, Building 8, Floor 2, Near Al Zahiyah", "دبي، ديرة، فيلا 12، شارع 5، مبنى 8، الطابق 2، بالقرب من الزاهية"],
];

for (const [input, expected] of screenshotFixtures) {
  const actual = localizeKnownAddress(input);
  if (actual !== expected) throw new Error(`Arabic address fixture failed: ${input} -> ${actual}; expected ${expected}`);
  if (/[A-Za-z]/.test(actual)) throw new Error(`Arabic address fixture still contains Latin text: ${actual}`);
}

console.log(`Export language policy gate passed (${screenshotFixtures.length} Arabic address fixtures).`);
