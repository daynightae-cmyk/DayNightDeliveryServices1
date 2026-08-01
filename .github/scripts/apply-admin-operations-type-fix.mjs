import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "artifacts/day-night-delivery/src/lib/adminOperationsData.ts");
let source = fs.readFileSync(file, "utf8");
const before = source;
source = source.replace(
  "  const deliveryFeeMode = merchantPaysDelivery\n    ? \"deduct_from_merchant\"\n    : \"customer_pays\";",
  "  const deliveryFeeMode: \"deduct_from_merchant\" | \"customer_pays\" = merchantPaysDelivery\n    ? \"deduct_from_merchant\"\n    : \"customer_pays\";",
);
if (!source.includes('const deliveryFeeMode: "deduct_from_merchant" | "customer_pays"')) {
  throw new Error("Typed deliveryFeeMode marker was not found or applied.");
}
if (source !== before) fs.writeFileSync(file, source, "utf8");
console.log("Admin operations delivery fee mode is explicitly typed.");
