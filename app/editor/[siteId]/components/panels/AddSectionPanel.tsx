"use client";

import { useMemo, useState } from "react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";
import { selectActivePage, selectSelectedSection } from "@/lib/website-builder/editor/selectors";
import { TEMPLATE_ALLOWED_VARIANTS } from "@/lib/website-builder/templates/registry";
import type { SiteSection } from "@/lib/website-builder/types";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const defaultStyle: SiteSection["style"] = {
  alignment: "left",
  spacing: "normal",
  background: { type: "plain" },
  buttonStyle: "solid",
  colorOverride: null
};

const defaultContentByType: Record<SiteSection["type"], Record<string, any>> = {
  hero: {
    headline: "Headline",
    subheadline: "Add a short description to introduce the business.",
    ctaLabel: "Get started",
    ctaHref: "#contact"
  },
  about: {
    title: "About",
    body: "Share the story behind this business and what makes it special."
  },
  services: {
    title: "Services",
    items: [
      { title: "Service one", body: "Describe the service in one sentence." },
      { title: "Service two", body: "Describe the service in one sentence." },
      { title: "Service three", body: "Describe the service in one sentence." }
    ]
  },
  testimonials: {
    title: "Testimonials",
    items: [
      { quote: "Client quote goes here.", name: "Alex Lee", role: "Client" },
      { quote: "Another highlight from a client.", name: "Jamie Park", role: "Client" }
    ]
  },
  contact: {
    title: "Contact",
    body: "Share how customers can reach you.",
    email: "",
    phone: "",
    address: ""
  },
  footer: {
    text: "© Your business. All rights reserved."
  },
  gallery: { title: "Gallery" },
  pricing: {
    title: "Pricing",
    plans: [
      { name: "Starter", price: "$99", description: "Essentials to get started.", features: [] }
    ]
  },
  cta: { title: "Ready to start?", body: "Tell us about your goals.", ctaLabel: "Get started", ctaHref: "#contact" },
  faq: { title: "FAQ", items: [{ question: "How does it work?", answer: "Share the details here." }] },
  reservation: { title: "Reservations", body: "Invite visitors to book a table." },
  newsletter: { title: "Join our newsletter", body: "Stay up to date.", ctaLabel: "Subscribe" },
  "blog-index": {},
  "blog-post": {},
  "store-listing": {},
  "store-product": {},
  "store-cart": {},
  custom: {},
  "app-embed": {}
};

const SECTION_LIBRARY = [
  {
    id: "welcome",
    label: "Welcome / Hero",
    items: [
      {
        type: "hero" as const,
        title: "Hero",
        description: "Headline, subheadline, and primary CTA."
      }
    ]
  },
  {
    id: "about",
    label: "About",
    items: [
      {
        type: "about" as const,
        title: "About",
        description: "Share your story and mission."
      }
    ]
  },
  {
    id: "services",
    label: "Services",
    items: [
      {
        type: "services" as const,
        title: "Services",
        description: "Summarize top offerings."
      }
    ]
  },
  {
    id: "contact",
    label: "Contact",
    items: [
      {
        type: "contact" as const,
        title: "Contact",
        description: "Email, phone, and address."
      }
    ]
  },
  {
    id: "cta",
    label: "Call To Action",
    items: [
      {
        type: "cta" as const,
        title: "CTA",
        description: "Prompt visitors to take action."
      }
    ]
  },
  {
    id: "gallery",
    label: "Gallery",
    items: [
      {
        type: "gallery" as const,
        title: "Gallery",
        description: "Showcase photos or work."
      }
    ]
  },
  {
    id: "faq",
    label: "FAQ",
    items: [
      {
        type: "faq" as const,
        title: "FAQ",
        description: "Answer common questions."
      }
    ]
  },
  {
    id: "pricing",
    label: "Pricing",
    items: [
      {
        type: "pricing" as const,
        title: "Pricing",
        description: "Plans and packages."
      }
    ]
  },
  {
    id: "testimonials",
    label: "Testimonials",
    items: [
      {
        type: "testimonials" as const,
        title: "Testimonials",
        description: "Client quotes and proof."
      }
    ]
  },
  {
    id: "reservation",
    label: "Reservations",
    items: [
      {
        type: "reservation" as const,
        title: "Reservations",
        description: "Collect booking requests."
      }
    ]
  },
  {
    id: "newsletter",
    label: "Newsletter",
    items: [
      {
        type: "newsletter" as const,
        title: "Newsletter",
        description: "Signup to collect subscribers."
      }
    ]
  },
  {
    id: "custom",
    label: "Custom",
    items: [
      {
        type: "custom" as const,
        title: "Custom",
        description: "Blank section with freeform elements."
      }
    ]
  },
  {
    id: "footer",
    label: "Footer",
    items: [
      {
        type: "footer" as const,
        title: "Footer",
        description: "Copyright and links."
      }
    ]
  }
];

export function AddSectionPanel() {
  const state = useEditorState();
  const { updateDocument, setSelectedNode } = useEditorActions();
  const activePage = selectActivePage(state);
  const selectedSection = selectSelectedSection(state);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(SECTION_LIBRARY[0]?.id ?? "welcome");

  const filteredLibrary = useMemo(() => {
    if (!searchQuery.trim()) return SECTION_LIBRARY;
    const query = searchQuery.trim().toLowerCase();
    return SECTION_LIBRARY.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [item.title, item.description, group.label].some((value) => value.toLowerCase().includes(query))
      )
    })).filter((group) => group.items.length);
  }, [searchQuery]);

  const visibleCategory =
    filteredLibrary.find((group) => group.id === activeCategory) ?? filteredLibrary[0];

  const handleAddSection = (type: SiteSection["type"]) => {
    if (!activePage || !state.document) return;
    const newSectionId = createId();
    const allowedVariants = TEMPLATE_ALLOWED_VARIANTS[state.document.templateId]?.[type] ?? ["A"];
    const newSection: SiteSection = {
      id: newSectionId,
      type,
      variant: allowedVariants[0],
      enabled: true,
      style: { ...defaultStyle },
      content: { ...(defaultContentByType[type] ?? {}) }
    };

    updateDocument((doc) => {
      return {
        ...doc,
        pages: doc.pages.map((page) => {
          if (page.id !== activePage.id) return page;
          const sections = [...page.sections];
          const insertIndex = selectedSection
            ? Math.max(0, sections.findIndex((section) => section.id === selectedSection.id) + 1)
            : sections.length;
          sections.splice(insertIndex, 0, newSection);
          return { ...page, sections };
        })
      };
    });

    setSelectedNode({ type: "section", id: newSectionId, parentId: activePage.id });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Search</label>
        <input
          className="mt-2 h-9 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text placeholder:text-sc-muted"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search sections"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-[120px_1fr]">
        <div className="space-y-2">
          {filteredLibrary.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveCategory(group.id)}
              className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                activeCategory === group.id ? "bg-sc-surface-2 text-sc-text" : "text-sc-muted"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {visibleCategory?.items.map((item) => (
            <div
              key={item.title}
              className="group rounded-xl border border-sc-border bg-sc-surface p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-sc-text">{item.title}</p>
                  <p className="text-xs text-sc-muted">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddSection(item.type)}
                  className="rounded-full border border-sc-border px-3 py-1 text-xs font-semibold text-sc-text opacity-0 transition group-hover:opacity-100"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 h-16 rounded-lg border border-dashed border-sc-border bg-sc-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
