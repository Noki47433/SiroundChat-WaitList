import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";

let serverAdminClient: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseServerAdminClient = () => {
  if (serverAdminClient) return serverAdminClient;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  serverAdminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return serverAdminClient;
};
