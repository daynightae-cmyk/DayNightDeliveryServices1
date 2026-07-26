import { supabase } from "../supabase";
import { isAdminUser } from "../supabaseAdminOps";

export type AdminSensitiveAction =
  | "delete_order"
  | "change_salary"
  | "create_employee"
  | "modify_payroll"
  | "void_payroll_entry"
  | "modify_bank_details"
  | "change_permissions"
  | "export_sensitive_data"
  | string;

export type AdminStepUpRequest = {
  requestId: string;
  action: AdminSensitiveAction;
  userId: string;
  requiresMfa: boolean;
  currentLevel: string;
  nextLevel: string;
  resolve: () => void;
  reject: (reason: Error) => void;
};

declare global {
  interface WindowEventMap {
    "daynight-admin-step-up-required": CustomEvent<AdminStepUpRequest>;
  }
}

const RECENT_AUTH_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
const STORAGE_PREFIX = "dn-admin-step-up:";

function recentKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function markAdminStepUp(userId: string) {
  window.sessionStorage.setItem(recentKey(userId), String(Date.now()));
}

export function clearAdminStepUp(userId?: string) {
  if (userId) {
    window.sessionStorage.removeItem(recentKey(userId));
    return;
  }
  Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => window.sessionStorage.removeItem(key));
}

export function hasRecentAdminStepUp(userId: string) {
  const value = Number(window.sessionStorage.getItem(recentKey(userId)) || 0);
  return Number.isFinite(value) && value > 0 && Date.now() - value <= RECENT_AUTH_MS;
}

export async function requireAdminStepUp(action: AdminSensitiveAction): Promise<void> {
  if (!supabase) throw new Error("supabase_unavailable");
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.id) throw new Error("admin_session_required");
  if (!(await isAdminUser(user.id))) throw new Error("admin_role_required");

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw new Error(assurance.error.message || "aal_check_failed");
  const currentLevel = assurance.data.currentLevel || "aal1";
  const nextLevel = assurance.data.nextLevel || currentLevel;
  const requiresMfa = nextLevel === "aal2" && currentLevel !== "aal2";

  if (!requiresMfa && hasRecentAdminStepUp(user.id)) return;

  await new Promise<void>((resolve, reject) => {
    const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dn-step-up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("admin_step_up_timeout"));
    }, REQUEST_TIMEOUT_MS);

    const settleSuccess = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      markAdminStepUp(user.id);
      resolve();
    };
    const settleFailure = (reason: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(reason);
    };

    window.dispatchEvent(new CustomEvent("daynight-admin-step-up-required", {
      detail: {
        requestId,
        action,
        userId: user.id,
        requiresMfa,
        currentLevel,
        nextLevel,
        resolve: settleSuccess,
        reject: settleFailure,
      },
    }));
  });

  const verified = await supabase.auth.getUser();
  if (verified.error || verified.data.user?.id !== user.id || !(await isAdminUser(user.id))) {
    clearAdminStepUp(user.id);
    throw new Error("admin_step_up_identity_changed");
  }

  const afterAssurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nextLevel === "aal2" && afterAssurance.data.currentLevel !== "aal2") {
    clearAdminStepUp(user.id);
    throw new Error("admin_mfa_required");
  }
}
