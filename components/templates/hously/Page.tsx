import styles from "@/components/templates/hously/hously.module.css";
import { houslyData } from "@/components/templates/hously/data";
import { Footer } from "@/components/templates/hously/Footer";
import { Header } from "@/components/templates/hously/Header";
import { ExperienceSection } from "@/components/templates/hously/sections/ExperienceSection";
import { FaqSection } from "@/components/templates/hously/sections/FaqSection";
import { HeroSection } from "@/components/templates/hously/sections/HeroSection";
import { HighlightsSection } from "@/components/templates/hously/sections/HighlightsSection";
import { PhilosophySection } from "@/components/templates/hously/sections/PhilosophySection";
import { ReservationCtaSection } from "@/components/templates/hously/sections/ReservationCtaSection";
import type { IntegratedTemplateEditorSettings } from "@/lib/builder/template-sites/schema";
import { getSectionEditorStyle, isSectionEnabled } from "@/lib/builder/template-sites/editor";

type HouslyTemplatePageProps = {
  data?: typeof houslyData;
  siteId?: string | null;
  editorSettings?: IntegratedTemplateEditorSettings;
};

export function HouslyTemplatePage({
  data = houslyData,
  siteId,
  editorSettings
}: HouslyTemplatePageProps) {
  const sectionStyle = (key: string) => getSectionEditorStyle("hously", editorSettings, key);

  return (
    <main className={`${styles.root} min-h-screen`}>
      {isSectionEnabled(editorSettings, "header") ? (
        <div data-editor-section="true" style={sectionStyle("header")}>
          <Header brand={data.brand} logoUrl={data.logoUrl} data={data.header} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "hero") ? (
        <div data-editor-section="true" data-editor-hero="true" style={sectionStyle("hero")}>
          <HeroSection data={data.hero} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "story") ? (
        <div data-editor-section="true" style={sectionStyle("story")}>
          <PhilosophySection data={data.philosophy} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "highlights") ? (
        <div data-editor-section="true" style={sectionStyle("highlights")}>
          <HighlightsSection data={data.highlights} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "experience") ? (
        <div data-editor-section="true" style={sectionStyle("experience")}>
          <ExperienceSection data={data.experience} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "faq") ? (
        <div data-editor-section="true" style={sectionStyle("faq")}>
          <FaqSection data={data.faq} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "reservation") ? (
        <div data-editor-section="true" style={sectionStyle("reservation")}>
          <ReservationCtaSection
            data={data.reservation}
            siteId={siteId}
            brandName={data.brand}
            logoUrl={data.logoUrl}
          />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "footer") ? (
        <div data-editor-section="true" style={sectionStyle("footer")}>
          <Footer brand={data.brand} data={data.footer} />
        </div>
      ) : null}
    </main>
  );
}
