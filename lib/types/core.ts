import type { TonePreset } from "@/lib/types";
import type { QuickButton } from "@/lib/config/industry-presets";

export type PlanId = "free" | "local_basic" | "pro" | "enterprise";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export type WidgetTheme = {
  primary: string;
  accent?: string;
  secondary: string;
  background: string;
  text: string;
  shape: "rounded" | "pill" | "square";
};

export type WidgetFaqItem = { // FAQ item used by the embedded widget preview
  id: string; // Unique FAQ id
  question: string; // FAQ question text
  answer: string; // FAQ answer text
}; // Widget FAQ shape

export type WidgetConfig = {
  siteId: string;
  businessName?: string;
  greeting?: string;
  tonePreset?: TonePreset;
  theme?: WidgetTheme;
  businessType?: "restaurant" | "hotel" | "cafe" | "barber" | "real_estate" | "clinic" | "gym" | "taxi" | "ecommerce" | "custom";
  faqs?: WidgetFaqItem[];
  launcherVariant?: "icon" | "iconWithLabel";
  launcherPosition?: "left" | "right";
  showLogo?: boolean;
  logoUrl?: string | null;
  iconId?: string | null;
  /** Configurable quick buttons from bot config. When present, replaces the default 3-button set in the widget. */
  quickButtons?: QuickButton[];
};

export type BlockType =
  | "hero"
  | "text"
  | "image"
  | "gallery"
  | "map"
  | "contact"
  | "menu"
  | "products"
  | "testimonials"
  | "team"
  | "faq"
  | "cta"
  | "pricing"
  | "footer"
  | "header"
  | "split"
  | "feature_grid";

export interface BlockData<T = Record<string, unknown>> {
  id: string;
  type: BlockType;
  position: number;
  data: T;
}

export interface Site {
  id: string;
  businessId: string;
  name: string;
  primaryDomain?: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  blocks: BlockData[];
}

export type ConversationSender = "user" | "ai" | "assistant" | "agent" | "owner";

export type ChatMessageAction =
  | {
      type: "quick_reply";
      label: string;
      value: string;
    }
  | {
      type: "show_offer";
      offerId?: string;
      title: string;
      description: string;
      price?: string | null;
      cta?: string;
      value?: string;
    }
  | {
      type: "show_recommendations";
      items: Array<{
        id: string;
        name: string;
        description: string | null;
        price: number | null;
        reason: string;
      }>;
    }
  | {
      type: "ask_qualification_question";
      field: "budget_range" | "urgency" | "decision_maker";
      question: string;
    };

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ConversationSender;
  text: string;
  createdAt: string;
  actions?: ChatMessageAction[];
}

export interface Lead {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  createdAt: string;
}
