// Executes the exact TypeScript formatter source under the repository's Node 20 CI runtime.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(currentDirectory, "../src/lib/destinationLocation.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});

if (transpiled.diagnostics?.length) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(transpiled.diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
  throw new Error(formatted);
}

const temporaryModule = path.resolve(currentDirectory, `.destination-location-${process.pid}.mjs`);
fs.writeFileSync(temporaryModule, transpiled.outputText, "utf8");

try {
  const {
    areEquivalentLocations,
    formatDestinationLocation,
    inferDestinationEmirate,
  } = await import(`${pathToFileURL(temporaryModule).href}?v=${Date.now()}`);

  const cases = [
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
} finally {
  fs.rmSync(temporaryModule, { force: true });
}
