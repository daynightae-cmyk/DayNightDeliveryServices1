import { supabase } from "../supabase";

export type DeliveryConfirmationEmailResult = {
  ok: boolean;
  orderId: string;
  recipient?: string;
  messageId?: string;
  queued?: boolean;
};

function readError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    return String((payload as { error?: unknown }).error || "delivery_confirmation_failed");
  }
  return "delivery_confirmation_failed";
}

/**
 * Sends or re-sends a delivery summary to the email registered for the
 * authenticated customer. The API validates the Supabase access token and
 * scopes the order through the current user's RLS permissions before sending.
 */
export async function sendDeliveryConfirmationEmail(orderId: string): Promise<DeliveryConfirmationEmailResult> {
  if (!orderId) throw new Error("order_id_required");
  if (!supabase) throw new Error("supabase_unavailable");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("not_authenticated");

  const response = await fetch("/api/delivery-confirmation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(payload));

  return payload as DeliveryConfirmationEmailResult;
}
