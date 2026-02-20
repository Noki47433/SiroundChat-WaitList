import { normalizeText } from "@/lib/notifications/detectors";

export type UpsellCatalogRow = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: "reservation_size" | "time" | "intent" | "menu_item" | "custom";
  trigger_rules: Record<string, unknown> | null;
  offer_payload: Record<string, unknown> | null;
  priority?: number | null;
};

export type UpsellContext = {
  reservationSize?: number | null;
  reservationTime?: string | null;
  message: string;
  intentKeywords?: string[];
  menuItems?: string[];
};

export type UpsellAction = {
  type: "show_offer";
  offerId: string;
  title: string;
  description: string;
  price: string | null;
  cta: string;
};

export type UpsellEvaluationResult = {
  matched: boolean;
  score: number;
  action: UpsellAction;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTime = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const buildAction = (row: UpsellCatalogRow): UpsellAction => {
  const payload = row.offer_payload ?? {};
  return {
    type: "show_offer",
    offerId: row.id,
    title: String(payload.title ?? row.name),
    description: String(payload.description ?? row.description ?? "Recommended add-on based on your request."),
    price: payload.price ? String(payload.price) : null,
    cta: String(payload.cta ?? "Add this offer")
  };
};

const tokenSet = (message: string) => new Set(normalizeText(message).split(" ").filter(Boolean));

const matchesReservationSize = (row: UpsellCatalogRow, context: UpsellContext) => {
  const minSize = toNumber(row.trigger_rules?.min_size);
  if (minSize === null || context.reservationSize == null) return false;
  return context.reservationSize >= minSize;
};

const matchesTimeWindow = (row: UpsellCatalogRow, context: UpsellContext) => {
  const value = context.reservationTime;
  const reservationMinutes = normalizeTime(value ?? null);
  if (reservationMinutes === null) return false;

  const start = normalizeTime(String(row.trigger_rules?.start ?? ""));
  const end = normalizeTime(String(row.trigger_rules?.end ?? ""));
  if (start === null || end === null) return false;

  return reservationMinutes >= start && reservationMinutes <= end;
};

const matchesIntent = (row: UpsellCatalogRow, context: UpsellContext) => {
  const normalized = normalizeText(context.message);
  const tokens = tokenSet(context.message);
  const configuredKeywords = Array.isArray(row.trigger_rules?.keywords)
    ? row.trigger_rules?.keywords.map((item) => normalizeText(String(item))).filter(Boolean)
    : [];
  const keywords = configuredKeywords.length
    ? configuredKeywords
    : ["birthday", "anniversary", "celebration", "party"];

  return keywords.some((keyword) => keyword.includes(" ") ? normalized.includes(keyword) : tokens.has(keyword));
};

const matchesMenuItem = (row: UpsellCatalogRow, context: UpsellContext) => {
  const normalized = normalizeText(context.message);
  const menu = (context.menuItems ?? []).map((item) => normalizeText(item)).filter(Boolean);

  if (!menu.length) {
    const configured = Array.isArray(row.trigger_rules?.keywords)
      ? row.trigger_rules.keywords.map((item) => normalizeText(String(item))).filter(Boolean)
      : [];
    return configured.some((keyword) => normalized.includes(keyword));
  }

  return menu.some((item) => normalized.includes(item));
};

const matchesCustom = (row: UpsellCatalogRow, context: UpsellContext) => {
  const normalized = normalizeText(context.message);
  const keywords = Array.isArray(row.trigger_rules?.keywords)
    ? row.trigger_rules.keywords.map((item) => normalizeText(String(item))).filter(Boolean)
    : [];
  if (!keywords.length) return false;

  const requireAll = Boolean(row.trigger_rules?.require_all);
  if (requireAll) {
    return keywords.every((keyword) => normalized.includes(keyword));
  }
  return keywords.some((keyword) => normalized.includes(keyword));
};

const evaluateMatch = (row: UpsellCatalogRow, context: UpsellContext) => {
  switch (row.trigger_type) {
    case "reservation_size":
      return matchesReservationSize(row, context);
    case "time":
      return matchesTimeWindow(row, context);
    case "intent":
      return matchesIntent(row, context);
    case "menu_item":
      return matchesMenuItem(row, context);
    case "custom":
      return matchesCustom(row, context);
    default:
      return false;
  }
};

export function evaluateUpsells(
  catalog: UpsellCatalogRow[],
  context: UpsellContext
): UpsellEvaluationResult | null {
  let best: UpsellEvaluationResult | null = null;

  for (const row of catalog) {
    if (!evaluateMatch(row, context)) continue;

    const base = 10;
    const priorityScore = Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0;
    const score = base + priorityScore;

    const candidate: UpsellEvaluationResult = {
      matched: true,
      score,
      action: buildAction(row)
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  return best;
}
