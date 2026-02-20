import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";
import { getSupabaseEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export const createBrowserClient = () => {
  if (browserClient) return browserClient;
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return browserClient;
};
