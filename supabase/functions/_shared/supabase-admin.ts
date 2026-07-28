import { createClient } from "npm:@supabase/supabase-js@2.108.2";

export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!url || !serviceRole) throw new Error("supabase_server_config_missing");

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "day-night-track17/1.0" },
    },
  });
}
