type EnvOptions = {
  requireOpenAI?: boolean;
};

const isDev = process.env.NODE_ENV !== "production";

export const getEnv = ({ requireOpenAI }: EnvOptions = {}) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (isDev) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (requireOpenAI && !openaiApiKey) missing.push("OPENAI_API_KEY");
    if (missing.length) {
      throw new Error(`Missing required env vars: ${missing.join(", ")}`);
    }
  }

  return { supabaseUrl, supabaseAnonKey, openaiApiKey };
};

export const getSupabaseEnv = () => {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  return { supabaseUrl, supabaseAnonKey };
};

export const getOpenAIEnv = () => {
  const { openaiApiKey } = getEnv({ requireOpenAI: true });
  return { openaiApiKey };
};
