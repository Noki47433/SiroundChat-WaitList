// lib/supabase/admin.ts
// Server-only Supabase admin client (service role).
// Used for privileged operations (webhooks, ingestion, widget write paths, etc).

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseAdminClient = () => {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  return adminClient;
};

// Backwards compatibility for other files that might import older names
export const createAdminClient = getSupabaseAdminClient;
