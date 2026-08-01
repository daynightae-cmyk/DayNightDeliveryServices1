import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminDataPath = path.join(root, "artifacts/day-night-delivery/src/lib/adminData.ts");
const merchantPortalPath = path.join(root, "artifacts/day-night-delivery/src/components/merchant/MerchantPortal.tsx");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function assertIncludes(content, marker, label) {
  if (!content.includes(marker)) {
    throw new Error(`Expected ${label} marker was not found: ${marker}`);
  }
}

function replaceOnce(content, search, replacement, label) {
  const matches = typeof search === "string"
    ? content.split(search).length - 1
    : [...content.matchAll(new RegExp(search.source, search.flags.includes("g") ? search.flags : `${search.flags}g`))].length;
  if (matches !== 1) {
    throw new Error(`${label} expected exactly one match, found ${matches}`);
  }
  return content.replace(search, replacement);
}

function patchAdminData() {
  let source = read(adminDataPath);

  if (!source.includes('import { resolveOrderMerchant } from "./orderFinancialOperations";')) {
    source = replaceOnce(
      source,
      'import { createDayNightInvoiceNumber } from "./printableDocuments";',
      'import { createDayNightInvoiceNumber } from "./printableDocuments";\nimport { resolveOrderMerchant } from "./orderFinancialOperations";',
      "adminData resolver import",
    );
  }

  if (source.includes("function buildLegacyAdminOrderPayload")) {
    source = replaceOnce(
      source,
      /function buildLegacyAdminOrderPayload\([\s\S]*?\n}\n\n(?=export async function createAdminOrder)/,
      "",
      "legacy admin order payload removal",
    );
  }

  const safeCreate = `export async function createAdminOrder(input: AdminOrderInput): Promise<Order> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const selectedMerchant = input.merchant;
  if (!selectedMerchant?.id) {
    throw new Error("تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.");
  }
  const merchant = await resolveOrderMerchant(selectedMerchant);

  const couponNumber = clean(input.coupon_number);
  const receiverName = clean(input.receiver_name);
  const receiverPhone = clean(input.receiver_phone);
  const receiverAddress = clean(input.receiver_address);
  const pickupCity = clean(input.pickup_city);
  const packageDescription = clean(input.package_description || input.package_type);
  const paymentMethod = clean(input.payment_method);
  const status = clean(input.status);
  const isInternational = input.shipping_scope === "international";
  const receiverCity = isInternational
    ? clean(input.destination_country || input.delivery_city)
    : clean(input.delivery_city);
  const rawWeight = Number(input.weight);

  const missing = [
    !couponNumber && "coupon_number",
    !receiverName && "receiver_name",
    !receiverPhone && "receiver_phone",
    !receiverAddress && "receiver_address",
    !pickupCity && "pickup_city",
    !receiverCity && (isInternational ? "destination_country" : "delivery_city"),
    !packageDescription && "package_type",
    !paymentMethod && "payment_method",
    !status && "status",
    !clean(merchant.trade_name) && "merchant.trade_name",
    !clean(merchant.phone) && "merchant.phone",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(\`order_required_fields_missing:\${missing.join(",")}\`);
  }
  if (isInternational && (!Number.isFinite(rawWeight) || rawWeight <= 0)) {
    throw new Error("international_order_weight_required");
  }

  const count = Math.max(1, Math.ceil(numberValue(input.order_count, 1)));
  const strictInput = {
    ...input,
    merchant,
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code,
    coupon_number: couponNumber,
    pickup_city: pickupCity,
    delivery_city: receiverCity,
    destination_country: isInternational ? receiverCity : undefined,
    receiver_name: receiverName,
    receiver_phone: receiverPhone,
    receiver_address: receiverAddress,
    package_type: packageDescription,
    package_description: packageDescription,
    payment_method: paymentMethod,
    status,
    order_count: count,
    weight: isInternational ? rawWeight : input.weight,
  } satisfies AdminOrderInput;
  const pricing = calculateAdminOrderPrice(strictInput);
  const createdAt = new Date().toISOString();
  const invoiceNumber = createDayNightInvoiceNumber(couponNumber, new Date(createdAt));
  const senderCity = clean(merchant.city || merchant.emirate || pickupCity);
  const senderAddress = clean(merchant.pickup_address || merchant.address || senderCity);

  const payload: Record<string, unknown> = removeEmptyUndefined({
    invoice_number: invoiceNumber,
    coupon_number: couponNumber,
    merchant_id: merchant.id,
    merchant_name: merchant.trade_name,
    merchant_code: merchant.merchant_code,
    order_count: count,
    shipping_scope: input.shipping_scope,
    destination_country: isInternational ? receiverCity : null,
    source_channel: "admin_panel",
    source_domain: "daynightae.com",
    sender_name: merchant.trade_name,
    sender_phone: merchant.phone,
    sender_city: senderCity,
    sender_address: senderAddress,
    receiver_name: receiverName,
    receiver_phone: receiverPhone,
    receiver_city: receiverCity,
    receiver_address: receiverAddress,
    package_type: packageDescription,
    package_description: packageDescription,
    weight: isInternational ? rawWeight : numberValue(input.weight, 1),
    pieces: count,
    service_type: isInternational ? "international" : "standard",
    payment_method: paymentMethod,
    cod_amount: paymentMethod === "cod" ? Math.max(0, numberValue(input.cod_amount, 0)) : null,
    delivery_price: pricing.total,
    subtotal: pricing.total,
    base_price: pricing.total,
    total: pricing.total,
    total_price: pricing.total,
    amount: pricing.total,
    price: pricing.total,
    currency: "AED",
    notes: clean(input.notes) || null,
    status,
    created_at: createdAt,
    updated_at: createdAt,
    status_history: [{ status, date: createdAt, note: "Created from DAY NIGHT admin merchant operations hub" }],
  });

  const { data, error } = await supabase.rpc("admin_create_coupon_order", { p_order: payload });
  if (error) throw new Error(error.message);
  const returned = (Array.isArray(data) ? data[0] : data) as Order | null;
  if (!returned?.id) throw new Error("admin_order_creation_returned_no_row");

  const { data: saved, error: readError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", returned.id)
    .single();
  if (readError || !saved) throw new Error(readError?.message || "saved_order_verification_failed");
  if (clean(saved.merchant_id) !== clean(merchant.id)) {
    throw new Error("saved_order_merchant_portal_link_mismatch");
  }
  return saved as Order;
}

`;

  source = replaceOnce(
    source,
    /export async function createAdminOrder\([\s\S]*?\n}\n\n(?=export type AdminStats)/,
    safeCreate,
    "safe admin order creation",
  );

  source = source.replace(
    'if (!supabase) return { rows: [], count: 0, page, pageSize, totalPages: 0, source: "fallback", warning: "Supabase is not configured." };',
    'if (!supabase) throw new Error("Supabase is not configured.");',
  );
  source = source.replace(
    /if \(error\) \{\n    console\.warn\("Failed to fetch paginated admin orders:", error\.message\);\n    return \{ rows: \[\], count: 0, page, pageSize, totalPages: 0, source: "fallback", warning: "Orders could not be loaded safely right now\." \};\n  \}/,
    'if (error) {\n    throw new Error(`Orders could not be loaded safely: ${error.message}`);\n  }',
  );
  source = source.replace(
    'query = query.or(`tracking_number.ilike.%${term}%,invoice_number.ilike.%${term}%,receiver_phone.ilike.%${term}%,receiver_name.ilike.%${term}%`);',
    'query = query.or(`coupon_number.ilike.%${term}%,tracking_number.ilike.%${term}%,invoice_number.ilike.%${term}%,receiver_phone.ilike.%${term}%,receiver_name.ilike.%${term}%,merchant_code.ilike.%${term}%,merchant_name.ilike.%${term}%`);',
  );
  source = source.replace(
    'console.warn("Failed to fetch merchants:", error.message);\n    return [];',
    'throw new Error(`Merchants could not be loaded safely: ${error.message}`);',
  );

  assertIncludes(source, "saved_order_merchant_portal_link_mismatch", "post-save ownership verification");
  if (source.includes("buildLegacyAdminOrderPayload")) throw new Error("Legacy direct insert fallback still exists");
  write(adminDataPath, source);
}

