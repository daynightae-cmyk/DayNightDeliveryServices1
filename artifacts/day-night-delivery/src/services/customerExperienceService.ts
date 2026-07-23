import { supabase } from "../supabase";

export type FeedbackContext = {
  ok: boolean;
  tracking_number: string;
  delivered_at?: string | null;
  service_type?: string | null;
  driver_name?: string | null;
  merchant_name?: string | null;
  customer_name?: string | null;
  masked_phone?: string | null;
  locale?: "ar" | "en";
  already_submitted?: boolean;
  expires_at?: string | null;
};

export type FeedbackSubmission = {
  overallRating: number;
  driverRating: number;
  companyRating: number;
  punctualityRating: number;
  communicationRating: number;
  professionalismRating: number;
  packageCareRating: number;
  trackingExperienceRating: number;
  selectedTags: string[];
  comment: string;
  allowPublicDisplay: boolean;
  requestContact: boolean;
};

export type ComplaintSubmission = {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  preferredContactTime?: string;
  requestContact: boolean;
};

export type ComplaintCreated = {
  id: string;
  complaint_number: string;
  upload_nonce?: string;
};

export type AdminExperienceSnapshot = {
  feedback: any[];
  complaints: any[];
  messages: any[];
  templates: any[];
  merchants: any[];
};

function requireSupabase() {
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

function unwrapRpc<T>(data: unknown): T {
  const row = Array.isArray(data) ? data[0] : data;
  return row as T;
}

export async function loadFeedbackContext(token: string): Promise<FeedbackContext> {
  const client = requireSupabase();
  const cleanToken = String(token || "").trim();
  if (!cleanToken) throw new Error("invalid_feedback_token");
  const { data, error } = await client.rpc("get_feedback_context", { p_token: cleanToken });
  if (error) throw error;
  const context = unwrapRpc<FeedbackContext>(data);
  if (!context?.ok) throw new Error("feedback_token_invalid_or_expired");
  return context;
}

export async function submitOrderFeedback(token: string, input: FeedbackSubmission) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("submit_order_feedback", {
    p_token: token,
    p_overall_rating: input.overallRating,
    p_driver_rating: input.driverRating,
    p_company_rating: input.companyRating,
    p_punctuality_rating: input.punctualityRating,
    p_communication_rating: input.communicationRating,
    p_professionalism_rating: input.professionalismRating,
    p_package_care_rating: input.packageCareRating,
    p_tracking_experience_rating: input.trackingExperienceRating,
    p_selected_tags: input.selectedTags,
    p_comment: input.comment || null,
    p_allow_public_display: input.allowPublicDisplay,
    p_request_contact: input.requestContact,
  });
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export async function submitPublicComplaint(token: string, input: ComplaintSubmission): Promise<ComplaintCreated> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("submit_public_complaint", {
    p_token: token,
    p_category: input.category,
    p_severity: input.severity,
    p_description: input.description,
    p_preferred_contact_time: input.preferredContactTime || null,
    p_request_contact: input.requestContact,
  });
  if (error) throw error;
  const complaint = unwrapRpc<ComplaintCreated>(data);
  if (!complaint?.id || !complaint.complaint_number) throw new Error("complaint_creation_failed");
  return complaint;
}

export function validateComplaintAttachment(file: File) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!allowed.has(file.type)) throw new Error("unsupported_attachment_type");
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error("attachment_too_large");
}

function safeFilename(name: string) {
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "bin";
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "attachment";
  return `${base}-${Date.now()}.${extension || "bin"}`;
}

export async function uploadComplaintAttachment(complaint: ComplaintCreated, file: File) {
  validateComplaintAttachment(file);
  if (!complaint.upload_nonce) throw new Error("attachment_upload_not_authorized");
  const client = requireSupabase();
  const path = `${complaint.id}/${complaint.upload_nonce}/${safeFilename(file.name)}`;
  const { error } = await client.storage.from("complaint-attachments").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { error: registerError } = await client.rpc("register_complaint_attachment", {
    p_complaint_id: complaint.id,
    p_upload_nonce: complaint.upload_nonce,
    p_storage_path: path,
    p_file_name: file.name,
    p_mime_type: file.type,
    p_file_size: file.size,
  });
  if (registerError) throw registerError;
  return path;
}

