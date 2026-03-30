import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type PendingBusinessApprovalItem = {
  id: string;
  business_name: string | null;
  industry: string | null;
  phone: string | null;
  city: string | null;
  website_url: string | null;
  onboarding_data: Record<string, unknown> | null;
  created_at: string;
};

export async function listPendingBusinessApprovals() {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("businesses")
    .select("id, business_name, industry, phone, city, website_url, onboarding_data, created_at")
    .eq("onboarding_submitted", true)
    .eq("access_approved", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PendingBusinessApprovalItem[];
}

export async function approveBusinessAccess(businessId: string) {
  const admin = getSupabaseAdminClient() as any;
  const { data, error } = await admin
    .from("businesses")
    .update({
      access_approved: true,
      launch_access: true,
      updated_at: new Date().toISOString()
    })
    .eq("id", businessId)
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw error ?? new Error("Unable to approve business");
  }

  return { id: String(data.id) };
}