function patchMerchantPortal() {
  let source = read(merchantPortalPath);

  if (source.includes("async function queryMerchantsBy")) {
    source = replaceOnce(
      source,
      /async function queryMerchantsBy[\s\S]*?\n(?=export default function MerchantPortal)/,
      "",
      "merchant portal name/code fallback helpers removal",
    );
  }

  const safeLoad = `  const loadMerchantData = useCallback(async (_activeUser: User) => {
    if (!supabase) return;
    setDataLoading(true);
    setDataError("");
    const client = supabase;

    try {
      let profileRpc = await client.rpc("merchant_get_session_profile");
      if (profileRpc.error) throw new Error(profileRpc.error.message);
      let profilePayload = profileRpc.data as { merchants?: MerchantRecord[] } | null;
      let resolvedMerchants = Array.isArray(profilePayload?.merchants) ? profilePayload.merchants : [];

      if (!resolvedMerchants.length) {
        const claim = await client.rpc("merchant_claim_approved_account");
        if (claim.error) throw new Error(claim.error.message);
        profileRpc = await client.rpc("merchant_get_session_profile");
        if (profileRpc.error) throw new Error(profileRpc.error.message);
        profilePayload = profileRpc.data as { merchants?: MerchantRecord[] } | null;
        resolvedMerchants = Array.isArray(profilePayload?.merchants) ? profilePayload.merchants : [];
      }

      resolvedMerchants = dedupeRows(resolvedMerchants, "merchant");
      if (resolvedMerchants.length !== 1) {
        throw new Error(resolvedMerchants.length === 0
          ? "merchant_profile_not_found"
          : "merchant_identity_ambiguous_contact_support");
      }

      const resolvedOrders: MerchantOrder[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const ordersRpc = await client.rpc("merchant_portal_orders_page", {
          p_page: page,
          p_page_size: 100,
          p_search: null,
          p_status: null,
        });
        if (ordersRpc.error) throw new Error(ordersRpc.error.message);
        const payload = ordersRpc.data as {
          merchant_id?: string;
          page?: number;
          total_pages?: number;
          orders?: MerchantOrder[];
        } | null;
        if (clean(payload?.merchant_id) !== clean(resolvedMerchants[0]?.id)) {
          throw new Error("merchant_portal_uuid_resolution_mismatch");
        }
        if (Array.isArray(payload?.orders)) resolvedOrders.push(...payload.orders);
        totalPages = Math.max(0, Number(payload?.total_pages || 0));
        page += 1;
      } while (page <= totalPages);

      setMerchants(resolvedMerchants);
      setOrders(
        dedupeRows(resolvedOrders, "order").sort(
          (a, b) => new Date(b.created_at || b.updated_at || 0).getTime()
            - new Date(a.created_at || a.updated_at || 0).getTime(),
        ),
      );
    } catch (error) {
      // Preserve the last successful rows. A load failure must never become a false empty success.
      setDataError(portalErrorMessage(error, isArabic));
    } finally {
      setDataLoading(false);
    }
  }, [isArabic]);

`;

  source = replaceOnce(
    source,
    /  const loadMerchantData = useCallback\([\s\S]*?\n  }, \[isArabic\]\);\n\n(?=  useEffect\(\(\) => \{\n    if \(user\))/,
    safeLoad,
    "exact UUID paginated merchant portal load",
  );

  assertIncludes(source, 'client.rpc("merchant_portal_orders_page"', "paginated exact UUID portal RPC");
  if (source.includes("directOrderLookup") || source.includes("queryOrdersBy")) {
    throw new Error("Merchant portal name/code ownership fallback still exists");
  }
  write(merchantPortalPath, source);
}

patchAdminData();
patchMerchantPortal();
console.log("Global merchant ownership source hardening applied.");
