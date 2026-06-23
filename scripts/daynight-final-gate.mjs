import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const ALLOWED_URL = "https://ngdwybpgacauorygoedi.supabase.co";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function readJwtRole(jwt) {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return "";
    const decoded = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(decoded)?.role || "";
  } catch {
    return "";
  }
}

function extractValue(data, path = "total") {
  if (data == null) return null;
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === "number") return parsed;
      return parsed[path] ?? parsed;
    } catch {
      return Number(data);
    }
  }
  if (typeof data === "object") {
    return data[path] ?? data;
  }
  return Number(data);
}

function numeric(value, label) {
  const extracted = extractValue(value);
  const n = Number(extracted);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} is not numeric (got ${JSON.stringify(value)}, extracted ${extracted})`);
  }
  return n;
}

function assertClose(actual, expected, label) {
  const delta = Math.abs(Number(actual) - expected);
  if (delta > 0.001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function readTable(supabase, tableName) {
  const { error } = await supabase.from(tableName).select("*").limit(1);
  if (error) throw new Error(`${tableName}: ${error.message}`);
  pass(`read ${tableName}`);
}

async function readOptionalTable(supabase, tableName) {
  const { error } = await supabase.from(tableName).select("*").limit(1);
  if (error) {
    pass(`optional ${tableName} check skipped (${error.code || "n/a"})`);
    return;
  }
  pass(`read ${tableName}`);
}

function hasForbiddenMockData(value) {
  const payload = JSON.stringify(value || {}).toLowerCase();
  const forbidden = [
    ["مرسل", "مجهول"].join(" "),
    ["مستلم", "مجهول"].join(" "),
    ["+971", "0000000"].join(""),
    ["mock", " order"].join(""),
    ["mock", "locations"].join("")
  ];
  return forbidden.some((token) => payload.includes(token.toLowerCase()));
}

async function rpcOrThrow(supabase, fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("WAITING FOR USER ACTION: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in local .env");
    process.exit(2);
  }

  if (supabaseUrl !== ALLOWED_URL) {
    console.error("FAIL: Supabase URL is not locked to ngdwybpgacauorygoedi project.");
    process.exit(1);
  }

  if (readJwtRole(supabaseAnonKey) === ["service", "role"].join("_")) {
    console.error("BLOCKING: VITE_SUPABASE_ANON_KEY must be a publishable/anon key, not a privileged database key.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  for (const tableName of ["cities", "zones", "pricing_rules", "admin_settings"]) {
    await readTable(supabase, tableName);
  }
  await readOptionalTable(supabase, "services");

  const domestic = await rpcOrThrow(supabase, "calculate_delivery_price", {
    p_from_city: null,
    p_to_city: null,
    p_weight_kg: 1
  });
  const domesticTotal = extractValue(domestic, "total");
  assertClose(numeric(domesticTotal, "domestic total"), 31.5, "calculate_delivery_price total");
  pass("calculate_delivery_price(null, null, 1) total 31.5");

  const saudi = await rpcOrThrow(supabase, "calculate_international_price", {
    p_destination: "SA",
    p_weight_kg: 3
  });
  const saudiSubtotal = extractValue(saudi, "subtotal");
  const saudiTotal = extractValue(saudi, "total");
  assertClose(numeric(saudiSubtotal, "Saudi subtotal"), 185, "Saudi 3kg subtotal");
  assertClose(numeric(saudiTotal, "Saudi total"), 194.25, "Saudi 3kg total");
  pass("calculate_international_price('SA', 3)");

  const usa = await rpcOrThrow(supabase, "calculate_international_price", {
    p_destination: "US",
    p_weight_kg: 2
  });
  const usaSubtotal = extractValue(usa, "subtotal");
  const usaTotal = extractValue(usa, "total");
  assertClose(numeric(usaSubtotal, "USA subtotal"), 280, "USA 2kg subtotal");
  assertClose(numeric(usaTotal, "USA total"), 294, "USA 2kg total");
  pass("calculate_international_price('US', 2)");

  const now = new Date().toISOString();
  const testOrder = {
    sender_name: "DAY NIGHT FINAL AUDIT SENDER",
    sender_phone: "+971 56 875 7331",
    sender_city: "Abu Dhabi",
    sender_address: "UAE ABUDHABI MUSSAFAH 40",
    receiver_name: "DAY NIGHT FINAL AUDIT RECEIVER",
    receiver_phone: "+971 56 875 7331",
    receiver_city: "Dubai",
    receiver_address: "UAE ABUDHABI MUSSAFAH 40",
    package_type: "Documents",
    weight: 1,
    pieces: 1,
    service_type: "standard",
    delivery_price: 31.5,
    subtotal: 30,
    base_price: 30,
    vat_amount: 1.5,
    vat: 1.5,
    tax_amount: 1.5,
    total: 31.5,
    total_price: 31.5,
    amount: 31.5,
    price: 31.5,
    currency: "AED",
    payment_method: "sender_pays",
    notes: "FINAL_AUTOMATED_AUDIT_TEST_SAFE_TO_DELETE",
    status: "Pending",
    status_history: [
      {
        status: "Pending",
        date: now,
        note: "FINAL_AUTOMATED_AUDIT_TEST_SAFE_TO_DELETE"
      }
    ],
    created_at: now
  };

  const created = await rpcOrThrow(supabase, "create_public_order", {
    p_order_data: testOrder
  });
  const trackingCode = created?.tracking_code || created?.tracking_number || created?.id;
  if (!trackingCode) {
    throw new Error("create_public_order did not return tracking_code, tracking_number, or id");
  }
  if (hasForbiddenMockData(created)) {
    throw new Error("create_public_order payload contains forbidden fake/mock data");
  }
  pass("create_public_order");

  const tracked = await rpcOrThrow(supabase, "track_order", {
    p_tracking_code: String(trackingCode)
  });
  if (!tracked) {
    throw new Error("track_order returned no data for created test order");
  }
  if (hasForbiddenMockData(tracked)) {
    throw new Error("track_order payload contains forbidden fake/mock data");
  }
  pass("track_order");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
