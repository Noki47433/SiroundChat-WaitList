import { z } from "zod";

export const SendChatSchema = z.object({
  siteId: z.union([z.string().uuid(), z.string().min(3)]),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  clientMeta: z
    .object({
      url: z.string().url().optional(),
      userAgent: z.string().optional(),
      language: z.string().optional()
    })
    .optional()
});

export const DashboardConversationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  filter: z.enum(["all", "unread", "leads", "today"]).default("all")
});

export const LeadSchema = z.object({
  conversationId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional()
});

export const FeedbackSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  rating: z.enum(["up", "down"]),
  tags: z.array(z.string().min(1)).optional(),
  comment: z.string().min(1).max(500).optional()
});
