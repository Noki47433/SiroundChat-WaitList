import { formatCurrencyFromCents, formatDateRangeLabel, formatLastUpdatedLabel, formatMinutesLabel } from "@/lib/wrapped/format";

export type Period = "weekly" | "monthly";

export type WrappedRaw = {
  period: Period;
  periodStart: string;
  periodEnd: string;
  lastUpdated: string;
  revenueInfluencedCents: number | null;
  leadsCount: number | null;
  reservationsCount: number | null;
  customersHelpedCount: number | null;
  timeSavedMinutes: number | null;
  peakDayISO?: string | null;
  peakDayLeads?: number | null;
  topQuestion?: string | null;
  topIntent?: string | null;
  mvpConversation?: {
    id: string;
    customerQuestion: string;
    botResponse: string;
    outcomeLabel: "Lead captured" | "Reservation captured" | "Resolved" | "Escalated";
  } | null;
  prevRevenueInfluencedCents?: number | null;
  prevLeadsCount?: number | null;
  prevReservationsCount?: number | null;
  prevTimeSavedMinutes?: number | null;
};

export type WrappedComputed = {
  period: Period;
  dateRangeLabel: string;
  lastUpdatedLabel: string;
  revenueLabel: string;
  revenueCents: number | null;
  leads: number | null;
  reservations: number | null;
  customersHelped: number | null;
  timeSavedMinutes: number | null;
  projectedMonthlyRevenueLabel: string | null;
  projectedMonthlyTimeSavedLabel: string | null;
  revenueDeltaPct: number | null;
  leadsDeltaPct: number | null;
  reservationsDeltaPct: number | null;
  timeSavedDeltaPct: number | null;
  unlocks: {
    mvpChatUnlocked: boolean;
    peakDayUnlocked: boolean;
    topQuestionUnlocked: boolean;
    personalityUnlocked: boolean;
  };
  unlockProgress: {
    chatsResolvedSoFar: number;
    chatsNeededForNextUnlock: number;
    nextUnlockLabel: string;
  };
  peakDayISO?: string | null;
  peakDayLeads?: number | null;
  topQuestion?: string | null;
  topIntent?: string | null;
  mvpConversation?: WrappedRaw["mvpConversation"];
};

const toNumberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const computeDeltaPct = (current: number | null, previous: number | null) => {
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

export const computeWrapped = (
  raw: WrappedRaw,
  options?: { currency?: string; forceUnlocked?: boolean }
): WrappedComputed => {
  const currency = options?.currency ?? "EUR";
  const forceUnlocked = options?.forceUnlocked ?? false;
  const revenueCents = toNumberOrNull(raw.revenueInfluencedCents);
  const leads = toNumberOrNull(raw.leadsCount);
  const reservations = toNumberOrNull(raw.reservationsCount);
  const customersHelped = toNumberOrNull(raw.customersHelpedCount);
  const timeSavedMinutes = toNumberOrNull(raw.timeSavedMinutes);

  const dateRangeLabel = formatDateRangeLabel(raw.periodStart, raw.periodEnd);
  const lastUpdatedLabel = formatLastUpdatedLabel(raw.lastUpdated);

  const revenueLabel = revenueCents === null ? "—" : formatCurrencyFromCents(revenueCents, currency);

  const projectedMonthlyRevenueLabel =
    raw.period === "weekly" && revenueCents !== null
      ? `If this repeats weekly: ~${formatCurrencyFromCents(revenueCents * 4, currency)}/month.`
      : null;

  const projectedMonthlyTimeSavedLabel =
    raw.period === "weekly" && timeSavedMinutes !== null
      ? `At this pace: ~${formatMinutesLabel(timeSavedMinutes * 4)}/month.`
      : null;

  const totalOutcomes = (leads ?? 0) + (reservations ?? 0) + (customersHelped ?? 0);

  const unlocks = forceUnlocked
    ? {
        mvpChatUnlocked: true,
        peakDayUnlocked: true,
        topQuestionUnlocked: true,
        personalityUnlocked: true
      }
    : {
        mvpChatUnlocked: (customersHelped ?? 0) >= 1 || (leads ?? 0) + (reservations ?? 0) >= 1,
        peakDayUnlocked: raw.period === "monthly" ? true : (leads ?? 0) >= 3,
        topQuestionUnlocked: totalOutcomes >= 10,
        personalityUnlocked: raw.period === "monthly" && totalOutcomes >= 10
      };

  const chatsResolvedSoFar = customersHelped ?? 0;
  let chatsNeededForNextUnlock = 5;
  let nextUnlockLabel = "Top money conversation";

  if (chatsResolvedSoFar >= 5 && chatsResolvedSoFar < 10) {
    chatsNeededForNextUnlock = 10;
    nextUnlockLabel = "Peak day";
  } else if (chatsResolvedSoFar >= 10 && chatsResolvedSoFar < 20) {
    chatsNeededForNextUnlock = 20;
    nextUnlockLabel = "Top question";
  } else if (chatsResolvedSoFar >= 20) {
    chatsNeededForNextUnlock = 20;
    nextUnlockLabel = "Bot personality";
  }

  return {
    period: raw.period,
    dateRangeLabel,
    lastUpdatedLabel,
    revenueLabel,
    revenueCents,
    leads,
    reservations,
    customersHelped,
    timeSavedMinutes,
    projectedMonthlyRevenueLabel,
    projectedMonthlyTimeSavedLabel,
    revenueDeltaPct: computeDeltaPct(revenueCents, toNumberOrNull(raw.prevRevenueInfluencedCents)),
    leadsDeltaPct: computeDeltaPct(leads, toNumberOrNull(raw.prevLeadsCount)),
    reservationsDeltaPct: computeDeltaPct(reservations, toNumberOrNull(raw.prevReservationsCount)),
    timeSavedDeltaPct: computeDeltaPct(timeSavedMinutes, toNumberOrNull(raw.prevTimeSavedMinutes)),
    unlocks,
    unlockProgress: {
      chatsResolvedSoFar,
      chatsNeededForNextUnlock,
      nextUnlockLabel
    },
    peakDayISO: raw.peakDayISO ?? null,
    peakDayLeads: toNumberOrNull(raw.peakDayLeads),
    topQuestion: raw.topQuestion ?? null,
    topIntent: raw.topIntent ?? null,
    mvpConversation: raw.mvpConversation ?? null
  };
};
