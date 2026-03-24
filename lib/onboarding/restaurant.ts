import { z } from "zod";

export const RESTAURANT_ONBOARDING_STEP_COUNT = 9;
export const STARTER_KNOWLEDGE_MAX_CHARS = 8000;

export const RESTAURANT_DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

export const RESERVATION_METHODS = ["phone", "chatbot", "walk_in", "instagram_dm", "whatsapp"] as const;
export const ATMOSPHERE_BEST_FOR = [
  "families",
  "couples",
  "business_meetings",
  "birthdays",
  "groups",
  "quick_meals"
] as const;

export type OnboardingLanguage = "en" | "sq";
export type RestaurantDayKey = (typeof RESTAURANT_DAY_KEYS)[number];
export type ReservationMethod = (typeof RESERVATION_METHODS)[number];
export type AtmosphereBestFor = (typeof ATMOSPHERE_BEST_FOR)[number];

const createDefaultHours = () =>
  RESTAURANT_DAY_KEYS.reduce(
    (acc, day) => {
      acc[day] = {
        closed: false,
        open: "",
        close: "",
        note: ""
      };
      return acc;
    },
    {} as Record<RestaurantDayKey, { closed: boolean; open: string; close: string; note: string }>
  );

const HoursEntrySchema = z.object({
  closed: z.boolean().default(false),
  open: z.string().default(""),
  close: z.string().default(""),
  note: z.string().default("")
});

export const RestaurantOnboardingDataSchema = z.object({
  industry: z.literal("restaurant").default("restaurant"),
  language: z.enum(["en", "sq"]).default("en"),
  restaurantName: z.string().default(""),
  shortDescription: z.string().default(""),
  cuisineType: z.string().default(""),
  address: z.string().default(""),
  city: z.string().default(""),
  phone: z.string().default(""),
  whatsappPhone: z.string().default(""),
  email: z.string().default(""),
  website: z.string().default(""),
  socialLinks: z.string().default(""),
  hours: z
    .object({
      monday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" }),
      tuesday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" }),
      wednesday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" }),
      thursday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" }),
      friday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" }),
      saturday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" }),
      sunday: HoursEntrySchema.default({ closed: false, open: "", close: "", note: "" })
    })
    .default(createDefaultHours()),
  reservationSettings: z
    .object({
      acceptsReservations: z.boolean().nullable().default(null),
      methods: z.array(z.enum(RESERVATION_METHODS)).default([]),
      otherMethod: z.string().default(""),
      sameDay: z.boolean().nullable().default(null),
      maxGroupSize: z.string().default(""),
      largeGroupConfirmationRequired: z.boolean().nullable().default(null),
      policyNotes: z.string().default("")
    })
    .default({
      acceptsReservations: null,
      methods: [],
      otherMethod: "",
      sameDay: null,
      maxGroupSize: "",
      largeGroupConfirmationRequired: null,
      policyNotes: ""
    }),
  serviceFeatures: z
    .object({
      menuHighlights: z.string().default(""),
      vegetarian: z.boolean().nullable().default(null),
      vegan: z.boolean().nullable().default(null),
      glutenFree: z.boolean().nullable().default(null),
      takeaway: z.boolean().nullable().default(null),
      delivery: z.boolean().nullable().default(null),
      outdoorSeating: z.boolean().nullable().default(null),
      parking: z.boolean().nullable().default(null),
      kidsFriendly: z.boolean().nullable().default(null),
      cardPayments: z.boolean().nullable().default(null),
      cashPayments: z.boolean().nullable().default(null),
      specialOfferings: z.string().default(""),
      popularDishes: z.string().default(""),
      serviceNotes: z.string().default("")
    })
    .default({
      menuHighlights: "",
      vegetarian: null,
      vegan: null,
      glutenFree: null,
      takeaway: null,
      delivery: null,
      outdoorSeating: null,
      parking: null,
      kidsFriendly: null,
      cardPayments: null,
      cashPayments: null,
      specialOfferings: "",
      popularDishes: "",
      serviceNotes: ""
    }),
  atmosphere: z
    .object({
      description: z.string().default(""),
      bestFor: z.array(z.enum(ATMOSPHERE_BEST_FOR)).default([]),
      notes: z.string().default("")
    })
    .default({
      description: "",
      bestFor: [],
      notes: ""
    }),
  additionalInfoRaw: z.string().default(""),
  currentStep: z.number().int().min(0).max(RESTAURANT_ONBOARDING_STEP_COUNT - 1).default(0)
});

export type RestaurantOnboardingData = z.infer<typeof RestaurantOnboardingDataSchema>;

export type RestaurantOnboardingValidation = {
  fieldErrors: Record<string, string>;
  generalErrors: string[];
};

type OnboardingCopy = {
  pageTitle: string;
  pageDescription: string;
  industryStepTitle: string;
  industryStepDescription: string;
  restaurantLabel: string;
  restaurantDescription: string;
  languageStepTitle: string;
  languageStepDescription: string;
  basicsStepTitle: string;
  basicsStepDescription: string;
  hoursStepTitle: string;
  hoursStepDescription: string;
  reservationsStepTitle: string;
  reservationsStepDescription: string;
  serviceStepTitle: string;
  serviceStepDescription: string;
  atmosphereStepTitle: string;
  atmosphereStepDescription: string;
  additionalInfoStepTitle: string;
  additionalInfoStepDescription: string;
  reviewStepTitle: string;
  reviewStepDescription: string;
  saveAndContinue: string;
  back: string;
  finish: string;
  saveUpdates: string;
  stepLabel: string;
  draftSaved: string;
  completedTitle: string;
  completedDescription: string;
  knowledgePreviewTitle: string;
  knowledgePreviewDescription: string;
  documentsNote: string;
  editStep: string;
  required: string;
  optional: string;
  dayLabels: Record<RestaurantDayKey, string>;
  stepLabels: string[];
  selectLanguageLabel: string;
  languageOptions: Record<OnboardingLanguage, string>;
  fieldLabels: Record<string, string>;
  placeholders: Record<string, string>;
  hints: Record<string, string>;
  yes: string;
  no: string;
  closed: string;
  open: string;
  noneAdded: string;
  reviewSections: Record<string, string>;
};

