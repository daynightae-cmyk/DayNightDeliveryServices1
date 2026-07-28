import { getSupabaseAdmin } from "./supabase-admin.ts";

export type AuthenticatedActor = {
  id: string;
  role: string;
  email: string | null;
};

export async function requireAdmin(req: Request): Promise<AuthenticatedActor> {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("not_authenticated");

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.id) throw new Error("not_authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw new Error("profile_lookup_failed");
  const role = String(profile?.role || "").toLowerCase();
  if (!["admin", "support", "owner", "super_admin"].includes(role)) {
    throw new Error("not_authorized");
  }

  return {
    id: userData.user.id,
    role,
    email: userData.user.email || null,
  };
}
