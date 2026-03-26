const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() ?? "";

export const isPrelaunchModeEnabled = () =>
  TRUE_VALUES.has((process.env.PRELAUNCH_MODE ?? "").trim().toLowerCase());

export const getPrelaunchAllowedEmails = () =>
  new Set(
    (process.env.PRELAUNCH_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  );

export const isPrelaunchEmailAllowed = (email: string | null | undefined) => {
  if (!isPrelaunchModeEnabled()) {
    return true;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  return getPrelaunchAllowedEmails().has(normalizedEmail);
};

export const isPrelaunchUserAllowed = (user: { email?: string | null } | null | undefined) =>
  isPrelaunchEmailAllowed(user?.email);
