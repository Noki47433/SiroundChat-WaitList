import { z } from "zod";

export const AnalyticsEventSchema = z.object({
  type: z.enum([
    "page_visit",
    "chat_open",
    "message_sent",
    "lead_captured",
    "site_published",
    "builder_action"
  ]),
  siteId: z.string().uuid(),
  sessionId: z.string().min(6),
  path: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().optional()
});

export const AnalyticsAggregateQuerySchema = z.object({
  siteId: z.string().uuid(),
  range: z.enum(["7d", "30d", "90d"]).default("30d")
});
