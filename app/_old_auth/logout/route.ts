import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = getSupabaseRouteClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
