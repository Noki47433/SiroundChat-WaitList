export const isSafeRedirectPath = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.toLowerCase().includes("http")) return false;
  return true;
};

export const resolveRedirectPath = (value: unknown, fallback = "/") =>
  isSafeRedirectPath(value) ? value : fallback;