const COPY: Record<OnboardingLanguage, OnboardingCopy> = {
  en: {
    pageTitle: "Restaurant onboarding",
    pageDescription:
      "Fill in the essentials once so your chatbot can answer hours, reservations, menu basics, and common customer questions from day one.",
    industryStepTitle: "Choose your industry",
    industryStepDescription: "Restaurant is the only supported onboarding pack for launch.",
    restaurantLabel: "Restaurant",
    restaurantDescription: "Collect the core business details customers ask about most often.",
    languageStepTitle: "Choose onboarding language",
    languageStepDescription: "This changes the onboarding copy, validation, and starter knowledge content.",
    basicsStepTitle: "Restaurant basics",
    basicsStepDescription: "Start with the identity and contact details your chatbot should know.",
    hoursStepTitle: "Opening hours",
    hoursStepDescription: "Add one simple row per day. Closed days are supported.",
    reservationsStepTitle: "Reservations",
    reservationsStepDescription: "Capture how reservations work so the chatbot sets the right expectations.",
    serviceStepTitle: "Menu and service basics",
    serviceStepDescription: "Add enough food and service detail to answer the most common questions.",
    atmosphereStepTitle: "Atmosphere and experience",
    atmosphereStepDescription: "Customers ask about the vibe too, not only the menu.",
    additionalInfoStepTitle: "Additional business information",
    additionalInfoStepDescription: "Paste anything helpful that does not fit neatly into the form.",
    reviewStepTitle: "Review and finish",
    reviewStepDescription: "Check the summary before we make the starter knowledge live.",
    saveAndContinue: "Save and continue",
    back: "Back",
    finish: "Finish onboarding",
    saveUpdates: "Save updates",
    stepLabel: "Step",
    draftSaved: "Draft saved",
    completedTitle: "Starter knowledge is live",
    completedDescription:
      "Your restaurant setup is saved and the chatbot can use this starter knowledge immediately, even without uploaded documents.",
    knowledgePreviewTitle: "Starter knowledge preview",
    knowledgePreviewDescription: "This is the knowledge document that will be available to the chatbot after you finish.",
    documentsNote: "You can still upload documents later. This onboarding supplements the document flow.",
    editStep: "Edit",
    required: "Required",
    optional: "Optional",
    dayLabels: {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday"
    },
    stepLabels: [
      "Industry",
      "Language",
      "Basics",
      "Hours",
      "Reservations",
      "Menu & Service",
      "Atmosphere",
      "Additional Info",
      "Review"
    ],
    selectLanguageLabel: "Onboarding language",
    languageOptions: {
      en: "English",
      sq: "Albanian"
    },
    fieldLabels: {
      restaurantName: "Restaurant name",
      shortDescription: "Short description",
      cuisineType: "Cuisine type",
      address: "Address",
      city: "City",
      phone: "Phone number",
      whatsappPhone: "WhatsApp number",
      email: "Email",
      website: "Website",
      socialLinks: "Instagram / Facebook / social links",
      openTime: "Open",
      closeTime: "Close",
      dayNote: "Note",
      acceptsReservations: "Do you accept reservations?",
      reservationMethods: "How can customers reserve?",
      reservationOtherMethod: "Other reservation method",
      sameDay: "Do you accept same-day reservations?",
      maxGroupSize: "Maximum group size for normal reservations",
      largeGroupConfirmationRequired: "Do large groups need special confirmation?",
      reservationPolicyNotes: "Reservation notes or policy",
      menuHighlights: "Menu highlights / signature dishes",
      vegetarian: "Vegetarian options",
      vegan: "Vegan options",
      glutenFree: "Gluten-free options",
      takeaway: "Takeaway",
      delivery: "Delivery",
      outdoorSeating: "Outdoor seating",
      parking: "Parking available",
      kidsFriendly: "Kids-friendly",
      cardPayments: "Card payments accepted",
      cashPayments: "Cash accepted",
      specialOfferings: "Special offerings",
      popularDishes: "Popular dishes",
      serviceNotes: "Important service notes",
      atmosphereDescription: "Atmosphere description",
      atmosphereBestFor: "Best for",
      atmosphereNotes: "Atmosphere notes",
      additionalInfoRaw: "Additional Business Information"
    },
    placeholders: {
      restaurantName: "MARCOS ITALIANO",
      shortDescription: "Warm neighborhood restaurant known for fresh pasta and wood-fired pizza.",
      cuisineType: "Italian",
      address: "Rr. Example 12",
      city: "Prishtinë",
      phone: "+383 44 123 456",
      whatsappPhone: "+383 44 123 456",
      email: "hello@restaurant.com",
      website: "https://restaurant.com",
      socialLinks: "Instagram URL, Facebook page, or @handle",
      dayNote: "Kitchen closes at 22:30",
      reservationOtherMethod: "Other method",
      reservationPolicyNotes: "Please arrive within 15 minutes of your reservation time.",
      menuHighlights: "Wood-fired pizza\nFresh pasta\nSeafood risotto",
      specialOfferings: "Weekend tasting menu, lunch combo, terrace specials",
      popularDishes: "Truffle pasta, grilled sea bass, tiramisu",
      serviceNotes: "Terrace seating depends on weather.",
      atmosphereDescription: "Cozy, casual, and family-friendly with a relaxed evening atmosphere.",
      atmosphereNotes: "Live music on weekends, terrace in summer, private events on request"
    },
    hints: {
      shortDescription: "Use one or two clear sentences the chatbot can reuse.",
      socialLinks: "Optional. Add any social profile links customers may ask for.",
      hours: "If a day is open, add both opening and closing times.",
      reservations:
        "If reservations are enabled, add at least one reservation method or a clear reservation note.",
      menuHighlights: "One item per line works best.",
      additionalInfoRaw:
        "Paste anything helpful here: menu items, reservation rules, copied Instagram info, special offers, policies, customer FAQs, or any notes about your business."
    },
    yes: "Yes",
    no: "No",
    closed: "Closed",
    open: "Open",
    noneAdded: "Not added yet.",
    reviewSections: {
      basics: "Restaurant Basics",
      hours: "Opening Hours",
      reservations: "Reservations",
      service: "Menu & Service Basics",
      atmosphere: "Atmosphere / Experience",
      additionalInfo: "Additional Business Information"
    }
  },
  sq: {
    pageTitle: "Konfigurimi i restorantit",
    pageDescription:
      "Plotëso informacionin kryesor vetëm një herë që chatbot-i të përgjigjet për orarin, rezervimet, bazat e menusë dhe pyetjet e zakonshme që nga dita e parë.",
    industryStepTitle: "Zgjidh industrinë",
    industryStepDescription: "Për launch, pakoja e vetme e udhëzuar është për restorante.",
    restaurantLabel: "Restorant",
    restaurantDescription: "Mbledh informacionin kryesor që klientët e pyesin më shpesh.",
    languageStepTitle: "Zgjidh gjuhën e onboarding-ut",
    languageStepDescription: "Kjo ndryshon tekstet e onboarding-ut, validimin dhe përmbajtjen fillestare të dijes.",
    basicsStepTitle: "Bazat e restorantit",
    basicsStepDescription: "Nis me identitetin dhe kontaktet që chatbot-i duhet t’i dijë.",
    hoursStepTitle: "Orari i punës",
    hoursStepDescription: "Shto nga një rresht për secilën ditë. Ditët e mbyllura mbështeten.",
    reservationsStepTitle: "Rezervimet",
    reservationsStepDescription: "Shkruaj si funksionojnë rezervimet që chatbot-i të japë pritshmëri të sakta.",
    serviceStepTitle: "Bazat e menusë dhe shërbimit",
    serviceStepDescription: "Shto aq informacion sa chatbot-i të përgjigjet për pyetjet më të zakonshme.",
    atmosphereStepTitle: "Atmosfera dhe eksperienca",
    atmosphereStepDescription: "Klientët pyesin edhe për ndjesinë e vendit, jo vetëm për menunë.",
    additionalInfoStepTitle: "Informata shtesë për biznesin",
    additionalInfoStepDescription: "Vendos çdo gjë që të ndihmon, edhe nëse nuk futet bukur në fushat e tjera.",
    reviewStepTitle: "Rishiko dhe përfundo",
    reviewStepDescription: "Kontrollo përmbledhjen para se ta bëjmë dijen fillestare live.",
    saveAndContinue: "Ruaj dhe vazhdo",
    back: "Kthehu",
    finish: "Përfundo onboarding-un",
    saveUpdates: "Ruaj ndryshimet",
    stepLabel: "Hapi",
    draftSaved: "Drafti u ruajt",
    completedTitle: "Dija fillestare është live",
    completedDescription:
      "Konfigurimi i restorantit u ruajt dhe chatbot-i mund ta përdorë menjëherë këtë informacion, edhe pa dokumente të ngarkuara.",
    knowledgePreviewTitle: "Parapamja e dijes fillestare",
    knowledgePreviewDescription: "Kjo është përmbajtja që chatbot-i do ta ketë menjëherë pas përfundimit.",
    documentsNote: "Më vonë mund të ngarkosh edhe dokumente. Ky onboarding e plotëson, nuk e zëvendëson atë rrjedhë.",
    editStep: "Ndrysho",
    required: "E detyrueshme",
    optional: "Opsionale",
    dayLabels: {
      monday: "E hënë",
      tuesday: "E martë",
      wednesday: "E mërkurë",
      thursday: "E enjte",
      friday: "E premte",
      saturday: "E shtunë",
      sunday: "E diel"
    },
    stepLabels: [
      "Industria",
      "Gjuha",
      "Bazat",
      "Orari",
      "Rezervimet",
      "Menuja & Shërbimi",
      "Atmosfera",
      "Info shtesë",
      "Rishikimi"
    ],
    selectLanguageLabel: "Gjuha e onboarding-ut",
    languageOptions: {
      en: "Anglisht",
      sq: "Shqip"
    },
    fieldLabels: {
      restaurantName: "Emri i restorantit",
      shortDescription: "Përshkrim i shkurtër",
      cuisineType: "Lloji i kuzhinës",
      address: "Adresa",
      city: "Qyteti",
      phone: "Numri i telefonit",
      whatsappPhone: "Numri i WhatsApp-it",
      email: "Email",
      website: "Faqja e internetit",
      socialLinks: "Instagram / Facebook / linke sociale",
      openTime: "Hapet",
      closeTime: "Mbyllet",
      dayNote: "Shënim",
      acceptsReservations: "A pranoni rezervime?",
      reservationMethods: "Si mund të bëjnë rezervim klientët?",
      reservationOtherMethod: "Mënyrë tjetër rezervimi",
      sameDay: "A pranoni rezervime për të njëjtën ditë?",
      maxGroupSize: "Numri maksimal i personave për rezervim normal",
      largeGroupConfirmationRequired: "A kërkojnë grupet e mëdha konfirmim të veçantë?",
      reservationPolicyNotes: "Shënime ose rregulla për rezervimet",
      menuHighlights: "Pikat kryesore të menusë / pjatat signature",
      vegetarian: "Opsione vegjetariane",
      vegan: "Opsione vegane",
      glutenFree: "Opsione pa gluten",
      takeaway: "Takeaway",
      delivery: "Dërgesë",
      outdoorSeating: "Ulëse jashtë",
      parking: "Parking në dispozicion",
      kidsFriendly: "I përshtatshëm për fëmijë",
      cardPayments: "Pranohen pagesa me kartelë",
      cashPayments: "Pranohet paraja cash",
      specialOfferings: "Oferta të veçanta",
      popularDishes: "Pjata të njohura",
      serviceNotes: "Shënime të rëndësishme për shërbimin",
      atmosphereDescription: "Përshkrimi i atmosferës",
      atmosphereBestFor: "Më i përshtatshëm për",
      atmosphereNotes: "Shënime për atmosferën",
      additionalInfoRaw: "Informata Shtesë për Biznesin"
    },
    placeholders: {
      restaurantName: "MARCOS ITALIANO",
      shortDescription: "Restorant i ngrohtë lagjeje i njohur për pasta të freskëta dhe pizza me furrë druri.",
      cuisineType: "Italiane",
      address: "Rr. Shembull 12",
      city: "Prishtinë",
      phone: "+383 44 123 456",
      whatsappPhone: "+383 44 123 456",
      email: "hello@restaurant.com",
      website: "https://restaurant.com",
      socialLinks: "Link i Instagram-it, faqe e Facebook-ut ose @handle",
      dayNote: "Kuzhina mbyllet në 22:30",
      reservationOtherMethod: "Mënyrë tjetër",
      reservationPolicyNotes: "Ju lutem ejani brenda 15 minutave nga koha e rezervimit.",
      menuHighlights: "Pizza me furrë druri\nPasta të freskëta\nRizoto me fruta deti",
      specialOfferings: "Menu degustimi në fundjavë, ofertë dreke, speciale në tarracë",
      popularDishes: "Pasta me tartuf, levrek në skarë, tiramisu",
      serviceNotes: "Ulëset në tarracë varen nga moti.",
      atmosphereDescription: "Ambient i ngrohtë, casual dhe familjar me atmosferë të qetë në mbrëmje.",
      atmosphereNotes: "Muzikë live në fundjavë, tarracë në verë, evente private me kërkesë"
    },
    hints: {
      shortDescription: "Përdor një ose dy fjali të qarta që chatbot-i mund t’i përdorë lehtë.",
      socialLinks: "Opsionale. Shto çdo profil social që klientët mund ta kërkojnë.",
      hours: "Nëse dita është e hapur, plotëso edhe orën e hapjes edhe të mbylljes.",
      reservations:
        "Nëse rezervimet janë aktive, zgjidh të paktën një mënyrë rezervimi ose shto një shënim të qartë.",
      menuHighlights: "Një pjatë për rresht funksionon më së miri.",
      additionalInfoRaw:
        "Vendos këtu çdo informacion që mund të ndihmojë chatbot-in: menu, rregulla për rezervime, informata nga Instagrami, oferta, pyetje të shpeshta ose shënime për biznesin."
    },
    yes: "Po",
    no: "Jo",
    closed: "Mbyllur",
    open: "Hapur",
    noneAdded: "Ende nuk është shtuar.",
    reviewSections: {
      basics: "Bazat e Restorantit",
      hours: "Orari i Punës",
      reservations: "Rezervimet",
      service: "Menuja & Shërbimi",
      atmosphere: "Atmosfera / Eksperienca",
      additionalInfo: "Informata Shtesë për Biznesin"
    }
  }
};

