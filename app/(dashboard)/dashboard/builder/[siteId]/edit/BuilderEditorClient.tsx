"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AppWindow,
  Briefcase,
  Copy,
  FileText,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  PencilLine,
  Search,
  Settings,
  Shapes,
  SlidersHorizontal,
  Trash2
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { useSiteHistoryStore } from "@/lib/website-builder/history/store";
import { useBuilderEditorStore } from "@/lib/website-builder/editor/store";
import { TEMPLATE_ALLOWED_VARIANTS } from "@/lib/website-builder/templates/registry";
import type { NormalizedImage } from "@/lib/website-builder/images/pexels";
import type { SiteApp, SiteDocument, SiteElement, SitePage, SiteSection, SiteImage } from "@/lib/website-builder/types";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const defaultStyle: SiteSection["style"] = {
  alignment: "left",
  spacing: "normal",
  background: { type: "plain" },
  buttonStyle: "solid",
  colorOverride: null
};

const InspectorGroup = ({
  title,
  children,
  defaultOpen = true
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details
    open={defaultOpen}
    className="group rounded-2xl border border-white/10 bg-white/5 p-4 text-white"
  >
    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
      {title}
    </summary>
    <div className="mt-4 space-y-3">{children}</div>
  </details>
);

const SortableRow = ({
  id,
  children,
  trailing,
  onClick,
  className,
  contentClassName
}: {
  id: string;
  children: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
  contentClassName?: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated px-2 py-2 transition ${
        isDragging ? "opacity-60" : ""
      } ${className ?? ""}`}
    >
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 opacity-40 transition group-hover:opacity-100 hover:text-white"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`flex-1 text-left text-sm font-semibold text-white ${contentClassName ?? ""}`}
        >
          {children}
        </button>
      ) : (
        <div className={`flex-1 text-sm font-semibold text-white ${contentClassName ?? ""}`}>{children}</div>
      )}
      {trailing}
    </div>
  );
};

const defaultContentByType: Record<SiteSection["type"], Record<string, any>> = {
  hero: {
    headline: "Headline",
    subheadline: "Add a short description to introduce the business.",
    ctaLabel: "Get started",
    ctaHref: "#contact"
  },
  services: {
    title: "Services",
    items: [
      { title: "Service one", body: "Describe the service in one sentence." },
      { title: "Service two", body: "Describe the service in one sentence." },
      { title: "Service three", body: "Describe the service in one sentence." }
    ]
  },
  about: {
    title: "About",
    body: "Share the story behind this business and what makes it special."
  },
  gallery: {
    title: "Gallery"
  },
  testimonials: {
    title: "Testimonials",
    items: [
      { quote: "Client quote goes here.", name: "Alex Lee", role: "Client" },
      { quote: "Another highlight from a client.", name: "Jamie Park", role: "Client" }
    ]
  },
  pricing: {
    title: "Pricing",
    plans: [
      { name: "Starter", price: "$99", description: "Perfect for essentials.", features: ["Feature one", "Feature two"] },
      { name: "Growth", price: "$199", description: "Best for teams.", features: ["Feature three", "Feature four"] }
    ]
  },
  cta: {
    title: "Ready to start?",
    body: "Tell us about your goals and we will follow up quickly.",
    ctaLabel: "Book a call",
    ctaHref: "#contact"
  },
  faq: {
    title: "FAQ",
    items: [
      { question: "Common question", answer: "Provide a short answer." },
      { question: "Another question", answer: "Provide a short answer." }
    ]
  },
  contact: {
    title: "Contact",
    body: "Share how customers can reach you.",
    email: "",
    phone: "",
    address: ""
  },
  reservation: {
    title: "Reservations",
    body: "Invite customers to book a reservation."
  },
  footer: {
    text: "© Your business. All rights reserved."
  },
  newsletter: {
    title: "Join our newsletter",
    body: "Stay in the loop with updates, launches, and tips.",
    ctaLabel: "Subscribe"
  },
  "blog-index": {
    title: "Blog",
    body: "Latest news and insights from the team.",
    posts: [
      {
        title: "How we deliver standout service",
        excerpt: "A behind-the-scenes look at our process and people.",
        date: "Jan 12"
      },
      {
        title: "3 quick wins for better customer experience",
        excerpt: "Simple adjustments that have a big impact.",
        date: "Jan 05"
      }
    ]
  },
  "blog-post": {
    title: "Blog post title",
    body: "Write the post content here. Manage posts in the dashboard.",
    date: "Featured"
  },
  "store-listing": {
    title: "Shop",
    body: "Browse our featured products.",
    products: [
      { name: "Starter Kit", price: "$49", description: "Essentials to get started." },
      { name: "Premium Bundle", price: "$129", description: "Best value for teams." }
    ]
  },
  "store-product": {
    title: "Featured product",
    body: "Highlight the product details and benefits here.",
    price: "$99"
  },
  "store-cart": {
    title: "Your cart"
  },
  custom: {
    title: "Custom section",
    body: "Add your own elements and layout."
  },
  "app-embed": {
    title: "App widget",
    body: "Configure this app in the Apps panel to finish setup.",
    embedUrl: ""
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value?: string | null) => {
  const raw = (value ?? "").trim().replace("#", "");
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (raw.length === 6) {
    return `#${raw}`;
  }
  return null;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const mixColors = (base: string, overlay: string, amount: number) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const weight = clamp(amount, 0, 1);
  return rgbToHex(
    baseRgb.r + (overlayRgb.r - baseRgb.r) * weight,
    baseRgb.g + (overlayRgb.g - baseRgb.g) * weight,
    baseRgb.b + (overlayRgb.b - baseRgb.b) * weight
  );
};

const getContrastText = (background: string) => {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111827" : "#FFFFFF";
};

const resolveFonts = (fontFamily?: string | null) => {
  const pairs = [
    {
      label: "Sora + Inter",
      value: "Sora, Inter, system-ui, sans-serif",
      heading: "Sora, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    {
      label: "Manrope + Inter",
      value: "Manrope, Inter, system-ui, sans-serif",
      heading: "Manrope, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    {
      label: "Space Grotesk + Inter",
      value: '"Space Grotesk", Inter, system-ui, sans-serif',
      heading: '"Space Grotesk", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    {
      label: "Playfair Display + Inter",
      value: '"Playfair Display", Inter, system-ui, sans-serif',
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    }
  ];

  const match = pairs.find((pair) => pair.value === fontFamily);
  if (match) return match;
  return {
    label: "Custom",
    value: fontFamily ?? "Inter, system-ui, sans-serif",
    heading: fontFamily ?? "Inter, system-ui, sans-serif",
    body: fontFamily ?? "Inter, system-ui, sans-serif"
  };
};

const buildTheme = (primaryColor: string, backgroundColor: string, fontFamily?: string | null) => {
  const primary = normalizeHex(primaryColor) ?? "#111827";
  const bg = normalizeHex(backgroundColor) ?? "#F3F4F6";
  const text = getContrastText(bg);
  const muted = mixColors(text, bg, 0.65);
  const surface = text === "#FFFFFF" ? mixColors(bg, "#111827", 0.35) : mixColors(bg, "#FFFFFF", 0.7);
  const border = text === "#FFFFFF" ? "rgba(255,255,255,0.14)" : "rgba(17,24,39,0.12)";
  const buttonText = getContrastText(primary);
  const fonts = resolveFonts(fontFamily);

  return {
    primary,
    secondary: bg,
    bg,
    text,
    muted,
    surface,
    border,
    buttonText,
    accent: primary,
    radius: "xl" as const,
    fontHeading: fonts.heading,
    fontBody: fonts.body,
    textStyles: {
      h1: { size: "2.75rem", weight: 600, lineHeight: "1.1" },
      h2: { size: "2.1rem", weight: 600, lineHeight: "1.2" },
      h3: { size: "1.6rem", weight: 600, lineHeight: "1.25" },
      body: { size: "1rem", weight: 400, lineHeight: "1.6" },
      caption: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    },
    pageTransitions: "fade" as const
  };
};

const supportsImages = (type: SiteSection["type"]) =>
  ["hero", "about", "gallery", "cta"].includes(type);

const getSlotForType = (type: SiteSection["type"], index: number) => {
  if (type === "gallery") return `gallery-${index + 1}`;
  return type;
};

const SECTION_LABELS: Record<SiteSection["type"], string> = {
  hero: "Hero",
  services: "Services",
  about: "About",
  gallery: "Gallery",
  testimonials: "Testimonials",
  pricing: "Pricing",
  cta: "Call to action",
  faq: "FAQ",
  contact: "Contact",
  reservation: "Reservations",
  footer: "Footer",
  newsletter: "Newsletter",
  "blog-index": "Blog index",
  "blog-post": "Blog post",
  "store-listing": "Store listing",
  "store-product": "Store product",
  "store-cart": "Store cart",
  custom: "Custom section",
  "app-embed": "App embed"
};

const getSectionLabel = (section: SiteSection) => section.name?.trim() || SECTION_LABELS[section.type];

const getElementLabel = (element: SiteElement) => {
  switch (element.type) {
    case "text":
      return `Text · ${element.text.slice(0, 32) || "Text"}`;
    case "button":
      return `Button · ${element.label}`;
    case "image":
      return "Image";
    case "spacer":
      return "Spacer";
    case "divider":
      return "Divider";
    default:
      {
        const _exhaustive: never = element;
        return _exhaustive;
      }
  }
};

const SECTION_LIBRARY: Array<{
  title: string;
  description: string;
  items: Array<{ type: SiteSection["type"]; label: string; blurb: string }>;
}> = [
  {
    title: "Welcome",
    description: "Introduce the business and highlight the core offer.",
    items: [
      { type: "hero", label: SECTION_LABELS.hero, blurb: "Headline, subheadline, and primary CTA." },
      { type: "about", label: SECTION_LABELS.about, blurb: "Share the story and mission." },
      { type: "services", label: SECTION_LABELS.services, blurb: "Summarize the top services." }
    ]
  },
  {
    title: "Social proof",
    description: "Build credibility with testimonials and FAQs.",
    items: [
      { type: "testimonials", label: SECTION_LABELS.testimonials, blurb: "Client quotes and roles." },
      { type: "faq", label: SECTION_LABELS.faq, blurb: "Answer common questions quickly." }
    ]
  },
  {
    title: "Media",
    description: "Showcase visuals and brand moments.",
    items: [{ type: "gallery", label: SECTION_LABELS.gallery, blurb: "A curated image grid." }]
  },
  {
    title: "Conversion",
    description: "Encourage bookings, inquiries, and purchases.",
    items: [
      { type: "pricing", label: SECTION_LABELS.pricing, blurb: "Plan and package comparisons." },
      { type: "cta", label: SECTION_LABELS.cta, blurb: "Strong call to action block." },
      { type: "contact", label: SECTION_LABELS.contact, blurb: "Email, phone, and address." },
      { type: "reservation", label: SECTION_LABELS.reservation, blurb: "Reservation form for restaurants." }
    ]
  },
  {
    title: "Footer",
    description: "Close the page with essential info.",
    items: [{ type: "footer", label: SECTION_LABELS.footer, blurb: "Copyright and small print." }]
  },
  {
    title: "Engagement",
    description: "Capture leads and grow your list.",
    items: [{ type: "newsletter", label: SECTION_LABELS.newsletter, blurb: "Email signup form." }]
  },
  {
    title: "Content",
    description: "Share updates and long-form stories.",
    items: [
      { type: "blog-index", label: SECTION_LABELS["blog-index"], blurb: "Blog overview grid." },
      { type: "blog-post", label: SECTION_LABELS["blog-post"], blurb: "Single post layout." }
    ]
  },
  {
    title: "Commerce",
    description: "Introduce a simple storefront flow.",
    items: [
      { type: "store-listing", label: SECTION_LABELS["store-listing"], blurb: "Product listing grid." },
      { type: "store-product", label: SECTION_LABELS["store-product"], blurb: "Product detail layout." },
      { type: "store-cart", label: SECTION_LABELS["store-cart"], blurb: "Cart summary card." }
    ]
  },
  {
    title: "Custom",
    description: "Start from a blank canvas.",
    items: [{ type: "custom", label: SECTION_LABELS.custom, blurb: "Blank section with your elements." }]
  }
];

const THEME_PRESETS = [
  {
    label: "Modern Slate",
    primary: "#111827",
    background: "#F3F4F6",
    font: "Sora, Inter, system-ui, sans-serif"
  },
  {
    label: "Coastal",
    primary: "#0F766E",
    background: "#F0FDFA",
    font: "Manrope, Inter, system-ui, sans-serif"
  },
  {
    label: "Warm Sand",
    primary: "#C2410C",
    background: "#FFF7ED",
    font: '"Playfair Display", Inter, system-ui, sans-serif'
  },
  {
    label: "Studio Blue",
    primary: "#1D4ED8",
    background: "#EFF6FF",
    font: '"Space Grotesk", Inter, system-ui, sans-serif'
  }
];

const TEXT_SCALE_PRESETS = [
  {
    id: "compact",
    label: "Compact",
    styles: {
      h1: { size: "2.4rem", weight: 600, lineHeight: "1.1" },
      h2: { size: "1.9rem", weight: 600, lineHeight: "1.2" },
      h3: { size: "1.4rem", weight: 600, lineHeight: "1.25" },
      body: { size: "0.95rem", weight: 400, lineHeight: "1.55" },
      caption: { size: "0.85rem", weight: 400, lineHeight: "1.5" }
    }
  },
  {
    id: "classic",
    label: "Classic",
    styles: {
      h1: { size: "2.75rem", weight: 600, lineHeight: "1.1" },
      h2: { size: "2.1rem", weight: 600, lineHeight: "1.2" },
      h3: { size: "1.6rem", weight: 600, lineHeight: "1.25" },
      body: { size: "1rem", weight: 400, lineHeight: "1.6" },
      caption: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  {
    id: "editorial",
    label: "Editorial",
    styles: {
      h1: { size: "3rem", weight: 600, lineHeight: "1.1" },
      h2: { size: "2.35rem", weight: 600, lineHeight: "1.2" },
      h3: { size: "1.75rem", weight: 600, lineHeight: "1.25" },
      body: { size: "1.05rem", weight: 400, lineHeight: "1.7" },
      caption: { size: "0.9rem", weight: 400, lineHeight: "1.6" }
    }
  }
];

const CHAT_PROMPT_TEXT_MAX = 120;
const CHAT_PROMPT_CTA_MAX = 30;
const DEFAULT_CHAT_PROMPT_TEXT = "Have questions or want to make a reservation? Use our chatbot →";
const DEFAULT_CHAT_PROMPT_CTA = "Open chat";

const APP_MARKET = [
  {
    id: "live-chat" as const,
    name: "Live Chat",
    description: "Add a floating chat launcher to engage visitors.",
    requiresSetup: false
  },
  {
    id: "newsletter" as const,
    name: "Newsletter Signup",
    description: "Capture emails with a signup section.",
    requiresSetup: false
  },
  {
    id: "analytics" as const,
    name: "Analytics (Google)",
    description: "Embed Google Analytics tracking.",
    requiresSetup: true
  },
  {
    id: "booking-widget" as const,
    name: "Booking Widget",
    description: "Embed your booking provider widget.",
    requiresSetup: true
  }
];

const BUSINESS_FEATURES = [
  {
    id: "store" as const,
    name: "Store",
    description: "Product listing, product detail, and cart pages (payments coming soon)."
  },
  {
    id: "blog" as const,
    name: "Blog",
    description: "Blog home and post template pages with mock content."
  }
];

type BuilderSite = {
  id: string;
  status: "draft" | "published" | "error";
  slug: string;
  businessName: string;
  siteDocument: SiteDocument;
  publishedUrl: string | null;
};

type BuilderEditorClientProps = {
  initialSite: BuilderSite;
  canPublish: boolean;
};

type LeftPanel =
  | "pages"
  | "sections"
  | "elements"
  | "design"
  | "media"
  | "apps"
  | "business"
  | "tools"
  | "help"
  | "dev";
type AppsPanelTab = "market" | "manage";

export function BuilderEditorClient({ initialSite, canPublish }: BuilderEditorClientProps) {
  const { past, present, future, setPresent, commit, undo, redo } = useSiteHistoryStore();
  const { push: pushToast } = useToast();
  const { selectedNode, setSelectedNode } = useBuilderEditorStore();
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("pages");
  const [appsPanelTab, setAppsPanelTab] = useState<AppsPanelTab>("market");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftSearchQuery, setLeftSearchQuery] = useState("");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<NormalizedImage[]>([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageTarget, setImageTarget] = useState<{ slot: string; mode: "replace" | "append" } | null>(null);
  const [mediaTarget, setMediaTarget] = useState<{ kind: "section" | "element"; id: string } | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [rulersEnabled, setRulersEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [helpQuery, setHelpQuery] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [aiSectionPrompt, setAiSectionPrompt] = useState("");
  const [aiSectionLoading, setAiSectionLoading] = useState(false);
  const [themePrompt, setThemePrompt] = useState("");
  const [themeAssistantLoading, setThemeAssistantLoading] = useState(false);
  const [appConfigId, setAppConfigId] = useState<SiteApp["id"] | null>(null);
  const [publishedUrl, setPublishedUrl] = useState(initialSite.publishedUrl);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishNeedsUpgrade, setPublishNeedsUpgrade] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishSuccessOpen, setPublishSuccessOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SiteSection | null>(null);
  const [pageDeleteConfirm, setPageDeleteConfirm] = useState<SitePage | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState("");
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPresent(initialSite.siteDocument);
  }, [initialSite.siteDocument, setPresent]);

  const document = present;
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  useEffect(() => {
    if (!document) return;
    if (!activePageId || !document.pages.some((page) => page.id === activePageId)) {
      setActivePageId(document.pages[0]?.id ?? null);
    }
  }, [activePageId, document]);

  const activePage = useMemo(() => {
    if (!document?.pages?.length) return null;
    return document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  }, [activePageId, document]);

  useEffect(() => {
    if (!activePageId) {
      setSelectedNode(null);
      return;
    }
    setSelectedNode({ type: "page", id: activePageId });
  }, [activePageId, setSelectedNode]);

  const sections = useMemo(() => activePage?.sections ?? [], [activePage]);
  const selectedSectionId =
    selectedNode?.type === "section"
      ? selectedNode.id
      : selectedNode?.type === "element"
        ? selectedNode.parentId ?? null
        : null;
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );
  const selectedElement = useMemo(() => {
    if (!selectedSection || selectedNode?.type !== "element") return null;
    return selectedSection.elements?.find((element) => element.id === selectedNode.id) ?? null;
  }, [selectedSection, selectedNode]);
  const apps = useMemo(() => document?.apps ?? [], [document]);
  const menuPages = useMemo(
    () => document?.pages.filter((page) => page.showInMenu !== false && !page.isSystem) ?? [],
    [document]
  );
  const systemPages = useMemo(
    () => document?.pages.filter((page) => page.isSystem) ?? [],
    [document]
  );
  const storeInstalled = useMemo(
    () =>
      document?.pages.some((page) => page.systemGroup === "Store Pages" || page.slug === "store-product") ?? false,
    [document]
  );
  const blogInstalled = useMemo(
    () =>
      document?.pages.some((page) => page.systemGroup === "Blog Pages" || page.slug === "blog-post") ?? false,
    [document]
  );
  const panelTabs = useMemo(
    () =>
      ([
        { id: "pages", label: "Pages", icon: FileText, visible: true },
        { id: "sections", label: "Sections", icon: LayoutGrid, visible: true },
        { id: "elements", label: "Elements", icon: Shapes, visible: true },
        { id: "design", label: "Theme", icon: Palette, visible: true },
        { id: "media", label: "Media", icon: ImageIcon, visible: true },
        { id: "apps", label: "Apps", icon: AppWindow, visible: true },
        { id: "business", label: "Business", icon: Briefcase, visible: true },
        { id: "tools", label: "Tools", icon: SlidersHorizontal, visible: true },
        { id: "help", label: "Help", icon: HelpCircle, visible: true },
        { id: "dev", label: "Dev", icon: Settings, visible: devModeEnabled }
      ] as Array<{ id: LeftPanel; label: string; icon: typeof FileText; visible: boolean }>),
    [devModeEnabled]
  );
  const nextImageSlot = selectedSection
    ? getSlotForType(selectedSection.type, selectedSection.images?.length ?? 0)
    : null;
  const uploadSlot = imageTarget?.slot ?? nextImageSlot;
  const leftSearchActive = leftPanel === "sections" || leftPanel === "elements";
  const normalizedSearch = leftSearchActive ? leftSearchQuery.trim().toLowerCase() : "";
  const structureSections = useMemo(() => {
    if (!normalizedSearch) return sections;
    return sections.filter((section) => getSectionLabel(section).toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, sections]);
  const filteredSectionLibrary = useMemo(() => {
    if (!normalizedSearch) return SECTION_LIBRARY;
    return SECTION_LIBRARY.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [item.label, item.blurb, group.title].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        )
      )
    })).filter((group) => group.items.length);
  }, [normalizedSearch]);
  const elementLibrary = useMemo(
    () => [
      {
        id: "heading",
        label: "Heading",
        description: "Display a bold title or callout.",
        type: "text" as const,
        build: () => ({
          id: createId(),
          type: "text" as const,
          text: "Heading text",
          textStyle: "h2" as const,
          align: selectedSection?.style.alignment ?? "left"
        })
      },
      {
        id: "paragraph",
        label: "Paragraph",
        description: "Body copy and supporting text.",
        type: "text" as const,
        build: () => ({
          id: createId(),
          type: "text" as const,
          text: "Body copy goes here.",
          textStyle: "body" as const,
          align: selectedSection?.style.alignment ?? "left"
        })
      },
      {
        id: "button",
        label: "Button",
        description: "Primary call-to-action button.",
        type: "button" as const,
        build: () => ({
          id: createId(),
          type: "button" as const,
          label: "Learn more",
          href: "#contact",
          variant: "primary" as const,
          align: selectedSection?.style.alignment ?? "left"
        })
      },
      {
        id: "image",
        label: "Image",
        description: "Inline media or illustration.",
        type: "image" as const,
        build: () => ({
          id: createId(),
          type: "image" as const,
          src:
            (document?.mediaLibrary ?? [])[0]?.src ??
            "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1200",
          alt: "Section image"
        })
      },
      {
        id: "spacer",
        label: "Spacer",
        description: "Add breathing room between blocks.",
        type: "spacer" as const,
        build: () => ({
          id: createId(),
          type: "spacer" as const,
          height: 24
        })
      },
      {
        id: "divider",
        label: "Divider",
        description: "Subtle horizontal rule.",
        type: "divider" as const,
        build: () => ({
          id: createId(),
          type: "divider" as const,
          thickness: 1,
          color: document?.theme.border ?? "#E2E8F0"
        })
      }
    ],
    [document?.mediaLibrary, document?.theme.border, selectedSection?.style.alignment]
  );
  const filteredElementLibrary = useMemo(() => {
    if (!normalizedSearch) return elementLibrary;
    return elementLibrary.filter((item) =>
      [item.label, item.description].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [elementLibrary, normalizedSearch]);

  useEffect(() => {
    if (!leftSearchActive && leftSearchQuery) {
      setLeftSearchQuery("");
    }
  }, [leftSearchActive, leftSearchQuery]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "section:select") {
        const sectionId = event.data.sectionId as string | undefined;
        if (sectionId) {
          setSelectedNode({ type: "section", id: sectionId, parentId: activePageId });
        }
        return;
      }
      if (event.data?.type === "element:select") {
        const sectionId = event.data.sectionId as string | undefined;
        const elementId = event.data.elementId as string | undefined;
        if (sectionId && elementId) {
          setSelectedNode({ type: "element", id: elementId, parentId: sectionId });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activePageId, setSelectedNode]);

  useEffect(() => {
    if (!previewRef.current?.contentWindow) return;
    previewRef.current.contentWindow.postMessage(
      {
        type: "section:highlight",
        sectionId: selectedSectionId
      },
      "*"
    );
    previewRef.current.contentWindow.postMessage(
      {
        type: "element:highlight",
        elementId: selectedNode?.type === "element" ? selectedNode.id : null
      },
      "*"
    );
  }, [selectedSectionId, selectedNode]);

  useEffect(() => {
    setImageTarget(null);
    setMediaTarget(null);
    setImageSearchQuery("");
    setImageSearchResults([]);
  }, [selectedSectionId]);

  // Escape closes side panels on small screens.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const saveDraft = useCallback(
    async (source: "auto" | "manual" = "manual") => {
      if (!document) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (source === "manual") {
        setSaveState("saving");
      }
      try {
        const response = await fetch("/api/builder/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: initialSite.id,
            siteDocument: document
          })
        });

        if (!response.ok) {
          throw new Error("Save failed");
        }

        setSaveState("saved");
        setLastSavedAt(new Date());
      } catch (error) {
        console.error("[BUILDER_SAVE_ERROR]", error);
        setSaveState("error");
      }
    },
    [document, initialSite.id]
  );

  useEffect(() => {
    if (!document) return;
    setSaveState("saving");
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      saveDraft("auto");
    }, 500);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [document, saveDraft]);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node) return;

    const width = viewport === "desktop" ? 1280 : 375;

    const updateScale = () => {
      const containerWidth = node.clientWidth;
      const nextScale = Math.min(1, containerWidth / width) * zoomLevel;
      setPreviewScale(nextScale);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);

    return () => observer.disconnect();
  }, [viewport, zoomLevel]);

  const commitDocument = (updater: (doc: SiteDocument) => SiteDocument) => {
    if (!document) return;
    commit(updater(document));
  };

  const updatePage = (pageId: string, updater: (page: SitePage) => SitePage) => {
    commitDocument((doc) => ({
      ...doc,
      pages: doc.pages.map((page) => (page.id === pageId ? updater(page) : page))
    }));
  };

  const updateSection = (sectionId: string, updater: (section: SiteSection) => SiteSection) => {
    if (!activePage) return;
    updatePage(activePage.id, (page) => ({
      ...page,
      sections: page.sections.map((section) => (section.id === sectionId ? updater(section) : section))
    }));
  };

  const reorderSections = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    if (!activePage) return;
    commitDocument((doc) => {
      const pageIndex = doc.pages.findIndex((page) => page.id === activePage.id);
      if (pageIndex === -1) return doc;
      const list = [...doc.pages[pageIndex].sections];
      const sourceIndex = list.findIndex((section) => section.id === sourceId);
      const targetIndex = list.findIndex((section) => section.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return doc;
      const [moved] = list.splice(sourceIndex, 1);
      list.splice(targetIndex, 0, moved);
      const pages = [...doc.pages];
      pages[pageIndex] = { ...pages[pageIndex], sections: list };
      return { ...doc, pages };
    });
  };

  const updateSectionName = (sectionId: string, name: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      name: name.trim() || undefined
    }));
  };

  const reorderElements = (sectionId: string, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    updateSection(sectionId, (section) => {
      const list = section.elements ? [...section.elements] : [];
      const sourceIndex = list.findIndex((element) => element.id === sourceId);
      const targetIndex = list.findIndex((element) => element.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return section;
      return { ...section, elements: arrayMove(list, sourceIndex, targetIndex) };
    });
  };

  const toggleSection = (sectionId: string) => {
    updateSection(sectionId, (section) => ({ ...section, enabled: !section.enabled }));
  };

  const duplicateSection = (sectionId: string) => {
    if (!activePage) return;
    commitDocument((doc) => {
      const pageIndex = doc.pages.findIndex((page) => page.id === activePage.id);
      if (pageIndex === -1) return doc;
      const list = [...doc.pages[pageIndex].sections];
      const index = list.findIndex((section) => section.id === sectionId);
      if (index === -1) return doc;
      const clone = {
        ...list[index],
        id: createId(),
        content: JSON.parse(JSON.stringify(list[index].content)),
        images: list[index].images ? JSON.parse(JSON.stringify(list[index].images)) : undefined,
        elements: list[index].elements ? JSON.parse(JSON.stringify(list[index].elements)) : undefined
      };
      list.splice(index + 1, 0, clone);
      const pages = [...doc.pages];
      pages[pageIndex] = { ...pages[pageIndex], sections: list };
      return { ...doc, pages };
    });
  };

  const duplicateElement = (sectionId: string, elementId: string) => {
    updateSection(sectionId, (section) => {
      const list = section.elements ? [...section.elements] : [];
      const index = list.findIndex((element) => element.id === elementId);
      if (index === -1) return section;
      const clone = { ...JSON.parse(JSON.stringify(list[index])), id: createId() } as SiteElement;
      list.splice(index + 1, 0, clone);
      return { ...section, elements: list };
    });
  };

  const deleteSection = (sectionId: string) => {
    if (!activePage) return;
    commitDocument((doc) => {
      const pageIndex = doc.pages.findIndex((page) => page.id === activePage.id);
      if (pageIndex === -1) return doc;
      const pages = [...doc.pages];
      pages[pageIndex] = {
        ...pages[pageIndex],
        sections: pages[pageIndex].sections.filter((section) => section.id !== sectionId)
      };
      return { ...doc, pages };
    });
    if (selectedSectionId === sectionId) {
      setSelectedNode(activePage ? { type: "page", id: activePage.id } : null);
    }
  };

  const addSection = (type: SiteSection["type"]) => {
    if (!activePage) return;
    const newSectionId = createId();
    commitDocument((doc) => {
      const allowedVariants = TEMPLATE_ALLOWED_VARIANTS[doc.templateId]?.[type] ?? ["A"];
      const newSection: SiteSection = {
        id: newSectionId,
        type,
        variant: allowedVariants[0],
        enabled: true,
        style: { ...defaultStyle },
        content: { ...defaultContentByType[type] }
      };
      const pages = doc.pages.map((page) =>
        page.id === activePage.id ? { ...page, sections: [...page.sections, newSection] } : page
      );
      return { ...doc, pages };
    });
    setSelectedNode({ type: "section", id: newSectionId, parentId: activePage.id });
  };

  const buildBlankSection = (): SiteSection => ({
    id: createId(),
    type: "custom",
    variant: "A",
    enabled: true,
    style: { ...defaultStyle },
    content: { ...defaultContentByType.custom }
  });

  const resolveFooterSection = (doc: SiteDocument) => {
    const footer =
      doc.pages.flatMap((page) => page.sections).find((section) => section.type === "footer") ?? null;
    if (!footer) return null;
    return {
      ...footer,
      id: createId(),
      content: JSON.parse(JSON.stringify(footer.content ?? {})),
      images: footer.images ? JSON.parse(JSON.stringify(footer.images)) : undefined,
      elements: footer.elements ? JSON.parse(JSON.stringify(footer.elements)) : undefined
    };
  };

  const ensureUniqueSlug = (slug: string, pages: SitePage[], pageId?: string) => {
    const base = slug || "page";
    let candidate = base;
    let counter = 1;
    const exists = (value: string) =>
      pages.some((page) => page.slug === value && (!pageId || page.id !== pageId));
    while (exists(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  };

  const addPage = (name: string) => {
    commitDocument((doc) => {
      const slug = ensureUniqueSlug(slugify(name), doc.pages);
      const order = Math.max(0, ...doc.pages.map((page) => page.order ?? 0)) + 1;
      const footer = resolveFooterSection(doc);
      const sections = footer ? [buildBlankSection(), footer] : [buildBlankSection()];
      const nextPage: SitePage = {
        id: createId(),
        name,
        slug: slug || "page",
        showInMenu: true,
        menuTitle: name,
        parentId: null,
        order,
        sections
      };
      return { ...doc, pages: [...doc.pages, nextPage] };
    });
  };

  const updatePageMeta = (pageId: string, updates: Partial<SitePage>) => {
    updatePage(pageId, (page) => ({ ...page, ...updates }));
  };

  const reorderPages = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    commitDocument((doc) => {
      const list = [...doc.pages.filter((page) => !page.isSystem)];
      const systemPages = doc.pages.filter((page) => page.isSystem);
      const sourceIndex = list.findIndex((page) => page.id === sourceId);
      const targetIndex = list.findIndex((page) => page.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return doc;
      const [moved] = list.splice(sourceIndex, 1);
      list.splice(targetIndex, 0, moved);
      const ordered = list.map((page, index) => ({ ...page, order: index }));
      return { ...doc, pages: [...ordered, ...systemPages] };
    });
  };

  const deletePage = (pageId: string) => {
    commitDocument((doc) => ({
      ...doc,
      pages: doc.pages.filter((page) => page.id !== pageId)
    }));
    if (activePageId === pageId) {
      setActivePageId(document?.pages.find((page) => page.id !== pageId)?.id ?? null);
    }
  };

  const addElement = (sectionId: string, element: SiteElement) => {
    updateSection(sectionId, (section) => ({
      ...section,
      elements: [...(section.elements ?? []), element]
    }));
  };

  const updateElement = (sectionId: string, elementId: string, updater: (element: SiteElement) => SiteElement) => {
    updateSection(sectionId, (section) => ({
      ...section,
      elements: (section.elements ?? []).map((element) =>
        element.id === elementId ? updater(element) : element
      )
    }));
  };

  const removeElement = (sectionId: string, elementId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      elements: (section.elements ?? []).filter((element) => element.id !== elementId)
    }));
    if (selectedNode?.type === "element" && selectedNode.id === elementId) {
      setSelectedNode({ type: "section", id: sectionId, parentId: activePage?.id ?? undefined });
    }
  };

  const updateTheme = (primary: string, background: string, fontFamily?: string | null) => {
    commitDocument((doc) => ({
      ...doc,
      theme: buildTheme(primary, background, fontFamily ?? doc.theme.fontBody)
    }));
  };

  const storeMediaAsset = (image: SiteImage) => {
    commitDocument((doc) => {
      const library = doc.mediaLibrary ?? [];
      if (library.some((item) => item.src === image.src)) {
        return doc;
      }
      return {
        ...doc,
        mediaLibrary: [...library, image]
      };
    });
  };

  const applyTextScale = (presetId: string) => {
    const preset = TEXT_SCALE_PRESETS.find((option) => option.id === presetId);
    if (!preset) return;
    commitDocument((doc) => ({
      ...doc,
      theme: {
        ...doc.theme,
        textStyles: preset.styles
      }
    }));
  };

  const updatePageTransition = (transition: "none" | "fade" | "slide") => {
    commitDocument((doc) => ({
      ...doc,
      theme: {
        ...doc.theme,
        pageTransitions: transition
      }
    }));
  };

  const updateCustomCode = (field: "head" | "body", value: string) => {
    commitDocument((doc) => ({
      ...doc,
      customCode: {
        head: field === "head" ? value : doc.customCode?.head ?? null,
        body: field === "body" ? value : doc.customCode?.body ?? null
      }
    }));
  };

  const updateChatPrompt = (
    updates: Partial<
      Pick<
        SiteDocument,
        | "chat_prompt_topbar_enabled"
        | "chat_prompt_topbar_text"
        | "chat_prompt_topbar_cta"
        | "chat_launcher_glow_enabled"
      >
    >
  ) => {
    commitDocument((doc) => ({
      ...doc,
      ...updates
    }));
  };

  const normalizeChatPromptCopy = (value: string, fallback: string, maxLength: number) => {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  };

  const searchImages = async () => {
    if (!imageSearchQuery.trim()) return;
    setImageSearchLoading(true);
    try {
      const response = await fetch(`/api/images/search?q=${encodeURIComponent(imageSearchQuery.trim())}`);
      if (!response.ok) throw new Error("Search failed");
      const data = (await response.json()) as NormalizedImage[];
      setImageSearchResults(data);
    } catch (error) {
      console.error("[IMAGE_SEARCH_ERROR]", error);
      setImageSearchResults([]);
    } finally {
      setImageSearchLoading(false);
    }
  };

  const applyImageResult = (result: NormalizedImage) => {
    if (!selectedSection || !imageTarget) return;

    updateSection(selectedSection.id, (section) => {
      const nextImages = section.images ? [...section.images] : [];
      if (imageTarget.mode === "replace") {
        const index = nextImages.findIndex((image) => image.slot === imageTarget.slot);
        if (index !== -1) {
          nextImages[index] = {
            slot: imageTarget.slot,
            src: result.url,
            alt: result.alt,
            credit: {
              provider: "pexels",
              photographer: result.photographer,
              sourceUrl: result.sourceUrl
            },
            query: imageSearchQuery.trim()
          };
        }
      } else {
        nextImages.push({
          slot: imageTarget.slot,
          src: result.url,
          alt: result.alt,
          credit: {
            provider: "pexels",
            photographer: result.photographer,
            sourceUrl: result.sourceUrl
          },
          query: imageSearchQuery.trim()
        });
      }
      return { ...section, images: nextImages };
    });

    storeMediaAsset({
      slot: "library",
      src: result.url,
      alt: result.alt,
      credit: {
        provider: "pexels",
        photographer: result.photographer,
        sourceUrl: result.sourceUrl
      },
      query: imageSearchQuery.trim()
    });
  };

  const applyMediaResult = (result: NormalizedImage) => {
    if (!selectedSection) return;
    if (mediaTarget?.kind === "element") {
      updateElement(selectedSection.id, mediaTarget.id, (element) => {
        if (element.type !== "image") return element;
        return {
          ...element,
          src: result.url,
          alt: result.alt ?? element.alt
        };
      });
      storeMediaAsset({
        slot: "library",
        src: result.url,
        alt: result.alt,
        credit: {
          provider: "pexels",
          photographer: result.photographer,
          sourceUrl: result.sourceUrl
        },
        query: imageSearchQuery.trim()
      });
      setMediaTarget(null);
      return;
    }

    if (imageTarget) {
      applyImageResult(result);
      return;
    }
  };

  const applyMediaAsset = (asset: SiteImage) => {
    if (!selectedSection) return;
    if (mediaTarget?.kind === "element") {
      updateElement(selectedSection.id, mediaTarget.id, (element) => {
        if (element.type !== "image") return element;
        return { ...element, src: asset.src, alt: asset.alt ?? element.alt };
      });
      setMediaTarget(null);
      return;
    }
    if (imageTarget) {
      updateSection(selectedSection.id, (section) => {
        const nextImages = section.images ? [...section.images] : [];
        if (imageTarget.mode === "replace") {
          const index = nextImages.findIndex((image) => image.slot === imageTarget.slot);
          if (index !== -1) {
            nextImages[index] = { ...asset, slot: imageTarget.slot };
          }
        } else {
          nextImages.push({ ...asset, slot: imageTarget.slot });
        }
        return { ...section, images: nextImages };
      });
      return;
    }
  };

  const shuffleImage = async (imageSlot: string) => {
    if (!selectedSection?.images) return;
    const current = selectedSection.images.find((image) => image.slot === imageSlot);
    if (!current?.query) return;

    try {
      const response = await fetch(`/api/images/search?q=${encodeURIComponent(current.query)}`);
      if (!response.ok) return;
      const data = (await response.json()) as NormalizedImage[];
      const next = data.find((image) => image.url !== current.src) ?? data[0];
      if (!next) return;

      updateSection(selectedSection.id, (section) => {
        const nextImages = section.images ? [...section.images] : [];
        const index = nextImages.findIndex((image) => image.slot === imageSlot);
        if (index === -1) return section;
        nextImages[index] = {
          slot: imageSlot,
          src: next.url,
          alt: next.alt,
          credit: {
            provider: "pexels",
            photographer: next.photographer,
            sourceUrl: next.sourceUrl
          },
          query: current.query
        };
        return { ...section, images: nextImages };
      });
    } catch (error) {
      console.error("[IMAGE_SHUFFLE_ERROR]", error);
    }
  };

  const uploadImage = async (file: File, slot: string) => {
    if (!selectedSection) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("siteId", initialSite.id);
    formData.append("kind", selectedSection.type === "hero" ? "hero" : selectedSection.type === "gallery" ? "gallery" : "other");

    try {
      const response = await fetch("/api/builder/upload-image", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (!data?.url) return;

      updateSection(selectedSection.id, (section) => {
        const nextImages = section.images ? [...section.images] : [];
        const index = nextImages.findIndex((image) => image.slot === slot);
        const imagePayload = { slot, src: data.url, alt: "Uploaded image" };
        if (index === -1) {
          nextImages.push(imagePayload);
        } else {
          nextImages[index] = imagePayload;
        }
        return { ...section, images: nextImages };
      });

      storeMediaAsset({ slot: "library", src: data.url, alt: "Uploaded image" });
    } catch (error) {
      console.error("[IMAGE_UPLOAD_ERROR]", error);
    }
  };

  const uploadMediaAsset = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("siteId", initialSite.id);
    formData.append("kind", "other");

    try {
      const response = await fetch("/api/builder/upload-image", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (!data?.url) return;
      storeMediaAsset({ slot: "library", src: data.url, alt: "Uploaded image" });
    } catch (error) {
      console.error("[MEDIA_UPLOAD_ERROR]", error);
    }
  };

  const installApp = (appId: SiteApp["id"]) => {
    if (!document) return;
    const appMeta = APP_MARKET.find((app) => app.id === appId);
    if (!appMeta) return;
    const now = new Date().toISOString();
    const targetPageId = activePage?.id ?? document.pages[0]?.id ?? null;

    commitDocument((doc) => {
      if ((doc.apps ?? []).some((app) => app.id === appId)) {
        return doc;
      }

      const nextApp: SiteApp = {
        id: appId,
        name: appMeta.name,
        installedAt: now,
        enabled: true,
        config:
          appId === "live-chat"
            ? {
                script:
                  "(function(){var btn=document.createElement('button');btn.innerText='Chat with us';btn.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 16px;border-radius:999px;border:none;background:#111827;color:white;font-weight:600';btn.onclick=function(){alert('Live chat is connected. Replace this demo script with your provider.');};document.body.appendChild(btn);})();"
              }
            : appId === "analytics"
              ? { measurementId: "" }
              : appId === "booking-widget"
                ? { embedUrl: "" }
                : undefined
      };

      let nextPages = [...doc.pages];

      if (appId === "newsletter" && targetPageId) {
        const newsletterSection: SiteSection = {
          id: createId(),
          type: "newsletter",
          variant: "A",
          enabled: true,
          style: { ...defaultStyle },
          content: { ...defaultContentByType.newsletter }
        };
        nextPages = nextPages.map((page) =>
          page.id === targetPageId ? { ...page, sections: [...page.sections, newsletterSection] } : page
        );
      }

      if (appId === "booking-widget" && targetPageId) {
        const appSection: SiteSection = {
          id: createId(),
          type: "app-embed",
          variant: "A",
          enabled: true,
          style: { ...defaultStyle },
          content: { ...defaultContentByType["app-embed"], appId: "booking-widget" }
        };
        nextPages = nextPages.map((page) =>
          page.id === targetPageId ? { ...page, sections: [...page.sections, appSection] } : page
        );
      }

      return {
        ...doc,
        apps: [...(doc.apps ?? []), nextApp],
        pages: nextPages
      };
    });

    pushToast({ title: "App added", message: "Manage in ‘Apps’ panel.", variant: "success" });

    if (appMeta.requiresSetup) {
      setLeftPanel("apps");
      setLeftPanelOpen(true);
      setAppsPanelTab("manage");
      setAppConfigId(appId);
    }
  };

  const updateAppConfig = (appId: SiteApp["id"], updates: Record<string, any>) => {
    commitDocument((doc) => {
      const apps = (doc.apps ?? []).map((app) =>
        app.id === appId ? { ...app, config: { ...(app.config ?? {}), ...updates } } : app
      );
      let pages = doc.pages;
      if (appId === "booking-widget" && updates.embedUrl) {
        pages = doc.pages.map((page) => ({
          ...page,
          sections: page.sections.map((section) =>
            section.type === "app-embed"
              ? { ...section, content: { ...section.content, embedUrl: updates.embedUrl } }
              : section
          )
        }));
      }
      return { ...doc, apps, pages };
    });
  };

  const toggleAppEnabled = (appId: SiteApp["id"]) => {
    commitDocument((doc) => ({
      ...doc,
      apps: (doc.apps ?? []).map((app) =>
        app.id === appId ? { ...app, enabled: !app.enabled } : app
      )
    }));
  };

  const uninstallApp = (appId: SiteApp["id"]) => {
    commitDocument((doc) => {
      let pages = doc.pages;
      if (appId === "newsletter") {
        pages = pages.map((page) => ({
          ...page,
          sections: page.sections.filter((section) => section.type !== "newsletter")
        }));
      }
      if (appId === "booking-widget") {
        pages = pages.map((page) => ({
          ...page,
          sections: page.sections.filter((section) => section.type !== "app-embed")
        }));
      }
      return {
        ...doc,
        apps: (doc.apps ?? []).filter((app) => app.id !== appId),
        pages
      };
    });
  };

  const installStoreFeature = () => {
    if (!document || storeInstalled) return;
    const orderBase = Math.max(0, ...document.pages.map((page) => page.order ?? 0)) + 1;
    const footer = resolveFooterSection(document);
    const listingPageId = createId();
    const productPageId = createId();
    const cartPageId = createId();

    const listingSection: SiteSection = {
      id: createId(),
      type: "store-listing",
      variant: "A",
      enabled: true,
      style: { ...defaultStyle },
      content: { ...defaultContentByType["store-listing"] }
    };

    const productSection: SiteSection = {
      id: createId(),
      type: "store-product",
      variant: "A",
      enabled: true,
      style: { ...defaultStyle },
      content: { ...defaultContentByType["store-product"] }
    };

    const cartSection: SiteSection = {
      id: createId(),
      type: "store-cart",
      variant: "A",
      enabled: true,
      style: { ...defaultStyle },
      content: { ...defaultContentByType["store-cart"] }
    };

    const listingPage: SitePage = {
      id: listingPageId,
      name: "Shop",
      slug: ensureUniqueSlug("shop", document.pages),
      showInMenu: true,
      menuTitle: "Shop",
      parentId: null,
      order: orderBase,
      sections: footer ? [listingSection, footer] : [listingSection]
    };

    const productPage: SitePage = {
      id: productPageId,
      name: "Product",
      slug: ensureUniqueSlug("store-product", [...document.pages, listingPage]),
      showInMenu: false,
      menuTitle: "Product",
      parentId: null,
      order: orderBase + 1,
      isSystem: true,
      systemGroup: "Store Pages",
      sections: footer ? [productSection, footer] : [productSection]
    };

    const cartPage: SitePage = {
      id: cartPageId,
      name: "Cart",
      slug: ensureUniqueSlug("store-cart", [...document.pages, listingPage, productPage]),
      showInMenu: false,
      menuTitle: "Cart",
      parentId: null,
      order: orderBase + 2,
      isSystem: true,
      systemGroup: "Store Pages",
      sections: footer ? [cartSection, footer] : [cartSection]
    };

    commitDocument((doc) => ({
      ...doc,
      pages: [...doc.pages, listingPage, productPage, cartPage]
    }));

    setActivePageId(listingPageId);
    pushToast({ title: "Store pages added", message: "Manage them in Pages & Menu.", variant: "success" });
  };

  const installBlogFeature = () => {
    if (!document || blogInstalled) return;
    const orderBase = Math.max(0, ...document.pages.map((page) => page.order ?? 0)) + 1;
    const footer = resolveFooterSection(document);
    const blogIndexId = createId();
    const blogPostId = createId();

    const blogIndexSection: SiteSection = {
      id: createId(),
      type: "blog-index",
      variant: "A",
      enabled: true,
      style: { ...defaultStyle },
      content: { ...defaultContentByType["blog-index"] }
    };

    const blogPostSection: SiteSection = {
      id: createId(),
      type: "blog-post",
      variant: "A",
      enabled: true,
      style: { ...defaultStyle },
      content: { ...defaultContentByType["blog-post"] }
    };

    const blogIndexPage: SitePage = {
      id: blogIndexId,
      name: "Blog",
      slug: ensureUniqueSlug("blog", document.pages),
      showInMenu: true,
      menuTitle: "Blog",
      parentId: null,
      order: orderBase,
      sections: footer ? [blogIndexSection, footer] : [blogIndexSection]
    };

    const blogPostPage: SitePage = {
      id: blogPostId,
      name: "Blog Post",
      slug: ensureUniqueSlug("blog-post", [...document.pages, blogIndexPage]),
      showInMenu: false,
      menuTitle: "Blog post",
      parentId: null,
      order: orderBase + 1,
      isSystem: true,
      systemGroup: "Blog Pages",
      sections: footer ? [blogPostSection, footer] : [blogPostSection]
    };

    commitDocument((doc) => ({
      ...doc,
      pages: [...doc.pages, blogIndexPage, blogPostPage]
    }));

    setActivePageId(blogIndexId);
    pushToast({ title: "Blog pages added", message: "Manage posts in your dashboard.", variant: "success" });
  };

  const runThemeAssistant = async () => {
    if (!themePrompt.trim() || !document) return;
    setThemeAssistantLoading(true);
    try {
      const response = await fetch("/api/builder/theme-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: themePrompt.trim(),
          theme: document.theme
        })
      });
      if (!response.ok) throw new Error("Theme assistant failed");
      const data = await response.json();
      if (data?.theme) {
        const nextPrimary = data.theme.primary ?? data.theme.primaryColor ?? document.theme.primary;
        const nextBackground = data.theme.background ?? data.theme.bg ?? document.theme.bg;
        const nextFont = data.theme.fontFamily ?? data.theme.fontBody ?? document.theme.fontBody;
        updateTheme(nextPrimary, nextBackground, nextFont);
        pushToast({ title: "Theme updated", message: "Suggestions applied.", variant: "success" });
      }
    } catch (error) {
      console.error("[THEME_ASSISTANT_ERROR]", error);
      pushToast({ title: "Theme assistant error", message: "Try again in a moment.", variant: "error" });
    } finally {
      setThemeAssistantLoading(false);
    }
  };

  const generateAiSection = async () => {
    if (!aiSectionPrompt.trim() || !activePage) return;
    setAiSectionLoading(true);
    try {
      const response = await fetch("/api/builder/section-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiSectionPrompt.trim(),
          theme: document?.theme
        })
      });
      if (!response.ok) throw new Error("Section generation failed");
      const data = await response.json();
      const section = data?.section as SiteSection | undefined;
      if (section) {
        const nextSection = { ...section, id: section.id ?? createId() };
        updatePage(activePage.id, (page) => ({
          ...page,
          sections: [...page.sections, nextSection]
        }));
        setAiSectionPrompt("");
        pushToast({ title: "Section generated", message: "Edit it in the canvas.", variant: "success" });
      }
    } catch (error) {
      console.error("[AI_SECTION_ERROR]", error);
      pushToast({ title: "Section generation failed", message: "Try again.", variant: "error" });
    } finally {
      setAiSectionLoading(false);
    }
  };

  const saveSectionToLibrary = (section: SiteSection) => {
    commitDocument((doc) => ({
      ...doc,
      savedSections: [
        ...(doc.savedSections ?? []),
        {
          ...section,
          id: createId(),
          content: JSON.parse(JSON.stringify(section.content ?? {})),
          images: section.images ? JSON.parse(JSON.stringify(section.images)) : undefined,
          elements: section.elements ? JSON.parse(JSON.stringify(section.elements)) : undefined
        }
      ]
    }));
    pushToast({ title: "Section saved", message: "Find it under Saved sections.", variant: "success" });
  };

  const insertSavedSection = (section: SiteSection) => {
    if (!activePage) return;
    const clone: SiteSection = {
      ...section,
      id: createId(),
      content: JSON.parse(JSON.stringify(section.content ?? {})),
      images: section.images ? JSON.parse(JSON.stringify(section.images)) : undefined,
      elements: section.elements ? JSON.parse(JSON.stringify(section.elements)) : undefined
    };
    updatePage(activePage.id, (page) => ({
      ...page,
      sections: [...page.sections, clone]
    }));
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsPublishing(true);
    setPublishError(null);
    setPublishNeedsUpgrade(false);
    setPublishConfirmOpen(false);

    try {
      const response = await fetch("/api/builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: initialSite.id })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 403 && payload?.code === "PLAN_UPGRADE_REQUIRED") {
          setPublishError(payload?.error ?? "Your current plan does not include website publishing.");
          setPublishNeedsUpgrade(true);
          return;
        }
        throw new Error(payload?.error ?? "Publish failed");
      }

      const data = await response.json();
      setPublishedUrl(data.url ?? null);
      setPublishSuccessOpen(true);
    } catch (error) {
      console.error("[BUILDER_PUBLISH_ERROR]", error);
      setPublishError("Unable to publish. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const formattedSavedAt = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? formattedSavedAt
          ? `Saved ${formattedSavedAt}`
          : "Saved"
        : saveState === "error"
          ? "Save failed"
          : "";

  const publishLabel = isPublishing ? "Publishing..." : publishedUrl ? "Republish" : "Publish";

  const previewWidth = viewport === "desktop" ? 1280 : 375;
  const previewHeight = viewport === "desktop" ? 760 : 667;
  const breadcrumb = useMemo(() => {
    const pageLabel = activePage?.name ?? "Page";
    const sectionLabel = selectedSection ? SECTION_LABELS[selectedSection.type] : "Select section";
    const elementLabel = selectedElement
      ? selectedElement.type === "text"
        ? "Text"
        : selectedElement.type === "image"
          ? "Image"
          : selectedElement.type === "button"
            ? "Button"
            : "Element"
      : "Select element";
    return { pageLabel, sectionLabel, elementLabel };
  }, [activePage, selectedElement, selectedSection]);
  const chatPromptEnabled = document?.chat_prompt_topbar_enabled ?? false;
  const chatPromptText = document?.chat_prompt_topbar_text ?? DEFAULT_CHAT_PROMPT_TEXT;
  const chatPromptCta = document?.chat_prompt_topbar_cta ?? DEFAULT_CHAT_PROMPT_CTA;
  const themeEditor = (
    <div className="space-y-4">
      <InspectorGroup title="Theme Assistant">
        <div className="space-y-2">
          <p className="text-xs text-white/60">
            Try a curated palette to refresh colors and typography across the site.
          </p>
        </div>
        <div className="mt-3 grid gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => updateTheme(preset.primary, preset.background, preset.font)}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-semibold"
            >
              <div>
                <div className="text-sm font-semibold text-white">{preset.label}</div>
                <div className="text-xs text-white/50">{resolveFonts(preset.font).label}</div>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: preset.primary }}
                />
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: preset.background }}
                />
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <input
            className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
            value={themePrompt}
            onChange={(event) => setThemePrompt(event.target.value)}
            placeholder="Ask the Theme Assistant (e.g. make it warmer)"
          />
          <button
            type="button"
            onClick={runThemeAssistant}
            disabled={themeAssistantLoading}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold"
          >
            {themeAssistantLoading ? "Thinking..." : "Get suggestions"}
          </button>
        </div>
      </InspectorGroup>
      <InspectorGroup title="Palette">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Primary
          <input
            type="color"
            className="mt-2 h-10 w-full rounded-xl border border-white/10"
            value={document?.theme.primary ?? "#111827"}
            onChange={(event) =>
              updateTheme(event.target.value, document?.theme.bg ?? "#F3F4F6", document?.theme.fontBody)
            }
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Background
          <input
            type="color"
            className="mt-2 h-10 w-full rounded-xl border border-white/10"
            value={document?.theme.bg ?? "#F3F4F6"}
            onChange={(event) =>
              updateTheme(document?.theme.primary ?? "#111827", event.target.value, document?.theme.fontBody)
            }
          />
        </label>
      </InspectorGroup>
      <InspectorGroup title="Typography">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Font pairing
          <select
            className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
            value={document?.theme.fontBody ?? "Inter, system-ui, sans-serif"}
            onChange={(event) =>
              updateTheme(document?.theme.primary ?? "#111827", document?.theme.bg ?? "#F3F4F6", event.target.value)
            }
          >
            {resolveFonts(document?.theme.fontBody).label === "Custom" ? (
              <option value={document?.theme.fontBody ?? "Inter, system-ui, sans-serif"}>Custom</option>
            ) : null}
            {[
              "Sora, Inter, system-ui, sans-serif",
              "Manrope, Inter, system-ui, sans-serif",
              '"Space Grotesk", Inter, system-ui, sans-serif',
              '"Playfair Display", Inter, system-ui, sans-serif'
            ].map((value) => (
              <option key={value} value={value}>
                {resolveFonts(value).label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Text scale
          <select
            className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
            value={
              TEXT_SCALE_PRESETS.find((preset) => preset.styles.h1.size === document?.theme.textStyles?.h1.size)
                ?.id ?? "classic"
            }
            onChange={(event) => applyTextScale(event.target.value)}
          >
            {TEXT_SCALE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      </InspectorGroup>
      <InspectorGroup title="Page Transitions">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Transitions
          <select
            className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
            value={document?.theme.pageTransitions ?? "fade"}
            onChange={(event) => updatePageTransition(event.target.value as "none" | "fade" | "slide")}
          >
            <option value="none">None</option>
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
          </select>
        </label>
      </InspectorGroup>
      <InspectorGroup title="Website Chat Prompt">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Top bar prompt</p>
            <p className="text-xs text-white/60">Show a sticky top bar prompting visitors to use chat.</p>
          </div>
          <Switch
            checked={chatPromptEnabled}
            onChange={(event) =>
              updateChatPrompt({ chat_prompt_topbar_enabled: event.target.checked })
            }
          />
        </div>
        <label
          className={`text-xs font-semibold uppercase tracking-[0.2em] text-white/60 ${
            chatPromptEnabled ? "" : "opacity-60"
          }`}
        >
          Prompt text
          <input
            className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm disabled:opacity-60"
            value={chatPromptText}
            maxLength={CHAT_PROMPT_TEXT_MAX}
            disabled={!chatPromptEnabled}
            onChange={(event) =>
              updateChatPrompt({
                chat_prompt_topbar_text: event.target.value.slice(0, CHAT_PROMPT_TEXT_MAX)
              })
            }
            onBlur={(event) =>
              updateChatPrompt({
                chat_prompt_topbar_text: normalizeChatPromptCopy(
                  event.target.value,
                  DEFAULT_CHAT_PROMPT_TEXT,
                  CHAT_PROMPT_TEXT_MAX
                )
              })
            }
          />
        </label>
        <label
          className={`text-xs font-semibold uppercase tracking-[0.2em] text-white/60 ${
            chatPromptEnabled ? "" : "opacity-60"
          }`}
        >
          CTA label
          <input
            className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm disabled:opacity-60"
            value={chatPromptCta}
            maxLength={CHAT_PROMPT_CTA_MAX}
            disabled={!chatPromptEnabled}
            onChange={(event) =>
              updateChatPrompt({
                chat_prompt_topbar_cta: event.target.value.slice(0, CHAT_PROMPT_CTA_MAX)
              })
            }
            onBlur={(event) =>
              updateChatPrompt({
                chat_prompt_topbar_cta: normalizeChatPromptCopy(
                  event.target.value,
                  DEFAULT_CHAT_PROMPT_CTA,
                  CHAT_PROMPT_CTA_MAX
                )
              })
            }
          />
        </label>
        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Chat launcher glow</p>
            <p className="text-xs text-white/60">Highlight the chat button briefly to attract attention.</p>
          </div>
          <Switch
            checked={document?.chat_launcher_glow_enabled ?? false}
            onChange={(event) =>
              updateChatPrompt({ chat_launcher_glow_enabled: event.target.checked })
            }
          />
        </div>
      </InspectorGroup>
    </div>
  );

  return (
    <main className="relative min-h-screen bg-bg-page text-ink">
      <div className="sticky top-0 z-30 border-b border-border-subtle bg-bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setLeftPanelOpen((prev) => !prev)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border-subtle px-3 text-xs font-semibold lg:hidden"
            >
              Panels
            </button>
            <div>
              <h1 className="text-lg font-semibold">Website Builder</h1>
              <p className="text-sm text-muted">{initialSite.businessName}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-white/70 px-3 py-1 text-xs font-semibold">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted">Page</span>
              <select
                className="bg-transparent text-xs font-semibold text-ink"
                value={activePageId ?? ""}
                onChange={(event) => setActivePageId(event.target.value)}
              >
                {(document?.pages ?? []).map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </div>
            {publishedUrl ? (
              <span className="max-w-[240px] truncate rounded-full border border-border-subtle px-3 py-1 text-xs text-muted">
                Live: {publishedUrl}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRightPanelOpen((prev) => !prev)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border-subtle px-3 text-xs font-semibold lg:hidden"
            >
              Inspector
            </button>
            <div className="flex items-center gap-2 rounded-full border border-border-subtle p-1">
              {(["desktop", "mobile"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setViewport(item)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                    viewport === item ? "bg-ink text-white" : "text-muted"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDevModeEnabled((prev) => !prev)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                devModeEnabled ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-700" : "border-border-subtle"
              }`}
            >
              Dev Mode
            </button>
            <button
              type="button"
              onClick={() => undo()}
              disabled={!past.length}
              className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => redo()}
              disabled={!future.length}
              className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Redo
            </button>
            {saveLabel ? <span className="text-xs text-muted">{saveLabel}</span> : null}
            <button
              type="button"
              onClick={() => saveDraft("manual")}
              disabled={saveState === "saving"}
              className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setPublishError(null);
                setPublishNeedsUpgrade(false);
                setPublishConfirmOpen(true);
              }}
              disabled={!canPublish || isPublishing}
              className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {publishLabel}
            </button>
            {publishedUrl ? (
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold"
              >
                View live
              </a>
            ) : null}
            {!canPublish || publishNeedsUpgrade ? (
              <Link
                href="/dashboard/billing?blocked=publish_website"
                className="rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900"
              >
                Upgrade
              </Link>
            ) : null}
            <Link
              href="/dashboard/hire-pro"
              className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold"
            >
              Hire a professional
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold"
            >
              Dashboard
            </Link>
            {publishError ? <span className="text-xs text-red-500">{publishError}</span> : null}
          </div>
        </div>
      </div>
      {!canPublish || publishNeedsUpgrade ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs text-amber-900">
            <span>Your current plan does not include website publishing. Upgrade to unlock it.</span>
            <Link
              href="/dashboard/billing?blocked=publish_website"
              className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 font-semibold"
            >
              Upgrade now
            </Link>
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-[calc(100vh-72px)] w-full">
        {leftPanelOpen || rightPanelOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => {
              setLeftPanelOpen(false);
              setRightPanelOpen(false);
            }}
          />
        ) : null}
        <aside
          className={`builder-panel fixed inset-y-0 left-0 z-40 h-full w-[320px] border-r border-white/10 bg-neutral-950/95 p-4 text-white backdrop-blur overflow-y-auto transition-transform duration-200 lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:translate-x-0 lg:inset-auto ${
            leftPanelOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <Search className="h-4 w-4 text-white/50" />
              <input
                className="h-8 w-full bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none"
                value={leftSearchQuery}
                onChange={(event) => setLeftSearchQuery(event.target.value)}
                placeholder={
                  leftPanel === "sections"
                    ? "Search sections"
                    : leftPanel === "elements"
                      ? "Search elements"
                      : "Search sections or elements"
                }
                disabled={!leftSearchActive}
              />
            </div>
            <div className="space-y-1">
              {panelTabs
                .filter((tab) => tab.visible)
                .map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setLeftPanel(tab.id);
                        setLeftPanelOpen(true);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        leftPanel === tab.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5"
                      }`}
                      aria-pressed={leftPanel === tab.id}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

              {leftPanel === "pages" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Pages & Menu</p>
                    <p className="mt-2 text-xs text-muted">
                      Reorder pages, toggle menu visibility, and nest subpages.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="h-9 flex-1 rounded-xl border border-border-subtle px-3 text-sm"
                      value={newPageName}
                      onChange={(event) => setNewPageName(event.target.value)}
                      placeholder="New page name"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = newPageName.trim();
                        if (!name) return;
                        addPage(name);
                        setNewPageName("");
                      }}
                      className="rounded-xl border border-border-subtle px-3 text-xs font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Site menu</p>
                    {menuPages.map((page) => (
                      <div
                        key={page.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", page.id);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverPageId(page.id);
                        }}
                        onDragLeave={() => setDragOverPageId(null)}
                        onDragEnd={() => setDragOverPageId(null)}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceId = event.dataTransfer.getData("text/plain");
                          reorderPages(sourceId, page.id);
                          setDragOverPageId(null);
                        }}
                        className={`rounded-xl border border-border-subtle bg-bg-elevated p-3 transition ${
                          dragOverPageId === page.id ? "border-white/60 bg-white/5" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePageId(page.id)}
                            className={`text-sm font-semibold ${activePage?.id === page.id ? "text-white" : "text-white/70"}`}
                          >
                            {page.name}
                          </button>
                          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                            <input
                              type="checkbox"
                              checked={page.showInMenu !== false}
                              onChange={(event) => updatePageMeta(page.id, { showInMenu: event.target.checked })}
                            />
                            Menu
                          </label>
                        </div>
                        {activePage?.id === page.id ? (
                          <div className="mt-3 space-y-2">
                            <input
                              className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                              value={page.name}
                              onChange={(event) => updatePageMeta(page.id, { name: event.target.value })}
                              placeholder="Page name"
                            />
                            <input
                              className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                              value={page.menuTitle ?? page.name}
                              onChange={(event) => updatePageMeta(page.id, { menuTitle: event.target.value })}
                              placeholder="Menu label"
                            />
                            <input
                              className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                              value={page.slug}
                              onChange={(event) =>
                                updatePageMeta(page.id, {
                                  slug: ensureUniqueSlug(slugify(event.target.value), document?.pages ?? [], page.id)
                                })
                              }
                              placeholder="Slug"
                            />
                            <select
                              className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                              value={page.parentId ?? ""}
                              onChange={(event) =>
                                updatePageMeta(page.id, { parentId: event.target.value || null })
                              }
                            >
                              <option value="">No parent</option>
                              {menuPages
                                .filter((candidate) => candidate.id !== page.id)
                                .map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setPageDeleteConfirm(page)}
                              className="text-xs font-semibold text-red-400"
                            >
                              Delete page
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {systemPages.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">System pages</p>
                      {Object.entries(
                        systemPages.reduce<Record<string, SitePage[]>>((acc, page) => {
                          const key = page.systemGroup ?? "System Pages";
                          acc[key] = acc[key] ? [...acc[key], page] : [page];
                          return acc;
                        }, {})
                      ).map(([group, pages]) => (
                        <div key={group} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{group}</p>
                          {pages.map((page) => (
                            <div key={page.id} className="rounded-xl border border-border-subtle bg-white/5 p-3">
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => setActivePageId(page.id)}
                                  className="text-sm font-semibold"
                                >
                                  {page.name}
                                </button>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-muted">System</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {leftPanel === "sections" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Structure</p>
                    <p className="mt-2 text-xs text-muted">
                      Reorder sections and elements. Select a node to edit its properties.
                    </p>
                  </div>
                  {activePage ? (
                    <DndContext
                      sensors={dndSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => {
                        if (!event.over) return;
                        reorderSections(String(event.active.id), String(event.over.id));
                      }}
                    >
                      <SortableContext
                        items={structureSections.map((section) => section.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {structureSections.map((section) => {
                            const isSelected = selectedSectionId === section.id;
                            const isEditing = editingSectionId === section.id;
                            return (
                              <div
                                key={section.id}
                                className={`rounded-2xl border border-white/10 bg-white/5 p-2 ${
                                  isSelected ? "ring-1 ring-emerald-400/40" : ""
                                }`}
                              >
                                <SortableRow
                                  id={section.id}
                                  onClick={
                                    isEditing
                                      ? undefined
                                      : () =>
                                          setSelectedNode({
                                            type: "section",
                                            id: section.id,
                                            parentId: activePage?.id
                                          })
                                  }
                                  contentClassName={isEditing ? "text-white" : ""}
                                  trailing={
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingSectionId(section.id);
                                          setSectionNameDraft(section.name ?? SECTION_LABELS[section.type]);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white"
                                        aria-label="Rename section"
                                      >
                                        <PencilLine className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleSection(section.id)}
                                        className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70"
                                      >
                                        {section.enabled ? "On" : "Off"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => duplicateSection(section.id)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white"
                                        aria-label="Duplicate section"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirm(section)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:text-red-300"
                                        aria-label="Delete section"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  }
                                >
                                  {isEditing ? (
                                    <input
                                      className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-white/40 focus:outline-none"
                                      value={sectionNameDraft}
                                      onChange={(event) => setSectionNameDraft(event.target.value)}
                                      onBlur={() => {
                                        updateSectionName(section.id, sectionNameDraft);
                                        setEditingSectionId(null);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          updateSectionName(section.id, sectionNameDraft);
                                          setEditingSectionId(null);
                                        }
                                        if (event.key === "Escape") {
                                          setEditingSectionId(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    getSectionLabel(section)
                                  )}
                                </SortableRow>
                                <div className="mt-2 space-y-2 pl-10">
                                  {section.elements?.length ? (
                                    <DndContext
                                      sensors={dndSensors}
                                      collisionDetection={closestCenter}
                                      onDragEnd={(event) => {
                                        if (!event.over) return;
                                        reorderElements(section.id, String(event.active.id), String(event.over.id));
                                      }}
                                    >
                                      <SortableContext
                                        items={section.elements.map((element) => element.id)}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        <div className="space-y-2">
                                          {section.elements.map((element) => {
                                            const isElementSelected =
                                              selectedNode?.type === "element" && selectedNode.id === element.id;
                                            return (
                                              <SortableRow
                                                key={element.id}
                                                id={element.id}
                                                onClick={() =>
                                                  setSelectedNode({
                                                    type: "element",
                                                    id: element.id,
                                                    parentId: section.id
                                                  })
                                                }
                                                className={isElementSelected ? "border-emerald-400/60 bg-emerald-500/10" : ""}
                                                contentClassName="text-xs font-medium text-white/80"
                                                trailing={
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => duplicateElement(section.id, element.id)}
                                                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:text-white"
                                                      aria-label="Duplicate element"
                                                    >
                                                      <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => removeElement(section.id, element.id)}
                                                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:text-red-300"
                                                      aria-label="Delete element"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                }
                                              >
                                                {getElementLabel(element)}
                                              </SortableRow>
                                            );
                                          })}
                                        </div>
                                      </SortableContext>
                                    </DndContext>
                                  ) : (
                                    <p className="text-xs text-muted">No elements yet. Add from the Elements tab.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <p className="text-xs text-muted">Select a page to see its structure.</p>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Add section</p>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => addSection("custom")}
                        className="rounded-xl border border-border-subtle px-3 py-2 text-left text-xs font-semibold"
                      >
                        <div className="text-sm font-semibold text-white">Blank section</div>
                        <div className="text-xs text-muted">Start from scratch with elements.</div>
                      </button>
                    </div>
                    <div className="mt-3 space-y-4">
                      {filteredSectionLibrary.map((group) => (
                        <div key={group.title} className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{group.title}</p>
                            <p className="text-xs text-muted">{group.description}</p>
                          </div>
                          <div className="grid gap-2">
                            {group.items.map((item) => (
                              <button
                                key={item.type}
                                type="button"
                                onClick={() => addSection(item.type)}
                                className="rounded-xl border border-border-subtle px-3 py-2 text-left text-xs font-semibold"
                              >
                                <div className="text-sm font-semibold text-white">{item.label}</div>
                                <div className="text-xs text-muted">{item.blurb}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(document?.savedSections ?? []).length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Saved sections</p>
                      {(document?.savedSections ?? []).map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => insertSavedSection(section)}
                          className="w-full rounded-xl border border-border-subtle px-3 py-2 text-left text-xs font-semibold"
                        >
                          {SECTION_LABELS[section.type]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Generate section</p>
                    <textarea
                      className="min-h-[80px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                      value={aiSectionPrompt}
                      onChange={(event) => setAiSectionPrompt(event.target.value)}
                      placeholder="Describe the section you want..."
                    />
                    <button
                      type="button"
                      onClick={generateAiSection}
                      disabled={aiSectionLoading}
                      className="w-full rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold"
                    >
                      {aiSectionLoading ? "Generating..." : "Generate with AI"}
                    </button>
                  </div>
                </div>
              ) : null}

              {leftPanel === "elements" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Elements</p>
                    <p className="mt-2 text-xs text-muted">
                      Add themed text, images, or buttons to the selected section.
                    </p>
                  </div>
                  {!selectedSection ? (
                    <p className="text-xs text-muted">Select a section to add elements.</p>
                  ) : (
                    <div className="grid gap-2">
                      {filteredElementLibrary.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (!selectedSection) return;
                            addElement(selectedSection.id, item.build());
                          }}
                          className="rounded-xl border border-border-subtle px-3 py-2 text-left text-xs font-semibold"
                        >
                          <div className="text-sm font-semibold">{item.label}</div>
                          <div className="text-xs text-muted">{item.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSection?.elements?.length ? (
                    <div className="space-y-2 text-xs text-muted">
                      {selectedSection.elements.map((element) => (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() =>
                            setSelectedNode({ type: "element", id: element.id, parentId: selectedSection.id })
                          }
                          className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                            selectedNode?.type === "element" && selectedNode.id === element.id
                              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                              : "border-border-subtle"
                          }`}
                        >
                          {element.type.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {leftPanel === "design" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Theme / Design</p>
                    <p className="mt-2 text-xs text-muted">
                      Update your global palette, typography, and site-wide styles.
                    </p>
                  </div>
                  {themeEditor}
                </div>
              ) : null}

              {leftPanel === "apps" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Apps</p>
                    <p className="mt-2 text-xs text-muted">
                      Install third-party tools or manage what is already connected.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(["market", "manage"] as AppsPanelTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setAppsPanelTab(tab)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          appsPanelTab === tab ? "bg-white text-neutral-900" : "border border-white/10 text-white/70"
                        }`}
                      >
                        {tab === "market" ? "App Market" : "Manage Apps"}
                      </button>
                    ))}
                  </div>
                  {appsPanelTab === "market" ? (
                    <div className="space-y-2">
                      {APP_MARKET.map((app) => {
                        const installed = apps.some((item) => item.id === app.id);
                        return (
                          <div key={app.id} className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                            <p className="text-sm font-semibold">{app.name}</p>
                            <p className="mt-1 text-xs text-muted">{app.description}</p>
                            <button
                              type="button"
                              onClick={() => installApp(app.id)}
                              disabled={installed}
                              className="mt-3 rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold disabled:opacity-50"
                            >
                              {installed ? "Installed" : "Install"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apps.length ? (
                        apps.map((app) => (
                          <div key={app.id} className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">{app.name}</p>
                              <button
                                type="button"
                                onClick={() => toggleAppEnabled(app.id)}
                                className="text-xs font-semibold text-muted"
                              >
                                {app.enabled ? "Enabled" : "Disabled"}
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setAppConfigId(app.id)}
                                className="text-xs font-semibold text-muted"
                              >
                                Configure
                              </button>
                              <button
                                type="button"
                                onClick={() => uninstallApp(app.id)}
                                className="text-xs font-semibold text-red-400"
                              >
                                Uninstall
                              </button>
                            </div>
                            {appConfigId === app.id ? (
                              <div className="mt-3 space-y-2">
                                {app.id === "analytics" ? (
                                  <>
                                    <input
                                      className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                      value={(app.config?.measurementId as string) ?? ""}
                                      onChange={(event) =>
                                        updateAppConfig(app.id, { measurementId: event.target.value })
                                      }
                                      placeholder="Measurement ID"
                                    />
                                    <p className="text-xs text-muted">Paste your GA4 Measurement ID to activate tracking.</p>
                                  </>
                                ) : null}
                                {app.id === "live-chat" ? (
                                  <textarea
                                    className="min-h-[80px] w-full rounded-xl border border-border-subtle px-2 py-2 text-sm"
                                    value={(app.config?.script as string) ?? ""}
                                    onChange={(event) => updateAppConfig(app.id, { script: event.target.value })}
                                    placeholder="Paste chat provider embed script"
                                  />
                                ) : null}
                                {app.id === "booking-widget" ? (
                                  <input
                                    className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                    value={(app.config?.embedUrl as string) ?? ""}
                                    onChange={(event) => updateAppConfig(app.id, { embedUrl: event.target.value })}
                                    placeholder="Embed URL"
                                  />
                                ) : null}
                                {app.id === "newsletter" ? (
                                  <p className="text-xs text-muted">Manage the signup form content in the section editor.</p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted">No apps installed yet.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {leftPanel === "business" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">My Business</p>
                    <p className="mt-2 text-xs text-muted">
                      Add business features that automatically create pages and layouts.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {BUSINESS_FEATURES.map((feature) => {
                      const installed =
                        (feature.id === "store" && storeInstalled) || (feature.id === "blog" && blogInstalled);
                      return (
                        <div key={feature.id} className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                          <p className="text-sm font-semibold">{feature.name}</p>
                          <p className="mt-1 text-xs text-muted">{feature.description}</p>
                          <button
                            type="button"
                            onClick={() => (feature.id === "store" ? installStoreFeature() : installBlogFeature())}
                            disabled={installed}
                            className="mt-3 rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            {installed ? "Installed" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                    <div className="rounded-xl border border-dashed border-border-subtle bg-white/5 p-3 text-xs text-muted">
                      Members, bookings, and events are coming in Phase 3.
                    </div>
                  </div>
                </div>
              ) : null}

              {leftPanel === "media" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Media Manager</p>
                    <p className="mt-2 text-xs text-muted">Upload or reuse assets across your site.</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Upload media</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 w-full text-xs"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadMediaAsset(file);
                      }}
                    />
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Search stock</label>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="h-9 flex-1 rounded-xl border border-border-subtle px-3 text-sm"
                        value={imageSearchQuery}
                        onChange={(event) => setImageSearchQuery(event.target.value)}
                        placeholder="What are you looking for?"
                      />
                      <button
                        type="button"
                        onClick={searchImages}
                        className="rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold"
                      >
                        Search
                      </button>
                    </div>
                    {imageSearchLoading ? <p className="mt-2 text-xs text-muted">Searching...</p> : null}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {imageSearchResults.map((image) => (
                        <button
                          key={image.url}
                          type="button"
                          onClick={() => applyMediaResult(image)}
                          className="overflow-hidden rounded-lg border border-border-subtle"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.url} alt={image.alt} className="h-24 w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">My media</p>
                    {(document?.mediaLibrary ?? []).length ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {(document?.mediaLibrary ?? []).map((asset) => (
                          <button
                            key={`${asset.src}-${asset.slot}`}
                            type="button"
                            onClick={() => applyMediaAsset(asset)}
                            className="overflow-hidden rounded-lg border border-border-subtle"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={asset.src} alt={asset.alt ?? "Media"} className="h-24 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted">Upload images or add from stock to build your library.</p>
                    )}
                    <div className="mt-4 flex gap-2 text-[11px] text-muted">
                      <span className="rounded-full border border-border-subtle px-2 py-1">Facebook</span>
                      <span className="rounded-full border border-border-subtle px-2 py-1">Instagram</span>
                      <span className="rounded-full border border-border-subtle px-2 py-1">Google Drive</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {leftPanel === "tools" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Design Tools</p>
                    <p className="mt-2 text-xs text-muted">Toggle guides and adjust your canvas view.</p>
                  </div>
                  <label className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>Gridlines</span>
                    <input type="checkbox" checked={gridEnabled} onChange={(event) => setGridEnabled(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>Rulers</span>
                    <input type="checkbox" checked={rulersEnabled} onChange={(event) => setRulersEnabled(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>Snap to grid</span>
                    <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} />
                  </label>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Zoom</label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="range"
                        min={0.6}
                        max={1.4}
                        step={0.05}
                        value={zoomLevel}
                        onChange={(event) => setZoomLevel(Number(event.target.value))}
                        className="w-full"
                      />
                      <span className="text-xs text-muted">{Math.round(zoomLevel * 100)}%</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {leftPanel === "help" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Help & Search</p>
                    <p className="mt-2 text-xs text-muted">Find features, panels, and quick actions.</p>
                  </div>
                  <input
                    className="h-9 w-full rounded-xl border border-border-subtle px-3 text-sm"
                    value={helpQuery}
                    onChange={(event) => setHelpQuery(event.target.value)}
                    placeholder="Search the editor..."
                  />
                  <div className="space-y-2 text-xs">
                    {[
                      {
                        label: "Open Pages & Menu",
                        description: "Manage pages and navigation",
                        action: () => setLeftPanel("pages")
                      },
                      {
                        label: "Add a section",
                        description: "Browse the section library",
                        action: () => setLeftPanel("sections")
                      },
                      {
                        label: "Add elements",
                        description: "Insert headings, images, buttons",
                        action: () => setLeftPanel("elements")
                      },
                      {
                        label: "App Market",
                        description: "Install new apps",
                        action: () => {
                          setLeftPanel("apps");
                          setAppsPanelTab("market");
                        }
                      },
                      {
                        label: "Theme settings",
                        description: "Update colors and typography",
                        action: () => {
                          setLeftPanel("design");
                          setLeftPanelOpen(true);
                          if (activePageId) {
                            setSelectedNode({ type: "page", id: activePageId });
                          }
                        }
                      }
                    ]
                      .filter((item) =>
                        [item.label, item.description].some((text) =>
                          text.toLowerCase().includes(helpQuery.trim().toLowerCase())
                        )
                      )
                      .map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.action}
                          className="w-full rounded-xl border border-border-subtle px-3 py-2 text-left text-xs font-semibold"
                        >
                          <div className="text-sm font-semibold text-white">{item.label}</div>
                          <div className="text-xs text-muted">{item.description}</div>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}

              {leftPanel === "dev" && devModeEnabled ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Dev Mode</p>
                    <p className="mt-2 text-xs text-muted">
                      Add custom code snippets. These run on the published site.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Head</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                      value={document?.customCode?.head ?? ""}
                      onChange={(event) => updateCustomCode("head", event.target.value)}
                      placeholder="Paste scripts that should load in the <head>."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Body</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                      value={document?.customCode?.body ?? ""}
                      onChange={(event) => updateCustomCode("body", event.target.value)}
                      placeholder="Paste scripts that should load before </body>."
                    />
                  </div>
                </div>
              ) : null}
        </aside>

        <aside
          className={`builder-panel fixed inset-y-0 right-0 z-40 h-full w-[380px] border-l border-white/10 bg-neutral-950/95 p-4 text-white backdrop-blur overflow-y-auto transition-transform duration-200 lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:translate-x-0 lg:inset-auto ${
            rightPanelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Inspector</p>
            {!selectedSection ? (
              <div className="mt-4 space-y-4">{themeEditor}</div>
            ) : selectedNode?.type === "element" && selectedElement ? (
              <div className="mt-4 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Element: {selectedElement.type}</p>
                  <p className="text-xs text-muted">
                    In {SECTION_LABELS[selectedSection.type]} section
                  </p>
                </div>
                <InspectorGroup title="Content">
                  {selectedElement.type === "text" ? (
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                      value={selectedElement.text}
                      onChange={(event) =>
                        updateElement(selectedSection.id, selectedElement.id, (current) =>
                          current.type === "text" ? { ...current, text: event.target.value } : current
                        )
                      }
                      placeholder="Text content"
                    />
                  ) : null}
                  {selectedElement.type === "image" ? (
                    <div className="space-y-2">
                      <input
                        className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.src}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "image" ? { ...current, src: event.target.value } : current
                          )
                        }
                        placeholder="Image URL"
                      />
                      <input
                        className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.alt ?? ""}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "image" ? { ...current, alt: event.target.value } : current
                          )
                        }
                        placeholder="Alt text"
                      />
                      <input
                        className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.caption ?? ""}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "image" ? { ...current, caption: event.target.value } : current
                          )
                        }
                        placeholder="Caption (optional)"
                      />
                    </div>
                  ) : null}
                  {selectedElement.type === "button" ? (
                    <div className="space-y-2">
                      <input
                        className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.label}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "button" ? { ...current, label: event.target.value } : current
                          )
                        }
                        placeholder="Button label"
                      />
                      <input
                        className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.href}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "button" ? { ...current, href: event.target.value } : current
                          )
                        }
                        placeholder="Button link"
                      />
                    </div>
                  ) : null}
                  {selectedElement.type === "spacer" ? (
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Height (px)
                      <input
                        type="number"
                        min={4}
                        max={240}
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.height ?? 24}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "spacer" ? { ...current, height: Number(event.target.value) } : current
                          )
                        }
                      />
                    </label>
                  ) : null}
                  {selectedElement.type === "divider" ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Thickness (px)
                        <input
                          type="number"
                          min={1}
                          max={8}
                          className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                          value={selectedElement.thickness ?? 1}
                          onChange={(event) =>
                            updateElement(selectedSection.id, selectedElement.id, (current) =>
                              current.type === "divider"
                                ? { ...current, thickness: Number(event.target.value) }
                                : current
                            )
                          }
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Color
                        <input
                          type="color"
                          className="mt-2 h-9 w-full rounded-xl border border-border-subtle"
                          value={selectedElement.color ?? document?.theme.border ?? "#E2E8F0"}
                          onChange={(event) =>
                            updateElement(selectedSection.id, selectedElement.id, (current) =>
                              current.type === "divider" ? { ...current, color: event.target.value } : current
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </InspectorGroup>
                {selectedElement.type === "text" ? (
                  <InspectorGroup title="Typography">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Style
                      <select
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.textStyle}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "text"
                              ? {
                                  ...current,
                                  textStyle: event.target.value as "h1" | "h2" | "h3" | "body" | "caption"
                                }
                              : current
                          )
                        }
                      >
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="body">Paragraph</option>
                        <option value="caption">Caption</option>
                      </select>
                    </label>
                  </InspectorGroup>
                ) : null}
                {selectedElement.type === "button" ? (
                  <InspectorGroup title="Style">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Variant
                      <select
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedElement.variant ?? "primary"}
                        onChange={(event) =>
                          updateElement(selectedSection.id, selectedElement.id, (current) =>
                            current.type === "button"
                              ? {
                                  ...current,
                                  variant: event.target.value as "primary" | "outline"
                                }
                              : current
                          )
                        }
                      >
                        <option value="primary">Primary</option>
                        <option value="outline">Outline</option>
                      </select>
                    </label>
                  </InspectorGroup>
                ) : null}
                <InspectorGroup title="Actions">
                  <button
                    type="button"
                    onClick={() => removeElement(selectedSection.id, selectedElement.id)}
                    className="rounded-xl border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-300"
                  >
                    Remove element
                  </button>
                </InspectorGroup>
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{selectedSection.type}</p>
                  <p className="text-xs text-muted">Variant {selectedSection.variant}</p>
                </div>

                <InspectorGroup title="Content">
                  {selectedSection.type === "hero" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.headline ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, headline: event.target.value }
                          }))
                        }
                        placeholder="Headline"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.subheadline ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, subheadline: event.target.value }
                          }))
                        }
                        placeholder="Subheadline"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.ctaLabel ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, ctaLabel: event.target.value }
                          }))
                        }
                        placeholder="CTA label"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.ctaHref ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, ctaHref: event.target.value }
                          }))
                        }
                        placeholder="CTA link"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "about" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[120px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "services" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Section title"
                      />
                      {(selectedSection.content.items ?? []).map((item: any, index: number) => (
                        <div key={`${item.title}-${index}`} className="rounded-xl border border-border-subtle p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={item.title}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], title: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Service title"
                          />
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-lg border border-border-subtle px-2 py-2 text-sm"
                            value={item.body}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], body: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Service description"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: {
                              ...section.content,
                              items: [
                                ...(section.content.items ?? []),
                                { title: "New service", body: "Describe this service." }
                              ]
                            }
                          }))
                        }
                        className="text-xs font-semibold text-muted"
                      >
                        Add service
                      </button>
                    </div>
                  ) : null}

                  {selectedSection.type === "gallery" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Gallery title"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "testimonials" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Section title"
                      />
                      {(selectedSection.content.items ?? []).map((item: any, index: number) => (
                        <div key={`${item.name}-${index}`} className="rounded-xl border border-border-subtle p-3">
                          <textarea
                            className="min-h-[80px] w-full rounded-lg border border-border-subtle px-2 py-2 text-sm"
                            value={item.quote}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], quote: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Quote"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={item.name}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], name: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Name"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={item.role}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], role: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Role"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedSection.type === "pricing" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Section title"
                      />
                      {(selectedSection.content.plans ?? []).map((plan: any, index: number) => (
                        <div key={`${plan.name}-${index}`} className="rounded-xl border border-border-subtle p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={plan.name}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const plans = [...(section.content.plans ?? [])];
                                plans[index] = { ...plans[index], name: event.target.value };
                                return { ...section, content: { ...section.content, plans } };
                              })
                            }
                            placeholder="Plan name"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={plan.price}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const plans = [...(section.content.plans ?? [])];
                                plans[index] = { ...plans[index], price: event.target.value };
                                return { ...section, content: { ...section.content, plans } };
                              })
                            }
                            placeholder="Price"
                          />
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-lg border border-border-subtle px-2 py-2 text-sm"
                            value={plan.description}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const plans = [...(section.content.plans ?? [])];
                                plans[index] = { ...plans[index], description: event.target.value };
                                return { ...section, content: { ...section.content, plans } };
                              })
                            }
                            placeholder="Description"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedSection.type === "cta" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.ctaLabel ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, ctaLabel: event.target.value }
                          }))
                        }
                        placeholder="CTA label"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.ctaHref ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, ctaHref: event.target.value }
                          }))
                        }
                        placeholder="CTA link"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "faq" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Section title"
                      />
                      {(selectedSection.content.items ?? []).map((item: any, index: number) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-border-subtle p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={item.question}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], question: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Question"
                          />
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-lg border border-border-subtle px-2 py-2 text-sm"
                            value={item.answer}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const items = [...(section.content.items ?? [])];
                                items[index] = { ...items[index], answer: event.target.value };
                                return { ...section, content: { ...section.content, items } };
                              })
                            }
                            placeholder="Answer"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedSection.type === "contact" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.email ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, email: event.target.value }
                          }))
                        }
                        placeholder="Email"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.phone ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, phone: event.target.value }
                          }))
                        }
                        placeholder="Phone"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.address ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, address: event.target.value }
                          }))
                        }
                        placeholder="Address"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "reservation" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "footer" ? (
                    <input
                      className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                      value={selectedSection.content.text ?? ""}
                      onChange={(event) =>
                        updateSection(selectedSection.id, (section) => ({
                          ...section,
                          content: { ...section.content, text: event.target.value }
                        }))
                      }
                      placeholder="Footer text"
                    />
                  ) : null}

                  {selectedSection.type === "newsletter" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.ctaLabel ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, ctaLabel: event.target.value }
                          }))
                        }
                        placeholder="CTA label"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "blog-index" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Intro"
                      />
                      {(selectedSection.content.posts ?? []).map((post: any, index: number) => (
                        <div key={`${post.title}-${index}`} className="rounded-xl border border-border-subtle p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={post.title}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const posts = [...(section.content.posts ?? [])];
                                posts[index] = { ...posts[index], title: event.target.value };
                                return { ...section, content: { ...section.content, posts } };
                              })
                            }
                            placeholder="Post title"
                          />
                          <textarea
                            className="mt-2 min-h-[60px] w-full rounded-lg border border-border-subtle px-2 py-2 text-sm"
                            value={post.excerpt}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const posts = [...(section.content.posts ?? [])];
                                posts[index] = { ...posts[index], excerpt: event.target.value };
                                return { ...section, content: { ...section.content, posts } };
                              })
                            }
                            placeholder="Excerpt"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={post.date}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const posts = [...(section.content.posts ?? [])];
                                posts[index] = { ...posts[index], date: event.target.value };
                                return { ...section, content: { ...section.content, posts } };
                              })
                            }
                            placeholder="Date"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: {
                              ...section.content,
                              posts: [
                                ...(section.content.posts ?? []),
                                { title: "New post", excerpt: "Short excerpt", date: "New" }
                              ]
                            }
                          }))
                        }
                        className="text-xs font-semibold text-muted"
                      >
                        Add post
                      </button>
                      <Link href="/dashboard/blog" className="text-xs font-semibold text-emerald-300">
                        Manage posts in dashboard
                      </Link>
                    </div>
                  ) : null}

                  {selectedSection.type === "blog-post" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Post title"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.date ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, date: event.target.value }
                          }))
                        }
                        placeholder="Date"
                      />
                      <textarea
                        className="min-h-[140px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Post body"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "store-listing" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Intro"
                      />
                      {(selectedSection.content.products ?? []).map((product: any, index: number) => (
                        <div key={`${product.name}-${index}`} className="rounded-xl border border-border-subtle p-3">
                          <input
                            className="h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={product.name}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const products = [...(section.content.products ?? [])];
                                products[index] = { ...products[index], name: event.target.value };
                                return { ...section, content: { ...section.content, products } };
                              })
                            }
                            placeholder="Product name"
                          />
                          <textarea
                            className="mt-2 min-h-[60px] w-full rounded-lg border border-border-subtle px-2 py-2 text-sm"
                            value={product.description}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const products = [...(section.content.products ?? [])];
                                products[index] = { ...products[index], description: event.target.value };
                                return { ...section, content: { ...section.content, products } };
                              })
                            }
                            placeholder="Description"
                          />
                          <input
                            className="mt-2 h-9 w-full rounded-lg border border-border-subtle px-2 text-sm"
                            value={product.price}
                            onChange={(event) =>
                              updateSection(selectedSection.id, (section) => {
                                const products = [...(section.content.products ?? [])];
                                products[index] = { ...products[index], price: event.target.value };
                                return { ...section, content: { ...section.content, products } };
                              })
                            }
                            placeholder="Price"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedSection.type === "store-product" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Product title"
                      />
                      <textarea
                        className="min-h-[120px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Product details"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.price ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, price: event.target.value }
                          }))
                        }
                        placeholder="Price"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "store-cart" ? (
                    <input
                      className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                      value={selectedSection.content.title ?? ""}
                      onChange={(event) =>
                        updateSection(selectedSection.id, (section) => ({
                          ...section,
                          content: { ...section.content, title: event.target.value }
                        }))
                      }
                      placeholder="Cart title"
                    />
                  ) : null}

                  {selectedSection.type === "custom" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[120px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                    </div>
                  ) : null}

                  {selectedSection.type === "app-embed" ? (
                    <div className="space-y-3">
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.title ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, title: event.target.value }
                          }))
                        }
                        placeholder="Title"
                      />
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                        value={selectedSection.content.body ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, body: event.target.value }
                          }))
                        }
                        placeholder="Body"
                      />
                      <input
                        className="h-10 w-full rounded-xl border border-border-subtle px-3 text-sm"
                        value={selectedSection.content.embedUrl ?? ""}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            content: { ...section.content, embedUrl: event.target.value }
                          }))
                        }
                        placeholder="Embed URL"
                      />
                    </div>
                  ) : null}
                </InspectorGroup>

                <InspectorGroup title="Elements">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white/60">Add or reorder section elements.</p>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Use Elements panel</span>
                  </div>
                  {selectedSection.elements?.length ? (
                    <div className="space-y-3">
                      {selectedSection.elements.map((element) => (
                        <div key={element.id} className="rounded-xl border border-border-subtle p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedNode({ type: "element", id: element.id, parentId: selectedSection.id })
                              }
                              className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                                selectedNode?.type === "element" && selectedNode.id === element.id
                                  ? "text-emerald-300"
                                  : "text-muted"
                              }`}
                            >
                              {element.type}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeElement(selectedSection.id, element.id)}
                              className="text-xs font-semibold text-red-400"
                            >
                              Remove
                            </button>
                          </div>
                          {element.type === "text" ? (
                            <div className="space-y-2">
                              <textarea
                                className="min-h-[90px] w-full rounded-xl border border-border-subtle px-3 py-2 text-sm"
                                value={element.text}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "text" ? { ...current, text: event.target.value } : current
                                  )
                                }
                                placeholder="Text content"
                              />
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                  Style
                                  <select
                                    className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                    value={element.textStyle}
                                    onChange={(event) =>
                                      updateElement(selectedSection.id, element.id, (current) =>
                                        current.type === "text"
                                          ? {
                                              ...current,
                                              textStyle: event.target.value as "h1" | "h2" | "h3" | "body" | "caption"
                                            }
                                          : current
                                      )
                                    }
                                  >
                                    <option value="h1">Heading 1</option>
                                    <option value="h2">Heading 2</option>
                                    <option value="h3">Heading 3</option>
                                    <option value="body">Paragraph</option>
                                    <option value="caption">Caption</option>
                                  </select>
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                  Alignment
                                  <select
                                    className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                    value={element.align ?? "left"}
                                    onChange={(event) =>
                                      updateElement(selectedSection.id, element.id, (current) =>
                                        current.type === "text"
                                          ? {
                                              ...current,
                                              align: event.target.value as "left" | "center"
                                            }
                                          : current
                                      )
                                    }
                                  >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          ) : null}
                          {element.type === "image" ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImageTarget(null);
                                    setMediaTarget({ kind: "element", id: element.id });
                                    setLeftPanel("media");
                                    setLeftPanelOpen(true);
                                  }}
                                  className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold"
                                >
                                  Choose from media
                                </button>
                              </div>
                              <input
                                className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                value={element.src}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "image" ? { ...current, src: event.target.value } : current
                                  )
                                }
                                placeholder="Image URL"
                              />
                              <input
                                className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                value={element.alt ?? ""}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "image" ? { ...current, alt: event.target.value } : current
                                  )
                                }
                                placeholder="Alt text"
                              />
                              <input
                                className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                value={element.caption ?? ""}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "image" ? { ...current, caption: event.target.value } : current
                                  )
                                }
                                placeholder="Caption (optional)"
                              />
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {element.src ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={element.src}
                                    alt={element.alt ?? "Element image"}
                                    className="h-32 w-full rounded-xl object-cover"
                                  />
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {element.type === "button" ? (
                            <div className="space-y-2">
                              <input
                                className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                value={element.label}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "button" ? { ...current, label: event.target.value } : current
                                  )
                                }
                                placeholder="Button label"
                              />
                              <input
                                className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                value={element.href}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "button" ? { ...current, href: event.target.value } : current
                                  )
                                }
                                placeholder="Button link"
                              />
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                  Variant
                                  <select
                                    className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                    value={element.variant ?? "primary"}
                                    onChange={(event) =>
                                      updateElement(selectedSection.id, element.id, (current) =>
                                        current.type === "button"
                                          ? {
                                              ...current,
                                              variant: event.target.value as "primary" | "outline"
                                            }
                                          : current
                                      )
                                    }
                                  >
                                    <option value="primary">Primary</option>
                                    <option value="outline">Outline</option>
                                  </select>
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                  Alignment
                                  <select
                                    className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                    value={element.align ?? "left"}
                                    onChange={(event) =>
                                      updateElement(selectedSection.id, element.id, (current) =>
                                        current.type === "button"
                                          ? { ...current, align: event.target.value as "left" | "center" }
                                          : current
                                      )
                                    }
                                  >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          ) : null}
                          {element.type === "spacer" ? (
                            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                              Height (px)
                              <input
                                type="number"
                                min={4}
                                max={240}
                                className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                value={element.height ?? 24}
                                onChange={(event) =>
                                  updateElement(selectedSection.id, element.id, (current) =>
                                    current.type === "spacer"
                                      ? { ...current, height: Number(event.target.value) }
                                      : current
                                  )
                                }
                              />
                            </label>
                          ) : null}
                          {element.type === "divider" ? (
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                Thickness (px)
                                <input
                                  type="number"
                                  min={1}
                                  max={8}
                                  className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                                  value={element.thickness ?? 1}
                                  onChange={(event) =>
                                    updateElement(selectedSection.id, element.id, (current) =>
                                      current.type === "divider"
                                        ? { ...current, thickness: Number(event.target.value) }
                                        : current
                                    )
                                  }
                                />
                              </label>
                              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                Color
                                <input
                                  type="color"
                                  className="mt-2 h-9 w-full rounded-xl border border-border-subtle"
                                  value={element.color ?? document?.theme.border ?? "#E2E8F0"}
                                  onChange={(event) =>
                                    updateElement(selectedSection.id, element.id, (current) =>
                                      current.type === "divider"
                                        ? { ...current, color: event.target.value }
                                        : current
                                    )
                                  }
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">No elements yet. Add from the Elements panel.</p>
                  )}
                </InspectorGroup>

                <InspectorGroup title="Style">
                  <div className="grid gap-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Alignment
                      <select
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedSection.style.alignment}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            style: { ...section.style, alignment: event.target.value as SiteSection["style"]["alignment"] }
                          }))
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Spacing
                      <select
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedSection.style.spacing}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            style: { ...section.style, spacing: event.target.value as SiteSection["style"]["spacing"] }
                          }))
                        }
                      >
                        <option value="compact">Compact</option>
                        <option value="normal">Normal</option>
                        <option value="airy">Airy</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Background
                      <select
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedSection.style.background.type}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            style: {
                              ...section.style,
                              background: {
                                ...section.style.background,
                                type: event.target.value as SiteSection["style"]["background"]["type"]
                              }
                            }
                          }))
                        }
                      >
                        <option value="plain">Plain</option>
                        <option value="gradient">Gradient</option>
                        <option value="image">Image</option>
                      </select>
                    </label>
                    {selectedSection.style.background.type !== "plain" ? (
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Background value
                        <input
                          className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                          value={selectedSection.style.background.value ?? ""}
                          onChange={(event) =>
                            updateSection(selectedSection.id, (section) => ({
                              ...section,
                              style: {
                                ...section.style,
                                background: {
                                  ...section.style.background,
                                  value: event.target.value
                                }
                              }
                            }))
                          }
                          placeholder={
                            selectedSection.style.background.type === "gradient"
                              ? "linear-gradient(...)"
                              : "Image URL"
                          }
                        />
                      </label>
                    ) : null}
                    {selectedSection.style.background.type === "image" ? (
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Overlay
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          className="mt-2 w-full"
                          value={selectedSection.style.background.overlay ?? 0.45}
                          onChange={(event) =>
                            updateSection(selectedSection.id, (section) => ({
                              ...section,
                              style: {
                                ...section.style,
                                background: {
                                  ...section.style.background,
                                  overlay: Number(event.target.value)
                                }
                              }
                            }))
                          }
                        />
                      </label>
                    ) : null}
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Button style
                      <select
                        className="mt-2 h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                        value={selectedSection.style.buttonStyle}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => ({
                            ...section,
                            style: { ...section.style, buttonStyle: event.target.value as SiteSection["style"]["buttonStyle"] }
                          }))
                        }
                      >
                        <option value="solid">Solid</option>
                        <option value="outline">Outline</option>
                      </select>
                    </label>
                  </div>
                </InspectorGroup>

                {supportsImages(selectedSection.type) ? (
                  <InspectorGroup title="Media Manager">
                    <p className="text-xs text-muted">
                      Upload media or search stock images to keep sections on-brand.
                    </p>
                    <div className="rounded-xl border border-border-subtle bg-white/5 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold">
                          Upload media
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file || !uploadSlot) return;
                              uploadImage(file, uploadSlot);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!nextImageSlot) return;
                            setImageTarget({ slot: nextImageSlot, mode: "append" });
                          }}
                          className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold"
                        >
                          Search stock
                        </button>
                      </div>
                      {uploadSlot ? (
                        <p className="mt-2 text-xs text-muted">
                          New uploads will fill the {uploadSlot.replace("-", " ")} slot.
                        </p>
                      ) : null}
                    </div>
                    {(selectedSection.images ?? []).length ? (
                      <div className="space-y-3">
                        {(selectedSection.images ?? []).map((image) => (
                          <div key={image.slot} className="rounded-xl border border-border-subtle p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                {image.slot}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => shuffleImage(image.slot)}
                                  className="text-xs font-semibold text-muted"
                                >
                                  Shuffle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setImageTarget({ slot: image.slot, mode: "replace" })}
                                  className="text-xs font-semibold text-muted"
                                >
                                  Replace
                                </button>
                              </div>
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.src}
                              alt={image.alt ?? "Section image"}
                              className="mt-3 h-32 w-full rounded-lg object-cover"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              className="mt-3 w-full text-xs"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  uploadImage(file, image.slot);
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">No images yet. Upload media or search stock to add visuals.</p>
                    )}
                    {imageTarget ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            className="h-9 w-full rounded-xl border border-border-subtle px-2 text-sm"
                            value={imageSearchQuery}
                            onChange={(event) => setImageSearchQuery(event.target.value)}
                            placeholder="What are you looking for?"
                          />
                          <button
                            type="button"
                            onClick={searchImages}
                            className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold"
                          >
                            Search
                          </button>
                        </div>
                        {imageSearchLoading ? <p className="text-xs text-muted">Searching...</p> : null}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {imageSearchResults.map((image) => (
                            <button
                              key={image.url}
                              type="button"
                              onClick={() => applyImageResult(image)}
                              className="overflow-hidden rounded-lg border border-border-subtle"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image.url} alt={image.alt} className="h-24 w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </InspectorGroup>
                ) : null}
              </div>
            )}
          </aside>

        <section className="flex-1 px-4 py-6">
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-white/80 px-4 py-2 text-xs text-muted shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{breadcrumb.pageLabel}</span>
                <span className="text-muted">/</span>
                <span>{breadcrumb.sectionLabel}</span>
                <span className="text-muted">/</span>
                <span>{breadcrumb.elementLabel}</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {selectedNode?.type ? `Selected ${selectedNode.type}` : "No selection"}
              </div>
            </div>
            <div ref={previewContainerRef} className="w-full">
              <div
                className="relative mx-auto origin-top"
                style={{
                  width: previewWidth,
                  height: previewHeight,
                  transform: `scale(${previewScale})`
                }}
              >
                {gridEnabled ? (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
                      backgroundSize: "40px 40px"
                    }}
                  />
                ) : null}
                {rulersEnabled ? (
                  <>
                    <div
                      className="pointer-events-none absolute -top-6 left-0 h-6 w-full"
                      style={{
                        backgroundImage:
                          "linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
                        backgroundSize: "80px 6px"
                      }}
                    />
                    <div
                      className="pointer-events-none absolute left-[-24px] top-0 w-6 h-full"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px)",
                        backgroundSize: "6px 80px"
                      }}
                    />
                  </>
                ) : null}
                <iframe
                  ref={previewRef}
                  title="Site preview"
                  src={`/s/${initialSite.slug}?preview=true&siteId=${initialSite.id}&page=${activePage?.slug ?? "home"}`}
                  className="h-full w-full rounded-2xl border border-border-subtle bg-white"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        title="Delete section?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!deleteConfirm) return;
                deleteSection(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          You are about to remove the {deleteConfirm ? SECTION_LABELS[deleteConfirm.type] : "selected"} section
          from this page.
        </p>
        <p className="text-xs text-white/70">You can undo from the toolbar if you change your mind.</p>
      </Modal>

      <Modal
        open={Boolean(pageDeleteConfirm)}
        onClose={() => setPageDeleteConfirm(null)}
        title="Delete page?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPageDeleteConfirm(null)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!pageDeleteConfirm) return;
                deletePage(pageDeleteConfirm.id);
                setPageDeleteConfirm(null);
              }}
              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Delete page
            </button>
          </>
        }
      >
        <p>
          You are about to delete the {pageDeleteConfirm?.name ?? "selected"} page and all of its
          sections.
        </p>
        <p className="text-xs text-white/70">This action cannot be undone.</p>
      </Modal>

      <Modal
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        title="Ready to publish?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPublishConfirmOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-emerald-950 disabled:opacity-60"
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
          </>
        }
      >
        <p>Publishing will make your latest edits live for visitors immediately.</p>
        <ul className="list-disc space-y-2 pl-5 text-xs text-white/70">
          <li>Double-check the accuracy of your content and contact details.</li>
          <li>You are responsible for verifying the accuracy and legality of published content.</li>
        </ul>
      </Modal>

      <Modal
        open={publishSuccessOpen}
        onClose={() => setPublishSuccessOpen(false)}
        title="Your site is published"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPublishSuccessOpen(false)}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
            >
              Close
            </button>
            {publishedUrl ? (
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white"
              >
                View live site
              </a>
            ) : null}
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-neutral-900"
            >
              Go to dashboard
            </Link>
          </>
        }
      >
        <p>Congratulations! Your site is live online.</p>
        {publishedUrl ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
            {publishedUrl}
          </div>
        ) : null}
        <div className="space-y-2 text-xs text-white/70">
          <p className="font-semibold text-white">What&apos;s next</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Finish setting up your site in the dashboard (domain, SEO, and business info).</li>
            <li>Share your link with customers and update any profiles.</li>
          </ul>
          <p>You are responsible for verifying the accuracy and legality of published content.</p>
        </div>
      </Modal>
    </main>
  );
}
