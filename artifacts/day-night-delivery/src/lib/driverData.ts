import { supabase } from "../supabase";
import type {
  DriverLocation,
  DriverProfile,
  DriverSessionPayload,
  ProfileRole,
} from "../types/driver";

function requireClient() {
  if (!supabase) throw new Error("Supabase client is not configured.");
  return supabase;
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return String(error || "Unknown driver operation error");
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
    if (payload?.profile && payload?.driver) return payload;
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
    .eq("user_id", user.id)
    .maybeSingle();
  if (driverError) throw new Error(`Driver operational profile access failed: ${driverError.message}`);

  return {
    profile: profile as ProfileRole,
    driver: driverRow as DriverProfile,
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

export async function assignDriverToOrder(orderId: string, driverId: string, note?: string) {
  const client = requireClient();
  const { error } = await client.rpc("admin_assign_driver", {
    p_order_id: orderId,
    p_driver_id: driverId,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
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
  note?: string | null;
};

export async function updateAdminDriverProfile(input: AdminDriverProfileInput) {
  const client = requireClient();
  const { error } = await client.rpc("admin_update_driver_profile", {
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

export function driverErrorMessage(error: unknown, isArabic: boolean) {
  const raw = messageOf(error);
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
