export type BehaviorRule = {
  id: string;
  name: string;
  condition: Record<string, unknown> | null;
  action: Record<string, unknown> | null;
  is_active?: boolean | null;
};

export type BehaviorContext = {
  now: Date;
  lastReservationAt?: Date | null;
  fridayReservationCount?: number;
  customerTags?: string[];
};

export type BehaviorEvaluationResult = {
  triggered: boolean;
  reason: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

const evaluateInactiveDays = (condition: Record<string, unknown>, context: BehaviorContext): BehaviorEvaluationResult => {
  const days = Number(condition.days ?? 30);
  const last = context.lastReservationAt;

  if (!last || Number.isNaN(last.getTime())) {
    return { triggered: true, reason: `No reservation found in the last ${days} days.` };
  }

  const elapsedDays = (context.now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  const triggered = elapsedDays >= days;
  return {
    triggered,
    reason: triggered
      ? `Customer inactive for ${Math.floor(elapsedDays)} days.`
      : `Customer active ${Math.floor(elapsedDays)} days ago.`
  };
};

const evaluateFridayRegular = (condition: Record<string, unknown>, context: BehaviorContext): BehaviorEvaluationResult => {
  const minBookings = Number(condition.min_bookings ?? 3);
  const count = context.fridayReservationCount ?? 0;
  const triggered = count >= minBookings;
  return {
    triggered,
    reason: triggered
      ? `Friday booking pattern matched (${count} bookings).`
      : `Friday booking pattern not matched (${count}/${minBookings}).`
  };
};

const evaluateHasTag = (condition: Record<string, unknown>, context: BehaviorContext): BehaviorEvaluationResult => {
  const tagValue = String(condition.tag ?? "").trim();
  if (!tagValue) {
    return { triggered: false, reason: "Rule tag is missing." };
  }

  const target = normalize(tagValue);
  const tags = (context.customerTags ?? []).map(normalize);
  const triggered = tags.includes(target);

  return {
    triggered,
    reason: triggered ? `Customer tag '${tagValue}' matched.` : `Customer tag '${tagValue}' not found.`
  };
};

export function evaluateBehaviorCondition(
  condition: Record<string, unknown> | null,
  context: BehaviorContext
): BehaviorEvaluationResult {
  if (!condition || typeof condition !== "object") {
    return { triggered: false, reason: "Rule condition is empty." };
  }

  const type = String(condition.type ?? "").trim();

  switch (type) {
    case "inactive_days":
      return evaluateInactiveDays(condition, context);
    case "friday_regular":
      return evaluateFridayRegular(condition, context);
    case "has_tag":
      return evaluateHasTag(condition, context);
    default:
      return { triggered: false, reason: `Unsupported rule type '${type}'.` };
  }
}

export function evaluateBehaviorRules(
  rules: BehaviorRule[],
  context: BehaviorContext
): Array<{ rule: BehaviorRule; result: BehaviorEvaluationResult }> {
  return rules
    .filter((rule) => rule.is_active !== false)
    .map((rule) => ({
      rule,
      result: evaluateBehaviorCondition(rule.condition, context)
    }))
    .filter((entry) => entry.result.triggered);
}
