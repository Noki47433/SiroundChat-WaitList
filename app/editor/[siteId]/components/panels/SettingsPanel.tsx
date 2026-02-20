"use client";

import { useMemo, useState } from "react";
import { useEditorActions, useEditorState } from "@/lib/website-builder/editor/EditorProvider";

export function SettingsPanel() {
  const state = useEditorState();
  const { updateDocument } = useEditorActions();
  const seo = state.document?.seo ?? {};
  const [imageDraft, setImageDraft] = useState(seo.ogImage ?? "");

  const heroFallback = useMemo(() => {
    const hero = state.document?.pages?.[0]?.sections?.find((section) => section.type === "hero");
    return {
      title: hero?.content?.headline ?? "",
      description: hero?.content?.subheadline ?? ""
    };
  }, [state.document]);

  if (!state.document) {
    return <p className="text-sm text-sc-muted">No site loaded.</p>;
  }

  const updateSeo = (updates: { title?: string; description?: string; ogImage?: string | null }) => {
    updateDocument((doc) => ({
      ...doc,
      seo: {
        title: updates.title ?? doc.seo?.title ?? heroFallback.title,
        description: updates.description ?? doc.seo?.description ?? heroFallback.description,
        ogImage: updates.ogImage ?? doc.seo?.ogImage ?? null
      }
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">Site Settings</p>
        <p className="mt-1 text-xs text-sc-muted">SEO and metadata for search and sharing.</p>
      </div>

      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        SEO Title
        <input
          className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
          value={seo.title ?? heroFallback.title}
          onChange={(event) => updateSeo({ title: event.target.value })}
          placeholder="Business name | Industry"
        />
      </label>

      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        SEO Description
        <textarea
          className="min-h-[90px] w-full rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-sm text-sc-text"
          value={seo.description ?? heroFallback.description}
          onChange={(event) => updateSeo({ description: event.target.value })}
          placeholder="Short description for search results"
        />
      </label>

      <label className="space-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-sc-muted">
        Open Graph Image (URL)
        <input
          className="h-10 w-full rounded-xl border border-sc-border bg-sc-surface px-3 text-sm text-sc-text"
          value={imageDraft}
          onChange={(event) => setImageDraft(event.target.value)}
          onBlur={() => updateSeo({ ogImage: imageDraft.trim() || null })}
          placeholder="https://..."
        />
      </label>

      <div className="rounded-xl border border-sc-border bg-sc-surface px-3 py-2 text-xs text-sc-muted">
        These fields update your site metadata used for search listings and social previews.
      </div>
    </div>
  );
}
