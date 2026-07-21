const tls = require("node:tls");
const crypto = require("node:crypto");

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const GMAIL_USER = String(process.env.GMAIL_USER || "").trim().toLowerCase();
const GMAIL_APP_PASSWORD = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const GMAIL_FROM_NAME = String(process.env.GMAIL_FROM_NAME || "DAY NIGHT DELIVERY SERVICES").trim();
const WEBHOOK_SECRET = String(process.env.DELIVERY_EMAIL_WEBHOOK_SECRET || "");
const CRON_SECRET = String(process.env.CRON_SECRET || "");
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
const SMTP_TIMEOUT_MS = 20_000;

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function bearer(req) {
  const value = String(req.headers.authorization || "");
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstText(order, keys) {
  for (const key of keys) {
    const value = order?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function orderReference(order) {
  return firstText(order, ["tracking_code", "tracking_number", "invoice_number", "coupon_number", "id"]);
}

function orderTotal(order) {
  const raw = order?.total_price ?? order?.total ?? order?.amount ?? order?.delivery_price ?? order?.price ?? 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function safeHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function supabaseFetch(path, { method = "GET", token = SUPABASE_SERVICE_ROLE_KEY, body, headers = {} } = {}) {
  if (!SUPABASE_URL || !token) throw new Error("supabase_server_configuration_missing");
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: token === SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || payload?.error_description || payload?.hint || `supabase_${response.status}`);
  return payload;
}

async function verifyUser(accessToken) {
  if (!accessToken || !SUPABASE_ANON_KEY) throw new Error("not_authenticated");
  return supabaseFetch("/auth/v1/user", { token: accessToken });
}

async function fetchOrderForUser(orderId, accessToken) {
  const rows = await supabaseFetch(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`, {
    token: accessToken,
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function fetchOrderAsService(orderId) {
  const rows = await supabaseFetch(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`, {
    headers: { Accept: "application/json" },
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function authUserEmail(customerId) {
  if (!customerId) return "";
  try {
    const user = await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(customerId)}`);
    return String(user?.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

async function recipientFor(order, authenticatedUser) {
  const direct = firstText(order, ["customer_email", "sender_email", "receiver_email", "email"]).toLowerCase();
  if (direct) return direct;
  if (authenticatedUser?.email) return String(authenticatedUser.email).trim().toLowerCase();
  return authUserEmail(firstText(order, ["customer_id"]));
}

function buildEmail(order, recipient) {
  const reference = orderReference(order) || "DAY-NIGHT";
  const sender = firstText(order, ["sender_name", "merchant_name"]) || "DAY NIGHT Customer";
  const receiver = firstText(order, ["receiver_name", "customer_name"]) || "—";
  const fromCity = firstText(order, ["sender_city", "pickup_city"]) || "—";
  const toCity = firstText(order, ["receiver_city", "delivery_city"]) || "—";
  const status = firstText(order, ["status"]) || "pending";
  const cod = Number(order?.cod_amount || 0);
  const created = firstText(order, ["created_at"]) || new Date().toISOString();

  const subject = `DAY NIGHT — Delivery request ${reference}`;
  const html = `<!doctype html><html><body style="margin:0;background:#061225;color:#fff;font-family:Arial,sans-serif"><div style="max-width:680px;margin:0 auto;padding:32px"><div style="border:1px solid rgba(212,175,55,.35);border-radius:24px;padding:28px;background:#0a1c3a"><p style="margin:0;color:#d4af37;font-weight:800">DAY NIGHT DELIVERY SERVICES</p><h1 style="margin:12px 0 6px;font-size:26px">Delivery request confirmation</h1><p style="margin:0 0 22px;color:#b8c6dc">تأكيد طلب التوصيل وملخص البيانات المسجلة</p><table style="width:100%;border-collapse:collapse;color:#fff"><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">Tracking / التتبع</td><td style="padding:10px;border-bottom:1px solid #244363;font-weight:800">${escapeHtml(reference)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">Sender / المرسل</td><td style="padding:10px;border-bottom:1px solid #244363">${escapeHtml(sender)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">Recipient / المستلم</td><td style="padding:10px;border-bottom:1px solid #244363">${escapeHtml(receiver)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">Route / المسار</td><td style="padding:10px;border-bottom:1px solid #244363">${escapeHtml(fromCity)} → ${escapeHtml(toCity)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">Status / الحالة</td><td style="padding:10px;border-bottom:1px solid #244363">${escapeHtml(status)}</td></tr><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">Delivery fee / رسوم التوصيل</td><td style="padding:10px;border-bottom:1px solid #244363">${escapeHtml(orderTotal(order))} AED</td></tr><tr><td style="padding:10px;border-bottom:1px solid #244363;color:#9fb1c8">COD / التحصيل</td><td style="padding:10px;border-bottom:1px solid #244363">${Number.isFinite(cod) ? cod.toFixed(2) : "0.00"} AED</td></tr><tr><td style="padding:10px;color:#9fb1c8">Created / الإنشاء</td><td style="padding:10px">${escapeHtml(created)}</td></tr></table><a href="https://daynightae.com/tracking?code=${encodeURIComponent(reference)}" style="display:inline-block;margin-top:24px;background:#d4af37;color:#061225;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:14px">Track shipment / تتبع الشحنة</a><p style="margin:24px 0 0;color:#8194ad;font-size:12px">Sent to ${escapeHtml(recipient)} · +971 56 875 7331 · daynightae@gmail.com</p></div></div></body></html>`;
  return { subject, html, reference };
}

function createSmtpClient() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST, rejectUnauthorized: true });
    socket.setTimeout(SMTP_TIMEOUT_MS);

    let buffer = "";
    let active = null;
    const responses = [];
    let closed = false;
    let connected = false;

    function rejectPending(error) {
      if (active) {
        active.reject(error);
        active = null;
      }
    }

    function emitResponse(response) {
      if (active) {
        const waiter = active;
        active = null;
        waiter.resolve(response);
      } else {
        responses.push(response);
      }
    }

    function parseLine(line) {
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!match) return;
      const code = Number(match[1]);
      const separator = match[2];
      const text = match[3];
      if (!parseLine.current || parseLine.current.code !== code) parseLine.current = { code, lines: [] };
      parseLine.current.lines.push(text);
      if (separator === " ") {
        const response = parseLine.current;
        parseLine.current = null;
        emitResponse(response);
      }
    }
    parseLine.current = null;

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n");
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        parseLine(line);
      }
    });

    socket.on("timeout", () => socket.destroy(new Error("gmail_smtp_timeout")));
    socket.on("error", (error) => {
      if (!connected) reject(error);
      rejectPending(error);
    });
    socket.on("close", () => {
      closed = true;
      const error = new Error("gmail_smtp_connection_closed");
      if (!connected) reject(error);
      rejectPending(error);
    });

    function readResponse() {
      if (responses.length) return Promise.resolve(responses.shift());
      if (closed) return Promise.reject(new Error("gmail_smtp_connection_closed"));
      return new Promise((resolveResponse, rejectResponse) => {
        active = { resolve: resolveResponse, reject: rejectResponse };
      });
    }

    async function expect(expected, stage) {
      const response = await readResponse();
      const allowed = Array.isArray(expected) ? expected : [expected];
      if (!allowed.includes(response.code)) {
        throw new Error(`gmail_smtp_${stage}_${response.code}:${response.lines.join(" ").slice(0, 300)}`);
      }
      return response;
    }

    async function command(value, expected, stage) {
      socket.write(`${value}\r\n`);
      return expect(expected, stage);
    }

    socket.once("secureConnect", () => {
      connected = true;
      resolve({ socket, expect, command });
    });
  });
}

