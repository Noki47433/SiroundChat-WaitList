import type { SiteDocument } from "@/lib/website-builder/types";
import { TemplateRenderer } from "@/components/website-builder/templates/TemplateRenderer";

type PreviewProps = {
  site: SiteDocument;
};

export function PreviewSwitcher({ site }: PreviewProps) {
  return <TemplateRenderer site={site} preview />;
}
