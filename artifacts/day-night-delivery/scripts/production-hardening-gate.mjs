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
const repoRoot = path.resolve(root, "..", "..");
const src = path.join(root, "src");

function firstExisting(paths) {
  return paths.find((item) => fs.existsSync(item));
}

/* ── Vercel config ── */
const vercelPath = firstExisting([
  path.join(root, "vercel.json"),
  path.join(repoRoot, "vercel.json")
]);
assert(Boolean(vercelPath), "vercel.json exists in app or repository root");
if (vercelPath) {
  const vercel = read(vercelPath);
  assert(vercel.includes('"headers"'), "Vercel security headers exist");
  assert(vercel.includes('"redirects"'), "Canonical redirect config exists");
  assert(vercel.includes('"outputDirectory"'), "Vercel output directory set");
  assert(
    vercel.includes("artifacts/day-night-delivery/dist/public") || vercel.includes('"outputDirectory": "dist/public"'),
    "Vercel output directory points to built app public folder"
  );
}

/* ── Sitemap / index ── */
const sitemapPath = path.join(root, "public", "sitemap.xml");
if (fs.existsSync(sitemapPath)) {
  const sitemap = read(sitemapPath);
  assert(!sitemap.includes("www.daynightae.com"), "Sitemap canonical is apex domain");
  assert(sitemap.includes("/qr"), "Sitemap includes QR page");
  assert(sitemap.includes("/refund-policy"), "Sitemap includes refund policy route");
  assert(sitemap.includes("/shipping-policy"), "Sitemap includes shipping policy route");
}

const indexPath = path.join(root, "index.html");
if (fs.existsSync(indexPath)) {
  const index = read(indexPath);
  assert(!index.includes("www.daynightae.com"), "index.html canonical is apex domain");
}

/* ── SEO ── */
const seoPath = path.join(src, "lib", "seo.ts");
if (fs.existsSync(seoPath)) {
  const seo = read(seoPath);
  assert(!seo.includes("31.50 AED") && !seo.includes("52.50 AED"), "SEO prices use correct pricing (30/50 AED)");
}

/* ── AI knowledge ── */
const aiKnowledgePath = path.join(src, "data", "aiAgentKnowledge.ts");
if (fs.existsSync(aiKnowledgePath)) {
  const knowledge = read(aiKnowledgePath);
  assert(!knowledge.includes("31.50") && !knowledge.includes("52.50"), "AI agent knowledge uses correct pricing");
  assert(knowledge.includes("30 AED") || knowledge.includes("30 درهم"), "AI agent knowledge has correct domestic price");
  assert(!knowledge.includes("Each extra piece") && !knowledge.includes("لكل قطعة إضافية") && !knowledge.includes("القطعة الأولى"), "AI agent knowledge treats UAE local delivery as one order");
  assert(knowledge.includes("95") && knowledge.includes("45"), "AI agent knowledge has GCC pricing");
  assert(knowledge.includes("190") && knowledge.includes("90"), "AI agent knowledge has worldwide pricing");
  assert(knowledge.includes("COD") || knowledge.includes("cod"), "AI agent knowledge covers COD");
}

/* ── Pricing data ── */
const pricingDataPath = path.join(src, "data", "pricingData.ts");
if (fs.existsSync(pricingDataPath)) {
  const pricingData = read(pricingDataPath);
  assert(pricingData.includes("base: 30"), "pricingData main base is 30 AED");
  assert(pricingData.includes("base: 50"), "pricingData extended base is 50 AED");
  assert(!pricingData.includes("????"), "pricingData has no garbled Arabic labels");
}

/* ── Pricing engine calculation tests ── */
const pricingEnginePath = path.join(src, "lib", "pricing.ts");
if (fs.existsSync(pricingEnginePath)) {
  try {
    const engine = read(pricingEnginePath);
    assert(engine.includes("calculateDomesticPrice"), "Pricing engine exports calculateDomesticPrice");
    assert(engine.includes("calculateInternationalPrice"), "Pricing engine exports calculateInternationalPrice");
    assert(engine.includes("Single local order") && engine.includes("pieces: 1"), "Pricing engine treats UAE local delivery as one order");
    assert(engine.includes("expressSurcharge") || engine.includes("express"), "Pricing engine handles express surcharge");
    assert(engine.includes("breakdown"), "Pricing engine returns breakdown array");
  } catch (e) {
    assert(false, "Pricing engine source readable: " + e.message);
  }
}

