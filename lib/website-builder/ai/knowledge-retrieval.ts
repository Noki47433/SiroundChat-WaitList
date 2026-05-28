import { retrieveRelevantChunks } from "@/lib/ai/retrieve";
import { log } from "@/lib/utils/log";
import type { KnowledgeDataType } from "@/lib/website-builder/ai/intent-classifier";

type RetrievedChunk = {
  content: string;
  documentId: string;
  score: number;
};

export type WebsiteKnowledgeResult = {
  chunks: RetrievedChunk[];
  foundDataTypes: KnowledgeDataType[];
  hasRelevantData: boolean;
  combinedText: string;
};

const KNOWLEDGE_QUERIES: Record<KnowledgeDataType, string[]> = {
  menu_data: [
    "menu dishes food drinks prices categories appetizers mains desserts",
    "dish name description price menu item",
    "food menu restaurant items price list",
  ],
  service_data: [
    "services treatments procedures pricing packages offers",
    "service list price cost treatment appointment",
    "dental services barber services beauty treatments gym classes",
  ],
  property_data: [
    "property listing apartment house rent sale bedrooms bathrooms price location",
    "real estate property features square meters floor",
    "listing address price property details",
  ],
  vehicle_data: [
    "vehicle car inventory model year mileage price financing",
    "car dealership stock vehicle list make model trim",
    "automobile inventory details price used new",
  ],
  room_data: [
    "hotel room suite amenities pricing availability check-in check-out",
    "room type bed breakfast included hotel accommodation",
    "suite standard deluxe room price per night",
  ],
  team_data: [
    "team staff member name role bio experience",
    "doctor dentist specialist employee team member",
    "staff directory credentials expertise",
  ],
  pricing_data: [
    "price list pricing packages rates fees cost",
    "pricing table plan tier subscription service cost",
    "price per unit rate charge fee",
  ],
  faq_data: [
    "frequently asked questions FAQ common questions answers",
    "question answer customer inquiry",
    "how do I what is when do you",
  ],
  opening_hours_data: [
    "opening hours business hours schedule monday tuesday wednesday thursday friday saturday sunday",
    "open close time hours operation schedule",
    "working hours availability times",
  ],
};

const KNOWLEDGE_DETECTION_PATTERNS: Record<KnowledgeDataType, string[]> = {
  menu_data: ["menu", "dish", "food", "drink", "appetizer", "main", "dessert", "starter", "entree", "cuisine", "eat"],
  service_data: ["service", "treatment", "procedure", "package", "therapy", "session", "appointment", "care", "cleaning", "whitening"],
  property_data: ["property", "apartment", "house", "bedroom", "bathroom", "sqm", "rent", "sale", "floor", "listing"],
  vehicle_data: ["vehicle", "car", "auto", "model", "mileage", "km", "transmission", "engine", "dealer", "toyota", "bmw", "mercedes"],
  room_data: ["room", "suite", "hotel", "accommodation", "bed", "check-in", "check-out", "night", "amenity"],
  team_data: ["team", "staff", "doctor", "dentist", "therapist", "employee", "member", "specialist", "bio"],
  pricing_data: ["price", "cost", "fee", "rate", "€", "$", "usd", "eur", "per session", "per month", "package"],
  faq_data: ["question", "faq", "frequently", "answer", "how to", "what is", "can i"],
  opening_hours_data: ["hours", "open", "close", "monday", "tuesday", "friday", "saturday", "sunday", "am", "pm"],
};

const detectDataTypes = (text: string): KnowledgeDataType[] => {
  const lower = text.toLowerCase();
  const found: KnowledgeDataType[] = [];
  for (const [dataType, patterns] of Object.entries(KNOWLEDGE_DETECTION_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) {
      found.push(dataType as KnowledgeDataType);
    }
  }
  return found;
};

export async function retrieveWebsiteKnowledge(params: {
  businessId: string;
  requiredKnowledge: KnowledgeDataType[];
  prompt: string;
  limit?: number;
}): Promise<WebsiteKnowledgeResult> {
  const { businessId, requiredKnowledge, prompt, limit = 8 } = params;

  if (!requiredKnowledge.length && !prompt.trim()) {
    return { chunks: [], foundDataTypes: [], hasRelevantData: false, combinedText: "" };
  }

  const queries = new Set<string>();
  queries.add(prompt);

  for (const dataType of requiredKnowledge) {
    const typeQueries = KNOWLEDGE_QUERIES[dataType] ?? [];
    for (const q of typeQueries.slice(0, 1)) {
      queries.add(q);
    }
  }

  const allChunks: RetrievedChunk[] = [];
  const seenContent = new Set<string>();

  for (const query of queries) {
    try {
      const result = await retrieveRelevantChunks({ businessId, query, limit: Math.ceil(limit / queries.size) + 2 });
      for (const chunk of result.chunks) {
        const key = chunk.content.slice(0, 120);
        if (!seenContent.has(key)) {
          seenContent.add(key);
          allChunks.push(chunk);
        }
      }
    } catch (error) {
      log("warn", "KB retrieval query failed", { query, error });
    }
  }

  const sorted = allChunks.sort((a, b) => b.score - a.score).slice(0, limit);
  const combinedText = sorted.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
  const foundDataTypes = detectDataTypes(combinedText);
  const hasRelevantData = sorted.length > 0 && (
    requiredKnowledge.length === 0 ||
    requiredKnowledge.some((dt) => foundDataTypes.includes(dt))
  );

  return { chunks: sorted, foundDataTypes, hasRelevantData, combinedText };
}

export function buildDataSufficiencyCheck(
  requiredKnowledge: KnowledgeDataType[],
  knowledgeResult: WebsiteKnowledgeResult
): {
  sufficient: boolean;
  missingTypes: KnowledgeDataType[];
  clarificationMessage: string;
} {
  if (!requiredKnowledge.length) {
    return { sufficient: true, missingTypes: [], clarificationMessage: "" };
  }

  const missingTypes = requiredKnowledge.filter((dt) => !knowledgeResult.foundDataTypes.includes(dt));

  if (!missingTypes.length) {
    return { sufficient: true, missingTypes: [], clarificationMessage: "" };
  }

  const messages: Record<KnowledgeDataType, string> = {
    menu_data: "I need your menu items and prices to build this page. Upload a menu PDF/Excel file, or paste the menu here.",
    service_data: "I need your service list with prices and descriptions. Upload a services/pricing document, or paste the list here.",
    property_data: "I need your property listings to build this page. Upload a property list or paste the details (title, location, price, bedrooms, key features).",
    vehicle_data: "I need your vehicle inventory to build this page. Upload a vehicle list or paste the details (make, model, year, price, mileage).",
    room_data: "I need your room types and pricing to build this page. Upload a rooms/rates document or paste the details here.",
    team_data: "I need your team member information. Upload a staff list or paste names, roles, and brief bios.",
    pricing_data: "I need your pricing information. Upload a price list or paste the rates here.",
    faq_data: "I need your FAQ content. Upload a FAQ document or paste your questions and answers here.",
    opening_hours_data: "I need your opening hours. Please provide your hours for each day.",
  };

  const firstMissing = missingTypes[0];
  const clarificationMessage = messages[firstMissing] ?? "I need more information to complete this. Please provide the relevant content.";

  return { sufficient: false, missingTypes, clarificationMessage };
}
