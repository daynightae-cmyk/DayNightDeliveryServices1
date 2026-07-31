import assert from "node:assert/strict";
import {
  areEquivalentLocations,
  formatDestinationLocation,
  inferDestinationEmirate,
} from "../src/lib/destinationLocation.ts";

const cases: Array<{
  emirate: string;
  area: string;
  locale: "ar" | "en";
  expected: string;
}> = [
  { emirate: "أبوظبي", area: "الشامخة", locale: "ar", expected: "أبوظبي — الشامخة" },
  { emirate: "أبوظبي", area: "أبوظبي", locale: "ar", expected: "أبوظبي" },
  { emirate: "Abu Dhabi", area: "Abu Dhabi", locale: "en", expected: "Abu Dhabi" },
  { emirate: "دبي", area: "", locale: "ar", expected: "دبي" },
  { emirate: "", area: "الشامخة", locale: "ar", expected: "الشامخة" },
  { emirate: "أبوظبي", area: "Al Shamkha", locale: "ar", expected: "أبوظبي — الشامخة" },
  { emirate: "Abu-Dhabi", area: "أبوظبي", locale: "ar", expected: "أبوظبي" },
  { emirate: "Abu Dhabi", area: "Al Shamkha", locale: "en", expected: "Abu Dhabi — Al Shamkha" },
  { emirate: "Dubai", area: "Al Barsha", locale: "ar", expected: "دبي — البرشاء" },
  { emirate: "Ras Al Khaimah", area: "Al Dhait", locale: "ar", expected: "رأس الخيمة — الظيت" },
];

for (const testCase of cases) {
  assert.equal(
    formatDestinationLocation(testCase.emirate, testCase.area, testCase.locale),
    testCase.expected,
    `${testCase.emirate} + ${testCase.area} (${testCase.locale})`,
  );
}

assert.equal(areEquivalentLocations("Abu Dhabi", "أبوظبي"), true);
assert.equal(areEquivalentLocations("Abu-Dhabi", "ابوظبي"), true);
assert.equal(inferDestinationEmirate("Al Ain", "ar"), "أبوظبي");
assert.equal(inferDestinationEmirate("Al Barsha", "en"), "Dubai");

console.log(`PASS destination location formatter (${cases.length + 4} assertions)`);
