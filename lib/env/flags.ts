import "server-only";

export function isFreeMode() {
  return process.env.NODE_ENV !== "production" && process.env.FREE_MODE === "1";
}
