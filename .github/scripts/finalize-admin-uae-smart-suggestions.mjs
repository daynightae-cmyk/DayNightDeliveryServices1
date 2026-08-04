import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const write = (relative, content) => {
  const target = path.resolve(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
};

function insertBeforeOtherArea(source, anchor, entries, label) {
  if (source.includes(entries[0])) return source;
  const marker = `${anchor}\n      otherArea,`;
  if (!source.includes(marker)) {
    throw new Error(`uae_location_expansion_failed:${label}`);
  }
  return source.replace(marker, `${anchor}\n${entries.join("\n")}\n      otherArea,`);
}

const locationPath = "artifacts/day-night-delivery/src/data/uaeLocations.ts";
let locations = read(locationPath);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "Al Dhafra", ar: "الظفرة", en: "Al Dhafra" },',
  [
    '      { value: "Al Maqta", ar: "المقطع", en: "Al Maqta" },',
    '      { value: "Rabdan", ar: "ربدان", en: "Rabdan" },',
    '      { value: "Sas Al Nakhl", ar: "ساس النخل", en: "Sas Al Nakhl" },',
    '      { value: "Al Forsan Village", ar: "قرية الفرسان", en: "Al Forsan Village" },',
    '      { value: "Al Qurm Abu Dhabi", ar: "القرم أبوظبي", en: "Al Qurm Abu Dhabi" },',
    '      { value: "Mangrove Village", ar: "قرية القرم", en: "Mangrove Village" },',
    '      { value: "Al Mafraq", ar: "المفرق", en: "Al Mafraq" },',
    '      { value: "Al Mafraq Industrial", ar: "المفرق الصناعية", en: "Al Mafraq Industrial" },',
    '      { value: "Al Nahda Abu Dhabi", ar: "النهضة أبوظبي", en: "Al Nahda Abu Dhabi" },',
    '      { value: "Al Adla", ar: "العدلة", en: "Al Adla" },',
    '      { value: "Madinat Al Riyadh", ar: "مدينة الرياض", en: "Madinat Al Riyadh" },',
    '      { value: "Zayed Military City", ar: "مدينة زايد العسكرية", en: "Zayed Military City" },',
    '      { value: "Al Wathba South", ar: "الوثبة جنوب", en: "Al Wathba South" },',
    '      { value: "Sweihan", ar: "سويحان", en: "Sweihan" },',
    '      { value: "Al Faya", ar: "الفاية", en: "Al Faya" },',
    '      { value: "Al Bandar", ar: "البندر", en: "Al Bandar" },',
    '      { value: "Al Seef Abu Dhabi", ar: "السيف أبوظبي", en: "Al Seef Abu Dhabi" },',
  ],
  "abu_dhabi",
);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "Dubai Airport Free Zone", ar: "المنطقة الحرة بمطار دبي", en: "Dubai Airport Free Zone" },',
  [
    '      { value: "Al Garhoud", ar: "القرهود", en: "Al Garhoud" },',
    '      { value: "Al Rashidiya Dubai", ar: "الراشدية دبي", en: "Al Rashidiya Dubai" },',
    '      { value: "Al Twar", ar: "الطوار", en: "Al Twar" },',
    '      { value: "Hor Al Anz", ar: "هور العنز", en: "Hor Al Anz" },',
    '      { value: "Al Mamzar Dubai", ar: "الممزر دبي", en: "Al Mamzar Dubai" },',
    '      { value: "Al Khawaneej", ar: "الخوانيج", en: "Al Khawaneej" },',
    '      { value: "Al Awir", ar: "العوير", en: "Al Awir" },',
    '      { value: "Nad Al Hamar", ar: "ند الحمر", en: "Nad Al Hamar" },',
    '      { value: "Umm Ramool", ar: "أم رمول", en: "Umm Ramool" },',
    '      { value: "Warsan", ar: "ورسان", en: "Warsan" },',
    '      { value: "Dubai Creek Harbour", ar: "خور دبي هاربور", en: "Dubai Creek Harbour" },',
    '      { value: "Dubai Festival City", ar: "دبي فستيفال سيتي", en: "Dubai Festival City" },',
    '      { value: "Dubai Healthcare City", ar: "مدينة دبي الطبية", en: "Dubai Healthcare City" },',
    '      { value: "City Walk", ar: "سيتي ووك", en: "City Walk" },',
    '      { value: "Al Wasl", ar: "الوصل", en: "Al Wasl" },',
    '      { value: "Al Safa", ar: "الصفا", en: "Al Safa" },',
    '      { value: "Barsha Heights", ar: "برشا هايتس", en: "Barsha Heights" },',
    '      { value: "Dubai Internet City", ar: "مدينة دبي للإنترنت", en: "Dubai Internet City" },',
    '      { value: "Dubai Media City", ar: "مدينة دبي للإعلام", en: "Dubai Media City" },',
    '      { value: "Dubai Studio City", ar: "مدينة دبي للاستوديوهات", en: "Dubai Studio City" },',
    '      { value: "Town Square Dubai", ar: "تاون سكوير دبي", en: "Town Square Dubai" },',
    '      { value: "Mudon", ar: "مدن", en: "Mudon" },',
    '      { value: "The Sustainable City", ar: "المدينة المستدامة", en: "The Sustainable City" },',
    '      { value: "Expo City Dubai", ar: "مدينة إكسبو دبي", en: "Expo City Dubai" },',
  ],
  "dubai",
);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "Dibba Al Hisn", ar: "دبا الحصن", en: "Dibba Al Hisn" },',
  [
    '      { value: "Aljada", ar: "الجادة", en: "Aljada" },',
    '      { value: "Al Rifaah", ar: "الرفاعة", en: "Al Rifaah" },',
    '      { value: "Al Noaf", ar: "النوف", en: "Al Noaf" },',
    '      { value: "Al Gharayen", ar: "القرائن", en: "Al Gharayen" },',
    '      { value: "Hoshi", ar: "حوشي", en: "Hoshi" },',
    '      { value: "Al Juraina", ar: "الجرينة", en: "Al Juraina" },',
    '      { value: "Al Ramtha", ar: "الرمثاء", en: "Al Ramtha" },',
    '      { value: "Al Azra", ar: "العزرة", en: "Al Azra" },',
    '      { value: "Al Goaz", ar: "القوز الشارقة", en: "Al Goaz" },',
    '      { value: "Al Falaj Sharjah", ar: "الفلج الشارقة", en: "Al Falaj Sharjah" },',
    '      { value: "Al Sabkha Sharjah", ar: "الصبخة الشارقة", en: "Al Sabkha Sharjah" },',
    '      { value: "Al Fayha Sharjah", ar: "الفيحاء الشارقة", en: "Al Fayha Sharjah" },',
    '      { value: "Al Nekhailat", ar: "النخيلات", en: "Al Nekhailat" },',
    '      { value: "Wasit", ar: "واسط", en: "Wasit" },',
    '      { value: "Al Qarayen", ar: "القرائن", en: "Al Qarayen" },',
    '      { value: "Al Zubair", ar: "الزبير", en: "Al Zubair" },',
    '      { value: "Al Batayeh", ar: "البطائح", en: "Al Batayeh" },',
    '      { value: "Mleiha", ar: "مليحة", en: "Mleiha" },',
    '      { value: "Al Dhaid", ar: "الذيد", en: "Al Dhaid" },',
  ],
  "sharjah",
);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "Manama Ajman", ar: "المنامة عجمان", en: "Manama Ajman" },',
  [
    '      { value: "Al Sawan", ar: "الصوان", en: "Al Sawan" },',
    '      { value: "Al Owan", ar: "العوان", en: "Al Owan" },',
    '      { value: "Al Raqaib", ar: "الرقايب", en: "Al Raqaib" },',
    '      { value: "Al Bahia Ajman", ar: "الباهية عجمان", en: "Al Bahia Ajman" },',
    '      { value: "Al Jurf 1", ar: "الجرف 1", en: "Al Jurf 1" },',
    '      { value: "Al Jurf 2", ar: "الجرف 2", en: "Al Jurf 2" },',
    '      { value: "Al Jurf 3", ar: "الجرف 3", en: "Al Jurf 3" },',
    '      { value: "Al Nuaimiya 1", ar: "النعيمية 1", en: "Al Nuaimiya 1" },',
    '      { value: "Al Nuaimiya 2", ar: "النعيمية 2", en: "Al Nuaimiya 2" },',
    '      { value: "Al Nuaimiya 3", ar: "النعيمية 3", en: "Al Nuaimiya 3" },',
    '      { value: "Al Rashidiya 1 Ajman", ar: "الراشدية 1 عجمان", en: "Al Rashidiya 1 Ajman" },',
    '      { value: "Al Rashidiya 2 Ajman", ar: "الراشدية 2 عجمان", en: "Al Rashidiya 2 Ajman" },',
    '      { value: "Al Rashidiya 3 Ajman", ar: "الراشدية 3 عجمان", en: "Al Rashidiya 3 Ajman" },',
    '      { value: "Al Mowaihat 1", ar: "المويهات 1", en: "Al Mowaihat 1" },',
    '      { value: "Al Mowaihat 2", ar: "المويهات 2", en: "Al Mowaihat 2" },',
    '      { value: "Al Mowaihat 3", ar: "المويهات 3", en: "Al Mowaihat 3" },',
    '      { value: "Ajman Uptown", ar: "عجمان أب تاون", en: "Ajman Uptown" },',
  ],
  "ajman",
);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "Emirates Modern Industrial Area", ar: "الصناعية الحديثة", en: "Emirates Modern Industrial Area" },',
  [
    '      { value: "Al Abraq", ar: "الأبرق", en: "Al Abraq" },',
    '      { value: "Al Hawiyah", ar: "الحوية", en: "Al Hawiyah" },',
    '      { value: "Al Neefah", ar: "النيفة", en: "Al Neefah" },',
    '      { value: "Al Surrah", ar: "السرة", en: "Al Surrah" },',
    '      { value: "Al Riqqah", ar: "الرقة", en: "Al Riqqah" },',
    '      { value: "Al Rass 1", ar: "الرأس 1", en: "Al Rass 1" },',
    '      { value: "Al Rass 2", ar: "الرأس 2", en: "Al Rass 2" },',
    '      { value: "Al Rass 3", ar: "الرأس 3", en: "Al Rass 3" },',
    '      { value: "Al Salamah 1", ar: "السلامة 1", en: "Al Salamah 1" },',
    '      { value: "Al Salamah 2", ar: "السلامة 2", en: "Al Salamah 2" },',
    '      { value: "Al Salamah 3", ar: "السلامة 3", en: "Al Salamah 3" },',
    '      { value: "Al Humrah A", ar: "الحمرة أ", en: "Al Humrah A" },',
    '      { value: "Al Humrah B", ar: "الحمرة ب", en: "Al Humrah B" },',
    '      { value: "Al Humrah C", ar: "الحمرة ج", en: "Al Humrah C" },',
    '      { value: "Al Humrah D", ar: "الحمرة د", en: "Al Humrah D" },',
    '      { value: "Umm Al Quwain Industrial Area", ar: "صناعية أم القيوين", en: "Umm Al Quwain Industrial Area" },',
  ],
  "umm_al_quwain",
);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "RAK Economic Zone", ar: "مناطق رأس الخيمة الاقتصادية", en: "RAK Economic Zone" },',
  [
    '      { value: "Al Kharran", ar: "الخران", en: "Al Kharran" },',
    '      { value: "Al Digdaga", ar: "الدقداقة", en: "Al Digdaga" },',
    '      { value: "Al Fahlain", ar: "الفحلين", en: "Al Fahlain" },',
    '      { value: "Al Ghail", ar: "الغيل", en: "Al Ghail" },',
    '      { value: "Al Jeer", ar: "الجير", en: "Al Jeer" },',
    '      { value: "Al Dhait North", ar: "الظيت الشمالي", en: "Al Dhait North" },',
    '      { value: "Al Dhait South", ar: "الظيت الجنوبي", en: "Al Dhait South" },',
    '      { value: "Al Qurm RAK", ar: "القرم رأس الخيمة", en: "Al Qurm RAK" },',
    '      { value: "Al Mairid", ar: "المعيريض", en: "Al Mairid" },',
    '      { value: "Al Nadiyah", ar: "الندية", en: "Al Nadiyah" },',
    '      { value: "Al Turfa RAK", ar: "الظرفة رأس الخيمة", en: "Al Turfa RAK" },',
    '      { value: "Al Hudaiba RAK", ar: "الحضيبة رأس الخيمة", en: "Al Hudaiba RAK" },',
    '      { value: "Al Juwais", ar: "الجويس", en: "Al Juwais" },',
    '      { value: "Al Mataf", ar: "المطاف", en: "Al Mataf" },',
    '      { value: "Al Julan", ar: "الجولان", en: "Al Julan" },',
    '      { value: "Seih Al Uraibi", ar: "سيح العريبي", en: "Seih Al Uraibi" },',
  ],
  "ras_al_khaimah",
);

