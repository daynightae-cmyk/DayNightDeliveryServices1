import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { fetchDriverSession } from "./driverData";

export type NativeBiometricRole = "driver" | "merchant";

export type NativeBiometricAvailability = {
  available: boolean;
  enrolled: boolean;
  deviceCredentialAvailable: boolean;
  biometricType?: "fingerprint" | "face" | "biometric";
  reason?: string;
};

export type NativeBiometricResult = {
  success: boolean;
  error?: string;
  cancelled?: boolean;
  enrolled?: boolean;
  refreshToken?: string;
  userId?: string;
  expectedRole?: string;
  createdAt?: number;
};

type NativeBridge = {
  isAvailable(requestId: string): void;
  hasEnrollment(requestId: string): void;
  enableForCurrentSession(requestId: string, inputJson: string): void;
  authenticate(requestId: string, inputJson: string): void;
  disable(requestId: string): void;
  cancel(requestId: string): void;
};

declare global {
  interface Window {
    DAYNIGHT_BIOMETRIC?: NativeBridge;
    __DAY_NIGHT_NATIVE_ROLE__?: string;
    __dayNightBiometricNativeResolve?: (requestId: string, resultJson: string) => void;
  }
}

const REQUEST_TIMEOUT_MS = 45_000;
const pending = new Map<
  string,
  {
    resolve: (value: NativeBiometricResult & NativeBiometricAvailability) => void;
    reject: (reason: Error) => void;
    timeout: number;
  }
>();

export const NATIVE_BIOMETRIC_POLICY = {
  driver: { maximumBackgroundMs: 24 * 60 * 60 * 1000 },
  merchant: { maximumBackgroundMs: 12 * 60 * 60 * 1000 },
} as const;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function rowsFrom(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>> : [];
}

function safeParse(resultJson: string) {
  try {
    return JSON.parse(resultJson) as NativeBiometricResult & NativeBiometricAvailability;
  } catch {
    return { success: false, available: false, enrolled: false, deviceCredentialAvailable: false, error: "invalid_native_response" };
  }
}

if (typeof window !== "undefined") {
  window.__dayNightBiometricNativeResolve = (requestId, resultJson) => {
    const request = pending.get(requestId);
    if (!request) return;
    window.clearTimeout(request.timeout);
    pending.delete(requestId);
    request.resolve(safeParse(resultJson));
  };
}

