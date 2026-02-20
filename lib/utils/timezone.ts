const resolveTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
};

const getParts = (date: Date, timeZone: string) => {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }

  return parts;
};

export const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
};

export const startOfDayInTimeZone = (date: Date, timeZone: string) => {
  const parts = getParts(date, timeZone);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0);
  const offset = getTimeZoneOffsetMs(new Date(asUtc), timeZone);
  return new Date(asUtc - offset);
};

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const getRollingRangeInTimeZone = (timeZone: string, days: number) => {
  const now = new Date();
  const startOfToday = startOfDayInTimeZone(now, timeZone);
  const start = addDays(startOfToday, -days);
  return { start, end: now };
};
