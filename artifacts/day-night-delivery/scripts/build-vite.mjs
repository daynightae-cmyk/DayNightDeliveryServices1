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

  out = all(
    out,
    'const adminLabel = isArabic ? "لوحة الإدارة" : "Admin Portal";',
    'const adminLabel = isArabic ? "لوحة الإدارة" : "Admin Portal";\n  const customerLabel = isArabic ? "حسابي" : "My Account";'
  );

  out = out.replace(
    /(<Link\s+id="top_admin_portal_link"[\s\S]*?<\/Link>)/,
    '$1\n          <span className={`hidden md:inline ${isLight ? "text-[#071A33]/20" : "text-white/20"}`}>|</span>\n          <Link id="top_customer_portal_link" to="/customer" className="hidden md:inline text-[10px] font-black text-brand-gold hover:text-white transition-colors">\n            {customerLabel}\n          </Link>'
  );

  out = out.replace(
    /(<Link\s+id="desktop_admin_portal_link"[\s\S]*?<\/Link>)/,
    '$1\n            <Link id="desktop_customer_portal_link" to="/customer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="px-3 py-2 border border-brand-gold/50 bg-brand-gold/10 text-brand-gold font-bold rounded-lg text-[11px] transition-all hover:bg-brand-gold hover:text-brand-deep">\n              {customerLabel}\n            </Link>'
  );

  out = out.replace(
    /(<div className="pt-2 space-y-2">)/,
    '$1\n              <Link id="mobile_customer_portal_link" to="/customer" onClick={() => setMobileMenuOpen(false)} className="w-full block py-3 border border-brand-gold/50 bg-brand-gold/10 text-brand-gold font-extrabold rounded-xl text-center text-xs transition-all">\n                {customerLabel}\n              </Link>'
  );

  out = all(
    out,
    '<Route path="/customer" element={<Auth onAuthSuccess={() => navigate("/customer")} />} />',
    '<Route path="/customer" element={<CustomerDashboard />} />'
  );

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