const trimText = (value: string) => value.trim();
const digitsOnly = (value: string) => value.replace(/[^\d]/g, "");

const cleanTextList = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const boolLabel = (value: boolean | null, language: OnboardingLanguage) => {
  const copy = COPY[language];
  if (value === true) return copy.yes;
  if (value === false) return copy.no;
  return "";
};

const joinList = (items: string[], language: OnboardingLanguage) => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) {
    return language === "sq" ? `${items[0]} dhe ${items[1]}` : `${items[0]} and ${items[1]}`;
  }
  const last = items[items.length - 1];
  const rest = items.slice(0, -1).join(", ");
  return language === "sq" ? `${rest} dhe ${last}` : `${rest}, and ${last}`;
};

export const getReservationMethodLabel = (method: ReservationMethod, language: OnboardingLanguage) => {
  const labels = {
    en: {
      phone: "phone",
      chatbot: "chatbot",
      walk_in: "walk-in",
      instagram_dm: "Instagram DM",
      whatsapp: "WhatsApp"
    },
    sq: {
      phone: "telefon",
      chatbot: "chatbot",
      walk_in: "në vend",
      instagram_dm: "Instagram DM",
      whatsapp: "WhatsApp"
    }
  } as const;
  return labels[language][method];
};

export const getAtmosphereBestForLabel = (value: AtmosphereBestFor, language: OnboardingLanguage) => {
  const labels = {
    en: {
      families: "families",
      couples: "couples",
      business_meetings: "business meetings",
      birthdays: "birthdays",
      groups: "groups",
      quick_meals: "quick meals"
    },
    sq: {
      families: "familje",
      couples: "çifte",
      business_meetings: "takime biznesi",
      birthdays: "ditëlindje",
      groups: "grupe",
      quick_meals: "vakte të shpejta"
    }
  } as const;
  return labels[language][value];
};

