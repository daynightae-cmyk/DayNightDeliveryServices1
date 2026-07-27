import { supabase } from "../supabase";

export type RatingParty = "customer" | "merchant" | "driver";

export type RatingTargets = {
  company?: boolean;
  driver?: boolean;
  merchant?: boolean;
  customer?: boolean;
};

export type MultiPartyRatingContext = {
  ok: boolean;
  tracking_number: string;
  order_status?: string;
  can_submit?: boolean;
  delivered_at?: string | null;
  service_type?: string | null;
  driver_name?: string | null;
  merchant_name?: string | null;
  customer_name?: string | null;
  masked_phone?: string | null;
  locale?: "ar" | "en";
  rater_type: RatingParty;
  targets?: RatingTargets;
  already_submitted?: boolean;
  expires_at?: string | null;
};

export type MultiPartyRatingSubmission = {
  overallRating: number;
  companyRating?: number;
  driverRating?: number;
  merchantRating?: number;
  customerCooperationRating?: number;
  punctualityRating?: number;
  communicationRating?: number;
  professionalismRating?: number;
  packageCareRating?: number;
  trackingExperienceRating?: number;
  selectedTags?: string[];
  comment?: string;
  allowPublicDisplay?: boolean;
  requestContact?: boolean;
};

function requireSupabase() {
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

function unwrap<T>(value: unknown): T {
  return (Array.isArray(value) ? value[0] : value) as T;
}

export function ratingTokenFromPath() {
  const match = window.location.pathname.match(/^\/(?:feedback|rate)\/([^/]+)/i);
  return decodeURIComponent(match?.[1] || "");
}

export async function loadMultiPartyRatingContext(token: string): Promise<MultiPartyRatingContext> {
  const client = requireSupabase();
  const cleanToken = String(token || "").trim();
  if (!cleanToken) throw new Error("invalid_feedback_token");
  const { data, error } = await client.rpc("get_experience_rating_context", { p_token: cleanToken });
  if (error) throw error;
  const context = unwrap<MultiPartyRatingContext>(data);
  if (!context?.ok) throw new Error("feedback_token_invalid_or_expired");
  return {
    ...context,
    rater_type: context.rater_type || "customer",
    targets: context.targets || { company: true, driver: true },
  };
}

export async function submitMultiPartyRating(token: string, input: MultiPartyRatingSubmission) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("submit_experience_rating", {
    p_token: token,
    p_overall_rating: input.overallRating,
    p_company_rating: input.companyRating || null,
    p_driver_rating: input.driverRating || null,
    p_merchant_rating: input.merchantRating || null,
    p_customer_cooperation_rating: input.customerCooperationRating || null,
    p_punctuality_rating: input.punctualityRating || null,
    p_communication_rating: input.communicationRating || null,
    p_professionalism_rating: input.professionalismRating || null,
    p_package_care_rating: input.packageCareRating || null,
    p_tracking_experience_rating: input.trackingExperienceRating || null,
    p_selected_tags: input.selectedTags || [],
    p_comment: input.comment?.trim() || null,
    p_allow_public_display: Boolean(input.allowPublicDisplay),
    p_request_contact: Boolean(input.requestContact),
  });
  if (error) throw error;
  return unwrap<any>(data);
}

export async function createMultiPartyRatingLink(
  orderId: string,
  raterType: RatingParty,
  locale: "ar" | "en" = "ar",
) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_experience_rating_token_for_order", {
    p_order_id: orderId,
    p_rater_type: raterType,
    p_locale: locale,
  });
  if (error) throw error;
  const row = unwrap<any>(data);
  const url = String(row?.url || "").trim();
  if (!url) throw new Error("rating_link_not_created");
  return { ...row, url } as { url: string; token?: string; rater_type?: RatingParty; expires_at?: string };
}