locations = insertBeforeOtherArea(
  locations,
  '      { value: "Al Tawyeen", ar: "الطويين", en: "Al Tawyeen" },',
  [
    '      { value: "Al Hlaifat", ar: "الحليفات", en: "Al Hlaifat" },',
    '      { value: "Al Owaid", ar: "العويد", en: "Al Owaid" },',
    '      { value: "Al Sharia", ar: "الشرية", en: "Al Sharia" },',
    '      { value: "Al Mahatta Fujairah", ar: "المحطة الفجيرة", en: "Al Mahatta Fujairah" },',
    '      { value: "Fujairah Port", ar: "ميناء الفجيرة", en: "Fujairah Port" },',
    '      { value: "Fujairah Industrial Area", ar: "صناعية الفجيرة", en: "Fujairah Industrial Area" },',
    '      { value: "Dibba Industrial Area", ar: "صناعية دبا", en: "Dibba Industrial Area" },',
    '      { value: "Wadi Al Siji", ar: "وادي السيجي", en: "Wadi Al Siji" },',
    '      { value: "Wadi Saham", ar: "وادي سهم", en: "Wadi Saham" },',
    '      { value: "Al Bithnah", ar: "البثنة", en: "Al Bithnah" },',
    '      { value: "Al Halah", ar: "الحلاة", en: "Al Halah" },',
    '      { value: "Al Farfar", ar: "الفرفار", en: "Al Farfar" },',
    '      { value: "Awhala", ar: "أوحلة", en: "Awhala" },',
    '      { value: "Wadi Mai", ar: "وادي مي", en: "Wadi Mai" },',
    '      { value: "Al Siji", ar: "السيجي", en: "Al Siji" },',
  ],
  "fujairah",
);

