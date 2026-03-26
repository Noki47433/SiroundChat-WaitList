import "server-only";
export {
  getSupabaseAdminClient as getSupabaseServerAdminClient,
  getSupabaseAdminClientIfAvailable as getSupabaseServerAdminClientIfAvailable
} from "@/lib/supabase/admin";