function bridgeCall(
  method: keyof NativeBridge,
  payload?: Record<string, unknown>,
): Promise<NativeBiometricResult & NativeBiometricAvailability> {
  if (typeof window === "undefined" || !window.DAYNIGHT_BIOMETRIC) {
    return Promise.resolve({
      success: false,
      available: false,
      enrolled: false,
      deviceCredentialAvailable: false,
      error: "native_bridge_unavailable",
    });
  }

  const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `dn-bio-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("native_biometric_timeout"));
    }, REQUEST_TIMEOUT_MS);
    pending.set(requestId, { resolve, reject, timeout });

    try {
      const bridge = window.DAYNIGHT_BIOMETRIC!;
      if (method === "enableForCurrentSession" || method === "authenticate") {
        bridge[method](requestId, JSON.stringify(payload || {}));
      } else {
        bridge[method](requestId);
      }
    } catch {
      window.clearTimeout(timeout);
      pending.delete(requestId);
      resolve({
        success: false,
        available: false,
        enrolled: false,
        deviceCredentialAvailable: false,
        error: "native_bridge_call_failed",
      });
    }
  });
}

export function isNativeRoleShell(role?: NativeBiometricRole) {
  if (typeof window === "undefined") return false;
  const nativeRole = clean(window.__DAY_NIGHT_NATIVE_ROLE__ || new URLSearchParams(window.location.search).get("nativeShell"));
  return Boolean(window.DAYNIGHT_BIOMETRIC) && (!role || nativeRole === role);
}

export async function getNativeBiometricAvailability() {
  const result = await bridgeCall("isAvailable");
  return {
    available: Boolean(result.available),
    enrolled: Boolean(result.enrolled),
    deviceCredentialAvailable: Boolean(result.deviceCredentialAvailable),
    biometricType: result.biometricType,
    reason: result.reason || result.error,
  } satisfies NativeBiometricAvailability;
}

export async function hasNativeBiometricEnrollment() {
  const result = await bridgeCall("hasEnrollment");
  return Boolean(result.success && result.enrolled);
}

export async function recordAuthSecurityEvent(
  eventType:
    | "passkey_registered"
    | "passkey_removed"
    | "biometric_enabled"
    | "biometric_disabled"
    | "biometric_login_success"
    | "biometric_login_failed"
    | "biometric_session_revoked",
  input: { role?: string; packageId?: string; success?: boolean; reason?: string } = {},
) {
  if (!supabase) return;
  try {
    await supabase.rpc("record_auth_security_event", {
      p_event_type: eventType,
      p_role: clean(input.role) || null,
      p_package_id: clean(input.packageId) || null,
      p_success: input.success !== false,
      p_reason: clean(input.reason).slice(0, 180) || null,
    });
  } catch {
    // Audit telemetry must never block login or expose a session in logs.
  }
}

export async function validateNativeRole(
  role: NativeBiometricRole,
  expectedUserId?: string,
): Promise<{ valid: boolean; user: User | null; displayName?: string; reason?: string }> {
  if (!supabase) return { valid: false, user: null, reason: "supabase_unavailable" };

  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;
  if (userResult.error || !user?.id) return { valid: false, user: null, reason: "session_user_missing" };
  if (expectedUserId && user.id !== expectedUserId) {
    return { valid: false, user, reason: "account_binding_mismatch" };
  }

  if (role === "driver") {
    try {
      const payload = await fetchDriverSession();
      const profileRole = clean(payload?.profile?.role).toLowerCase();
      const driverStatus = clean(payload?.driver?.status || "active").toLowerCase();
      const valid = profileRole === "driver" && Boolean(payload?.driver?.id) && driverStatus === "active";
      return {
        valid,
        user,
        displayName: clean(payload?.driver?.full_name || payload?.profile?.full_name || user.email),
        reason: valid ? undefined : "driver_role_or_status_invalid",
      };
    } catch {
      return { valid: false, user, reason: "driver_validation_failed" };
    }
  }

  try {
    const result = await supabase.rpc("merchant_get_session_profile");
    if (result.error) return { valid: false, user, reason: "merchant_validation_failed" };
    const response = recordFrom(result.data);
    const merchants = rowsFrom(response.merchants);
    const merchant = merchants[0];
    const status = clean(merchant?.status || "active").toLowerCase();
    const access = clean(merchant?.portal_access_status || "active").toLowerCase();
    const valid = Boolean(merchant?.id) && status === "active" && !["blocked", "suspended", "disabled", "revoked"].includes(access);
    return {
      valid,
      user,
      displayName: clean(merchant?.trade_name || merchant?.owner_name || user.email),
      reason: valid ? undefined : "merchant_role_or_status_invalid",
    };
  } catch {
    return { valid: false, user, reason: "merchant_validation_failed" };
  }
}

export async function enableNativeBiometric(role: NativeBiometricRole, isArabic: boolean) {
  if (!supabase || !isNativeRoleShell(role)) {
    return { success: false, error: "native_bridge_unavailable" } satisfies NativeBiometricResult;
  }

  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;
  const validation = await validateNativeRole(role, session?.user?.id);
  if (!session?.refresh_token || !validation.valid || !validation.user?.id) {
    return { success: false, error: validation.reason || "verified_session_required" } satisfies NativeBiometricResult;
  }

  const result = await bridgeCall("enableForCurrentSession", {
    refreshToken: session.refresh_token,
    userId: validation.user.id,
    expectedRole: role,
    isArabic,
  });
  await recordAuthSecurityEvent(result.success ? "biometric_enabled" : "biometric_login_failed", {
    role,
    packageId: role === "driver" ? "com.daynightae.driver" : "com.daynightae.merchant",
    success: result.success,
    reason: result.error,
  });
  return result;
}

export async function restoreNativeBiometricSession(role: NativeBiometricRole, isArabic: boolean) {
  if (!supabase || !isNativeRoleShell(role)) {
    return { success: false, error: "native_bridge_unavailable" } satisfies NativeBiometricResult;
  }

  const result = await bridgeCall("authenticate", { isArabic });
  if (!result.success || !result.refreshToken || !result.userId || result.expectedRole !== role) {
    await recordAuthSecurityEvent("biometric_login_failed", {
      role,
      packageId: role === "driver" ? "com.daynightae.driver" : "com.daynightae.merchant",
      success: false,
      reason: result.error || "invalid_native_payload",
    });
    return result;
  }

  try {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: result.refreshToken });
    if (refreshed.error || !refreshed.data.session?.user?.id) throw new Error("refresh_token_invalid");
    const validation = await validateNativeRole(role, result.userId);
    if (!validation.valid || validation.user?.id !== result.userId) {
      throw new Error(validation.reason || "role_validation_failed");
    }
    await recordAuthSecurityEvent("biometric_login_success", {
      role,
      packageId: role === "driver" ? "com.daynightae.driver" : "com.daynightae.merchant",
      success: true,
    });
    return { success: true, userId: result.userId, expectedRole: role } satisfies NativeBiometricResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "secure_session_restore_failed";
    await disableNativeBiometric(role, "biometric_session_revoked", reason);
    await supabase.auth.signOut({ scope: "local" });
    return { success: false, error: reason } satisfies NativeBiometricResult;
  }
}

export async function disableNativeBiometric(
  role: NativeBiometricRole,
  eventType: "biometric_disabled" | "biometric_session_revoked" = "biometric_disabled",
  reason?: string,
) {
  const result = await bridgeCall("disable");
  await recordAuthSecurityEvent(eventType, {
    role,
    packageId: role === "driver" ? "com.daynightae.driver" : "com.daynightae.merchant",
    success: result.success,
    reason,
  });
  return result;
}

export async function cancelNativeBiometric() {
  return bridgeCall("cancel");
}
