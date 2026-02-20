import { createHash } from "crypto";

export type ErrorSeverity = "info" | "warn" | "error" | "fatal";

const cleanLine = (value: string) => value.replace(/\s+/g, " ").trim();

export const stackTopLines = (stack: string | null | undefined, limit = 3) => {
  if (!stack) return "";
  return stack
    .split("\n")
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .slice(0, limit)
    .join("\n");
};

export const firstMessageLine = (message: string | null | undefined) => {
  if (!message) return "unknown-error";
  const first = message.split("\n")[0] ?? message;
  return cleanLine(first).slice(0, 500) || "unknown-error";
};

export const computeErrorFingerprint = (input: {
  message: string;
  stack?: string | null;
  route?: string | null;
}) => {
  const normalized = [firstMessageLine(input.message), stackTopLines(input.stack, 3), cleanLine(input.route ?? "")]
    .join("||")
    .toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
};

export const severityToFeedbackImportance = (severity: ErrorSeverity) => {
  if (severity === "fatal") return "critical";
  if (severity === "error") return "high";
  if (severity === "warn") return "medium";
  return "low";
};

