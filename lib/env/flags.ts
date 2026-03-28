import "server-only";

export function isFreeMode() {
  return process.env.FREE_MODE === "1";
}
