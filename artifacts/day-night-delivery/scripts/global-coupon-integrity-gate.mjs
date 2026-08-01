import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep the authoritative database and update-flow assertions intact.
await import("./global-coupon-integrity-gate-base.mjs");

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDirectory, "..");
const guardPath = path.join(
  appRoot,
  "src/components/admin/AdminNewOrderCouponGuard.tsx",
);
const entryPath = path.join(
  appRoot,
  "src/components/admin/AdminNewOrder.tsx",
);
const completeFormPath = path.join(
  appRoot,
  "src/components/admin/AdminNewOrderComplete.tsx",
);

const guard = fs.readFileSync(guardPath, "utf8");
const entry = fs.readFileSync(entryPath, "utf8");
const completeForm = fs.readFileSync(completeFormPath, "utf8");

assert.match(
  entry,
  /AdminNewOrderCouponGuard/,
  "The production admin entry must render the coupon guard.",
);
assert.match(
  guard,
  /findCouponConflict/,
  "The admin new-order screen must run the authoritative coupon-conflict preflight before submission.",
);
assert.match(
  guard,
  /onSubmitCapture=\{handleSubmitCapture\}/,
  "Coupon preflight must intercept submission before the complete form handler runs.",
);
assert.match(
  guard,
  /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/,
  "A duplicate coupon must stop the original order submission path.",
);
assert.match(
  guard,
  /if \(conflict\) \{[\s\S]*setCouponError\(duplicateCouponMessage/,
  "A detected conflict must render the dedicated operator-facing message.",
);
assert.match(
  guard,
  /رقم الكوبون «\$\{coupon\}» مسجل بالفعل على الطلب \$\{tracking\} للتاجر \$\{merchant\}/,
  "The Arabic duplicate message must identify coupon, order, and merchant.",
);
assert.match(
  guard,
  /role="alert"[\s\S]*aria-live="assertive"/,
  "The duplicate message must be immediately announced and visually exposed.",
);
assert.match(
  guard,
  /bypassNextSubmit\.current = true;[\s\S]*form\.requestSubmit\(\);/,
  "A unique coupon must continue through the original order creation flow exactly once.",
);
assert.doesNotMatch(
  guard,
  /تعذر حفظ الطلب المالي الحقيقي/,
  "The coupon guard must never replace precise diagnostics with the generic financial failure message.",
);
assert.match(
  completeForm,
  /export default function AdminNewOrderComplete/,
  "The complete production order form remains at its build-patched canonical path.",
);

console.log("PASS direct duplicate coupon message gate");
