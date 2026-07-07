import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const force = process.argv.includes("--force");

const assets = [
  { name: "logo", url: "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png", output: "public/assets/daynight/logo.png", minBytes: 2048 },
  { name: "hero", url: "https://i.postimg.cc/cJ7MbD6R/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(10).png", output: "public/assets/daynight/hero-uae-delivery.png", minBytes: 8192 },
  { name: "uae-map", url: "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png", output: "public/assets/daynight/uae-live-map.png", minBytes: 8192 },
  { name: "admin-auth-intro-gateway", url: "https://i.postimg.cc/657vswy0/Chat-GPT-Image-Jul-6-2026-05-50-16-PM-(10).png", output: "public/assets/daynight/admin-auth-v3/intro-gateway.png", minBytes: 8192 },
  { name: "admin-auth-login-reference", url: "https://i.postimg.cc/PqyTxpCT/tany-shashh.png", output: "public/assets/daynight/admin-auth-v3/login-reference.png", minBytes: 8192 },
  { name: "admin-auth-loading-command-center", url: "https://i.postimg.cc/xjpzFqTC/Chat-GPT-Image-Jul-6-2026-05-50-13-PM-(4).png", output: "public/assets/daynight/admin-auth-v3/loading-command-center.png", minBytes: 8192 },
  { name: "admin-auth-logo-glass", url: "https://i.postimg.cc/7hdxkFff/allwjw.png", output: "public/assets/daynight/admin-auth-v3/logo-glass.png", minBytes: 8192 },
  { name: "admin-dashboard-reference", url: "https://i.postimg.cc/jdW7VKLP/Chat-GPT-Image-Jul-6-2026-05-50-15-PM-(8).png", output: "public/assets/daynight/admin-auth-v3/admin-dashboard-reference.png", minBytes: 8192 },
  { name: "admin-khalifa-card-reference", url: "https://i.postimg.cc/pVcF1yXm/Chat-GPT-Image-Jul-6-2026-05-50-14-PM-(5).png", output: "public/assets/daynight/admin-auth-v3/khalifa-card-reference.png", minBytes: 8192 },
  { name: "admin-map", url: "https://i.postimg.cc/vH1VRMcr/Chat-GPT-Image-Jul-6-2026-05-50-16-PM-(9).png", output: "public/assets/daynight/admin-auth-v3/admin-map.png", minBytes: 8192 },
  { name: "admin-auth-extra-login-reference", url: "https://i.postimg.cc/FKQM6Xr4/Chat-GPT-Image-Jul-6-2026-02-01-26-AM-(2).png", output: "public/assets/daynight/admin-auth-v3/login-extra-reference.png", minBytes: 8192 },
];

async function downloadAsset(asset) {
  const outputPath = resolve(root, asset.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  if (!force && existsSync(outputPath) && statSync(outputPath).size >= asset.minBytes) {
    console.log(`[assets] ${asset.name} already installed: ${asset.output}`);
    return;
  }
  console.log(`[assets] installing ${asset.name} from ${asset.url}`);
  const response = await fetch(asset.url, { redirect: "follow", headers: { "user-agent": "DAY-NIGHT-DELIVERY-ASSET-INSTALLER/1.2", accept: "image/png,image/*;q=0.8,*/*;q=0.5" } });
  if (!response.ok || !response.body) throw new Error(`Failed to download ${asset.name}: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("image")) throw new Error(`Failed to download ${asset.name}: non-image content type ${contentType || "unknown"}`);
  await pipeline(response.body, createWriteStream(outputPath));
  const size = statSync(outputPath).size;
  if (size < asset.minBytes) throw new Error(`Downloaded ${asset.name} is too small (${size} bytes)`);
  console.log(`[assets] installed ${asset.name}: ${asset.output} (${Math.round(size / 1024)} KB)`);
}
const failures = [];
for (const asset of assets) {
  try {
    await downloadAsset(asset);
  } catch (error) {
    const optional = asset.output.includes("/admin-auth-v3/");
    if (!optional) failures.push(asset.name);
    console.warn(`[assets] ${asset.name} was not installed. Runtime remote fallback remains available.`);
    console.warn(error instanceof Error ? error.message : error);
  }
}
if (strict && failures.length) {
  console.error(`[assets] strict mode failed for: ${failures.join(", ")}`);
  process.exit(1);
}