const buildRequiredMessage = (language: OnboardingLanguage, fieldLabel: string) =>
  language === "sq" ? `Plotëso fushën: ${fieldLabel}.` : `Please add ${fieldLabel}.`;

const buildInvalidPhoneMessage = (language: OnboardingLanguage) =>
  language === "sq" ? "Shto një numër telefoni të vlefshëm." : "Please enter a valid phone number.";

const buildHoursMessage = (language: OnboardingLanguage) =>
  language === "sq"
    ? "Shto të paktën një ditë të hapur me orën e hapjes dhe të mbylljes."
    : "Add at least one open day with both opening and closing times.";

const buildOpenDayMessage = (language: OnboardingLanguage, dayLabel: string) =>
  language === "sq"
    ? `Për ${dayLabel.toLowerCase()}, plotëso edhe orën e hapjes edhe të mbylljes ose shënoje si të mbyllur.`
    : `For ${dayLabel}, add both opening and closing times or mark the day as closed.`;

const buildReservationsMethodMessage = (language: OnboardingLanguage) =>
  language === "sq"
    ? "Zgjidh të paktën një mënyrë rezervimi ose shto një shënim të qartë për rezervimet."
    : "Choose at least one reservation method or add a clear reservation note.";

const buildMenuMessage = (language: OnboardingLanguage) =>
  language === "sq"
    ? "Shto të paktën disa pika kryesore të menusë ose informacion të ngjashëm për ushqimin/shërbimin."
    : "Add menu highlights or similar food/service information before finishing.";

const buildChoiceMessage = (language: OnboardingLanguage, fieldLabel: string) =>
  language === "sq" ? `Zgjidh një përgjigje për: ${fieldLabel}.` : `Please choose an option for ${fieldLabel}.`;

const normalizeNullableText = (value: string) => trimText(value);

export const getRestaurantOnboardingCopy = (language: OnboardingLanguage) => COPY[language];

export const createDefaultRestaurantOnboardingData = (): RestaurantOnboardingData =>
  RestaurantOnboardingDataSchema.parse({});

export const normalizeRestaurantOnboardingData = (
  input: unknown,
  fallbackBusinessName?: string | null
): RestaurantOnboardingData => {
  const parsed = RestaurantOnboardingDataSchema.safeParse(input);
  const data = parsed.success ? parsed.data : createDefaultRestaurantOnboardingData();
  const safeBusinessName = trimText(fallbackBusinessName ?? "");

  if (!trimText(data.restaurantName) && safeBusinessName && safeBusinessName !== "Your business") {
    data.restaurantName = safeBusinessName;
  }

  return sanitizeRestaurantOnboardingData(data);
};

export const sanitizeRestaurantOnboardingData = (input: RestaurantOnboardingData): RestaurantOnboardingData => {
  const data = RestaurantOnboardingDataSchema.parse(input);

  data.restaurantName = normalizeNullableText(data.restaurantName);
  data.shortDescription = normalizeNullableText(data.shortDescription);
  data.cuisineType = normalizeNullableText(data.cuisineType);
  data.address = normalizeNullableText(data.address);
  data.city = normalizeNullableText(data.city);
  data.phone = normalizeNullableText(data.phone);
  data.whatsappPhone = normalizeNullableText(data.whatsappPhone);
  data.email = normalizeNullableText(data.email);
  data.website = normalizeNullableText(data.website);
  data.socialLinks = normalizeNullableText(data.socialLinks);
  data.additionalInfoRaw = data.additionalInfoRaw.trim();

  RESTAURANT_DAY_KEYS.forEach((day) => {
    data.hours[day].open = normalizeNullableText(data.hours[day].open);
    data.hours[day].close = normalizeNullableText(data.hours[day].close);
    data.hours[day].note = normalizeNullableText(data.hours[day].note);
  });

  data.reservationSettings.otherMethod = normalizeNullableText(data.reservationSettings.otherMethod);
  data.reservationSettings.maxGroupSize = normalizeNullableText(data.reservationSettings.maxGroupSize);
  data.reservationSettings.policyNotes = normalizeNullableText(data.reservationSettings.policyNotes);

  data.serviceFeatures.menuHighlights = data.serviceFeatures.menuHighlights.trim();
  data.serviceFeatures.specialOfferings = data.serviceFeatures.specialOfferings.trim();
  data.serviceFeatures.popularDishes = data.serviceFeatures.popularDishes.trim();
  data.serviceFeatures.serviceNotes = data.serviceFeatures.serviceNotes.trim();

  data.atmosphere.description = normalizeNullableText(data.atmosphere.description);
  data.atmosphere.notes = normalizeNullableText(data.atmosphere.notes);

  return data;
};

