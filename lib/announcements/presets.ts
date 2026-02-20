export type AnnouncementPresetKey = "custom" | "feature" | "maintenance" | "tips" | "promo" | "alert";

export type AnnouncementPresetTemplate = {
  emoji: string;
  title: string;
  body: string;
};

export const ANNOUNCEMENT_PRESETS: Record<AnnouncementPresetKey, AnnouncementPresetTemplate> = {
  custom: {
    emoji: "📣",
    title: "",
    body: ""
  },
  feature: {
    emoji: "✨",
    title: "New feature is live",
    body: "We shipped an update to make your workflow faster and easier."
  },
  maintenance: {
    emoji: "🛠️",
    title: "Scheduled maintenance",
    body: "We’re running maintenance to improve reliability. Some features may be briefly unavailable."
  },
  tips: {
    emoji: "💡",
    title: "Quick tip",
    body: "Try this workflow tip to get better results from your dashboard."
  },
  promo: {
    emoji: "🎉",
    title: "Limited-time offer",
    body: "We added a temporary promotion to help you get more value this week."
  },
  alert: {
    emoji: "⚠️",
    title: "Important update",
    body: "Please review this important product update and take action if needed."
  }
};

export const DEFAULT_ANNOUNCEMENT_EMOJI = "📣";

