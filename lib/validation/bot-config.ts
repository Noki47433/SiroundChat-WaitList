// lib/validation/bot-config.ts
// Zod validation schemas for bot configuration API endpoints.

import { z } from "zod";
import { BOT_BUSINESS_TYPES, ACTION_TYPES } from "@/lib/config/industry-presets";

export const BotBusinessTypeSchema = z.enum(BOT_BUSINESS_TYPES);

export const ActionTypeSchema = z.enum(ACTION_TYPES);

export const VALID_ICON_KEYS = [
  "clock", "phone", "mail", "map-pin", "calendar", "utensils", "menu",
  "tag", "euro", "message-circle", "car", "home", "building", "stethoscope",
  "scissors", "dumbbell", "bed", "sparkles", "info", "help-circle",
] as const;

export const QuickButtonSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(24),
  prompt: z.string().min(1).max(160),
  icon: z.string().max(32).optional(),
  enabled: z.boolean(),
  order: z.number().int(),
});

export const BotConfigSchema = z.object({
  businessType: BotBusinessTypeSchema,
  actionType: ActionTypeSchema,
  bookingsEnabled: z.boolean(),
  quickButtons: z.array(QuickButtonSchema).max(8),
});

export type BotConfigInput = z.infer<typeof BotConfigSchema>;
