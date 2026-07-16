import { supabase } from "../supabase";
import type {
  DriverDispatchAction,
  DriverDispatchResult,
  DriverLocation,
  DriverProfile,
  DriverSessionPayload,
  ProfileRole,
} from "../types/driver";

const DRIVER_AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function requireClient() {
  if (!supabase) throw new Error("Supabase client is not configured.");
  return supabase;
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return String(error || "Unknown driver operation error");
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function resolveDriverAvatarUrl(profile: DriverProfile): Promise<DriverProfile> {
  if (profile.avatar_url) return profile;
  if (!profile.avatar_path) return profile;
  const client = requireClient();
  const { data, error } = await client.storage.from(DRIVER_AVATAR_BUCKET).createSignedUrl(profile.avatar_path, 60 * 60);
  if (error || !data?.signedUrl) return profile;
  return { ...profile, avatar_url: data.signedUrl };
}

export async function resolveDriverAvatarUrls(profiles: DriverProfile[]) {
  return Promise.all(profiles.map((profile) => resolveDriverAvatarUrl(profile)));
}

export async function uploadDriverAvatarFile(ownerId: string, file: File) {
  if (!ownerId) throw new Error("Driver owner id is required.");
  if (!AVATAR_TYPES.has(file.type)) throw new Error("Avatar must be JPG, PNG or WebP.");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Avatar image must be 5 MB or smaller.");

  const client = requireClient();
  const path = `${ownerId}/driver-avatar.${extensionFor(file)}`;
  const { error } = await client.storage.from(DRIVER_AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function fetchDriverSession(): Promise<DriverSessionPayload | null> {
  const client = requireClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data: rpcData, error: rpcError } = await client.rpc("driver_get_session_profile");
  if (!rpcError && rpcData) {
    const payload = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as DriverSessionPayload | null;
    if (payload?.profile && payload?.driver) {
      return { ...payload, driver: await resolveDriverAvatarUrl(payload.driver) };
    }
  }

  const { data: profileRow, error: profileError } = await client
    .from("profiles")
    .select("id, role, full_name, phone, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Driver profile access failed: ${profileError.message}`);

  const profile = profileRow as ProfileRole | null;
  if (String(profile?.role || "").toLowerCase() !== "driver") {
    return profile ? { profile, driver: null as unknown as DriverProfile } : null;
  }

  const { data: driverRow, error: driverError } = await client
    .from("driver_profiles")
    .select("*")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();
  if (driverError) throw new Error(`Driver operational profile access failed: ${driverError.message}`);
  if (!driverRow) throw new Error("driver_setup_required: operational driver profile missing");

  return {
    profile: profile as ProfileRole,
    driver: await resolveDriverAvatarUrl(driverRow as DriverProfile),
  };
}

export type DriverLocationReport = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  currentOrderId?: string | null;
  batteryLevel?: number | null;
  networkState?: string | null;
};

export async function reportDriverLocation(report: DriverLocationReport) {
  const client = requireClient();
  const { error } = await client.rpc("driver_report_location", {
    p_lat: report.latitude,
    p_lng: report.longitude,
    p_accuracy: report.accuracy ?? null,
    p_heading: report.heading ?? null,
    p_speed: report.speed ?? null,
    p_altitude: report.altitude ?? null,
    p_current_order_id: report.currentOrderId ?? null,
    p_battery_level: report.batteryLevel ?? null,
    p_network_state: report.networkState ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function setDriverPresence(online: boolean, shiftStatus: string, note?: string) {
  const client = requireClient();
  const { error } = await client.rpc("driver_set_presence", {
    p_online: online,
    p_shift_status: shiftStatus,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
}

export async function updateDriverOrderStatus(orderId: string, status: string, note?: string) {
  const client = requireClient();
  const { error } = await client.rpc("driver_update_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
}

export type DriverOwnProfileInput = {
  phone?: string | null;
  emergencyContact?: string | null;
  avatarPath?: string | null;
  bio?: string | null;
  workArea?: string | null;
  address?: string | null;
  preferredLanguage?: string | null;
};

export async function updateDriverOwnProfile(input: DriverOwnProfileInput) {
  const client = requireClient();
  const { error } = await client.rpc("driver_update_own_profile", {
    p_phone: input.phone || null,
    p_emergency_contact: input.emergencyContact || null,
    p_avatar_path: input.avatarPath || null,
    p_bio: input.bio || null,
    p_work_area: input.workArea || null,
    p_address: input.address || null,
    p_preferred_language: input.preferredLanguage || null,
  });
  if (error) throw new Error(error.message);
}

export type DispatchOrderInput = {
  orderId: string;
  driverId?: string | null;
  action: DriverDispatchAction;
  note?: string | null;
  force?: boolean;
};

export async function dispatchOrder(input: DispatchOrderInput): Promise<DriverDispatchResult> {
  const client = requireClient();
  const { data, error } = await client.rpc("admin_dispatch_order", {
    p_order_id: input.orderId,
    p_driver_id: input.driverId || null,
    p_action: input.action,
    p_note: input.note || null,
    p_force: Boolean(input.force),
  });
  if (error) throw new Error(error.message);
  const result = (Array.isArray(data) ? data[0] : data) as DriverDispatchResult | null;
  if (!result?.ok) throw new Error("dispatch_operation_failed");
  return result;
}

export async function assignDriverToOrder(orderId: string, driverId: string, note?: string) {
  return dispatchOrder({ orderId, driverId, action: "assign", note });
}

export async function reassignDriverToOrder(
  orderId: string,
  driverId: string,
  note: string,
  force = false,
) {
  return dispatchOrder({ orderId, driverId, action: "reassign", note, force });
}

export async function unassignDriverFromOrder(orderId: string, note: string, force = false) {
  return dispatchOrder({ orderId, action: "unassign", note, force });
}

export type AdminDriverProfileInput = {
  driverId: string;
  fullName: string;
  phone?: string | null;
  status: string;
  shiftStatus?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  vehicleColor?: string | null;
  emirate?: string | null;
  licenseNumber?: string | null;
  emergencyContact?: string | null;
  avatarPath?: string | null;
  bio?: string | null;
  workArea?: string | null;
  nationality?: string | null;
  address?: string | null;
  licenseExpiry?: string | null;
  vehicleRegistrationExpiry?: string | null;
  note?: string | null;
};

export async function updateAdminDriverProfile(input: AdminDriverProfileInput) {
  const client = requireClient();
  const { error } = await client.rpc("admin_update_driver_profile_v2", {
    p_driver_id: input.driverId,
    p_full_name: input.fullName,
    p_phone: input.phone || null,
    p_status: input.status,
    p_shift_status: input.shiftStatus || null,
    p_vehicle_type: input.vehicleType || null,
    p_vehicle_plate: input.vehiclePlate || null,
    p_vehicle_color: input.vehicleColor || null,
    p_emirate: input.emirate || null,
    p_license_number: input.licenseNumber || null,
    p_emergency_contact: input.emergencyContact || null,
    p_avatar_path: input.avatarPath || null,
    p_bio: input.bio || null,
    p_work_area: input.workArea || null,
    p_nationality: input.nationality || null,
    p_address: input.address || null,
    p_license_expiry: input.licenseExpiry || null,
    p_vehicle_registration_expiry: input.vehicleRegistrationExpiry || null,
    p_note: input.note || null,
  });
  if (error) throw new Error(error.message);
}

export async function setAdminDriverStatus(driverId: string, status: string, note?: string) {
  const client = requireClient();
  const { error } = await client.rpc("admin_set_driver_status", {
    p_driver_id: driverId,
    p_status: status,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchCurrentDriverLocation(driverId: string): Promise<DriverLocation | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("driver_locations")
    .select("*")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as DriverLocation | null;
}

export function dispatchErrorMessage(error: unknown, isArabic: boolean) {
  const raw = messageOf(error);
  const messages: Array<[RegExp, string, string]> = [
    [/closed_order_cannot_be_dispatched/i, "لا يمكن تعيين طلب مُسلّم أو ملغي أو راجع.", "Closed orders cannot be dispatched."],
    [/reassignment_reason_required/i, "اكتب سبب إعادة التعيين.", "A reassignment reason is required."],
    [/unassignment_reason_required/i, "اكتب سبب إلغاء الإسناد.", "An unassignment reason is required."],
    [/force_required_for_in_progress_reassign/i, "الطلب بدأ تنفيذه؛ فعّل النقل الاضطراري بعد التأكد من استلام المندوب الجديد.", "This order is already in progress. Enable forced transfer after confirming the handoff."],
    [/force_required_for_in_progress_unassign/i, "الطلب بدأ تنفيذه؛ فعّل الإلغاء الاضطراري لإعادته إلى المراجعة.", "This order is already in progress. Enable forced unassignment to return it to review."],
    [/active_driver_not_found/i, "المندوب غير موجود أو حسابه غير نشط.", "The driver does not exist or is inactive."],
    [/order_not_found/i, "الطلب غير موجود في قاعدة البيانات.", "The order was not found."],
    [/not_authorized|permission|row-level security/i, "حساب الإدارة لا يملك صلاحية التوزيع المطلوبة.", "The admin account lacks dispatch permission."],
    [/admin_dispatch_order|schema cache|function .* does not exist/i, "طبّق Migration مركز توزيع الطلبات في Supabase أولاً.", "Apply the order dispatch migration in Supabase first."],
  ];
  const match = messages.find(([pattern]) => pattern.test(raw));
  return match ? (isArabic ? match[1] : match[2]) : raw;
}

export function driverErrorMessage(error: unknown, isArabic: boolean) {
  const raw = messageOf(error);
  if (/permissions policy|disabled in this document/i.test(raw)) {
    return isArabic
      ? "المتصفح منع GPS بسبب سياسة الموقع. حدّث الصفحة بعد اكتمال نشر إعدادات Vercel الجديدة."
      : "The browser blocked GPS through the site permissions policy. Refresh after the new Vercel deployment is ready.";
  }
  if (/driver_setup_required|driver profile/i.test(raw)) {
    return isArabic
      ? "حساب الدخول موجود، لكن ملف تشغيل المندوب غير مكتمل في قاعدة البيانات."
      : "The login account exists, but the operational driver profile is not provisioned.";
  }
  if (/not_authorized|permission|row-level security/i.test(raw)) {
    return isArabic
      ? "صلاحيات حساب المندوب غير مكتملة. يجب تطبيق Migration قسم المندوب النهائي."
      : "Driver permissions are incomplete. Apply the final driver operations migration.";
  }
  return raw;
}
