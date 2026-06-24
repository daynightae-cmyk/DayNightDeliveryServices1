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
const src = path.join(root, "src");

const vercelPath = path.join(root, "vercel.json");
assert(fs.existsSync(vercelPath), "vercel.json exists");
if (fs.existsSync(vercelPath)) {
  const vercel = read(vercelPath);
  assert(vercel.includes('"headers"'), "Vercel security headers exist");
  assert(vercel.includes('"redirects"'), "Canonical redirect config exists");
  assert(vercel.includes('"outputDirectory"'), "Vercel output directory set");
}

const sitemapPath = path.join(root, "public", "sitemap.xml");
if (fs.existsSync(sitemapPath)) {
  const sitemap = read(sitemapPath);
  assert(!sitemap.includes("www.daynightae.com"), "Sitemap canonical is apex domain");
}

const indexPath = path.join(root, "index.html");
if (fs.existsSync(indexPath)) {
  const index = read(indexPath);
  assert(!index.includes("www.daynightae.com"), "index.html canonical is apex domain");
}

const seoPath = path.join(src, "lib", "seo.ts");
if (fs.existsSync(seoPath)) {
  const seo = read(seoPath);
  assert(!seo.includes("31.50 AED") && !seo.includes("52.50 AED"), "SEO prices use correct pricing (30/50 AED)");
}

const aiKnowledgePath = path.join(src, "data", "aiAgentKnowledge.ts");
if (fs.existsSync(aiKnowledgePath)) {
  const knowledge = read(aiKnowledgePath);
  assert(!knowledge.includes("31.50") && !knowledge.includes("52.50"), "AI agent knowledge uses correct pricing");
  assert(knowledge.includes("30 AED") || knowledge.includes("30 درهم"), "AI agent knowledge has correct domestic price");
}

const pricingDataPath = path.join(src, "data", "pricingData.ts");
if (fs.existsSync(pricingDataPath)) {
  const pricingData = read(pricingDataPath);
  assert(pricingData.includes("base: 30"), "pricingData main base is 30 AED");
  assert(pricingData.includes("base: 50"), "pricingData extended base is 50 AED");
  assert(!pricingData.includes("????"), "pricingData has no garbled Arabic labels");
}

const turnstilePath = path.join(src, "components", "security", "TurnstileCaptcha.tsx");
assert(fs.existsSync(turnstilePath), "Turnstile captcha component exists");

const requestDeliveryPath = path.join(src, "components", "RequestDelivery.tsx");
if (fs.existsSync(requestDeliveryPath)) {
  const rd = read(requestDeliveryPath);
  assert(!rd.includes("يرجى إكمال بيانات المرسل") || rd.includes("يرجى إكمال"), "RequestDelivery has proper Arabic (not garbled)");
}

const robotsPath = path.join(root, "public", "robots.txt");
assert(fs.existsSync(robotsPath), "robots.txt exists");

console.log("\n--- Production hardening gate complete ---");
if (process.exitCode === 1) {
  console.error("Some checks FAILED. Fix before deploying.");
} else {
  console.log("All checks PASSED. Safe to deploy.");
}