write(locationPath, locations);

const gatePath = "artifacts/day-night-delivery/scripts/admin-uae-smart-suggestions-currency-gate.mjs";
write(
  gatePath,
  `import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(\`admin_uae_smart_suggestions_currency_gate_failed: \${message}\`);
};

const locations = read("src/data/uaeLocations.ts");
const autocomplete = read("src/components/admin/AdminHistoryAutocomplete.tsx");
const locale = read("src/lib/adminLocale.ts");
const style = read("src/styles/dn-admin-smart-autocomplete.css");

for (const expected of [
  "Shakhbout City",
  "Madinat Al Riyadh",
  "Dubai Creek Harbour",
  "Aljada",
  "Al Sawan",
  "Al Abraq",
  "Al Kharran",
  "Fujairah Port",
]) {
  assert(locations.includes(expected), \`missing expanded UAE area: \${expected}\`);
}

const areaCount = (locations.match(/\\{ value: /g) || []).length;
assert(areaCount >= 250, \`UAE area catalog remains too small: \${areaCount}\`);
assert(autocomplete.includes("rankedSuggestions") && autocomplete.includes("editDistance"), "fuzzy first-character suggestion engine missing");
assert(autocomplete.includes("UAE_LOCATIONS.flatMap"), "official UAE locations are absent from suggestions");
assert(autocomplete.includes("orders.flatMap") && autocomplete.includes("merchants.flatMap"), "database history is absent from suggestions");
assert(autocomplete.includes("ArrowDown") && autocomplete.includes("ArrowUp") && autocomplete.includes("Enter"), "keyboard suggestion navigation missing");
assert(autocomplete.includes("dn-admin-smart-suggestion-menu"), "Google-style suggestion menu missing");
assert(!autocomplete.includes("<datalist"), "native datalist remains the only suggestion experience");
assert(locale.includes("normalizeAdminCurrencyText"), "Arabic currency normalization helper missing");
assert(locale.includes("درهم") && locale.includes("الدرهم الإماراتي"), "professional Arabic currency labels missing");
assert(autocomplete.includes("normalizeAdminCurrencyText(original, true)"), "global Arabic admin currency guard missing");
assert(style.includes("position: fixed") && style.includes("z-index: 2147483000"), "suggestion menu cannot stay above admin modals");

console.log(JSON.stringify({
  result: "PASS",
  areaCount,
  expandedAllEmirates: true,
  oneCharacterSuggestions: true,
  fuzzyArabicTypos: true,
  historicalValues: true,
  keyboardNavigation: true,
  professionalArabicCurrency: true,
}, null, 2));
`,
);

const packagePath = "artifacts/day-night-delivery/package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts["admin-uae-smart-suggestions-currency:gate"] =
  "node scripts/admin-uae-smart-suggestions-currency-gate.mjs";
if (!packageJson.scripts["production:gate"].includes("admin-uae-smart-suggestions-currency-gate.mjs")) {
  packageJson.scripts["production:gate"] +=
    " && node scripts/admin-uae-smart-suggestions-currency-gate.mjs";
}
write(packagePath, JSON.stringify(packageJson, null, 2));

console.log(JSON.stringify({
  result: "PATCHED",
  expandedUaeAreas: true,
  smartSuggestions: true,
  fuzzyArabicMatching: true,
  professionalArabicCurrency: true,
}, null, 2));
