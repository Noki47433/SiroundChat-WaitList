import { NextResponse } from "next/server";
import { isPrelaunchUserAllowed } from "@/lib/auth/prelaunch";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { processDocument } from "@/lib/ai/document-processing";
import {
  canAccessBillingWorkspace,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrelaunchUserAllowed(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const documentId = typeof json?.documentId === "string" ? json.documentId : "";

  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, business_id")
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const canAccess = await canAccessBillingWorkspace(user.id, doc.business_id);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const billingAccess = await getBusinessEntitlementAccess(doc.business_id, "chatbot_knowledge_base");
  if (!billingAccess.allowed) {
    return NextResponse.json({ error: "Knowledge retraining is not available on the current plan" }, { status: 403 });
  }

  try {
    await processDocument(documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DOCUMENT_RETRAIN_ERROR]", error);
    return NextResponse.json({ error: "Failed to retrain document" }, { status: 500 });
  }
}
