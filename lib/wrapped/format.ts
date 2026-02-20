export const formatCurrencyFromCents = (cents: number, currency = "EUR") => {
  const roundedCents = Math.round(cents);
  const decimals = roundedCents % 100 === 0 ? 0 : roundedCents % 10 === 0 ? 1 : 2;
  const amount = roundedCents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  }
};

export const formatDateRangeLabel = (startIso?: string | null, endIso?: string | null) => {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(start)} → ${fmt.format(end)}`;
};

export const formatLastUpdatedLabel = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `Last updated: ${dateFmt.format(date)}, ${timeFmt.format(date)}`;
};

export const formatShortDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return fmt.format(date);
};

export const formatMinutesLabel = (minutes: number) => {
  const rounded = Math.round(minutes);
  return rounded === 1 ? "1 minute" : `${rounded} minutes`;
};
