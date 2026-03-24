export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash?: string | null;
          name: string;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash?: string | null;
          name: string;
          onboarding_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          business_name: string;
          widget_key: string | null;
          logo_url: string | null;
          industry: string | null;
          greeting: string | null;
          tone: string | null;
          timezone: string | null;
          onboarding_data: Json;
          generated_starter_knowledge: string | null;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          business_name: string;
          widget_key?: string | null;
          logo_url?: string | null;
          industry?: string | null;
          greeting?: string | null;
          tone?: string | null;
          timezone?: string | null;
          onboarding_data?: Json;
          generated_starter_knowledge?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          business_id: string;
          plan: "free" | "local_basic" | "pro" | "enterprise";
          status: "active" | "past_due" | "canceled" | "trialing";
          renewal_date: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          plan: "free" | "local_basic" | "pro" | "enterprise";
          status?: "active" | "past_due" | "canceled" | "trialing";
          renewal_date?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      chat_conversations: {
        Row: {
          id: string;
          business_id: string;
          site_id: string | null;
          user_name: string | null;
          user_email: string | null;
          is_lead: boolean;
          should_prompt_feedback: boolean;
          feedback_prompted_at: string | null;
          followup_prompted_at: string | null;
          takeover_enabled: boolean;
          takeover_by: string | null;
          takeover_at: string | null;
          takeover_ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          site_id?: string | null;
          user_name?: string | null;
          user_email?: string | null;
          is_lead?: boolean;
          should_prompt_feedback?: boolean;
          feedback_prompted_at?: string | null;
          followup_prompted_at?: string | null;
          takeover_enabled?: boolean;
          takeover_by?: string | null;
          takeover_at?: string | null;
          takeover_ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_conversations"]["Insert"]>;
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: "ai" | "assistant" | "user" | "agent" | "owner";
          message_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender: "ai" | "assistant" | "user" | "agent" | "owner";
          message_text: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
      };
      conversation_feedback: {
        Row: {
          id: string;
          conversation_id: string;
          site_id: string | null;
          message_id: string;
          rating: string;
          tags: string[] | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          site_id?: string | null;
          message_id: string;
          rating: string;
          tags?: string[] | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversation_feedback"]["Insert"]>;
      };
      conversation_reservation_state: {
        Row: {
          conversation_id: string;
          business_id: string;
          state: Json;
          updated_at: string;
        };
        Insert: {
          conversation_id: string;
          business_id: string;
          state?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversation_reservation_state"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id?: string | null;
          name: string;
          phone?: string | null;
          email?: string | null;
          source: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          body: string;
          severity: "info" | "success" | "warning" | "critical" | "celebration";
          category: "revenue" | "growth" | "ops" | "quality" | "product" | "insight";
          cta_label: string | null;
          cta_url: string | null;
          data: Json;
          created_at: string;
          read_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          body: string;
          severity: "info" | "success" | "warning" | "critical" | "celebration";
          category: "revenue" | "growth" | "ops" | "quality" | "product" | "insight";
          cta_label?: string | null;
          cta_url?: string | null;
          data?: Json;
          created_at?: string;
          read_at?: string | null;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      badge_definitions: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string;
          icon: string;
          rarity: "common" | "rare" | "epic" | "legendary";
          created_at: string;
          criteria: Json;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description: string;
          icon: string;
          rarity: "common" | "rare" | "epic" | "legendary";
          created_at?: string;
          criteria?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["badge_definitions"]["Insert"]>;
      };
      business_badges: {
        Row: {
          id: string;
          business_id: string;
          badge_id: string;
          earned_at: string;
          context: Json;
        };
        Insert: {
          id?: string;
          business_id: string;
          badge_id: string;
          earned_at?: string;
          context?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["business_badges"]["Insert"]>;
      };
      business_notification_settings: {
        Row: {
          business_id: string;
          deliver_in_app: boolean;
          deliver_push: boolean;
          min_severity_to_toast: "info" | "success" | "warning" | "critical" | "celebration";
          currency: string;
          avg_order_value: number | null;
          close_rate: number | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          deliver_in_app?: boolean;
          deliver_push?: boolean;
          min_severity_to_toast?: "info" | "success" | "warning" | "critical" | "celebration";
          currency?: string;
          avg_order_value?: number | null;
          close_rate?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_notification_settings"]["Insert"]>;
      };
      business_faq_items: {
        Row: {
          id: string;
          business_id: string;
          question: string;
          answer: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          question: string;
          answer: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_faq_items"]["Insert"]>;
      };
      business_topics: {
        Row: {
          id: string;
          business_id: string;
          topic: string;
          keywords: string[];
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          topic: string;
          keywords?: string[];
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_topics"]["Insert"]>;
      };
      websites: {
        Row: {
          id: string;
          business_id: string;
          site_name: string;
          domain: string | null;
          status: "draft" | "published";
          last_published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          site_name: string;
          domain?: string | null;
          status?: "draft" | "published";
          last_published_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["websites"]["Insert"]>;
      };
      pages: {
        Row: {
          id: string;
          site_id: string;
          slug: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          slug: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pages"]["Insert"]>;
      };
      blocks: {
        Row: {
          id: string;
          page_id: string;
          position: number;
          type: string;
          data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          page_id: string;
          position: number;
          type: string;
          data?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
      };
      templates: {
        Row: {
          id: string;
          template_name: string;
          blocks: Json;
        };
        Insert: {
          id?: string;
          template_name: string;
          blocks: Json;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
      };
      domains: {
        Row: {
          id: string;
          business_id: string;
          site_id: string;
          domain: string;
          status: "unverified" | "pending_dns" | "active";
          dns_records: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          site_id: string;
          domain: string;
          status?: "unverified" | "pending_dns" | "active";
          dns_records?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["domains"]["Insert"]>;
      };
      embeddings: {
        Row: {
          id: string;
          business_id: string;
          content: string;
          embedding: number[];
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          content: string;
          embedding: number[];
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["embeddings"]["Insert"]>;
      };
      analytics_events: {
        Row: {
          id: string;
          business_id: string;
          site_id: string | null;
          type:
            | "widget_opened"
            | "chat_opened"
            | "first_message_sent"
            | "conversation_started"
            | "message_received"
            | "intent_detected"
            | "lead_created"
            | "contact_intent_detected"
            | "reservation_started"
            | "reservation_failed"
            | "fallback_occurred"
            | "fallback_triggered"
            | "bot_response_delayed"
            | "topic_mentioned"
            | "reservation_created"
            | "owner_message_sent";
          session_id: string | null;
          url: string | null;
          timestamp: string;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          site_id?: string | null;
          type:
            | "widget_opened"
            | "chat_opened"
            | "first_message_sent"
            | "conversation_started"
            | "message_received"
            | "intent_detected"
            | "lead_created"
            | "contact_intent_detected"
            | "reservation_started"
            | "reservation_failed"
            | "fallback_occurred"
            | "fallback_triggered"
            | "bot_response_delayed"
            | "topic_mentioned"
            | "reservation_created"
            | "owner_message_sent";
          session_id?: string | null;
          url?: string | null;
          timestamp?: string;
          metadata?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_events"]["Insert"]>;
      };
      website_analytics_events: {
        Row: {
          id: string;
          business_id: string;
          site_id: string | null;
          page_path: string;
          page_title: string | null;
          event_type:
            | "page_view"
            | "cta_click"
            | "lead_submitted"
            | "chat_open"
            | "chat_started"
            | "reservation_started"
            | "reservation_completed";
          channel: "website" | "chatbot" | "form";
          cta_type: "call" | "whatsapp" | "email" | "directions" | "booking" | "other" | null;
          lead_type: "form" | "chat" | null;
          lead_id: string | null;
          session_id: string;
          user_agent: string | null;
          referrer: string | null;
          country_code: string | null;
          city: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          site_id?: string | null;
          page_path: string;
          page_title?: string | null;
          event_type:
            | "page_view"
            | "cta_click"
            | "lead_submitted"
            | "chat_open"
            | "chat_started"
            | "reservation_started"
            | "reservation_completed";
          channel: "website" | "chatbot" | "form";
          cta_type?: "call" | "whatsapp" | "email" | "directions" | "booking" | "other" | null;
          lead_type?: "form" | "chat" | null;
          lead_id?: string | null;
          session_id: string;
          user_agent?: string | null;
          referrer?: string | null;
          country_code?: string | null;
          city?: string | null;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["website_analytics_events"]["Insert"]>;
      };
      chatbot_update_entries: {
        Row: {
          id: string;
          business_id: string;
          input_text: string;
          status: "pending_review" | "applied" | "discarded";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          input_text: string;
          status?: "pending_review" | "applied" | "discarded";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chatbot_update_entries"]["Insert"]>;
      };
      chatbot_update_rules: {
        Row: {
          id: string;
          business_id: string;
          entry_id: string | null;
          category:
            | "offer"
            | "closure"
            | "reservation_constraint"
            | "recommendation"
            | "service_notice"
            | "faq"
            | "general_notice";
          title: string;
          body: string;
          keywords: string[];
          metadata: Json;
          enabled: boolean;
          approval_status: "pending" | "approved" | "discarded";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          entry_id?: string | null;
          category:
            | "offer"
            | "closure"
            | "reservation_constraint"
            | "recommendation"
            | "service_notice"
            | "faq"
            | "general_notice";
          title: string;
          body: string;
          keywords?: string[];
          metadata?: Json;
          enabled?: boolean;
          approval_status?: "pending" | "approved" | "discarded";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chatbot_update_rules"]["Insert"]>;
      };
      reservations: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          party_size: number | null;
          datetime: string;
          notes: string | null;
          status: "pending" | "confirmed" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          party_size?: number | null;
          datetime: string;
          notes?: string | null;
          status?: "pending" | "confirmed" | "cancelled";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