function buildMimeMessage({ recipient, subject, html, orderId }) {
  const fromName = safeHeader(GMAIL_FROM_NAME || "DAY NIGHT DELIVERY SERVICES");
  const to = safeHeader(recipient);
  const from = safeHeader(GMAIL_USER);
  const messageId = `<${crypto.randomUUID()}@daynightae.com>`;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const encodedBody = Buffer.from(html, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trim();
  const lines = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Reply-To: ${from}`,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `X-Day-Night-Order-ID: ${safeHeader(orderId)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ];
  return { message: lines.join("\r\n"), messageId };
}

async function sendWithGmail(order, recipient) {
  if (!validEmail(GMAIL_USER)) throw new Error("gmail_user_missing_or_invalid");
  if (!GMAIL_APP_PASSWORD) throw new Error("gmail_app_password_missing");
  if (!validEmail(recipient)) throw new Error("recipient_email_missing_or_invalid");

  const email = buildEmail(order, recipient);
  const mime = buildMimeMessage({ recipient, subject: email.subject, html: email.html, orderId: order?.id || email.reference });
  const smtp = await createSmtpClient();

  try {
    await smtp.expect(220, "greeting");
    await smtp.command("EHLO daynightae.com", 250, "ehlo");
    await smtp.command("AUTH LOGIN", 334, "auth_login");
    await smtp.command(Buffer.from(GMAIL_USER, "utf8").toString("base64"), 334, "auth_user");
    await smtp.command(Buffer.from(GMAIL_APP_PASSWORD, "utf8").toString("base64"), 235, "auth_password");
    await smtp.command(`MAIL FROM:<${GMAIL_USER}>`, 250, "mail_from");
    await smtp.command(`RCPT TO:<${recipient}>`, [250, 251], "rcpt_to");
    await smtp.command("DATA", 354, "data");

    const dotStuffed = mime.message.replace(/(^|\r\n)\./g, "$1..");
    smtp.socket.write(`${dotStuffed}\r\n.\r\n`);
    await smtp.expect(250, "message");
    await smtp.command("QUIT", 221, "quit").catch(() => undefined);

    return { messageId: mime.messageId, reference: email.reference };
  } finally {
    smtp.socket.end();
  }
}

async function patchOutbox(id, updates) {
  if (!id) return;
  await supabaseFetch(`/rest/v1/delivery_confirmation_outbox?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...updates, updated_at: new Date().toISOString() },
    headers: { Prefer: "return=minimal" },
  });
}

async function processOutbox(limit = 10) {
  const rows = await supabaseFetch(`/rest/v1/delivery_confirmation_outbox?status=in.(pending,failed)&next_attempt_at=lte.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc&limit=${Math.min(Math.max(Number(limit) || 10, 1), 25)}&select=*`);
  const results = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    await patchOutbox(row.id, { status: "processing", attempts: Number(row.attempts || 0) + 1 });
    try {
      const order = await fetchOrderAsService(row.order_id);
      if (!order) throw new Error("order_not_found");
      const sent = await sendWithGmail(order, row.recipient_email);
      await patchOutbox(row.id, { status: "sent", sent_at: new Date().toISOString(), last_error: null, provider_message_id: sent.messageId });
      results.push({ id: row.id, orderId: row.order_id, ok: true, messageId: sent.messageId });
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1;
      const retryMinutes = Math.min(60, Math.max(5, attempts * 5));
      await patchOutbox(row.id, { status: "failed", last_error: error instanceof Error ? error.message : String(error), next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString() });
      results.push({ id: row.id, orderId: row.order_id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(res, 503, { ok: false, error: "supabase_server_configuration_missing" });
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return json(res, 503, { ok: false, error: "gmail_server_configuration_missing" });

    if (req.method === "GET") {
      if (!CRON_SECRET || bearer(req) !== CRON_SECRET) return json(res, 401, { ok: false, error: "cron_unauthorized" });
      const results = await processOutbox(req.query?.limit || 10);
      return json(res, 200, { ok: true, processed: results.length, results });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const accessToken = bearer(req);
    const webhookAuthorized = Boolean(WEBHOOK_SECRET && String(req.headers["x-day-night-webhook-secret"] || "") === WEBHOOK_SECRET);
    let user = null;
    let order = body.record || body.order || null;

    if (!webhookAuthorized) {
      user = await verifyUser(accessToken);
      const orderId = String(body.orderId || "");
      if (!orderId) return json(res, 400, { ok: false, error: "order_id_required" });
      order = await fetchOrderForUser(orderId, accessToken);
      if (!order) return json(res, 404, { ok: false, error: "order_not_found_or_not_authorized" });
    }

    if (!order?.id) return json(res, 400, { ok: false, error: "order_payload_required" });
    const recipient = await recipientFor(order, user);
    const sent = await sendWithGmail(order, recipient);

    const outboxRows = await supabaseFetch(`/rest/v1/delivery_confirmation_outbox?order_id=eq.${encodeURIComponent(order.id)}&recipient_email=eq.${encodeURIComponent(recipient)}&select=id`);
    if (Array.isArray(outboxRows) && outboxRows[0]?.id) {
      await patchOutbox(outboxRows[0].id, { status: "sent", sent_at: new Date().toISOString(), last_error: null, provider_message_id: sent.messageId });
    }

    return json(res, 200, { ok: true, orderId: String(order.id), recipient, messageId: sent.messageId, provider: "gmail-smtp" });
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};