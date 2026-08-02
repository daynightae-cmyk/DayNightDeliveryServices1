import { supabase } from "../supabase";
import type { Merchant, Order } from "../types";

export type CanonicalMerchantResolution = {
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  portalUserIds: string[];
  portalReady: boolean;
  actualPortalLinkCount: number;
  resolutionSource: string;
  merchant: Merchant;
};

type ResolverPayload = {
  ok?: boolean;
  canonical_merchant_id?: unknown;
  portal_user_ids?: unknown;
  portal_link_count?: unknown;
  actual_portal_link_count?: unknown;
  portal_ready?: unknown;
  order_write_allowed?: unknown;
  resolution_source?: unknown;
  merchant?: unknown;
};

const SAFE_LINK_MESSAGE =
  "تعذر اعتماد التاجر المحدد لإنشاء الطلب. تأكد أن التاجر موجود ونشط ثم أعد المحاولة.";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function detail(error: unknown) {
  if (!error || typeof error !== "object") return clean(error);
  const row = error as Record<string, unknown>;
  return [row.message, row.details, row.hint, row.code].map(clean).filter(Boolean).join(" | ");
}

export class MerchantOwnershipError extends Error {
  code = "merchant_ownership_unresolved";

  constructor(cause?: unknown) {
    const evidence = detail(cause);
    super(evidence ? `${SAFE_LINK_MESSAGE} (${evidence})` : SAFE_LINK_MESSAGE);
    this.name = "MerchantOwnershipError";
  }
}

/**
 * Resolve the exact active merchant selected by an authorized administrator.
 *
 * Portal readiness is metadata only. It must never block an admin order write:
 * merchant portal visibility is enforced independently by merchant_session_id and
 * effective merchant-user links in the database.
 */
export async function resolveCanonicalMerchantForOrder(
  selectedMerchant: Merchant | null | undefined,
): Promise<CanonicalMerchantResolution> {
  const selectedId = clean(selectedMerchant?.id);
  if (!supabase || !selectedId) throw new MerchantOwnershipError("merchant_required");

  const { data, error } = await supabase.rpc("admin_resolve_order_merchant", {
    p_merchant_id: selectedId,
  });
  if (error) throw new MerchantOwnershipError(error);

  const payload = (Array.isArray(data) ? data[0] : data) as ResolverPayload | null;
  const merchant = payload?.merchant as Merchant | null | undefined;
  const merchantId = clean(payload?.canonical_merchant_id || merchant?.id);
  const merchantCode = clean(merchant?.merchant_code);
  const merchantName = clean(merchant?.trade_name);
  const portalUserIds = Array.isArray(payload?.portal_user_ids)
    ? payload.portal_user_ids.map(clean).filter(Boolean)
    : [];
  const actualPortalLinkCount = Number(
    payload?.actual_portal_link_count ?? portalUserIds.length ?? 0,
  );
  const portalReady =
    typeof payload?.portal_ready === "boolean"
      ? payload.portal_ready
      : actualPortalLinkCount > 0;
  const orderWriteAllowed = payload?.order_write_allowed !== false;

  if (
    !payload?.ok ||
    !orderWriteAllowed ||
    !merchant ||
    !merchantId ||
    merchantId !== clean(merchant.id) ||
    merchantId !== selectedId
  ) {
    throw new MerchantOwnershipError("active_selected_merchant_not_resolved");
  }

  return {
    merchantId,
    merchantCode,
    merchantName,
    portalUserIds,
    portalReady,
    actualPortalLinkCount: Number.isFinite(actualPortalLinkCount)
      ? Math.max(0, actualPortalLinkCount)
      : 0,
    resolutionSource: clean(payload.resolution_source) || "database_admin_order_resolver",
    merchant,
  };
}

/** Re-read the committed row and fail closed if ownership differs. */
export async function verifySavedOrderMerchant(
  savedOrder: Pick<Order, "id" | "merchant_id">,
  expectedMerchantId: string,
): Promise<Order> {
  const orderId = clean(savedOrder.id);
  const canonicalId = clean(expectedMerchantId);
  if (!supabase || !orderId || !canonicalId) {
    throw new MerchantOwnershipError("saved_order_verification_input_missing");
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data || clean(data.merchant_id) !== canonicalId) {
    throw new MerchantOwnershipError(error || "saved_order_merchant_id_mismatch");
  }

  return data as Order;
}

export const MERCHANT_OWNERSHIP_SAFE_ERROR_AR = SAFE_LINK_MESSAGE;
