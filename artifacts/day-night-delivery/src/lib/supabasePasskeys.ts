import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { isAdminUser } from "../supabaseAdminOps";
import { recordAuthSecurityEvent } from "./nativeBiometric";

const EXPECTED_SUPABASE_URL = "https://ngdwybpgacauorygoedi.supabase.co";
const SUPABASE_URL = String((import.meta as any).env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "").trim();

export const SUPABASE_PASSKEYS_ENABLED =
  String((import.meta as any).env?.VITE_ENABLE_SUPABASE_PASSKEYS || "false").toLowerCase() === "true";

let passkeyClient: SupabaseClient | null = null;

function getPasskeyClient() {
  if (!SUPABASE_PASSKEYS_ENABLED) return null;
  if (!SUPABASE_URL || SUPABASE_URL !== EXPECTED_SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!passkeyClient) {
    passkeyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        experimental: { passkey: true },
      },
    } as any);
  }
  return passkeyClient;
}

async function requireCurrentAdminSession() {
  if (!supabase) throw new Error("supabase_unavailable");
  const [{ data: sessionData }, { data: userData, error: userError }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);
  const session = sessionData.session;
  const user = userData.user;
  if (userError || !session?.access_token || !session.refresh_token || !user?.id) {
    throw new Error("admin_session_required");
  }
  if (!(await isAdminUser(user.id))) throw new Error("admin_role_required");
  return { session, user };
}

async function mirrorSessionToPasskeyClient(session: Session) {
  const client = getPasskeyClient();
  if (!client) throw new Error("passkeys_disabled");
  const mirrored = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (mirrored.error || !mirrored.data.session) throw new Error("passkey_session_sync_failed");
  return client;
}

export type AdminPasskeyRecord = {
  id: string;
  friendly_name?: string;
  created_at?: string;
  last_used_at?: string;
};

export async function listAdminPasskeys(): Promise<AdminPasskeyRecord[]> {
  const { session } = await requireCurrentAdminSession();
  const client = await mirrorSessionToPasskeyClient(session);
  const api = (client.auth as any).passkey;
  if (!api?.list) throw new Error("passkey_api_unavailable");
  const { data, error } = await api.list();
  if (error) throw error;
  return Array.isArray(data) ? data : Array.isArray(data?.passkeys) ? data.passkeys : [];
}

export async function registerAdminPasskey() {
  const { session, user } = await requireCurrentAdminSession();
  const client = await mirrorSessionToPasskeyClient(session);
  const register = (client.auth as any).registerPasskey;
  if (typeof register !== "function") throw new Error("passkey_api_unavailable");
  const { data, error } = await register.call(client.auth);
  if (error) {
    await recordAuthSecurityEvent("biometric_login_failed", { role: "admin", success: false, reason: error.code || error.message });
    throw error;
  }
  const verified = await supabase?.auth.getUser();
  if (!verified?.data.user?.id || verified.data.user.id !== user.id || !(await isAdminUser(user.id))) {
    throw new Error("admin_role_revalidation_failed");
  }
  await recordAuthSecurityEvent("passkey_registered", { role: "admin", success: true });
  return data as AdminPasskeyRecord;
}

export async function removeAdminPasskey(passkeyId: string) {
  const { session, user } = await requireCurrentAdminSession();
  const client = await mirrorSessionToPasskeyClient(session);
  const api = (client.auth as any).passkey;
  if (!api?.delete) throw new Error("passkey_api_unavailable");
  const { error } = await api.delete({ passkeyId });
  if (error) throw error;
  if (!(await isAdminUser(user.id))) throw new Error("admin_role_revalidation_failed");
  await recordAuthSecurityEvent("passkey_removed", { role: "admin", success: true });
}

export async function adminSignInWithPasskey() {
  if (!supabase) throw new Error("supabase_unavailable");
  const client = getPasskeyClient();
  const signIn = client && (client.auth as any).signInWithPasskey;
  if (!client || typeof signIn !== "function") throw new Error("passkey_api_unavailable");

  const { data, error } = await signIn.call(client.auth);
  if (error || !data?.session?.access_token || !data.session.refresh_token || !data.user?.id) {
    await recordAuthSecurityEvent("biometric_login_failed", { role: "admin", success: false, reason: error?.code || error?.message || "passkey_sign_in_failed" });
    throw error || new Error("passkey_sign_in_failed");
  }

  const mainSession = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (mainSession.error || !mainSession.data.user?.id || mainSession.data.user.id !== data.user.id) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("passkey_session_transfer_failed");
  }
  if (!(await isAdminUser(data.user.id))) {
    await Promise.all([
      client.auth.signOut({ scope: "local" }),
      supabase.auth.signOut({ scope: "local" }),
    ]);
    throw new Error("admin_role_required");
  }
  return data.user;
}
