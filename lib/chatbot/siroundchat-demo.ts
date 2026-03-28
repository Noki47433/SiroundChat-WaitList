export const SIROUNDCHAT_DEMO_WIDGET_KEY = "7ab3238d-0f3d-432a-bf25-543e96247f33";
export const SIROUNDCHAT_DEMO_BUSINESS_NAME = "SiroundChat";
export const SIROUNDCHAT_DEMO_GREETING =
  "I'm SiroundChat - I show you how your business can automatically answer customers, capture leads, and take reservations. Ask me anything 👇";

export const SIROUNDCHAT_DEMO_FAQS = [
  {
    id: "siroundchat-demo-1",
    question: "What does SiroundChat do?",
    answer: "SiroundChat helps businesses answer customer questions instantly, capture leads, and automate reservations or bookings."
  },
  {
    id: "siroundchat-demo-2",
    question: "Can SiroundChat answer opening-hours questions automatically?",
    answer: "Yes. You add your business hours once, and SiroundChat answers those questions automatically for customers."
  },
  {
    id: "siroundchat-demo-3",
    question: "Can SiroundChat answer pricing or menu questions?",
    answer: "Yes. It can use your menu, service list, or pricing data to answer those questions clearly and instantly."
  },
  {
    id: "siroundchat-demo-4",
    question: "Can SiroundChat take reservations?",
    answer: "Yes. SiroundChat can automate reservations and bookings for businesses that need them."
  }
];

type DemoLocale = "en" | "sq";

const normalize = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (value: string, phrases: string[]) => phrases.some((phrase) => value.includes(phrase));

export function isSiroundChatDemoBot({
  widgetKey,
  businessName
}: {
  widgetKey?: string | null;
  businessName?: string | null;
}) {
  const normalizedName = normalize(businessName);
  return (
    widgetKey === SIROUNDCHAT_DEMO_WIDGET_KEY ||
    normalizedName === "siroundchat" ||
    normalizedName === "siroundchat demo" ||
    normalizedName.includes("siroundchat")
  );
}

export function buildSiroundChatDemoSystemPrompt() {
  return `
You are SiroundChat, the product demo assistant for the SiroundChat platform.
You represent the SiroundChat product itself.
You are demonstrating what SiroundChat can do for a business.
You are NOT a restaurant, cafe, clinic, hotel, salon, gym, taxi company, ecommerce store, or any other client business.

PRIORITY RULES:
- Never pretend SiroundChat itself has opening hours, tables, rooms, menus, appointments, delivery areas, or business policies.
- Treat questions like "What are your opening hours?", "What are your prices?", "Can I make a reservation?", "Do you deliver?", and "What's on the menu?" as capability-test questions.
- For capability-test questions, explain that SiroundChat answers those automatically using a business's own information, then give one short example of how the bot would respond for a real business.
- If any snippets, FAQs, or knowledge describe a restaurant or another business, treat them only as examples. Do not adopt them as SiroundChat's identity.
- Never enter reservation collection mode for this demo bot. If asked about reservations or bookings, explain the feature instead.
- Do not use the sentence "I don't know based on the document." for this demo bot.

PRODUCT POSITIONING:
- SiroundChat helps businesses answer customer questions instantly, capture leads, take reservations or bookings, and turn chats into revenue.
- It can use a business's FAQs, documents, opening hours, pricing, menu or services, policies, and booking data.
- When useful, mention that the business uploads the information once and the chatbot handles the replies automatically.

STYLE:
- Keep replies concise, polished, and easy to read.
- Use short paragraphs or short lists only when helpful.
- Reply in the same language as the user.

EXAMPLES:
User: What are your opening hours?
Assistant: SiroundChat would answer that instantly using your business information. For example, if your business is open 9am-10pm, the bot would reply with those hours automatically.

User: What are your prices?
Assistant: SiroundChat can automatically answer pricing questions using your menu, service list, or pricing data. You upload the information once, and the chatbot handles the rest.

User: Can I make a reservation?
Assistant: Yes - SiroundChat can take reservations automatically for businesses like restaurants and other booking-based services.
`.trim();
}

