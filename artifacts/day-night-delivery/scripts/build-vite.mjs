import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

process.env.BASE_PATH ||= "/";
process.env.PORT ||= "3000";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(appRoot, "src", "App.tsx");

function all(source, from, to) {
  return source.split(from).join(to);
}

function patchApp() {
  if (!fs.existsSync(appPath)) return null;
  const original = fs.readFileSync(appPath, "utf8");
  let out = original;
  out = all(out, 'const adminLabel = isArabic ? "لوحة الإدارة" : "Admin Portal";', 'const customerLabel = isArabic ? "حسابي" : "My Account";');
  out = all(out, 'id="top_admin_portal_link"', 'id="top_customer_portal_link"');
  out = all(out, 'id="desktop_admin_portal_link"', 'id="desktop_customer_portal_link"');
  out = all(out, 'id="mobile_admin_portal_link"', 'id="mobile_customer_portal_link"');
  out = all(out, 'to="/auth"', 'to="/customer"');
  out = all(out, '{adminLabel}', '{customerLabel}');
  out = all(out, '<Route path="/auth" element={<Auth onAuthSuccess={() => navigate("/admin")} />} />', '<Route path="/auth" element={<Auth onAuthSuccess={() => navigate("/admin")} />} />');
  out = all(out, '<Route path="/customer" element={<Auth onAuthSuccess={() => navigate("/customer")} />} />', '<Route path="/customer" element={<CustomerDashboard />} />');
  if (out !== original) {
    fs.writeFileSync(appPath, out, "utf8");
    return original;
  }
  return null;
}

const originalApp = patchApp();
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  pnpmBin,
  ["exec", "vite", "build", "--config", "vite.config.ts"],
  {
    stdio: "inherit",
    env: process.env,
  }
);

if (originalApp !== null) {
  fs.writeFileSync(appPath, originalApp, "utf8");
}

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
