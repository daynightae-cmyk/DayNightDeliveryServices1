import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of read(file).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log("PASS:", message);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const vercel = read("vercel.json");
const seo = read("src/hooks/usePageSEO.ts");
const sitemap = read("public/sitemap.xml");
const index = read("index.html");

assert(vercel.includes('"headers"'), "Vercel security headers exist");
assert(vercel.includes('"redirects"'), "Canonical redirect config exists");
assert(vercel.includes('"outputDirectory": "dist"'), "Vercel output directory is dist");
assert(!sitemap.includes("www.daynightae.com"), "Sitemap canonical is apex domain");
assert(!index.includes("www.daynightae.com"), "Index canonical is apex domain");
assert(!seo.includes("31.50 AED") && !seo.includes("52.50 AED"), "SEO prices use unified public pricing");
assert(fs.existsSync("src/components/security/TurnstileCaptcha.tsx"), "Turnstile component exists");

if (process.env.DN_RUN_ORDER_TEST !== "1") {
  console.log("SKIP: Live Supabase order/tracking/admin test. Set DN_RUN_ORDER_TEST=1 to run it.");
  process.exit(process.exitCode || 0);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(Boolean(SUPABASE_URL), "VITE_SUPABASE_URL is present");
assert(Boolean(SUPABASE_ANON_KEY), "VITE_SUPABASE_ANON_KEY is present");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const timestamp = Date.now();
const testOrder = {
  sender_name: "DAY NIGHT PRODUCTION TEST",
  sender_phone: "+971 56 875 7331",
  sender_city: "أبوظبي",
  sender_address: "Production hardening test pickup address",
  receiver_name: "Production Test Receiver",
  receiver_phone: "+971 56 875 7331",
  receiver_city: "دبي",
  receiver_address: "Production hardening test delivery address",
  package_type: "Documents",
  weight: 1,
  pieces: 1,
  service_type: "standard",
  delivery_price: 30,
  subtotal: 30,
  total: 30,
  total_price: 30,
  amount: 30,
  price: 30,
  currency: "AED",
  payment_method: "sender_pays",
  cod_amount: null,
  notes: "[PRODUCTION HARDENING TEST] Safe test order created at " + new Date(timestamp).toISOString(),
  status: "Pending",
  source_domain: "daynightae.com",
  captcha_token: "production-gate-test"
};

const created = await supabase.rpc("create_public_order", { p_order_data: testOrder });
assert(!created.error, "create_public_order RPC succeeded");

const createdData = created.data;
const trackingCode =
  typeof createdData === "string"
    ? createdData
    : createdData?.tracking_code || createdData?.tracking_number || createdData?.id;

assert(Boolean(trackingCode), "Tracking code returned from create_public_order");

const tracked = await supabase.rpc("track_order", { p_tracking_code: trackingCode });
assert(!tracked.error, "track_order RPC succeeded");

const trackedOrder = Array.isArray(tracked.data) ? tracked.data[0] : tracked.data;
assert(Boolean(trackedOrder), "Created order can be tracked");

if (!SERVICE_ROLE_KEY) {
  console.log("SKIP: Admin update test. Add SUPABASE_SERVICE_ROLE_KEY locally to test admin_update_order_status.");
  process.exit(process.exitCode || 0);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const orderId = trackedOrder?.id || createdData?.id;

if (!orderId) {
  console.log("SKIP: Admin update test. Could not resolve order id.");
  process.exit(process.exitCode || 0);
}

const updated = await admin.rpc("admin_update_order_status", {
  p_order_id: orderId,
  p_status: "In Transit",
  p_note: "Production hardening gate status update test"
});

assert(!updated.error, "admin_update_order_status RPC succeeded");
console.log("DONE: Production hardening live gate passed.");
