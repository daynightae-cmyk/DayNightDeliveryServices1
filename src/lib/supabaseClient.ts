import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://ngdwybpgacauorygoedi.supabase.co";
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
