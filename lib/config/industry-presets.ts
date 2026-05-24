// lib/config/industry-presets.ts
// Single source of truth for multi-industry bot configuration.
// All components, API routes, and prompt builders import from here.

export const BOT_BUSINESS_TYPES = [
  "restaurant",
  "dental_clinic",
  "barber_shop",
  "beauty_salon",
  "car_dealership",
  "real_estate_agency",
  "hotel",
  "gym",
  "law_office",
  "other",
] as const;

export type BotBusinessType = (typeof BOT_BUSINESS_TYPES)[number];

export const ACTION_TYPES = [
  "none",
  "restaurant_reservation",
  "appointment",
  "test_drive",
  "property_tour",
  "room_inquiry",
  "consultation",
  "custom",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export type QuickButton = {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  enabled: boolean;
  order: number;
};

export type BotConfig = {
  businessType: BotBusinessType;
  actionType: ActionType;
  bookingsEnabled: boolean;
  quickButtons: QuickButton[];
};

type IndustryPreset = {
  businessType: BotBusinessType;
  label: string;
  description: string;
  defaultActionType: ActionType;
  defaultBookingsEnabled: boolean;
  defaultQuickButtons: QuickButton[];
  /** Short context sentence injected into the AI system prompt */
  assistantContext: string;
  /** Human-readable label for the action (e.g. "Reservation", "Appointment") */
  actionLabel: string;
  /** Fields to collect when customer initiates the action */
  collectFields: string[];
};

export const INDUSTRY_PRESETS: Record<BotBusinessType, IndustryPreset> = {
  restaurant: {
    businessType: "restaurant",
    label: "Restaurant",
    description: "Dine-in, takeout, or delivery restaurant",
    defaultActionType: "restaurant_reservation",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "menu", label: "Menu", prompt: "What's on the menu?", icon: "utensils", enabled: true, order: 0 },
      { id: "hours", label: "Hours", prompt: "What are your opening hours?", icon: "clock", enabled: true, order: 1 },
      { id: "reserve", label: "Reserve", prompt: "I'd like to make a reservation", icon: "calendar", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a restaurant. Help customers with menu, prices, opening hours, location, and reservations.",
    actionLabel: "Reservation",
    collectFields: ["name", "date", "time", "party_size", "phone"],
  },

  dental_clinic: {
    businessType: "dental_clinic",
    label: "Dental Clinic",
    description: "Dental care, treatments, and check-ups",
    defaultActionType: "appointment",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "services", label: "Services", prompt: "What dental services do you offer?", icon: "stethoscope", enabled: true, order: 0 },
      { id: "prices", label: "Prices", prompt: "What are your prices?", icon: "tag", enabled: true, order: 1 },
      { id: "book", label: "Book Appointment", prompt: "I'd like to book a dental appointment", icon: "calendar", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a dental clinic. Help patients ask about services, prices, hours, and appointments. Do not provide medical diagnoses.",
    actionLabel: "Appointment",
    collectFields: ["name", "phone", "preferred_date", "preferred_time", "reason"],
  },

  barber_shop: {
    businessType: "barber_shop",
    label: "Barber Shop",
    description: "Haircuts, grooming, and styling",
    defaultActionType: "appointment",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "services", label: "Services", prompt: "What services do you offer?", icon: "scissors", enabled: true, order: 0 },
      { id: "prices", label: "Prices", prompt: "What are your prices?", icon: "tag", enabled: true, order: 1 },
      { id: "book", label: "Book Appointment", prompt: "I'd like to book an appointment", icon: "calendar", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a barber shop. Help customers ask about services, pricing, availability, and appointments.",
    actionLabel: "Appointment",
    collectFields: ["name", "phone", "preferred_date", "preferred_time", "service"],
  },

  beauty_salon: {
    businessType: "beauty_salon",
    label: "Beauty Salon",
    description: "Hair, nails, skincare, and beauty treatments",
    defaultActionType: "appointment",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "services", label: "Services", prompt: "What beauty services do you offer?", icon: "sparkles", enabled: true, order: 0 },
      { id: "prices", label: "Prices", prompt: "What are your prices?", icon: "tag", enabled: true, order: 1 },
      { id: "book", label: "Book Appointment", prompt: "I'd like to book an appointment", icon: "calendar", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a beauty salon. Help customers ask about services, pricing, availability, and appointments.",
    actionLabel: "Appointment",
    collectFields: ["name", "phone", "preferred_date", "preferred_time", "service"],
  },

  car_dealership: {
    businessType: "car_dealership",
    label: "Car Dealership",
    description: "New and used vehicle sales and services",
    defaultActionType: "test_drive",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "cars", label: "Available Cars", prompt: "What cars do you have available?", icon: "car", enabled: true, order: 0 },
      { id: "financing", label: "Financing", prompt: "What financing options do you offer?", icon: "euro", enabled: true, order: 1 },
      { id: "test_drive", label: "Test Drive", prompt: "I'd like to book a test drive", icon: "calendar", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a car dealership. Help customers ask about available vehicles, pricing, financing, and test drives.",
    actionLabel: "Test Drive",
    collectFields: ["name", "phone", "preferred_vehicle", "preferred_date", "preferred_time"],
  },

  real_estate_agency: {
    businessType: "real_estate_agency",
    label: "Real Estate Agency",
    description: "Property sales, rentals, and tours",
    defaultActionType: "property_tour",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "properties", label: "Properties", prompt: "What properties do you have available?", icon: "home", enabled: true, order: 0 },
      { id: "tour", label: "Book Tour", prompt: "I'd like to book a property tour", icon: "map-pin", enabled: true, order: 1 },
      { id: "contact", label: "Contact Agent", prompt: "How can I contact an agent?", icon: "phone", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a real estate agency. Help clients ask about available properties, prices, and property viewings.",
    actionLabel: "Property Tour",
    collectFields: ["name", "phone", "property_of_interest", "preferred_date", "preferred_time"],
  },

  hotel: {
    businessType: "hotel",
    label: "Hotel",
    description: "Accommodation, rooms, and amenities",
    defaultActionType: "room_inquiry",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "rooms", label: "Rooms", prompt: "What rooms do you have available?", icon: "bed", enabled: true, order: 0 },
      { id: "prices", label: "Prices", prompt: "What are your room rates?", icon: "tag", enabled: true, order: 1 },
      { id: "amenities", label: "Amenities", prompt: "What amenities do you offer?", icon: "sparkles", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a hotel. Help guests ask about room availability, pricing, amenities, check-in/out times, and policies.",
    actionLabel: "Room Inquiry",
    collectFields: ["name", "phone", "check_in_date", "check_out_date", "guests", "room_preference"],
  },

  gym: {
    businessType: "gym",
    label: "Gym",
    description: "Fitness, training, and wellness",
    defaultActionType: "consultation",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "memberships", label: "Memberships", prompt: "What membership plans do you offer?", icon: "dumbbell", enabled: true, order: 0 },
      { id: "classes", label: "Classes", prompt: "What classes are available?", icon: "dumbbell", enabled: true, order: 1 },
      { id: "visit", label: "Book Visit", prompt: "I'd like to book a visit or trial session", icon: "calendar", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a gym. Help members and prospects ask about memberships, classes, personal training, and facilities.",
    actionLabel: "Consultation",
    collectFields: ["name", "phone", "preferred_date", "preferred_time", "goal"],
  },

  law_office: {
    businessType: "law_office",
    label: "Law Office",
    description: "Legal services, consultations, and representation",
    defaultActionType: "consultation",
    defaultBookingsEnabled: true,
    defaultQuickButtons: [
      { id: "services", label: "Services", prompt: "What legal services do you offer?", icon: "building", enabled: true, order: 0 },
      { id: "consultation", label: "Consultation", prompt: "I'd like to schedule a legal consultation", icon: "message-circle", enabled: true, order: 1 },
      { id: "contact", label: "Contact", prompt: "How can I contact a lawyer?", icon: "phone", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for a law office. Help clients ask about legal services and schedule consultations. Do not provide specific legal advice.",
    actionLabel: "Consultation",
    collectFields: ["name", "phone", "preferred_date", "preferred_time", "topic"],
  },

  other: {
    businessType: "other",
    label: "Other",
    description: "Custom business type",
    defaultActionType: "none",
    defaultBookingsEnabled: false,
    defaultQuickButtons: [
      { id: "prices", label: "Prices", prompt: "What are your prices?", icon: "tag", enabled: true, order: 0 },
      { id: "hours", label: "Hours", prompt: "What are your opening hours?", icon: "clock", enabled: true, order: 1 },
      { id: "contact", label: "Contact", prompt: "How can I contact you?", icon: "phone", enabled: true, order: 2 },
    ],
    assistantContext:
      "You are the AI assistant for this business. Help visitors ask questions, find information, and get in touch.",
    actionLabel: "Request",
    collectFields: ["name", "phone"],
  },
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  none: "No bookings",
  restaurant_reservation: "Restaurant Reservation",
  appointment: "Appointment",
  test_drive: "Test Drive",
  property_tour: "Property Tour",
  room_inquiry: "Room Inquiry",
  consultation: "Consultation",
  custom: "Custom",
};

export type ActionTypeMeta = {
  navLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  addButtonLabel: string;
  emptyStateTitle: string;
  emptyStateSub: string;
  showPartySize: boolean;
};

export const ACTION_TYPE_META: Record<ActionType, ActionTypeMeta> = {
  none: {
    navLabel: "Requests",
    pageTitle: "Customer requests",
    pageSubtitle: "Requests collected by your chatbot appear here.",
    addButtonLabel: "Add Request",
    emptyStateTitle: "No requests yet.",
    emptyStateSub: "Customer requests submitted through the chatbot will appear here.",
    showPartySize: false,
  },
  restaurant_reservation: {
    navLabel: "Reservations",
    pageTitle: "Reservation operations",
    pageSubtitle: "Keep website, WhatsApp, and offline reservations in one calm control center.",
    addButtonLabel: "Add Reservation",
    emptyStateTitle: "No pending reservations right now.",
    emptyStateSub: "Phone calls, walk-ins, and message bookings can all be added here in seconds.",
    showPartySize: true,
  },
  appointment: {
    navLabel: "Appointments",
    pageTitle: "Appointment requests",
    pageSubtitle: "All appointment requests collected by your chatbot.",
    addButtonLabel: "Add Appointment",
    emptyStateTitle: "No pending appointments.",
    emptyStateSub: "Appointment requests submitted through the chatbot will appear here.",
    showPartySize: false,
  },
  test_drive: {
    navLabel: "Test Drives",
    pageTitle: "Test drive requests",
    pageSubtitle: "All test drive requests collected by your chatbot.",
    addButtonLabel: "Add Test Drive",
    emptyStateTitle: "No test drive requests yet.",
    emptyStateSub: "Test drive requests submitted through the chatbot will appear here.",
    showPartySize: false,
  },
  property_tour: {
    navLabel: "Property Tours",
    pageTitle: "Property tour requests",
    pageSubtitle: "All property tour requests collected by your chatbot.",
    addButtonLabel: "Add Tour Request",
    emptyStateTitle: "No property tour requests yet.",
    emptyStateSub: "Property tour requests submitted through the chatbot will appear here.",
    showPartySize: false,
  },
  room_inquiry: {
    navLabel: "Room Inquiries",
    pageTitle: "Room inquiry requests",
    pageSubtitle: "All room inquiries collected by your chatbot.",
    addButtonLabel: "Add Room Inquiry",
    emptyStateTitle: "No room inquiries yet.",
    emptyStateSub: "Room inquiry requests submitted through the chatbot will appear here.",
    showPartySize: true,
  },
  consultation: {
    navLabel: "Consultations",
    pageTitle: "Consultation requests",
    pageSubtitle: "All consultation requests collected by your chatbot.",
    addButtonLabel: "Add Consultation",
    emptyStateTitle: "No consultation requests yet.",
    emptyStateSub: "Consultation requests submitted through the chatbot will appear here.",
    showPartySize: false,
  },
  custom: {
    navLabel: "Requests",
    pageTitle: "Customer requests",
    pageSubtitle: "All requests collected by your chatbot.",
    addButtonLabel: "Add Request",
    emptyStateTitle: "No requests yet.",
    emptyStateSub: "Requests submitted through the chatbot will appear here.",
    showPartySize: false,
  },
};

/** Returns a safe BotBusinessType or undefined if the value is not recognized */
export function normalizeBotBusinessType(value: unknown): BotBusinessType | undefined {
  if (typeof value !== "string") return undefined;
  return BOT_BUSINESS_TYPES.includes(value as BotBusinessType) ? (value as BotBusinessType) : undefined;
}

/** Returns a safe ActionType or undefined */
export function normalizeActionType(value: unknown): ActionType | undefined {
  if (typeof value !== "string") return undefined;
  return ACTION_TYPES.includes(value as ActionType) ? (value as ActionType) : undefined;
}

/** Returns the default BotConfig for a business type, with stable IDs */
export function getDefaultBotConfig(businessType: BotBusinessType = "restaurant"): BotConfig {
  const preset = INDUSTRY_PRESETS[businessType] ?? INDUSTRY_PRESETS.restaurant;
  return {
    businessType,
    actionType: preset.defaultActionType,
    bookingsEnabled: preset.defaultBookingsEnabled,
    quickButtons: preset.defaultQuickButtons.map((btn) => ({ ...btn })),
  };
}

/**
 * Returns the BotConfig for a business, falling back to restaurant defaults for
 * any missing field. Safe to call with null/undefined.
 */
export function resolveBotConfig(stored: unknown): BotConfig {
  const fallback = getDefaultBotConfig("restaurant");

  if (!stored || typeof stored !== "object") return fallback;
  const raw = stored as Record<string, unknown>;

  const businessType = normalizeBotBusinessType(raw.businessType) ?? fallback.businessType;
  const preset = INDUSTRY_PRESETS[businessType];

  const actionType = normalizeActionType(raw.actionType) ?? preset.defaultActionType;
  const bookingsEnabled = typeof raw.bookingsEnabled === "boolean" ? raw.bookingsEnabled : preset.defaultBookingsEnabled;

  let quickButtons: QuickButton[] = preset.defaultQuickButtons.map((btn) => ({ ...btn }));
  if (Array.isArray(raw.quickButtons) && raw.quickButtons.length > 0) {
    const parsed = raw.quickButtons
      .filter((btn): btn is Record<string, unknown> => Boolean(btn) && typeof btn === "object")
      .map((btn, idx): QuickButton => ({
        id: typeof btn.id === "string" && btn.id.trim() ? btn.id.trim() : `btn-${idx}`,
        label: typeof btn.label === "string" ? btn.label.slice(0, 24) : "",
        prompt: typeof btn.prompt === "string" ? btn.prompt.slice(0, 160) : "",
        icon: typeof btn.icon === "string" && btn.icon.trim() ? btn.icon.trim() : undefined,
        enabled: typeof btn.enabled === "boolean" ? btn.enabled : true,
        order: typeof btn.order === "number" ? btn.order : idx,
      }))
      .filter((btn) => btn.label.trim().length > 0 && btn.prompt.trim().length > 0);

    if (parsed.length > 0) {
      quickButtons = parsed;
    }
  }

  return { businessType, actionType, bookingsEnabled, quickButtons };
}