const hasValidPhone = (value: string) => digitsOnly(value).length >= 7;
const hasAtLeastOneOpenDay = (data: RestaurantOnboardingData) =>
  RESTAURANT_DAY_KEYS.some((day) => !data.hours[day].closed && data.hours[day].open && data.hours[day].close);

const hasMenuInfo = (data: RestaurantOnboardingData) =>
  Boolean(
    trimText(data.serviceFeatures.menuHighlights) ||
      trimText(data.serviceFeatures.specialOfferings) ||
      trimText(data.serviceFeatures.popularDishes) ||
      trimText(data.serviceFeatures.serviceNotes)
  );

const validateBasicsStep = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const copy = COPY[language];
  const fieldErrors: Record<string, string> = {};

  if (!trimText(data.restaurantName)) {
    fieldErrors.restaurantName = buildRequiredMessage(language, copy.fieldLabels.restaurantName);
  }
  if (!trimText(data.shortDescription)) {
    fieldErrors.shortDescription = buildRequiredMessage(language, copy.fieldLabels.shortDescription);
  }
  if (!trimText(data.cuisineType)) {
    fieldErrors.cuisineType = buildRequiredMessage(language, copy.fieldLabels.cuisineType);
  }
  if (!trimText(data.address)) {
    fieldErrors.address = buildRequiredMessage(language, copy.fieldLabels.address);
  }
  if (!trimText(data.city)) {
    fieldErrors.city = buildRequiredMessage(language, copy.fieldLabels.city);
  }
  if (!trimText(data.phone)) {
    fieldErrors.phone = buildRequiredMessage(language, copy.fieldLabels.phone);
  } else if (!hasValidPhone(data.phone)) {
    fieldErrors.phone = buildInvalidPhoneMessage(language);
  }

  return fieldErrors;
};

const validateHoursStep = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const copy = COPY[language];
  const fieldErrors: Record<string, string> = {};

  if (!hasAtLeastOneOpenDay(data)) {
    fieldErrors.hours = buildHoursMessage(language);
  }

  RESTAURANT_DAY_KEYS.forEach((day) => {
    const entry = data.hours[day];
    if (!entry.closed && (!entry.open || !entry.close)) {
      fieldErrors[`hours.${day}`] = buildOpenDayMessage(language, copy.dayLabels[day]);
    }
  });

  return fieldErrors;
};

const validateReservationsStep = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const copy = COPY[language];
  const fieldErrors: Record<string, string> = {};

  if (data.reservationSettings.acceptsReservations === null) {
    fieldErrors.acceptsReservations = buildChoiceMessage(language, copy.fieldLabels.acceptsReservations);
  }

  if (data.reservationSettings.acceptsReservations) {
    const hasMethod =
      data.reservationSettings.methods.length > 0 ||
      Boolean(trimText(data.reservationSettings.otherMethod)) ||
      Boolean(trimText(data.reservationSettings.policyNotes));

    if (!hasMethod) {
      fieldErrors.reservationMethods = buildReservationsMethodMessage(language);
    }
  }

  return fieldErrors;
};

const validateServiceStep = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const copy = COPY[language];
  const fieldErrors: Record<string, string> = {};

  if (!hasMenuInfo(data)) {
    fieldErrors.menuHighlights = buildMenuMessage(language);
  }

  if (data.serviceFeatures.cardPayments === null) {
    fieldErrors.cardPayments = buildChoiceMessage(language, copy.fieldLabels.cardPayments);
  }

  if (data.serviceFeatures.cashPayments === null) {
    fieldErrors.cashPayments = buildChoiceMessage(language, copy.fieldLabels.cashPayments);
  }

  return fieldErrors;
};

export const validateRestaurantOnboardingStep = (
  input: RestaurantOnboardingData,
  stepIndex: number,
  languageOverride?: OnboardingLanguage
): RestaurantOnboardingValidation => {
  const data = sanitizeRestaurantOnboardingData(input);
  const language = languageOverride ?? data.language;
  let fieldErrors: Record<string, string> = {};

  if (stepIndex === 0 && data.industry !== "restaurant") {
    fieldErrors.industry = language === "sq" ? "Zgjidh restorant." : "Please choose Restaurant.";
  }

  if (stepIndex === 1 && !data.language) {
    fieldErrors.language = language === "sq" ? "Zgjidh gjuhën." : "Please choose a language.";
  }

  if (stepIndex === 2) {
    fieldErrors = validateBasicsStep(data, language);
  }

  if (stepIndex === 3) {
    fieldErrors = validateHoursStep(data, language);
  }

  if (stepIndex === 4) {
    fieldErrors = validateReservationsStep(data, language);
  }

  if (stepIndex === 5) {
    fieldErrors = validateServiceStep(data, language);
  }

  return {
    fieldErrors,
    generalErrors: Object.values(fieldErrors)
  };
};

export const validateRestaurantOnboardingCompletion = (
  input: RestaurantOnboardingData,
  languageOverride?: OnboardingLanguage
): RestaurantOnboardingValidation => {
  const data = sanitizeRestaurantOnboardingData(input);
  const language = languageOverride ?? data.language;
  const validations = [
    validateRestaurantOnboardingStep(data, 0, language),
    validateRestaurantOnboardingStep(data, 1, language),
    validateRestaurantOnboardingStep(data, 2, language),
    validateRestaurantOnboardingStep(data, 3, language),
    validateRestaurantOnboardingStep(data, 4, language),
    validateRestaurantOnboardingStep(data, 5, language)
  ];

  const fieldErrors = validations.reduce(
    (acc, validation) => ({
      ...acc,
      ...validation.fieldErrors
    }),
    {} as Record<string, string>
  );

  return {
    fieldErrors,
    generalErrors: Object.values(fieldErrors)
  };
};

const buildHoursLines = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const copy = COPY[language];
  return RESTAURANT_DAY_KEYS.map((day) => {
    const entry = data.hours[day];
    if (entry.closed) {
      return `${copy.dayLabels[day]}: ${copy.closed}`;
    }

    const base = entry.open && entry.close ? `${copy.dayLabels[day]}: ${entry.open} - ${entry.close}` : `${copy.dayLabels[day]}:`;
    return entry.note ? `${base} (${entry.note})` : base;
  }).join("\n");
};

