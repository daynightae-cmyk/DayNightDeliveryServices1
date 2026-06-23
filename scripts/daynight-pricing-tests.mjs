import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function asNumber(value) {
  return Number(Number(value).toFixed(2));
}

function assertEqual(actual, expected, label) {
  if (asNumber(actual) !== asNumber(expected)) {
    throw new Error(`${label} failed: expected ${expected}, got ${actual}`);
  }
  console.log(`PASS: ${label} = ${asNumber(actual)}`);
}

async function loadPricingModule() {
  const entryPoint = path.resolve(rootDir, "src/lib/pricing.ts");
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    target: ["node20"]
  });

  const bundled = result.outputFiles?.[0]?.text;
  if (!bundled) {
    throw new Error("Failed to bundle pricing module");
  }

  const dataUrl = `data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`;
  return import(dataUrl);
}

async function run() {
  const {
    calculateDomesticPrice,
    calculateInternationalPrice
  } = await loadPricingModule();

  const main = calculateDomesticPrice({ deliveryCity: "Abu Dhabi", weight: 1, serviceType: "standard" });
  assertEqual(main.total, 31.5, "local main total");

  const extended = calculateDomesticPrice({ deliveryCity: "Al Ain", weight: 1, serviceType: "standard" });
  assertEqual(extended.total, 52.5, "local extended total");

  const mainExpress = calculateDomesticPrice({ deliveryCity: "Dubai", weight: 1, serviceType: "express" });
  assertEqual(mainExpress.total, 47.25, "main express total");

  const sa1 = calculateInternationalPrice({ countryCode: "SA", weight: 1 });
  assertEqual(sa1.total, 99.75, "SA 1kg total");

  const sa2 = calculateInternationalPrice({ countryCode: "SA", weight: 2 });
  assertEqual(sa2.total, 147, "SA 2kg total");

  const sa3 = calculateInternationalPrice({ countryCode: "SA", weight: 3 });
  assertEqual(sa3.total, 194.25, "SA 3kg total");

  const us1 = calculateInternationalPrice({ countryCode: "US", weight: 1 });
  assertEqual(us1.total, 199.5, "US 1kg total");

  const us2 = calculateInternationalPrice({ countryCode: "US", weight: 2 });
  assertEqual(us2.total, 294, "US 2kg total");

  const us3 = calculateInternationalPrice({ countryCode: "US", weight: 3 });
  assertEqual(us3.total, 388.5, "US 3kg total");

  const negativeWeight = calculateInternationalPrice({ countryCode: "US", weight: -5 });
  if (negativeWeight.billableWeight < 1) {
    throw new Error("negative weight must fail or normalize safely");
  }
  assertEqual(negativeWeight.billableWeight, 1, "negative weight normalized to 1kg");

  const zeroWeight = calculateInternationalPrice({ countryCode: "SA", weight: 0 });
  assertEqual(zeroWeight.billableWeight, 1, "zero weight normalized to 1kg");

  console.log("PRICING TESTS PASS");
}

run().catch((error) => {
  console.error("PRICING TESTS FAIL:", error.message);
  process.exitCode = 1;
});
