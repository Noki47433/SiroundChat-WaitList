export type GenerationPolicy = {
  conversion_first: boolean;
  brand_editorial: boolean;
  allow_variant_diversity_forcing: boolean;
  planTemperature: 0.2;
  fillTemperature: 0.3;
  maxTemperature: 0.4;
};

const CONVERSION_FIRST_TERMS = [
  "home service",
  "home-services",
  "clinic",
  "medical",
  "dental",
  "plumbing",
  "hvac",
  "electrical",
  "landscaping",
  "repair",
  "cleaning",
  "local service"
];

const BRAND_EDITORIAL_TERMS = ["portfolio", "fashion", "studio", "creative", "photography"];

const includesAny = (value: string, terms: string[]) => {
  return terms.some((term) => value.includes(term));
};

export const getGenerationPolicy = (
  businessType: string,
  subtype?: string | null,
  ctaIntent?: string | null
): GenerationPolicy => {
  const haystack = `${businessType} ${subtype ?? ""} ${ctaIntent ?? ""}`.toLowerCase();
  const conversionFirst = includesAny(haystack, CONVERSION_FIRST_TERMS);
  const brandEditorial = includesAny(haystack, BRAND_EDITORIAL_TERMS);

  return {
    conversion_first: conversionFirst,
    brand_editorial: brandEditorial,
    allow_variant_diversity_forcing: !conversionFirst,
    planTemperature: 0.2,
    fillTemperature: 0.3,
    maxTemperature: 0.4
  };
};
