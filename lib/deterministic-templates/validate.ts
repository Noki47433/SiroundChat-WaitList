import {
  ALLOWED_SPACING_CLASSES,
  ALLOWED_WIDTH_CLASSES,
  DENTAL_PRIMARY_CTA_LABEL,
  REAL_ESTATE_PRIMARY_CTA_LABEL,
  RESTAURANT_PRIMARY_CTA_LABELS,
  SERVICE_PRIMARY_CTA_LABELS,
  type DeterministicTemplateId
} from "@/lib/deterministic-templates/contracts";
import {
  DeterministicZodSchemas,
  type DeterministicPayload,
  type DentalPayload,
  type RealEstatePayload,
  type RestaurantPayload,
  type ServicePayload
} from "@/lib/deterministic-templates/schemas";

type ValidationError = {
  path: string;
  code: string;
  message: string;
};

export type DeterministicValidationResult<T extends DeterministicPayload> =
  | {
      ok: true;
      value: T;
      errors: [];
    }
  | {
      ok: false;
      errors: ValidationError[];
    };

const toPath = (path: Array<string | number>) =>
  path
    .map((part) => (typeof part === "number" ? `[${part}]` : `.${part}`))
    .join("")
    .replace(/^\./, "");

const normalizePath = (path: readonly PropertyKey[]): Array<string | number> => {
  return path.map((part) => (typeof part === "number" ? part : String(part)));
};

const findAltLengthViolations = (input: unknown, currentPath: Array<string | number> = []): ValidationError[] => {
  if (Array.isArray(input)) {
    return input.flatMap((item, index) => findAltLengthViolations(item, [...currentPath, index]));
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  const record = input as Record<string, unknown>;
  const local: ValidationError[] = [];

  for (const [key, value] of Object.entries(record)) {
    const nextPath = [...currentPath, key];
    if (key === "alt" && typeof value === "string" && value.trim().length > 125) {
      local.push({
        path: toPath(nextPath),
        code: "alt_max_length",
        message: "Image alt text must be 125 characters or fewer."
      });
    }

    local.push(...findAltLengthViolations(value, nextPath));
  }

  return local;
};

const validateRestaurantRules = (payload: RestaurantPayload): ValidationError[] => {
  const errors: ValidationError[] = [];

  const primaryLabels = new Set<string>();
  if (RESTAURANT_PRIMARY_CTA_LABELS.includes(payload.header.primary_cta_label as (typeof RESTAURANT_PRIMARY_CTA_LABELS)[number])) {
    primaryLabels.add(payload.header.primary_cta_label);
  }
  primaryLabels.add(payload.hero.primary_cta_label);

  if (primaryLabels.size !== 1) {
    errors.push({
      path: "header.primary_cta_label",
      code: "restaurant_primary_cta_invariant",
      message: "Restaurant must use exactly one primary CTA intent across header and hero."
    });
  }

  if (payload.menu.variant === "pdf" && !payload.menu.menu_url.toLowerCase().endsWith(".pdf")) {
    errors.push({
      path: "menu.menu_url",
      code: "restaurant_pdf_menu_required",
      message: "Menu variant 'pdf' requires a PDF URL."
    });
  }

  return errors;
};

const validateDentalRules = (payload: DentalPayload): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (
    payload.header.primary_cta_label !== DENTAL_PRIMARY_CTA_LABEL ||
    payload.hero.primary_cta_label !== DENTAL_PRIMARY_CTA_LABEL ||
    payload.contact.booking_cta_label !== DENTAL_PRIMARY_CTA_LABEL
  ) {
    errors.push({
      path: "contact.booking_cta_label",
      code: "dental_booking_presence",
      message: "Dental booking CTA must appear in header, hero, and contact with the same label."
    });
  }

  return errors;
};

