import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("PASS:", message);
  }
}

const root = path.resolve(process.cwd());
const publicRoot = path.join(root, "public");
const srcRoot = path.join(root, "src");

console.log("\n--- DAY NIGHT PWA / Production Experience Gate ---");

const manifestPath = path.join(publicRoot, "manifest.webmanifest");
assert(fs.existsSync(manifestPath), "PWA manifest exists");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(read(manifestPath));
  assert(manifest.id === "/", "PWA manifest has a stable application id");
  assert(manifest.scope === "/", "PWA scope covers the application");
  assert(manifest.display === "standalone", "PWA launches in standalone mode");
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "PWA has regular and maskable icons");
  assert(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4, "PWA exposes operational shortcuts");
}

const serviceWorkerPath = path.join(publicRoot, "sw.js");
assert(fs.existsSync(serviceWorkerPath), "Production service worker exists");
if (fs.existsSync(serviceWorkerPath)) {
  const worker = read(serviceWorkerPath);
  assert(worker.includes("networkFirstNavigation"), "Service worker uses network-first navigation");
  assert(worker.includes("SKIP_WAITING"), "Service worker supports controlled updates");
  assert(worker.includes("__dn_deployment_check"), "Service worker bypasses live deployment checks");
  assert(worker.includes("url.origin !== self.location.origin"), "Service worker never caches cross-origin API data");
  assert(worker.includes("offline.html"), "Service worker provides a branded offline fallback");
}

const offlinePath = path.join(publicRoot, "offline.html");
assert(fs.existsSync(offlinePath), "Offline page exists");
if (fs.existsSync(offlinePath)) {
  const offline = read(offlinePath);
  assert(offline.includes("لا يوجد اتصال") && offline.includes("DAY NIGHT"), "Offline page is branded and bilingual-ready");
}

const indexPath = path.join(root, "index.html");
assert(fs.existsSync(indexPath), "Application index exists");
if (fs.existsSync(indexPath)) {
  const index = read(indexPath);
  assert(index.includes("viewport-fit=cover"), "Index supports iPhone safe areas");
  assert(index.includes("apple-mobile-web-app-capable"), "Index supports iOS Home Screen installation");
  assert(index.includes("apple-touch-icon"), "Index declares the official Apple touch icon");
  assert(index.includes('application/ld+json'), "Index includes structured organization data");
  assert(index.includes("manifest.webmanifest"), "Index links the production manifest");
}

const experiencePath = path.join(srcRoot, "components", "ProductionExperience.tsx");
assert(fs.existsSync(experiencePath), "Production experience component exists");
if (fs.existsSync(experiencePath)) {
  const experience = read(experiencePath);
  assert(experience.includes("beforeinstallprompt"), "Install prompt integration exists");
  assert(experience.includes("DAY_NIGHT_PWA_UPDATE_EVENT"), "Update notification integration exists");
  assert(experience.includes("WifiOff"), "Offline status UI exists");
  assert(experience.includes("Control+K") && experience.includes("Meta+K"), "Quick command center keyboard shortcut exists");
  assert(experience.includes("Add to Home Screen"), "iPhone installation guide exists");
}

const pwaRuntimePath = path.join(srcRoot, "lib", "pwaRuntime.ts");
assert(fs.existsSync(pwaRuntimePath), "PWA runtime exists");
if (fs.existsSync(pwaRuntimePath)) {
  const runtime = read(pwaRuntimePath);
  assert(runtime.includes('register("/sw.js"'), "PWA runtime registers the production service worker");
  assert(runtime.includes('updateViaCache: "none"'), "Service worker update checks bypass stale HTTP cache");
  assert(runtime.includes("isNativeCapacitor"), "PWA registration stays separate from native Capacitor builds");
}

const nativeRuntimePath = path.join(srcRoot, "lib", "nativeAndroidRuntime.ts");
if (fs.existsSync(nativeRuntimePath)) {
  const nativeRuntime = read(nativeRuntimePath);
  assert(nativeRuntime.includes('platform === "ios"'), "Native runtime supports iOS");
  assert(nativeRuntime.includes("dn-native-shell"), "Native runtime uses a cross-platform shell class");
  assert(nativeRuntime.includes("appUrlOpen"), "Native runtime supports deep-link entry");
}

const vitePath = path.join(root, "vite.config.ts");
if (fs.existsSync(vitePath)) {
  const vite = read(vitePath);
  assert(vite.includes("manualChunks"), "Vite production bundle uses vendor chunking");
  assert(vite.includes("vendor-supabase") && vite.includes("vendor-maps"), "Heavy operational vendors are isolated for caching");
}

const vercelPath = path.join(root, "vercel.json");
if (fs.existsSync(vercelPath)) {
  const vercel = read(vercelPath);
  assert(vercel.includes("Service-Worker-Allowed"), "Vercel allows root service-worker scope");
  assert(vercel.includes("max-age=31536000, immutable"), "Hashed assets receive immutable caching");
  assert(vercel.includes("https://maps.google.com"), "CSP permits the merchant map iframe");
  assert(vercel.includes("media-src") && vercel.includes("files.catbox.moe"), "CSP permits approved operational audio");
}

const robotsPath = path.join(publicRoot, "robots.txt");
if (fs.existsSync(robotsPath)) {
  const robots = read(robotsPath);
  assert(robots.includes("Disallow: /merchant"), "Merchant portal is excluded from search indexing");
}

const securityScan = [manifestPath, serviceWorkerPath, experiencePath, pwaRuntimePath]
  .filter((file) => fs.existsSync(file))
  .map(read)
  .join("\n");
assert(!securityScan.includes("sb_secret_") && !securityScan.includes("service_role"), "No privileged Supabase key appears in the production experience layer");

if (process.exitCode === 1) {
  console.error("PWA / production experience checks FAILED.");
} else {
  console.log("All PWA / production experience checks PASSED.");
}
