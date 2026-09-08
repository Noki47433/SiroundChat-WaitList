import { cookies } from "next/headers";
import { createRouteHandlerClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";
import { ensureSupabaseEnv } from "@/lib/config/auth";
import { LIVE_FETCH_OPTIONS } from "@/lib/supabase/live-fetch";

const supabaseEnv = ensureSupabaseEnv();

export const getSupabaseServerClient = () =>
  createServerComponentClient<Database>(
    { cookies },
    {
      supabaseUrl: supabaseEnv.supabaseUrl,
      supabaseKey: supabaseEnv.supabaseAnonKey,
      options: LIVE_FETCH_OPTIONS
    }
  ) as any;

export const getSupabaseRouteClient = () =>
  createRouteHandlerClient<Database>(
    { cookies },
    {
      supabaseUrl: supabaseEnv.supabaseUrl,
      supabaseKey: supabaseEnv.supabaseAnonKey,
      options: LIVE_FETCH_OPTIONS
    }
  ) as any;

export const getSupabasePublicClient = () =>
  createClient<Database>(supabaseEnv.supabaseUrl, supabaseEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...LIVE_FETCH_OPTIONS
  }) as any;
