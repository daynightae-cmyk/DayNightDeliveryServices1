import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const publicRoot = path.join(root, "public", "assets", "international-tracking");

const assets = [
  [1, "aircraft/daynight-aircraft-long-side-profile.jpg", "https://i.postimg.cc/05tJN1Hh/1.jpg"],
  [2, "aircraft/daynight-aircraft-side-transparent.png", "https://i.postimg.cc/7YdGgM4M/2.png"],
  [3, "aircraft/daynight-aircraft-three-quarter-front.png", "https://i.postimg.cc/fTptxjs7/3.png"],
  [4, "aircraft/daynight-aircraft-flight-side.png", "https://i.postimg.cc/bNWDQHP1/4.png"],
  [5, "map/daynight-map-assets-master-sheet.png", "https://i.postimg.cc/9FKRGt2G/5.png"],
  [6, "aircraft/daynight-aircraft-front-transparent.png", "https://i.postimg.cc/MG8nL6vk/6.png"],
  [7, "references/daynight-desktop-master-layout-a.png", "https://i.postimg.cc/7ZzCXGYk/7.png"],
  [8, "ui-panels/daynight-route-stats-grid.png", "https://i.postimg.cc/d0KhfsLv/8.png"],
  [9, "ui-panels/daynight-events-cargo-details-panel.png", "https://i.postimg.cc/7Ly5RHbp/9.png"],
  [10, "references/daynight-desktop-master-layout-b.png", "https://i.postimg.cc/TPXKsdpy/10.png"],
  [11, "ui-panels/daynight-route-progress-wide-a.png", "https://i.postimg.cc/PqkC7XP8/11.png"],
  [12, "references/daynight-live-map-primary-reference.png", "https://i.postimg.cc/cJMvypnt/12.png"],
  [13, "references/daynight-topbar-reference-a.png", "https://i.postimg.cc/0NdzRTwz/13.png"],
  [14, "ui-panels/daynight-cargo-details-grid-primary.png", "https://i.postimg.cc/q7XNVP3s/14.png"],
  [16, "ui-panels/daynight-shipment-summary-documents-card.png", "https://i.postimg.cc/N07Kq3Hd/16.png"],
  [17, "references/daynight-global-network-map-reference.png", "https://i.postimg.cc/hjDfS28g/17.png"],
  [18, "references/daynight-desktop-operations-layout.png", "https://i.postimg.cc/yd1kVLhs/18.png"],
  [19, "references/daynight-map-first-live-dashboard.png", "https://i.postimg.cc/4dWnnpwG/19.png"],
  [20, "ui-panels/daynight-shipment-overview-vertical-card.png", "https://i.postimg.cc/85ZssLwP/20.png"],
  [21, "ui-panels/daynight-selected-shipment-card-primary.png", "https://i.postimg.cc/0jrjSrHK/21.png"],
  [22, "ui-panels/daynight-compact-shipment-list.png", "https://i.postimg.cc/Zn0nN0DV/22.png"],
  [23, "ui-panels/daynight-shipment-timeline-primary.png", "https://i.postimg.cc/T1h1bhHt/23.png"],
  [24, "ui-panels/daynight-tracking-list-desktop-primary.png", "https://i.postimg.cc/j2C2fCkk/24.png"],
  [25, "ui-panels/daynight-tracking-list-narrow.png", "https://i.postimg.cc/fyFLfZ6C/25.png"],
  [26, "ui-panels/daynight-shipment-lifecycle-timeline.png", "https://i.postimg.cc/2yJ67msp/26.png"],
  [27, "references/daynight-mobile-tracking-dashboard-a.png", "https://i.postimg.cc/vTjBtMJd/27.png"],
  [28, "references/daynight-mobile-tracking-dashboard-b.png", "https://i.postimg.cc/90SMYV6W/28.png"],
  [29, "references/daynight-international-tracking-analytics.png", "https://i.postimg.cc/1RYfQcf6/29.png"],
  [30, "ui-panels/daynight-route-progress-component-primary.png", "https://i.postimg.cc/2jXVDFV7/30.png"],
  [31, "references/daynight-cinematic-shipment-hero.png", "https://i.postimg.cc/h43fBbfr/31.png"],
  [32, "references/daynight-topbar-reference-primary.png", "https://i.postimg.cc/9XNrhtrb/32.png"],
  [33, "branding/daynight-official-master-logo.png", "https://i.postimg.cc/QNnH3kHz/33.png"],
];

async function download(url, destination) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "DAY-NIGHT-Asset-Ingestion/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100) throw new Error(`Asset too small (${bytes.length} bytes): ${url}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
  return bytes.length;
}

const result = [];
for (const [id, relativePath, sourceUrl] of assets) {
  const destination = path.join(publicRoot, relativePath);
  const bytes = await download(sourceUrl, destination);
  result.push({ id, relativePath, sourceUrl, bytes });
  process.stdout.write(`Downloaded asset ${id}: ${relativePath} (${bytes} bytes)\n`);
}

await fs.writeFile(
  path.join(publicRoot, "asset-download-report.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), asset15: null, assets: result }, null, 2)}\n`,
);

console.log(`Downloaded ${result.length} strict international tracking assets.`);
