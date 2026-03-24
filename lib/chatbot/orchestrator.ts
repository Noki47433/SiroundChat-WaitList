import { createNotificationIfNotExists } from "@/lib/notifications/engine";
import { normalizeText } from "@/lib/notifications/detectors";
import { log } from "@/lib/utils/log";
import { resolveCustomerIdentity, type CustomerRecord } from "@/lib/chatbot/customer-identity";
import { matchFaq, matchObjection } from "@/lib/chatbot/faq-objections";
import { scoreLeadQualification } from "@/lib/chatbot/lead-scoring";
import { evaluateUpsells, type UpsellAction } from "@/lib/chatbot/upsell-evaluator";
import { recommendCatalogItems } from "@/lib/chatbot/recommender";
import { listApprovedUpdateRules, selectRelevantUpdateRules, type ChatbotUpdateRuleRow } from "@/lib/chatbot/update-info";

export type OrchestratorInput = {
  businessId: string;
  conversationId: string;
  message: string;
  customerSignals?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    channel?: string | null;
    externalId?: string | null;
  };
  reservationContext?: {
    partySize?: number | null;
    time?: string | null;
  };
};

export type OrchestratorAction =
  | UpsellAction
  | {
      type: "ask_qualification_question";
      field: "budget_range" | "urgency" | "decision_maker";
      question: string;
    }
  | {
      type: "show_recommendations";
      items: Array<{ id: string; name: string; description: string | null; price: number | null; reason: string }>;
    };

export type OrchestratorOutput = {
  assistantMessage: string | null;
  actions: OrchestratorAction[];
  customer: CustomerRecord | null;
};

type LeadQualificationRow = {
  id: string;
  budget_range: string | null;
  urgency: string | null;
  decision_maker: boolean | null;
  status: "hot" | "warm" | "cold";
  score: number;
};

const LEAD_QUALIFICATION_KEYWORDS = [
  "quote",
  "quotation",
  "proposal",
  "consultation",
  "project",
  "package",
  "packages",
  "plan",
  "plans",
  "implementation",
  "setup",
  "audit",
  "demo",
  "trial",
  "crm",
  "automation",
  "website",
  "seo",
  "campaign",
  "lead generation"
];
const RECOMMENDER_KEYWORDS = [
  "recommend",
  "suggest",
  "menu",
  "what should i order",
  "best item",
  "popular",
  "rekomando",
  "rekomandon",
  "sugjero",
  "sugjeron",
  "menuja",
  "porosit",
  "qa mund te porositi",
  "qka mund te porositi"
];
const EXPLICIT_OFFER_KEYWORDS = ["offer", "offers", "deal", "deals", "discount", "promo", "promotion", "special", "ofert", "oferta"];
const DIETARY_KEYWORDS = [
  "allergy",
  "allergic",
  "alergjik",
  "allergjik",
  "vegetarian",
  "vegan",
  "gluten",
  "mushroom",
  "mushrooms",
  "kepurdh",
  "kërpudh",
  "pa ",
  "without "
];

const QUESTION_BY_FIELD = {
  budget_range: "What budget range are you planning for this project?",
  urgency: "How soon do you need this done (today, this week, or later)?",
  decision_maker: "Are you the decision-maker for this purchase?"
} as const;

type QualificationQuestion = {
  field: "budget_range" | "urgency" | "decision_maker";
  question: string;
};

const normalizeDecision = (message: string) => {
  const text = normalizeText(message);
  if (!text) return null;

  const yes = ["yes", "i am", "im", "sure", "correct", "yep", "yeah"];
  const no = ["no", "not", "someone else", "need approval", "not yet"];

  if (yes.some((keyword) => text.includes(keyword))) return true;
  if (no.some((keyword) => text.includes(keyword))) return false;
  return null;
};

const normalizeBudget = (message: string) => {
  const text = normalizeText(message);
  if (!text) return null;

  if (["premium", "high", "enterprise", "luxury", "1000", "2000", "3000"].some((keyword) => text.includes(keyword))) {
    return "high";
  }

  if (["mid", "medium", "500", "600", "700", "800", "900"].some((keyword) => text.includes(keyword))) {
    return "medium";
  }

  if (["low", "small", "budget", "cheap", "affordable"].some((keyword) => text.includes(keyword))) {
    return "low";
  }

  return null;
};

