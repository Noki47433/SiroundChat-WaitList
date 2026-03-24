export type TextStyleToken = {
  size: string;
  weight: number;
  lineHeight: string;
  letterSpacing?: string;
};

export type ContentStyle = {
  color?: string;
  fontSize?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  lineHeight?: string;
  letterSpacing?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "line-through";
  maxWidth?: string;
  opacity?: number;
};

export type ElementStyle = {
  color?: string;
  fontSize?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  lineHeight?: string;
  letterSpacing?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "line-through";
  maxWidth?: string;
  opacity?: number;
  background?: string;
  padding?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  boxShadow?: string;
};

export type ElementFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SiteThemeTokens = {
  primary: string;
  secondary: string;
  bg: string;
  text: string;
  muted: string;
  surface: string;
  border: string;
  buttonText: string;
  accent?: string;
  radius?: "lg" | "xl";
  fontHeading?: string;
  fontBody?: string;
  textStyles?: {
    h1: TextStyleToken;
    h2: TextStyleToken;
    h3: TextStyleToken;
    body: TextStyleToken;
    caption: TextStyleToken;
  };
  pageTransitions?: "none" | "fade" | "slide";
};

export type SectionStyle = {
  alignment: "left" | "center";
  spacing: "compact" | "normal" | "airy";
  layoutMode?: "flow" | "freeform";
  background:
    | { type: "plain" }
    | {
        type: "gradient";
        value?: string;
        angle?: number;
        stops?: { color: string; position: number }[];
      }
    | {
        type: "image";
        value?: string;
        overlay?: number;
        size?: "cover" | "contain";
        position?: string;
        repeat?: "no-repeat" | "repeat";
      };
  buttonStyle: "solid" | "outline";
  colorOverride?: Partial<Pick<SiteThemeTokens, "primary" | "bg" | "text">> | null;
};

export type SiteImage = {
  slot: string;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  credit?: { provider: "pexels" | "unsplash" | "openai"; photographer?: string; sourceUrl?: string };
  query?: string;
};

export type SiteBrief = {
  businessName?: string;
  logoUrl?: string;
  industry?: string;
  description?: string;
  tone?: string;
  goals?: string[];
  pages?: string[];
  language?: string;
  generationBrief?: {
    audience?: string;
    coreOffer?: string;
    primaryCtaGoal?: string;
    topServices?: string[];
    proofPoints?: string[];
    tone?: string;
  };
  theme?: {
    primary?: string;
    background?: string;
    fontFamily?: string;
  };
    designDNA?: {
      variationSeed?: string;
      layoutStyle?: string;
      palette?: {
        primary?: string;
      secondary?: string;
      background?: string;
      accent?: string;
    };
    fontPair?: {
      heading?: string;
      body?: string;
      };
      variantBias?: Record<string, string>;
      sectionOrder?: string[];
      imageryStyle?: string;
      industryKey?: string;
      archetypeKey?: string;
      layoutDNA?: string;
      sectionBlueprints?: string[];
      conversionGoal?: string;
    };
  };

export type SiteElement =
  | {
      id: string;
      type: "text";
      text: string;
      textStyle: "h1" | "h2" | "h3" | "body" | "caption";
      align?: "left" | "center";
      style?: ElementStyle;
      frame?: ElementFrame;
    }
  | {
      id: string;
      type: "image";
      src: string;
      alt?: string;
      caption?: string;
      style?: ElementStyle;
      frame?: ElementFrame;
    }
  | {
      id: string;
      type: "button";
      label: string;
      href: string;
      variant?: "primary" | "outline";
      align?: "left" | "center";
      style?: ElementStyle;
      frame?: ElementFrame;
    }
  | {
      id: string;
      type: "spacer";
      height?: number;
      style?: ElementStyle;
      frame?: ElementFrame;
    }
  | {
      id: string;
      type: "divider";
      thickness?: number;
      color?: string;
      style?: ElementStyle;
      frame?: ElementFrame;
    };

export type SiteSection = {
  id: string;
  type:
    | "hero"
    | "services"
    | "about"
    | "gallery"
    | "testimonials"
    | "pricing"
    | "cta"
    | "faq"
    | "contact"
    | "reservation"
    | "footer"
    | "newsletter"
    | "blog-index"
    | "blog-post"
    | "store-listing"
    | "store-product"
    | "store-cart"
    | "custom"
    | "app-embed";
  variant: string;
  name?: string;
  enabled: boolean;
  style: SectionStyle;
  content: Record<string, any>;
  contentStyles?: Record<string, ContentStyle>;
  elements?: SiteElement[];
  images?: SiteImage[];
};

export type SitePage = {
  id: string;
  name: string;
  slug: string;
  showInMenu?: boolean;
  menuTitle?: string;
  parentId?: string | null;
  order?: number;
  isSystem?: boolean;
  systemGroup?: string;
  sections: SiteSection[];
};

export type SiteApp = {
  id: "live-chat" | "newsletter" | "analytics" | "booking-widget";
  name: string;
  installedAt: string;
  enabled: boolean;
  config?: Record<string, any>;
};

export type SiteDocument = {
  templateId: string;
  tone: string;
  theme: SiteThemeTokens;
  pages: SitePage[];
  apps?: SiteApp[];
  siteBrief?: SiteBrief;
  seo?: {
    title?: string;
    description?: string;
    ogImage?: string | null;
  };
  savedSections?: SiteSection[];
  mediaLibrary?: SiteImage[];
  chat_prompt_topbar_enabled?: boolean;
  chat_prompt_topbar_text?: string;
  chat_prompt_topbar_cta?: string;
  chat_launcher_glow_enabled?: boolean;
  customCode?: {
    head?: string | null;
    body?: string | null;
  };
};
