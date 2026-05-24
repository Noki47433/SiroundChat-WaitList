import styles from "@/components/templates/evasion/evasion.module.css";
import { evasionData } from "@/components/templates/evasion/data";
import { Header } from "@/components/templates/evasion/Header";
import { CollectionSection } from "@/components/templates/evasion/sections/CollectionSection";
import { EditorialSection } from "@/components/templates/evasion/sections/EditorialSection";
import { FeaturedProductsSection } from "@/components/templates/evasion/sections/FeaturedProductsSection";
import { FooterSection } from "@/components/templates/evasion/sections/FooterSection";
import { GallerySection } from "@/components/templates/evasion/sections/GallerySection";
import { HeroSection } from "@/components/templates/evasion/sections/HeroSection";
import { PhilosophySection } from "@/components/templates/evasion/sections/PhilosophySection";
import { ReservationCtaSection } from "@/components/templates/evasion/sections/ReservationCtaSection";
import { TechnologySection } from "@/components/templates/evasion/sections/TechnologySection";
import { TestimonialsSection } from "@/components/templates/evasion/sections/TestimonialsSection";
import type { IntegratedTemplateEditorSettings } from "@/lib/builder/template-sites/schema";
import { getSectionEditorStyle, isSectionEnabled } from "@/lib/builder/template-sites/editor";

type EvasionTemplatePageProps = {
  data?: typeof evasionData;
  siteId?: string | null;
  editorSettings?: IntegratedTemplateEditorSettings;
};

export function EvasionTemplatePage({
  data = evasionData,
  siteId,
  editorSettings
}: EvasionTemplatePageProps) {
  const sectionStyle = (key: string) => getSectionEditorStyle("evasion", editorSettings, key);

  return (
    <main className={`${styles.root} min-h-screen bg-[var(--evasion-bg)] text-[var(--evasion-text)]`}>
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
          <FeaturedProductsSection data={data.featuredProducts} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "experience") ? (
        <div data-editor-section="true" style={sectionStyle("experience")}>
          <TechnologySection data={data.technology} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "gallery") ? (
        <div data-editor-section="true" style={sectionStyle("gallery")}>
          <GallerySection data={data.gallery} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "menu") ? (
        <div data-editor-section="true" style={sectionStyle("menu")}>
          <CollectionSection data={data.accessories} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "editorial") ? (
        <div data-editor-section="true" style={sectionStyle("editorial")}>
          <EditorialSection data={data.editorial} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "testimonials") ? (
        <div data-editor-section="true" style={sectionStyle("testimonials")}>
          <TestimonialsSection data={data.testimonial} />
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
          <FooterSection brand={data.brand} data={data.footer} />
        </div>
      ) : null}
    </main>
  );
}
