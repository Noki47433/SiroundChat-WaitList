type LogLevel = "info" | "warn" | "error";

const logPrefix = "SIROUNDCHAT";

export const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = meta ? { ...meta } : undefined;
  switch (level) {
    case "info":
      console.info(`[${logPrefix}] ${message}`, payload);
      break;
    case "warn":
      console.warn(`[${logPrefix}] ${message}`, payload);
      break;
    case "error":
      console.error(`[${logPrefix}] ${message}`, payload);
      break;
    default:
      console.log(`[${logPrefix}] ${message}`, payload);
  }
};
