// Summary: Shared type definitions for chatbot config, FAQs, and theme values; secondary reference.
export type BusinessType =
  | "restaurant"
  | "hotel"
  | "cafe"
  | "barber"
  | "real_estate"
  | "clinic"
  | "gym"
  | "taxi"
  | "ecommerce"
  | "custom";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type ThemeConfig = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

export type ChatbotConfig = {
  businessName: string;
  businessType: BusinessType;
  greeting: string;
  theme: ThemeConfig;
  logoUrl?: string | null;
  iconId?: string | null;
  faqs: FaqItem[];
  launcherShape?: "circle" | "square" | "pill";
  launcherVariant?: "icon" | "iconWithLabel";
};