export async function loadAdminCustomerExperience(): Promise<AdminExperienceSnapshot> {
  const client = requireSupabase();
  const [feedbackResult, complaintsResult, messagesResult, templatesResult, merchantsResult] = await Promise.all([
    client.rpc("admin_order_feedback_rows"),
    client.from("complaints").select("*").order("created_at", { ascending: false }).limit(500),
    client.from("outbound_message_logs").select("*").order("generated_at", { ascending: false }).limit(500),
    client.from("message_templates").select("*").order("template_key", { ascending: true }),
    client.from("merchants").select("id,merchant_code,trade_name,owner_name,phone,email,status,created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  const firstError = [feedbackResult.error, complaintsResult.error, messagesResult.error, templatesResult.error, merchantsResult.error].find(Boolean);
  if (firstError) throw firstError;
  const feedbackPayload = unwrapRpc<any>(feedbackResult.data);
  return {
    feedback: Array.isArray(feedbackPayload?.feedback) ? feedbackPayload.feedback : [],
    complaints: complaintsResult.data || [],
    messages: messagesResult.data || [],
    templates: templatesResult.data || [],
    merchants: merchantsResult.data || [],
  };
}

export async function loadMerchantOrderFeedback() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("merchant_order_feedback");
  if (error) throw error;
  const payload = unwrapRpc<any>(data);
  return Array.isArray(payload?.feedback) ? payload.feedback : [];
}

export async function loadComplaintDetails(complaintId: string) {
  const client = requireSupabase();
  const complaintResult = await client.from("complaints").select("*").eq("id", complaintId).single();
  if (complaintResult.error) throw complaintResult.error;
  const complaint = complaintResult.data;
  const emptyResult = Promise.resolve({ data: null, error: null });
  const [eventsResult, attachmentsResult, orderResult, driverResult, merchantResult, historyResult, attemptsResult] = await Promise.all([
    client.from("complaint_events").select("*").eq("complaint_id", complaintId).order("created_at", { ascending: true }),
    client.from("complaint_attachments").select("*").eq("complaint_id", complaintId).order("uploaded_at", { ascending: true }),
    client.from("orders").select("*").eq("id", complaint.order_id).maybeSingle(),
    complaint.driver_id ? client.from("driver_profiles").select("*").eq("id", complaint.driver_id).maybeSingle() : emptyResult,
    complaint.merchant_id ? client.from("merchants").select("*").eq("id", complaint.merchant_id).maybeSingle() : emptyResult,
    client.from("order_status_history").select("*").eq("order_id", complaint.order_id).order("created_at", { ascending: true }),
    client.from("order_contact_attempts").select("*").eq("order_id", complaint.order_id).order("created_at", { ascending: true }),
  ]);
  const firstError = [eventsResult.error, attachmentsResult.error, orderResult.error, driverResult.error, merchantResult.error, historyResult.error, attemptsResult.error].find(Boolean);
  if (firstError) throw firstError;
  const attachments = await Promise.all((attachmentsResult.data || []).map(async (attachment: any) => {
    const { data } = await client.storage.from("complaint-attachments").createSignedUrl(attachment.storage_path, 900);
    return { ...attachment, signed_url: data?.signedUrl || "" };
  }));
  return {
    complaint,
    order: orderResult.data || null,
    driver: driverResult.data || null,
    merchant: merchantResult.data || null,
    events: eventsResult.data || [],
    orderHistory: historyResult.data || [],
    contactAttempts: attemptsResult.data || [],
    attachments,
  };
}

export async function updateComplaint(input: { complaintId: string; status?: string; severity?: string; assignedTo?: string | null; resolution?: string | null; note?: string | null }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_update_complaint", {
    p_complaint_id: input.complaintId,
    p_status: input.status || null,
    p_severity: input.severity || null,
    p_assigned_to: input.assignedTo || null,
    p_resolution: input.resolution || null,
    p_note: input.note || null,
  });
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export async function setFeedbackReview(input: { feedbackId: string; reviewStatus: "new" | "reviewed" | "published" | "hidden" | "converted_to_complaint"; allowPublicDisplay?: boolean }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_set_feedback_review", {
    p_feedback_id: input.feedbackId,
    p_review_status: input.reviewStatus,
    p_allow_public_display: input.allowPublicDisplay ?? null,
  });
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export async function convertFeedbackToComplaint(feedbackId: string, severity: "low" | "medium" | "high" | "critical" = "medium") {
  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_create_complaint_from_feedback", { p_feedback_id: feedbackId, p_severity: severity });
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export async function suspendDriverForComplaint(complaintId: string, note: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_suspend_driver_for_complaint", { p_complaint_id: complaintId, p_note: note || null });
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export async function loadDriverFeedbackSummary() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("driver_feedback_summary");
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export async function saveMessageTemplate(input: { id: string; body: string; isActive: boolean }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("admin_update_message_template", {
    p_template_id: input.id,
    p_body: input.body,
    p_is_active: input.isActive,
  });
  if (error) throw error;
  return unwrapRpc<any>(data);
}

export function subscribeCustomerExperience(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client
    .channel(`customer-experience-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_feedback" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "outbound_message_logs" }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
