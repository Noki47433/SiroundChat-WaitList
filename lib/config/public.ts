// Summary: Client-side helper to decide if auth is disabled for the UI during local development only.
const isTruthyFlag = (value?: string) => value === "true" || value === "1";

export const isAuthDisabledClient = () =>
  process.env.NODE_ENV !== "production" &&
  (isTruthyFlag(process.env.NEXT_PUBLIC_DISABLE_AUTH) || isTruthyFlag(process.env.DISABLE_AUTH));
