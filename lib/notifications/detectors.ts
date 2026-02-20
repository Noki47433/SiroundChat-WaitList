const CONTACT_KEYWORDS = [
  "phone",
  "number",
  "call",
  "email",
  "mail",
  "contact",
  "whatsapp",
  "whatsap",
  "instagram",
  "insta",
  "ig",
  "facebook",
  "dm",
  "numri",
  "numrin",
  "telefon",
  "tel",
  "kontakti",
  "kontakt",
  "kontaktin",
  "kontakto",
  "emaili"
];

const CONTACT_PHRASES = [
  "reach you",
  "reach out",
  "get in touch",
  "contact you",
  "contact info",
  "contact information",
  "phone number",
  "email address",
  "whats app",
  "e mail",
  "me kontaktu"
];

const ASK_INTENT_PHRASES = [
  "what is",
  "what s",
  "whats",
  "where can i",
  "how can i",
  "how do i",
  "can i get",
  "could i get",
  "can you",
  "could you",
  "do you have",
  "give me",
  "send me",
  "share your",
  "your phone",
  "your number",
  "your email",
  "your contact",
  "contact info",
  "contact information",
  "cili eshte",
  "cila eshte",
  "ku mund",
  "si mund",
  "a mund",
  "a mundem",
  "ma jep",
  "me jep",
  "ma dergo",
  "me dergo",
  "numrin tuaj",
  "numri juaj",
  "kontaktin tuaj",
  "kontakti juaj",
  "emailin tuaj",
  "emaili juaj",
  "telefonin tuaj",
  "telefoni juaj",
  "me kontaktu",
  "me kontakto"
];

const PROVIDING_PHRASES = [
  "my number is",
  "my phone is",
  "my email is",
  "my email",
  "my phone",
  "call me at",
  "reach me at",
  "you can reach me",
  "contact me at",
  "here is my",
  "here s my",
  "heres my",
  "my whatsapp",
  "my instagram",
  "my insta",
  "my ig",
  "my contact",
  "numri im",
  "numri im eshte",
  "telefoni im",
  "telefoni im eshte",
  "emaili im",
  "emaili im eshte",
  "kontakti im",
  "me kontaktoni",
  "me kontakto",
  "mund te me kontaktoni"
];

const SOCIAL_HANDLE_REGEX = /\b(ig|insta|instagram|whatsapp)\s*[:\-]?\s*@/i;

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/;
const NAME_PATTERNS: RegExp[] = [
  /\bmy name is\s+([a-z][a-z'\- ]{1,60})/i,
  /\bi am\s+([a-z][a-z'\- ]{1,60})/i,
  /\bi'm\s+([a-z][a-z'\- ]{1,60})/i,
  /\bthis is\s+([a-z][a-z'\- ]{1,60})/i,
  /\bname:\s*([a-z][a-z'\- ]{1,60})/i
];

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractLeadInfo = (message: string) => {
  const text = message.trim();
  if (!text) {
    return { name: null, email: null, phone: null };
  }

  const emailMatch = text.match(EMAIL_REGEX);
  const phoneMatch = text.match(PHONE_REGEX);
  let name: string | null = null;

  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      name = match[1].trim();
      break;
    }
  }

  const email = emailMatch ? emailMatch[0].trim() : null;
  const phoneRaw = phoneMatch ? phoneMatch[0].trim() : null;
  const phoneNormalized = phoneRaw ? normalizePhone(phoneRaw) : null;
  const phone = phoneNormalized && phoneNormalized.replace(/\D/g, "").length >= 7 ? phoneNormalized : null;

  return { name, email, phone };
};

const hasContactKeyword = (normalized: string) => {
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (CONTACT_KEYWORDS.some((keyword) => tokens.has(keyword))) {
    return true;
  }
  return CONTACT_PHRASES.some((phrase) => normalized.includes(phrase));
};

const hasAskIntent = (normalized: string, raw: string) => {
  if (ASK_INTENT_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return true;
  }
  return raw.includes("?");
};

export const isProvidingContactInfo = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const { email, phone } = extractLeadInfo(text);
  if (email || phone) return true;
  if (SOCIAL_HANDLE_REGEX.test(text)) return true;

  return PROVIDING_PHRASES.some((phrase) => normalized.includes(phrase));
};

export const isAskingForBusinessContactInfo = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (isProvidingContactInfo(text)) return false;
  if (!hasContactKeyword(normalized)) return false;
  return hasAskIntent(normalized, text);
};

export const detectContactIntent = (text: string) => isAskingForBusinessContactInfo(text);