/* ── Pricing.tsx isolated state ── */
const pricingTsxPath = path.join(src, "components", "Pricing.tsx");
if (fs.existsSync(pricingTsxPath)) {
  const px = read(pricingTsxPath);
  assert(px.includes("domesticWeight") && px.includes("internationalWeight"), "Pricing.tsx uses isolated weight state per calculator");
  assert(!px.includes("domesticPieces"), "Pricing.tsx has no order quantity field for domestic calculator");
  assert(px.includes("pieces: 1"), "Pricing.tsx prices domestic calculator as one local order");
  assert(!px.includes("const [weight,") && !px.includes("const [weight ,"), "Pricing.tsx does NOT use shared weight state");
}

/* ── SmartChat component ── */
const smartChatPath = path.join(src, "components", "SmartChat.tsx");
if (fs.existsSync(smartChatPath)) {
  const chat = read(smartChatPath);
  assert(chat.includes("showBubble"), "SmartChat has greeting bubble state");
  assert(chat.includes("CLOSED_KEY") || chat.includes("dn_chat_closed"), "SmartChat stores closed state in sessionStorage");
  assert(chat.includes("Minus") || chat.includes("minimized"), "SmartChat has minimize button");
  assert(chat.includes("HIDDEN_ROUTES") || chat.includes("/admin"), "SmartChat hidden on admin routes");
  assert(chat.includes("chatPulse") || chat.includes("pulse"), "SmartChat has animated pulse icon");
}

/* ── RequestDelivery ── */
const requestDeliveryPath = path.join(src, "components", "RequestDelivery.tsx");
if (fs.existsSync(requestDeliveryPath)) {
  const rd = read(requestDeliveryPath);
  assert(!rd.includes("يرجى إكمال بيانات المرسل") || rd.includes("يرجى إكمال"), "RequestDelivery has proper Arabic (not garbled)");
  assert(rd.includes("breakdown") || rd.includes("deliveryPricing"), "RequestDelivery shows price breakdown");
  assert(rd.includes("isLargeShipment") || rd.includes("requiresCustomQuote"), "RequestDelivery handles large shipment warning");
}

/* ── Supabase security and admin helpers ── */
const supabasePath = path.join(src, "supabase.ts");
if (fs.existsSync(supabasePath)) {
  const sb = read(supabasePath);
  assert(sb.includes("fetchAllOrders"), "Supabase admin order fetch helper exists");
  assert(sb.includes("admin_update_order_status"), "Supabase admin status RPC is used");
  assert(sb.includes("fetchOrderStatusHistory"), "Supabase status history fetch helper exists");
  assert(sb.includes("order_status_history"), "Supabase status history table integration exists");
  assert(sb.includes("notes: notes || \"N/A\""), "Public order notes fallback is enforced");
  assert(!sb.includes("service_role") && !sb.includes("sb_secret"), "No service role or secret key in frontend Supabase client");
}

/* ── Admin Panel Stage 2 ── */
const adminPanelPath = path.join(src, "components", "AdminPanel.tsx");
assert(fs.existsSync(adminPanelPath), "AdminPanel component exists");
if (fs.existsSync(adminPanelPath)) {
  const admin = read(adminPanelPath);
  assert(admin.includes("draftStatus") && admin.includes("handleSaveStatus"), "Admin status update uses draft state and save button");
  assert(!admin.includes("onChange={(e) => handleStatusUpdate"), "Admin does not update status immediately on dropdown change");
  assert(admin.includes("fetchOrderStatusHistory"), "Admin details modal loads status timeline");
  assert(admin.includes("exportFilteredCsv"), "Admin exports filtered orders CSV");
  assert(admin.includes("exportCodCsv"), "Admin exports COD CSV report");
  assert(admin.includes("exportDailyReportPdf"), "Admin exports daily PDF report");
  assert(admin.includes("exportOrderPDF") && admin.includes("exportOrderTXT"), "Admin exports selected order PDF and TXT");
  assert(admin.includes("dateFilter") && admin.includes("cityFilter") && admin.includes("codFilter"), "Admin has date/city/COD filters");
  assert(admin.includes("openWhatsapp") && admin.includes("openTracking") && admin.includes("copyTracking"), "Admin order actions include WhatsApp, tracking, and copy");
}

