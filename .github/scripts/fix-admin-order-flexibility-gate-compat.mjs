import fs from "node:fs";
import path from "node:path";

const target = path.resolve(
  process.cwd(),
  "artifacts/day-night-delivery/scripts/admin-order-save-localization-gate.mjs",
);
let source = fs.readFileSync(target, "utf8");

const oldBlock = `expect(modal, /sensitiveChange && !confirmed/, "confirmation is limited to sensitive changes");
expect(modal, /تحديث بيانات الطلب من لوحة الإدارة/, "ordinary edits receive an automatic audit reason");`;
const newBlock = `expect(
  modal,
  /automaticEditReason[\\s\\S]*edit_reason: automaticEditReason/,
  "all edits receive an automatic audit reason",
);
reject(
  modal,
  /data-admin-complete-order-reason|data-admin-complete-order-confirm|sensitiveChange && !confirmed/,
  "manual reason and confirmation controls are removed",
);`;

if (!source.includes(oldBlock)) {
  throw new Error("admin_order_flexibility_gate_compat_failed: obsolete localization assertions not found");
}
source = source.replace(oldBlock, newBlock);
fs.writeFileSync(target, source, "utf8");
console.log("Admin order localization gate now verifies automatic audit reasons.");
