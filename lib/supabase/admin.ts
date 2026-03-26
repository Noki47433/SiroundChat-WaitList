import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";
import {
  getMissingServerSupabaseAdminEnvNames,
  getServerSupabaseAdminEnv,
  getServerSupabaseAdminEnvOrThrow
} from "@/lib/env/server";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;
let loggedMissingAdminEnv = false;

const logMissingAdminEnv = () => {
  if (loggedMissingAdminEnv) return;
  loggedMissingAdminEnv = true;
  console.error("[SUPABASE_ADMIN_ENV_MISSING]", {
    missing: getMissingServerSupabaseAdminEnvNames()
  });
};

const createAdminClientInstance = (env: ReturnType<typeof getServerSupabaseAdminEnvOrThrow>) =>
  createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

export const getSupabaseAdminClientIfAvailable = () => {
  if (adminClient) return adminClient;

  const env = getServerSupabaseAdminEnv();
  if (!env) {
    logMissingAdminEnv();
    return null;
  }

  adminClient = createAdminClientInstance(env);
  return adminClient;
};

export const getSupabaseAdminClient = () => {
  const existing = getSupabaseAdminClientIfAvailable();
  if (existing) return existing;

  const env = getServerSupabaseAdminEnvOrThrow();
  adminClient = createAdminClientInstance(env);
  return adminClient;
};

// Backwards compatibility for other files that might import older names
export const createAdminClient = getSupabaseAdminClient;
