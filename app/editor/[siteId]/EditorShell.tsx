"use client";

import { useState } from "react";
import type { SiteDocument } from "@/lib/website-builder/types";
import { EditorProvider } from "@/lib/website-builder/editor/EditorProvider";
import { ToastProvider } from "@/components/ui/toast";
import { TopBar } from "@/app/editor/[siteId]/components/TopBar";
import { LeftRail } from "@/app/editor/[siteId]/components/LeftRail";
import { LeftPanel } from "@/app/editor/[siteId]/components/LeftPanel";
import { CanvasStage } from "@/app/editor/[siteId]/components/CanvasStage";
import { RightPanel } from "@/app/editor/[siteId]/components/RightPanel";
import { ElementContextToolbar } from "@/app/editor/[siteId]/components/ElementContextToolbar";

type BuilderSite = {
  id: string;
  slug: string;
  businessName: string;
  siteDocument: SiteDocument;
  publishedUrl: string | null;
};

type EditorShellProps = {
  initialSite: BuilderSite;
  canPublish: boolean;
};

export function EditorShell({ initialSite, canPublish }: EditorShellProps) {
  const [publishedUrl, setPublishedUrl] = useState(initialSite.publishedUrl);
  const [selectionRect, setSelectionRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    type: "section" | "element" | "content";
    sectionId?: string;
    elementId?: string;
    contentKey?: string;
  } | null>(null);

  return (
    <ToastProvider>
      <EditorProvider siteId={initialSite.id} initialDocument={initialSite.siteDocument}>
      <div className="sc-editor flex h-screen flex-col overflow-x-hidden bg-sc-bg text-sc-text">
        <TopBar
          siteId={initialSite.id}
          businessName={initialSite.businessName}
          slug={initialSite.slug}
          canPublish={canPublish}
          publishedUrl={publishedUrl}
          onPublished={(url) => setPublishedUrl(url)}
        />
        <div className="flex h-[calc(100vh-60px)] min-w-0 overflow-hidden">
          <LeftRail />
          <LeftPanel />
          <div className="relative flex-1 min-w-0 overflow-hidden">
            <CanvasStage onSelectionRect={setSelectionRect} />
            <ElementContextToolbar selectionRect={selectionRect} />
          </div>
          <RightPanel />
        </div>
      </div>
      </EditorProvider>
    </ToastProvider>
  );
}
