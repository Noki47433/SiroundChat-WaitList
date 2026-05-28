import type { ClassifiedEditIntent } from "./intent-classifier";
import { classifyEditIntent } from "./intent-classifier";
import { buildDataSufficiencyCheck, retrieveWebsiteKnowledge } from "./knowledge-retrieval";

export type WebsiteEditRouting =
  | { action: "proceed"; intent: ClassifiedEditIntent; knowledgeContext: string | null }
  | {
      action: "clarify";
      intent: ClassifiedEditIntent;
      clarification: { message: string; missingTypes: string[] };
    }
  | { action: "advisory"; intent: ClassifiedEditIntent; advisory: string };

/**
 * Classify the user's edit intent, retrieve relevant KB chunks, and determine
 * whether to proceed, ask for missing data, or return an advisory note.
 *
 * Called by both /api/builder/studio-edit (integrated template path) and
 * /api/builder/ai-edit (legacy document path).
 */
export async function routeWebsiteEditRequest(params: {
  prompt: string;
  businessId: string;
  businessType: string;
  businessName: string;
  existingPageNames?: string[];
  documentKind?: "integrated_template" | "site_document";
}): Promise<WebsiteEditRouting> {
  const intent = await classifyEditIntent({
    prompt: params.prompt,
    businessType: params.businessType,
    businessName: params.businessName,
    existingPageNames: params.existingPageNames ?? []
  });

  // Integrated templates: full_regeneration is advisory; page_addition flows through
  if (params.documentKind === "integrated_template") {
    if (intent.intent === "full_regeneration") {
      return {
        action: "advisory",
        intent,
        advisory:
          "To fully regenerate the site, use the main generation flow. For targeted edits, try: 'Rewrite the hero section', 'Update the story section', or 'Change the color scheme to...'."
      };
    }
  }

  // Knowledge-dependent intents — retrieve KB and check sufficiency before proceeding
  if (intent.requiresKnowledge && intent.requiredKnowledge.length > 0) {
    const knowledgeResult = await retrieveWebsiteKnowledge({
      businessId: params.businessId,
      requiredKnowledge: intent.requiredKnowledge,
      prompt: params.prompt
    });

    const sufficiency = buildDataSufficiencyCheck(intent.requiredKnowledge, knowledgeResult);
    if (!sufficiency.sufficient) {
      return {
        action: "clarify",
        intent,
        clarification: {
          message: sufficiency.clarificationMessage,
          missingTypes: sufficiency.missingTypes
        }
      };
    }

    return {
      action: "proceed",
      intent,
      knowledgeContext: knowledgeResult.hasRelevantData ? knowledgeResult.combinedText : null
    };
  }

  return { action: "proceed", intent, knowledgeContext: null };
}
