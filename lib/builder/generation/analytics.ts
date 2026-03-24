export const GENERATION_EVENT_TYPES = [
  "site_generation_started",
  "site_template_selected",
  "site_generation_validated",
  "site_generation_partial_regen",
  "site_generation_completed",
  "site_generation_failed"
] as const;

export type GenerationEventType = (typeof GENERATION_EVENT_TYPES)[number];

export async function emitGenerationEvent(
  supabase: any,
  params: {
    businessId: string;
    siteId: string;
    type: GenerationEventType;
    metadata: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("analytics_events").insert({
      business_id: params.businessId,
      site_id: params.siteId,
      type: params.type,
      session_id: null,
      url: null,
      timestamp: new Date().toISOString(),
      metadata: params.metadata
    });
  } catch (error) {
    console.warn("[GEN] analytics emit failed", params.type, error);
  }
}