export function getSiroundChatDemoReply(message: string, locale: DemoLocale = "en") {
  const normalized = normalize(message);
  if (!normalized) return null;

  const hoursPhrases = [
    "opening hours",
    "open hours",
    "working hours",
    "what are your hours",
    "when are you open",
    "hours",
    "orari",
    "orar",
    "kur jeni hapur"
  ];
  const productPricingPhrases = [
    "how much does siroundchat cost",
    "what does siroundchat cost",
    "price of siroundchat",
    "pricing of siroundchat",
    "how much do you cost",
    "how much is this"
  ];
  const pricingPhrases = [
    "what are your prices",
    "what are the prices",
    "pricing",
    "price",
    "prices",
    "cost",
    "menu",
    "cmim",
    "cmime",
    "cmimet",
    "cmimet"
  ];
  const reservationPhrases = [
    "reservation",
    "reservations",
    "reserve",
    "book",
    "booking",
    "book a table",
    "appointment",
    "appointments",
    "rezerv",
    "termin"
  ];
  const introPhrases = [
    "what is siroundchat",
    "what do you do",
    "how does this work",
    "how do you work",
    "who are you",
    "what can you do",
    "what does siroundchat do"
  ];

  if (includesAny(normalized, hoursPhrases)) {
    return locale === "sq"
      ? "SiroundChat do t'i pergjigjej kesaj menjehere duke perdorur informacionin e biznesit tend. Per shembull, nese biznesi yt eshte hapur 9:00-22:00, chatbot-i do t'ia jepte klientit ate orar automatikisht."
      : "SiroundChat would answer that instantly using your business information. For example, if your business is open 9am-10pm, the chatbot would reply with those hours automatically.";
  }

  if (includesAny(normalized, productPricingPhrases)) {
    return locale === "sq"
      ? "SiroundChat ka cmime te thjeshta:\n- Chatbot: EUR19/muaj\n- Website: EUR19/muaj\n- Bundle (chatbot + website): EUR29/muaj\n\nMund ta nisesh me nje free trial per te pare si funksionon."
      : "SiroundChat offers simple pricing:\n- Chatbot: EUR19/month\n- Website: EUR19/month\n- Bundle (chatbot + website): EUR29/month\n\nYou can start with a free trial to see how it works.";
  }

  if (includesAny(normalized, pricingPhrases)) {
    return locale === "sq"
      ? "SiroundChat mund t'u pergjigjet automatikisht pyetjeve per cmimet duke perdorur menune, sherbimet, ose listen tende te cmimeve. E ngarkon informacionin nje here, dhe chatbot-i merret me pjesen tjeter."
      : "SiroundChat can automatically answer pricing questions using your menu, service list, or pricing data. You upload the information once, and the chatbot handles the rest.";
  }

  if (includesAny(normalized, reservationPhrases)) {
    return locale === "sq"
      ? "Po - SiroundChat mund te marre rezervime automatikisht per biznese si restorante ose sherbime te tjera qe funksionojne me booking."
      : "Yes - SiroundChat can take reservations automatically for businesses like restaurants and other booking-based services.";
  }

  if (includesAny(normalized, introPhrases)) {
    return locale === "sq"
      ? "Une jam SiroundChat. Te tregoj si biznesi yt mund t'u pergjigjet klienteve automatikisht, te kape lead-e, dhe te marre rezervime ose booking pa pune manuale."
      : "I'm SiroundChat. I show you how your business can automatically answer customers, capture leads, and take reservations or bookings without manual back-and-forth.";
  }

  return null;
}

export function getSiroundChatDemoFallbackReply(locale: DemoLocale = "en") {
  return locale === "sq"
    ? "Une jam SiroundChat. Mund te te tregoj si chatbot-i yt do t'u pergjigjej klienteve, do te kapte lead-e, dhe do te automatizonte rezervimet."
    : "I'm SiroundChat. I can show you how your chatbot would answer customers, capture leads, and automate reservations for your business.";
}
