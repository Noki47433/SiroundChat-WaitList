// lib/config/auth.ts
// Central Supabase env + auth control (STATIC env access so Next can inline)

let loggedAuthStatus = false;

type SupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export const ensureSupabaseEnv = (): SupabaseConfig => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
};

export const isAuthDisabled = () => {
  if (!loggedAuthStatus) {
    loggedAuthStatus = true;
    const publicFlag = process.env.NEXT_PUBLIC_DISABLE_AUTH ?? null;
    const serverFlag = process.env.DISABLE_AUTH ?? null;
    const authDisabled = publicFlag === "true" || serverFlag === "true";
    console.info("[AUTH_FLAGS]", {
      authDisabled,
      NEXT_PUBLIC_DISABLE_AUTH: publicFlag,
      DISABLE_AUTH: serverFlag
    });
  }

  return process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" || process.env.DISABLE_AUTH === "true";
};