const buildReservationsSection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const settings = data.reservationSettings;
  const methods: string[] = settings.methods.map((method) => getReservationMethodLabel(method, language));
  if (settings.otherMethod) methods.push(settings.otherMethod);

  if (!settings.acceptsReservations) {
    return language === "sq"
      ? "Restoranti aktualisht nuk pranon rezervime."
      : "The restaurant does not currently accept reservations.";
  }

  const lines: string[] = [];
  lines.push(
    language === "sq"
      ? "Rezervimet pranohen."
      : "Reservations are accepted."
  );

  if (methods.length) {
    lines.push(
      language === "sq"
        ? `Rezervimi mund të bëhet përmes ${joinList(methods, language)}.`
        : `Guests can reserve by ${joinList(methods, language)}.`
    );
  }

  if (settings.sameDay !== null) {
    lines.push(
      settings.sameDay
        ? language === "sq"
          ? "Rezervimet për të njëjtën ditë pranohen, varësisht nga disponueshmëria."
          : "Same-day reservations are accepted, subject to availability."
        : language === "sq"
          ? "Rezervimet për të njëjtën ditë nuk pranohen."
          : "Same-day reservations are not accepted."
    );
  }

  if (settings.maxGroupSize) {
    lines.push(
      language === "sq"
        ? `Rezervimet normale pranohen deri në ${settings.maxGroupSize} persona.`
        : `Standard reservations are accepted for up to ${settings.maxGroupSize} guests.`
    );
  }

  if (settings.largeGroupConfirmationRequired !== null) {
    lines.push(
      settings.largeGroupConfirmationRequired
        ? language === "sq"
          ? "Grupet e mëdha kërkojnë konfirmim të veçantë."
          : "Large groups require special confirmation."
        : language === "sq"
          ? "Grupet e mëdha nuk kërkojnë konfirmim të veçantë."
          : "Large groups do not require special confirmation."
    );
  }

  if (settings.policyNotes) {
    lines.push(settings.policyNotes);
  }

  return lines.join("\n");
};

const buildDietarySection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const items: string[] = [];
  const featureCopy =
    language === "sq"
      ? {
          vegetarian: ["Ka opsione vegjetariane.", "Nuk ka opsione vegjetariane të konfirmuara."],
          vegan: ["Ka opsione vegane.", "Nuk ka opsione vegane të konfirmuara."],
          glutenFree: ["Ka opsione pa gluten.", "Nuk ka opsione pa gluten të konfirmuara."]
        }
      : {
          vegetarian: ["Vegetarian options are available.", "Vegetarian options are not currently confirmed."],
          vegan: ["Vegan options are available.", "Vegan options are not currently confirmed."],
          glutenFree: ["Gluten-free options are available.", "Gluten-free options are not currently confirmed."]
        };

  if (data.serviceFeatures.vegetarian !== null) {
    items.push(featureCopy.vegetarian[data.serviceFeatures.vegetarian ? 0 : 1]);
  }
  if (data.serviceFeatures.vegan !== null) {
    items.push(featureCopy.vegan[data.serviceFeatures.vegan ? 0 : 1]);
  }
  if (data.serviceFeatures.glutenFree !== null) {
    items.push(featureCopy.glutenFree[data.serviceFeatures.glutenFree ? 0 : 1]);
  }

  return items.join("\n");
};

const buildServicesSection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const lines: string[] = [];
  const definitions = [
    {
      value: data.serviceFeatures.takeaway,
      yes: language === "sq" ? "Takeaway është në dispozicion." : "Takeaway is available.",
      no: language === "sq" ? "Takeaway nuk ofrohet." : "Takeaway is not available."
    },
    {
      value: data.serviceFeatures.delivery,
      yes: language === "sq" ? "Dërgesa është në dispozicion." : "Delivery is available.",
      no: language === "sq" ? "Dërgesa nuk ofrohet." : "Delivery is not available."
    },
    {
      value: data.serviceFeatures.outdoorSeating,
      yes: language === "sq" ? "Ka ulëse jashtë." : "Outdoor seating is available.",
      no: language === "sq" ? "Nuk ka ulëse jashtë." : "Outdoor seating is not available."
    },
    {
      value: data.serviceFeatures.parking,
      yes: language === "sq" ? "Ka parking." : "Parking is available.",
      no: language === "sq" ? "Parking is not available." : "Parking is not available."
    },
    {
      value: data.serviceFeatures.kidsFriendly,
      yes: language === "sq" ? "Restoranti është i përshtatshëm për fëmijë." : "The restaurant is family-friendly.",
      no: language === "sq" ? "Restoranti nuk është i fokusuar te familjet me fëmijë." : "The restaurant is not positioned as family-friendly."
    }
  ];

  definitions.forEach((definition) => {
    if (definition.value === null) return;
    lines.push(definition.value ? definition.yes : definition.no);
  });

  if (data.serviceFeatures.specialOfferings) lines.push(data.serviceFeatures.specialOfferings);
  if (data.serviceFeatures.popularDishes) {
    lines.push(
      language === "sq"
        ? `Pjata të njohura: ${data.serviceFeatures.popularDishes}`
        : `Popular dishes: ${data.serviceFeatures.popularDishes}`
    );
  }
  if (data.serviceFeatures.serviceNotes) lines.push(data.serviceFeatures.serviceNotes);

  return lines.join("\n");
};

const buildPaymentsSection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const methods: string[] = [];
  if (data.serviceFeatures.cardPayments) {
    methods.push(language === "sq" ? "kartelë" : "card");
  }
  if (data.serviceFeatures.cashPayments) {
    methods.push(language === "sq" ? "cash" : "cash");
  }

  if (!methods.length) {
    return language === "sq" ? "Metodat e pagesës nuk janë konfirmuar ende." : "Payment methods are not confirmed yet.";
  }

  return language === "sq"
    ? `Pranohen pagesa me ${joinList(methods, language)}.`
    : `${methods[0] === "card" && methods[1] === "cash" ? "Card and cash payments are accepted." : `Payments accepted: ${joinList(methods, language)}.`}`;
};

const buildAtmosphereSection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const lines: string[] = [];
  if (data.atmosphere.description) lines.push(data.atmosphere.description);
  if (data.atmosphere.bestFor.length) {
    const labels = data.atmosphere.bestFor.map((item) => getAtmosphereBestForLabel(item, language));
    lines.push(
      language === "sq"
        ? `I përshtatshëm për ${joinList(labels, language)}.`
        : `Best suited for ${joinList(labels, language)}.`
    );
  }
  if (data.atmosphere.notes) lines.push(data.atmosphere.notes);
  return lines.join("\n");
};

const buildContactSection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const lines: string[] = [];
  lines.push(`${language === "sq" ? "Telefon" : "Phone"}: ${data.phone}`);
  if (data.whatsappPhone) lines.push(`WhatsApp: ${data.whatsappPhone}`);
  if (data.email) lines.push(`Email: ${data.email}`);
  if (data.website) lines.push(`${language === "sq" ? "Website" : "Website"}: ${data.website}`);
  if (data.socialLinks) {
    lines.push(`${language === "sq" ? "Rrjete sociale" : "Social"}: ${data.socialLinks}`);
  }
  return lines.join("\n");
};