const validateServiceRules = (payload: ServicePayload): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!payload.header.primary_cta_label || !payload.hero.primary_cta_label || !payload.contact.booking_cta_label) {
    errors.push({
      path: "header.primary_cta_label",
      code: "service_booking_required",
      message: "Service template requires non-empty booking CTA labels in header, hero, and contact."
    });
  }

  if (payload.gallery.variant === "before_after") {
    if (!payload.gallery.consent_for_before_after) {
      errors.push({
        path: "gallery.consent_for_before_after",
        code: "service_before_after_consent",
        message: "Before/after gallery requires explicit consent."
      });
    }

    payload.gallery.items.forEach((item, index) => {
      if (!item.before_src || !item.after_src) {
        errors.push({
          path: `gallery.items[${index}]`,
          code: "service_before_after_pair_required",
          message: "Before/after gallery items must include both before_src and after_src."
        });
      }
    });
  }

  if (payload.reviews.items.length === 0) {
    const hygieneCount = payload.reviews.fallback_hygiene_bullets.length;
    if (hygieneCount < 1 || hygieneCount > 3) {
      errors.push({
        path: "reviews.fallback_hygiene_bullets",
        code: "service_hygiene_fallback_required",
        message: "When reviews are missing, provide 1-3 hygiene fallback bullets."
      });
    }
  }

  return errors;
};

const validateRealEstateRules = (payload: RealEstatePayload): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (
    payload.header.primary_cta_label !== REAL_ESTATE_PRIMARY_CTA_LABEL ||
    payload.hero.primary_cta_label !== REAL_ESTATE_PRIMARY_CTA_LABEL ||
    payload.contact.inquire_cta_label !== REAL_ESTATE_PRIMARY_CTA_LABEL
  ) {
    errors.push({
      path: "contact.inquire_cta_label",
      code: "real_estate_inquire_required",
      message: "Real estate template requires Inquire CTA in header, hero, and contact."
    });
  }

  if (!payload.contact.legal_teaser.trim() || !payload.footer.legal_url.trim()) {
    errors.push({
      path: "contact.legal_teaser",
      code: "real_estate_legal_required",
      message: "Real estate template requires a legal teaser and legal footer link."
    });
  }

  if (payload.contact.map_mode === "interactive") {
    if (!payload.contact.start_without_audio) {
      errors.push({
        path: "contact.start_without_audio",
        code: "interactive_map_audio_toggle_required",
        message: "Interactive maps must include a start-without-audio option."
      });
    }

    if (!payload.contact.keyboard_navigation_url) {
      errors.push({
        path: "contact.keyboard_navigation_url",
        code: "interactive_map_keyboard_alternative_required",
        message: "Interactive maps must include a keyboard navigation alternative URL."
      });
    }
  }

  return errors;
};

export const validateDeterministicPayload = <T extends DeterministicTemplateId>(
  template: T,
  input: unknown
): DeterministicValidationResult<Extract<DeterministicPayload, { template: T }>> => {
  const parsed = DeterministicZodSchemas[template].safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        path: toPath(normalizePath(issue.path)),
        code: "schema",
        message: issue.message
      }))
    };
  }

  const payload = parsed.data as Extract<DeterministicPayload, { template: T }>;
  const extraErrors: ValidationError[] = [...findAltLengthViolations(payload)];

  switch (template) {
    case "restaurant":
      extraErrors.push(...validateRestaurantRules(payload as RestaurantPayload));
      break;
    case "dental":
      extraErrors.push(...validateDentalRules(payload as DentalPayload));
      break;
    case "service":
      extraErrors.push(...validateServiceRules(payload as ServicePayload));
      break;
    case "real_estate":
      extraErrors.push(...validateRealEstateRules(payload as RealEstatePayload));
      break;
  }

  if (extraErrors.length > 0) {
    return {
      ok: false,
      errors: extraErrors
    };
  }

  return {
    ok: true,
    value: payload,
    errors: []
  };
};

export const assertAllowedLayoutToken = (token: string): boolean => {
  return (
    (ALLOWED_SPACING_CLASSES as readonly string[]).includes(token) ||
    (ALLOWED_WIDTH_CLASSES as readonly string[]).includes(token)
  );
};

export const validateLayoutTokens = (tokens: string[]) => {
  const invalid = Array.from(new Set(tokens.filter((token) => !assertAllowedLayoutToken(token))));
  return {
    ok: invalid.length === 0,
    invalid
  };
};

export const isReducedMotion = (payload: DeterministicPayload) => payload.motion_level === "none";

export const isServiceBookingLabel = (label: string) =>
  SERVICE_PRIMARY_CTA_LABELS.includes(label as (typeof SERVICE_PRIMARY_CTA_LABELS)[number]);
