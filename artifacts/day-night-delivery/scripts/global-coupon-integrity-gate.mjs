import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep the authoritative database and update-flow assertions intact.
await import("./global-coupon-integrity-gate-base.mjs");

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(currentDirectory, "..");
const wrapperPath = path.join(
  appRoot,
  "src/components/admin/AdminNewOrderComplete.tsx",
);
const baseComponentPath = path.join(
  appRoot,
  "src/components/admin/AdminNewOrderCompleteBase.tsx",
);

const wrapper = fs.readFileSync(wrapperPath, "utf8");
const baseComponent = fs.readFileSync(baseComponentPath, "utf8");

assert.match(
  wrapper,
  /findCouponConflict/,
  "The admin new-order screen must run the authoritative coupon-conflict preflight before submission.",
);
assert.match(
  wrapper,
  /onSubmitCapture=\{handleSubmitCapture\}/,
  "Coupon preflight must intercept submission before the legacy form handler runs.",
);
assert.match(
  wrapper,
  /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/,
  "A duplicate coupon must stop the original order submission path.",
);
assert.match(
  wrapper,
  /if \(conflict\) \{[\s\S]*setCouponError\(duplicateCouponMessage/,
  "A detected conflict must render the dedicated operator-facing message.",
);
assert.match(
  wrapper,
  /رقم الكوبون «\$\{coupon\}» مسجل بالفعل على الطلب \$\{tracking\} للتاجر \$\{merchant\}/,
  "The Arabic duplicate message must identify coupon, order, and merchant.",
);
assert.match(
  wrapper,
  /role="alert"[\s\S]*aria-live="assertive"/,
  "The duplicate message must be immediately announced and visually exposed.",
);
assert.match(
  wrapper,
  /bypassNextSubmit\.current = true;[\s\S]*form\.requestSubmit\(\);/,
  "A unique coupon must continue through the original order creation flow exactly once.",
);
assert.doesNotMatch(
  wrapper,
  /تعذر حفظ الطلب المالي الحقيقي/,
  "The duplicate-coupon wrapper must never replace precise diagnostics with the generic financial failure message.",
);
assert.match(
  baseComponent,
  /export default function AdminNewOrderComplete/,
  "The existing complete order form must remain intact behind the coupon preflight wrapper.",
);

console.log("PASS direct duplicate coupon message gate");