const buildMenuHighlightsSection = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const lines = cleanTextList(data.serviceFeatures.menuHighlights);
  if (!lines.length) {
    return language === "sq"
      ? "Pikat kryesore të menusë nuk janë shtuar ende."
      : "Menu highlights have not been added yet.";
  }

  return lines.map((item) => `- ${item}`).join("\n");
};

const buildStarterFaqBlock = (data: RestaurantOnboardingData, language: OnboardingLanguage) => {
  const questions: Array<{ question: string; answer: string }> = [];
  const sunday = data.hours.sunday;
  const reservationMethods: string[] = data.reservationSettings.methods.map((method) =>
    getReservationMethodLabel(method, language)
  );
  if (data.reservationSettings.otherMethod) reservationMethods.push(data.reservationSettings.otherMethod);

  questions.push({
    question: language === "sq" ? "Cili është orari i punës?" : "What are your opening hours?",
    answer: buildHoursLines(data, language)
  });

  questions.push({
    question: language === "sq" ? "A jeni hapur të dielën?" : "Are you open on Sunday?",
    answer: sunday.closed
      ? language === "sq"
        ? "Jo, të dielën restoranti është i mbyllur."
        : "No, the restaurant is closed on Sunday."
      : language === "sq"
        ? `Po, të dielën restoranti punon nga ${sunday.open} deri në ${sunday.close}${sunday.note ? ` (${sunday.note})` : ""}.`
        : `Yes, on Sunday the restaurant is open from ${sunday.open} to ${sunday.close}${sunday.note ? ` (${sunday.note})` : ""}.`
  });

  questions.push({
    question: language === "sq" ? "A pranoni rezervime?" : "Do you take reservations?",
    answer: data.reservationSettings.acceptsReservations
      ? language === "sq"
        ? "Po, rezervimet pranohen."
        : "Yes, reservations are accepted."
      : language === "sq"
        ? "Jo, restoranti aktualisht nuk pranon rezervime."
        : "No, the restaurant does not currently take reservations."
  });

  if (data.reservationSettings.acceptsReservations) {
    questions.push({
      question: language === "sq" ? "Si mund të rezervoj një tavolinë?" : "How can I reserve a table?",
      answer: reservationMethods.length
        ? language === "sq"
          ? `Rezervimi mund të bëhet përmes ${joinList(reservationMethods, language)}.`
          : `You can reserve by ${joinList(reservationMethods, language)}.`
        : language === "sq"
          ? data.reservationSettings.policyNotes || "Na kontaktoni për detajet e rezervimit."
          : data.reservationSettings.policyNotes || "Please contact the restaurant for reservation details."
    });
  }

  if (data.serviceFeatures.vegetarian !== null) {
    questions.push({
      question: language === "sq" ? "A keni ushqim vegjetarian?" : "Do you have vegetarian food?",
      answer: data.serviceFeatures.vegetarian
        ? language === "sq"
          ? "Po, ka opsione vegjetariane."
          : "Yes, vegetarian options are available."
        : language === "sq"
          ? "Aktualisht nuk janë konfirmuar opsione vegjetariane."
          : "Vegetarian options are not currently confirmed."
    });
  }

  if (data.serviceFeatures.takeaway !== null) {
    questions.push({
      question: language === "sq" ? "A ofroni takeaway?" : "Do you offer takeaway?",
      answer: data.serviceFeatures.takeaway
        ? language === "sq"
          ? "Po, takeaway është në dispozicion."
          : "Yes, takeaway is available."
        : language === "sq"
          ? "Jo, takeaway nuk ofrohet."
          : "No, takeaway is not available."
    });
  }

  if (data.serviceFeatures.parking !== null) {
    questions.push({
      question: language === "sq" ? "A keni parking?" : "Do you have parking?",
      answer: data.serviceFeatures.parking
        ? language === "sq"
          ? "Po, parkingu është në dispozicion."
          : "Yes, parking is available."
        : language === "sq"
          ? "Jo, parkingu nuk është në dispozicion."
          : "No, parking is not available."
    });
  }

  questions.push({
    question: language === "sq" ? "Çfarë lloj ushqimi shërbeni?" : "What kind of food do you serve?",
    answer:
      language === "sq"
        ? `${data.restaurantName} shërben kuzhinë ${data.cuisineType}. ${data.shortDescription}`
        : `${data.restaurantName} serves ${data.cuisineType} cuisine. ${data.shortDescription}`
  });

  if (data.serviceFeatures.kidsFriendly !== null) {
    questions.push({
      question: language === "sq" ? "A është restoranti i përshtatshëm për familje?" : "Is the restaurant family friendly?",
      answer: data.serviceFeatures.kidsFriendly
        ? language === "sq"
          ? "Po, restoranti është i përshtatshëm për familje."
          : "Yes, the restaurant is family-friendly."
        : language === "sq"
          ? "Restoranti nuk është i fokusuar veçanërisht te familjet me fëmijë."
          : "The restaurant is not specifically positioned as family-friendly."
    });
  }

  if (data.reservationSettings.acceptsReservations) {
    questions.push({
      question: language === "sq" ? "A mund të rezervoj për grup të madh?" : "Can I book for a large group?",
      answer: buildReservationsSection(data, language)
    });
  }

  questions.push({
    question: language === "sq" ? "A pranoni pagesa me kartelë?" : "Do you accept card payments?",
    answer:
      data.serviceFeatures.cardPayments === true
        ? language === "sq"
          ? "Po, pranohen pagesa me kartelë."
          : "Yes, card payments are accepted."
        : data.serviceFeatures.cardPayments === false
          ? language === "sq"
            ? "Jo, pagesat me kartelë nuk janë konfirmuar si të pranueshme."
            : "Card payments are not currently confirmed."
          : language === "sq"
            ? "Metodat e pagesës nuk janë konfirmuar ende."
            : "Payment methods are not confirmed yet."
  });

  questions.push({
    question: language === "sq" ? "Ku ndodheni?" : "Where are you located?",
    answer: language === "sq" ? `${data.address}, ${data.city}` : `${data.address}, ${data.city}`
  });

  questions.push({
    question: language === "sq" ? "Cili është numri juaj i telefonit?" : "What is your phone number?",
    answer: data.phone
  });

  return questions
    .filter((item) => trimText(item.question) && trimText(item.answer))
    .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
    .join("\n\n");
};

