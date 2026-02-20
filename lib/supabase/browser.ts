// Summary: Creates the Supabase client for browser code, pulling config from env or fallbacks. Understand at a high level; main use is to get a client instance.
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/lib/db/schema";
import { ensureSupabaseEnv } from "@/lib/config/auth";

const supabaseEnv = ensureSupabaseEnv();

let browserClient: ReturnType<typeof createClientComponentClient<Database>>;

export const getSupabaseBrowserClient = () => {
  if (!browserClient) {
    console.log("SUPABASE_URL =", process.env.NEXT_PUBLIC_SUPABASE_URL);
    browserClient = createClientComponentClient<Database>({
      supabaseUrl: supabaseEnv.supabaseUrl,
      supabaseKey: supabaseEnv.supabaseAnonKey
    });
  }
  return browserClient;
};
