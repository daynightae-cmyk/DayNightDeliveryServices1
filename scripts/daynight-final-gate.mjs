import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import ws from "ws";
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

function extractTotal(value) {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return extractTotal(parsed);
    } catch {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
  }

  if (typeof value === "object") {
    const possible =
      value.total ??
      value.total_amount ??
      value.amount ??
      value.price ??
      value.delivery_price ??
      value.result;

    if (possible !== undefined && possible !== null) {
      return extractTotal(possible);
    }
  }

  return null;
}

function nearlyEqual(a, b, tolerance = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function numeric(value, label) {
  const extracted = extractTotal(value);
  if (extracted == null) {
    throw new Error(`${label} is not numeric (extracted null from ${JSON.stringify(value)})`);
  }
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
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws }
  });

  for (const tableName of ["cities", "zones", "pricing_rules", "admin_settings"]) {
    await readTable(supabase, tableName);
  }
  await readOptionalTable(supabase, "services");

  // Test RPC: calculate_delivery_price
  let domestic, domesticError;
  try {
    const result = await supabase.rpc("calculate_delivery_price", {
      p_pickup_city_id: null,
      p_delivery_city_id: null,
      p_weight_kg: 1
    });
    domestic = result.data;
    domesticError = result.error?.message || null;
  } catch (e) {
    domesticError = e.message;
  }

  const domesticTotal = extractTotal(domestic);
  if (!nearlyEqual(domesticTotal, 30)) {
    console.log(`DEBUG: domestic_data_type: ${typeof domestic}`);
    console.log(`DEBUG: domestic_data: ${JSON.stringify(domestic)}`);
    if (domesticError) console.log(`DEBUG: domestic_error_message: ${domesticError}`);
    throw new Error(`calculate_delivery_price total: expected 30 AED (clean price), got ${domesticTotal}`);
  }
  pass("calculate_delivery_price(null, null, 1) = 30 AED");

  // Test RPC: calculate_international_price SA (GCC: 95 + 45*2 = 185)
  let sa, saError;
  try {
    const result = await supabase.rpc("calculate_international_price", {
      p_destination: "SA",
      p_weight_kg: 3
    });
    sa = result.data;
    saError = result.error?.message || null;
  } catch (e) {
    saError = e.message;
  }

  const saTotal = extractTotal(sa);
  if (!nearlyEqual(saTotal, 185)) {
    console.log(`DEBUG: sa_data_type: ${typeof sa}`);
    console.log(`DEBUG: sa_data: ${JSON.stringify(sa)}`);
    if (saError) console.log(`DEBUG: sa_error_message: ${saError}`);
    throw new Error(`calculate_international_price('SA', 3): expected 185 AED (95+45*2), got ${saTotal}`);
  }
  pass("calculate_international_price('SA', 3) = 185 AED");

  // Test RPC: calculate_international_price US (Worldwide: 190 + 90*1 = 280)
  let us, usError;
  try {
    const result = await supabase.rpc("calculate_international_price", {
      p_destination: "US",
      p_weight_kg: 2
    });
    us = result.data;
    usError = result.error?.message || null;
  } catch (e) {
    usError = e.message;
  }

  const usTotal = extractTotal(us);
  if (!nearlyEqual(usTotal, 280)) {
    console.log(`DEBUG: us_data_type: ${typeof us}`);
    console.log(`DEBUG: us_data: ${JSON.stringify(us)}`);
    if (usError) console.log(`DEBUG: us_error_message: ${usError}`);
    throw new Error(`calculate_international_price('US', 2): expected 280 AED (190+90), got ${usTotal}`);
  }
  pass("calculate_international_price('US', 2) = 280 AED");

  // Test RPC: calculate_international_price EUROPE (Worldwide: 190 + 90*1 = 280)
  let europe, europeError;
  try {
    const result = await supabase.rpc("calculate_international_price", {
      p_destination: "EUROPE",
      p_weight_kg: 2
    });
    europe = result.data;
    europeError = result.error?.message || null;
  } catch (e) {
    europeError = e.message;
  }

  const europeTotal = extractTotal(europe);
  if (!nearlyEqual(europeTotal, 280)) {
    console.log(`DEBUG: europe_data_type: ${typeof europe}`);
    console.log(`DEBUG: europe_data: ${JSON.stringify(europe)}`);
    if (europeError) console.log(`DEBUG: europe_error_message: ${europeError}`);
    throw new Error(`calculate_international_price('EUROPE', 2): expected 280 AED (190+90), got ${europeTotal}`);
  }
  pass("calculate_international_price('EUROPE', 2) = 280 AED");

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