export const generateRestaurantStarterKnowledge = (input: RestaurantOnboardingData) => {
  const data = sanitizeRestaurantOnboardingData(input);
  const language = data.language;
  const sections: Array<[string, string]> = language === "sq"
    ? [
        ["Emri i Restorantit", data.restaurantName],
        ["Rreth Nesh", data.shortDescription],
        ["Kuzhina", data.cuisineType],
        ["Adresa", `${data.address}${data.city ? `, ${data.city}` : ""}`],
        ["Kontaktet", buildContactSection(data, language)],
        ["Orari i Punës", buildHoursLines(data, language)],
        ["Rezervimet", buildReservationsSection(data, language)],
        ["Pjatat Kryesore", buildMenuHighlightsSection(data, language)],
        ["Opsionet Ushqimore", buildDietarySection(data, language)],
        ["Shërbimet", buildServicesSection(data, language)],
        ["Atmosfera", buildAtmosphereSection(data, language)],
        ["Metodat e Pagesës", buildPaymentsSection(data, language)],
        ["Informata Shtesë", data.additionalInfoRaw],
        ["Pyetje të Shpeshta Fillestare", buildStarterFaqBlock(data, language)]
      ]
    : [
        ["Restaurant Name", data.restaurantName],
        ["About", data.shortDescription],
        ["Cuisine", data.cuisineType],
        ["Address / City", `${data.address}${data.city ? `, ${data.city}` : ""}`],
        ["Contact Information", buildContactSection(data, language)],
        ["Opening Hours", buildHoursLines(data, language)],
        ["Reservations", buildReservationsSection(data, language)],
        ["Menu Highlights", buildMenuHighlightsSection(data, language)],
        ["Dietary Options", buildDietarySection(data, language)],
        ["Services", buildServicesSection(data, language)],
        ["Atmosphere", buildAtmosphereSection(data, language)],
        ["Payment Methods", buildPaymentsSection(data, language)],
        ["Additional Business Information", data.additionalInfoRaw],
        ["Starter FAQ", buildStarterFaqBlock(data, language)]
      ];

  const content = sections
    .map(([title, body]) => [title.trim(), body.trim()].filter(Boolean).join(":\n"))
    .filter((section) => section.trim().length > 0)
    .join("\n\n");

  return content.length > STARTER_KNOWLEDGE_MAX_CHARS ? `${content.slice(0, STARTER_KNOWLEDGE_MAX_CHARS).trim()}\n…` : content;
};

export const buildRestaurantReviewLines = (input: RestaurantOnboardingData) => {
  const data = sanitizeRestaurantOnboardingData(input);
  const copy = COPY[data.language];
  const socialLinks = cleanTextList(data.socialLinks);
  const menuHighlights = cleanTextList(data.serviceFeatures.menuHighlights);

  return {
    basics: [
      `${copy.fieldLabels.restaurantName}: ${data.restaurantName || copy.noneAdded}`,
      `${copy.fieldLabels.shortDescription}: ${data.shortDescription || copy.noneAdded}`,
      `${copy.fieldLabels.cuisineType}: ${data.cuisineType || copy.noneAdded}`,
      `${copy.fieldLabels.address}: ${data.address || copy.noneAdded}`,
      `${copy.fieldLabels.city}: ${data.city || copy.noneAdded}`,
      `${copy.fieldLabels.phone}: ${data.phone || copy.noneAdded}`,
      `${copy.fieldLabels.whatsappPhone}: ${data.whatsappPhone || copy.noneAdded}`,
      `${copy.fieldLabels.email}: ${data.email || copy.noneAdded}`,
      `${copy.fieldLabels.website}: ${data.website || copy.noneAdded}`,
      `${copy.fieldLabels.socialLinks}: ${socialLinks.length ? socialLinks.join(", ") : copy.noneAdded}`
    ],
    hours: RESTAURANT_DAY_KEYS.map((day) => {
      const entry = data.hours[day];
      if (entry.closed) return `${copy.dayLabels[day]}: ${copy.closed}`;
      const range = entry.open && entry.close ? `${entry.open} - ${entry.close}` : copy.noneAdded;
      return entry.note ? `${copy.dayLabels[day]}: ${range} (${entry.note})` : `${copy.dayLabels[day]}: ${range}`;
    }),
    reservations: [
      `${copy.fieldLabels.acceptsReservations}: ${boolLabel(data.reservationSettings.acceptsReservations, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.reservationMethods}: ${
        data.reservationSettings.methods.length || data.reservationSettings.otherMethod
          ? [
              ...data.reservationSettings.methods.map((method) => getReservationMethodLabel(method, data.language)),
              data.reservationSettings.otherMethod
            ]
              .filter(Boolean)
              .join(", ")
          : copy.noneAdded
      }`,
      `${copy.fieldLabels.sameDay}: ${boolLabel(data.reservationSettings.sameDay, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.maxGroupSize}: ${data.reservationSettings.maxGroupSize || copy.noneAdded}`,
      `${copy.fieldLabels.largeGroupConfirmationRequired}: ${
        boolLabel(data.reservationSettings.largeGroupConfirmationRequired, data.language) || copy.noneAdded
      }`,
      `${copy.fieldLabels.reservationPolicyNotes}: ${data.reservationSettings.policyNotes || copy.noneAdded}`
    ],
    service: [
      `${copy.fieldLabels.menuHighlights}: ${menuHighlights.length ? menuHighlights.join(", ") : copy.noneAdded}`,
      `${copy.fieldLabels.vegetarian}: ${boolLabel(data.serviceFeatures.vegetarian, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.vegan}: ${boolLabel(data.serviceFeatures.vegan, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.glutenFree}: ${boolLabel(data.serviceFeatures.glutenFree, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.takeaway}: ${boolLabel(data.serviceFeatures.takeaway, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.delivery}: ${boolLabel(data.serviceFeatures.delivery, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.outdoorSeating}: ${boolLabel(data.serviceFeatures.outdoorSeating, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.parking}: ${boolLabel(data.serviceFeatures.parking, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.kidsFriendly}: ${boolLabel(data.serviceFeatures.kidsFriendly, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.cardPayments}: ${boolLabel(data.serviceFeatures.cardPayments, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.cashPayments}: ${boolLabel(data.serviceFeatures.cashPayments, data.language) || copy.noneAdded}`,
      `${copy.fieldLabels.specialOfferings}: ${data.serviceFeatures.specialOfferings || copy.noneAdded}`,
      `${copy.fieldLabels.popularDishes}: ${data.serviceFeatures.popularDishes || copy.noneAdded}`,
      `${copy.fieldLabels.serviceNotes}: ${data.serviceFeatures.serviceNotes || copy.noneAdded}`
    ],
    atmosphere: [
      `${copy.fieldLabels.atmosphereDescription}: ${data.atmosphere.description || copy.noneAdded}`,
      `${copy.fieldLabels.atmosphereBestFor}: ${
        data.atmosphere.bestFor.length
          ? data.atmosphere.bestFor.map((item) => getAtmosphereBestForLabel(item, data.language)).join(", ")
          : copy.noneAdded
      }`,
      `${copy.fieldLabels.atmosphereNotes}: ${data.atmosphere.notes || copy.noneAdded}`
    ],
    additionalInfo: [data.additionalInfoRaw || copy.noneAdded]
  };
};
