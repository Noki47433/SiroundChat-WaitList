import type { ChecklistTaskId } from "./state";

export type TutorialStep = {
  id: string;
  instruction: string;
  selector: string;
  fallbackSelector?: string;
};

export type TutorialGuide = {
  route: string;
  title: string;
  summary: string;
  challenge: string;
  checklistTaskId?: ChecklistTaskId;
  steps: TutorialStep[];
};

const navSelector = (href: string) => `a[data-tutorial-nav="${href}"]`;

export const DASHBOARD_TUTORIAL_GUIDES: TutorialGuide[] = [
  {
    route: "/dashboard/analytics/website",
    title: "About Website Analytics",
    summary: "Track website visitors, chats, leads, and conversion by page and country.",
    challenge: "Let's try it! Change the range and review your top pages.",
    steps: [
      {
        id: "website-analytics-range",
        instruction: "Pick a date range to analyze website performance.",
        selector: "[data-tutorial-target='website-analytics-range']",
        fallbackSelector: navSelector("/dashboard/analytics/website")
      }
    ]
  },
  {
    route: "/dashboard/analytics",
    title: "About Analytics",
    summary: "This page shows funnel quality, top intents, drop-off points, and response performance.",
    challenge: "Let's try it! Switch tabs and inspect where conversations drop.",
    steps: [
      {
        id: "analytics-tabs",
        instruction: "Use the tabs to drill into intents, drop-off, and heatmap.",
        selector: "[data-tutorial-target='analytics-tabs']",
        fallbackSelector: navSelector("/dashboard/analytics")
      }
    ]
  },
  {
    route: "/dashboard/chatbot/sales",
    title: "About Update Info",
    summary: "Add business updates, offers, closures, and important operating notes your chatbot should use.",
    challenge: "Let's try it! Add one real business update and review the extracted rules.",
    steps: [
      {
        id: "sales-section-switch",
        instruction: "Paste the business update you want the chatbot to know about.",
        selector: "[data-tutorial-target='sales-section-switch']",
        fallbackSelector: navSelector("/dashboard/chatbot/sales")
      },
      {
        id: "sales-create-item",
        instruction: "Review the extracted rules and approve the ones that should go live.",
        selector: "[data-tutorial-target='sales-create-item']",
        fallbackSelector: navSelector("/dashboard/chatbot/sales")
      }
    ]
  },
  {
    route: "/dashboard/builder/new",
    title: "About Website Builder",
    summary: "The builder turns your business details into a ready-to-edit website.",
    challenge: "Let's try it! Complete the wizard and press Generate website.",
    checklistTaskId: "create_website",
    steps: [
      {
        id: "builder-generate",
        instruction: "When your details are ready, generate the website.",
        selector: "[data-tutorial-target='builder-generate-website']",
        fallbackSelector: navSelector("/dashboard/builder")
      }
    ]
  },
  {
    route: "/dashboard/builder",
    title: "About Website Builder",
    summary: "Create, edit, and publish your business websites from one place.",
    challenge: "Let's try it! Start a new site from this page.",
    checklistTaskId: "create_website",
    steps: [
      {
        id: "builder-create-site",
        instruction: "Create your first website draft.",
        selector: "[data-tutorial-target='builder-create-site']",
        fallbackSelector: navSelector("/dashboard/builder")
      }
    ]
  },
  {
    route: "/dashboard/bot-settings",
    title: "About Bot Settings",
    summary: "Set the business profile, greeting, theme, tone, then deploy the live widget snippet.",
    challenge: "Let's try it! Pick a greeting preset first, then deploy the chatbot.",
    checklistTaskId: "create_chatbot",
    steps: [
      {
        id: "bot-settings-greeting",
        instruction: "Pick a market preset and choose one of the suggested greetings.",
        selector: "[data-tutorial-target='bot-settings-greeting']",
        fallbackSelector: navSelector("/dashboard/bot-settings")
      },
      {
        id: "bot-settings-deploy",
        instruction: "Deploy the chatbot when the profile, theme, and tone are ready.",
        selector: "[data-tutorial-target='bot-settings-deploy']",
        fallbackSelector: navSelector("/dashboard/bot-settings")
      }
    ]
  },
  {
    route: "/dashboard/documents",
    title: "About Documents",
    summary: "Upload your business knowledge so the bot can answer with real context.",
    challenge: "Let's try it! Add your first document and press Re-train.",
    checklistTaskId: "train_documents",
    steps: [
      {
        id: "documents-upload",
        instruction: "Upload your first file (PDF, DOCX, or TXT).",
        selector: "[data-tutorial-target='documents-select-files']",
        fallbackSelector: navSelector("/dashboard/documents")
      },
      {
        id: "documents-retrain",
        instruction: "Run Re-train so the bot learns from the file.",
        selector: "[data-tutorial-target='documents-retrain']",
        fallbackSelector: navSelector("/dashboard/documents")
      }
    ]
  },
  {
    route: "/dashboard/feedback",
    title: "About Feedback",
    summary: "Understand what users liked, what failed, and what to improve next.",
    challenge: "Let's try it! Filter by date range and review recent negatives.",
    steps: [
      {
        id: "feedback-range",
        instruction: "Use filters to focus on a specific time range.",
        selector: "[data-tutorial-target='feedback-range']",
        fallbackSelector: navSelector("/dashboard/feedback")
      }
    ]
  },
  {
    route: "/dashboard/reservations",
    title: "About Reservations",
    summary: "Control booking capacity and track reservation timelines by day.",
    challenge: "Let's try it! Update total capacity and save.",
    steps: [
      {
        id: "reservations-capacity-save",
        instruction: "Set your current capacity and save it.",
        selector: "[data-tutorial-target='reservations-capacity-save']",
        fallbackSelector: navSelector("/dashboard/reservations")
      }
    ]
  },
  {
    route: "/dashboard/leads",
    title: "About Leads",
    summary: "Review captured contacts and quickly jump to their conversations.",
    challenge: "Let's try it! Search leads and open one conversation.",
    steps: [
      {
        id: "leads-search",
        instruction: "Search by name, email, or phone.",
        selector: "[data-tutorial-target='leads-search']",
        fallbackSelector: navSelector("/dashboard/leads")
      },
      {
        id: "leads-open-conversation",
        instruction: "Open a lead's conversation to follow up.",
        selector: "[data-tutorial-target='leads-open-conversation']",
        fallbackSelector: navSelector("/dashboard/leads")
      }
    ]
  },
  {
    route: "/dashboard/conversations",
    title: "About Conversations",
    summary: "View and filter all customer chats in one timeline.",
    challenge: "Let's try it! Search and open one conversation.",
    steps: [
      {
        id: "conversations-search",
        instruction: "Use search to find a specific visitor or chat.",
        selector: "[data-tutorial-target='conversations-search']",
        fallbackSelector: navSelector("/dashboard/conversations")
      },
      {
        id: "conversations-open-row",
        instruction: "Click a row to open the full thread.",
        selector: "[data-tutorial-target='conversations-first-row']",
        fallbackSelector: navSelector("/dashboard/conversations")
      }
    ]
  },
  {
    route: "/dashboard/settings",
    title: "About Settings",
    summary: "Manage widget keys, notifications, and workspace operational controls.",
    challenge: "Let's try it! Save your notification settings.",
    steps: [
      {
        id: "settings-save-notifications",
        instruction: "Set your notification thresholds and save.",
        selector: "[data-tutorial-target='settings-save-notifications']",
        fallbackSelector: navSelector("/dashboard/settings")
      }
    ]
  },
  {
    route: "/dashboard/billing",
    title: "About Billing",
    summary: "Review your current plan and change features for your business.",
    challenge: "Let's try it! Compare plans and pick one to switch.",
    steps: [
      {
        id: "billing-switch-plan",
        instruction: "Use a plan action button to switch your plan.",
        selector: "[data-tutorial-target='billing-switch-plan']",
        fallbackSelector: navSelector("/dashboard/billing")
      }
    ]
  },
  {
    route: "/dashboard/account",
    title: "About Account",
    summary: "Update personal profile details and workspace preferences.",
    challenge: "Let's try it! Edit one field and save changes.",
    steps: [
      {
        id: "account-save",
        instruction: "Save your account profile updates.",
        selector: "[data-tutorial-target='account-save']",
        fallbackSelector: navSelector("/dashboard/account")
      }
    ]
  },
  {
    route: "/dashboard/badges",
    title: "About Badges",
    summary: "Track milestones earned as your bot performance improves.",
    challenge: "Let's try it! Review earned badges and identify the next one to unlock.",
    steps: [
      {
        id: "badges-earned",
        instruction: "Start with earned badges to see your progress.",
        selector: "[data-tutorial-target='badges-earned']",
        fallbackSelector: navSelector("/dashboard/badges")
      }
    ]
  },
  {
    route: "/dashboard",
    title: "About Overview",
    summary: "Overview is your command center for setup progress and performance.",
    challenge: "Let's try it! Finish the setup checklist to activate the dashboard fully.",
    steps: [
      {
        id: "overview-checklist",
        instruction: "Start with the onboarding checklist below.",
        selector: "[data-onboarding-checklist]",
        fallbackSelector: navSelector("/dashboard")
      }
    ]
  }
];

const guidesByRouteLength = [...DASHBOARD_TUTORIAL_GUIDES].sort((a, b) => b.route.length - a.route.length);

export const resolveTutorialGuide = (pathname: string | null) => {
  if (!pathname || !pathname.startsWith("/dashboard")) return null;
  return guidesByRouteLength.find((guide) => pathname === guide.route || pathname.startsWith(`${guide.route}/`)) ?? null;
};
