import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => String(item.email || "").toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

async function provision() {
  let user = await findUserByEmail(MERCHANT_EMAIL);

  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: MERCHANT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        role: "merchant",
        account_type: "merchant",
        full_name: "DAY NIGHT Merchant",
      },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: MERCHANT_EMAIL,
      password: MERCHANT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: "merchant",
        account_type: "merchant",
        full_name: "DAY NIGHT Merchant",
      },
    });
    if (error) throw error;
    user = data.user;
  }

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
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .upsert(merchantPayload, { onConflict: "merchant_code" })
    .select("id, merchant_code, trade_name, email, status, user_id")
    .single();

  if (merchantError) throw merchantError;

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
