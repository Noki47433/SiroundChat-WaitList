// Summary: Client-side helper to decide if auth is disabled for the UI (e.g., demo mode). Learn it lightly—useful for understanding when login is skipped.
export const isAuthDisabledClient = () =>
  process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" || process.env.DISABLE_AUTH === "true";