const normalizeUrgency = (message: string) => {
  const text = normalizeText(message);
  if (!text) return null;

  if (["today", "asap", "urgent", "now"].some((keyword) => text.includes(keyword))) {
    return "today";
  }

  if (["this week", "tomorrow", "in 2 days", "in two days"].some((keyword) => text.includes(keyword))) {
    return "this_week";
  }

  if (["next month", "later", "not urgent", "sometime"].some((keyword) => text.includes(keyword))) {
    return "later";
  }

  return null;
};

const detectLeadQualificationIntent = (message: string) => {
  const normalized = normalizeText(message);
  return LEAD_QUALIFICATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const detectRecommendationIntent = (message: string) => {
  const normalized = normalizeText(message);
  return RECOMMENDER_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const detectExplicitOfferIntent = (message: string) => {
  const normalized = normalizeText(message);
  return EXPLICIT_OFFER_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const detectDietaryIntent = (message: string) => {
  const normalized = normalizeText(message);
  return DIETARY_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const detectReservationSize = (message: string) => {
  const match = message.match(/\b([1-9]|[1-4][0-9]|50)\b/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const detectReservationTime = (message: string) => {
  const match = message.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const insertAnalytics = async (
  admin: any,
  businessId: string,
  conversationId: string,
  type: string,
  metadata: Record<string, unknown>,
  customerId?: string | null,
  valueNumeric?: number | null
) => {
  await admin.from("analytics_events").insert({
    business_id: businessId,
    conversation_id: conversationId,
    customer_id: customerId ?? null,
    type,
    metadata,
    value_numeric: valueNumeric ?? null,
    timestamp: new Date().toISOString()
  });
};

const ensureLeadQualification = async (
  admin: any,
  businessId: string,
  conversationId: string,
  customerId?: string | null
): Promise<LeadQualificationRow> => {
  const { data: existing } = await admin
    .from("lead_qualifications")
    .select("id,budget_range,urgency,decision_maker,score,status")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    if (customerId) {
      await admin.from("lead_qualifications").update({ customer_id: customerId }).eq("id", existing.id);
    }
    return existing as LeadQualificationRow;
  }

  const { data: created, error } = await admin
    .from("lead_qualifications")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      customer_id: customerId ?? null,
      score: 0,
      status: "warm"
    })
    .select("id,budget_range,urgency,decision_maker,score,status")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create lead qualification");
  }

  return created as LeadQualificationRow;
};

const nextMissingField = (lead: Pick<LeadQualificationRow, "budget_range" | "urgency" | "decision_maker">) => {
  if (!lead.budget_range) return "budget_range" as const;
  if (!lead.urgency) return "urgency" as const;
  if (typeof lead.decision_maker !== "boolean") return "decision_maker" as const;
  return null;
};

export async function runChatbotOrchestrator(admin: any, input: OrchestratorInput): Promise<OrchestratorOutput> {
  const actions: OrchestratorAction[] = [];
  let assistantMessage: string | null = null;
  let approvedUpdateRules: ChatbotUpdateRuleRow[] = [];

  const customer = await resolveCustomerIdentity(admin, {
    businessId: input.businessId,
    name: input.customerSignals?.name,
    email: input.customerSignals?.email,
    phone: input.customerSignals?.phone,
    channel: input.customerSignals?.channel ?? "web_chat",
    externalId: input.customerSignals?.externalId,
    conversationId: input.conversationId,
    messageText: input.message
  });

  try {
    await insertAnalytics(
      admin,
      input.businessId,
      input.conversationId,
      "message_received",
      {
        source: input.customerSignals?.channel ?? "web_chat",
        text_preview: input.message.slice(0, 160)
      },
      customer?.id ?? null
    );
  } catch (error) {
    log("warn", "Failed to insert orchestrator message_received analytics", { error });
  }

  try {
    approvedUpdateRules = await listApprovedUpdateRules(admin, input.businessId);
    const explicitOfferIntent = detectExplicitOfferIntent(input.message);
    const dietaryIntent = detectDietaryIntent(input.message);
    const matchedRules = await selectRelevantUpdateRules(approvedUpdateRules, input.message, {
      reservationFlowActive: Boolean(input.reservationContext?.partySize || input.reservationContext?.time),
      partySize: input.reservationContext?.partySize ?? null
    });
    const directReplyRule = matchedRules.find((rule) =>
      ["closure", "service_notice", "faq", "general_notice", "reservation_constraint"].includes(rule.category)
    );

    if (directReplyRule && !assistantMessage) {
      assistantMessage = directReplyRule.body;
    }

    const approvedOfferRules = approvedUpdateRules.filter((rule) => rule.category === "offer");
    const matchedOfferRule =
      matchedRules.find((rule) => rule.category === "offer") ??
      (!dietaryIntent && explicitOfferIntent ? approvedOfferRules[0] ?? null : null);

    if (matchedOfferRule) {
      actions.push({
        type: "show_offer",
        offerId: matchedOfferRule.id,
        title: matchedOfferRule.title,
        description: matchedOfferRule.body,
        price: null,
        cta: "Would you like to use this offer?"
      });
      if (!assistantMessage) {
        assistantMessage = matchedOfferRule.body;
      }
    }

    const approvedRecommendationRules = approvedUpdateRules.filter((rule) => rule.category === "recommendation");
    const matchedRecommendationRules = matchedRules.filter((rule) => rule.category === "recommendation");
    const recommendationRules =
      matchedRecommendationRules.length || !detectRecommendationIntent(input.message) || dietaryIntent
        ? matchedRecommendationRules
        : approvedRecommendationRules.slice(0, 3);

    if (recommendationRules.length) {
      actions.push({
        type: "show_recommendations",
        items: recommendationRules.slice(0, 3).map((rule) => ({
          id: rule.id,
          name: rule.title,
          description: rule.body,
          price: null,
          reason: "Recommended by the business"
        }))
      });
      if (!assistantMessage) {
        assistantMessage = recommendationRules[0]?.body ?? null;
      }
    }
  } catch (error) {
    log("warn", "Update info rules failed", { error });
  }

  try {
    const [faqResult, objectionResult] = await Promise.all([
      admin
        .from("faq_entries")
        .select("id,question,answer,keywords")
        .eq("business_id", input.businessId)
        .eq("is_active", true)
        .limit(80),
      admin
        .from("objection_scripts")
        .select("id,objection_key,response_text,phrases")
        .eq("business_id", input.businessId)
        .eq("is_active", true)
        .limit(20)
    ]);

    const matchedFaq = matchFaq(input.message, faqResult.data ?? []);
    if (matchedFaq) {
      assistantMessage = matchedFaq.answer;
    }

    if (!assistantMessage) {
      const matchedObjection = matchObjection(input.message, objectionResult.data ?? []);
      if (matchedObjection) {
        assistantMessage = matchedObjection.response_text;
      }
    }
  } catch (error) {
    log("warn", "FAQ/objection matching failed", { error });
  }

  try {
    const shouldQualify = detectLeadQualificationIntent(input.message);
    if (shouldQualify) {
      const { data: setting } = await admin
        .from("qualification_settings")
        .select("questions")
        .eq("business_id", input.businessId)
        .maybeSingle();

      const configuredQuestions = (Array.isArray(setting?.questions)
        ? setting.questions
            .map((entry: any) => ({
              field: entry?.field,
              question: String(entry?.question ?? "")
            }))
            .filter(
              (entry: { field: string; question: string }) =>
                (entry.field === "budget_range" ||
                  entry.field === "urgency" ||
                  entry.field === "decision_maker") &&
                entry.question.trim().length > 0
            )
            .map((entry: { field: string; question: string }) => ({
              field: entry.field as QualificationQuestion["field"],
              question: entry.question
            }))
        : []) as QualificationQuestion[];

      const questionMap: Record<QualificationQuestion["field"], string> = {
        budget_range:
          configuredQuestions.find((question) => question.field === "budget_range")?.question ??
          QUESTION_BY_FIELD.budget_range,
        urgency:
          configuredQuestions.find((question) => question.field === "urgency")?.question ??
          QUESTION_BY_FIELD.urgency,
        decision_maker:
          configuredQuestions.find((question) => question.field === "decision_maker")?.question ??
          QUESTION_BY_FIELD.decision_maker
      };

      const lead = await ensureLeadQualification(admin, input.businessId, input.conversationId, customer?.id ?? null);

      const budget = normalizeBudget(input.message);
      const urgency = normalizeUrgency(input.message);
      const decision = normalizeDecision(input.message);

      const nextLead = {
        ...lead,
        budget_range: lead.budget_range ?? budget,
        urgency: lead.urgency ?? urgency,
        decision_maker: typeof lead.decision_maker === "boolean" ? lead.decision_maker : decision
      };

      const hasContactInfo = Boolean(customer?.email || customer?.phone);
      const scoreResult = scoreLeadQualification({
        budgetRange: nextLead.budget_range,
        urgency: nextLead.urgency,
        decisionMaker: nextLead.decision_maker,
        hasContactInfo
      });

      await admin
        .from("lead_qualifications")
        .update({
          budget_range: nextLead.budget_range,
          urgency: nextLead.urgency,
          decision_maker: nextLead.decision_maker,
          score: scoreResult.score,
          status: scoreResult.status
        })
        .eq("id", lead.id);

      await insertAnalytics(
        admin,
        input.businessId,
        input.conversationId,
        "lead_scored",
        {
          score: scoreResult.score,
          status: scoreResult.status
        },
        customer?.id ?? null,
        scoreResult.score
      );

      if (scoreResult.status === "hot") {
        await createNotificationIfNotExists(
          input.businessId,
          {
            title: "Hot lead detected",
            body: "A high-intent lead is ready for follow-up.",
            severity: "critical",
            category: "revenue",
            cta_label: "Open Leads",
            cta_url: "/dashboard/leads",
            data: {
              conversation_id: input.conversationId,
              customer_id: customer?.id ?? null,
              score: scoreResult.score
            }
          },
          "lead_scored",
          `${input.conversationId}:hot`
        );

        if (customer?.id) {
          await admin.from("customer_events").insert({
            business_id: input.businessId,
            customer_id: customer.id,
            type: "lead_scored",
            payload: {
              score: scoreResult.score,
              status: scoreResult.status,
              conversation_id: input.conversationId
            }
          });
        }
      }

      const missing = nextMissingField(nextLead);
      if (missing) {
        actions.push({
          type: "ask_qualification_question",
          field: missing,
          question: questionMap[missing]
        });

        if (!assistantMessage) {
          assistantMessage = questionMap[missing];
        }
      }
    }
  } catch (error) {
    log("warn", "Lead qualification flow failed", { error });
  }

  try {
    const hasApprovedOfferRules = approvedUpdateRules.some((rule) => rule.category === "offer");
    if (!hasApprovedOfferRules) {
      const { data: upsellRows } = await admin
        .from("upsell_catalog")
        .select("id,name,description,trigger_type,trigger_rules,offer_payload,priority")
        .eq("business_id", input.businessId)
        .eq("is_active", true)
        .limit(40);

      const upsell = evaluateUpsells(upsellRows ?? [], {
        reservationSize: input.reservationContext?.partySize ?? detectReservationSize(input.message),
        reservationTime: input.reservationContext?.time ?? detectReservationTime(input.message),
        message: input.message
      });

      if (upsell) {
        actions.push(upsell.action);
        await insertAnalytics(
          admin,
          input.businessId,
          input.conversationId,
          "upsell_shown",
          {
            offer_id: upsell.action.offerId,
            title: upsell.action.title
          },
          customer?.id ?? null
        );
      }
    }
  } catch (error) {
    log("warn", "Upsell evaluation failed", { error });
  }

  try {
    const hasApprovedRecommendationRules = approvedUpdateRules.some((rule) => rule.category === "recommendation");
    if (detectRecommendationIntent(input.message) && !hasApprovedRecommendationRules) {
      const { data: catalogRows } = await admin
        .from("catalog_items")
        .select("id,name,description,price,tags")
        .eq("business_id", input.businessId)
        .eq("is_active", true)
        .limit(100);

      const recommendations = recommendCatalogItems(input.message, catalogRows ?? []);
      if (recommendations.length) {
        actions.push({
          type: "show_recommendations",
          items: recommendations.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            reason: item.reason
          }))
        });

        await insertAnalytics(
          admin,
          input.businessId,
          input.conversationId,
          "recommendations_shown",
          {
            item_ids: recommendations.map((item) => item.id)
          },
          customer?.id ?? null
        );
      }
    }
  } catch (error) {
    log("warn", "Recommendation evaluation failed", { error });
  }

  return {
    assistantMessage,
    actions,
    customer
  };
}
