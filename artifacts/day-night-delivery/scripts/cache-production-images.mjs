import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const outputDir = path.join(appRoot, "public", "assets", "brand");

const assets = [
  {
    name: "Official DAY NIGHT logo",
    fileName: "day-night-logo.png",
    url: "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png",
    minBytes: 2048
  },
  {
    name: "UAE live operations map",
    fileName: "uae-live-map.png",
    url: "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png",
    minBytes: 8192
  },
  {
    name: "Hero poster visual",
    fileName: "day-night-hero-poster.png",
    url: "https://i.postimg.cc/cJ7MbD6R/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(10).png",
    minBytes: 8192
  }
];

const strict = process.argv.includes("--strict");
const force = process.argv.includes("--force");

async function existsWithMinimumSize(filePath, minBytes) {
  if (force) return false;
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size >= minBytes;
  } catch {
    return false;
  }
}

async function cacheAsset(asset) {
  const targetPath = path.join(outputDir, asset.fileName);

  if (await existsWithMinimumSize(targetPath, asset.minBytes)) {
    console.log(`[assets] ${asset.fileName} already cached`);
    return;
  }

  console.log(`[assets] downloading ${asset.name}`);
  const response = await fetch(asset.url, {
    redirect: "follow",
    headers: {
      "user-agent": "DAY-NIGHT-production-asset-cache/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`${asset.name} download failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("image")) {
    throw new Error(`${asset.name} returned non-image content-type: ${contentType || "unknown"}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < asset.minBytes) {
    throw new Error(`${asset.name} downloaded file is too small: ${buffer.byteLength} bytes`);
  }

  await writeFile(targetPath, buffer);
  console.log(`[assets] cached ${asset.fileName} (${buffer.byteLength} bytes)`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const errors = [];

  for (const asset of assets) {
    try {
      await cacheAsset(asset);
    } catch (error) {
      errors.push(error);
      console.warn(`[assets] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length && strict) {
    console.error(`[assets] ${errors.length} production image(s) failed to cache`);
    process.exit(1);
  }
}

await main();