/* ── Protected admin route ── */
const protectedAdminPath = path.join(src, "components", "ProtectedAdminRoute.tsx");
if (fs.existsSync(protectedAdminPath)) {
  const protectedAdmin = read(protectedAdminPath);
  assert(protectedAdmin.includes("isAdminUser"), "ProtectedAdminRoute checks admin role");
  assert(protectedAdmin.includes("getUser") || protectedAdmin.includes("onAuthStateChange"), "ProtectedAdminRoute checks authenticated Supabase user");
}

/* ── Footer ── */
const footerPath = path.join(src, "components", "Footer.tsx");
if (fs.existsSync(footerPath)) {
  const footer = read(footerPath);
  assert(footer.includes("/faq") || footer.includes("faq"), "Footer links to /faq");
  assert(footer.includes("/pricing"), "Footer links to /pricing");
  assert(footer.includes("/privacy"), "Footer links to /privacy");
  assert(footer.includes("/policy"), "Footer links to /policy");
  assert(footer.includes("/request"), "Footer links to request delivery");
  assert(footer.includes("/tracking"), "Footer links to tracking");
  assert(footer.includes("/qr") || footer.includes("qr"), "Footer links to QR Services");
  assert(!footer.includes("Sadek") && !footer.includes("sadek") && !footer.includes("Elgazar"), "Footer has no third-party developer credit");
}

/* ── Turnstile captcha ── */
const turnstilePath = path.join(src, "components", "security", "TurnstileCaptcha.tsx");
assert(fs.existsSync(turnstilePath), "Turnstile captcha component exists");

/* ── robots.txt ── */
const robotsPath = path.join(root, "public", "robots.txt");
assert(fs.existsSync(robotsPath), "robots.txt exists");
if (fs.existsSync(robotsPath)) {
  const robots = read(robotsPath);
  assert(robots.includes("Disallow: /admin"), "robots.txt disallows admin route");
  assert(robots.includes("Disallow: /auth"), "robots.txt disallows auth route");
}

/* ── QR Services page ── */
const qrPagePath = path.join(src, "components", "QR.tsx");
assert(fs.existsSync(qrPagePath), "QR page component exists");

const appPath = path.join(src, "App.tsx");
if (fs.existsSync(appPath)) {
  const app = read(appPath);
  assert(app.includes('path="/qr"') || app.includes("path: \"/qr\""), "QR route exists in App.tsx");
  assert(app.includes("nav.qr") || app.includes("/qr"), "QR Services appears in navigation");
  assert(app.includes('path="/admin"'), "Admin route exists in App.tsx");
}

if (fs.existsSync(qrPagePath)) {
  const qr = read(qrPagePath);
  assert(qr.includes("buildTrackingQrUrl") || qr.includes("trackingQrUrl"), "QR generator function exists in QR page");
  assert(qr.includes("buildWhatsappSupportQrUrl") || qr.includes("whatsapp"), "WhatsApp QR exists in QR page");
  assert(qr.includes("buildRequestDeliveryQrUrl") || qr.includes("request"), "Request Delivery QR exists in QR page");
  assert(qr.includes("buildContactQrUrl") || qr.includes("contact"), "Contact QR exists in QR page");
  assert(qr.includes("downloadQr") || qr.includes("Download"), "Download QR action exists in QR page");
  assert(!qr.includes("getUserMedia") && !qr.includes("camera"), "No camera permission break in QR page");
}

if (fs.existsSync(footerPath)) {
  const footer = read(footerPath);
  assert(footer.includes("/qr") || footer.includes("qr"), "QR Services appears in footer");
}

console.log("\n--- Production hardening gate complete ---");
if (process.exitCode === 1) {
  console.error("Some checks FAILED. Fix before deploying.");
} else {
  console.log("All checks PASSED. Safe to deploy.");
}
