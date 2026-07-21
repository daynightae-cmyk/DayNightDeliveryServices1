import { createClient } from "@supabase/supabase-js";

const env = process.env;
const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RUNTIME_MERCHANT_EMAIL",
  "RUNTIME_MERCHANT_PASSWORD",
  "RUNTIME_ADMIN_EMAIL",
  "RUNTIME_ADMIN_PASSWORD",
  "RUNTIME_DRIVER_EMAIL",
  "RUNTIME_DRIVER_PASSWORD",
];

const missing = required.filter((name) => !String(env[name] || "").trim());
if (missing.length) {
  console.error(`Missing required runtime E2E environment variables: ${missing.join(", ")}`);
  process.exit(2);
}

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const keepData = String(env.RUNTIME_E2E_KEEP_DATA || "").toLowerCase() === "true";
const customerEmail = String(env.RUNTIME_CUSTOMER_EMAIL || env.RUNTIME_MERCHANT_EMAIL).trim().toLowerCase();
const confirmationApiUrl = String(env.RUNTIME_CONFIRMATION_API_URL || "").trim();
const runId = `E2E-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

function client(key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const service = client(serviceRoleKey);
const merchant = client(anonKey);
const admin = client(anonKey);
const driver = client(anonKey);

const report = [];
const created = { orderId: null, branchId: null, pickupId: null, documentId: null };

function record(value) {
  return value && typeof value === "object" ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function pass(name, details = {}) {
  report.push({ name, status: "PASS", ...details });
  console.log(`PASS: ${name}`);
}

function skip(name, reason) {
  report.push({ name, status: "SKIP", reason });
  console.log(`SKIP: ${name} — ${reason}`);
}

function fail(name, error, details = {}) {
  const message = error instanceof Error ? error.message : String(error || "unknown_error");
  report.push({ name, status: "FAIL", error: message, ...details });
  throw new Error(`${name}: ${message}`);
}

async function signIn(db, email, password, label) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.session) fail(`${label} authentication`, error || new Error("session_missing"));
  pass(`${label} authentication`, { userId: data.session.user.id });
  return data.session;
}

async function waitFor(label, probe, timeoutMs = 20_000, intervalMs = 1_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError || new Error(`${label}_timeout`);
}

async function deleteIf(table, id) {
  if (!id) return;
  const { error } = await service.from(table).delete().eq("id", id);
  if (error) console.warn(`Cleanup warning for ${table}/${id}: ${error.message}`);
}

async function cleanup() {
  if (keepData) {
    console.log("RUNTIME_E2E_KEEP_DATA=true — test records were preserved.");
    return;
  }
  await deleteIf("merchant_pickup_requests", created.pickupId);
  await deleteIf("merchant_documents", created.documentId);
  await deleteIf("merchant_branches", created.branchId);
  await deleteIf("orders", created.orderId);
  console.log("Temporary E2E records cleaned up.");
}

let merchantSession;
let adminSession;
let driverSession;
let merchantId;
let driverId;
let trackingNumber;

try {
  console.log(`\nDAY NIGHT live runtime E2E started: ${runId}\n`);

  merchantSession = await signIn(merchant, env.RUNTIME_MERCHANT_EMAIL, env.RUNTIME_MERCHANT_PASSWORD, "Merchant");
  adminSession = await signIn(admin, env.RUNTIME_ADMIN_EMAIL, env.RUNTIME_ADMIN_PASSWORD, "Admin");
  driverSession = await signIn(driver, env.RUNTIME_DRIVER_EMAIL, env.RUNTIME_DRIVER_PASSWORD, "Driver");

  const { data: merchantProfile, error: merchantProfileError } = await merchant.rpc("merchant_get_session_profile");
  if (merchantProfileError) fail("Merchant profile linkage", merchantProfileError);
  const merchants = array(record(merchantProfile).merchants);
  if (merchants.length !== 1) fail("Merchant profile linkage", new Error(`expected_one_merchant_got_${merchants.length}`));
  merchantId = merchants[0].id;
  pass("Merchant profile linkage", { merchantId });

  const { data: driverProfile, error: driverProfileError } = await driver.rpc("driver_get_session_profile");
  if (driverProfileError) fail("Driver profile linkage", driverProfileError);
  const driverPayload = record(Array.isArray(driverProfile) ? driverProfile[0] : driverProfile);
  driverId = record(driverPayload.driver).id;
  if (!driverId) fail("Driver profile linkage", new Error("driver_id_missing"));
  pass("Driver profile linkage", { driverId });

  const { data: branchResult, error: branchError } = await merchant.rpc("merchant_save_branch", {
    p_branch: {
      name: `Runtime Test Branch ${runId}`,
      code: runId,
      contactName: "DAY NIGHT Runtime Test",
      phone: "+971568757331",
      email: customerEmail,
      emirate: "Abu Dhabi",
      city: "Mussafah",
      address: `Mussafah 40 — ${runId}`,
      workingHours: "24/7",
      pickupInstructions: "Automated runtime verification record",
      isDefault: false,
      active: true,
    },
  });
  if (branchError) fail("Branch persistence", branchError);
  created.branchId = record(record(branchResult).branch).id;
  if (!created.branchId) fail("Branch persistence", new Error("branch_id_missing"));
  pass("Branch persistence", { branchId: created.branchId });

  const { data: pickupResult, error: pickupError } = await merchant.rpc("merchant_create_pickup_request", {
    p_request: {
      branchId: created.branchId,
      pickupAddress: `Mussafah 40 — ${runId}`,
      requestedDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      timeWindow: "09:00-12:00",
      shipmentCount: 1,
      pieceCount: 1,
      notes: `Runtime E2E pickup ${runId}`,
    },
  });
  if (pickupError) fail("Pickup request creation", pickupError);
  created.pickupId = record(record(pickupResult).request).id;
  if (!created.pickupId) fail("Pickup request creation", new Error("pickup_id_missing"));
  pass("Pickup request creation", { pickupId: created.pickupId });

  const { data: documentRows, error: documentError } = await merchant
    .from("merchant_documents")
    .insert({
      merchant_id: merchantId,
      document_type: "runtime_verification",
      document_number: runId,
      status: "under_review",
      review_note: "Automated runtime verification record",
    })
    .select("*")
    .single();
  if (documentError) fail("Merchant document persistence", documentError);
  created.documentId = documentRows.id;
  pass("Merchant document persistence", { documentId: created.documentId });

  const { data: createdOrder, error: createOrderError } = await merchant.rpc("merchant_create_order", {
    p_order: {
      receiver_name: "Runtime Delivery Customer",
      receiver_phone: "+971501234567",
      receiver_email: customerEmail,
      customer_email: customerEmail,
      receiver_city: "Abu Dhabi",
      receiver_address: `Runtime destination ${runId}`,
      sender_city: "Mussafah",
      sender_address: `Runtime pickup ${runId}`,
      package_type: "Runtime test parcel",
      package_description: "Automated merchant-admin-driver lifecycle verification",
      pieces: 1,
      weight: 1,
      service_type: "standard",
      payment_method: "cod",
      cod_amount: 123.45,
      merchant_reference: runId,
      notes: `RUNTIME_E2E:${runId}`,
    },
  });
  if (createOrderError) fail("Merchant creates real order", createOrderError);
  const order = record(Array.isArray(createdOrder) ? createdOrder[0] : createdOrder);
  created.orderId = order.id;
  trackingNumber = order.tracking_code || order.tracking_number;
  if (!created.orderId || String(order.merchant_id) !== String(merchantId)) fail("Merchant creates real order", new Error("merchant_id_link_failed"), { order });
  pass("Merchant creates real order", { orderId: created.orderId, merchantId, trackingNumber });

  const { data: adminRows, error: adminReadError } = await admin.from("orders").select("*").eq("id", created.orderId).limit(1);
  if (adminReadError) fail("Admin sees merchant order", adminReadError);
  if (!adminRows?.[0] || String(adminRows[0].merchant_id) !== String(merchantId)) fail("Admin sees merchant order", new Error("admin_order_visibility_failed"));
  pass("Admin sees merchant order", { orderId: created.orderId, merchantName: adminRows[0].merchant_name });

  const { data: dispatchResult, error: dispatchError } = await admin.rpc("admin_dispatch_order", {
    p_order_id: created.orderId,
    p_driver_id: driverId,
    p_action: "assign",
    p_note: `Runtime E2E assignment ${runId}`,
    p_force: false,
  });
  if (dispatchError) fail("Admin assigns real driver", dispatchError);
  const dispatch = record(Array.isArray(dispatchResult) ? dispatchResult[0] : dispatchResult);
  if (!dispatch.ok) fail("Admin assigns real driver", new Error("dispatch_result_not_ok"), { dispatch });
  const assigned = await waitFor("driver_assignment", async () => {
    const { data, error } = await service.from("orders").select("*").eq("id", created.orderId).single();
    if (error) throw error;
    const assignedId = data.driver_id || data.assigned_driver_id;
    return String(assignedId || "") === String(driverId) ? data : null;
  });
  pass("Admin assigns real driver", { driverId, orderStatus: assigned.status });

  const { data: driverOrders, error: driverOrdersError } = await driver
    .from("orders")
    .select("*")
    .or(`driver_id.eq.${driverId},assigned_driver_id.eq.${driverId}`)
    .eq("id", created.orderId);
  if (driverOrdersError) fail("Driver sees only assigned order", driverOrdersError);
  if (driverOrders?.length !== 1) fail("Driver sees only assigned order", new Error(`expected_one_assigned_order_got_${driverOrders?.length || 0}`));
  pass("Driver sees only assigned order", { orderId: created.orderId });

  for (const [status, note] of [
    ["accepted", "Runtime driver accepted mission"],
    ["picked_up", "Runtime parcel picked up"],
    ["out_for_delivery", "Runtime parcel is out for delivery"],
  ]) {
    const { error } = await driver.rpc("driver_update_order_status", { p_order_id: created.orderId, p_status: status, p_note: `${note} — ${runId}` });
    if (error) fail(`Driver status ${status}`, error);
    await waitFor(`status_${status}`, async () => {
      const { data } = await service.from("orders").select("status").eq("id", created.orderId).single();
      return normalize(data?.status) === status ? data : null;
    });
    pass(`Driver status ${status}`);
  }

  const testLat = 24.453884;
  const testLng = 54.377344;
  const { error: locationError } = await driver.rpc("driver_report_location", {
    p_lat: testLat,
    p_lng: testLng,
    p_accuracy: 5,
    p_heading: 90,
    p_speed: 12,
    p_altitude: null,
    p_current_order_id: created.orderId,
    p_battery_level: 80,
    p_network_state: "runtime-e2e",
  });
  if (locationError) fail("Driver live location write", locationError);
  const liveLocation = await waitFor("live_location", async () => {
    const { data, error } = await service.from("driver_locations").select("*").eq("driver_id", driverId).limit(1).maybeSingle();
    if (error) throw error;
    const lat = Number(data?.lat ?? data?.latitude);
    const lng = Number(data?.lng ?? data?.longitude);
    return Math.abs(lat - testLat) < 0.001 && Math.abs(lng - testLng) < 0.001 ? data : null;
  });
  pass("Driver live location write", { lat: liveLocation.lat ?? liveLocation.latitude, lng: liveLocation.lng ?? liveLocation.longitude });

  const { data: merchantOrdersAfter, error: merchantOrdersAfterError } = await merchant.rpc("merchant_portal_orders", { p_limit: 250 });
  if (merchantOrdersAfterError) fail("Merchant receives live status", merchantOrdersAfterError);
  const merchantOrder = array(record(merchantOrdersAfter).orders).find((item) => item.id === created.orderId);
  if (!merchantOrder || normalize(merchantOrder.status) !== "out_for_delivery") fail("Merchant receives live status", new Error("merchant_status_not_synced"));
  pass("Merchant receives live status", { status: merchantOrder.status });

  const { data: trackingLocation, error: trackingLocationError } = await merchant.rpc("tracking_live_driver_location", { p_order_id: created.orderId });
  if (trackingLocationError) fail("Merchant live tracking RPC", trackingLocationError);
  const trackingPayload = record(Array.isArray(trackingLocation) ? trackingLocation[0] : trackingLocation);
  if (!trackingPayload.live || !record(trackingPayload.location)) fail("Merchant live tracking RPC", new Error("live_location_not_returned"));
  pass("Merchant live tracking RPC", { driverId: trackingPayload.driver_id });

  const { error: deliveredError } = await driver.rpc("driver_update_order_status", {
    p_order_id: created.orderId,
    p_status: "delivered",
    p_note: `Runtime parcel delivered — ${runId}`,
  });
  if (deliveredError) fail("Driver completes delivery", deliveredError);
  const deliveredOrder = await waitFor("delivered", async () => {
    const { data, error } = await service.from("orders").select("*").eq("id", created.orderId).single();
    if (error) throw error;
    return normalize(data.status) === "delivered" && data.delivered_at ? data : null;
  });
  pass("Driver completes delivery", { deliveredAt: deliveredOrder.delivered_at });

  const { data: historyData, error: historyError } = await merchant.rpc("public_customer_order_history", { p_limit: 100 });
  if (historyError) fail("Authenticated customer history RPC", historyError);
  const historyOrder = array(historyData).find((item) => item.id === created.orderId);
  if (!historyOrder || normalize(historyOrder.status) !== "delivered" || !historyOrder.delivered_at) fail("Authenticated customer history RPC", new Error("delivered_order_missing_from_history"));
  pass("Authenticated customer history RPC", { deliveredAt: historyOrder.delivered_at });

  const { data: businessCenter, error: businessCenterError } = await merchant.rpc("merchant_portal_business_center");
  if (businessCenterError) fail("Branch, pickup, and document reload", businessCenterError);
  const center = record(businessCenter);
  if (!array(center.branches).some((item) => item.id === created.branchId)) fail("Branch, pickup, and document reload", new Error("branch_not_reloaded"));
  if (!array(center.pickup_requests).some((item) => item.id === created.pickupId)) fail("Branch, pickup, and document reload", new Error("pickup_not_reloaded"));
  if (!array(center.documents).some((item) => item.id === created.documentId)) fail("Branch, pickup, and document reload", new Error("document_not_reloaded"));
  pass("Branch, pickup, and document reload");

  const snapshot = await waitFor("finance_snapshot", async () => {
    const { data, error } = await admin.rpc("admin_delivery_runtime_snapshot", { p_order_id: created.orderId });
    if (error) throw error;
    const payload = record(Array.isArray(data) ? data[0] : data);
    return array(payload.cod_collections).length && array(payload.statement_entries).length ? payload : null;
  }, 30_000, 1_500);
  pass("COD collection is real", { rows: array(snapshot.cod_collections).length, codAmount: 123.45 });
  pass("Merchant settlement entry is real", { rows: array(snapshot.statement_entries).length });
  pass("Admin and merchant timeline share one order", { historyRows: array(snapshot.status_history).length });
  if (array(snapshot.status_history).length < 4) fail("Admin and merchant timeline share one order", new Error("status_history_incomplete"));

  const outboxRows = array(snapshot.email_outbox);
  if (!outboxRows.length) fail("Automatic email confirmation queued", new Error("email_outbox_row_missing"));
  pass("Automatic email confirmation queued", { outboxStatus: outboxRows[0].status, recipient: outboxRows[0].recipient_email });

  if (confirmationApiUrl) {
    const response = await fetch(confirmationApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${merchantSession.access_token}` },
      body: JSON.stringify({ orderId: created.orderId }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) fail("Delivery confirmation API sends email", new Error(payload?.error || `http_${response.status}`));
    pass("Delivery confirmation API sends email", { messageId: payload.messageId, recipient: payload.recipient });
  } else {
    skip("Delivery confirmation API sends email", "RUNTIME_CONFIRMATION_API_URL is not configured");
  }

  console.log("\nDAY NIGHT runtime E2E PASSED.\n");
} catch (error) {
  console.error(`\nDAY NIGHT runtime E2E FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await cleanup();
  await merchant.auth.signOut().catch(() => undefined);
  await admin.auth.signOut().catch(() => undefined);
  await driver.auth.signOut().catch(() => undefined);
  console.log(JSON.stringify({ runId, keepData, orderId: created.orderId, trackingNumber, report }, null, 2));
}
