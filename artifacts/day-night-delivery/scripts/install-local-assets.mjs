import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const root = resolve(new URL("..", import.meta.url).pathname);

const assets = [
  {
    name: "logo",
    url: "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png",
    output: "public/assets/daynight/logo.png",
  },
  {
    name: "hero",
    url: "https://i.postimg.cc/cJ7MbD6R/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(10).png",
    output: "public/assets/daynight/hero-uae-delivery.png",
  },
  {
    name: "uae-map",
    url: "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png",
    output: "public/assets/daynight/uae-live-map.png",
  },
];

async function downloadAsset(asset) {
  const outputPath = resolve(root, asset.output);
  mkdirSync(dirname(outputPath), { recursive: true });

  if (existsSync(outputPath) && statSync(outputPath).size > 1024) {
    console.log(`[assets] ${asset.name} already installed: ${asset.output}`);
    return;
  }

  console.log(`[assets] installing ${asset.name} from ${asset.url}`);
  const response = await fetch(asset.url, {
    headers: {
      "user-agent": "DAY-NIGHT-DELIVERY-ASSET-INSTALLER/1.0",
      accept: "image/png,image/*;q=0.8,*/*;q=0.5",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${asset.name}: HTTP ${response.status}`);
  }

  await pipeline(response.body, createWriteStream(outputPath));
  const size = statSync(outputPath).size;
  if (size < 1024) throw new Error(`Downloaded ${asset.name} is too small (${size} bytes)`);
  console.log(`[assets] installed ${asset.name}: ${asset.output} (${Math.round(size / 1024)} KB)`);
}

for (const asset of assets) {
  try {
    await downloadAsset(asset);
  } catch (error) {
    console.warn(`[assets] ${asset.name} was not installed. Runtime remote fallback remains available.`);
    console.warn(error instanceof Error ? error.message : error);
  }
}
