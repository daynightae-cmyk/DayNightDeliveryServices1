const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const MERCHANT_PASSWORD = String(process.env.MERCHANT_BOOTSTRAP_PASSWORD || "");
const MERCHANT_EMAIL = "merchant@daynightae.com";
const MERCHANT_CODE = "DN-MERCHANT-OFFICIAL";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !MERCHANT_PASSWORD) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or MERCHANT_BOOTSTRAP_PASSWORD.");
  process.exit(1);
}

if (MERCHANT_PASSWORD.length < 12) {
  console.error("MERCHANT_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const commonHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...commonHeaders, ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return data;
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const payload = await requestJson(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const user = users.find((item) => String(item.email || "").toLowerCase() === email);
    if (user) return user;
    if (users.length < 100) break;
  }
  return null;
}

async function provisionAuthUser() {
  const existing = await findUserByEmail(MERCHANT_EMAIL);
  const payload = {
    email: MERCHANT_EMAIL,
    password: MERCHANT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      ...(existing?.user_metadata || {}),
      role: "merchant",
      account_type: "merchant",
      full_name: "DAY NIGHT Merchant",
    },
  };

  if (existing) {
    return requestJson(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  return requestJson(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function provisionMerchantRow(userId) {
  const merchantPayload = {
    merchant_code: MERCHANT_CODE,
    trade_name: "DAY NIGHT Merchant",
    owner_name: "DAY NIGHT DELIVERY SERVICES",
    phone: "+971568757331",
    email: MERCHANT_EMAIL,
    emirate: "Abu Dhabi",
    city: "Mussafah",
    address: "UAE — Abu Dhabi — Mussafah 40",
    pickup_address: "UAE — Abu Dhabi — Mussafah 40",
    settlement_cycle: "weekly",
    commission_type: "fixed_delivery_fee",
    default_payment_method: "sender_pays",
    status: "active",
    notes: "Official DAY NIGHT merchant portal account",
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  const data = await requestJson(`${SUPABASE_URL}/rest/v1/merchants?on_conflict=merchant_code&select=id,merchant_code,trade_name,email,status,user_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(merchantPayload),
  });

  return Array.isArray(data) ? data[0] : data;
}

async function provision() {
  const user = await provisionAuthUser();
  if (!user?.id) throw new Error("Supabase Auth did not return a user id.");
  const merchant = await provisionMerchantRow(user.id);

  console.log(JSON.stringify({
    ok: true,
    user_id: user.id,
    email: user.email,
    merchant,
  }, null, 2));
}

provision().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
