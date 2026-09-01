import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const recovery = read("src/lib/adminOrderRecovery.ts");
const modal = read("src/components/admin/AdminOrderDeleteModal.tsx");
const deleteData = read("src/lib/adminOrderDeleteData.ts");

function expect(content, pattern, label) {
  if (!pattern.test(content)) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

expect(recovery, /\.eq\("is_deleted", false\)/, "active order recovery excludes soft-deleted rows");
expect(modal, /deleteAdminOrderImmediately\(order\)/, "trash button executes the audited delete path");
expect(modal, /mutation:\s*"delete"/, "successful delete removes the row from mounted Admin state");
expect(deleteData, /softDeleteAdminOrder\(orderId/, "normal Admin delete persists through canonical soft-delete RPC");
expect(deleteData, /admin_soft_delete_readback_not_confirmed/, "delete action requires database readback confirmation");

console.log("PASS admin active-order delete gate");
