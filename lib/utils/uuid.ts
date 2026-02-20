export function generateId(_prefix?: string) {
  return crypto.randomUUID();
}
