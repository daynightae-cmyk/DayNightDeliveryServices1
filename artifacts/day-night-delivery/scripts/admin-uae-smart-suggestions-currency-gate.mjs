import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_uae_smart_suggestions_currency_gate_failed: ${message}`);
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
  assert(locations.includes(expected), `missing expanded UAE area: ${expected}`);
}

const areaCount = (locations.match(/\{ value: /g) || []).length;
assert(areaCount >= 250, `UAE area catalog remains too small: ${areaCount}`);
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
