import { Inter, Oswald } from "next/font/google";
import { ContactSection } from "@/components/templates/food-truck/sections/ContactSection";
import { HeroSection } from "@/components/templates/food-truck/sections/HeroSection";
import { LocationSection } from "@/components/templates/food-truck/sections/LocationSection";
import { MenuSection } from "@/components/templates/food-truck/sections/MenuSection";
import { ReservationCtaSection } from "@/components/templates/food-truck/sections/ReservationCtaSection";
import { Footer } from "@/components/templates/food-truck/Footer";
import { Header } from "@/components/templates/food-truck/Header";
import { StickyCta } from "@/components/templates/food-truck/StickyCta";
import { foodTruckData } from "@/components/templates/food-truck/data";
import styles from "@/components/templates/food-truck/food-truck.module.css";
import type { IntegratedTemplateEditorSettings } from "@/lib/builder/template-sites/schema";
import { getSectionEditorStyle, isSectionEnabled } from "@/lib/builder/template-sites/editor";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-food-truck-display",
  weight: ["400", "500", "600", "700"]
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-food-truck-body",
  weight: ["400", "500", "600", "700"]
});

type FoodTruckTemplatePageProps = {
  data?: typeof foodTruckData;
  siteId?: string | null;
  editorSettings?: IntegratedTemplateEditorSettings;
};

export function FoodTruckTemplatePage({
  data = foodTruckData,
  siteId,
  editorSettings
}: FoodTruckTemplatePageProps) {
  const sectionStyle = (key: string) => getSectionEditorStyle("food-truck", editorSettings, key);

  return (
    <main className={`${styles.root} ${oswald.variable} ${inter.variable} min-h-screen`}>
      {isSectionEnabled(editorSettings, "header") ? (
        <div data-editor-section="true" style={sectionStyle("header")}>
          <Header brand={data.brand} data={data.header} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "hero") ? (
        <div data-editor-section="true" data-editor-hero="true" style={sectionStyle("hero")}>
          <HeroSection data={data.hero} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "menu") ? (
        <div data-editor-section="true" style={sectionStyle("menu")}>
          <MenuSection data={data.menu} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "location") ? (
        <div data-editor-section="true" style={sectionStyle("location")}>
          <LocationSection data={data.location} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "contact") ? (
        <div data-editor-section="true" style={sectionStyle("contact")}>
          <ContactSection data={data.contact} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "reservation") ? (
        <div data-editor-section="true" style={sectionStyle("reservation")}>
          <ReservationCtaSection
            data={data.reservation}
            siteId={siteId}
            brandName={data.brand.name}
            logoUrl={data.brand.logoUrl}
          />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "footer") ? (
        <div data-editor-section="true" style={sectionStyle("footer")}>
          <Footer brand={data.brand} data={data.footer} />
        </div>
      ) : null}
      {isSectionEnabled(editorSettings, "reservation") ? <StickyCta data={data.stickyCta} /> : null}
    </main>
  );
}
