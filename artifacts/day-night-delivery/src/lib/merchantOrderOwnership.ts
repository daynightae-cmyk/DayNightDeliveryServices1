import { supabase } from "../supabase";
import type { Merchant } from "../types";

export type CanonicalMerchantResolution = {
  merchant: Merchant;
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  portalUserId: string | null;
  portalLinkCount: number;
  resolutionSource: "selected_canonical" | "resolved_canonical";
};

type MerchantPortalResolution = {
  ok?: boolean;
  selected_merchant_id?: string;
  canonical_merchant_id?: string;
  canonicalized?: boolean;
  portal_link_count?: number;
  merchant?: Merchant;
  ownership_rule?: string;
};

const clean = (value: unknown) => String(value ?? "").trim();

function errorDetail(error: unknown) {
  const record = error as {
    message?: string;
    details?: string;
    hint?: string;
    dbDetail?: string;
  };
  return [record?.dbDetail, record?.message, record?.details, record?.hint]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" | ");
}

function merchantPortalLinkError(error: unknown, merchant: Merchant) {
  const detail = errorDetail(error);
  const normalized = detail.toLowerCase();
  const label = clean(merchant?.trade_name || merchant?.merchant_code) || "غير محدد";
  let message = detail;

  if (normalized.includes("merchant_portal_account_not_linked")) {
    message = `التاجر «${label}» غير مرتبط بحساب دخول صالح في بوابة التاجر. لم يتم حفظ الطلب حتى لا يختفي من حساب التاجر. اربط حساب التاجر أولًا ثم أعد المحاولة.`;
  } else if (normalized.includes("merchant_portal_link_ambiguous")) {
    message = `يوجد أكثر من حساب بوابة مطابق للتاجر «${label}». لم يتم حفظ الطلب. وحّد سجل التاجر واربط الحساب القانوني الصحيح.`;
  } else if (normalized.includes("merchant_inactive_for_order")) {
    message = `حساب التاجر «${label}» غير نشط ولا يمكن إنشاء طلب عليه.`;
  }

  const wrapped = new Error(
    message ||
      "تعذر ربط الطلب بالتاجر المحدد بشكل آمن، ولذلك لم يتم حفظ الطلب. راجع ربط حساب التاجر ثم أعد المحاولة.",
  ) as Error & { code?: string; dbDetail?: string };
  wrapped.name = "MerchantPortalLinkError";
  wrapped.code = "merchant_portal_link_required";
  wrapped.dbDetail = detail;
  return wrapped;
}

/**
 * The only client-side resolver allowed for registered merchant orders.
 * Authorization still remains in the database through exact UUID RLS.
 */
export async function resolveCanonicalMerchantForOrder(
  selectedMerchant: Merchant,
): Promise<CanonicalMerchantResolution> {
  if (!supabase || !selectedMerchant?.id) {
    throw merchantPortalLinkError(null, selectedMerchant);
  }

  const { data, error } = await supabase.rpc("admin_resolve_order_merchant", {
    p_merchant_id: selectedMerchant.id,
  });
  if (error) throw merchantPortalLinkError(error, selectedMerchant);

  const value = (Array.isArray(data) ? data[0] : data) as MerchantPortalResolution | null;
  const merchant = value?.merchant;
  const portalLinkCount = Number(value?.portal_link_count || 0);
  if (!value?.ok || !merchant?.id || portalLinkCount !== 1) {
    throw merchantPortalLinkError(null, selectedMerchant);
  }

  const merchantName = clean(merchant.trade_name);
  const merchantCode = clean(merchant.merchant_code);
  if (!merchantName || !merchantCode) {
    throw merchantPortalLinkError(
      new Error("canonical_merchant_identity_incomplete"),
      selectedMerchant,
    );
  }

  const record = merchant as Merchant & { user_id?: string | null };
  return {
    merchant,
    merchantId: merchant.id,
    merchantCode,
    merchantName,
    portalUserId: clean(record.user_id) || null,
    portalLinkCount,
    resolutionSource: value.canonicalized
      ? "resolved_canonical"
      : "selected_canonical",
  };
}

export async function resolveOrderMerchant(merchant: Merchant): Promise<Merchant> {
  return (await resolveCanonicalMerchantForOrder(merchant)).merchant;
}
