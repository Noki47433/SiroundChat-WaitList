import "server-only";

export const PAYSERA_CONFIG = {
  projectId: process.env.PAYSERA_PROJECT_ID!,
  signPassword: process.env.PAYSERA_SIGN_PASSWORD!,
};
