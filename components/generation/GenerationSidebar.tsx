"use client";

import { TEMPLATE_META } from "@/lib/website-builder/templates/registry";
import type { GenerationBrief } from "@/state/generation";

type GenerationSidebarProps = {
  brief: GenerationBrief | null;
  onEditBrief: () => void;
};

export function GenerationSidebar({ brief, onEditBrief }: GenerationSidebarProps) {
  const templateId = brief?.templateId ?? "";
  const templateMeta = TEMPLATE_META.find((template) => template.id === templateId);
  const themePrimary = brief?.primaryColor ?? "#111827";
  const themeSecondary = brief?.secondaryColor ?? "#F3F4F6";
  const fontLabel = brief?.fontFamily ? brief.fontFamily.split(",")[0].replace(/\"/g, "") : "Default";
  const businessName = brief?.businessName ?? "your business";
  const industry = brief?.industry ?? "site";

  return (
    <aside className="flex w-[340px] flex-col gap-4">
      <div className="rounded-[26px] border border-[#e5e1d8] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">SiroundChat</p>
        <h1 className="mt-3 text-lg font-semibold text-neutral-900">
          Let&apos;s get started on a site for {businessName}
        </h1>
        <p className="mt-3 text-sm text-neutral-500">
          We&apos;re building your first draft based on the site profile. You can tweak the brief at any
          time.
        </p>
      </div>
      <div className="rounded-[26px] border border-[#e5e1d8] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">Site brief</p>
          <button
            type="button"
            onClick={onEditBrief}
            className="text-xs font-semibold text-[#3b4ae8] underline"
          >
            Edit
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-neutral-600">
          <p>
            <span className="font-semibold text-neutral-800">{businessName}</span>, your {industry} site
            will be built from the site profile and description you shared.
          </p>
          <p>
            Theme:{" "}
            <span className="font-semibold text-neutral-800">
              {templateMeta?.name ?? "Custom"}
            </span>{" "}
            with <span className="font-semibold text-neutral-800">{fontLabel}</span> typography.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">Palette</span>
            <span className="flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full border border-[#e5e1d8]"
                style={{ backgroundColor: themePrimary }}
              />
              <span
                className="h-4 w-4 rounded-full border border-[#e5e1d8]"
                style={{ backgroundColor: themeSecondary }}
              />
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
