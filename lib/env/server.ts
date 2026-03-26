import "server-only";

export type ServerSupabaseAuthEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type ServerSupabaseAdminEnv = ServerSupabaseAuthEnv & {
  serviceRoleKey: string;
};

const normalizeEnv = (value: string | undefined) => value?.trim() ?? "";

const readSupabaseUrl = () =>
  normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || normalizeEnv(process.env.SUPABASE_URL);

const readSupabaseAnonKey = () =>
  normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || normalizeEnv(process.env.SUPABASE_ANON_KEY);

const readSupabaseServiceRoleKey = () => normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const getMissingServerSupabaseAuthEnvNames = () => {
  const missing: string[] = [];

  if (!readSupabaseUrl()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!readSupabaseAnonKey()) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
};

export const getMissingServerSupabaseAdminEnvNames = () => {
  const missing = getMissingServerSupabaseAuthEnvNames();

  if (!readSupabaseServiceRoleKey()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
};

export const hasServerSupabaseAuthEnv = () => getMissingServerSupabaseAuthEnvNames().length === 0;

export const hasServerSupabaseAdminEnv = () => getMissingServerSupabaseAdminEnvNames().length === 0;

export const getServerSupabaseAuthEnv = (): ServerSupabaseAuthEnv | null => {
  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey
  };
};

export const getServerSupabaseAdminEnv = (): ServerSupabaseAdminEnv | null => {
  const authEnv = getServerSupabaseAuthEnv();
  const serviceRoleKey = readSupabaseServiceRoleKey();

  if (!authEnv || !serviceRoleKey) {
    return null;
  }

  return {
    ...authEnv,
    serviceRoleKey
  };
};

export const getServerSupabaseAuthEnvOrThrow = (): ServerSupabaseAuthEnv => {
  const env = getServerSupabaseAuthEnv();
  if (!env) {
    throw new Error("Missing server Supabase auth configuration.");
  }
  return env;
};

export const getServerSupabaseAdminEnvOrThrow = (): ServerSupabaseAdminEnv => {
  const env = getServerSupabaseAdminEnv();
  if (!env) {
    throw new Error("Missing server Supabase admin configuration.");
  }
  return env;
};
