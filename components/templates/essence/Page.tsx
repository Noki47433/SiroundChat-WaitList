import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import styles from "@/components/templates/essence/essence.module.css";
import { essenceData } from "@/components/templates/essence/data";
import { Footer } from "@/components/templates/essence/Footer";
import { Header } from "@/components/templates/essence/Header";
import { ContactSection } from "@/components/templates/essence/sections/ContactSection";
import { DishesSection } from "@/components/templates/essence/sections/DishesSection";
import { ExperienceSection } from "@/components/templates/essence/sections/ExperienceSection";
import { HeroSection } from "@/components/templates/essence/sections/HeroSection";
import { PhilosophySection } from "@/components/templates/essence/sections/PhilosophySection";
import { VisionSection } from "@/components/templates/essence/sections/VisionSection";
import type { IntegratedTemplateEditorSettings } from "@/lib/builder/template-sites/schema";
import { getSectionEditorStyle, isSectionEnabled } from "@/lib/builder/template-sites/editor";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-essence-sans",
  weight: ["300", "400", "500", "600", "700"]
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-essence-serif",
  weight: ["300", "400", "500", "600", "700"]
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-essence-mono",
  weight: ["400", "500"]
});

type EssenceTemplatePageProps = {
  data?: typeof essenceData;
  siteId?: string | null;
  editorSettings?: IntegratedTemplateEditorSettings;
};

export function EssenceTemplatePage({
  data = essenceData,
  siteId,
  editorSettings
}: EssenceTemplatePageProps) {
  const sectionStyle = (key: string) => getSectionEditorStyle("essence", editorSettings, key);

  return (
    <main className={`${styles.root} ${dmSans.variable} ${cormorant.variable} ${jetbrainsMono.variable} min-h-screen`}>
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
      {isSectionEnabled(editorSettings, "vision") ? (
        <div data-editor-section="true" style={sectionStyle("vision")}>
          <VisionSection data={data.vision} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "story") ? (
        <div data-editor-section="true" style={sectionStyle("story")}>
          <PhilosophySection data={data.philosophy} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "experience") ? (
        <div data-editor-section="true" style={sectionStyle("experience")}>
          <ExperienceSection data={data.experience} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "menu") ? (
        <div data-editor-section="true" style={sectionStyle("menu")}>
          <DishesSection data={data.dishes} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "contact") ? (
        <div data-editor-section="true" style={sectionStyle("contact")}>
          <ContactSection data={data.contact} siteId={siteId} />
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
