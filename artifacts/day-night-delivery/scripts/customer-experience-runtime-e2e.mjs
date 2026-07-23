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
  console.error(`Missing protected runtime variables: ${missing.join(", ")}`);
  process.exit(2);
}

const runId = `CX-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const keepData = String(env.CUSTOMER_EXPERIENCE_E2E_KEEP_DATA || "").toLowerCase() === "true";
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

function client(key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
const service = client(serviceRoleKey);
const publicClient = client(anonKey);
const merchant = client(anonKey);
const admin = client(anonKey);
const driver = client(anonKey);

const report = [];
const created = {
  orderId: null,
  feedbackId: null,
  complaintId: null,
  storagePaths: [],
};
let trackingNumber = "";
let merchantId = "";
let driverId = "";

function record(value) {
  return value && typeof value === "object" ? value : {};
}
function rows(value) {
  return Array.isArray(value) ? value : [];
}
function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
function pass(name, details = {}) {
  report.push({ name, status: "PASS", ...details });
  console.log(`PASS: ${name}`);
}
function fail(name, cause, details = {}) {
  const message = cause instanceof Error ? cause.message : String(cause || "unknown_error");
  report.push({ name, status: "FAIL", error: message, ...details });
  throw new Error(`${name}: ${message}`);
}
async function signIn(db, email, password, label) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.session) fail(`${label} authentication`, error || new Error("session_missing"));
  pass(`${label} authentication`, { userId: data.session.user.id });
  return data.session.user;
}
async function waitFor(label, probe, timeoutMs = 20_000, intervalMs = 750) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError || new Error(`${label}_timeout`);
}
async function cleanup() {
  if (keepData) {
    console.log("CUSTOMER_EXPERIENCE_E2E_KEEP_DATA=true — temporary records retained.");
    return;
  }
  if (created.storagePaths.length) {
    const { error } = await service.storage.from("complaint-attachments").remove(created.storagePaths);
    if (error) console.warn(`Storage cleanup warning: ${error.message}`);
  }
  if (created.orderId) {
    const { error } = await service.from("orders").delete().eq("id", created.orderId);
    if (error) console.warn(`Order cleanup warning: ${error.message}`);
  }
  console.log("Temporary Customer Experience E2E records cleaned up.");
}

try {
  console.log(`\nDAY NIGHT Customer Experience live E2E: ${runId}\n`);

  const { data: health, error: healthError } = await publicClient.rpc("customer_experience_runtime_health");
  if (healthError) fail("Customer Experience database health RPC", healthError);
  if (!record(health).ok) fail("Customer Experience database health RPC", new Error("health_not_ok"), { health });
  pass("Customer Experience database health RPC", health);

  await signIn(merchant, env.RUNTIME_MERCHANT_EMAIL, env.RUNTIME_MERCHANT_PASSWORD, "Merchant");
  await signIn(admin, env.RUNTIME_ADMIN_EMAIL, env.RUNTIME_ADMIN_PASSWORD, "Admin");
  await signIn(driver, env.RUNTIME_DRIVER_EMAIL, env.RUNTIME_DRIVER_PASSWORD, "Driver");

  const { data: merchantProfile, error: merchantProfileError } = await merchant.rpc("merchant_get_session_profile");
  if (merchantProfileError) fail("Merchant profile linkage", merchantProfileError);
  const merchants = rows(record(merchantProfile).merchants);
  if (merchants.length !== 1) fail("Merchant profile linkage", new Error(`expected_one_merchant_got_${merchants.length}`));
  merchantId = merchants[0].id;
  pass("Merchant profile linkage", { merchantId });

  const { data: driverProfile, error: driverProfileError } = await driver.rpc("driver_get_session_profile");
  if (driverProfileError) fail("Driver profile linkage", driverProfileError);
  driverId = record(record(Array.isArray(driverProfile) ? driverProfile[0] : driverProfile).driver).id;
  if (!driverId) fail("Driver profile linkage", new Error("driver_id_missing"));
  pass("Driver profile linkage", { driverId });

  const { data: createdOrder, error: createOrderError } = await merchant.rpc("merchant_create_order", {
    p_order: {
      receiver_name: "Customer Experience Runtime",
      receiver_phone: "+971501234567",
      receiver_email: env.RUNTIME_MERCHANT_EMAIL,
      customer_email: env.RUNTIME_MERCHANT_EMAIL,
      receiver_city: "Abu Dhabi",
      receiver_address: `Customer Experience destination ${runId}`,
      sender_city: "Mussafah",
      sender_address: `Customer Experience pickup ${runId}`,
      package_type: "Runtime verification parcel",
      package_description: "Temporary Customer Experience E2E record",
      pieces: 1,
      weight: 1,
      service_type: "standard",
      payment_method: "cod",
      cod_amount: 87.65,
      merchant_reference: runId,
      notes: `CUSTOMER_EXPERIENCE_E2E:${runId}`,
    },
  });
  if (createOrderError) fail("Merchant creates temporary real order", createOrderError);
  const order = record(Array.isArray(createdOrder) ? createdOrder[0] : createdOrder);
  created.orderId = order.id;
  trackingNumber = order.tracking_number || order.tracking_code;
  if (!created.orderId || !trackingNumber) fail("Merchant creates temporary real order", new Error("order_identity_missing"), { order });
  pass("Merchant creates temporary real order", { orderId: created.orderId, trackingNumber });

  const { data: dispatchResult, error: dispatchError } = await admin.rpc("admin_dispatch_order", {
    p_order_id: created.orderId,
    p_driver_id: driverId,
    p_action: "assign",
    p_note: `Customer Experience E2E assignment ${runId}`,
    p_force: false,
  });
  if (dispatchError || !record(Array.isArray(dispatchResult) ? dispatchResult[0] : dispatchResult).ok) {
    fail("Admin assigns real driver", dispatchError || new Error("dispatch_not_ok"), { dispatchResult });
  }
  pass("Admin assigns real driver");

  for (const [status, note] of [
    ["accepted", "Driver accepted Customer Experience E2E"],
    ["picked_up", "Temporary parcel picked up"],
    ["out_for_delivery", "Temporary parcel out for delivery"],
    ["delivered", "Temporary parcel delivered"],
  ]) {
    const { error } = await driver.rpc("driver_update_order_status", {
      p_order_id: created.orderId,
      p_status: status,
      p_note: `${note} — ${runId}`,
    });
    if (error) fail(`Driver status ${status}`, error);
    await waitFor(`status_${status}`, async () => {
      const { data, error: readError } = await service.from("orders").select("status").eq("id", created.orderId).single();
      if (readError) throw readError;
      const actual = normalize(data?.status);
      return status === "accepted" ? ["accepted", "confirmed"].includes(actual) : status === "out_for_delivery" ? ["out_for_delivery", "in_transit"].includes(actual) : actual === status;
    });
    pass(`Driver status ${status}`);
  }

  const { data: tokenData, error: tokenError } = await driver.rpc("create_feedback_token_for_order", { p_order_id: created.orderId });
  if (tokenError) fail("Driver creates secure feedback token", tokenError);
  const tokenPayload = record(Array.isArray(tokenData) ? tokenData[0] : tokenData);
  const token = tokenPayload.token;
  if (!token || String(token).length < 32) fail("Driver creates secure feedback token", new Error("secure_token_missing"));
  pass("Driver creates secure feedback token", { expiresAt: tokenPayload.expires_at });

  const { data: contextData, error: contextError } = await publicClient.rpc("get_feedback_context", { p_token: token });
  if (contextError) fail("Public feedback context", contextError);
  const context = record(Array.isArray(contextData) ? contextData[0] : contextData);
  for (const forbidden of ["order_id", "customer_id", "merchant_id", "driver_id"]) {
    if (Object.prototype.hasOwnProperty.call(context, forbidden)) fail("Public feedback context privacy", new Error(`exposed_${forbidden}`), { context });
  }
  if (context.tracking_number !== trackingNumber) fail("Public feedback context", new Error("tracking_mismatch"), { context, trackingNumber });
  pass("Public feedback context privacy", { keys: Object.keys(context) });

  const feedbackPayload = {
    p_token: token,
    p_overall_rating: 5,
    p_driver_rating: 5,
    p_company_rating: 5,
    p_punctuality_rating: 5,
    p_communication_rating: 5,
    p_professionalism_rating: 5,
    p_package_care_rating: 5,
    p_tracking_experience_rating: 5,
    p_selected_tags: ["الخدمة سريعة", "المندوب محترم"],
    p_comment: `Customer Experience E2E feedback ${runId}`,
    p_allow_public_display: false,
    p_request_contact: true,
  };
  const { data: feedbackResult, error: feedbackError } = await publicClient.rpc("submit_order_feedback", feedbackPayload);
  if (feedbackError) fail("Public feedback submission", feedbackError);
  created.feedbackId = record(Array.isArray(feedbackResult) ? feedbackResult[0] : feedbackResult).feedback_id;
  if (!created.feedbackId) fail("Public feedback submission", new Error("feedback_id_missing"));
  pass("Public feedback submission", { feedbackId: created.feedbackId });

  const { error: feedbackUpdateError } = await publicClient.rpc("submit_order_feedback", {
    ...feedbackPayload,
    p_overall_rating: 4,
    p_comment: `Customer Experience E2E updated feedback ${runId}`,
  });
  if (feedbackUpdateError) fail("Feedback update policy", feedbackUpdateError);
  const { data: feedbackRows, error: feedbackCountError } = await service.from("order_feedback").select("id,overall_rating").eq("order_id", created.orderId);
  if (feedbackCountError || feedbackRows?.length !== 1 || Number(feedbackRows[0].overall_rating) !== 4) {
    fail("Feedback update policy", feedbackCountError || new Error("feedback_not_upserted"), { feedbackRows });
  }
  pass("Feedback update policy");

  const { data: driverRawFeedback, error: driverRawFeedbackError } = await driver.from("order_feedback").select("id").eq("order_id", created.orderId);
  if (driverRawFeedbackError) fail("Driver raw feedback RLS", driverRawFeedbackError);
  if (driverRawFeedback?.length) fail("Driver raw feedback RLS", new Error("driver_can_read_raw_feedback"));
  const { data: driverSummary, error: driverSummaryError } = await driver.rpc("driver_feedback_summary");
  if (driverSummaryError || !record(driverSummary).ok) fail("Driver aggregate feedback summary", driverSummaryError || new Error("summary_not_ok"));
  pass("Driver aggregate feedback summary", driverSummary);

  const { data: merchantFeedback, error: merchantFeedbackError } = await merchant.from("order_feedback").select("id,order_id").eq("order_id", created.orderId);
  if (merchantFeedbackError || merchantFeedback?.length !== 1) fail("Merchant feedback RLS", merchantFeedbackError || new Error("merchant_feedback_not_visible"));
  pass("Merchant feedback RLS");

  const { data: complaintData, error: complaintError } = await publicClient.rpc("submit_public_complaint", {
    p_token: token,
    p_category: "tracking_issue",
    p_severity: "high",
    p_description: `Customer Experience E2E complaint description ${runId}`,
    p_preferred_contact_time: "After 18:00",
    p_request_contact: true,
  });
  if (complaintError) fail("Public complaint submission", complaintError);
  const complaint = record(Array.isArray(complaintData) ? complaintData[0] : complaintData);
  created.complaintId = complaint.id;
  if (!created.complaintId || !/^DN-CMP-\d{4}-\d{5,}$/.test(String(complaint.complaint_number || ""))) {
    fail("Public complaint submission", new Error("complaint_identity_invalid"), { complaint });
  }
  pass("Public complaint submission", { complaintNumber: complaint.complaint_number });

  const { error: duplicateComplaintError } = await publicClient.rpc("submit_public_complaint", {
    p_token: token,
    p_category: "tracking_issue",
    p_severity: "high",
    p_description: `Duplicate Customer Experience E2E complaint ${runId}`,
    p_preferred_contact_time: "After 18:00",
    p_request_contact: true,
  });
  if (!duplicateComplaintError || !String(duplicateComplaintError.message || "").includes("duplicate_complaint_rate_limited")) {
    fail("Complaint duplicate rate limit", new Error("duplicate_complaint_was_not_rejected"), { duplicateComplaintError });
  }
  pass("Complaint duplicate rate limit");

  const onePixelPng = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const storagePath = `${created.complaintId}/${complaint.upload_nonce}/evidence-${runId}.png`;
  const { error: uploadError } = await publicClient.storage.from("complaint-attachments").upload(storagePath, onePixelPng, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) fail("Private complaint attachment upload", uploadError);
  created.storagePaths.push(storagePath);
  const { error: registerError } = await publicClient.rpc("register_complaint_attachment", {
    p_complaint_id: created.complaintId,
    p_upload_nonce: complaint.upload_nonce,
    p_storage_path: storagePath,
    p_file_name: `evidence-${runId}.png`,
    p_mime_type: "image/png",
    p_file_size: onePixelPng.byteLength,
  });
  if (registerError) fail("Private complaint attachment registration", registerError);
  pass("Private complaint attachment upload and registration");

  const { data: anonComplaints, error: anonComplaintsError } = await publicClient.from("complaints").select("id").eq("id", created.complaintId);
  if (anonComplaintsError) fail("Anonymous complaint RLS", anonComplaintsError);
  if (anonComplaints?.length) fail("Anonymous complaint RLS", new Error("anonymous_can_read_complaint"));
  const { data: merchantComplaints, error: merchantComplaintsError } = await merchant.from("complaints").select("id").eq("id", created.complaintId);
  if (merchantComplaintsError) fail("Merchant internal complaint RLS", merchantComplaintsError);
  if (merchantComplaints?.length) fail("Merchant internal complaint RLS", new Error("merchant_can_read_internal_complaint"));
  pass("Complaint read RLS");

  const { error: adminUpdateError } = await admin.rpc("admin_update_complaint", {
    p_complaint_id: created.complaintId,
    p_status: "under_review",
    p_severity: "high",
    p_assigned_to: null,
    p_resolution: null,
    p_note: `Customer Experience E2E review ${runId}`,
  });
  if (adminUpdateError) fail("Admin complaint workflow", adminUpdateError);
  const event = await waitFor("complaint_event", async () => {
    const { data, error } = await service.from("complaint_events").select("*").eq("complaint_id", created.complaintId).eq("new_status", "under_review");
    if (error) throw error;
    return data?.[0] || null;
  });
  pass("Admin complaint workflow and event audit", { eventId: event.id });

  const { error: publishError } = await admin.rpc("admin_set_feedback_review", {
    p_feedback_id: created.feedbackId,
    p_review_status: "published",
    p_allow_public_display: true,
  });
  if (publishError) fail("Admin feedback review action", publishError);
  const { data: reviewedFeedback } = await service.from("order_feedback").select("review_status,allow_public_display").eq("id", created.feedbackId).single();
  if (reviewedFeedback?.review_status !== "published" || reviewedFeedback?.allow_public_display !== true) {
    fail("Admin feedback review action", new Error("publish_state_not_persisted"), { reviewedFeedback });
  }
  pass("Admin feedback review action");

  const { data: templateRows, error: templateReadError } = await admin.from("message_templates").select("id,body,is_active").limit(1);
  if (templateReadError || !templateRows?.[0]) fail("Message template validation setup", templateReadError || new Error("template_missing"));
  const { error: invalidTemplateError } = await admin.rpc("admin_update_message_template", {
    p_template_id: templateRows[0].id,
    p_body: `${templateRows[0].body}\n{unknown_runtime_variable}`,
    p_is_active: templateRows[0].is_active,
  });
  if (!invalidTemplateError || !String(invalidTemplateError.message || "").includes("unknown_template_variables")) {
    fail("Unknown template variable rejection", new Error("unknown_variable_was_not_rejected"), { invalidTemplateError });
  }
  pass("Unknown template variable rejection");

  const generatedMessage = `Customer Experience E2E WhatsApp message ${runId}`;
  const generatedUrl = `https://wa.me/971501234567?text=${encodeURIComponent(generatedMessage)}`;
  const { data: messageLog, error: messageLogError } = await driver.rpc("log_outbound_message", {
    p_template_key: "driver_on_the_way",
    p_channel: "whatsapp",
    p_recipient_type: "customer",
    p_recipient_id: null,
    p_recipient_phone: "971501234567",
    p_order_id: created.orderId,
    p_merchant_id: merchantId,
    p_driver_id: driverId,
    p_generated_message: generatedMessage,
    p_generated_url: generatedUrl,
    p_status: "generated",
    p_metadata: { source: "customer_experience_runtime_e2e", run_id: runId },
  });
  if (messageLogError) fail("Outbound message log generated status", messageLogError);
  const messageLogId = record(Array.isArray(messageLog) ? messageLog[0] : messageLog).id;
  if (!messageLogId) fail("Outbound message log generated status", new Error("message_log_id_missing"));
  const { error: openedError } = await driver.rpc("mark_outbound_message_status", { p_log_id: messageLogId, p_status: "opened" });
  if (openedError) fail("Outbound message log opened status", openedError);
  const { data: messageRow } = await service.from("outbound_message_logs").select("status,opened_at").eq("id", messageLogId).single();
  if (messageRow?.status !== "opened" || !messageRow?.opened_at) fail("Outbound message log opened status", new Error("opened_status_not_persisted"), { messageRow });
  pass("Outbound message accurate generated/opened statuses");

  const notification = await waitFor("admin_notification", async () => {
    const { data, error } = await service.from("notifications").select("id,type,metadata").contains("metadata", { complaint_id: created.complaintId }).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  });
  pass("Realtime-compatible admin complaint notification", { notificationId: notification.id, type: notification.type });

  console.log("\nDAY NIGHT Customer Experience live E2E PASSED.\n");
  console.log(JSON.stringify({ runId, report }, null, 2));
} catch (error) {
  console.error("\nDAY NIGHT Customer Experience live E2E FAILED.\n");
  console.error(error);
  console.log(JSON.stringify({ runId, report }, null, 2));
  process.exitCode = 1;
} finally {
  await cleanup();
  await Promise.allSettled([
    merchant.auth.signOut(),
    admin.auth.signOut(),
    driver.auth.signOut(),
  ]);
}
